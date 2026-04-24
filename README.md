# Pet Care CS Backend MVP

Next.js + TypeScript + Tailwind CSS 建立的客服後台 MVP。
目前支援 Supabase（環境變數未設定時會自動 fallback 到 mock data，不會整站壞掉）。

## 已完成頁面

- Dashboard
- Knowledge Base 知識庫管理（新增 / 編輯 / 啟用停用）
- Appointment Requests 預約申請（更新狀態）
- Abnormal Alerts 異常提醒（標記已處理）
- Manual Reply Tasks 需人工回覆（標記已回覆）
- Conversation Logs 對話紀錄

## 啟動方式

```bash
npm install
npm run dev
```

開啟 <http://localhost:3000>

## Supabase 設定

1. 在 Supabase SQL Editor 執行 `supabase/schema.sql`。
2. 建立 `.env.local`（可參考 `.env.example`）：
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. 在 Vercel Project Settings → Environment Variables 設定同樣兩個變數。

> 請勿在前端使用 `service_role` key。

## 說明

- 若未設定 Supabase 環境變數，前端會顯示提示並使用 `lib/mockData.ts`。
- 目前未串接 LINE，也未串接 OpenAI。
