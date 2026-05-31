"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { PageShell } from "@/components/page-shell";
import { SimpleTable } from "@/components/simple-table";
import { conversationLogs as mockConversationLogs } from "@/lib/mockData";
import { isSupabaseConfigured, supabaseEnvWarning, supabaseRequest } from "@/lib/supabaseClient";
import { ConversationLog, SandboxKnowledgeAnswer } from "@/lib/types";
import { appendSandboxManualReplyTaskEvent, SandboxManualReplyTaskEvent } from "@/lib/sandboxManualReplyTaskEvents";
import { upsertSandboxKnowledgeGapEvent } from "@/lib/sandboxKnowledgeGapEvents";
import {
  buildSandboxKnowledgeQueryForMessage,
  evaluateSandboxConversationFlow,
  type SandboxConversationFlowDecision,
} from "@/lib/sandboxConversationFlow";
import {
  evaluateSandboxCustomerServiceTriage,
  getSandboxManualPriorityLabel,
  getSandboxManualTaskTypeLabel,
  getSandboxTriageResultLabel,
  type SandboxCustomerServiceTriageDecision,
  type SandboxManualTaskType,
} from "@/lib/sandboxCustomerServiceTriage";

type ChatMessage = {
  id: string;
  role: "customer" | "assistant";
  content: string;
};

type SandboxHistoryMessage = Pick<ChatMessage, "role" | "content">;

type LastRunSummary = {
  customerMessage: string;
  systemReply: string;
  usedKnowledgeBase: boolean;
  transferredToHuman: boolean;
  manualTaskType: SandboxManualTaskType | null;
  manualTaskCreated: boolean;
  manualTaskId?: string;
  knowledgeFallbackReason?: string;
};

type KnownDetails = NonNullable<SandboxManualReplyTaskEvent["known_details"]>;

const MISSING_TEXT = "未提供";
const KB_MANUAL_REVIEW_REPLY = "這題我先幫您轉給門市人員確認，避免沒有 Knowledge Base 依據時回答錯誤。";

function formatTaipei(value?: string | null) {
  if (!value) return MISSING_TEXT;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function compactText(value: string) {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim();
}

function fieldValue(value?: string) {
  return value?.trim() || MISSING_TEXT;
}

function extractPhone(message: string) {
  return compactText(message).match(/09\d{8}|0\d{1,2}[-\s]?\d{6,8}/)?.[0]?.replace(/\s+/g, "") || "";
}

function extractPetName(message: string) {
  const normalized = compactText(message);
  const match = normalized.match(/(?:寶貝(?:名字)?(?:叫|是)?|名字(?:叫|是)?|叫做|叫)\s*([A-Za-z0-9\u4e00-\u9fff]{1,12})/);
  return match?.[1] || "";
}

function extractPreferredDateTime(message: string) {
  const normalized = compactText(message);
  const dateText =
    normalized.match(/\d{4}[-/]\d{1,2}[-/]\d{1,2}/)?.[0] ||
    normalized.match(/\d{1,2}[/-]\d{1,2}/)?.[0] ||
    normalized.match(/今天|明天|後天|下週[一二三四五六日天]?|週[一二三四五六日天]/)?.[0] ||
    "";
  const timeText =
    normalized.match(/(?:上午|下午|晚上|中午)?\s*\d{1,2}[:：]\d{2}/)?.[0]?.trim() ||
    normalized.match(/(?:上午|下午|晚上|中午)\s*\d{1,2}\s*點(?:半)?/)?.[0]?.trim() ||
    "";

  return [dateText, timeText].filter(Boolean).join(" ");
}

function buildKnownDetails(message: string, decision: SandboxCustomerServiceTriageDecision): KnownDetails {
  const shouldUseAppointmentFields = decision.task_type === "appointment_availability" || decision.task_type === "quote_missing_info";
  return {
    pet_name: extractPetName(message),
    pet_type_or_breed: shouldUseAppointmentFields ? decision.quoteDraft.pet_type_or_breed : "",
    phone: extractPhone(message),
    service_item: shouldUseAppointmentFields ? decision.quoteDraft.service_item : "",
    preferred_datetime: decision.task_type === "appointment_availability" ? extractPreferredDateTime(message) : "",
  };
}

function getMissingAppointmentDetails(knownDetails: KnownDetails) {
  const missing: string[] = [];
  if (!knownDetails.pet_name) missing.push("寶貝姓名");
  if (!knownDetails.pet_type_or_breed) missing.push("品種");
  if (!knownDetails.phone) missing.push("電話");
  if (!knownDetails.service_item) missing.push("服務項目");
  if (!knownDetails.preferred_datetime) missing.push("想預約日期 / 時間");
  return missing;
}

function buildTaskStatus(taskType: SandboxManualTaskType | null, missingDetails: string[]): SandboxManualReplyTaskEvent["status"] {
  if (taskType === "appointment_availability" && missingDetails.length > 0) return "collecting_info";
  if (taskType === "quote_missing_info") return "collecting_info";
  return "pending_human_reply";
}

function buildManualTaskEvent(
  message: string,
  decision: SandboxCustomerServiceTriageDecision,
  patch: Partial<SandboxManualReplyTaskEvent> = {},
): SandboxManualReplyTaskEvent {
  const knownDetails = buildKnownDetails(message, decision);
  const missingDetails =
    decision.task_type === "appointment_availability"
      ? getMissingAppointmentDetails(knownDetails)
      : decision.task_type === "quote_missing_info"
        ? decision.missingQuoteFields
        : [];
  const taskType = decision.task_type || "other";
  const now = new Date().toISOString();

  return {
    id: `sandbox-manual-reply-${Date.now()}`,
    source: "conversation_logs",
    customer: "Sandbox Customer",
    source_channel: "LINE Sandbox",
    triage_result: decision.triage_result,
    classification_reason: decision.classification_reason,
    task_type: taskType,
    topic: getSandboxManualTaskTypeLabel(taskType),
    last_message: message,
    ai_summary: decision.classification_reason,
    known_details: knownDetails,
    missing_details: missingDetails,
    auto_replied: decision.should_auto_reply,
    suggested_reply: decision.suggested_reply,
    reply_note: decision.suggested_reply || decision.classification_reason,
    waiting_minutes: 0,
    priority: decision.priority,
    status: buildTaskStatus(taskType, missingDetails),
    knowledge_fallback_reason: decision.knowledge_fallback_reason,
    is_sandbox: true,
    created_at: now,
    is_replied: false,
    replied_at: null,
    ...patch,
  };
}

function isKnowledgeAnswer(payload: unknown): payload is SandboxKnowledgeAnswer {
  const source = payload as SandboxKnowledgeAnswer;
  return Boolean(source && typeof source.answer === "string" && Array.isArray(source.matched_articles));
}

export default function ConversationLogsPage() {
  const [logs, setLogs] = useState<ConversationLog[]>(mockConversationLogs);
  const [notice, setNotice] = useState<string>(isSupabaseConfigured ? "" : supabaseEnvWarning);
  const [inputMessage, setInputMessage] = useState("");
  const [error, setError] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [lastRun, setLastRun] = useState<LastRunSummary | null>(null);
  const [customerServiceTriage, setCustomerServiceTriage] = useState<SandboxCustomerServiceTriageDecision | null>(null);
  const [conversationFlowDecision, setConversationFlowDecision] = useState<SandboxConversationFlowDecision | null>(null);
  const [knowledgeAnswer, setKnowledgeAnswer] = useState<SandboxKnowledgeAnswer | null>(null);
  const [quoteClarificationCount, setQuoteClarificationCount] = useState(0);

  useEffect(() => {
    async function load() {
      if (!isSupabaseConfigured) return;
      try {
        const data = await supabaseRequest<ConversationLog[]>({
          table: "messages",
          query: "select=id,channel,content,created_at,customers(name)&order=created_at.desc",
        });

        const mapped: ConversationLog[] = data.map(
          (row: ConversationLog & { content?: string; created_at?: string; customers?: { name?: string } }) => ({
            id: row.id,
            customer: row.customers?.name ?? "LINE 客人",
            channel: row.channel,
            last_message: row.content ?? row.last_message,
            updated_at: row.created_at ?? row.updated_at,
          }),
        );

        setLogs(mapped);
        setNotice("");
      } catch (loadError) {
        setNotice(`Supabase 讀取失敗，目前顯示 mock data：${(loadError as Error).message}`);
      }
    }

    load();
  }, []);

  const lastCustomerMessage = useMemo(() => chat.filter((item) => item.role === "customer").at(-1)?.content || "", [chat]);

  function appendAssistantMessage(content: string) {
    setChat((previous) => [
      ...previous,
      {
        id: `${Date.now()}-assistant`,
        role: "assistant",
        content,
      },
    ]);
  }

  function createManualTask(message: string, decision: SandboxCustomerServiceTriageDecision) {
    const task = buildManualTaskEvent(message, decision);
    appendSandboxManualReplyTaskEvent(task);
    return task;
  }

  async function runKnowledgeAnswer(
    message: string,
    decision: SandboxCustomerServiceTriageDecision,
    history: SandboxHistoryMessage[],
  ): Promise<{ ok: boolean; answer?: SandboxKnowledgeAnswer; error?: string }> {
    const knowledgeQuery = buildSandboxKnowledgeQueryForMessage(message, decision.quoteDraft);

    try {
      const response = await fetch("/api/sandbox/knowledge-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: knowledgeQuery,
          history,
          analysisResult: {
            summary: decision.classification_reason,
            extracted: {
              issue: message,
              service_item: decision.quoteDraft.service_item,
            },
          },
        }),
      });

      const payload = (await response.json()) as unknown;
      if (!response.ok || !isKnowledgeAnswer(payload)) {
        const messageFromPayload = typeof payload === "object" && payload && "error" in payload ? String((payload as { error?: unknown }).error || "") : "";
        return { ok: false, error: messageFromPayload || "Knowledge Base 查詢失敗" };
      }

      return { ok: true, answer: payload };
    } catch (requestError) {
      return { ok: false, error: (requestError as Error).message };
    }
  }

  async function submitSandboxMessage(event: FormEvent) {
    event.preventDefault();
    const message = inputMessage.trim();
    if (!message) {
      setError("請輸入模擬客人訊息。");
      return;
    }

    setIsAnalyzing(true);
    setError("");
    setLastRun(null);
    setKnowledgeAnswer(null);

    const customerMessage: ChatMessage = {
      id: `${Date.now()}-customer`,
      role: "customer",
      content: message,
    };
    const nextHistory: SandboxHistoryMessage[] = [...chat, customerMessage].map(({ role, content }) => ({ role, content }));
    setChat((previous) => [...previous, customerMessage]);

    try {
      const triageDecision = evaluateSandboxCustomerServiceTriage({
        message,
        clarificationAttempts: quoteClarificationCount,
        fallbackQuoteDraft: customerServiceTriage?.triage_result === "need_clarification" ? customerServiceTriage.quoteDraft : undefined,
        continueQuoteClarification: customerServiceTriage?.triage_result === "need_clarification",
      });
      const flowDecision = evaluateSandboxConversationFlow(message);

      setCustomerServiceTriage(triageDecision);
      setConversationFlowDecision(flowDecision);

      if (triageDecision.triage_result === "need_clarification") {
        setQuoteClarificationCount((previous) => previous + 1);
        appendAssistantMessage(triageDecision.suggested_reply);
        setLastRun({
          customerMessage: message,
          systemReply: triageDecision.suggested_reply,
          usedKnowledgeBase: false,
          transferredToHuman: false,
          manualTaskType: null,
          manualTaskCreated: false,
        });
        setInputMessage("");
        return;
      }

      if (triageDecision.should_create_manual_task) {
        setQuoteClarificationCount(0);
        const task = createManualTask(message, triageDecision);
        appendAssistantMessage(triageDecision.suggested_reply);
        setLastRun({
          customerMessage: message,
          systemReply: triageDecision.suggested_reply,
          usedKnowledgeBase: false,
          transferredToHuman: true,
          manualTaskType: task.task_type || null,
          manualTaskCreated: true,
          manualTaskId: task.id,
          knowledgeFallbackReason: task.knowledge_fallback_reason,
        });
        setInputMessage("");
        return;
      }

      if (triageDecision.should_query_knowledge_base) {
        setQuoteClarificationCount(0);
        const knowledgeResult = await runKnowledgeAnswer(message, triageDecision, nextHistory);
        if (!knowledgeResult.ok || !knowledgeResult.answer) {
          const systemReply = `目前 sandbox 無法查詢 active Knowledge Base（${knowledgeResult.error || "未知錯誤"}），未送出 LINE，也未寫入正式 messages。`;
          appendAssistantMessage(systemReply);
          setError(systemReply);
          setLastRun({
            customerMessage: message,
            systemReply,
            usedKnowledgeBase: false,
            transferredToHuman: false,
            manualTaskType: null,
            manualTaskCreated: false,
          });
          setInputMessage("");
          return;
        }

        setKnowledgeAnswer(knowledgeResult.answer);
        if (!knowledgeResult.answer.needs_manual_reply && knowledgeResult.answer.matched_articles.length > 0) {
          appendAssistantMessage(knowledgeResult.answer.answer);
          setLastRun({
            customerMessage: message,
            systemReply: knowledgeResult.answer.answer,
            usedKnowledgeBase: Boolean(knowledgeResult.answer.used_knowledge_base),
            transferredToHuman: false,
            manualTaskType: null,
            manualTaskCreated: false,
            knowledgeFallbackReason: knowledgeResult.answer.knowledge_fallback_reason,
          });
          setInputMessage("");
          return;
        }

        const fallbackDecision: SandboxCustomerServiceTriageDecision = {
          ...triageDecision,
          triage_result: "human_required",
          classification_reason: "Knowledge Base 找不到可安全回答的 active article，轉人工確認。",
          task_type: "kb_not_found",
          should_query_knowledge_base: true,
          should_create_manual_task: true,
          used_knowledge_base: Boolean(knowledgeResult.answer.used_knowledge_base),
          knowledge_fallback_reason: knowledgeResult.answer.knowledge_fallback_reason || "Knowledge Base 找不到符合內容",
          suggested_reply: KB_MANUAL_REVIEW_REPLY,
          priority: "normal",
        };
        const task = createManualTask(message, fallbackDecision);
        upsertSandboxKnowledgeGapEvent({
          representative_message: message,
          suggested_title: "待補 Knowledge Base：客人詢問店家規則",
          suggested_category: "待補規則",
          reason: fallbackDecision.knowledge_fallback_reason,
        });
        appendAssistantMessage(KB_MANUAL_REVIEW_REPLY);
        setCustomerServiceTriage(fallbackDecision);
        setLastRun({
          customerMessage: message,
          systemReply: KB_MANUAL_REVIEW_REPLY,
          usedKnowledgeBase: Boolean(knowledgeResult.answer.used_knowledge_base),
          transferredToHuman: true,
          manualTaskType: "kb_not_found",
          manualTaskCreated: true,
          manualTaskId: task.id,
          knowledgeFallbackReason: fallbackDecision.knowledge_fallback_reason,
        });
        setInputMessage("");
        return;
      }

      const fallbackReply = "我先幫您轉給門市人員確認，稍後會由同事回覆您。";
      appendAssistantMessage(fallbackReply);
      setLastRun({
        customerMessage: message,
        systemReply: fallbackReply,
        usedKnowledgeBase: false,
        transferredToHuman: false,
        manualTaskType: null,
        manualTaskCreated: false,
      });
      setInputMessage("");
    } finally {
      setIsAnalyzing(false);
    }
  }

  function clearSandboxConversation() {
    setChat([]);
    setInputMessage("");
    setError("");
    setLastRun(null);
    setKnowledgeAnswer(null);
    setCustomerServiceTriage(null);
    setConversationFlowDecision(null);
    setQuoteClarificationCount(0);
  }

  return (
    <PageShell title="Conversation Logs" description="LINE 對話紀錄 / Sandbox 測試入口">
      {notice ? <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{notice}</p> : null}

      <section className="rounded-lg border bg-white p-4">
        <h3 className="text-base font-semibold text-slate-900">Sandbox 測試入口</h3>
        <p className="mt-1 text-sm text-slate-600">
          這裡只模擬 LINE 客人訊息。預約、異常、客訴退款、KB 找不到與 AI 不確定都會先建立人工回覆工作台任務，不送真 LINE。
        </p>
        <form className="mt-4 space-y-3" onSubmit={submitSandboxMessage}>
          <label className="block text-sm font-medium text-slate-700" htmlFor="sandbox-message">
            模擬客人訊息
            <textarea
              id="sandbox-message"
              className="mt-1 min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="例如：明天可以洗澡嗎？"
              value={inputMessage}
              onChange={(event) => setInputMessage(event.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={isAnalyzing}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isAnalyzing ? "分析中..." : "送出 sandbox 訊息"}
            </button>
            <button
              type="button"
              onClick={clearSandboxConversation}
              disabled={isAnalyzing}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              清除對話
            </button>
          </div>
        </form>
        {error ? <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

        <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <h3 className="text-sm font-semibold text-slate-800">沙盒聊天視窗</h3>
          <div className="mt-3 space-y-2">
            {chat.length === 0 ? <p className="text-sm text-slate-500">尚未送出訊息。</p> : null}
            {chat.map((message) => (
              <div key={message.id} className={`flex ${message.role === "customer" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
                    message.role === "customer" ? "bg-emerald-600 text-white" : "bg-white text-slate-800"
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {lastRun ? (
        <section className="rounded-lg border bg-white p-4">
          <h3 className="text-base font-semibold text-slate-900">本次處理結果</h3>
          <dl className="mt-3 grid gap-3 text-sm md:grid-cols-2">
            <div>
              <dt className="font-medium text-slate-500">客人原始訊息</dt>
              <dd className="mt-1 whitespace-pre-wrap text-slate-900">{lastRun.customerMessage}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">系統回覆</dt>
              <dd className="mt-1 whitespace-pre-wrap text-slate-900">{lastRun.systemReply}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">是否查 KB</dt>
              <dd className="mt-1">{lastRun.usedKnowledgeBase ? "是，使用 active Knowledge Base" : customerServiceTriage?.should_query_knowledge_base ? "有嘗試查詢" : "否"}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">是否轉人工</dt>
              <dd className="mt-1">{lastRun.transferredToHuman ? "是，已建立人工回覆工作台任務" : "否"}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">轉人工類型</dt>
              <dd className="mt-1">{lastRun.manualTaskType ? getSandboxManualTaskTypeLabel(lastRun.manualTaskType) : "無"}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">任務狀態</dt>
              <dd className="mt-1">{lastRun.manualTaskCreated ? `已建立人工回覆工作台任務：${lastRun.manualTaskId}` : "未建立人工任務"}</dd>
            </div>
          </dl>
        </section>
      ) : null}

      <section className="rounded-lg border bg-white p-4">
        <h3 className="text-base font-semibold text-slate-900">LINE 對話紀錄</h3>
        <SimpleTable headers={["紀錄 ID", "客人", "來源", "最後訊息", "更新時間"]}>
          {logs.map((log) => (
            <tr key={log.id}>
              <td className="px-4 py-3">{log.id}</td>
              <td className="px-4 py-3">{log.customer}</td>
              <td className="px-4 py-3">{log.channel}</td>
              <td className="px-4 py-3">{log.last_message}</td>
              <td className="px-4 py-3">{formatTaipei(log.updated_at)}</td>
            </tr>
          ))}
        </SimpleTable>
      </section>

      {(customerServiceTriage || conversationFlowDecision || knowledgeAnswer) ? (
        <details className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
          <summary className="cursor-pointer select-none font-semibold text-slate-900">開發者除錯資訊</summary>
          <div className="mt-4 grid gap-4">
            {customerServiceTriage ? (
              <section className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <h4 className="font-semibold text-slate-900">Triage result</h4>
                <dl className="mt-2 grid gap-2 md:grid-cols-2">
                  <div>
                    <dt className="font-medium text-slate-500">triage_result</dt>
                    <dd>{customerServiceTriage.triage_result} ({getSandboxTriageResultLabel(customerServiceTriage.triage_result)})</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-500">task_type</dt>
                    <dd>{customerServiceTriage.task_type ? getSandboxManualTaskTypeLabel(customerServiceTriage.task_type) : "-"}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-500">priority</dt>
                    <dd>{getSandboxManualPriorityLabel(customerServiceTriage.priority)}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-500">should_query_knowledge_base</dt>
                    <dd>{String(customerServiceTriage.should_query_knowledge_base)}</dd>
                  </div>
                  <div className="md:col-span-2">
                    <dt className="font-medium text-slate-500">classification_reason</dt>
                    <dd>{customerServiceTriage.classification_reason}</dd>
                  </div>
                  <div className="md:col-span-2">
                    <dt className="font-medium text-slate-500">knowledge_fallback_reason</dt>
                    <dd>{customerServiceTriage.knowledge_fallback_reason || "-"}</dd>
                  </div>
                </dl>
              </section>
            ) : null}

            {conversationFlowDecision ? (
              <section className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <h4 className="font-semibold text-slate-900">Conversation flow decision</h4>
                <ul className="mt-2 list-disc pl-5">
                  <li>flow: {conversationFlowDecision.flow}</li>
                  <li>asksQuote: {String(conversationFlowDecision.asksQuote)}</li>
                  <li>asksAppointment: {String(conversationFlowDecision.asksAppointment)}</li>
                  <li>isHighRisk: {String(conversationFlowDecision.isHighRisk)}</li>
                  <li>reason: {conversationFlowDecision.reason}</li>
                  <li>quoteMissingFields: {conversationFlowDecision.missingQuoteFields.join("、") || "-"}</li>
                </ul>
              </section>
            ) : null}

            {knowledgeAnswer ? (
              <section className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <h4 className="font-semibold text-slate-900">Knowledge fallback debug</h4>
                <dl className="mt-2 grid gap-2 md:grid-cols-2">
                  <div>
                    <dt className="font-medium text-slate-500">needs_manual_reply</dt>
                    <dd>{String(knowledgeAnswer.needs_manual_reply)}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-500">used_knowledge_base</dt>
                    <dd>{String(Boolean(knowledgeAnswer.used_knowledge_base))}</dd>
                  </div>
                  <div className="md:col-span-2">
                    <dt className="font-medium text-slate-500">knowledge_fallback_reason</dt>
                    <dd>{knowledgeAnswer.knowledge_fallback_reason || "-"}</dd>
                  </div>
                </dl>
                <div className="mt-3">
                  <p className="font-medium text-slate-500">matched_articles</p>
                  {knowledgeAnswer.matched_articles.length > 0 ? (
                    <ul className="mt-1 list-disc pl-5">
                      {knowledgeAnswer.matched_articles.map((article) => (
                        <li key={article.id}>
                          {article.title} / {article.category} / score: {article.score}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-slate-600">無符合文章</p>
                  )}
                </div>
              </section>
            ) : null}
            <p className="text-xs text-slate-500">last customer message: {lastCustomerMessage || "-"}</p>
          </div>
        </details>
      ) : null}
    </PageShell>
  );
}
