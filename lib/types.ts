export type Customer = {
  id: string;
  name: string;
  phone?: string | null;
  line_user_id?: string | null;
  created_at?: string;
};

export type Message = {
  id: string;
  customer_id: string;
  channel: string;
  content: string;
  created_at: string;
};

export type KbArticle = {
  id: string;
  title: string;
  category: string;
  content?: string;
  updated_at?: string;
  is_active: boolean;
};

export type AppointmentStatus = "pending" | "confirmed" | "proposed_new_time" | "rejected";

export type AppointmentRequest = {
  id: string;
  pet_name: string;
  service: string;
  owner_name: string;
  requested_at: string;
  status: AppointmentStatus;
  is_sandbox?: boolean;
};

export type AbnormalAlert = {
  id: string;
  severity: "low" | "medium" | "high";
  title: string;
  triggered_at: string;
  summary: string;
  is_resolved: boolean;
};

export type ManualReplyTask = {
  id: string;
  customer: string;
  source_channel?: string | null;
  customer_line_user_id?: string | null;
  topic: string;
  last_message?: string | null;
  reply_note?: string | null;
  waiting_minutes: number;
  priority: "normal" | "urgent";
  is_replied: boolean;
  replied_at?: string | null;
};

export type ConversationLog = {
  id: string;
  customer: string;
  channel: string;
  last_message: string;
  updated_at: string;
};
