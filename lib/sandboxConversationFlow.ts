import type { SandboxAppointmentDraft } from "@/lib/sandboxAppointmentDraft";

export type SandboxConversationFlow = "quote_flow" | "appointment_flow" | "manual_flow" | "unknown";

export type SandboxQuoteDraft = {
  pet_type_or_breed: string;
  pet_weight: string;
  service_item: string;
};

export type SandboxConversationFlowDecision = {
  flow: SandboxConversationFlow;
  asksQuote: boolean;
  asksAppointment: boolean;
  isHighRisk: boolean;
  reason: string;
  quoteDraft: SandboxQuoteDraft;
  missingQuoteFields: string[];
};

const EMPTY_QUOTE_DRAFT: SandboxQuoteDraft = {
  pet_type_or_breed: "",
  pet_weight: "",
  service_item: "",
};

const QUOTE_KEYWORDS = [
  "多少錢",
  "價格",
  "價錢",
  "報價",
  "費用",
  "收費",
  "怎麼算",
  "怎麼計費",
];

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

const RESCHEDULE_CANCEL_KEYWORDS = [
  "改約",
  "改時間",
  "改期",
  "取消",
  "不能去了",
  "不能去",
  "換時間",
  "延期",
];

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

const SERVICE_KEYWORDS = [
  "洗澡",
  "美容",
  "住宿",
  "安親",
  "包月",
  "剪指甲",
  "清耳朵",
  "除蚤",
  "spa",
  "SPA",
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

export function isSandboxQuoteFlowQuestion(message: string) {
  return includesAny(normalizeText(message), QUOTE_KEYWORDS);
}

export function isSandboxAppointmentFlowRequest(message: string) {
  const normalized = normalizeText(message);
  return includesAny(normalized, APPOINTMENT_KEYWORDS) || includesAny(normalized, RESCHEDULE_CANCEL_KEYWORDS);
}

export function isSandboxHighRiskServiceQuestion(message: string) {
  return includesAny(normalizeText(message), HIGH_RISK_KEYWORDS);
}

function extractWeight(message: string) {
  const match = normalizeText(message).match(/(\d+(?:[.,]\d+)?)\s*(?:kg|公斤|公克|g|k)/i);
  return match ? `${match[1].replace(",", ".")}kg` : "";
}

function extractService(message: string) {
  const normalized = normalizeText(message);
  return SERVICE_KEYWORDS.find((keyword) => normalized.includes(keyword.toLowerCase())) || "";
}

function cleanBreedCandidate(value: string) {
  let candidate = normalizeText(value);
  for (const keyword of [...SERVICE_KEYWORDS, ...QUOTE_KEYWORDS, ...APPOINTMENT_KEYWORDS]) {
    candidate = candidate.replace(new RegExp(keyword.toLowerCase(), "g"), " ");
  }
  return candidate
    .replace(/\d+(?:[.,]\d+)?\s*(?:kg|公斤|公克|g|k)/gi, " ")
    .replace(/[?？!！,，.。:：;；]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractBreed(message: string, serviceItem: string) {
  const normalized = normalizeText(message);
  if (serviceItem) {
    const beforeService = normalized.split(serviceItem.toLowerCase())[0] || "";
    const candidate = cleanBreedCandidate(beforeService);
    if (candidate.length >= 2 && candidate.length <= 24) return candidate;
  }

  if (!/\d+(?:[.,]\d+)?\s*(?:kg|公斤|公克|g|k)/i.test(normalized)) {
    return "";
  }

  const beforeWeight = normalized.split(/\d+(?:[.,]\d+)?\s*(?:kg|公斤|公克|g|k)/i)[0] || "";
  const candidate = cleanBreedCandidate(beforeWeight);
  return candidate.length >= 2 && candidate.length <= 24 ? candidate : "";
}

export function extractSandboxQuoteDraft(message: string, fallbackDraft?: Partial<SandboxAppointmentDraft>): SandboxQuoteDraft {
  const serviceItem = extractService(message) || fallbackDraft?.service_item || "";
  return {
    pet_type_or_breed: extractBreed(message, serviceItem) || fallbackDraft?.pet_type_or_breed || "",
    pet_weight: extractWeight(message) || fallbackDraft?.pet_weight || "",
    service_item: serviceItem,
  };
}

export function getMissingSandboxQuoteFields(quoteDraft: SandboxQuoteDraft) {
  const missing: string[] = [];
  if (!quoteDraft.pet_type_or_breed) missing.push("品種");
  if (!quoteDraft.pet_weight) missing.push("體重");
  if (!quoteDraft.service_item) missing.push("服務項目");
  return missing;
}

export function buildSandboxQuoteMissingInfoReply(missingFields: string[]) {
  const uniqueMissing = Array.from(new Set(missingFields));
  if (uniqueMissing.length === 0) return "";
  return `我先幫您確認報價規則。請再補充：${uniqueMissing.join("、")}，我才能依 Knowledge Base 的價格規則協助回覆。`;
}

export function buildSandboxQuoteKnowledgeQuery(quoteDraft: SandboxQuoteDraft) {
  return `${quoteDraft.pet_type_or_breed} ${quoteDraft.pet_weight} ${quoteDraft.service_item} 多少錢`;
}

export function shouldBuildSandboxQuoteKnowledgeQuery(message: string, quoteDraft: SandboxQuoteDraft) {
  return (
    isSandboxQuoteFlowQuestion(message) &&
    Boolean(quoteDraft.pet_type_or_breed && quoteDraft.pet_weight && quoteDraft.service_item)
  );
}

export function buildSandboxKnowledgeQueryForMessage(message: string, quoteDraft: SandboxQuoteDraft) {
  return shouldBuildSandboxQuoteKnowledgeQuery(message, quoteDraft)
    ? buildSandboxQuoteKnowledgeQuery(quoteDraft)
    : message;
}

export function evaluateSandboxConversationFlow(message: string, fallbackDraft?: Partial<SandboxAppointmentDraft>): SandboxConversationFlowDecision {
  const normalized = normalizeText(message);
  const asksQuote = isSandboxQuoteFlowQuestion(message);
  const asksAppointment = isSandboxAppointmentFlowRequest(message);
  const isHighRisk = isSandboxHighRiskServiceQuestion(message);
  const quoteDraft = extractSandboxQuoteDraft(message, fallbackDraft);
  const missingQuoteFields = getMissingSandboxQuoteFields(quoteDraft);

  if (isHighRisk) {
    return {
      flow: "manual_flow",
      asksQuote,
      asksAppointment,
      isHighRisk,
      reason: "high risk or abnormal pet condition",
      quoteDraft,
      missingQuoteFields,
    };
  }

  if (asksAppointment) {
    return {
      flow: "appointment_flow",
      asksQuote,
      asksAppointment,
      isHighRisk,
      reason: includesAny(normalized, RESCHEDULE_CANCEL_KEYWORDS) ? "reschedule or cancel request" : "appointment or availability request",
      quoteDraft,
      missingQuoteFields,
    };
  }

  if (asksQuote) {
    return {
      flow: "quote_flow",
      asksQuote,
      asksAppointment,
      isHighRisk,
      reason: "price or quote question",
      quoteDraft,
      missingQuoteFields,
    };
  }

  return {
    flow: "unknown",
    asksQuote,
    asksAppointment,
    isHighRisk,
    reason: "no deterministic sandbox flow matched",
    quoteDraft: EMPTY_QUOTE_DRAFT,
    missingQuoteFields: [],
  };
}
