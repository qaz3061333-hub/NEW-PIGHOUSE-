import { NextResponse } from "next/server";
import {
  EMPTY_ANALYZE_RESULT,
  SANDBOX_INTENTS,
  SandboxAnalyzeResult,
  SandboxIntent,
  SandboxTimeStatus,
} from "@/lib/sandbox";
import {
  buildSandboxAppointmentPolicyPrompt,
  fetchActiveSandboxAppointmentPolicy,
  sanitizeSandboxAppointmentResult,
} from "@/lib/sandboxAppointmentPolicy";

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const TAIWAN_TIMEZONE = "Asia/Taipei";
const MAX_HISTORY_LENGTH = 10;

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

function normalizeResult(payload: unknown): SandboxAnalyzeResult {
  const source = typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>) : {};
  const extractedSource =
    typeof source.extracted === "object" && source.extracted !== null ? (source.extracted as Record<string, unknown>) : {};

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
      customer_name: typeof extractedSource.customer_name === "string" ? extractedSource.customer_name : "",
      service_item: typeof extractedSource.service_item === "string" ? extractedSource.service_item : "",
      preferred_date: typeof extractedSource.preferred_date === "string" ? extractedSource.preferred_date : "",
      preferred_time: typeof extractedSource.preferred_time === "string" ? extractedSource.preferred_time : "",
      issue: typeof extractedSource.issue === "string" ? extractedSource.issue : "",
      urgency: typeof extractedSource.urgency === "string" ? extractedSource.urgency : "",
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

export async function POST(request: Request) {
  try {
    const { message, history, gateDecision } = (await request.json()) as {
      message?: string;
      history?: unknown;
      gateDecision?: string;
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
    const appointmentPolicyPrompt = buildSandboxAppointmentPolicyPrompt(appointmentPolicyContext);
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

最近沙盒對話紀錄（最多 ${MAX_HISTORY_LENGTH} 則，越後面越新）：
Appointment policy guard:
Sandbox gate decision: ${gateDecision || "unknown"}
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

    return NextResponse.json({ result: sanitizeSandboxAppointmentResult(normalizeResult(parsed), appointmentPolicyContext) });
  } catch (error) {
    return NextResponse.json({ error: `分析失敗：${(error as Error).message}` }, { status: 500 });
  }
}
