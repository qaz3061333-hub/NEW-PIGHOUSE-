import { NextResponse } from "next/server";

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

type RequestBody = {
  appointment_request_id?: string;
  current_requested_at?: string;
  customer_message?: string;
  owner_name?: string | null;
  pet_name?: string | null;
  service?: string | null;
};

type Result = {
  success: boolean;
  action: "request_reschedule" | "unclear" | "not_reschedule";
  time_status: "valid" | "unclear" | "past";
  preferred_date: string | null;
  preferred_time: string | null;
  requested_at_iso: string | null;
  staff_note: string;
};

function getTaipeiNow() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, weekday: "long" }).formatToParts(now);
  const part = (t: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === t)?.value || "";
  return { date: `${part("year")}-${part("month")}-${part("day")}`, time: `${part("hour")}:${part("minute")}`, weekday: part("weekday") };
}

function extractGeminiText(payload: unknown): string {
  const root = payload as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  return root?.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

function normalize(value: unknown): Result {
  const s = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  return {
    success: s.success === true,
    action: s.action === "request_reschedule" || s.action === "not_reschedule" ? s.action : "unclear",
    time_status: s.time_status === "valid" || s.time_status === "past" ? s.time_status : "unclear",
    preferred_date: typeof s.preferred_date === "string" ? s.preferred_date.trim() || null : null,
    preferred_time: typeof s.preferred_time === "string" ? s.preferred_time.trim() || null : null,
    requested_at_iso: typeof s.requested_at_iso === "string" ? s.requested_at_iso.trim() || null : null,
    staff_note: typeof s.staff_note === "string" && s.staff_note.trim() ? s.staff_note.trim() : "請補充更明確資訊。",
  };
}

function isValidSuccess(result: Result) {
  if (!result.success) return true;
  if (result.action !== "request_reschedule" || result.time_status !== "valid") return false;
  if (!result.preferred_date || !DATE_PATTERN.test(result.preferred_date)) return false;
  if (!result.preferred_time || !TIME_PATTERN.test(result.preferred_time)) return false;
  if (!result.requested_at_iso) return false;
  return !Number.isNaN(new Date(result.requested_at_iso).getTime());
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;
    if (!body.appointment_request_id?.trim() || !body.current_requested_at?.trim() || !body.customer_message?.trim()) {
      return NextResponse.json({ error: "缺少必要欄位。" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Gemini API Key 尚未設定" }, { status: 500 });
    const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
    const now = getTaipeiNow();

    const prompt = `你是寵物店客服沙盒助手。請只輸出 JSON。
目前台北時間：${now.date} ${now.time} ${now.weekday}。
appointment_request_id: ${body.appointment_request_id}
原預約時間: ${body.current_requested_at}
飼主: ${body.owner_name || "未提供"}
寵物: ${body.pet_name || "未提供"}
服務: ${body.service || "未提供"}
客人訊息: ${body.customer_message}

請判斷是否為「已確認預約後，客人主動要求改約」。
- 若是且時間可解析為未來時間：success=true, action=request_reschedule, time_status=valid。
- 若不是改約：success=false, action=not_reschedule。
- 若語意或時間不明：success=false, action=unclear, time_status=unclear。
- 若解析到過去時間：success=false, action=request_reschedule, time_status=past。
- success=true 時 preferred_date=YYYY-MM-DD, preferred_time=HH:mm, requested_at_iso=有效 ISO（含時區）。

JSON schema:
{"success":boolean,"action":"request_reschedule"|"unclear"|"not_reschedule","time_status":"valid"|"unclear"|"past","preferred_date":string|null,"preferred_time":string|null,"requested_at_iso":string|null,"staff_note":string}`;

    const response = await fetch(`${GEMINI_BASE_URL}/${model}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ generationConfig: { responseMimeType: "application/json", temperature: 0.1 }, contents: [{ role: "user", parts: [{ text: prompt }] }] }),
    });

    if (!response.ok) return NextResponse.json({ error: `Gemini 呼叫失敗（model: ${model}）：${await response.text() || response.statusText}` }, { status: 502 });
    const text = extractGeminiText(await response.json());
    if (!text) return NextResponse.json({ error: `Gemini 未回傳可解析內容（model: ${model}）` }, { status: 502 });
    const result = normalize(JSON.parse(text));

    if (!isValidSuccess(result)) {
      return NextResponse.json({ error: "Gemini 回傳格式不正確，已拒絕更新。", result: { ...result, success: false, requested_at_iso: null } });
    }
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: `客人改約分析失敗：${(error as Error).message}` }, { status: 500 });
  }
}
