import {
  AbnormalAlert,
  AppointmentRequest,
  ConversationLog,
  KbArticle,
  ManualReplyTask,
} from "./types";

export const kbArticles: KbArticle[] = [
  { id: "KB-001", title: "幼犬洗澡流程", category: "美容", content: "步驟與注意事項", updated_at: "2026-04-20", is_active: true },
  { id: "KB-002", title: "旅館入住須知", category: "旅館", content: "入住規範", updated_at: "2026-04-19", is_active: true },
  { id: "KB-003", title: "過敏反應處理 SOP", category: "醫療", content: "SOP 處理流程", updated_at: "2026-04-17", is_active: false },
];

export const appointmentRequests: AppointmentRequest[] = [
  { id: "AR-1301", pet_name: "Momo", service: "寵物美容", owner_name: "王小姐", requested_at: "2026-04-24 10:30", status: "pending", archive_status: "active", archived_at: null, archive_batch_id: null },
  { id: "AR-1302", pet_name: "Lucky", service: "住宿 2 晚", owner_name: "陳先生", requested_at: "2026-04-24 09:50", status: "proposed_new_time", archive_status: "active", archived_at: null, archive_batch_id: null },
  { id: "AR-1303", pet_name: "Coco", service: "Spa + 修毛", owner_name: "林小姐", requested_at: "2026-04-23 18:22", status: "confirmed", archive_status: "active", archived_at: null, archive_batch_id: null },
];

export const abnormalAlerts: AbnormalAlert[] = [
  { id: "AL-88", severity: "high", title: "預約暴增", triggered_at: "2026-04-24 09:00", summary: "10 分鐘內新增 12 筆預約", is_resolved: false, archive_status: "active", archived_at: null, archive_batch_id: null },
  { id: "AL-89", severity: "medium", title: "重複問題升高", triggered_at: "2026-04-24 08:20", summary: "同主題提問 30 分鐘內達 8 次", is_resolved: false, archive_status: "active", archived_at: null, archive_batch_id: null },
  { id: "AL-90", severity: "low", title: "客服延遲", triggered_at: "2026-04-24 07:45", summary: "平均回覆時間高於 5 分鐘", is_resolved: true, archive_status: "active", archived_at: null, archive_batch_id: null },
];

export const manualReplyTasks: ManualReplyTask[] = [
  { id: "MR-700", customer: "李小姐", topic: "老犬心臟病住宿可行性", waiting_minutes: 22, priority: "urgent", is_replied: false, archive_status: "active", archived_at: null, archive_batch_id: null },
  { id: "MR-701", customer: "周先生", topic: "美容師指定時段", waiting_minutes: 12, priority: "normal", is_replied: false, archive_status: "active", archived_at: null, archive_batch_id: null },
  { id: "MR-702", customer: "張小姐", topic: "取消政策例外申請", waiting_minutes: 35, priority: "urgent", is_replied: true, archive_status: "active", archived_at: null, archive_batch_id: null },
];

export const conversationLogs: ConversationLog[] = [
  { id: "CV-1120", customer: "王小姐", channel: "LINE", last_message: "請問明天下午還有小型犬洗澡嗎？", updated_at: "2026-04-24 10:42" },
  { id: "CV-1121", customer: "陳先生", channel: "LINE", last_message: "入住前可以先試住 2 小時嗎？", updated_at: "2026-04-24 10:31" },
  { id: "CV-1122", customer: "林小姐", channel: "LINE", last_message: "我家狗狗有皮膚病可以做 spa 嗎", updated_at: "2026-04-24 10:10" },
];
