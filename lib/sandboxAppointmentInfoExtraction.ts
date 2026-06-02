export type SandboxAppointmentInfo = {
  pet_name: string;
  pet_type_or_breed: string;
  phone: string;
  service_item: string;
  preferred_datetime: string;
  hasPreferredDate: boolean;
  hasPreferredTime: boolean;
};

const COMMON_BREEDS = [
  "法國鬥牛犬",
  "英國短毛貓",
  "黃金獵犬",
  "邊境牧羊犬",
  "馬爾濟斯",
  "曼赤肯",
  "拉布拉多",
  "雪納瑞",
  "約克夏",
  "吉娃娃",
  "哈士奇",
  "臘腸",
  "米克斯",
  "柴犬",
  "法鬥",
  "博美",
  "柯基",
  "英短",
  "布偶",
  "邊牧",
  "西施",
  "貴賓",
].sort((a, b) => b.length - a.length);

const SERVICE_KEYWORDS = ["洗加剪", "剪指甲", "清耳朵", "洗澡", "美容", "住宿", "安親"];
const BOOKING_KEYWORDS = ["預約", "約時間", "約洗澡", "約美容", "問空檔", "空檔", "有空", "有沒有空", "想預約"];
const DATE_TEXT_PATTERN = /\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[/-]\d{1,2}|大後天|今天|明天|後天|下週[一二三四五六日天]?|下星期[一二三四五六日天]?|週[一二三四五六日天]|星期[一二三四五六日天]/;
const TIME_TEXT_PATTERN = /(?:上午|早上|中午|下午|晚上|晚間|傍晚)?\s*(?:[0-2]?\d|[一二三四五六七八九十兩二]{1,3})\s*(?:[:：]\s*[0-5]\d|點\s*(?:半|[0-5]?\d\s*分?)?)/;

function compactText(value: string) {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim();
}

function normalizePhone(value: string) {
  return value.replace(/[^\d]/g, "");
}

export function extractSandboxAppointmentPhone(message: string) {
  const normalized = compactText(message);
  const match = normalized.match(/09\d{2}[-\s]?\d{3}[-\s]?\d{3}|09\d{8}/);
  return match ? normalizePhone(match[0]) : "";
}

export function extractSandboxAppointmentDateText(message: string) {
  return compactText(message).match(DATE_TEXT_PATTERN)?.[0] || "";
}

export function extractSandboxAppointmentTimeText(message: string) {
  return compactText(message).match(TIME_TEXT_PATTERN)?.[0]?.replace(/\s+/g, "") || "";
}

export function extractSandboxAppointmentPreferredDateTime(message: string) {
  const normalized = compactText(message);
  const combinedPattern = new RegExp(`(${DATE_TEXT_PATTERN.source})\\s*(${TIME_TEXT_PATTERN.source})`);
  const combined = normalized.match(combinedPattern)?.[0];
  if (combined) return combined.replace(/\s+/g, " ");

  const dateText = extractSandboxAppointmentDateText(normalized);
  const timeText = extractSandboxAppointmentTimeText(normalized);
  return [dateText, timeText].filter(Boolean).join(" ");
}

export function extractSandboxAppointmentBreed(message: string) {
  const normalized = compactText(message);
  return COMMON_BREEDS.find((breed) => normalized.includes(breed)) || "";
}

function tokenizeForPetName(message: string) {
  return compactText(message)
    .replace(/(09\d{2})[-\s]?(\d{3})[-\s]?(\d{3})/g, "$1$2$3")
    .replace(/電話\s*/g, " ")
    .replace(/[，,。.!！?？:：;；、]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function isBreed(value: string) {
  return COMMON_BREEDS.includes(value);
}

function isService(value: string) {
  return SERVICE_KEYWORDS.some((keyword) => value.includes(keyword));
}

function isInvalidPetNameCandidate(value: string) {
  if (!value || value.length > 12) return true;
  if (isBreed(value) || isService(value)) return true;
  if (/^\d+$/.test(value)) return true;
  if (/(?:kg|公斤|公克|g|k)$/i.test(value)) return true;
  if (DATE_TEXT_PATTERN.test(value) || TIME_TEXT_PATTERN.test(value)) return true;
  if (/電話|預約|想約|約時間|問空檔|空檔|有空|可以|明天|今天|後天|大後天/.test(value)) return true;
  return false;
}

function cleanPetNameCandidate(value: string) {
  return value.replace(/[，,。.!！?？:：;；、]/g, "").trim();
}

export function extractSandboxAppointmentPetName(message: string) {
  const normalized = compactText(message);
  const explicitMatch = normalized.match(/(?:寶貝(?:名字)?|寵物(?:名字)?|名字|狗狗|貓咪)?(?:叫做|叫|是)\s*([A-Za-z0-9\u4e00-\u9fff]{1,12})/);
  const explicitCandidate = cleanPetNameCandidate(explicitMatch?.[1] || "");
  if (!isInvalidPetNameCandidate(explicitCandidate)) return explicitCandidate;

  const breed = extractSandboxAppointmentBreed(normalized);
  const tokens = tokenizeForPetName(normalized);
  const breedIndex = breed ? tokens.findIndex((token) => token === breed) : -1;
  if (breedIndex > 0) {
    const beforeBreed = cleanPetNameCandidate(tokens[breedIndex - 1]);
    if (!isInvalidPetNameCandidate(beforeBreed)) return beforeBreed;
  }

  const phone = extractSandboxAppointmentPhone(normalized);
  if (phone) {
    const phoneIndex = tokens.findIndex((token) => normalizePhone(token) === phone);
    const candidateAfterPhone = cleanPetNameCandidate(tokens[phoneIndex + 1] || "");
    if (!isInvalidPetNameCandidate(candidateAfterPhone)) return candidateAfterPhone;

    const candidateBeforePhone = cleanPetNameCandidate(tokens[phoneIndex - 1] || "");
    if (!isInvalidPetNameCandidate(candidateBeforePhone)) return candidateBeforePhone;
  }

  return "";
}

export function extractSandboxAppointmentServiceItem(message: string) {
  const normalized = compactText(message);
  const hasTime = Boolean(extractSandboxAppointmentTimeText(normalized));
  const genericAvailabilityQuestion = /(?:今天|明天|後天|大後天)?\s*可以\s*(?:洗澡|美容|住宿|安親|洗加剪|剪指甲|清耳朵)?\s*嗎/.test(normalized);
  if (genericAvailabilityQuestion && !hasTime) return "";
  return SERVICE_KEYWORDS.find((keyword) => normalized.includes(keyword)) || "";
}

export function extractSandboxAppointmentInfo(message: string): SandboxAppointmentInfo {
  const preferredDatetime = extractSandboxAppointmentPreferredDateTime(message);
  const dateText = extractSandboxAppointmentDateText(preferredDatetime);
  const timeText = extractSandboxAppointmentTimeText(preferredDatetime);

  return {
    pet_name: extractSandboxAppointmentPetName(message),
    pet_type_or_breed: extractSandboxAppointmentBreed(message),
    phone: extractSandboxAppointmentPhone(message),
    service_item: extractSandboxAppointmentServiceItem(message),
    preferred_datetime: preferredDatetime,
    hasPreferredDate: Boolean(dateText),
    hasPreferredTime: Boolean(timeText),
  };
}

export function getMissingSandboxAppointmentDetails(info: Pick<SandboxAppointmentInfo, "pet_name" | "pet_type_or_breed" | "phone" | "service_item" | "hasPreferredDate" | "hasPreferredTime">) {
  const missing: string[] = [];
  if (!info.pet_name) missing.push("寶貝姓名");
  if (!info.pet_type_or_breed) missing.push("品種");
  if (!info.phone) missing.push("電話");
  if (!info.service_item) missing.push("服務項目");
  if (!info.hasPreferredDate && !info.hasPreferredTime) missing.push("想預約日期 / 時間");
  else if (!info.hasPreferredDate) missing.push("想預約日期");
  else if (!info.hasPreferredTime) missing.push("想預約時間");
  return missing;
}

export function isSandboxAppointmentAvailabilityMessage(message: string) {
  const normalized = compactText(message);
  if (BOOKING_KEYWORDS.some((keyword) => normalized.includes(keyword))) return true;
  if (/(^|[\s，,。])約(?!克夏)/.test(normalized)) return true;
  if (/(?:今天|明天|後天|大後天).{0,8}可以.{0,6}(?:洗澡|美容|住宿|安親|洗加剪|剪指甲|清耳朵)\s*嗎/.test(normalized)) return true;

  const dateText = extractSandboxAppointmentDateText(normalized);
  const timeText = extractSandboxAppointmentTimeText(normalized);
  const serviceItem = SERVICE_KEYWORDS.find((keyword) => normalized.includes(keyword));
  return Boolean(serviceItem && (dateText || timeText));
}
