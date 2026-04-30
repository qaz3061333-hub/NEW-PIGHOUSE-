import { NextResponse } from "next/server";

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const TAIWAN_TIMEZONE = "Asia/Taipei";

type RejectedReplyResult = {
  success: boolean;
  customer_reply: string | null;
  needs_clarification: boolean;
  staff_note: string;
};

type RequestBody = {
  request_id?: string;
  rejection_note?: string;
  service?: string;
  owner_name?: string;
  pet_name?: string;
  requested_at?: string;
  is_sandbox?: boolean;
  status?: string;
};

function normalizeResult(value: unknown): RejectedReplyResult {
  const source = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  const customerReply = typeof source.customer_reply === "string" ? source.customer_reply.trim() : "";
  const staffNote = typeof source.staff_note === "string" && source.staff_note.trim() ? source.staff_note.trim() : "已完成 Gemini 沙盒拒絕回覆產生。";

  return {
    success: source.success === true,
    customer_reply: customerReply || null,
    needs_clarification: source.needs_clarification === true,
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
    const rejectionNote = body.rejection_note?.trim();

    if (!rejectionNote) {
      return NextResponse.json({ error: "請輸入員工拒絕原因。" }, { status: 400 });
    }

    if (body.is_sandbox !== true || body.status !== "rejected") {
      return NextResponse.json({ error: "僅允許 Sandbox 且 status=rejected 的預約使用此功能。" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Gemini API Key 尚未設定" }, { status: 500 });
    }

    const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
    const geminiUrl = `${GEMINI_BASE_URL}/${model}:generateContent`;

    const ownerName = body.owner_name?.trim() || "未提供飼主";
    const petName = body.pet_name?.trim() || "未提供寵物";
    const service = body.service?.trim() || "未提供服務項目";
    const originalRequestedAt = formatRequestedAtInTaipei(body.requested_at?.trim() || "未提供原預約時間");

    const prompt = `你是寵物店客服沙盒助手。請依據下列規則產生結構化 JSON。

預約背景：
- request_id: ${body.request_id || ""}
- 飼主：${ownerName}
- 寵物：${petName}
- 服務項目：${service}
- 原預約時間（台灣時間 Asia/Taipei）：${originalRequestedAt}
- 員工拒絕原因 rejection_note：${rejectionNote}

判斷規則：
1) 若員工拒絕原因足夠明確（例如：今天時段已滿、美容師人手不足、今天無法安排該服務、寵物狀況不適合當天服務），則：
   - success=true
   - customer_reply 產生禮貌、自然、像寵物店客服的繁體中文
   - needs_clarification=false
   - staff_note 說明已產生沙盒拒絕回覆
2) 若員工拒絕原因太模糊（例如：不行、無法、改掉、拒絕），則：
   - success=false
   - customer_reply=null
   - needs_clarification=true
   - staff_note 提醒員工補充明確原因，內容需包含「請補充拒絕原因，例如：時段已滿、美容師人手不足、服務項目暫無法安排。」
3) success=true 時，customer_reply 必須包含：
   - 原預約時間（台灣時間）
   - 服務項目
   - 拒絕/無法安排的具體原因
   - 適度歉意
   - 提醒客人可再詢問其他時間，但不要自動提出改約時間
   - 明確寫出「Sandbox 模擬」與「不會真的通知客人」

你必須只輸出 JSON，禁止任何 JSON 以外內容。
JSON schema：
{
  "success": true,
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
    return NextResponse.json({ error: `Gemini 沙盒拒絕流程失敗：${(error as Error).message}` }, { status: 500 });
  }
}
