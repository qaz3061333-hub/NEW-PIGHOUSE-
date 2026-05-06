import { NextResponse } from "next/server";

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const TAIWAN_TIMEZONE = "Asia/Taipei";
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

type ReplyAction = "accept_new_time" | "unclear" | "decline";
type TimeStatus = "valid" | "unclear" | "past";

type RequestBody = {
  appointment_request_id?: string;
  previous_staff_reply?: string;
  customer_reply?: string;
  owner_name?: string | null;
  pet_name?: string | null;
  service?: string | null;
};

type RescheduleReplyResult = {
  success: boolean;
  action: ReplyAction;
  time_status: TimeStatus;
  preferred_date: string | null;
  preferred_time: string | null;
  requested_at_iso: string | null;
  staff_note: string;
};

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

function extractGeminiText(payload: unknown): string {
  const root = payload as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  return root?.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

function normalizeResult(value: unknown): RescheduleReplyResult {
  const source = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  const action: ReplyAction = source.action === "accept_new_time" || source.action === "decline" ? source.action : "unclear";
  const timeStatus: TimeStatus = source.time_status === "valid" || source.time_status === "past" ? source.time_status : "unclear";

  return {
    success: source.success === true,
    action,
    time_status: timeStatus,
    preferred_date: typeof source.preferred_date === "string" ? source.preferred_date.trim() || null : null,
    preferred_time: typeof source.preferred_time === "string" ? source.preferred_time.trim() || null : null,
    requested_at_iso: typeof source.requested_at_iso === "string" ? source.requested_at_iso.trim() || null : null,
    staff_note: typeof source.staff_note === "string" && source.staff_note.trim() ? source.staff_note.trim() : "無法判斷，請補充資訊。",
  };
}

function validateResult(result: RescheduleReplyResult) {
  if (result.success !== true) return result;
  if (result.action !== "accept_new_time" || result.time_status !== "valid") return null;
  if (!result.preferred_date || !DATE_PATTERN.test(result.preferred_date)) return null;
  if (!result.preferred_time || !TIME_PATTERN.test(result.preferred_time)) return null;
  if (!result.requested_at_iso) return null;

  const parsed = new Date(result.requested_at_iso);
  if (Number.isNaN(parsed.getTime())) return null;
  return result;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;
    const appointmentRequestId = body.appointment_request_id?.trim();
    const previousStaffReply = body.previous_staff_reply?.trim();
    const customerReply = body.customer_reply?.trim();

    if (!appointmentRequestId || !previousStaffReply || !customerReply) {
      return NextResponse.json({ error: "缺少必要欄位。" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Gemini API Key 尚未設定" }, { status: 500 });

    const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
    const geminiUrl = `${GEMINI_BASE_URL}/${model}:generateContent`;
    const taiwanNow = getTaiwanNowContext();

    const prompt = `你是寵物店客服沙盒助手，負責判斷客人是否接受改約。
請務必只輸出 JSON，不可輸出其他說明。

時間基準：
- 目前日期：${taiwanNow.currentDate}
- 目前時間：${taiwanNow.currentTime}
- 目前星期：${taiwanNow.currentWeekday}
- 時區：${taiwanNow.timezone}

背景資訊：
- appointment_request_id: ${appointmentRequestId}
- 飼主：${body.owner_name || "未提供"}
- 寵物：${body.pet_name || "未提供"}
- 服務：${body.service || "未提供"}
- 員工上一句改約回覆：${previousStaffReply}
- 客人回覆：${customerReply}

規則：
1) 若客人接受改約，action="accept_new_time"。
2) 若客人拒絕，action="decline"，requested_at_iso 必須為 null。
3) 若資訊不明確，action="unclear"。
4) 解析到過去時間時，time_status="past" 且 success=false。
5) success=true 只允許在 action="accept_new_time" 且 time_status="valid"。
6) 若 success=true，preferred_date 必須 YYYY-MM-DD、preferred_time 必須 HH:mm（24小時制）、requested_at_iso 必須為有效 ISO datetime（含時區）。
7) 若客人只回「可以」，可參考員工上一句改約時間。

JSON schema:
{
  "success": boolean,
  "action": "accept_new_time" | "unclear" | "decline",
  "time_status": "valid" | "unclear" | "past",
  "preferred_date": "YYYY-MM-DD" | null,
  "preferred_time": "HH:mm" | null,
  "requested_at_iso": "ISO datetime" | null,
  "staff_note": "給員工看的說明"
}`;

    const response = await fetch(`${geminiUrl}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json({ error: `Gemini 呼叫失敗（model: ${model}）：${text || response.statusText}` }, { status: 502 });
    }

    const raw = await response.json();
    const text = extractGeminiText(raw);
    if (!text) return NextResponse.json({ error: `Gemini 未回傳可解析內容（model: ${model}）` }, { status: 502 });

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: `Gemini 回傳格式不是有效 JSON（model: ${model}）` }, { status: 502 });
    }

    const normalized = normalizeResult(parsed);
    const validated = validateResult(normalized);

    if (normalized.success === true && !validated) {
      return NextResponse.json({ error: "Gemini 回傳時間格式不正確，已拒絕更新。", result: { ...normalized, success: false, requested_at_iso: null } });
    }

    return NextResponse.json({ result: normalized });
  } catch (error) {
    return NextResponse.json({ error: `改約回覆分析失敗：${(error as Error).message}` }, { status: 500 });
  }
}
