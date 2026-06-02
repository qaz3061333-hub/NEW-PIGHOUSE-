import {
  extractSandboxQuoteDraft,
  getMissingSandboxQuoteFields,
  type SandboxQuoteDraft,
} from "@/lib/sandboxConversationFlow";
import { isSandboxAppointmentAvailabilityMessage } from "@/lib/sandboxAppointmentInfoExtraction";

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

const MAX_CLARIFICATION_ATTEMPTS = 1;

const SERVICE_INFO_KEYWORDS = [
  "流程",
  "洗澡流程",
  "美容流程",
  "服務內容",
  "服務項目",
  "住宿須知",
  "住宿規則",
  "營業時間",
  "幾點開",
  "幾點關",
  "包月",
  "月包",
  "常見問題",
  "注意事項",
  "規則",
  "需要準備",
];

const QUOTE_KEYWORDS = ["多少錢", "價格", "價錢", "報價", "費用", "收費", "怎麼算", "怎麼計費"];
const APPOINTMENT_KEYWORDS = [
  "預約",
  "約時間",
  "約洗澡",
  "約美容",
  "空檔",
  "有空",
  "有沒有空",
  "可以洗澡嗎",
  "可以美容嗎",
  "能洗澡嗎",
  "能美容嗎",
  "想洗澡",
  "想美容",
  "明天可以",
  "今天可以",
  "後天可以",
];
const RESCHEDULE_CANCEL_KEYWORDS = ["改約", "改時間", "改期", "取消", "不能去了", "不能去", "換時間", "延期"];
const COMPLAINT_KEYWORDS = ["客訴", "投訴", "抱怨", "不滿意", "很差", "剪得很差", "剪壞", "受氣", "態度不好"];
const REFUND_KEYWORDS = ["退費", "退款", "退錢", "退刷", "補償"];
const HIGH_RISK_KEYWORDS = [
  "流血",
  "流膿",
  "化膿",
  "受傷",
  "傷口",
  "紅腫",
  "感染",
  "潰爛",
  "耳朵流膿",
  "皮膚爛",
  "咬人",
  "攻擊",
  "攻擊性",
  "老犬",
  "高齡",
  "癲癇",
  "抽搐",
  "呼吸困難",
  "發燒",
  "嘔吐",
  "拉肚子",
  "獸醫",
  "醫生",
];

function normalizeText(value: string) {
  return value
    .normalize("NFKC")
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
      return "客訴 / 退款";
    case "refund":
      return "客訴 / 退款";
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
      return "可由 Knowledge Base 自動回覆";
    case "need_clarification":
      return "需要補資料";
    case "human_required":
      return "需要人工回覆";
    case "unknown":
      return "AI 不確定";
    default:
      return "尚未判斷";
  }
}

export function getSandboxManualPriorityLabel(priority?: "normal" | "urgent" | null) {
  return priority === "urgent" ? "高" : "一般";
}

export function inferSandboxManualTaskTypeFromText(text: string): SandboxManualTaskType {
  const normalized = normalizeText(text);
  const hasComplaint = includesAny(normalized, COMPLAINT_KEYWORDS);
  const hasRefund = includesAny(normalized, REFUND_KEYWORDS);
  const hasQuote = includesAny(normalized, QUOTE_KEYWORDS);
  if (includesAny(normalized, HIGH_RISK_KEYWORDS)) return "high_risk";
  if (hasComplaint && hasRefund) return "complaint_refund";
  if (hasComplaint) return "complaint";
  if (hasRefund) return "refund";
  if (includesAny(normalized, RESCHEDULE_CANCEL_KEYWORDS)) return "reschedule_cancel";
  if (!hasQuote && (isSandboxAppointmentAvailabilityMessage(text) || includesAny(normalized, APPOINTMENT_KEYWORDS))) return "appointment_availability";
  if (normalized.includes("knowledge base") || normalized.includes("kb") || normalized.includes("找不到")) return "kb_not_found";
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
  const hasAppointmentAvailability = !asksQuote && (isSandboxAppointmentAvailabilityMessage(message) || includesAny(normalized, APPOINTMENT_KEYWORDS));

  if (includesAny(normalized, HIGH_RISK_KEYWORDS)) {
    return createDecision({
      triage_result: "human_required",
      classification_reason: "訊息包含流血、流膿、受傷、攻擊性或高齡等高風險狀況，MVP 需交由門市人員確認。",
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

  if (hasComplaint || hasRefund) {
    return createDecision({
      triage_result: "human_required",
      classification_reason: "訊息包含客訴、服務不滿或退款要求，不能由 AI 承諾處理結果。",
      task_type: hasComplaint && hasRefund ? "complaint_refund" : hasRefund ? "refund" : "complaint",
      should_auto_reply: true,
      should_query_knowledge_base: false,
      should_create_manual_task: true,
      suggested_reply: "不好意思讓您有不好的感受，我先幫您轉給門市人員確認，會由同事了解狀況後再回覆您。",
      priority: "urgent",
      quoteDraft,
      missingQuoteFields,
    });
  }

  if (includesAny(normalized, RESCHEDULE_CANCEL_KEYWORDS)) {
    return createDecision({
      triage_result: "human_required",
      classification_reason: "訊息是改約或取消需求，MVP 先集中到人工回覆工作台處理。",
      task_type: "reschedule_cancel",
      should_auto_reply: true,
      should_query_knowledge_base: false,
      should_create_manual_task: true,
      suggested_reply: "我先幫您轉給門市人員確認改約或取消事宜，這裡不會自動變更預約，稍後會由同事回覆您。",
      priority: "normal",
      quoteDraft,
      missingQuoteFields,
    });
  }

  if (hasAppointmentAvailability) {
    return createDecision({
      triage_result: "human_required",
      classification_reason: "訊息是預約或問空檔需求，MVP 不查真實空檔、不自動成立預約，先建立人工回覆任務。",
      task_type: "appointment_availability",
      should_auto_reply: true,
      should_query_knowledge_base: false,
      should_create_manual_task: true,
      suggested_reply: "可以，我先幫您轉給門市人員確認空檔。這還不是正式預約成功，稍後會由同事回覆您。",
      priority: "normal",
      quoteDraft,
      missingQuoteFields,
    });
  }

  if (asksQuote) {
    if (missingQuoteFields.length > 0) {
      if (quoteDraft.service_item) {
        return createDecision({
          triage_result: "auto_reply_ok",
          classification_reason: "報價問題已有服務項目，先查詢 active Knowledge Base，避免因日期或服務項目誤建預約人工任務。",
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

      if (clarificationAttempts >= MAX_CLARIFICATION_ATTEMPTS) {
        return createDecision({
          triage_result: "human_required",
          classification_reason: "報價問題仍缺必要資料，交由人工回覆工作台追補資料。",
          task_type: "quote_missing_info",
          should_auto_reply: true,
          should_query_knowledge_base: false,
          should_create_manual_task: true,
          suggested_reply: `我先幫您轉給門市人員確認報價，需要再補充：${missingQuoteFields.join("、")}。`,
          priority: "normal",
          quoteDraft,
          missingQuoteFields,
        });
      }

      return createDecision({
        triage_result: "need_clarification",
        classification_reason: `報價問題缺少必要資料：${missingQuoteFields.join("、")}。`,
        task_type: null,
        should_auto_reply: true,
        should_query_knowledge_base: false,
        should_create_manual_task: false,
        suggested_reply: `我先幫您確認報價規則。請再補充：${missingQuoteFields.join("、")}。`,
        priority: "normal",
        quoteDraft,
        missingQuoteFields,
      });
    }

    return createDecision({
      triage_result: "auto_reply_ok",
      classification_reason: "價格或報價問題已有品種、體重與服務項目，應查 active Knowledge Base 後回覆。",
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
      classification_reason: "服務內容、規則、住宿須知、營業時間或包月規則應查 active Knowledge Base 回覆。",
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
    classification_reason: "目前無法穩定判斷是否可由 Knowledge Base 自動回覆，先交由人工確認。",
    task_type: "ai_uncertain",
    should_auto_reply: true,
    should_query_knowledge_base: false,
    should_create_manual_task: true,
    suggested_reply: "我先幫您轉給門市人員確認，稍後會由同事回覆您。",
    priority: "normal",
    quoteDraft,
    missingQuoteFields,
  });
}
