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

const QUOTE_KEYWORDS = ["多少錢", "費用", "價格", "價位", "報價", "收費", "洗澡多少", "美容多少", "包月多少"];
const APPOINTMENT_KEYWORDS = ["我要預約", "想預約", "幫我約", "可以約嗎", "我要約洗澡", "我要約美容", "我要約住宿", "我要改約", "預約", "改約"];
const HIGH_RISK_KEYWORDS = ["流膿", "化膿", "流血", "受傷", "傷口", "紅腫", "發炎", "疼痛", "疑似感染", "客訴", "投訴", "退款", "退費"];
const SERVICE_KEYWORDS = ["洗澡", "美容", "住宿", "安親", "包月", "剪指甲", "清耳"];

const EMPTY_QUOTE_DRAFT: SandboxQuoteDraft = {
  pet_type_or_breed: "",
  pet_weight: "",
  service_item: "",
};

function includesAny(input: string, keywords: string[]) {
  return keywords.some((keyword) => input.includes(keyword));
}

function normalizeText(value: string) {
  return value
    .replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 65248))
    .replace(/[，。！？、,!?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isSandboxQuoteFlowQuestion(message: string) {
  return includesAny(normalizeText(message), QUOTE_KEYWORDS);
}

export function isSandboxAppointmentFlowRequest(message: string) {
  return includesAny(normalizeText(message), APPOINTMENT_KEYWORDS);
}

export function isSandboxHighRiskServiceQuestion(message: string) {
  return includesAny(normalizeText(message), HIGH_RISK_KEYWORDS);
}

function extractWeight(message: string) {
  const match = normalizeText(message).match(/(\d+(?:[.,]\d+)?)\s*(?:kg|公斤|k)/i);
  return match ? `${match[1].replace(",", ".")}公斤` : "";
}

function extractService(message: string) {
  const normalized = normalizeText(message);
  return SERVICE_KEYWORDS.find((keyword) => normalized.includes(keyword)) || "";
}

function cleanBreedCandidate(value: string) {
  return normalizeText(value)
    .replace(/^(?:我要|想要|想|幫我|可以|請問|請|預約|約|改約)+/, "")
    .replace(/(?:我要|想要|想|幫我|可以|請問|請|預約|約|改約|多少錢|費用|價格|價位|報價|收費)/g, "")
    .replace(/\d+(?:[.,]\d+)?\s*(?:kg|公斤|k)/gi, "")
    .trim();
}

function extractBreed(message: string, serviceItem: string) {
  const normalized = normalizeText(message);
  if (serviceItem) {
    const beforeService = normalized.split(serviceItem)[0] || "";
    const candidate = cleanBreedCandidate(beforeService);
    if (candidate.length >= 2 && candidate.length <= 20) return candidate;
  }

  const match = normalized.match(/([\u4e00-\u9fffA-Za-z][\u4e00-\u9fffA-Za-z\s-]{1,20}?)(?:\s*\d+(?:[.,]\d+)?\s*(?:kg|公斤|k)|\s*(?:洗澡|美容|住宿|安親|包月))/i);
  const candidate = match ? cleanBreedCandidate(match[1]) : "";
  return candidate.length >= 2 && candidate.length <= 20 ? candidate : "";
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
  if (uniqueMissing.length === 3) {
    return "可以呀，我先幫您估預計費用。請提供寶貝的品種、目前體重大約幾公斤，以及想詢問的服務項目，我再依知識庫幫您抓預估區間。";
  }
  return `可以呀，我先幫您估預計費用。請提供寶貝的${uniqueMissing.join("、")}，我再依知識庫幫您抓預估區間。`;
}

export function buildSandboxQuoteKnowledgeQuery(quoteDraft: SandboxQuoteDraft) {
  return `${quoteDraft.pet_type_or_breed} ${quoteDraft.pet_weight} ${quoteDraft.service_item} 多少錢`;
}

export function evaluateSandboxConversationFlow(message: string, fallbackDraft?: Partial<SandboxAppointmentDraft>): SandboxConversationFlowDecision {
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
      reason: "high-risk service or care question",
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
      reason: asksQuote ? "appointment request with quote question" : "appointment request",
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
      reason: "explicit quote question",
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
