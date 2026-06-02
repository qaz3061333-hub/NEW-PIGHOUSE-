import {
  buildSandboxKnowledgeQueryForMessage,
  type SandboxQuoteDraft,
} from "@/lib/sandboxConversationFlow";
import {
  evaluateSandboxCustomerServiceTriage,
  getSandboxManualTaskTypeLabel,
  type SandboxCustomerServiceTriageDecision,
  type SandboxManualTaskType,
} from "@/lib/sandboxCustomerServiceTriage";
import {
  extractSandboxAppointmentInfo,
  getMissingSandboxAppointmentDetails,
} from "@/lib/sandboxAppointmentInfoExtraction";
import { buildSandboxAppointmentAvailabilityReply } from "@/lib/sandboxAppointmentAvailabilityReply";
import {
  runSandboxKnowledgeAnswer,
  type SandboxKnowledgeAnswerRequest,
} from "@/lib/sandboxKnowledgeAnswer";
import type { SandboxKnowledgeAnswer } from "@/lib/types";

export type SandboxLineCustomerServiceReplyKind =
  | "quote_clarification"
  | "kb_auto_reply"
  | "manual_handoff"
  | "kb_manual_handoff";

export type SandboxKnowledgeAnswerRunner = (
  request: SandboxKnowledgeAnswerRequest,
) => Promise<SandboxKnowledgeAnswer>;

export type SandboxLineCustomerServiceReply = {
  replyText: string;
  replyKind: SandboxLineCustomerServiceReplyKind;
  triageDecision: SandboxCustomerServiceTriageDecision;
  manualTaskType: SandboxManualTaskType | null;
  manualTaskWouldBeCreated: boolean;
  usedKnowledgeBase: boolean;
  knowledgeFallbackReason?: string;
  knowledgeQuery?: string;
};

type BuildReplyInput = {
  message: string;
  history?: SandboxKnowledgeAnswerRequest["history"];
  clarificationAttempts?: number;
  fallbackQuoteDraft?: Partial<SandboxQuoteDraft>;
  continueQuoteClarification?: boolean;
  knowledgeAnswerRunner?: SandboxKnowledgeAnswerRunner;
};

const KB_MANUAL_REVIEW_REPLY = "這題我先幫您轉給門市人員確認，避免沒有 Knowledge Base 依據時回答錯誤。";

function getAppointmentMissingDetails(message: string) {
  return getMissingSandboxAppointmentDetails(extractSandboxAppointmentInfo(message));
}

function buildManualHandoffReply(message: string, decision: SandboxCustomerServiceTriageDecision) {
  if (decision.task_type === "appointment_availability") {
    return buildSandboxAppointmentAvailabilityReply(getAppointmentMissingDetails(message));
  }
  return decision.suggested_reply || "我先幫您轉給門市人員確認，稍後會由同事回覆您。";
}

function buildManualReplyResult(
  message: string,
  decision: SandboxCustomerServiceTriageDecision,
): SandboxLineCustomerServiceReply {
  return {
    replyText: buildManualHandoffReply(message, decision),
    replyKind: "manual_handoff",
    triageDecision: decision,
    manualTaskType: decision.task_type,
    manualTaskWouldBeCreated: decision.should_create_manual_task,
    usedKnowledgeBase: false,
    knowledgeFallbackReason: decision.knowledge_fallback_reason,
  };
}

function buildKbManualFallbackResult(
  decision: SandboxCustomerServiceTriageDecision,
  knowledgeFallbackReason: string,
  knowledgeQuery: string,
  usedKnowledgeBase: boolean,
): SandboxLineCustomerServiceReply {
  return {
    replyText: KB_MANUAL_REVIEW_REPLY,
    replyKind: "kb_manual_handoff",
    triageDecision: {
      ...decision,
      triage_result: "human_required",
      task_type: "kb_not_found",
      should_create_manual_task: true,
      used_knowledge_base: usedKnowledgeBase,
      knowledge_fallback_reason: knowledgeFallbackReason,
      suggested_reply: KB_MANUAL_REVIEW_REPLY,
    },
    manualTaskType: "kb_not_found",
    manualTaskWouldBeCreated: true,
    usedKnowledgeBase,
    knowledgeFallbackReason,
    knowledgeQuery,
  };
}

export async function buildSandboxLineCustomerServiceReply({
  message,
  history = [],
  clarificationAttempts = 0,
  fallbackQuoteDraft,
  continueQuoteClarification = false,
  knowledgeAnswerRunner = runSandboxKnowledgeAnswer,
}: BuildReplyInput): Promise<SandboxLineCustomerServiceReply> {
  const triageDecision = evaluateSandboxCustomerServiceTriage({
    message,
    clarificationAttempts,
    fallbackQuoteDraft,
    continueQuoteClarification,
  });

  if (triageDecision.triage_result === "need_clarification") {
    return {
      replyText: triageDecision.suggested_reply,
      replyKind: "quote_clarification",
      triageDecision,
      manualTaskType: null,
      manualTaskWouldBeCreated: false,
      usedKnowledgeBase: false,
    };
  }

  if (triageDecision.should_create_manual_task) {
    return buildManualReplyResult(message, triageDecision);
  }

  if (!triageDecision.should_query_knowledge_base) {
    return buildManualReplyResult(message, triageDecision);
  }

  const knowledgeQuery = buildSandboxKnowledgeQueryForMessage(message, triageDecision.quoteDraft);

  try {
    const knowledgeAnswer = await knowledgeAnswerRunner({
      message: knowledgeQuery,
      history,
      analysisResult: {
        summary: triageDecision.classification_reason,
        extracted: {
          issue: message,
          service_item: triageDecision.quoteDraft.service_item,
        },
      },
    });

    if (!knowledgeAnswer.needs_manual_reply && knowledgeAnswer.matched_articles.length > 0) {
      return {
        replyText: knowledgeAnswer.answer,
        replyKind: "kb_auto_reply",
        triageDecision,
        manualTaskType: null,
        manualTaskWouldBeCreated: false,
        usedKnowledgeBase: Boolean(knowledgeAnswer.used_knowledge_base),
        knowledgeFallbackReason: knowledgeAnswer.knowledge_fallback_reason,
        knowledgeQuery,
      };
    }

    return buildKbManualFallbackResult(
      triageDecision,
      knowledgeAnswer.knowledge_fallback_reason || "Knowledge Base 找不到可安全回答的 active article。",
      knowledgeQuery,
      Boolean(knowledgeAnswer.used_knowledge_base),
    );
  } catch (error) {
    console.error("[LINE sandbox triage] Knowledge Base query failed", {
      message,
      knowledgeQuery,
      error: (error as Error).message,
    });

    return buildKbManualFallbackResult(
      triageDecision,
      "Knowledge Base 查詢失敗，已改交由門市人工確認。",
      knowledgeQuery,
      false,
    );
  }
}

export function summarizeSandboxLineReplyForLog(reply: SandboxLineCustomerServiceReply) {
  return {
    replyKind: reply.replyKind,
    triageResult: reply.triageDecision.triage_result,
    taskType: reply.manualTaskType,
    taskTypeLabel: getSandboxManualTaskTypeLabel(reply.manualTaskType),
    manualTaskWouldBeCreated: reply.manualTaskWouldBeCreated,
    usedKnowledgeBase: reply.usedKnowledgeBase,
    knowledgeFallbackReason: reply.knowledgeFallbackReason || "",
    knowledgeQuery: reply.knowledgeQuery || "",
  };
}
