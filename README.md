# Pet Care CS Backend MVP

Next.js + TypeScript + Tailwind CSS 建立的客服後台 MVP（目前全部使用 mock data）。

## 已完成頁面

- Dashboard
- Knowledge Base 知識庫管理
- Appointment Requests 預約申請
- Abnormal Alerts 異常提醒
- Manual Reply Tasks 需人工回覆
- Conversation Logs 對話紀錄

## 啟動方式

```bash
npm install
npm run dev
```

開啟 <http://localhost:3000>

## 後續接 Supabase（建議步驟）

1. 建立 Supabase 專案與資料表：
   - `knowledge_articles`
   - `appointment_requests`
   - `abnormal_alerts`
   - `manual_reply_tasks`
   - `conversation_logs`
2. 安裝 `@supabase/supabase-js`，建立 `lib/supabase.ts`。
3. 以 Server Components / Route Handlers 將 `lib/mockData.ts` 替換為 Supabase 查詢。
4. 新增 `.env.local`：
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. 在各頁面補上 CRUD（新增、更新狀態、刪除）流程。

> 注意：目前專案沒有使用任何真實 API key。
