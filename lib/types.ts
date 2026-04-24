export type KbArticle = {
  id: string;
  title: string;
  category: string;
  updatedAt: string;
  status: "draft" | "published";
};

export type AppointmentRequest = {
  id: string;
  petName: string;
  service: string;
  ownerName: string;
  requestedAt: string;
  status: "new" | "contacted" | "confirmed";
};

export type AbnormalAlert = {
  id: string;
  severity: "low" | "medium" | "high";
  title: string;
  triggeredAt: string;
  summary: string;
};

export type ManualReplyTask = {
  id: string;
  customer: string;
  topic: string;
  waitingMinutes: number;
  priority: "normal" | "urgent";
};

export type ConversationLog = {
  id: string;
  customer: string;
  channel: string;
  lastMessage: string;
  updatedAt: string;
};
