import { NextResponse } from "next/server";

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const TAIWAN_TIMEZONE = "Asia/Taipei";

type TimeStatus = "valid" | "unclear" | "past";

type ProposedNewTimeResult = {
  success: boolean;
  time_status: TimeStatus;
  interpreted_time: string | null;
  customer_reply: string | null;
  needs_clarification: boolean;
  staff_note: string;
};

type RequestBody = {
  request_id?: string;
  staff_note?: string;
  service?: string;
  owner_name?: string;
  pet_name?: string;
  requested_at?: string;
  is_sandbox?: boolean;
  status?: string;
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

function normalizeTimeStatus(value: unknown): TimeStatus {
  if (value === "valid" || value === "unclear" || value === "past") return value;
  return "unclear";
}

function normalizeResult(value: unknown): ProposedNewTimeResult {
  const source = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  const timeStatus = normalizeTimeStatus(source.time_status);
  const interpretedTime = typeof source.interpreted_time === "string" ? source.interpreted_time.trim() : "";
  const customerReply = typeof source.customer_reply === "string" ? source.customer_reply.trim() : "";
  const staffNote = typeof source.staff_note === "string" && source.staff_note.trim() ? source.staff_note.trim() : "Gemini 沙盒轉換完成。";
  const needsClarification = source.needs_clarification === true;
  const success = source.success === true;

  return {
    success,
    time_status: timeStatus,
    interpreted_time: interpretedTime || null,
    customer_reply: customerReply || null,
    needs_clarification: needsClarification,
    staff_note: staffNote,
  };
}

function extractGeminiText(payload: unknown): string {
  const root = payload as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = root?.candidates?.[0]?.content?.parts?.[0]?.text;
  return typeof text === "string" ? text : "";
}

function formatRequestedAtInTaipei(requestedAtRaw: string): string {
  const parsed = new Date(requestedAtRaw);
  if (Number.isNaN(parsed.getTime())) return requestedAtRaw;

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: TAIWAN_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(parsed);
  const getPart = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || "";

  const year = getPart("year");
  const month = getPart("month");
  const day = getPart("day");
  const hour = getPart("hour");
  const minute = getPart("minute");

  if (!year || !month || !day || !hour || !minute) return requestedAtRaw;
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;
    const staffNote = body.staff_note?.trim();

    if (!staffNote) {
      return NextResponse.json({ error: "請輸入員工改約說明。" }, { status: 400 });
    }

    if (body.is_sandbox !== true || body.status !== "proposed_new_time") {
      return NextResponse.json({ error: "僅允許 Sandbox 且 status=proposed_new_time 的預約使用此功能。" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Gemini API Key 尚未設定" }, { status: 500 });
    }

    const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
    const geminiUrl = `${GEMINI_BASE_URL}/${model}:generateContent`;
    const taiwanNow = getTaiwanNowContext();

    const ownerName = body.owner_name?.trim() || "未提供飼主";
    const petName = body.pet_name?.trim() || "未提供寵物";
    const service = body.service?.trim() || "未提供服務項目";
    const originalRequestedAt = formatRequestedAtInTaipei(body.requested_at?.trim() || "未提供原預約時間");

    const prompt = `你是寵物店客服沙盒助手。請把員工的改約說明轉成結構化結果。

請務必用以下時間基準理解相對時間詞：
- 目前日期：${taiwanNow.currentDate}
- 目前時間：${taiwanNow.currentTime}
- 目前星期：${taiwanNow.currentWeekday}
- 時區：${taiwanNow.timezone}

預約背景：
- request_id: ${body.request_id || ""}
- 原預約時間（台灣時間）：${originalRequestedAt}
- 服務項目：${service}
- 飼主：${ownerName}
- 寵物：${petName}

員工改約說明：${staffNote}

判斷規則：
1) 若能明確判斷未來時間（例如明天3點、後天下午2點），回傳 success=true, time_status=valid。
2) interpreted_time 請輸出 YYYY-MM-DD HH:mm（24小時制，台灣時間）。
3) customer_reply 必須是自然禮貌繁中語氣，像寵物店客服，且必須包含：
   - 原預約時間（台灣時間）
   - 服務項目
   - 新建議時間 interpreted_time
   - 詢問客人是否方便
   - 明確寫出「Sandbox 模擬」與「不會真的通知客人」
4) 若時間資訊不明確（如：晚一點、改下午、看客人方便），回傳 success=false, time_status=unclear, interpreted_time=null, customer_reply=null, needs_clarification=true，並在 staff_note 提示補上明確日期與時間。
5) 若解析結果是過去時間，回傳 success=false, time_status=past, interpreted_time=null, customer_reply=null, needs_clarification=true，並在 staff_note 提示這是過去時間，請改填未來時間。

你必須只輸出 JSON，禁止任何 JSON 以外內容。
JSON schema：
{
  "success": true,
  "time_status": "valid | unclear | past",
  "interpreted_time": "YYYY-MM-DD HH:mm 或 null",
  "customer_reply": "字串或 null",
  "needs_clarification": false,
  "staff_note": "給員工看的提示"
}`;

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
      const text = await response.text();
      return NextResponse.json({ error: `Gemini 呼叫失敗（model: ${model}）：${text || response.statusText}` }, { status: 502 });
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

    return NextResponse.json({ result: normalizeResult(parsed) });
  } catch (error) {
    return NextResponse.json({ error: `Gemini 沙盒轉換失敗：${(error as Error).message}` }, { status: 500 });
  }
}
