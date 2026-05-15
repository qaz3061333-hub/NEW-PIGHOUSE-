import type { SandboxAnalyzeResult } from "@/lib/sandbox";
import type { SandboxGateDecision } from "@/lib/sandboxServiceGate";
import type { SandboxKnowledgeAnswer } from "@/lib/types";

export type SandboxReplyMode =
  | "auto_reply_candidate"
  | "draft_review_required"
  | "manual_required"
  | "do_not_reply";

export type SandboxReplyPolicyDecision = {
  mode: SandboxReplyMode;
  label: string;
  reason: string;
  future_line_behavior: string;
  sandbox_notice: string;
  can_auto_send_in_future: boolean;
};

type EvaluateSandboxReplyPolicyInput = {
  gateDecision?: SandboxGateDecision | null;
  analysisResult?: SandboxAnalyzeResult | null;
  knowledgeAnswer?: SandboxKnowledgeAnswer | null;
  lastMessage?: string;
};

const SANDBOX_NOTICE = "這是正式上線前的回覆政策模擬，不會真的送 LINE，也不會寫入正式 messages。";

export function evaluateSandboxReplyPolicy({
  gateDecision,
  analysisResult,
  knowledgeAnswer,
}: EvaluateSandboxReplyPolicyInput): SandboxReplyPolicyDecision | null {
  if (gateDecision?.decision === "out_of_scope") {
    return {
      mode: "auto_reply_candidate",
      label: "可自動拒答",
      reason: gateDecision.reason,
      future_line_behavior: "未來正式 LINE 可自動送出固定拒答，避免被當成一般 AI 聊天工具。",
      sandbox_notice: SANDBOX_NOTICE,
      can_auto_send_in_future: true,
    };
  }

  if (gateDecision?.decision === "manual_required") {
    return {
      mode: "manual_required",
      label: "必須人工處理",
      reason: gateDecision.reason,
      future_line_behavior: "未來正式 LINE 不應由 AI 完整回答，最多自動安撫並建立人工任務。",
      sandbox_notice: SANDBOX_NOTICE,
      can_auto_send_in_future: false,
    };
  }

  if (analysisResult?.intent === "abnormal_alert") {
    return {
      mode: "manual_required",
      label: "異常事件，必須人工處理",
      reason: analysisResult.summary || gateDecision?.reason || "訊息疑似異常照護、受傷、醫療風險或客訴情境。",
      future_line_behavior: "未來正式 LINE 不應由 AI 完整回答，需由人工確認狀況與後續處理。",
      sandbox_notice: SANDBOX_NOTICE,
      can_auto_send_in_future: false,
    };
  }

  if (analysisResult?.intent === "appointment_request") {
    return {
      mode: "draft_review_required",
      label: "預約草稿，需人工確認",
      reason: analysisResult.summary || gateDecision?.reason || "訊息涉及預約、改約或時段確認。",
      future_line_behavior: "未來正式 LINE 可先產生預約草稿，但送出或建立正式預約前仍需人工確認。",
      sandbox_notice: SANDBOX_NOTICE,
      can_auto_send_in_future: false,
    };
  }

  if (analysisResult?.intent === "manual_reply_task") {
    return {
      mode: "manual_required",
      label: "必須人工處理",
      reason: analysisResult.summary || gateDecision?.reason || "沙盒分析判定需建立人工回覆任務。",
      future_line_behavior: "未來正式 LINE 不應由 AI 完整回答，最多自動安撫並建立人工任務。",
      sandbox_notice: SANDBOX_NOTICE,
      can_auto_send_in_future: false,
    };
  }

  if (gateDecision?.decision === "knowledge_candidate" || analysisResult?.intent === "knowledge_question") {
    if (!knowledgeAnswer) {
      return {
        mode: "draft_review_required",
        label: "知識庫草稿，建議人工確認",
        reason: "等待 Knowledge Base 查詢結果前，暫不允許自動送出正式回覆。",
        future_line_behavior: "目前先作為沙盒草稿；未來可針對營業時間、付款方式、服務範圍等低風險類別開啟自動回覆。",
        sandbox_notice: SANDBOX_NOTICE,
        can_auto_send_in_future: false,
      };
    }

    if (knowledgeAnswer.matched_articles.length > 0 && !knowledgeAnswer.needs_manual_reply) {
      return {
        mode: "draft_review_required",
        label: "知識庫草稿，建議人工確認",
        reason: "Knowledge Base 有匹配資料且未要求人工回覆；初期仍先保守列為人工確認草稿。",
        future_line_behavior: "目前先作為沙盒草稿；未來可針對營業時間、付款方式、服務範圍等低風險類別開啟自動回覆。",
        sandbox_notice: SANDBOX_NOTICE,
        can_auto_send_in_future: false,
      };
    }

    return {
      mode: "manual_required",
      label: "知識庫不足，需人工處理",
      reason: "Knowledge Base 無足夠匹配資料，或查詢結果標記 needs_manual_reply=true。",
      future_line_behavior: "不可自動編造答案，需補充 Knowledge Base 或由人工確認。",
      sandbox_notice: SANDBOX_NOTICE,
      can_auto_send_in_future: false,
    };
  }

  if (gateDecision?.decision === "appointment_candidate") {
    return {
      mode: "draft_review_required",
      label: "預約草稿，需人工確認",
      reason: gateDecision.reason,
      future_line_behavior: "未來正式 LINE 可先產生預約草稿，但送出或建立正式預約前仍需人工確認。",
      sandbox_notice: SANDBOX_NOTICE,
      can_auto_send_in_future: false,
    };
  }

  if (gateDecision?.decision === "abnormal_candidate") {
    return {
      mode: "manual_required",
      label: "異常事件，必須人工處理",
      reason: gateDecision.reason,
      future_line_behavior: "未來正式 LINE 不應由 AI 完整回答，需由人工確認狀況與後續處理。",
      sandbox_notice: SANDBOX_NOTICE,
      can_auto_send_in_future: false,
    };
  }

  if (!gateDecision && !analysisResult) return null;

  return {
    mode: "draft_review_required",
    label: "需人工確認草稿",
    reason: analysisResult?.summary || gateDecision?.reason || "尚未命中可自動送出的低風險規則。",
    future_line_behavior: "未來正式 LINE 需先累積更多分類與知識庫品質驗證，才可考慮開啟自動回覆。",
    sandbox_notice: SANDBOX_NOTICE,
    can_auto_send_in_future: false,
  };
}
