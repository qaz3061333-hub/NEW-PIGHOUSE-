import {
  AbnormalAlert,
  AppointmentRequest,
  ConversationLog,
  KbArticle,
  ManualReplyTask,
} from "./types";

export const kbArticles: KbArticle[] = [
  { id: "KB-001", title: "幼犬洗澡流程", category: "美容", updatedAt: "2026-04-20", status: "published" },
  { id: "KB-002", title: "旅館入住須知", category: "旅館", updatedAt: "2026-04-19", status: "published" },
  { id: "KB-003", title: "過敏反應處理 SOP", category: "醫療", updatedAt: "2026-04-17", status: "draft" },
];

export const appointmentRequests: AppointmentRequest[] = [
  { id: "AR-1301", petName: "Momo", service: "寵物美容", ownerName: "王小姐", requestedAt: "2026-04-24 10:30", status: "new" },
  { id: "AR-1302", petName: "Lucky", service: "住宿 2 晚", ownerName: "陳先生", requestedAt: "2026-04-24 09:50", status: "contacted" },
  { id: "AR-1303", petName: "Coco", service: "Spa + 修毛", ownerName: "林小姐", requestedAt: "2026-04-23 18:22", status: "confirmed" },
];

export const abnormalAlerts: AbnormalAlert[] = [
  { id: "AL-88", severity: "high", title: "預約暴增", triggeredAt: "2026-04-24 09:00", summary: "10 分鐘內新增 12 筆預約" },
  { id: "AL-89", severity: "medium", title: "重複問題升高", triggeredAt: "2026-04-24 08:20", summary: "同主題提問 30 分鐘內達 8 次" },
  { id: "AL-90", severity: "low", title: "客服延遲", triggeredAt: "2026-04-24 07:45", summary: "平均回覆時間高於 5 分鐘" },
];

export const manualReplyTasks: ManualReplyTask[] = [
  { id: "MR-700", customer: "李小姐", topic: "老犬心臟病住宿可行性", waitingMinutes: 22, priority: "urgent" },
  { id: "MR-701", customer: "周先生", topic: "美容師指定時段", waitingMinutes: 12, priority: "normal" },
  { id: "MR-702", customer: "張小姐", topic: "取消政策例外申請", waitingMinutes: 35, priority: "urgent" },
];

export const conversationLogs: ConversationLog[] = [
  { id: "CV-1120", customer: "王小姐", channel: "LINE", lastMessage: "請問明天下午還有小型犬洗澡嗎？", updatedAt: "2026-04-24 10:42" },
  { id: "CV-1121", customer: "陳先生", channel: "LINE", lastMessage: "入住前可以先試住 2 小時嗎？", updatedAt: "2026-04-24 10:31" },
  { id: "CV-1122", customer: "林小姐", channel: "LINE", lastMessage: "我家狗狗有皮膚病可以做 spa 嗎", updatedAt: "2026-04-24 10:10" },
];
