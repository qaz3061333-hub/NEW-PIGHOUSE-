import { NextResponse } from "next/server";
import { EMPTY_ANALYZE_RESULT, SANDBOX_INTENTS, SandboxAnalyzeResult, SandboxIntent } from "@/lib/sandbox";

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

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
    },
  };
}

function extractGeminiText(payload: unknown): string {
  const root = payload as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = root?.candidates?.[0]?.content?.parts?.[0]?.text;
  return typeof text === "string" ? text : "";
}

export async function POST(request: Request) {
  try {
    const { message } = (await request.json()) as { message?: string };

    if (!message || !message.trim()) {
      return NextResponse.json({ error: "請輸入要分析的客人訊息。" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Gemini API Key 尚未設定" }, { status: 500 });
    }

    const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
    const geminiUrl = `${GEMINI_BASE_URL}/${model}:generateContent`;

    const prompt = `你是客服分流判斷器。\n請根據使用者提供的客人訊息，判斷客服意圖。\n\n判斷規則：\n- appointment_request：客人想預約、改約、詢問可預約時間、指定服務時間\n- abnormal_alert：客訴、不滿、受傷、投訴、緊急、負面情緒\n- knowledge_question：詢問價格、營業時間、服務內容、注意事項\n- manual_reply_task：需要人員判斷或 AI 不確定\n- unknown：無法判斷\n\n你必須只輸出 JSON，禁止輸出任何 JSON 以外文字。\nJSON schema：\n{\n  "intent": "appointment_request | abnormal_alert | knowledge_question | manual_reply_task | unknown",\n  "confidence": 0.0,\n  "customer_reply": "給客人的繁體中文回覆",\n  "target_module": "Appointment Requests | Abnormal Alerts | Knowledge Base | Manual Reply Tasks | Conversation Logs",\n  "summary": "繁體中文摘要",\n  "extracted": {\n    "customer_name": "",\n    "service_item": "",\n    "preferred_date": "",\n    "preferred_time": "",\n    "issue": "",\n    "urgency": ""\n  }\n}\n\n客人訊息：${message.trim()}`;

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

    return NextResponse.json({ result: normalizeResult(parsed) });
  } catch (error) {
    return NextResponse.json({ error: `分析失敗：${(error as Error).message}` }, { status: 500 });
  }
}
