import { NextResponse } from "next/server";
import {
  EMPTY_ANALYZE_RESULT,
  SANDBOX_INTENTS,
  SandboxAnalyzeResult,
  SandboxIntent,
  SandboxTimeStatus,
} from "@/lib/sandbox";
import type { SandboxAppointmentDraft, SandboxAppointmentAnalyzeResult } from "@/lib/sandboxAppointmentDraft";
import { EMPTY_SANDBOX_APPOINTMENT_DRAFT, mergeSandboxAppointmentDraft, normalizeSandboxAppointmentExtracted } from "@/lib/sandboxAppointmentDraft";
import {
  buildSandboxAppointmentPolicyPrompt,
  fetchActiveSandboxAppointmentPolicy,
} from "@/lib/sandboxAppointmentPolicy";
import {
  extractSandboxAppointmentFieldsFromMessage,
  getMissingSandboxAppointmentPolicyFields,
  normalizeSandboxAppointmentCustomerStatus,
  parseSandboxAppointmentPolicyIntakeForms,
} from "@/lib/sandboxAppointmentIntakeForm";
import type { SandboxAppointmentPolicyDebug } from "@/lib/sandboxAppointmentPolicy";
import type { SandboxConversationFlow } from "@/lib/sandboxConversationFlow";

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const TAIWAN_TIMEZONE = "Asia/Taipei";
const MAX_HISTORY_LENGTH = 10;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

type SandboxHistoryMessage = {
  role: "customer" | "assistant";
  content: string;
};

function parseNumber(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function normalizeIntent(value: unknown): SandboxIntent {
  if (typeof value !== "string") return "unknown";
  const lowered = value.trim().toLowerCase();
  if (SANDBOX_INTENTS.includes(lowered as SandboxIntent)) return lowered as SandboxIntent;
  return "unknown";
}

function normalizeTimeStatus(value: unknown): SandboxTimeStatus {
  if (value === "valid" || value === "past" || value === "unclear") return value;
  return "unclear";
}

function normalizeResult(payload: unknown): SandboxAppointmentAnalyzeResult {
  const source = typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>) : {};
  const extractedSource =
    typeof source.extracted === "object" && source.extracted !== null ? (source.extracted as Record<string, unknown>) : {};
  const extracted = normalizeSandboxAppointmentExtracted(extractedSource);

  return {
    intent: normalizeIntent(source.intent),
    confidence: parseNumber(source.confidence),
    customer_reply:
      typeof source.customer_reply === "string" && source.customer_reply.trim()
        ? source.customer_reply.trim()
        : EMPTY_ANALYZE_RESULT.customer_reply,
    target_module:
      typeof source.target_module === "string" && source.target_module.trim()
        ? (source.target_module.trim() as SandboxAnalyzeResult["target_module"])
        : EMPTY_ANALYZE_RESULT.target_module,
    summary: typeof source.summary === "string" && source.summary.trim() ? source.summary.trim() : EMPTY_ANALYZE_RESULT.summary,
    extracted: {
      ...extracted,
      time_status: normalizeTimeStatus(extractedSource.time_status),
      needs_clarification: extractedSource.needs_clarification === true,
    },
  };
}

function extractGeminiText(payload: unknown): string {
  const root = payload as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = root?.candidates?.[0]?.content?.parts?.[0]?.text;
  return typeof text === "string" ? text : "";
}

function getTaiwanNowContext() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: TAIWAN_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "long",
  });
  const parts = formatter.formatToParts(now);

  const getPart = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || "";

  return {
    currentDate: `${getPart("year")}-${getPart("month")}-${getPart("day")}`,
    currentTime: `${getPart("hour")}:${getPart("minute")}`,
    currentWeekday: getPart("weekday"),
    timezone: TAIWAN_TIMEZONE,
  };
}

function formatUtcDate(date: Date) {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDaysToDateString(dateString: string, days: number) {
  const [year, month, day] = dateString.split("-").map(Number);
  if (!year || !month || !day) return "";
  return formatUtcDate(new Date(Date.UTC(year, month - 1, day) + days * DAY_IN_MS));
}

function getWeekdayIndex(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number);
  if (!year || !month || !day) return 0;
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function parseChineseWeekday(value: string) {
  const match = value.match(/[週周星期禮拜]([一二三四五六日天])/);
  if (!match) return null;
  const map: Record<string, number> = { 日: 0, 天: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6 };
  return map[match[1]] ?? null;
}

function parseColloquialDate(message: string, currentDate: string) {
  if (/今天/.test(message)) return currentDate;
  if (/明天/.test(message)) return addDaysToDateString(currentDate, 1);
  if (/後天/.test(message)) return addDaysToDateString(currentDate, 2);

  const targetWeekday = parseChineseWeekday(message);
  if (targetWeekday === null) return "";

  const currentWeekday = getWeekdayIndex(currentDate);
  const baseDelta = (targetWeekday - currentWeekday + 7) % 7;
  if (/下週|下周|下星期|下禮拜/.test(message)) {
    const currentMondayBased = currentWeekday === 0 ? 6 : currentWeekday - 1;
    const targetMondayBased = targetWeekday === 0 ? 6 : targetWeekday - 1;
    return addDaysToDateString(currentDate, 7 - currentMondayBased + targetMondayBased);
  }
  return addDaysToDateString(currentDate, baseDelta === 0 ? 7 : baseDelta);
}

function normalizeHourForMeridiem(hour: number, meridiem: string) {
  if (/下午|晚上|傍晚/.test(meridiem) && hour >= 1 && hour <= 11) return hour + 12;
  if (/上午|早上|早晨/.test(meridiem) && hour === 12) return 0;
  return hour;
}

function parseColloquialTime(message: string) {
  const colonMatch = message.match(/(上午|早上|中午|下午|晚上|傍晚)?\s*([0-2]?\d)\s*[:：]\s*([0-5]\d)/);
  if (colonMatch) {
    const hour = normalizeHourForMeridiem(Number(colonMatch[2]), colonMatch[1] || "");
    const minute = Number(colonMatch[3]);
    if (hour >= 0 && hour <= 23) return `${`${hour}`.padStart(2, "0")}:${`${minute}`.padStart(2, "0")}`;
  }

  const hourMatch = message.match(/(上午|早上|中午|下午|晚上|傍晚)?\s*([0-2]?\d)\s*(?:點|時)(半|[0-5]?\d分?)?/);
  if (hourMatch) {
    const hour = normalizeHourForMeridiem(Number(hourMatch[2]), hourMatch[1] || "");
    const minuteText = hourMatch[3] || "";
    const minute = minuteText.includes("半") ? 30 : Number((minuteText.match(/\d+/) || ["0"])[0]);
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) return `${`${hour}`.padStart(2, "0")}:${`${minute}`.padStart(2, "0")}`;
  }

  if (/中午/.test(message)) return "12:00";
  return "";
}

function normalizeAppointmentTimeFields(
  message: string,
  extracted: SandboxAppointmentAnalyzeResult["extracted"],
  taiwanNow: ReturnType<typeof getTaiwanNowContext>,
) {
  const normalized = { ...extracted };
  if (!DATE_PATTERN.test(normalized.preferred_date)) {
    const parsedDate = parseColloquialDate(`${message} ${normalized.preferred_date}`, taiwanNow.currentDate);
    if (parsedDate) normalized.preferred_date = parsedDate;
  }

  if (!TIME_PATTERN.test(normalized.preferred_time)) {
    const parsedTime = parseColloquialTime(`${message} ${normalized.preferred_time}`);
    if (parsedTime) normalized.preferred_time = parsedTime;
  }

  if (DATE_PATTERN.test(normalized.preferred_date) && TIME_PATTERN.test(normalized.preferred_time)) {
    normalized.time_status =
      normalized.preferred_date < taiwanNow.currentDate ||
      (normalized.preferred_date === taiwanNow.currentDate && normalized.preferred_time <= taiwanNow.currentTime)
        ? "past"
        : "valid";
  }

  return normalized;
}

function coerceAppointmentDraft(value: Partial<SandboxAppointmentDraft> | undefined): SandboxAppointmentDraft {
  return {
    ...EMPTY_SANDBOX_APPOINTMENT_DRAFT,
    service_item: value?.service_item || "",
    pet_name: value?.pet_name || "",
    pet_type_or_breed: value?.pet_type_or_breed || "",
    pet_weight: value?.pet_weight || "",
    preferred_date: value?.preferred_date || "",
    preferred_time: value?.preferred_time || "",
    owner_name: value?.owner_name || "",
    phone: value?.phone || "",
    customer_status: value?.customer_status || "",
    health_notes: value?.health_notes || "",
    custom_fields: value?.custom_fields && typeof value.custom_fields === "object" ? value.custom_fields : {},
    missing_fields: Array.isArray(value?.missing_fields) ? value.missing_fields : [],
    last_updated_at: value?.last_updated_at || "",
  };
}

function normalizeHistory(value: unknown): SandboxHistoryMessage[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (typeof item !== "object" || item === null) return null;
      const source = item as Record<string, unknown>;
      if ((source.role !== "customer" && source.role !== "assistant") || typeof source.content !== "string") return null;
      const content = source.content.trim();
      if (!content) return null;
      return { role: source.role, content };
    })
    .filter((item): item is SandboxHistoryMessage => item !== null);
}

function buildAppointmentPolicyDebug(context: Awaited<ReturnType<typeof fetchActiveSandboxAppointmentPolicy>>): SandboxAppointmentPolicyDebug {
  const parsed = parseSandboxAppointmentPolicyIntakeForms(context);
  const hasPolicy = context.status === "active" || context.status === "fallback_used";
  const parsedForms = parsed.forms.map((form) => form.status);
  const parsedRequiredFields = Array.from(new Set(parsed.forms.flatMap((form) => form.fields.map((field) => field.label))));
  const appointmentPolicyStatus: SandboxAppointmentPolicyDebug["appointment_policy_status"] =
    hasPolicy && parsed.forms.length === 0 ? "parse_failed" : context.status;
  const reason =
    appointmentPolicyStatus === "parse_failed"
      ? "policy active but intake form parse failed"
      : context.status === "fallback_used"
        ? context.reason || "category mismatch fallback used"
        : "reason" in context
          ? context.reason || ""
          : "";

  return {
    appointment_policy_status: appointmentPolicyStatus,
    matched_policy_title: hasPolicy ? context.article.title : null,
    matched_policy_category: hasPolicy ? context.article.category : null,
    parsed_forms: parsedForms,
    parsed_required_fields: parsedRequiredFields,
    reason,
  };
}

export async function POST(request: Request) {
  try {
    const { message, history, gateDecision, appointmentDraft, flowHint } = (await request.json()) as {
      message?: string;
      history?: unknown;
      gateDecision?: string;
      appointmentDraft?: Partial<SandboxAppointmentDraft>;
      flowHint?: SandboxConversationFlow;
    };

    if (!message || !message.trim()) {
      return NextResponse.json({ error: "請輸入要分析的客人訊息。" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Gemini API Key 尚未設定" }, { status: 500 });
    }

    const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
    const geminiUrl = `${GEMINI_BASE_URL}/${model}:generateContent`;
    const taiwanNow = getTaiwanNowContext();
    const normalizedHistory = normalizeHistory(history);
    const recentHistory = normalizedHistory.slice(-MAX_HISTORY_LENGTH);
    const appointmentPolicyContext = await fetchActiveSandboxAppointmentPolicy();
    const appointmentPolicyDebug = buildAppointmentPolicyDebug(appointmentPolicyContext);
    const appointmentPolicyPrompt = buildSandboxAppointmentPolicyPrompt(appointmentPolicyContext);
    const appointmentDraftContext = appointmentDraft
      ? JSON.stringify(
          {
            service_item: appointmentDraft.service_item || "",
            pet_name: appointmentDraft.pet_name || "",
            pet_type_or_breed: appointmentDraft.pet_type_or_breed || "",
            pet_weight: appointmentDraft.pet_weight || "",
            preferred_date: appointmentDraft.preferred_date || "",
            preferred_time: appointmentDraft.preferred_time || "",
            owner_name: appointmentDraft.owner_name || "",
            phone: appointmentDraft.phone || "",
            customer_status: appointmentDraft.customer_status || "",
            health_notes: appointmentDraft.health_notes || "",
            custom_fields: appointmentDraft.custom_fields || {},
            missing_fields: appointmentDraft.missing_fields || [],
          },
          null,
          2,
        )
      : "（無）";
    const historyContext =
      recentHistory.length > 0
        ? recentHistory.map((item, index) => `${index + 1}. ${item.role === "customer" ? "客人" : "助理"}：${item.content}`).join("\n")
        : "（無）";

    const prompt = `你是客服分流判斷器。
請根據使用者提供的客人訊息，判斷客服意圖，並抽取可用欄位。

現在時間基準（請務必使用這個基準做時間理解）：
- 目前日期：${taiwanNow.currentDate}
- 目前時間：${taiwanNow.currentTime}
- 目前星期：${taiwanNow.currentWeekday}
- 時區：${taiwanNow.timezone}

判斷規則：
- appointment_request：客人想預約、改約、詢問可預約時間、指定服務時間
- abnormal_alert：客訴、不滿、受傷、投訴、緊急、負面情緒
- knowledge_question：詢問價格、營業時間、服務內容、注意事項
- manual_reply_task：需要人員判斷或 AI 不確定
- unknown：無法判斷

時間理解規則：
- 以 ${taiwanNow.timezone} 的目前日期與時間為基準，理解「今天、明天、後天、下週、下週三、今晚、晚上、下午、中午」等口語時間。
- 優先把 extracted.preferred_date 轉為 YYYY-MM-DD。
- 優先把 extracted.preferred_time 轉為 HH:mm（24 小時制）。
- 例如客人說「明天12點」，若今天是 2026-04-27，應輸出 preferred_date=2026-04-28, preferred_time=12:00。
- 若客人指定時間已經過去（例如現在 19:00 說今天 18:00）：
  1) intent 仍可為 appointment_request
  2) extracted.time_status 請輸出 "past"
  3) extracted.needs_clarification 請輸出 true
  4) customer_reply 要禮貌提醒該時段已過，請提供新的可預約時間
  5) summary 要明確註記「時間已過」
- 若時間資訊不足或不確定，time_status="unclear" 且 needs_clarification=true。
- 僅在日期時間可直接用於預約時，time_status="valid" 且 needs_clarification=false。

預約草稿規則：
- current appointment draft 是本輪訊息之前已累積的沙盒草稿，請把它視為既有資料。
- 若客人本輪只補充一個欄位（例如「是球球」），仍應沿用 current appointment draft 與 history 判斷為 appointment_request，並只補上新欄位。
- 不要把空字串當作更正；只有客人明確提供新的非空欄位時才輸出該欄位。
- 若客人明確改時間或更改資料，才輸出新的欄位值。
- extracted.missing_fields 必須依 active appointment_policy 與 current appointment draft 判斷，不要寫成店家專屬固定規則。
- customer_reply 必須基於 current appointment draft 加上本輪可抽取的新資料，不可重問已在草稿中的資料。
- appointment_policy 若有新客 / 舊客格式，required fields 必須依客人身分分流；舊客在 sandbox 先默認資料存在，不需要查 customer database。
- 新客若 policy 沒有要求飼主姓名，不要要求 owner_name / 飼主姓名。
- 不要主動要求毛長 / 毛況，除非 active appointment_policy 明確要求。
- 若客人只問價格且沒有明確預約，intent 應為 knowledge_question，不要進預約表單。
- 未經門市確認前，不可說預約成功、已為您預約、已幫您保留、已安排、已確認預約、明天三點見，或任何讓客人以為預約已成立的話。

最近沙盒對話紀錄（最多 ${MAX_HISTORY_LENGTH} 則，越後面越新）：
Sandbox gate decision: ${gateDecision || "unknown"}

current appointment draft:
${appointmentDraftContext}

Appointment policy:
${appointmentPolicyPrompt}

${historyContext}

你必須只輸出 JSON，禁止輸出任何 JSON 以外文字。
JSON schema：
{
  "intent": "appointment_request | abnormal_alert | knowledge_question | manual_reply_task | unknown",
  "confidence": 0.0,
  "customer_reply": "給客人的繁體中文回覆",
  "target_module": "Appointment Requests | Abnormal Alerts | Knowledge Base | Manual Reply Tasks | Conversation Logs",
  "summary": "繁體中文摘要",
  "extracted": {
    "customer_name": "",
    "service_item": "",
    "preferred_date": "",
    "preferred_time": "",
    "pet_name": "",
    "pet_type_or_breed": "",
    "pet_weight": "",
    "owner_name": "",
    "phone": "",
    "customer_status": "",
    "health_notes": "",
    "custom_fields": {},
    "missing_fields": [],
    "issue": "",
    "urgency": "",
    "time_status": "valid | past | unclear",
    "needs_clarification": false
  }
}

客人訊息：${message.trim()}`;

    const response = await fetch(`${geminiUrl}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1,
        },
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      return NextResponse.json({ error: `Gemini 呼叫失敗（model: ${model}）：${body || response.statusText}` }, { status: 502 });
    }

    const raw = await response.json();
    const text = extractGeminiText(raw);

    if (!text) {
      return NextResponse.json({ error: `Gemini 未回傳可解析內容（model: ${model}）` }, { status: 502 });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: `Gemini 回傳格式不是有效 JSON（model: ${model}）` }, { status: 502 });
    }

    const normalizedResult = normalizeResult(parsed);
    if (flowHint === "appointment_flow" && normalizedResult.intent !== "abnormal_alert" && normalizedResult.intent !== "manual_reply_task") {
      normalizedResult.intent = "appointment_request";
      normalizedResult.target_module = "Appointment Requests";
      normalizedResult.confidence = Math.max(normalizedResult.confidence, 0.9);
    }

    if (normalizedResult.intent === "appointment_request") {
      const ruleExtracted = extractSandboxAppointmentFieldsFromMessage(message.trim(), appointmentPolicyContext);
      const mergedExtracted = normalizeSandboxAppointmentExtracted({
        ...normalizedResult.extracted,
        ...ruleExtracted,
        custom_fields: {
          ...(normalizedResult.extracted.custom_fields || {}),
          ...(ruleExtracted.custom_fields || {}),
        },
      });
      const extractedWithStructuredTime = normalizeAppointmentTimeFields(message.trim(), mergedExtracted, taiwanNow);
      const draftForMissingCheck = mergeSandboxAppointmentDraft(coerceAppointmentDraft(appointmentDraft), extractedWithStructuredTime);
      const customerStatus = normalizeSandboxAppointmentCustomerStatus(draftForMissingCheck.customer_status);
      const missingPolicyFields = getMissingSandboxAppointmentPolicyFields(appointmentPolicyContext, draftForMissingCheck);
      const canUsePolicyFields = appointmentPolicyContext.status === "active" || appointmentPolicyContext.status === "fallback_used";
      const shouldUpdateMissingFields = canUsePolicyFields || Array.isArray(extractedWithStructuredTime.missing_fields);
      const nextMissingFields =
        canUsePolicyFields ? missingPolicyFields.map((item) => item.label) : extractedWithStructuredTime.missing_fields;

      return NextResponse.json({
        appointmentPolicyContext,
        appointmentPolicyDebug,
        result: {
          ...normalizedResult,
          target_module: "Appointment Requests",
          extracted: {
            ...extractedWithStructuredTime,
            ...(shouldUpdateMissingFields ? { missing_fields: nextMissingFields || [] } : {}),
            needs_clarification:
              (shouldUpdateMissingFields ? (nextMissingFields || []).length > 0 : extractedWithStructuredTime.needs_clarification) ||
              customerStatus === "unknown" ||
              extractedWithStructuredTime.time_status !== "valid",
          },
        },
      });
    }

    return NextResponse.json({ result: normalizedResult, appointmentPolicyContext, appointmentPolicyDebug });
  } catch (error) {
    return NextResponse.json({ error: `分析失敗：${(error as Error).message}` }, { status: 500 });
  }
}
