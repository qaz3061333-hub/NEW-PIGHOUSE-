import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  buildGuardedKnowledgeArticleSnippet,
  evaluateSandboxKnowledgeQueryGuard,
} from "@/lib/sandboxKnowledgeQueryGuard";

type KnowledgeAnswerRequest = {
  message?: string;
  history?: Array<{ role: "customer" | "assistant"; content: string }>;
  analysisResult?: {
    summary?: string;
    extracted?: {
      issue?: string;
      service_item?: string;
    };
  };
};

type KnowledgeArticle = {
  id: string;
  title: string;
  category: string;
  content: string;
  is_active: boolean;
};

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const MAX_MATCHED_ARTICLES = 3;
const CONTENT_SNIPPET_LIMIT = 2500;
const MAX_CONTEXT_HISTORY_MESSAGES = 6;
const HISTORY_MESSAGE_LIMIT = 220;
const CONTEXTUAL_QUERY_LIMIT = 900;
const SUPPLEMENTAL_QUERY_PATTERN =
  /(\d+(?:[.,]\d+)?\s*(?:kg|公斤|g|公克)|油性|乾性|敏感|短毛|長毛|中和|板橋|很兇|會咬)/i;

function compactText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeHistory(history: KnowledgeAnswerRequest["history"] = []) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((item) => item.role === "customer" || item.role === "assistant")
    .map((item) => ({
      role: item.role,
      content: compactText(item.content || "").slice(0, HISTORY_MESSAGE_LIMIT),
    }))
    .filter((item) => item.content.length > 0)
    .slice(-MAX_CONTEXT_HISTORY_MESSAGES);
}

function isLikelySupplementalQuery(message: string) {
  const normalized = compactText(message);
  if (!normalized) return false;
  if (SUPPLEMENTAL_QUERY_PATTERN.test(normalized)) return true;
  if (/[?？]/.test(normalized) && normalized.length > 18) return false;
  return normalized.length <= 18;
}

function buildContextualQuery(queryMessage: string, history: KnowledgeAnswerRequest["history"] = []) {
  const recentHistory = normalizeHistory(history);
  const previousHistory =
    recentHistory.at(-1)?.role === "customer" && recentHistory.at(-1)?.content === queryMessage
      ? recentHistory.slice(0, -1)
      : recentHistory;

  if (!isLikelySupplementalQuery(queryMessage)) {
    return queryMessage;
  }

  const previousCustomerMessage = [...previousHistory]
    .reverse()
    .find((item) => item.role === "customer" && item.content !== queryMessage)?.content;

  if (!previousCustomerMessage) {
    return queryMessage;
  }

  const recentAssistantMessage = [...previousHistory]
    .reverse()
    .find((item) => item.role === "assistant")?.content;

  return compactText(
    [
      `上一個客人問題：${previousCustomerMessage}`,
      recentAssistantMessage ? `最近一次沙盒助理回覆：${recentAssistantMessage}` : "",
      `目前客人補充：${queryMessage}`,
    ]
      .filter(Boolean)
      .join("\n"),
  ).slice(0, CONTEXTUAL_QUERY_LIMIT);
}

function buildTerms(parts: string[]): string[] {
  const terms = new Set<string>();
  for (const part of parts) {
    const normalized = compactText(part);
    if (!normalized) continue;

    for (const token of normalized.split(/[\s,，。！？!?.、；;：:\-_/()（）\[\]{}]+/)) {
      const word = token.trim().toLowerCase();
      if (word.length >= 2) terms.add(word);
    }

    const plain = normalized.replace(/\s+/g, "").toLowerCase();
    for (let i = 0; i < plain.length - 1; i += 1) {
      const gram = plain.slice(i, i + 2);
      if (gram.length === 2) terms.add(gram);
    }
  }
  return Array.from(terms);
}

function scoreArticle(article: KnowledgeArticle, terms: string[]): number {
  const haystack = `${article.title} ${article.category} ${article.content}`.toLowerCase();
  return terms.reduce((acc, term) => (haystack.includes(term) ? acc + 1 : acc), 0);
}

function extractGeminiText(payload: unknown): string {
  const root = payload as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = root?.candidates?.[0]?.content?.parts?.[0]?.text;
  return typeof text === "string" ? text.trim() : "";
}

function needsManualReply(answer: string) {
  return ["需人工確認", "需要人工確認", "轉人工", "建議就醫"].some((keyword) => answer.includes(keyword));
}

export async function POST(request: Request) {
  try {
    const { message, analysisResult, history } = (await request.json()) as KnowledgeAnswerRequest;
    const queryMessage = compactText(message || "");

    if (!queryMessage) {
      return NextResponse.json({ error: "message 不可為空" }, { status: 400 });
    }

    const contextualQuery = buildContextualQuery(queryMessage, history);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Gemini API Key 尚未設定" }, { status: 500 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: "Supabase 環境變數未設定" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data, error } = await supabase
      .from("knowledge_articles")
      .select("id,title,category,content,is_active")
      .eq("is_active", true)
      .order("updated_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: `查詢知識庫失敗：${error.message}` }, { status: 500 });
    }

    const articles = (data ?? []) as KnowledgeArticle[];
    const terms = buildTerms([
      contextualQuery,
      analysisResult?.summary || "",
      analysisResult?.extracted?.issue || "",
      analysisResult?.extracted?.service_item || "",
    ]);

    const matched = articles
      .map((article) => ({ article, score: scoreArticle(article, terms) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_MATCHED_ARTICLES);

    if (matched.length === 0) {
      return NextResponse.json({
        answer: "目前知識庫沒有找到足夠資料，建議交由人工確認",
        matched_articles: [],
        needs_manual_reply: true,
      });
    }

    const guard = evaluateSandboxKnowledgeQueryGuard(
      contextualQuery,
      matched.map(({ article }) => ({
        title: article.title,
        category: article.category,
        content: article.content,
      })),
    );

    if (guard.answer) {
      return NextResponse.json({
        answer: guard.answer,
        matched_articles: matched.map(({ article, score }) => ({
          id: article.id,
          title: article.title,
          category: article.category,
          score,
        })),
        needs_manual_reply: guard.needs_manual_reply || needsManualReply(guard.answer),
      });
    }

    const context = matched
      .map(({ article }, idx) => {
        const clipped = buildGuardedKnowledgeArticleSnippet(article, contextualQuery, CONTENT_SNIPPET_LIMIT);
        return `資料 ${idx + 1}\n標題：${article.title}\n分類：${article.category}\n內容：${clipped}`;
      })
      .join("\n\n");

    const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
    const prompt = `你是寵物門市客服助理。
使用者問題預設是 PIG HOUSE 寵物服務情境。
不要把「剪指甲、洗澡、美容、住宿」解讀成人類美甲、人類美容或人類住宿。
若問題語意不清，請先以寵物服務情境追問，例如詢問毛孩是否要單做該服務，不要問人類手部或足部。

請只根據下列知識庫資料回答客人，使用繁體中文、語氣友善、內容精簡。
Knowledge Base 沙盒回答不要整段複製 KB；只回可回答的最小價格區間、追問缺少資訊、提醒現場評估、或建議就醫 / 轉人工。
若資料不足或無法確認，請明確說「需要人工確認」，禁止編造。
${guard.prompt_instructions}

Sandbox contextual query（只用於短暫上下文查詢）：${contextualQuery}

客人問題：${queryMessage}

可用知識庫資料：
${context}`;

    const response = await fetch(`${GEMINI_BASE_URL}/${model}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        generationConfig: { temperature: 0.1 },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      return NextResponse.json({ error: `Gemini 呼叫失敗（model: ${model}）：${body || response.statusText}` }, { status: 502 });
    }

    const raw = await response.json();
    const answer = extractGeminiText(raw);

    if (!answer) {
      return NextResponse.json({ error: `Gemini 未回傳可解析內容（model: ${model}）` }, { status: 502 });
    }

    return NextResponse.json({
      answer,
      matched_articles: matched.map(({ article, score }) => ({
        id: article.id,
        title: article.title,
        category: article.category,
        score,
      })),
      needs_manual_reply: needsManualReply(answer),
    });
  } catch (error) {
    return NextResponse.json({ error: `知識庫沙盒查詢失敗：${(error as Error).message}` }, { status: 500 });
  }
}
