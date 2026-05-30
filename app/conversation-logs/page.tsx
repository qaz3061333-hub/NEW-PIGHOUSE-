"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { PageShell } from "@/components/page-shell";
import { SimpleTable } from "@/components/simple-table";
import { conversationLogs as mockConversationLogs } from "@/lib/mockData";
import { EMPTY_ANALYZE_RESULT, SandboxAnalyzeResult } from "@/lib/sandbox";
import { isSupabaseConfigured, supabaseEnvWarning, supabaseRequest } from "@/lib/supabaseClient";
import { ConversationLog, SandboxKnowledgeAnswer } from "@/lib/types";
import { clearSandboxConversationEvents, listSandboxConversationEvents, SandboxConversationEvent } from "@/lib/sandboxConversationEvents";
import { appendSandboxCustomerRescheduleEvent } from "@/lib/sandboxCustomerRescheduleEvents";
import { appendSandboxAbnormalAlertEvent } from "@/lib/sandboxAbnormalAlertEvents";
import { clearSandboxAbnormalAlertResolutionEvents, listSandboxAbnormalAlertResolutionEvents, SandboxAbnormalAlertResolutionEvent } from "@/lib/sandboxAbnormalAlertResolutionEvents";
import { appendSandboxManualReplyTaskEvent } from "@/lib/sandboxManualReplyTaskEvents";
import { clearSandboxManualReplyResolutionEvents, listSandboxManualReplyResolutionEvents, SandboxManualReplyResolutionEvent } from "@/lib/sandboxManualReplyResolutionEvents";
import { normalizeSandboxAlertSeverity } from "@/lib/sandboxAlertSeverity";
import { AppointmentRequest } from "@/lib/types";
import { evaluateSandboxServiceGate, SandboxGateDecision } from "@/lib/sandboxServiceGate";
import { upsertSandboxKnowledgeGapEvent } from "@/lib/sandboxKnowledgeGapEvents";
import { evaluateSandboxReplyPolicy } from "@/lib/sandboxReplyPolicy";
import { evaluateSandboxArchivePolicy } from "@/lib/sandboxArchivePolicy";
import {
  buildSandboxAppointmentDraftReply,
  EMPTY_SANDBOX_APPOINTMENT_DRAFT,
  getSandboxAppointmentDraftRows,
  isSandboxAppointmentDraftEmpty,
  mergeSandboxAppointmentDraft,
  SandboxAppointmentAnalyzeResult,
  SandboxAppointmentDraft,
} from "@/lib/sandboxAppointmentDraft";
import type { SandboxAppointmentPolicyContext } from "@/lib/sandboxAppointmentPolicy";
import type { SandboxAppointmentPolicyDebug } from "@/lib/sandboxAppointmentPolicy";
import {
  appendSandboxAppointmentQuoteDisclaimer,
  buildSandboxAppointmentMissingWeightForQuoteReply,
  buildSandboxAppointmentPriceQuery,
  hasSandboxAppointmentQuoteBasis,
  isSandboxAppointmentPriceQuestion,
  shouldAskSandboxAppointmentWeightForQuote,
} from "@/lib/sandboxAppointmentIntakeForm";
import {
  buildSandboxQuoteKnowledgeQuery,
  buildSandboxQuoteMissingInfoReply,
  evaluateSandboxConversationFlow,
} from "@/lib/sandboxConversationFlow";
import type { SandboxConversationFlowDecision } from "@/lib/sandboxConversationFlow";

type ChatMessage = {
  id: string;
  role: "customer" | "assistant";
  content: string;
};

type SandboxHistoryMessage = Pick<ChatMessage, "role" | "content">;
type RescheduleReplyResult = {
  success: boolean;
  action: "accept_new_time" | "unclear" | "decline";
  time_status: "valid" | "unclear" | "past";
  preferred_date: string | null;
  preferred_time: string | null;
  requested_at_iso: string | null;
  staff_note: string;
};

type KnowledgeAnswerRunResult = {
  ok: boolean;
  hasKnowledge: boolean;
  answer?: string;
  needs_manual_reply?: boolean;
};

const KNOWLEDGE_MANUAL_REVIEW_CHAT_MESSAGE =
  "這題涉及需人工確認的情境，我已產生 Knowledge Base 沙盒草稿供人員查看，請由人工確認後再回覆；若是健康異常，請優先建議就醫或由門市人員協助判斷。";

const confidencePercent = (value: number) => `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const SUPPLEMENTAL_MESSAGE_PATTERN =
  /(\d+(?:[.,]\d+)?\s*(?:kg|公斤|g|公克)|油性|乾性|敏感|短毛|長毛|中和|板橋|很兇|會咬)/i;
const APPOINTMENT_TURN_PATTERN = /(預約|改約|約(?:明天|後天|今天|下週|週|星期|中午|下午|上午|晚上|\d)|明天|後天|今天|下週|週[一二三四五六日天]?|星期[一二三四五六日天]?|中午|下午|上午|晚上|\d{1,2}\s*(?::|：|點))/;

type CustomerRescheduleApiResult = {
  success: boolean;
  action: "request_reschedule" | "unclear" | "not_reschedule";
  time_status: "valid" | "unclear" | "past";
  preferred_date: string | null;
  preferred_time: string | null;
  requested_at_iso: string | null;
  staff_note: string;
};

const sandboxArchivePolicyPreviews = [
  {
    title: "Manual Reply Task",
    decision: evaluateSandboxArchivePolicy({
      eventType: "manual_reply_task",
      isReplied: true,
      hasResolutionNote: true,
      ageHours: 30,
    }),
  },
  {
    title: "Abnormal Alert",
    decision: evaluateSandboxArchivePolicy({
      eventType: "abnormal_alert",
      isResolved: true,
      isHighRisk: true,
      ageHours: 30,
    }),
  },
  {
    title: "Appointment Request",
    decision: evaluateSandboxArchivePolicy({
      eventType: "appointment_request",
      status: "confirmed",
      ageHours: 30,
    }),
  },
  {
    title: "Knowledge Gap",
    decision: evaluateSandboxArchivePolicy({
      eventType: "knowledge_gap",
      status: "added",
    }),
  },
  {
    title: "Conversation Logs",
    decision: evaluateSandboxArchivePolicy({
      eventType: "conversation",
      ageHours: 30,
    }),
  },
];

function formatTaipei(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
}

function isStructuredDateTime(preferredDate: string, preferredTime: string) {
  return DATE_PATTERN.test(preferredDate.trim()) && TIME_PATTERN.test(preferredTime.trim());
}

function isLikelyKnowledgeFollowUp(
  message: string,
  previousAnalysisResult: SandboxAnalyzeResult | null,
  previousKnowledgeAnswer: SandboxKnowledgeAnswer | null,
) {
  const trimmed = message.trim();
  if (!trimmed) return false;
  if (previousAnalysisResult?.intent !== "knowledge_question" && !previousKnowledgeAnswer) return false;
  if (/[?？]/.test(trimmed) && trimmed.length > 18) return false;
  return trimmed.length <= 30 || SUPPLEMENTAL_MESSAGE_PATTERN.test(trimmed);
}

function isLikelyAppointmentTurn(message: string) {
  return APPOINTMENT_TURN_PATTERN.test(message.trim());
}

export default function ConversationLogsPage() {
  const [logs, setLogs] = useState<ConversationLog[]>(mockConversationLogs);
  const [notice, setNotice] = useState<string>(isSupabaseConfigured ? "" : supabaseEnvWarning);
  const [inputMessage, setInputMessage] = useState("");
  const [error, setError] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isCreatingSandboxRequest, setIsCreatingSandboxRequest] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<SandboxAnalyzeResult | null>(null);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [appointmentDraft, setAppointmentDraft] = useState<SandboxAppointmentDraft>(EMPTY_SANDBOX_APPOINTMENT_DRAFT);
  const [sandboxRequestMessage, setSandboxRequestMessage] = useState("");
  const [sandboxAbnormalAlertMessage, setSandboxAbnormalAlertMessage] = useState("");
  const [appointmentSandboxEvents, setAppointmentSandboxEvents] = useState<SandboxConversationEvent[]>([]);
  const [rescheduleReplies, setRescheduleReplies] = useState<Record<string, string>>({});
  const [rescheduleLoading, setRescheduleLoading] = useState<Record<string, boolean>>({});
  const [rescheduleResults, setRescheduleResults] = useState<Record<string, { ok: boolean; message: string; result?: RescheduleReplyResult }>>({});
  const [confirmedSandboxRequests, setConfirmedSandboxRequests] = useState<AppointmentRequest[]>([]);
  const [selectedConfirmedId, setSelectedConfirmedId] = useState("");
  const [customerRescheduleMessage, setCustomerRescheduleMessage] = useState("");
  const [customerRescheduleLoading, setCustomerRescheduleLoading] = useState(false);
  const [customerRescheduleFeedback, setCustomerRescheduleFeedback] = useState<{ ok: boolean; message: string; result?: CustomerRescheduleApiResult } | null>(null);
  const [abnormalResolutionEvents, setAbnormalResolutionEvents] = useState<SandboxAbnormalAlertResolutionEvent[]>([]);
  const [manualReplyTaskMessage, setManualReplyTaskMessage] = useState("");
  const [manualReplyResolutionEvents, setManualReplyResolutionEvents] = useState<SandboxManualReplyResolutionEvent[]>([]);

  const [knowledgeAnswer, setKnowledgeAnswer] = useState<SandboxKnowledgeAnswer | null>(null);
  const [knowledgeLoading, setKnowledgeLoading] = useState(false);
  const [knowledgeError, setKnowledgeError] = useState("");
  const [gateDecision, setGateDecision] = useState<SandboxGateDecision | null>(null);
  const [autoKnowledgeQueryMessage, setAutoKnowledgeQueryMessage] = useState("");
  const [conversationFlowDecision, setConversationFlowDecision] = useState<SandboxConversationFlowDecision | null>(null);
  const [appointmentPolicyDebug, setAppointmentPolicyDebug] = useState<SandboxAppointmentPolicyDebug | null>(null);

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
            customer: row.customers?.name ?? "未知客戶",
            channel: row.channel,
            last_message: row.content ?? row.last_message,
            updated_at: row.created_at ?? row.updated_at,
          }),
        );

        setLogs(mapped);
      } catch (loadError) {
        setNotice(`Supabase 讀取失敗，已使用 mock data。${(loadError as Error).message}`);
      }
    }

    load();
  }, []);

  useEffect(() => {
    setAppointmentSandboxEvents(listSandboxConversationEvents().filter((event) => event.source === "appointment_requests"));
    setAbnormalResolutionEvents(listSandboxAbnormalAlertResolutionEvents());
    setManualReplyResolutionEvents(listSandboxManualReplyResolutionEvents());
  }, []);


  useEffect(() => {
    async function loadConfirmedSandboxRequests() {
      if (!isSupabaseConfigured) return;
      try {
        const data = await supabaseRequest<AppointmentRequest[]>({
          table: "appointment_requests",
          query: "select=id,owner_name,pet_name,service,requested_at,status,is_sandbox&order=requested_at.desc",
        });
        setConfirmedSandboxRequests(data.filter((item) => item.is_sandbox === true && item.status === "confirmed"));
      } catch {
        setConfirmedSandboxRequests([]);
      }
    }
    loadConfirmedSandboxRequests();
  }, []);

  function handleClearAppointmentSandboxEvents() {
    clearSandboxConversationEvents();
    setAppointmentSandboxEvents([]);
    setRescheduleReplies({});
    setRescheduleLoading({});
    setRescheduleResults({});
  }


  function handleClearAbnormalResolutionEvents() {
    clearSandboxAbnormalAlertResolutionEvents();
    setAbnormalResolutionEvents([]);
  }

  function handleClearManualReplyResolutionEvents() {
    clearSandboxManualReplyResolutionEvents();
    setManualReplyResolutionEvents([]);
  }

  async function handleCustomerRescheduleRequest() {
    const selected = confirmedSandboxRequests.find((item) => item.id === selectedConfirmedId);
    if (!selected) { setCustomerRescheduleFeedback({ ok: false, message: "請先選擇一筆已 confirmed 的 Sandbox 預約。" }); return; }
    const message = customerRescheduleMessage.trim();
    if (!message) { setCustomerRescheduleFeedback({ ok: false, message: "請先輸入模擬客人改約訊息。" }); return; }
    setCustomerRescheduleLoading(true);
    setCustomerRescheduleFeedback(null);
    try {
      const resp = await fetch('/api/sandbox/customer-reschedule-request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({appointment_request_id:selected.id,current_requested_at:selected.requested_at,customer_message:message,owner_name:selected.owner_name??null,pet_name:selected.pet_name??null,service:selected.service??null})});
      const payload = await resp.json();
      const result = payload.result ? payload.result as CustomerRescheduleApiResult : payload as CustomerRescheduleApiResult;
      if (!resp.ok) throw new Error(payload.error || '分析失敗');
      if (!(result.success && result.requested_at_iso)) { setCustomerRescheduleFeedback({ ok:false, message: result.staff_note || '尚無法更新。', result}); return; }
      const updated = await supabaseRequest<AppointmentRequest[]>({ table:'appointment_requests', method:'PATCH', query:`id=eq.${selected.id}&is_sandbox=eq.true&status=eq.confirmed`, body:{ requested_at: result.requested_at_iso, status:'pending' }, prefer: 'return=representation' });
      if (!updated[0]) {
        setCustomerRescheduleFeedback({ ok:false, message:'未找到可更新的 confirmed Sandbox 預約，可能狀態已變更，請重新整理後再試。', result });
        return;
      }
      appendSandboxCustomerRescheduleEvent({ id:`${selected.id}-${Date.now()}`, appointment_request_id:selected.id, source:'customer_reschedule_request', old_requested_at:selected.requested_at, new_requested_at:result.requested_at_iso, customer_message:message, staff_note:result.staff_note, created_at:new Date().toISOString() });
      setConfirmedSandboxRequests((prev) => prev.filter((item) => item.id !== selected.id));
      setSelectedConfirmedId('');
      setCustomerRescheduleFeedback({ ok:true, message:'已更新原本 Sandbox 預約時間，狀態已改回 pending。這是客人主動改約，不是新預約，請到 Appointment Requests 重新確認。', result});
      setCustomerRescheduleMessage('');
    } catch (e) { setCustomerRescheduleFeedback({ ok:false, message:`更新失敗：${e}` }); }
    finally { setCustomerRescheduleLoading(false); }
  }

  async function handleAnalyzeRescheduleReply(event: SandboxConversationEvent) {
    const customerReply = (rescheduleReplies[event.id] || "").trim();
    if (!customerReply) {
      setRescheduleResults((prev) => ({ ...prev, [event.id]: { ok: false, message: "請先輸入模擬客人回覆。" } }));
      return;
    }

    setRescheduleLoading((prev) => ({ ...prev, [event.id]: true }));
    setRescheduleResults((prev) => ({ ...prev, [event.id]: { ok: false, message: "" } }));

    try {
      const analyzeResponse = await fetch("/api/sandbox/appointment-reschedule-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointment_request_id: event.appointment_request_id,
          previous_staff_reply: event.content,
          customer_reply: customerReply,
          owner_name: event.owner_name || null,
          pet_name: event.pet_name || null,
          service: event.service || null,
        }),
      });

      const analyzePayload = (await analyzeResponse.json()) as { error?: string; result?: RescheduleReplyResult };
      if (!analyzeResponse.ok || !analyzePayload.result) {
        setRescheduleResults((prev) => ({
          ...prev,
          [event.id]: { ok: false, message: analyzePayload.error || "改約分析失敗，請稍後再試。" },
        }));
        return;
      }

      const result = analyzePayload.result;
      if (!(result.success && result.requested_at_iso)) {
        setRescheduleResults((prev) => ({
          ...prev,
          [event.id]: { ok: false, message: result.staff_note || "尚無法更新預約時間。", result },
        }));
        return;
      }

      if (!isSupabaseConfigured) {
        setRescheduleResults((prev) => ({ ...prev, [event.id]: { ok: false, message: supabaseEnvWarning, result } }));
        return;
      }

      await supabaseRequest({
        table: "appointment_requests",
        method: "PATCH",
        query: `id=eq.${event.appointment_request_id}&is_sandbox=eq.true`,
        body: {
          requested_at: result.requested_at_iso,
          status: "pending",
        },
      });

      setRescheduleResults((prev) => ({
        ...prev,
        [event.id]: {
          ok: true,
          message: "已更新原本 Sandbox 預約時間，狀態已改回 pending。請到 Appointment Requests 做最後確認。",
          result,
        },
      }));
    } catch (updateError) {
      setRescheduleResults((prev) => ({
        ...prev,
        [event.id]: { ok: false, message: `更新失敗：${(updateError as Error).message}` },
      }));
    } finally {
      setRescheduleLoading((prev) => ({ ...prev, [event.id]: false }));
    }
  }

  const extractedRows = useMemo(() => {
    const data = analysisResult
      ? (analysisResult as SandboxAppointmentAnalyzeResult).extracted
      : {
          ...EMPTY_ANALYZE_RESULT.extracted,
          pet_name: "",
          pet_type_or_breed: "",
          pet_weight: "",
          owner_name: "",
          phone: "",
          customer_status: "",
          health_notes: "",
          custom_fields: {},
          missing_fields: [],
        };
    return [
      ["customer_name", data.customer_name],
      ["service_item", data.service_item],
      ["pet_name", data.pet_name || ""],
      ["pet_type_or_breed", data.pet_type_or_breed || ""],
      ["pet_weight", data.pet_weight || ""],
      ["preferred_date", data.preferred_date],
      ["preferred_time", data.preferred_time],
      ["owner_name", data.owner_name || ""],
      ["phone", data.phone || ""],
      ["customer_status", data.customer_status || ""],
      ["health_notes", data.health_notes || ""],
      ["custom_fields", data.custom_fields ? JSON.stringify(data.custom_fields) : ""],
      ["missing_fields", Array.isArray(data.missing_fields) ? data.missing_fields.join("、") : ""],
      ["issue", data.issue],
      ["urgency", data.urgency],
      ["time_status", data.time_status],
      ["needs_clarification", data.needs_clarification ? "true" : "false"],
    ] as Array<[string, string]>;
  }, [analysisResult]);

  const appointmentDraftRows = useMemo(() => getSandboxAppointmentDraftRows(appointmentDraft), [appointmentDraft]);

  const canCreateSandboxRequest = useMemo(() => {
    if (!analysisResult || analysisResult.intent !== "appointment_request") return false;
    if (
      appointmentPolicyDebug?.appointment_policy_status !== "active" &&
      appointmentPolicyDebug?.appointment_policy_status !== "fallback_used"
    ) {
      return false;
    }
    const extracted = (analysisResult as SandboxAppointmentAnalyzeResult).extracted;
    if (extracted.needs_clarification || extracted.time_status !== "valid") return false;
    if (appointmentDraft.missing_fields.length > 0) return false;
    return isStructuredDateTime(appointmentDraft.preferred_date, appointmentDraft.preferred_time);
  }, [analysisResult, appointmentDraft, appointmentPolicyDebug]);

  function resolveSandboxRequestedAt(preferredDate: string, preferredTime: string) {
    if (!isStructuredDateTime(preferredDate, preferredTime)) return null;

    const isoCandidate = new Date(`${preferredDate.trim()}T${preferredTime.trim()}:00+08:00`);
    if (Number.isNaN(isoCandidate.getTime())) return null;
    return isoCandidate.toISOString();
  }

  function createSandboxManualReplyTaskFromGate(message: string, gate: SandboxGateDecision) {
    appendSandboxManualReplyTaskEvent({
      id: `sandbox-manual-reply-${Date.now()}`,
      source: "conversation_logs",
      customer: "Sandbox Customer",
      source_channel: "LINE Sandbox",
      topic: `AI 分流轉人工：${message.slice(0, 30)}`,
      last_message: message,
      reply_note: gate.suggested_reply,
      waiting_minutes: 0,
      priority: "urgent",
      created_at: new Date().toISOString(),
      is_replied: false,
      replied_at: null,
    });
    setManualReplyTaskMessage("已自動建立 Sandbox Manual Reply Task，請到 Manual Reply Tasks 查看。");
  }

  async function submitSandboxMessage(event: FormEvent) {
    event.preventDefault();
    const message = inputMessage.trim();
    if (!message) {
      setError("請先輸入模擬客人訊息。");
      return;
    }

    const previousAnalysisResult = analysisResult;
    const previousKnowledgeAnswer = knowledgeAnswer;

    setIsAnalyzing(true);
    setError("");
    setAnalysisResult(null);
    setSandboxRequestMessage("");
    setSandboxAbnormalAlertMessage("");
    setManualReplyTaskMessage("");
    setKnowledgeAnswer(null);
    setKnowledgeError("");
    setGateDecision(null);
    setAutoKnowledgeQueryMessage("");
    setConversationFlowDecision(null);
    setAppointmentPolicyDebug(null);

    const customerMessage: ChatMessage = {
      id: `${Date.now()}-customer`,
      role: "customer",
      content: message,
    };
    const nextHistory: SandboxHistoryMessage[] = [...chat, customerMessage].map(({ role, content }) => ({ role, content }));
    setChat((previous) => [...previous, customerMessage]);
    const flowDecision = evaluateSandboxConversationFlow(message, appointmentDraft);
    setConversationFlowDecision(flowDecision);
    const manualFlowGate: SandboxGateDecision = {
      decision: "manual_required",
      reason: flowDecision.reason,
      suggested_reply: "這個狀況建議先由門市人員人工確認，已轉由門市人員協助處理。",
      should_call_gemini: false,
      should_query_knowledge_base: false,
      should_create_manual_task: true,
    };
    const gate = flowDecision.flow === "manual_flow" ? manualFlowGate : evaluateSandboxServiceGate(message);
    setGateDecision(gate);

    if (flowDecision.flow === "manual_flow") {
      createSandboxManualReplyTaskFromGate(message, gate);
      setChat((previous) => [...previous, { id: `${Date.now()}-assistant`, role: "assistant", content: gate.suggested_reply }]);
      setInputMessage("");
      setIsAnalyzing(false);
      return;
    }

    if (gate.decision === "out_of_scope") {
      setChat((previous) => [...previous, { id: `${Date.now()}-assistant`, role: "assistant", content: gate.suggested_reply }]);
      setInputMessage("");
      setIsAnalyzing(false);
      return;
    }

    if (gate.decision === "manual_required") {
      createSandboxManualReplyTaskFromGate(message, gate);
      setChat((previous) => [...previous, { id: `${Date.now()}-assistant`, role: "assistant", content: gate.suggested_reply }]);
      setInputMessage("");
      setIsAnalyzing(false);
      return;
    }

    if (flowDecision.flow === "quote_flow") {
      const quoteAnalysisResult: SandboxAppointmentAnalyzeResult = {
        intent: "knowledge_question",
        confidence: 1,
        target_module: "Knowledge Base",
        summary: `quote_flow：${message}`,
        customer_reply: "這是明確詢價，會依 active Knowledge Base 查詢報價，不會建立預約申請。",
        extracted: {
          customer_name: "",
          service_item: flowDecision.quoteDraft.service_item,
          preferred_date: "",
          preferred_time: "",
          issue: message,
          urgency: "",
          time_status: "unclear",
          needs_clarification: flowDecision.missingQuoteFields.length > 0,
          pet_name: "",
          pet_type_or_breed: flowDecision.quoteDraft.pet_type_or_breed,
          pet_weight: flowDecision.quoteDraft.pet_weight,
          owner_name: "",
          phone: "",
          customer_status: "",
          health_notes: "",
          custom_fields: {},
          missing_fields: flowDecision.missingQuoteFields,
        },
      };

      setAnalysisResult(quoteAnalysisResult);
      if (flowDecision.missingQuoteFields.length > 0) {
        setChat((previous) => [
          ...previous,
          {
            id: `${Date.now()}-assistant`,
            role: "assistant",
            content: buildSandboxQuoteMissingInfoReply(flowDecision.missingQuoteFields),
          },
        ]);
        setInputMessage("");
        setIsAnalyzing(false);
        return;
      }

      const quoteResult = await runKnowledgeAnswer(buildSandboxQuoteKnowledgeQuery(flowDecision.quoteDraft), quoteAnalysisResult, nextHistory);
      const assistantQuoteMessage =
        quoteResult.ok && quoteResult.hasKnowledge && quoteResult.answer
          ? appendSandboxAppointmentQuoteDisclaimer(quoteResult.answer)
          : "目前知識庫資料不足，已轉由門市人員確認報價。";

      setChat((previous) => [
        ...previous,
        {
          id: `${Date.now()}-assistant`,
          role: "assistant",
          content: assistantQuoteMessage,
        },
      ]);
      setInputMessage("");
      setIsAnalyzing(false);
      return;
    }

    const canContinueKnowledgeQuestion =
      gate.decision === "knowledge_candidate" || gate.decision === "allow_ai_analysis";
    const shouldContinueKnowledgeQuestion =
      canContinueKnowledgeQuestion && !isLikelyAppointmentTurn(message) && isLikelyKnowledgeFollowUp(message, previousAnalysisResult, previousKnowledgeAnswer);

    if (
      flowDecision.flow !== "appointment_flow" &&
      gate.decision === "knowledge_candidate" &&
      isSandboxAppointmentPriceQuestion(message) &&
      !isSandboxAppointmentDraftEmpty(appointmentDraft)
    ) {
      const priceFollowUpResult: SandboxAnalyzeResult = {
        intent: "knowledge_question",
        confidence: 1,
        target_module: "Knowledge Base",
        summary: `預約草稿中的報價追問：${message}`,
        customer_reply: "這題需要依目前預約草稿查詢 Knowledge Base，不會直接由 AI 自行回答。",
        extracted: {
          customer_name: "",
          service_item: appointmentDraft.service_item,
          preferred_date: appointmentDraft.preferred_date,
          preferred_time: appointmentDraft.preferred_time,
          issue: message,
          urgency: "",
          time_status: "unclear",
          needs_clarification: false,
        },
      };

      setAnalysisResult(priceFollowUpResult);
      let assistantPriceReply = "";
      if (shouldAskSandboxAppointmentWeightForQuote(message, appointmentDraft)) {
        assistantPriceReply = buildSandboxAppointmentMissingWeightForQuoteReply();
      } else if (hasSandboxAppointmentQuoteBasis(appointmentDraft)) {
        const quoteResult = await runKnowledgeAnswer(buildSandboxAppointmentPriceQuery(appointmentDraft), priceFollowUpResult, nextHistory);
        assistantPriceReply =
          quoteResult.ok && quoteResult.hasKnowledge && quoteResult.answer
            ? appendSandboxAppointmentQuoteDisclaimer(quoteResult.answer)
            : "目前知識庫資料不足，建議由人工確認報價。";
      }

      setChat((previous) => [
        ...previous,
        {
          id: `${Date.now()}-assistant`,
          role: "assistant",
          content: assistantPriceReply || "目前需要先補齊預約草稿資料，才能協助估價。",
        },
      ]);
      setInputMessage("");
      setIsAnalyzing(false);
      return;
    }

    if (flowDecision.flow !== "appointment_flow" && (gate.decision === "knowledge_candidate" || shouldContinueKnowledgeQuestion)) {
      const knowledgeOnlyResult: SandboxAnalyzeResult = {
        intent: "knowledge_question",
        confidence: 1,
        target_module: "Knowledge Base",
        summary: `服務資訊查詢：${message}`,
        customer_reply: "這題需要先查詢 Knowledge Base，不會直接由 AI 自行回答。",
        extracted: {
          customer_name: "",
          service_item: "",
          preferred_date: "",
          preferred_time: "",
          issue: message,
          urgency: "",
          time_status: "unclear",
          needs_clarification: false,
        },
      };
      setAnalysisResult(knowledgeOnlyResult);
      setChat((previous) => [
        ...previous,
        {
          id: `${Date.now()}-assistant`,
          role: "assistant",
          content: "我先幫您查詢門市知識庫後再產生沙盒回覆草稿，不會自行編造價格或服務內容。",
        },
      ]);
      setAutoKnowledgeQueryMessage(message);
      const knowledgeResult = await runKnowledgeAnswer(message, knowledgeOnlyResult, nextHistory);
      setAutoKnowledgeQueryMessage("");
      const assistantKnowledgeMessage =
        knowledgeResult.ok && knowledgeResult.hasKnowledge && knowledgeResult.answer
          ? knowledgeResult.answer
          : knowledgeResult.ok && knowledgeResult.needs_manual_reply
            ? KNOWLEDGE_MANUAL_REVIEW_CHAT_MESSAGE
          : "目前知識庫資料不足，已建立 Sandbox 知識庫補充建議，建議由人工確認。";
      setChat((previous) => [
        ...previous,
        {
          id: `${Date.now()}-assistant`,
          role: "assistant",
          content: assistantKnowledgeMessage,
        },
      ]);
      setInputMessage("");
      setIsAnalyzing(false);
      return;
    }

    try {
      const response = await fetch("/api/sandbox/analyze-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history: nextHistory, gateDecision: gate.decision, appointmentDraft, flowHint: flowDecision.flow }),
      });

      const payload = (await response.json()) as {
        error?: string;
        result?: SandboxAppointmentAnalyzeResult;
        appointmentPolicyContext?: SandboxAppointmentPolicyContext;
        appointmentPolicyDebug?: SandboxAppointmentPolicyDebug;
      };
      const result = payload.result;
      if (!response.ok || !result) {
        setError(payload.error || "沙盒分析失敗，請稍後再試。");
        return;
      }
      setAppointmentPolicyDebug(payload.appointmentPolicyDebug || null);

      let resultForUi: SandboxAppointmentAnalyzeResult = result;
      if (result.intent === "appointment_request") {
        const previousDraft = appointmentDraft;
        const mergedDraft = mergeSandboxAppointmentDraft(appointmentDraft, result.extracted);
        setAppointmentDraft(mergedDraft);
        const replyParts = [
          buildSandboxAppointmentDraftReply(result.customer_reply, mergedDraft, {
            needsClarification: result.extracted.needs_clarification,
            timeStatus: result.extracted.time_status,
            policyContext: payload.appointmentPolicyContext,
            previousDraft,
          }),
        ];

        if (shouldAskSandboxAppointmentWeightForQuote(message, mergedDraft)) {
          replyParts.push(buildSandboxAppointmentMissingWeightForQuoteReply());
        } else if (isSandboxAppointmentPriceQuestion(message) && hasSandboxAppointmentQuoteBasis(mergedDraft)) {
          const quoteResult = await runKnowledgeAnswer(buildSandboxAppointmentPriceQuery(mergedDraft), result, nextHistory);
          if (quoteResult.ok && quoteResult.hasKnowledge && quoteResult.answer) {
            replyParts.push(appendSandboxAppointmentQuoteDisclaimer(quoteResult.answer));
          } else {
            replyParts.push("目前知識庫資料不足，已轉由門市人員確認報價。");
          }
        }

        resultForUi = {
          ...result,
          customer_reply: replyParts.filter(Boolean).join("\n\n"),
        };
      }

      setAnalysisResult(resultForUi);
      setChat((previous) => [
        ...previous,
        { id: `${Date.now()}-assistant`, role: "assistant", content: resultForUi.customer_reply },
      ]);
      setInputMessage("");
    } catch (requestError) {
      setError(`沙盒分析失敗：${(requestError as Error).message}`);
    } finally {
      setIsAnalyzing(false);
    }
  }

  function clearSandboxConversation() {
    setChat([]);
    setAnalysisResult(null);
    setAppointmentDraft(EMPTY_SANDBOX_APPOINTMENT_DRAFT);
    setSandboxRequestMessage("");
    setSandboxAbnormalAlertMessage("");
    setManualReplyTaskMessage("");
    setKnowledgeAnswer(null);
    setKnowledgeError("");
    setGateDecision(null);
    setAutoKnowledgeQueryMessage("");
    setConversationFlowDecision(null);
    setAppointmentPolicyDebug(null);
    setError("");
  }

  function createSandboxManualReplyTask() {
    if (!analysisResult || analysisResult.intent !== "manual_reply_task") return;
    const urgency = analysisResult.extracted.urgency?.toLowerCase() || "";
    const isUrgent = ["high", "urgent", "緊急", "高"].some((item) => urgency.includes(item));
    const lastMessage = inputMessage.trim() || chat.filter((item) => item.role === "customer").at(-1)?.content || "";
    appendSandboxManualReplyTaskEvent({
      id: `sandbox-manual-reply-${Date.now()}`,
      source: "conversation_logs",
      customer: analysisResult.extracted.customer_name?.trim() || "Sandbox Customer",
      source_channel: "LINE Sandbox",
      topic: analysisResult.summary?.trim() || "Sandbox 人工回覆任務",
      last_message: lastMessage,
      reply_note: analysisResult.customer_reply?.trim() || analysisResult.summary?.trim() || "請人工判斷並回覆客人。",
      waiting_minutes: 0,
      priority: isUrgent ? "urgent" : "normal",
      created_at: new Date().toISOString(),
      is_replied: false,
      replied_at: null,
    });
    setManualReplyTaskMessage("已建立沙盒人工回覆任務，請到 Manual Reply Tasks 查看。");
  }



  function createSandboxAbnormalAlert() {
    if (!analysisResult || analysisResult.intent !== "abnormal_alert") return;

    const extracted = analysisResult.extracted;
    const severity = normalizeSandboxAlertSeverity(extracted.urgency);
    appendSandboxAbnormalAlertEvent({
      id: `sandbox-alert-${Date.now()}`,
      source: "conversation_logs",
      severity,
      title: extracted.issue?.trim() || "Sandbox 異常提醒",
      summary: analysisResult.summary,
      customer_message: inputMessage.trim() || chat.filter((item) => item.role === "customer").at(-1)?.content || "",
      created_at: new Date().toISOString(),
      is_resolved: false,
    });

    setSandboxAbnormalAlertMessage("已建立沙盒異常提醒，請到 Abnormal Alerts 查看。");
    setAbnormalResolutionEvents(listSandboxAbnormalAlertResolutionEvents());
  }

  async function createSandboxAppointmentRequest() {
    if (!analysisResult || analysisResult.intent !== "appointment_request") return;
    if (!canCreateSandboxRequest) {
      setSandboxRequestMessage("時間需要重新確認，暫不建立沙盒預約。請先修正日期與時間。");
      return;
    }

    setIsCreatingSandboxRequest(true);
    setSandboxRequestMessage("");
    setSandboxAbnormalAlertMessage("");

    const requestedAt = resolveSandboxRequestedAt(appointmentDraft.preferred_date, appointmentDraft.preferred_time);
    if (!requestedAt) {
      setSandboxRequestMessage("建立失敗：無法解析為有效預約時間，請先修正日期與時間。");
      setIsCreatingSandboxRequest(false);
      return;
    }

    const payload = {
      owner_name: appointmentDraft.owner_name?.trim() || "Sandbox Customer",
      service: appointmentDraft.service_item?.trim() || "Sandbox Service",
      pet_name: appointmentDraft.pet_name?.trim() || "Sandbox Pet",
      requested_at: requestedAt,
      status: "pending" as const,
      is_sandbox: true,
    };

    if (!isSupabaseConfigured) {
      setSandboxRequestMessage(`建立失敗：${supabaseEnvWarning}`);
      setIsCreatingSandboxRequest(false);
      return;
    }

    try {
      await supabaseRequest({
        table: "appointment_requests",
        method: "POST",
        body: payload,
      });
      setSandboxRequestMessage("已建立沙盒預約申請。請到 Appointment Requests 查看。");
    } catch (createError) {
      setSandboxRequestMessage(`建立失敗：${(createError as Error).message}`);
    } finally {
      setIsCreatingSandboxRequest(false);
    }
  }

  async function runKnowledgeAnswer(
    message: string,
    currentAnalysisResult: SandboxAnalyzeResult | null,
    history: SandboxHistoryMessage[] = [],
  ): Promise<KnowledgeAnswerRunResult> {
    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      setKnowledgeError("找不到客人原始訊息，請重新輸入後再試。");
      return { ok: false, hasKnowledge: false };
    }

    setKnowledgeLoading(true);
    setKnowledgeError("");
    setKnowledgeAnswer(null);

    try {
      const response = await fetch("/api/sandbox/knowledge-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmedMessage, analysisResult: currentAnalysisResult, history }),
      });
      const payload = (await response.json()) as { error?: string } & SandboxKnowledgeAnswer;
      if (!response.ok) {
        setKnowledgeError(payload.error || "知識庫沙盒查詢失敗，請稍後再試。");
        return { ok: false, hasKnowledge: false };
      }
      const matchedArticles = payload.matched_articles || [];
      const needsManualReply = Boolean(payload.needs_manual_reply);
      const answer = payload.answer || "";
      setKnowledgeAnswer({
        answer,
        matched_articles: matchedArticles,
        needs_manual_reply: needsManualReply,
      });
      if (matchedArticles.length === 0 || needsManualReply) {
        upsertSandboxKnowledgeGapEvent({
          representative_message: trimmedMessage,
          suggested_title: `待補：${(currentAnalysisResult?.summary || trimmedMessage).slice(0, 30)}`,
          suggested_category: "待補知識",
          reason: "知識庫查無足夠相關資料，建議補充。",
        });
      }
      return {
        ok: true,
        hasKnowledge: matchedArticles.length > 0 && !needsManualReply,
        answer,
        needs_manual_reply: needsManualReply,
      };
    } catch (error) {
      setKnowledgeError(`知識庫沙盒查詢失敗：${(error as Error).message}`);
      return { ok: false, hasKnowledge: false };
    } finally {
      setKnowledgeLoading(false);
    }
  }

  async function handleKnowledgeAnswer() {
    const message = inputMessage.trim() || chat.filter((item) => item.role === "customer").at(-1)?.content || "";
    if (!message) {
      setKnowledgeError("找不到客人原始訊息，請重新輸入後再試。");
      return;
    }
    setAutoKnowledgeQueryMessage("");
    const history: SandboxHistoryMessage[] = chat.map(({ role, content }) => ({ role, content }));
    if (history.at(-1)?.content.trim() !== message.trim()) {
      history.push({ role: "customer", content: message });
    }
    await runKnowledgeAnswer(message, analysisResult, history);
  }

  const knowledgeAssistIntent = analysisResult?.intent === "knowledge_question" || analysisResult?.intent === "abnormal_alert";
  const isAbnormalKnowledgeAssist = analysisResult?.intent === "abnormal_alert";
  const lastCustomerMessage = useMemo(() => chat.filter((item) => item.role === "customer").at(-1)?.content || "", [chat]);
  const replyPolicyDecision = useMemo(
    () => evaluateSandboxReplyPolicy({ gateDecision, analysisResult, knowledgeAnswer, lastMessage: lastCustomerMessage }),
    [analysisResult, gateDecision, knowledgeAnswer, lastCustomerMessage],
  );

  return (
    <PageShell title="Conversation Logs 對話紀錄" description="客服與顧客歷史對話摘要。">
      {notice ? <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{notice}</p> : null}
      <SimpleTable headers={["對話編號", "客戶", "來源", "最後訊息", "更新時間"]}>
        {logs.map((log) => (
          <tr key={log.id}>
            <td className="px-4 py-3">{log.id}</td>
            <td className="px-4 py-3">{log.customer}</td>
            <td className="px-4 py-3">{log.channel}</td>
            <td className="px-4 py-3">{log.last_message}</td>
            <td className="px-4 py-3">{log.updated_at}</td>
          </tr>
        ))}
      </SimpleTable>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Sandbox 封存政策預覽</h2>
        <p className="mt-2 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
          這是未來每日封存前的規則預覽，不會真的封存、不會刪除資料、不會寫入 Supabase。
        </p>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {sandboxArchivePolicyPreviews.map((preview) => (
            <article key={preview.title} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="font-semibold text-slate-900">{preview.title}</h3>
                <span className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700">
                  {preview.decision.eligibility}
                </span>
              </div>
              <dl className="mt-3 grid gap-2 md:grid-cols-2">
                <div>
                  <dt className="font-medium text-slate-900">label</dt>
                  <dd>{preview.decision.label}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-900">must_keep_audit_log</dt>
                  <dd>{preview.decision.must_keep_audit_log ? "true" : "false"}</dd>
                </div>
                <div className="md:col-span-2">
                  <dt className="font-medium text-slate-900">reason</dt>
                  <dd>{preview.decision.reason}</dd>
                </div>
                <div className="md:col-span-2">
                  <dt className="font-medium text-slate-900">future_archive_behavior</dt>
                  <dd>{preview.decision.future_archive_behavior}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-900">can_delete_after_archive</dt>
                  <dd>{preview.decision.can_delete_after_archive ? "true" : "false"}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">LINE 沙盒對話模擬器（Gemini 沙盒判斷 v1）</h2>
        <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          這是沙盒模擬，不會真的送出 LINE 訊息，也不會通知客人；若建立預約僅會寫入 Sandbox 資料。
        </p>

        <form className="mt-4 space-y-3" onSubmit={submitSandboxMessage}>
          <label className="block text-sm text-slate-700" htmlFor="sandbox-message">
            模擬客人訊息
            <textarea
              id="sandbox-message"
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              rows={4}
              placeholder="例如：我想改成下週三晚上七點洗加剪，可以嗎？"
              value={inputMessage}
              onChange={(event) => setInputMessage(event.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={isAnalyzing}
              className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isAnalyzing ? "分析中..." : "送出模擬訊息"}
            </button>
            <button
              type="button"
              onClick={clearSandboxConversation}
              disabled={isAnalyzing || isCreatingSandboxRequest}
              className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              清除沙盒對話
            </button>
          </div>
        </form>

        {error ? <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

        <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <h3 className="text-sm font-semibold text-slate-800">沙盒聊天視窗</h3>
          <div className="mt-3 space-y-2">
            {chat.length === 0 ? <p className="text-sm text-slate-500">尚未送出模擬訊息。</p> : null}
            {chat.map((message) => (
              <div key={message.id} className={`flex ${message.role === "customer" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                    message.role === "customer" ? "bg-emerald-500 text-white" : "bg-white text-slate-800"
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
          <h3 className="font-semibold">Sandbox 預約草稿狀態</h3>
          <p className="mt-1 text-sky-900">此區只顯示前端暫存的預約草稿，不寫入 Supabase，也不會送出 LINE。</p>
          {isSandboxAppointmentDraftEmpty(appointmentDraft) ? (
            <p className="mt-3 text-sky-800">目前尚未累積預約草稿。</p>
          ) : (
            <dl className="mt-3 grid gap-2 md:grid-cols-2">
              {appointmentDraftRows.map(([key, value]) => (
                <div key={key}>
                  <dt className="font-medium">{key}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        {gateDecision ? (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <h3 className="font-semibold">AI 分流閘門</h3>
            <p className="mt-1">此分流閘門用於限制客服只處理 PIG HOUSE 服務範圍內問題，避免未來 LINE 被當作一般 AI 聊天工具濫用。</p>
            <ul className="mt-2 list-disc pl-5">
              {conversationFlowDecision ? (
                <>
                  <li>conversation_flow：{conversationFlowDecision.flow}</li>
                  <li>asks_quote：{conversationFlowDecision.asksQuote ? "true" : "false"}</li>
                  <li>asks_appointment：{conversationFlowDecision.asksAppointment ? "true" : "false"}</li>
                  <li>flow_reason：{conversationFlowDecision.reason}</li>
                  <li>quote_missing_fields：{conversationFlowDecision.missingQuoteFields.join("、") || "-"}</li>
                </>
              ) : null}
              <li>decision：{gateDecision.decision}</li>
              <li>reason：{gateDecision.reason}</li>
              <li>should_call_gemini：{gateDecision.should_call_gemini ? "true" : "false"}</li>
              <li>should_query_knowledge_base：{gateDecision.should_query_knowledge_base ? "true" : "false"}</li>
              <li>should_create_manual_task：{gateDecision.should_create_manual_task ? "true" : "false"}</li>
              <li>suggested_reply：{gateDecision.suggested_reply}</li>
            </ul>
          </div>
        ) : null}
        {appointmentPolicyDebug ? (
          <div className="mt-4 rounded-lg border border-orange-200 bg-orange-50 p-4 text-sm text-orange-950">
            <h3 className="font-semibold">appointment_policy diagnostics</h3>
            <dl className="mt-3 grid gap-2 md:grid-cols-2">
              <div>
                <dt className="font-medium">appointment_policy_status</dt>
                <dd>{appointmentPolicyDebug.appointment_policy_status}</dd>
              </div>
              <div>
                <dt className="font-medium">matched policy title</dt>
                <dd>{appointmentPolicyDebug.matched_policy_title || "-"}</dd>
              </div>
              <div>
                <dt className="font-medium">matched policy category</dt>
                <dd>{appointmentPolicyDebug.matched_policy_category || "-"}</dd>
              </div>
              <div>
                <dt className="font-medium">parsed forms</dt>
                <dd>{appointmentPolicyDebug.parsed_forms.join(" / ") || "-"}</dd>
              </div>
              <div className="md:col-span-2">
                <dt className="font-medium">parsed required fields</dt>
                <dd>{appointmentPolicyDebug.parsed_required_fields.join("、") || "-"}</dd>
              </div>
              <div className="md:col-span-2">
                <dt className="font-medium">reason</dt>
                <dd>{appointmentPolicyDebug.reason || "-"}</dd>
              </div>
            </dl>
          </div>
        ) : null}
        {gateDecision?.decision === "manual_required" ? (
          <div className="mt-4 rounded-lg border-2 border-fuchsia-400 bg-fuchsia-50 p-4 text-fuchsia-900">
            <h3 className="text-base font-bold">已自動建立 Sandbox Manual Reply Task</h3>
            <p className="mt-2 text-sm">
              此訊息涉及轉人工、客訴、退款、情緒激動或疑似醫療/傷害風險，建議由人工客服接手。
            </p>
            {manualReplyTaskMessage ? <p className="mt-2 rounded bg-white px-3 py-2 text-sm font-semibold text-fuchsia-950">{manualReplyTaskMessage}</p> : null}
          </div>
        ) : null}
        {replyPolicyDecision ? (
          <div className="mt-4 rounded-lg border border-violet-200 bg-violet-50 p-4 text-sm text-violet-950">
            <h3 className="font-semibold">正式回覆政策判斷（Sandbox）</h3>
            <p className="mt-1">這是正式上線前的回覆政策模擬，不會真的送 LINE，也不會寫入正式 messages。</p>
            <dl className="mt-3 grid gap-2 md:grid-cols-2">
              <div>
                <dt className="font-medium">mode</dt>
                <dd>{replyPolicyDecision.mode}</dd>
              </div>
              <div>
                <dt className="font-medium">label</dt>
                <dd>{replyPolicyDecision.label}</dd>
              </div>
              <div className="md:col-span-2">
                <dt className="font-medium">reason</dt>
                <dd>{replyPolicyDecision.reason}</dd>
              </div>
              <div className="md:col-span-2">
                <dt className="font-medium">future_line_behavior</dt>
                <dd>{replyPolicyDecision.future_line_behavior}</dd>
              </div>
              <div>
                <dt className="font-medium">can_auto_send_in_future</dt>
                <dd>{replyPolicyDecision.can_auto_send_in_future ? "true" : "false"}</dd>
              </div>
              <div>
                <dt className="font-medium">sandbox_notice</dt>
                <dd>{replyPolicyDecision.sandbox_notice}</dd>
              </div>
            </dl>
          </div>
        ) : null}
        <div className="mt-5 rounded-lg border border-fuchsia-200 bg-fuchsia-50 p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-fuchsia-900">Manual Reply Tasks 沙盒處理回寫訊息</h3>
            <button className="rounded border border-fuchsia-300 px-2 py-1 text-xs text-fuchsia-900" onClick={handleClearManualReplyResolutionEvents} type="button">清除 Manual Reply Tasks 沙盒處理回寫</button>
          </div>
          <p className="mt-2 text-sm text-fuchsia-900">這些是 Manual Reply Tasks 回寫的 Sandbox 訊息，不會真的送 LINE，也不是正式 messages 資料。</p>
          <div className="mt-3 space-y-2 text-sm">
            {manualReplyResolutionEvents.length === 0 ? <p className="text-sm text-slate-500">目前沒有回寫訊息。</p> : null}
            {manualReplyResolutionEvents.map((event) => (
              <div key={event.id} className="rounded border border-fuchsia-200 bg-white p-3 text-slate-800">
                <p className="text-xs text-slate-500">{event.created_at}</p>
                <p className="mt-1"><span className="font-medium">客戶：</span>{event.customer}</p>
                <p><span className="font-medium">主題：</span>{event.topic}</p>
                <p><span className="font-medium">最後訊息：</span>{event.last_message}</p>
                <p><span className="font-medium">建議回覆重點：</span>{event.reply_note}</p>
                <p><span className="font-medium">處理備註：</span>{event.resolution_note}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 rounded-lg border border-cyan-200 bg-cyan-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-cyan-900">Appointment Requests 沙盒回寫訊息</h3>
            <button
              type="button"
              onClick={handleClearAppointmentSandboxEvents}
              className="rounded border border-cyan-300 bg-white px-3 py-1 text-sm font-medium text-cyan-900 hover:bg-cyan-100"
            >
              清除 Appointment Requests 沙盒回寫
            </button>
          </div>
          <p className="mt-2 text-sm text-cyan-900">
            這些是 Appointment Requests 回寫的 Sandbox 訊息，不會真的送 LINE，也不是正式 messages 資料。
          </p>
          <div className="mt-3 space-y-2">
            {appointmentSandboxEvents.length === 0 ? <p className="text-sm text-slate-500">目前沒有回寫訊息。</p> : null}
            {appointmentSandboxEvents.map((event) => (
              <div key={event.id} className="rounded-lg border border-cyan-200 bg-white p-3 text-sm text-slate-800 shadow-sm">
                <p className="text-xs text-slate-500">{event.created_at}｜{event.appointment_status}</p>
                <p className="mt-1 text-xs text-slate-600">
                  {event.owner_name || "-"} / {event.pet_name || "-"} / {event.service || "-"}
                </p>
                <p className="mt-2 rounded-xl bg-cyan-100 px-3 py-2 text-cyan-950">{event.content}</p>
                {event.appointment_status === "proposed_new_time" ? (
                  <div className="mt-3 rounded-md border border-cyan-200 bg-cyan-50 p-3">
                    <label className="block text-sm text-slate-700" htmlFor={`reschedule-reply-${event.id}`}>
                      模擬客人回覆
                      <textarea
                        id={`reschedule-reply-${event.id}`}
                        className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                        rows={3}
                        placeholder="例如：好，明天下午三點可以"
                        value={rescheduleReplies[event.id] || ""}
                        onChange={(e) => setRescheduleReplies((prev) => ({ ...prev, [event.id]: e.target.value }))}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => handleAnalyzeRescheduleReply(event)}
                      disabled={rescheduleLoading[event.id] === true}
                      className="mt-2 rounded bg-cyan-800 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-cyan-400"
                    >
                      {rescheduleLoading[event.id] ? "處理中..." : "分析並更新 Sandbox 預約時間"}
                    </button>
                    {rescheduleResults[event.id]?.message ? (
                      <div
                        className={`mt-2 rounded px-3 py-2 text-sm ${
                          rescheduleResults[event.id].ok ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"
                        }`}
                      >
                        <p>{rescheduleResults[event.id].message}</p>
                        {rescheduleResults[event.id].result ? (
                          <ul className="mt-1 list-disc pl-5">
                            <li>preferred_date：{rescheduleResults[event.id].result?.preferred_date || "-"}</li>
                            <li>preferred_time：{rescheduleResults[event.id].result?.preferred_time || "-"}</li>
                            <li>staff_note：{rescheduleResults[event.id].result?.staff_note || "-"}</li>
                          </ul>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-amber-900">Abnormal Alerts 沙盒處理回寫訊息</h3>
            <button
              type="button"
              onClick={handleClearAbnormalResolutionEvents}
              className="rounded border border-amber-300 bg-white px-3 py-1 text-sm font-medium text-amber-900 hover:bg-amber-100"
            >
              清除 Abnormal Alerts 沙盒處理回寫
            </button>
          </div>
          <p className="mt-2 text-sm text-amber-900">
            這些是 Abnormal Alerts 回寫的 Sandbox 訊息，不會真的送 LINE，也不是正式 messages 資料。
          </p>
          <div className="mt-3 space-y-2">
            {abnormalResolutionEvents.length === 0 ? <p className="text-sm text-slate-500">目前沒有回寫訊息。</p> : null}
            {abnormalResolutionEvents.map((event) => (
              <div key={event.id} className="rounded-lg border border-amber-200 bg-white p-3 text-sm text-slate-800">
                <p className="text-xs text-slate-500">{event.created_at}</p>
                <p className="mt-1"><span className="font-medium">標題：</span>{event.title}</p>
                <p><span className="font-medium">嚴重度：</span>{event.severity}</p>
                <p><span className="font-medium">原始摘要：</span>{event.summary}</p>
                <p><span className="font-medium">處理備註：</span>{event.resolution_note}</p>
              </div>
            ))}
          </div>
        </div>

        <section className="mt-5 rounded-lg border border-indigo-200 bg-indigo-50 p-4">
          <h3 className="text-sm font-semibold text-indigo-900">客人主動改已確認預約（Sandbox）</h3>
          <p className="mt-2 text-sm text-indigo-900">
            這是 Sandbox 模擬流程，用來測試客人已預約後主動改時間。不會真的通知客人。
          </p>
          {confirmedSandboxRequests.length === 0 ? (
            <p className="mt-3 text-sm text-slate-700">目前沒有可模擬改約的已確認 Sandbox 預約。</p>
          ) : (
            <>
              <label className="mt-3 block text-sm font-medium text-indigo-900">選擇已確認 Sandbox 預約</label>
              <select
                className="mt-1 w-full rounded border border-indigo-300 bg-white px-2 py-1 text-sm"
                value={selectedConfirmedId}
                onChange={(event) => setSelectedConfirmedId(event.target.value)}
              >
                <option value="">請選擇</option>
                {confirmedSandboxRequests.map((item) => (
                  <option key={item.id} value={item.id}>
                    {`${item.owner_name || "未知飼主"} / ${item.pet_name || "未知寵物"} / ${item.service} / ${formatTaipei(item.requested_at)} / ${item.id}`}
                  </option>
                ))}
              </select>
              <label className="mt-3 block text-sm font-medium text-indigo-900">模擬客人改約訊息</label>
              <textarea
                className="mt-1 min-h-20 w-full rounded border border-indigo-300 bg-white px-2 py-1 text-sm"
                placeholder="例如：抱歉我這個時間突然有事，可以改五點嗎？"
                value={customerRescheduleMessage}
                onChange={(event) => setCustomerRescheduleMessage(event.target.value)}
              />
              <button
                type="button"
                className="mt-3 rounded border border-indigo-300 bg-white px-3 py-1 text-sm font-medium text-indigo-900 disabled:opacity-50"
                disabled={customerRescheduleLoading}
                onClick={handleCustomerRescheduleRequest}
              >
                {customerRescheduleLoading ? "處理中…" : "分析並送出改約請求"}
              </button>
            </>
          )}
          {customerRescheduleFeedback ? (
            <div
              className={`mt-3 rounded border px-3 py-2 text-sm ${
                customerRescheduleFeedback.ok ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-rose-200 bg-rose-50 text-rose-900"
              }`}
            >
              <p>{customerRescheduleFeedback.message}</p>
              {customerRescheduleFeedback.result ? (
                <ul className="mt-1 list-disc pl-5">
                  <li>preferred_date：{customerRescheduleFeedback.result.preferred_date || "-"}</li>
                  <li>preferred_time：{customerRescheduleFeedback.result.preferred_time || "-"}</li>
                  <li>staff_note：{customerRescheduleFeedback.result.staff_note || "-"}</li>
                </ul>
              ) : null}
            </div>
          ) : null}
        </section>

        {analysisResult ? (
          <div className="mt-5 rounded-lg border border-indigo-200 bg-indigo-50 p-4 text-sm text-slate-800">
            <h3 className="font-semibold text-indigo-900">系統判斷結果</h3>
            <ul className="mt-2 space-y-1">
              <li>判斷類型：{analysisResult.intent}</li>
              <li>信心程度：{confidencePercent(analysisResult.confidence)}</li>
              <li>建議歸類功能：{analysisResult.target_module}</li>
              <li>摘要：{analysisResult.summary}</li>
              <li>是否寫入正式資料：否</li>
              <li>是否送出 LINE：否</li>
            </ul>

            <div className="mt-3 rounded border border-indigo-100 bg-white p-3">
              <h4 className="font-medium text-slate-900">擷取欄位</h4>
              <ul className="mt-2 grid gap-1 md:grid-cols-2">
                {extractedRows.map(([key, value]) => (
                  <li key={key}>
                    <span className="font-medium">{key}：</span>
                    <span>{value || "-"}</span>
                  </li>
                ))}
              </ul>
            </div>



            {analysisResult.intent === "abnormal_alert" ? (
              <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3">
                <p className="text-sm font-semibold text-amber-900">Sandbox 異常提醒（僅 localStorage）</p>
                <p className="mt-1 text-sm text-amber-900">
                  這是 Sandbox 異常提醒，不會通知客人，不會送 LINE，不會寫入正式 messages。
                </p>
                <ul className="mt-2 list-disc pl-5 text-sm text-slate-800">
                  <li>issue：{analysisResult.extracted.issue || "-"}</li>
                  <li>urgency：{analysisResult.extracted.urgency || "-"}</li>
                  <li>summary：{analysisResult.summary || "-"}</li>
                </ul>
                <button
                  type="button"
                  onClick={createSandboxAbnormalAlert}
                  className="mt-3 rounded bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600"
                >
                  建立沙盒異常提醒
                </button>
                {sandboxAbnormalAlertMessage ? <p className="mt-2 text-sm text-slate-700">{sandboxAbnormalAlertMessage}</p> : null}
              </div>
            ) : null}

            {analysisResult.intent === "appointment_request" ? (
              <div className="mt-3">
                {(!canCreateSandboxRequest || analysisResult.extracted.time_status === "past") && (
                  <p className="mb-2 rounded bg-amber-100 px-3 py-2 text-amber-900">時間需要重新確認，暫不建立沙盒預約。</p>
                )}
                <button
                  type="button"
                  onClick={createSandboxAppointmentRequest}
                  disabled={isCreatingSandboxRequest || !canCreateSandboxRequest}
                  className="rounded bg-indigo-700 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600 disabled:cursor-not-allowed disabled:bg-indigo-300"
                >
                  {isCreatingSandboxRequest ? "建立中..." : "建立沙盒預約申請"}
                </button>
                {sandboxRequestMessage ? <p className="mt-2 text-sm text-slate-700">{sandboxRequestMessage}</p> : null}
              </div>
            ) : null}

            {knowledgeAssistIntent ? (
              <div className="mt-3 rounded-md border border-cyan-300 bg-cyan-50 p-3">
                <p className="text-sm font-semibold text-cyan-900">
                  {isAbnormalKnowledgeAssist ? "Knowledge Base 沙盒輔助查詢（異常事件）" : "Knowledge Base 沙盒查詢回答"}
                </p>
                <p className="mt-1 text-sm text-cyan-900">
                  {isAbnormalKnowledgeAssist
                    ? "這是異常事件的知識庫輔助查詢，只供員工判斷處理方向，不會自動回覆客人，不會送 LINE，不會寫入正式 messages。"
                    : "這是 Sandbox 知識庫回答，不會通知客人、不會送 LINE、不會寫入正式 messages。"}
                </p>
                {!isAbnormalKnowledgeAssist && gateDecision?.decision === "knowledge_candidate" ? (
                  <p className="mt-1 text-sm text-cyan-900">
                    此知識型問題已由 AI 分流閘門自動查詢 Knowledge Base；這仍是沙盒草稿，不會送 LINE，也不會寫入正式 messages。
                  </p>
                ) : null}
                <ul className="mt-2 list-disc pl-5 text-sm text-slate-800">
                  <li>summary：{analysisResult.summary || "-"}</li>
                  <li>issue：{analysisResult.extracted.issue || "-"}</li>
                  <li>service_item：{analysisResult.extracted.service_item || "-"}</li>
                  <li>原始客人訊息：{inputMessage.trim() || chat.filter((item) => item.role === "customer").at(-1)?.content || "-"}</li>
                </ul>
                <button type="button" onClick={handleKnowledgeAnswer} disabled={knowledgeLoading} className="mt-3 rounded bg-cyan-700 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-600 disabled:opacity-50">
                  {knowledgeLoading
                    ? (autoKnowledgeQueryMessage ? "正在自動查詢 Knowledge Base..." : "查詢中...")
                    : isAbnormalKnowledgeAssist
                      ? "查詢知識庫作為處理參考"
                      : "查詢知識庫並產生沙盒回答"}
                </button>
                {!isAbnormalKnowledgeAssist ? (
                  <p className="mt-1 text-xs text-cyan-900">knowledge_candidate 會自動查詢；此按鈕保留供重新查詢或異常事件輔助查詢。</p>
                ) : null}
                {knowledgeError ? <p className="mt-2 text-sm text-rose-700">{knowledgeError}</p> : null}
                {knowledgeAnswer ? (
                  <div className="mt-3 rounded border border-cyan-200 bg-white p-3 text-sm">
                    <p className="font-medium text-slate-900">沙盒知識庫回答</p>
                    <p className="mt-1 whitespace-pre-wrap text-slate-800">{knowledgeAnswer.answer}</p>
                    <p className="mt-2 text-slate-700">needs_manual_reply：{knowledgeAnswer.needs_manual_reply ? "true" : "false"}</p>
                    <p className="mt-2 font-medium text-slate-900">matched_articles</p>
                    {knowledgeAnswer.matched_articles.length > 0 ? (
                      <ul className="mt-1 list-disc pl-5 text-slate-800">
                        {knowledgeAnswer.matched_articles.map((article) => (
                          <li key={article.id}>{article.title}（{article.category} / score: {article.score} / id: {article.id}）</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-amber-800">
                        {isAbnormalKnowledgeAssist
                          ? "知識庫資料不足，請由人工客服處理，並視情況補充 Knowledge Base。"
                          : "知識庫資料不足，建議建立 Manual Reply Task 或補充 Knowledge Base。"}
                      </p>
                    )}
                    {knowledgeAnswer.needs_manual_reply ? (
                      <p className="mt-2 text-amber-800">
                        {isAbnormalKnowledgeAssist
                          ? "知識庫資料不足，請由人工客服處理，並視情況補充 Knowledge Base。"
                          : "知識庫資料不足，建議建立 Manual Reply Task 或補充 Knowledge Base。"}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            {analysisResult.intent === "manual_reply_task" ? (
              <div className="mt-3 rounded-md border border-fuchsia-300 bg-fuchsia-50 p-3">
                <p className="text-sm font-semibold text-fuchsia-900">Sandbox 人工回覆任務（僅 localStorage）</p>
                <p className="mt-1 text-sm text-fuchsia-900">這是 Sandbox 人工回覆任務，不會通知客人，不會送 LINE，不會寫入正式 messages。</p>
                <ul className="mt-2 list-disc pl-5 text-sm text-slate-800">
                  <li>summary：{analysisResult.summary || "-"}</li>
                  <li>issue：{analysisResult.extracted.issue || "-"}</li>
                  <li>urgency：{analysisResult.extracted.urgency || "-"}</li>
                  <li>customer_reply：{analysisResult.customer_reply || "-"}</li>
                  <li>原始客人訊息：{inputMessage.trim() || chat.filter((item) => item.role === "customer").at(-1)?.content || "-"}</li>
                </ul>
                <button type="button" onClick={createSandboxManualReplyTask} className="mt-3 rounded bg-fuchsia-700 px-4 py-2 text-sm font-medium text-white hover:bg-fuchsia-600">
                  建立沙盒人工回覆任務
                </button>
                {manualReplyTaskMessage ? <p className="mt-2 text-sm text-slate-700">{manualReplyTaskMessage}</p> : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
    </PageShell>
  );
}
