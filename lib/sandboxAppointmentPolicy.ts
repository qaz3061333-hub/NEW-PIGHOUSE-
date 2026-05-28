import { createClient } from "@supabase/supabase-js";
import type { SandboxAnalyzeResult } from "@/lib/sandbox";

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
const APPOINTMENT_REPLY_CONFIRMATION_NOTE = "這還不是正式預約成功，需門市確認後才算完成。";
const APPOINTMENT_POLICY_MISSING_REPLY =
  "目前尚未設定預約規則，請由人工確認。已收到預約申請，需門市確認後才算完成。";
const APPOINTMENT_POLICY_UNAVAILABLE_REPLY =
  "目前無法讀取預約規則，請由人工確認。已收到預約申請，需門市確認後才算完成。";
const APPOINTMENT_SAFE_PENDING_REPLY = "已收到預約申請，需門市確認後才算完成。";
const APPOINTMENT_SAFE_CLARIFICATION_REPLY =
  "已收到預約申請，需門市確認後才算完成。請依預約規則補充尚缺資料，門市確認後才會完成預約。";

const APPOINTMENT_SUCCESS_COMMITMENT_PATTERN =
  /(已\s*(?:為您|幫您)?\s*(?:預約|約好|保留|安排|確認)|預約\s*(?:成功|成立|完成)|已確認\s*預約|已\s*改約|改約\s*成功|(?:今天|明天|後天).{0,8}見|(?:上午|下午|晚上)?\s*(?:\d+\s*點|[一二三四五六七八九十]+點).{0,4}見|到時候見|準時見)/i;

function compactPolicyContent(content: string) {
  return content.trim().replace(/\n{3,}/g, "\n\n").slice(0, 4000);
}

function mentionsStoreConfirmation(reply: string) {
  return /(門市|人工|人員|客服|店家).{0,12}確認|不是正式預約成功|尚未(?:正式)?(?:成立|完成)|預約申請|需.{0,8}確認後才算完成/.test(
    reply,
  );
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
Use this policy as the only source for appointment required information and customer-facing appointment rules.
Do not invent required fields that are not described in this policy.
If the customer is making or changing an appointment and any policy-required information is missing:
- keep intent as appointment_request when appropriate;
- set extracted.needs_clarification=true;
- ask for the missing items using the policy wording;
- say this is only an appointment request and store confirmation is required before completion.
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

export function sanitizeSandboxAppointmentResult(
  result: SandboxAnalyzeResult,
  policyContext: SandboxAppointmentPolicyContext,
): SandboxAnalyzeResult {
  if (result.intent !== "appointment_request") {
    return result;
  }

  if (policyContext.status !== "active") {
    return {
      ...result,
      customer_reply:
        policyContext.status === "missing" ? APPOINTMENT_POLICY_MISSING_REPLY : APPOINTMENT_POLICY_UNAVAILABLE_REPLY,
      target_module: "Appointment Requests",
      extracted: {
        ...result.extracted,
        needs_clarification: true,
      },
    };
  }

  let customerReply = result.customer_reply.trim() || APPOINTMENT_SAFE_PENDING_REPLY;

  if (APPOINTMENT_SUCCESS_COMMITMENT_PATTERN.test(customerReply)) {
    customerReply = result.extracted.needs_clarification
      ? APPOINTMENT_SAFE_CLARIFICATION_REPLY
      : APPOINTMENT_SAFE_PENDING_REPLY;
  }

  if (!mentionsStoreConfirmation(customerReply)) {
    customerReply = `${customerReply} ${APPOINTMENT_REPLY_CONFIRMATION_NOTE}`;
  }

  return {
    ...result,
    customer_reply: customerReply,
    target_module: "Appointment Requests",
  };
}
