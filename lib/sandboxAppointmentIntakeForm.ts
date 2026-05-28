import type { SandboxAppointmentPolicyContext } from "@/lib/sandboxAppointmentPolicy";
import type { SandboxAppointmentDraft, SandboxAppointmentExtracted } from "@/lib/sandboxAppointmentDraft";

export type SandboxAppointmentCustomerStatus = "new" | "returning" | "unknown";

export type SandboxAppointmentDraftField =
  | "service_item"
  | "pet_name"
  | "pet_type_or_breed"
  | "pet_weight"
  | "preferred_date"
  | "preferred_time"
  | "owner_name"
  | "phone"
  | "customer_status"
  | "health_notes";

export type SandboxAppointmentPolicyRequiredField = {
  field: SandboxAppointmentDraftField | "custom";
  label: string;
};

type SandboxAppointmentPolicyForm = {
  status: Exclude<SandboxAppointmentCustomerStatus, "unknown"> | "general";
  title: string;
  fields: SandboxAppointmentPolicyRequiredField[];
};

type SandboxAppointmentPolicyForms = {
  status: "active" | "missing" | "unavailable";
  forms: SandboxAppointmentPolicyForm[];
  reason?: string;
};

type FieldMatcher = {
  field: SandboxAppointmentDraftField;
  defaultLabel: string;
  patterns: RegExp[];
};

export const SANDBOX_APPOINTMENT_QUOTE_DISCLAIMER =
  "以上為預估區間，實際價格會依體型、毛長、現場狀況與配合度在區間內調整；打結、廢毛、除蚤或特殊狀況會另行評估加價。";

export const SANDBOX_APPOINTMENT_DRAFT_FIELD_LABELS: Array<[SandboxAppointmentDraftField, string]> = [
  ["customer_status", "新客或舊客"],
  ["pet_name", "寶貝姓名"],
  ["pet_type_or_breed", "品種"],
  ["pet_weight", "體重"],
  ["phone", "聯絡電話"],
  ["health_notes", "是否有體況或特殊注意事項"],
  ["service_item", "預約服務項目"],
  ["preferred_date", "希望日期"],
  ["preferred_time", "希望時間"],
  ["owner_name", "飼主姓名"],
];

const FIELD_MATCHERS: FieldMatcher[] = [
  { field: "customer_status", defaultLabel: "新客或舊客", patterns: [/新客.*舊客/, /舊客.*新客/, /新舊客/, /是否.*(?:新客|舊客)/] },
  { field: "service_item", defaultLabel: "預約服務項目", patterns: [/預約服務項目/, /服務項目/, /服務內容/, /項目/] },
  { field: "pet_name", defaultLabel: "寶貝姓名", patterns: [/寶貝.*(?:姓名|名字)/, /寵物.*(?:姓名|名字)/, /狗狗.*(?:姓名|名字)/, /毛孩.*(?:姓名|名字)/] },
  { field: "pet_type_or_breed", defaultLabel: "品種", patterns: [/品種/, /犬種/, /類型/] },
  { field: "pet_weight", defaultLabel: "體重", patterns: [/體重/, /公斤/, /\bkg\b/i] },
  { field: "health_notes", defaultLabel: "是否有體況或特殊注意事項", patterns: [/體況/, /特殊.*注意/, /健康/, /病史/, /注意事項/] },
  { field: "preferred_date", defaultLabel: "希望日期", patterns: [/希望日期/, /預約日期/, /日期/] },
  { field: "preferred_time", defaultLabel: "希望時間", patterns: [/希望時間/, /預約時間/, /時段/, /時間/] },
  { field: "owner_name", defaultLabel: "飼主姓名", patterns: [/飼主姓名/, /主人姓名/, /客人姓名/, /聯絡人姓名/] },
  { field: "phone", defaultLabel: "聯絡電話", patterns: [/聯絡電話/, /電話/, /手機/] },
];

const POLICY_NOTE_LABEL_PATTERNS = [
  /^預約提醒$/,
  /^取消規則$/,
  /^報價規則$/,
  /^禁止說法$/,
  /^建議語氣$/,
  /^注意事項$/,
  /^安全邊界$/,
  /^人工確認$/,
];

const SAFE_APPOINTMENT_NOTICE = "這還不是正式預約成功，需由門市人員確認後才算完成。";
const ASK_PRICE_WEIGHT_REPLY =
  "如果需要我先幫您估報價，請補充寶貝目前體重大約幾公斤；如果只是送出預約申請，門市確認時也會再協助核對。";

function compactText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function uniqueRequiredFields(fields: SandboxAppointmentPolicyRequiredField[]) {
  const seen = new Set<string>();
  return fields.filter((item) => {
    const key = `${item.field}:${item.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function stripListMarker(line: string) {
  return line.replace(/^\s*(?:[-*•]|[0-9]+[.)、]|[（(]?[一二三四五六七八九十]+[）)、.])\s*/, "").trim();
}

function normalizePolicyLabel(rawLabel: string) {
  return stripListMarker(rawLabel)
    .replace(/^[「『"']|[」』"']$/g, "")
    .replace(/[：:]\s*$/, "")
    .replace(/[（(]\s*(?:必填|required)\s*[）)]/gi, "")
    .trim();
}

function lineLooksLikeSectionHeading(line: string) {
  return /(?:需填|填寫|格式|預約資料|預約資訊|欄位|表單)$/.test(line.replace(/[：:]\s*$/, ""));
}

function detectPolicySection(line: string): SandboxAppointmentPolicyForm["status"] | null {
  const normalized = compactText(line).replace(/[：:]\s*$/, "");
  if (!normalized) return null;
  if (/舊客/.test(normalized) && /(?:需填|填寫|格式|預約資料|預約資訊|欄位|表單)/.test(normalized)) return "returning";
  if (/新客/.test(normalized) && !/舊客/.test(normalized) && /(?:需填|填寫|格式|預約資料|預約資訊|欄位|表單)/.test(normalized)) {
    return "new";
  }
  return null;
}

export function normalizeSandboxAppointmentCustomerStatus(value: string | undefined | null): SandboxAppointmentCustomerStatus {
  const normalized = compactText(value || "");
  if (!normalized) return "unknown";
  if (/舊客|老客|回訪|回客/.test(normalized)) return "returning";
  if (/新客|第一次|初次|首次/.test(normalized)) return "new";
  return "unknown";
}

export function getSandboxAppointmentDraftFieldLabel(field: SandboxAppointmentDraftField) {
  return SANDBOX_APPOINTMENT_DRAFT_FIELD_LABELS.find(([key]) => key === field)?.[1] || field;
}

export function findSandboxAppointmentFieldByLabel(label: string): SandboxAppointmentPolicyRequiredField {
  const normalized = normalizePolicyLabel(label);
  const matcher = FIELD_MATCHERS.find((item) => item.patterns.some((pattern) => pattern.test(normalized)));
  return matcher ? { field: matcher.field, label: normalized || matcher.defaultLabel } : { field: "custom", label: normalized };
}

function isPolicyNoteLabel(label: string) {
  return POLICY_NOTE_LABEL_PATTERNS.some((pattern) => pattern.test(label));
}

function parsePolicyLineField(line: string, options: { allowCustomFields: boolean }): SandboxAppointmentPolicyRequiredField | null {
  const stripped = stripListMarker(line);
  if (!stripped || lineLooksLikeSectionHeading(stripped)) return null;
  const [beforeColon] = stripped.split(/[：:]/);
  const label = normalizePolicyLabel(beforeColon || stripped);
  if (!label || label.length > 36) return null;
  if (isPolicyNoteLabel(label)) return null;

  const field = findSandboxAppointmentFieldByLabel(label);
  if (field.field === "custom" && !options.allowCustomFields) return null;
  return field;
}

export function parseSandboxAppointmentPolicyIntakeForms(context: SandboxAppointmentPolicyContext): SandboxAppointmentPolicyForms {
  if (context.status !== "active") {
    return { status: context.status, forms: [], reason: context.reason };
  }

  const forms: SandboxAppointmentPolicyForm[] = [];
  let currentForm: SandboxAppointmentPolicyForm | null = null;

  for (const rawLine of context.article.content.split(/\r?\n/)) {
    const stripped = stripListMarker(rawLine);
    if (!stripped) continue;

    const section = detectPolicySection(stripped);
    if (section) {
      currentForm = {
        status: section,
        title: section === "new" ? "新客預約填寫格式" : "舊客預約填寫格式",
        fields: [],
      };
      forms.push(currentForm);
      continue;
    }

    if (!currentForm) continue;
    const field = parsePolicyLineField(stripped, { allowCustomFields: true });
    if (field) currentForm.fields.push(field);
  }

  const compacted = forms
    .map((form) => ({ ...form, fields: uniqueRequiredFields(form.fields) }))
    .filter((form) => form.fields.length > 0);

  if (compacted.length > 0) return { status: "active", forms: compacted };

  const allFields = uniqueRequiredFields(
    context.article.content
      .split(/\r?\n/)
      .map((line) => parsePolicyLineField(line, { allowCustomFields: false }))
      .filter((item): item is SandboxAppointmentPolicyRequiredField => item !== null),
  );

  return allFields.length > 0
    ? { status: "active", forms: [{ status: "general", title: "預約填寫格式", fields: allFields }] }
    : { status: "active", forms: [] };
}

function getFormsForStatus(forms: SandboxAppointmentPolicyForm[], status: SandboxAppointmentCustomerStatus) {
  if (status === "new") return forms.filter((form) => form.status === "new");
  if (status === "returning") return forms.filter((form) => form.status === "returning");
  return forms.filter((form) => form.status === "general");
}

export function getSandboxAppointmentPolicyRequiredFields(
  context: SandboxAppointmentPolicyContext,
  status: SandboxAppointmentCustomerStatus = "unknown",
): SandboxAppointmentPolicyRequiredField[] {
  const parsed = parseSandboxAppointmentPolicyIntakeForms(context);
  if (parsed.status !== "active") return [];

  if (status === "unknown") {
    const statusField = parsed.forms
      .flatMap((form) => form.fields)
      .find((field) => field.field === "customer_status");
    return statusField ? [statusField] : [];
  }

  const statusForms = getFormsForStatus(parsed.forms, status);
  const selectedForms = statusForms.length > 0 ? statusForms : parsed.forms.filter((form) => form.status === "general");
  return uniqueRequiredFields(selectedForms.flatMap((form) => form.fields));
}

function getDraftValue(draft: SandboxAppointmentDraft, field: SandboxAppointmentPolicyRequiredField) {
  if (field.field === "custom") return draft.custom_fields[field.label] || "";
  return draft[field.field] || "";
}

export function getMissingSandboxAppointmentPolicyFields(
  context: SandboxAppointmentPolicyContext,
  draft: SandboxAppointmentDraft,
): SandboxAppointmentPolicyRequiredField[] {
  const status = normalizeSandboxAppointmentCustomerStatus(draft.customer_status);
  return getSandboxAppointmentPolicyRequiredFields(context, status).filter((field) => !getDraftValue(draft, field));
}

function formatFieldLine(field: SandboxAppointmentPolicyRequiredField, draft: SandboxAppointmentDraft, status: SandboxAppointmentPolicyForm["status"]) {
  const value = getDraftValue(draft, field);
  if (value) return `${field.label}：${value}`;
  if (field.field === "customer_status" && status === "new") return `${field.label}：新客`;
  if (field.field === "customer_status" && status === "returning") return `${field.label}：舊客`;
  return `${field.label}：`;
}

function formatForm(form: SandboxAppointmentPolicyForm, draft: SandboxAppointmentDraft) {
  return [`${form.title}：`, ...form.fields.map((field) => formatFieldLine(field, draft, form.status))].join("\n");
}

function hasDraftAnyKnownValue(draft: SandboxAppointmentDraft) {
  return SANDBOX_APPOINTMENT_DRAFT_FIELD_LABELS.some(([field]) => Boolean(draft[field])) || Object.keys(draft.custom_fields).length > 0;
}

export function buildSandboxAppointmentIntakeReply({
  policyContext,
  draft,
  previousDraft,
  timeStatus,
}: {
  policyContext: SandboxAppointmentPolicyContext;
  draft: SandboxAppointmentDraft;
  previousDraft?: SandboxAppointmentDraft;
  timeStatus?: string;
}) {
  if (timeStatus === "past") {
    return `可以呀，我先幫您整理預約申請。不過您提到的時間似乎已經過去，請再提供新的希望日期與希望時間。${SAFE_APPOINTMENT_NOTICE}`;
  }

  const parsed = parseSandboxAppointmentPolicyIntakeForms(policyContext);
  if (parsed.status !== "active" || parsed.forms.length === 0) {
    return `可以呀，我先幫您整理預約申請。不過目前還沒有可用的 active appointment_policy 預約表單，會先請門市人員確認需要補哪些資料。${SAFE_APPOINTMENT_NOTICE}`;
  }

  const status = normalizeSandboxAppointmentCustomerStatus(draft.customer_status);
  const previousStatus = normalizeSandboxAppointmentCustomerStatus(previousDraft?.customer_status || "");
  const wasEmpty = previousDraft ? !hasDraftAnyKnownValue(previousDraft) && previousDraft.missing_fields.length === 0 : true;
  const statusJustProvided = previousStatus === "unknown" && status !== "unknown";

  if (status === "unknown") {
    const newForms = parsed.forms.filter((form) => form.status === "new");
    const returningForms = parsed.forms.filter((form) => form.status === "returning");
    const visibleForms = [...newForms, ...returningForms];
    const formText = (visibleForms.length > 0 ? visibleForms : parsed.forms).map((form) => formatForm(form, draft)).join("\n\n");
    return `可以呀，我先幫您整理預約申請。不過這還不是正式預約成功，門市確認後才會完成預約。請您先選擇新客或舊客，並依照下面格式回覆，我會再幫您整理成申請草稿。\n\n${formText}`;
  }

  if (draft.missing_fields.length === 0) {
    return `資料已整理完整，可以建立預約申請。${SAFE_APPOINTMENT_NOTICE}`;
  }

  const formsForStatus = getFormsForStatus(parsed.forms, status);
  const shouldShowFullForm = wasEmpty || statusJustProvided || draft.missing_fields.length >= 4;

  if (shouldShowFullForm && formsForStatus.length > 0) {
    return `可以呀，我先幫您整理預約申請。不過這還不是正式預約成功，門市確認後才會完成預約。請您先依照下面格式補齊資料，我會再幫您整理成申請草稿。\n\n${formsForStatus
      .map((form) => formatForm(form, draft))
      .join("\n\n")}`;
  }

  return `可以呀，我先幫您整理預約申請。請再補充${draft.missing_fields.join("、")}。${SAFE_APPOINTMENT_NOTICE}`;
}

export function extractSandboxAppointmentFieldsFromMessage(
  message: string,
  policyContext: SandboxAppointmentPolicyContext,
): Partial<SandboxAppointmentExtracted> {
  const extracted: Partial<SandboxAppointmentExtracted> = {};
  const customFields: Record<string, string> = {};
  const parsedPolicy = parseSandboxAppointmentPolicyIntakeForms(policyContext);
  const policyFields = parsedPolicy.forms.flatMap((form) => form.fields);

  const findField = (label: string) => {
    const normalized = normalizePolicyLabel(label);
    return policyFields.find((field) => field.label === normalized) || findSandboxAppointmentFieldByLabel(normalized);
  };

  for (const rawLine of message.split(/\r?\n/)) {
    const line = stripListMarker(rawLine);
    if (!line) continue;

    if (!/[：:]/.test(line)) {
      const status = normalizeSandboxAppointmentCustomerStatus(line);
      if (status === "new") extracted.customer_status = "新客";
      if (status === "returning") extracted.customer_status = "舊客";
      continue;
    }

    const match = line.match(/^(.{1,36}?)[：:]\s*(.+)$/);
    if (!match) continue;
    const field = findField(match[1]);
    const value = match[2].trim();
    if (!value) continue;

    if (field.field === "custom") {
      customFields[field.label] = value;
    } else {
      extracted[field.field] = value;
    }
  }

  if (!extracted.customer_status) {
    const status = normalizeSandboxAppointmentCustomerStatus(message);
    if (status === "new") extracted.customer_status = "新客";
    if (status === "returning") extracted.customer_status = "舊客";
  }

  if (!extracted.phone) {
    const phoneMatch = message.match(/09\d{8}|0\d{1,2}[-\s]?\d{6,8}/);
    if (phoneMatch) extracted.phone = phoneMatch[0].replace(/\s+/g, "");
  }

  if (!extracted.pet_weight) {
    const weightMatch = message.match(/(\d+(?:[.,]\d+)?)\s*(?:kg|公斤)/i);
    if (weightMatch) extracted.pet_weight = `${weightMatch[1].replace(",", ".")}公斤`;
  }

  if (Object.keys(customFields).length > 0) extracted.custom_fields = customFields;
  return extracted;
}

export function isSandboxAppointmentPriceQuestion(message: string) {
  return /(多少|多少錢|費用|收費|價錢|價格|價位|報價|估價)/.test(message);
}

export function shouldAskSandboxAppointmentWeightForQuote(message: string, draft: SandboxAppointmentDraft) {
  return isSandboxAppointmentPriceQuestion(message) && !draft.pet_weight;
}

export function buildSandboxAppointmentMissingWeightForQuoteReply() {
  return ASK_PRICE_WEIGHT_REPLY;
}

export function hasSandboxAppointmentQuoteBasis(draft: SandboxAppointmentDraft) {
  return Boolean(draft.pet_type_or_breed && draft.pet_weight && draft.service_item);
}

export function buildSandboxAppointmentPriceQuery(draft: SandboxAppointmentDraft) {
  return `${draft.pet_type_or_breed} ${draft.pet_weight} ${draft.service_item} 多少錢`;
}

export function appendSandboxAppointmentQuoteDisclaimer(answer: string) {
  if (!answer.trim()) return "";
  if (answer.includes(SANDBOX_APPOINTMENT_QUOTE_DISCLAIMER)) return answer.trim();
  return `${answer.trim()}\n${SANDBOX_APPOINTMENT_QUOTE_DISCLAIMER}`;
}
