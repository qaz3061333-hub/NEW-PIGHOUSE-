export type SandboxKnowledgeGuardArticle = {
  title: string;
  category: string;
  content: string;
};

export type SandboxKnowledgeGuardResult = {
  answer?: string;
  needs_manual_reply: boolean;
  prompt_instructions: string;
};

const REQUIRED_INFO_MARKERS = [
  "報價前至少需要",
  "需追問資訊",
  "缺資料時",
  "缺品種",
  "缺體重",
  "缺膚質",
  "缺分店",
  "不可自動報價",
  "不可自動完整回答",
  "需現場評估",
  "另計",
];

const HIGH_RISK_QUERY_KEYWORDS = [
  "客訴",
  "投訴",
  "退款",
  "退費",
  "退錢",
  "受傷",
  "傷口",
  "流血",
  "紅腫",
  "發炎",
  "疼痛",
  "流膿",
  "化膿",
  "異味嚴重",
  "疑似感染",
  "一直抓耳",
  "醫療",
  "急診",
  "診斷",
];

const SKIN_KEYWORDS = ["敏感", "過敏", "乾", "油", "皮膚", "膚質", "皮屑", "紅腫"];
const BRANCH_KEYWORDS = ["分店", "門市", "哪間", "哪一家", "店"];
const PET_TYPE_KEYWORDS = ["狗", "狗狗", "犬", "貓", "貓咪", "毛孩", "寶貝"];

function compactText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeNumber(value: string) {
  return Number(value.replace("．", "."));
}

export function extractCustomerWeightKg(message: string): number | null {
  const normalized = message.replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 65248));
  const match = normalized.match(/(\d+(?:[.．]\d+)?)\s*(?:kg|公斤)/i);
  if (!match) return null;
  const value = normalizeNumber(match[1]);
  return Number.isFinite(value) ? value : null;
}

function includesAny(input: string, keywords: string[]) {
  return keywords.some((keyword) => input.includes(keyword));
}

function hasMultipleWeightTiers(content: string) {
  return (content.match(/體重區間/g) || []).length >= 2;
}

function articleRequires(content: string, field: "體重" | "膚質" | "分店" | "品種") {
  if (!content.includes(field)) return false;
  return REQUIRED_INFO_MARKERS.some((marker) => content.includes(marker)) || content.includes("報價前");
}

function findManualWeightLimitKg(content: string): number | null {
  const normalized = content.replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 65248));
  const matches = normalized.matchAll(/(\d+(?:\.\d+)?)\s*kg\s*以上[\s\S]{0,120}(?:不可自動報價|不自動報價|不由系統自動|致電|轉人工|人工)/gi);
  const limits = Array.from(matches)
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value));
  return limits.length > 0 ? Math.min(...limits) : null;
}

function getMissingInfoAnswer(missingFields: string[]) {
  if (missingFields.length === 0) return "";
  if (missingFields.length === 1 && missingFields[0] === "體重") {
    return "請問寶貝目前大約幾公斤呢？這項服務會依體重區間報價，我先確認體重後再幫您估區間。";
  }
  const fieldText = missingFields.join("、");
  return `請問可以先提供寶貝的${fieldText}嗎？我先確認必要資訊後，再依知識庫幫您估可回答的範圍。`;
}

function isHighRiskQuery(message: string) {
  return includesAny(message, HIGH_RISK_QUERY_KEYWORDS);
}

function hasPetTypeHint(message: string) {
  return includesAny(message, PET_TYPE_KEYWORDS) || /[\u4e00-\u9fff]{2,}(?:犬|貓)/.test(message);
}

function hasKnownArticlePetDescriptor(message: string, articles: SandboxKnowledgeGuardArticle[]) {
  const descriptors = articles.flatMap((article) => {
    const values = new Set<string>();
    for (const source of [article.title, article.content]) {
      const titlePart = source.match(/[｜|]\s*([^\n｜|（(]+)/)?.[1]?.trim();
      if (titlePart && titlePart.length >= 2) values.add(titlePart);

      for (const match of Array.from(source.matchAll(/(?:品種|類型|適用對象)[：:]\s*([^\n]+)/g))) {
        const value = match[1].trim().split(/[，,、/／\s]/)[0];
        if (value.length >= 2) values.add(value);
      }
    }
    return Array.from(values);
  });

  return descriptors.some((descriptor) => descriptor.length >= 2 && message.includes(descriptor));
}

export function evaluateSandboxKnowledgeQueryGuard(
  message: string,
  articles: SandboxKnowledgeGuardArticle[],
): SandboxKnowledgeGuardResult {
  const query = compactText(message);
  const customerWeightKg = extractCustomerWeightKg(query);
  const combinedContent = articles.map((article) => `${article.title}\n${article.category}\n${article.content}`).join("\n\n");

  if (isHighRiskQuery(query)) {
    return {
      answer: "這個狀況不建議由系統直接用價格或美容服務回答，建議先就醫或由人工客服協助確認。",
      needs_manual_reply: true,
      prompt_instructions: "",
    };
  }

  if (customerWeightKg !== null) {
    for (const article of articles) {
      const limitKg = findManualWeightLimitKg(article.content);
      if (limitKg !== null && customerWeightKg >= limitKg) {
        return {
          answer: `${limitKg}kg 以上的情況知識庫標示不由系統自動外推價格，建議致電門市或轉人工確認。`,
          needs_manual_reply: true,
          prompt_instructions: "",
        };
      }
    }
  }

  const missingFields: string[] = [];
  if ((hasMultipleWeightTiers(combinedContent) || articleRequires(combinedContent, "體重")) && customerWeightKg === null) {
    missingFields.push("體重");
  }
  if (articleRequires(combinedContent, "膚質") && !includesAny(query, SKIN_KEYWORDS)) {
    missingFields.push("膚質");
  }
  if (articleRequires(combinedContent, "分店") && !includesAny(query, BRANCH_KEYWORDS)) {
    missingFields.push("分店");
  }
  if (articleRequires(combinedContent, "品種") && !hasPetTypeHint(query) && !hasKnownArticlePetDescriptor(query, articles)) {
    missingFields.push("品種或類型");
  }

  const missingInfoAnswer = getMissingInfoAnswer(Array.from(new Set(missingFields)));
  if (missingInfoAnswer) {
    return {
      answer: missingInfoAnswer,
      needs_manual_reply: false,
      prompt_instructions: "",
    };
  }

  return {
    needs_manual_reply: false,
    prompt_instructions: [
      "回答必須優先遵守 Knowledge Base 內的限制，例如：報價前至少需要、需追問資訊、缺資料時、缺品種 / 體重 / 膚質 / 分店、不可自動報價、不可自動完整回答、需現場評估、另計。",
      "若客人問題缺少 KB 要求的必要資訊，只追問缺少資訊，不列完整價格表、不列所有級距、不複製整篇 KB。",
      "若 KB 有多個價格級距，且客人已提供足夠條件，只回答該條件對應的最小必要價格區間，不列其他級距。",
      "若 KB 標示需現場評估或另計，可先回答可確定的基礎資訊，再提醒現場評估；不要自行算完整總價。",
      "若涉及高風險、醫療疑慮、受傷、流血、嚴重耳況、退款、客訴或價格爭議，走人工或建議就醫，不用價格 KB 自動完整回答。",
    ].join("\n"),
  };
}

function parseWeightRange(section: string): { min: number; max: number } | null {
  const below = section.match(/體重[：:]\s*(\d+(?:[.．]\d+)?)\s*kg\s*以下/i);
  if (below) return { min: Number.NEGATIVE_INFINITY, max: normalizeNumber(below[1]) };

  const above = section.match(/體重[：:]\s*(\d+(?:[.．]\d+)?)\s*kg\s*以上/i);
  if (above) return { min: normalizeNumber(above[1]), max: Number.POSITIVE_INFINITY };

  const between = section.match(/體重[：:]\s*(\d+(?:[.．]\d+)?)\s*[～~\-至到]\s*(\d+(?:[.．]\d+)?)\s*kg/i);
  if (between) return { min: normalizeNumber(between[1]), max: normalizeNumber(between[2]) };

  return null;
}

function findMatchingWeightSection(content: string, customerWeightKg: number) {
  const sections = content.split(/(?=體重區間\s*\d+\s*[：:])/);
  for (const section of sections) {
    const range = parseWeightRange(section);
    if (!range) continue;
    if (customerWeightKg >= range.min && customerWeightKg <= range.max) return section;
  }
  return "";
}

function extractRestrictionLines(content: string) {
  return content
    .split(/\r?\n/)
    .filter((line) => REQUIRED_INFO_MARKERS.some((marker) => line.includes(marker)) || line.includes("現場評估") || line.includes("高風險"))
    .slice(0, 12)
    .join("\n");
}

export function buildGuardedKnowledgeArticleSnippet(
  article: SandboxKnowledgeGuardArticle,
  message: string,
  limit: number,
) {
  const customerWeightKg = extractCustomerWeightKg(message);
  const weightSection =
    customerWeightKg !== null && hasMultipleWeightTiers(article.content)
      ? findMatchingWeightSection(article.content, customerWeightKg)
      : "";
  const restrictions = extractRestrictionLines(article.content);
  const source = weightSection ? `${weightSection}\n${restrictions}` : article.content;
  return compactText(source).slice(0, limit);
}
