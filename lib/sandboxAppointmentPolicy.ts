import { createClient } from "@supabase/supabase-js";

export type SandboxAppointmentPolicyContext =
  | {
      status: "active";
      article: {
        id: string;
        title: string;
        category: string;
        content: string;
        updated_at?: string | null;
      };
    }
  | {
      status: "missing" | "unavailable";
      reason: string;
    };

type KnowledgeArticleRow = {
  id: string;
  title: string;
  category: string;
  content: string | null;
  updated_at?: string | null;
};

const APPOINTMENT_POLICY_CATEGORY = "appointment_policy";

export type SandboxAppointmentPolicyRequiredField = {
  field: "service_item" | "pet_name" | "pet_type_or_breed" | "preferred_date" | "preferred_time" | "owner_name" | "phone" | "customer_status";
  label: string;
};

const POLICY_FIELD_MATCHERS: Array<SandboxAppointmentPolicyRequiredField & { patterns: RegExp[] }> = [
  { field: "service_item", label: "服務項目", patterns: [/服務項目/, /服務內容/, /項目/] },
  { field: "pet_name", label: "寵物姓名", patterns: [/寵物姓名/, /寶貝.*(?:姓名|名字)/, /狗狗.*(?:姓名|名字)/, /毛孩.*(?:姓名|名字)/] },
  { field: "pet_type_or_breed", label: "品種/類型", patterns: [/品種/, /犬種/, /類型/] },
  { field: "preferred_date", label: "希望日期", patterns: [/希望日期/, /預約日期/, /日期/] },
  { field: "preferred_time", label: "希望時間", patterns: [/希望時間/, /預約時間/, /時段/, /時間/] },
  { field: "owner_name", label: "飼主姓名", patterns: [/飼主姓名/, /主人姓名/, /客人姓名/, /聯絡人姓名/] },
  { field: "phone", label: "聯絡電話", patterns: [/聯絡電話/, /電話/, /手機/] },
  { field: "customer_status", label: "新客或舊客", patterns: [/新客/, /舊客/, /新舊客/, /是否.*(?:新客|舊客)/] },
];

function compactPolicyContent(content: string) {
  return content.trim().replace(/\n{3,}/g, "\n\n").slice(0, 4000);
}

export async function fetchActiveSandboxAppointmentPolicy(): Promise<SandboxAppointmentPolicyContext> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    return { status: "unavailable", reason: "Supabase environment is not configured." };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase
    .from("knowledge_articles")
    .select("id,title,category,content,updated_at")
    .eq("category", APPOINTMENT_POLICY_CATEGORY)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (error) {
    return { status: "unavailable", reason: error.message };
  }

  const article = ((data ?? []) as KnowledgeArticleRow[]).find((item) => item.content?.trim());
  if (!article) {
    return { status: "missing", reason: "No active appointment_policy article was found." };
  }

  return {
    status: "active",
    article: {
      id: article.id,
      title: article.title,
      category: article.category,
      content: compactPolicyContent(article.content || ""),
      updated_at: article.updated_at,
    },
  };
}

export function buildSandboxAppointmentPolicyPrompt(context: SandboxAppointmentPolicyContext) {
  if (context.status === "active") {
    return `Active Knowledge Base appointment_policy is available.
Use this policy as the source for appointment required information and customer-facing appointment rules.
Do not invent required fields that are not described in this policy.
For appointment_request, fill extracted.missing_fields using only policy-required information that is still missing after considering the current appointment draft and recent history.
If any policy-required information is missing, keep intent as appointment_request when appropriate, set extracted.needs_clarification=true, and ask for the missing items.
Even if the policy is permissive, never tell the customer the appointment is successful, reserved, arranged, confirmed, or completed.

appointment_policy article:
title: ${context.article.title}
category: ${context.article.category}
updated_at: ${context.article.updated_at || "-"}
content:
${context.article.content}`;
  }

  return `No active Knowledge Base appointment_policy is available.
If the customer is making or changing an appointment:
- keep intent as appointment_request when appropriate;
- set extracted.needs_clarification=true;
- do not invent store-specific rules or required fields;
- tell the customer the appointment rules are not configured and the request needs human/store confirmation.
Never tell the customer the appointment is successful, reserved, arranged, confirmed, or completed.

appointment_policy status: ${context.status}
reason: ${context.reason}`;
}

export function getSandboxAppointmentPolicyRequiredFields(
  context: SandboxAppointmentPolicyContext,
): SandboxAppointmentPolicyRequiredField[] {
  if (context.status !== "active") return [];

  const content = context.article.content;
  return POLICY_FIELD_MATCHERS.filter((item) => item.patterns.some((pattern) => pattern.test(content))).map(({ field, label }) => ({
    field,
    label,
  }));
}
