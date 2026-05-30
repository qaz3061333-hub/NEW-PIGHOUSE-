import {
  extractSandboxQuoteDraft,
  getMissingSandboxQuoteFields,
  type SandboxQuoteDraft,
} from "@/lib/sandboxConversationFlow";

export type SandboxTriageResult = "auto_reply_ok" | "need_clarification" | "human_required" | "unknown";

export type SandboxManualTaskType =
  | "appointment_availability"
  | "reschedule_cancel"
  | "complaint_refund"
  | "complaint"
  | "refund"
  | "high_risk"
  | "quote_missing_info"
  | "ai_uncertain"
  | "kb_not_found"
  | "other";

export type SandboxCustomerServiceTriageDecision = {
  triage_result: SandboxTriageResult;
  classification_reason: string;
  task_type: SandboxManualTaskType | null;
  should_auto_reply: boolean;
  should_query_knowledge_base: boolean;
  should_create_manual_task: boolean;
  used_knowledge_base: boolean;
  knowledge_fallback_reason: string;
  suggested_reply: string;
  priority: "normal" | "urgent";
  is_sandbox: true;
  quoteDraft: SandboxQuoteDraft;
  missingQuoteFields: string[];
};

type EvaluateInput = {
  message: string;
  clarificationAttempts: number;
  fallbackQuoteDraft?: Partial<SandboxQuoteDraft>;
  continueQuoteClarification?: boolean;
};

const EMPTY_QUOTE_DRAFT: SandboxQuoteDraft = {
  pet_type_or_breed: "",
  pet_weight: "",
  service_item: "",
};

const MAX_CLARIFICATION_ATTEMPTS = 2;

const SERVICE_INFO_KEYWORDS = [
  "營業時間",
  "幾點開",
  "幾點關",
  "公休",
  "服務",
  "住宿",
  "安親",
  "包月",
  "單項",
  "剪指甲",
  "磨指甲",
  "清耳",
  "洗澡",
  "美容",
  "規則",
  "規定",
  "注意事項",
  "流程",
  "付款",
  "接送",
];

const QUOTE_KEYWORDS = ["多少", "多少錢", "費用", "價錢", "價格", "報價", "收費", "價位"];

const APPOINTMENT_KEYWORDS = [
  "預約",
  "想約",
  "我要約",
  "幫我約",
  "空檔",
  "有空",
  "幾點有空",
  "幾點可以",
  "什麼時候有空",
  "時段",
  "明天可以",
  "今天可以",
  "後天可以",
  "可以洗澡嗎",
  "可以美容嗎",
  "排時間",
];

const RESCHEDULE_CANCEL_KEYWORDS = ["改約", "改時間", "換時間", "取消預約", "我要取消", "取消"];
const COMPLAINT_KEYWORDS = ["客訴", "投訴", "不滿意", "很差", "剪得很差", "洗完覺得", "生氣"];
const REFUND_KEYWORDS = ["退款", "退費", "退錢", "退刷", "賠償"];
const HIGH_RISK_KEYWORDS = [
  "流血",
  "流膿",
  "化膿",
  "紅腫",
  "受傷",
  "傷口",
  "發炎",
  "疼痛",
  "感染",
  "醫療",
  "獸醫",
  "耳朵流膿",
  "攻擊性",
  "會咬",
  "很兇",
  "老犬",
  "高齡",
  "心臟病",
  "癲癇",
  "體況特殊",
];

function normalizeText(value: string) {
  return value
    .replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 65248))
    .replace(/[，。！？、,!?]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function includesAny(input: string, keywords: string[]) {
  return keywords.some((keyword) => input.includes(keyword.toLowerCase()));
}

function createDecision(
  patch: Omit<SandboxCustomerServiceTriageDecision, "is_sandbox" | "quoteDraft" | "missingQuoteFields" | "used_knowledge_base" | "knowledge_fallback_reason"> & {
    quoteDraft?: SandboxQuoteDraft;
    missingQuoteFields?: string[];
    used_knowledge_base?: boolean;
    knowledge_fallback_reason?: string;
  },
): SandboxCustomerServiceTriageDecision {
  return {
    ...patch,
    used_knowledge_base: patch.used_knowledge_base ?? false,
    knowledge_fallback_reason: patch.knowledge_fallback_reason ?? "",
    is_sandbox: true,
    quoteDraft: patch.quoteDraft ?? EMPTY_QUOTE_DRAFT,
    missingQuoteFields: patch.missingQuoteFields ?? [],
  };
}

export function getSandboxManualTaskTypeLabel(taskType?: SandboxManualTaskType | null) {
  switch (taskType) {
    case "appointment_availability":
      return "預約 / 問空檔";
    case "reschedule_cancel":
      return "改約 / 取消";
    case "complaint_refund":
      return "客訴 / 退款";
    case "complaint":
      return "客訴";
    case "refund":
      return "退款";
    case "high_risk":
      return "異常 / 高風險";
    case "quote_missing_info":
      return "報價補資料";
    case "ai_uncertain":
      return "AI 不確定";
    case "kb_not_found":
      return "KB 找不到";
    default:
      return "其他";
  }
}

export function getSandboxTriageResultLabel(result?: SandboxTriageResult | null) {
  switch (result) {
    case "auto_reply_ok":
      return "可自動回覆";
    case "need_clarification":
      return "需要補資料";
    case "human_required":
      return "需要人工處理";
    case "unknown":
      return "AI 不確定";
    default:
      return "尚未判斷";
  }
}

export function getSandboxManualPriorityLabel(priority?: "normal" | "urgent" | null) {
  return priority === "urgent" ? "高" : "中";
}

export function inferSandboxManualTaskTypeFromText(text: string): SandboxManualTaskType {
  const normalized = normalizeText(text);
  const hasComplaint = includesAny(normalized, COMPLAINT_KEYWORDS);
  const hasRefund = includesAny(normalized, REFUND_KEYWORDS);
  if (hasComplaint && hasRefund) return "complaint_refund";
  if (hasComplaint) return "complaint";
  if (hasRefund) return "refund";
  if (includesAny(normalized, HIGH_RISK_KEYWORDS)) return "high_risk";
  if (includesAny(normalized, RESCHEDULE_CANCEL_KEYWORDS)) return "reschedule_cancel";
  if (includesAny(normalized, APPOINTMENT_KEYWORDS)) return "appointment_availability";
  if (normalized.includes("knowledge base") || normalized.includes("知識庫") || normalized.includes("kb")) return "kb_not_found";
  return "other";
}

export function evaluateSandboxCustomerServiceTriage({
  message,
  clarificationAttempts,
  fallbackQuoteDraft,
  continueQuoteClarification = false,
}: EvaluateInput): SandboxCustomerServiceTriageDecision {
  const normalized = normalizeText(message);
  const quoteDraft = extractSandboxQuoteDraft(message, fallbackQuoteDraft);
  const missingQuoteFields = getMissingSandboxQuoteFields(quoteDraft);
  const asksQuote =
    includesAny(normalized, QUOTE_KEYWORDS) ||
    (continueQuoteClarification && Boolean(quoteDraft.pet_type_or_breed || quoteDraft.pet_weight || quoteDraft.service_item));
  const hasComplaint = includesAny(normalized, COMPLAINT_KEYWORDS);
  const hasRefund = includesAny(normalized, REFUND_KEYWORDS);

  if (hasComplaint || hasRefund) {
    return createDecision({
      triage_result: "human_required",
      classification_reason: "訊息涉及客訴、退款或金錢爭議，不能由系統自動承諾處理結果。",
      task_type: hasComplaint && hasRefund ? "complaint_refund" : hasRefund ? "refund" : "complaint",
      should_auto_reply: true,
      should_query_knowledge_base: false,
      should_create_manual_task: true,
      suggested_reply: "收到，我先幫您轉給門市人員了解狀況，退款或後續處理需要由門市確認後回覆您。",
      priority: "urgent",
      quoteDraft,
      missingQuoteFields,
    });
  }

  if (includesAny(normalized, HIGH_RISK_KEYWORDS)) {
    return createDecision({
      triage_result: "human_required",
      classification_reason: "訊息提到受傷、流膿、紅腫、攻擊性或體況特殊，屬於高風險情境。",
      task_type: "high_risk",
      should_auto_reply: true,
      should_query_knowledge_base: false,
      should_create_manual_task: true,
      suggested_reply: "這個狀況我先幫您轉給門市人員確認，必要時也建議先諮詢獸醫，避免延誤寶貝狀況。",
      priority: "urgent",
      quoteDraft,
      missingQuoteFields,
    });
  }

  if (includesAny(normalized, RESCHEDULE_CANCEL_KEYWORDS)) {
    return createDecision({
      triage_result: "human_required",
      classification_reason: "訊息涉及改約或取消，需要門市人工確認原預約與可處理方式。",
      task_type: "reschedule_cancel",
      should_auto_reply: true,
      should_query_knowledge_base: false,
      should_create_manual_task: true,
      suggested_reply: "收到，我先幫您轉給門市人員確認原預約與可調整方式，這裡不會自動完成改約或取消。",
      priority: "normal",
      quoteDraft,
      missingQuoteFields,
    });
  }

  if (includesAny(normalized, APPOINTMENT_KEYWORDS)) {
    return createDecision({
      triage_result: "human_required",
      classification_reason: "訊息涉及預約、問空檔或時段確認，目前 MVP 一律交由門市人工處理。",
      task_type: "appointment_availability",
      should_auto_reply: true,
      should_query_knowledge_base: false,
      should_create_manual_task: true,
      suggested_reply: "收到，我先幫您轉給門市確認時段，這還不是正式預約成功。",
      priority: "normal",
      quoteDraft,
      missingQuoteFields,
    });
  }

  if (asksQuote) {
    if (missingQuoteFields.length > 0) {
      if (clarificationAttempts >= MAX_CLARIFICATION_ATTEMPTS) {
        return createDecision({
          triage_result: "human_required",
          classification_reason: "報價問題已追問補資料，但仍缺少必要資訊，改交由人工確認。",
          task_type: "quote_missing_info",
          should_auto_reply: true,
          should_query_knowledge_base: false,
          should_create_manual_task: true,
          suggested_reply: "我先幫您轉給門市人員確認報價需要的資料，避免估錯價格區間。",
          priority: "normal",
          quoteDraft,
          missingQuoteFields,
        });
      }

      return createDecision({
        triage_result: "need_clarification",
        classification_reason: `報價問題缺少必要資訊：${missingQuoteFields.join("、")}。`,
        task_type: null,
        should_auto_reply: true,
        should_query_knowledge_base: false,
        should_create_manual_task: false,
        suggested_reply:
          missingQuoteFields.length === 1 && missingQuoteFields[0] === "體重"
            ? "請問寶貝目前大約幾公斤呢？我再幫您查對應價格區間。"
            : `請問可以先提供寶貝的${missingQuoteFields.join("、")}嗎？我再幫您查對應價格區間。`,
        priority: "normal",
        quoteDraft,
        missingQuoteFields,
      });
    }

    return createDecision({
      triage_result: "auto_reply_ok",
      classification_reason: "這是資料完整的報價問題，應查 active Knowledge Base 後產生沙盒回覆。",
      task_type: null,
      should_auto_reply: true,
      should_query_knowledge_base: true,
      should_create_manual_task: false,
      suggested_reply: "",
      priority: "normal",
      quoteDraft,
      missingQuoteFields,
    });
  }

  if (includesAny(normalized, SERVICE_INFO_KEYWORDS)) {
    return createDecision({
      triage_result: "auto_reply_ok",
      classification_reason: "這是可由 Knowledge Base 回答的服務資訊、規則或常見問題。",
      task_type: null,
      should_auto_reply: true,
      should_query_knowledge_base: true,
      should_create_manual_task: false,
      suggested_reply: "",
      priority: "normal",
      quoteDraft,
      missingQuoteFields,
    });
  }

  return createDecision({
    triage_result: "unknown",
    classification_reason: "系統無法明確判斷客人意思，避免硬答。",
    task_type: "ai_uncertain",
    should_auto_reply: true,
    should_query_knowledge_base: false,
    should_create_manual_task: true,
    suggested_reply: "這個問題我先幫您轉給門市人員確認，避免回覆錯誤。",
    priority: "normal",
    quoteDraft,
    missingQuoteFields,
  });
}
