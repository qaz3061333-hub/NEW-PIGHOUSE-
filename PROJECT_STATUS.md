# PROJECT_STATUS.md

## 專案名稱

NEW-PIGHOUSE- / new-pighouse-pjdh

## 專案目標

本專案是寵物店用的官方 LINE 客服後台 MVP。

第一階段目標是建立一個可用的後台系統，之後再串接官方 LINE Messaging API 與 OpenAI，讓 LINE 客人訊息可以被分類、查詢知識庫、建立預約申請、產生異常提醒或人工回覆任務。

目前只做 LINE，不做 FB、IG、POS、金流、自動排班。

## 使用者背景

使用者是程式 0 經驗的小白，主要透過 ChatGPT + Codex + Vercel + Supabase + GitHub 完成開發。

操作指引必須一次給 3～5 個具體小步驟；若是高風險操作，仍應拆成更少步驟並逐步確認。

## 技術架構

- Frontend / Backend framework: Next.js 14.2.33
- Language: TypeScript
- Styling: Tailwind CSS
- Hosting: Vercel
- Database: Supabase
- Repository: GitHub repo `NEW-PIGHOUSE-`
- Vercel project: `new-pighouse-pjdh`
- Supabase project: `new-pighouse`

## 目前已完成

### 1. Next.js 後台 MVP

已建立六個後台頁面：

- Dashboard
- Knowledge Base
- Appointment Requests
- Abnormal Alerts
- Manual Reply Tasks
- Conversation Logs

### 2. Vercel 部署

Vercel 已成功部署正式測試網站。

固定測試專案為：

- Vercel project: `new-pighouse-pjdh`
- 正式測試網址：`https://new-pighouse-pjdh.vercel.app`
- 測試時請使用 Production / Current / Ready 的部署網址
- 不要誤用舊的 Preview deployment

### 3. Supabase 專案

Supabase 專案已建立，Project URL 正確值為：

`https://iiwyaopmpdglpsnltaij.supabase.co`

注意：之前曾誤填成：

`https://iiwyaopmpdglpsnltajj.supabase.co`

錯誤差異在最後：

- 錯：`...psnltajj`
- 對：`...psnltaij`

這曾導致前端出現：

`ERR_NAME_NOT_RESOLVED`

### 4. Supabase 資料表

已透過 Supabase SQL Editor 成功建立 6 張表：

- customers
- messages
- knowledge_articles
- appointment_requests
- abnormal_alerts
- manual_reply_tasks

### 5. Vercel 環境變數

Vercel 已設定：

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY

目前使用 Supabase Publishable key，不使用 service_role key。

重要安全提醒：

- 不要把 service_role key 放到前端
- 不要把 secret key、JWT secret、service_role key 貼到 ChatGPT 或 GitHub
- NEXT_PUBLIC_ 變數會暴露到前端，因此只能放公開型 key

### 6. Supabase 前端連線問題已修正

曾經出現：

`Supabase 讀取失敗，已使用 mock data。TypeError: Failed to fetch`

原因包含：

1. Vercel 的 NEXT_PUBLIC_SUPABASE_URL 曾誤填錯誤 Supabase URL
2. Codex 曾用 `new Function` + `https://esm.sh` 動態載入 Supabase SDK，不穩定
3. 後來已改成正式在 package.json dependencies 加入 `@supabase/supabase-js`
4. lib/supabaseClient.ts 已改用標準靜態匯入：

`import { createClient } from "@supabase/supabase-js";`

### 7. Knowledge Base 讀寫已驗證成功

已完成雙向驗證：

- 在 Supabase Table Editor 手動新增 `測試營業時間`
- 前端 Knowledge Base 成功讀到該筆資料
- 在前端 Knowledge Base 新增 `測試寫入`
- Supabase Table Editor 成功看到 `測試寫入`

因此目前可判定：

- Supabase read 成功
- Supabase write 成功
- Vercel env vars 正確
- frontend-to-Supabase 連線成功

### 8. Appointment / Alerts / Manual Reply Supabase 讀寫已驗證成功

已於正式站 `new-pighouse-pjdh.vercel.app` 驗證以下頁面皆已接上 Supabase 真資料，不再使用 mock data：

- Appointment Requests
- Abnormal Alerts
- Manual Reply Tasks

已完成驗證：

- `appointment_requests` 可從 Supabase 讀取資料
- `appointment_requests.status` 可從前端更新，重新整理後仍保留
- 已確認狀態值包含：
  - pending
  - confirmed
  - proposed_new_time
  - rejected
- `abnormal_alerts` 可從 Supabase 讀取資料
- `abnormal_alerts.is_resolved` 與 `resolved_at` 可從前端更新，重新整理後仍保留
- `manual_reply_tasks` 可從 Supabase 讀取資料
- `manual_reply_tasks.is_replied` 與 `replied_at` 可從前端更新，重新整理後仍保留

### 9. Manual Reply Tasks 已升級為人工回覆工作台 v1

Manual Reply Tasks 已改為「人工回覆工作台」第一版。

此版本仍不接 LINE、不接 OpenAI，只是先改善人工客服工作流程。

已完成：

- 任務編號不再作為主要欄位顯示
- 任務編號改放在「詳細資訊」摺疊區
- 頁面主要顯示：
  - 客戶
  - 來源渠道
  - 主題
  - 最後訊息
  - 建議回覆重點
  - 等待時間
  - 優先度
  - 狀態 / 操作
- 新增「複製回覆重點」按鈕
- 保留「標記已回覆」功能
- 已驗證「標記已回覆」後重新整理仍保留
- 已驗證「複製回覆重點」功能可用

已新增或使用的 `manual_reply_tasks` 欄位：

- source_channel
- customer_line_user_id
- last_message
- reply_note
- replied_at

相關 SQL：

- `supabase/test_seed_manual_reply_workbench.sql`

該 SQL 已於 Supabase SQL Editor 執行成功，結果顯示：

`Success. No rows returned`

### 10. 目前正式站狀態

正式測試網址：

`https://new-pighouse-pjdh.vercel.app`

目前 Vercel project：

`new-pighouse-pjdh`

目前 Production / Current / Ready 已確認成功部署至 main。

正式站目前已確認：

- Supabase env vars 正常
- 不再顯示 mock data 警告
- Appointment Requests 可讀寫
- Abnormal Alerts 可讀寫
- Manual Reply Tasks / 人工回覆工作台可讀寫

## 目前重要限制

### 1. RLS / 權限目前仍是測試用

目前 Supabase policy 曾使用類似：

`Allow anon full access`

這只適合 MVP 測試，不適合正式上線。

正式接 LINE 或讓員工使用前，需要調整安全設計，例如：

- 後台登入
- staff_users
- 只允許登入員工操作後台
- 限制 public anon key 權限
- 避免任何人只靠前端 key 就能改資料

### 2. 尚未接 LINE

目前還沒有接 LINE Messaging API。

尚未完成：

- LINE webhook endpoint
- LINE channel secret
- LINE access token
- message signature validation
- customer 訊息寫入 messages
- 預約訊息建立 appointment_requests
- AI 自動回覆 LINE
- 系統內直接送出 LINE 訊息
- 跳轉官方 LINE 對話連結

### 3. 尚未接 OpenAI

目前尚未接 OpenAI API。

尚未完成：

- 問題分類
- 知識庫查詢後產生回覆
- 預約需求解析
- 客訴 / 情緒字眼判斷
- 低信心轉人工
- AI 潤飾人工回覆內容

### 4. 尚未做後台登入與員工權限

目前仍是 MVP 測試階段，不應直接給員工或外部使用者正式使用。

正式上線前仍需處理：

- 後台登入
- staff_users 或員工權限設計
- session / auth 流程
- RLS policy 收斂
- server-side API route 權限控管

### 5. 尚未做全站中文化

目前部分頁面與欄位仍是英文，例如：

- Dashboard
- Knowledge Base
- Appointment Requests
- Abnormal Alerts
- Manual Reply Tasks
- Conversation Logs
- status 值如 pending / confirmed / proposed_new_time / rejected
- priority 值如 normal / urgent

全站中文化可以做，但建議另開小範圍 PR，不要和 LINE / OpenAI / 權限整理混在一起。

## 建議下一步

下一步不要急著接 OpenAI。

建議順序：

1. 先做後台安全整理與登入設計
2. 修正側邊選單 active 狀態顯示不準的問題
3. 可另開 PR 做全站中文化
4. 接 LINE webhook，讓系統收到真實 LINE 訊息與 userId
5. 把 LINE 訊息寫入 customers / messages
6. 將真實訊息轉成 appointment_requests / manual_reply_tasks / abnormal_alerts
7. 最後再接 OpenAI 分類與回覆

## 下一個 Codex 任務建議

目前可選下一個小任務：

### A. 修正側邊選單 active 狀態

目前曾觀察到正式站內容在 Manual Reply Tasks，但左側高亮可能停在其他頁面。

建議 Codex 任務：

- 檢查側邊選單 active 判斷
- 讓目前頁面正確高亮
- 不改資料功能
- 不改 Supabase client
- 不接 LINE / OpenAI
- 建立 PR，不直接合併

### B. 全站中文化第一階段

建議 Codex 任務：

- 只改 UI 顯示文字
- 不改資料表欄位名稱
- 不改 status 實際儲存值
- 不改 Supabase 寫回邏輯
- 將 status / priority 做中文顯示映射
- 建立 PR，不直接合併

### C. 後台登入與 RLS 安全設計

建議先討論設計，不要直接讓 Codex 大改。

需要先決定：

- 使用 Supabase Auth 或自建 staff_users
- 員工帳號如何建立
- 哪些資料表可讀寫
- RLS policy 如何從 anon full access 收斂
- 哪些操作要移到 server-side API route

## 操作原則

每次 Codex 任務必須小範圍：

- 一次只改一個功能或一個錯誤
- 不要一次接 LINE + OpenAI + Supabase
- 不要重構整個專案
- 不要刪除既有功能
- 不要硬編 API key
- 不要直接改 main
- 先建立 PR
- 看過 Files changed 後再 merge
- merge 後等 Vercel Production Current Ready
- 再測正式網址

## 已知排錯紀錄

### next.config.ts 錯誤

曾出現：

`Configuring Next.js via next.config.ts is not supported`

原因：

Next.js 14 不支援 `next.config.ts`

已修正為：

`next.config.js`

### Supabase URL 錯誤

曾出現：

`ERR_NAME_NOT_RESOLVED`

原因：

Supabase Project URL 拼錯。

正確：

`https://iiwyaopmpdglpsnltaij.supabase.co`

### Supabase SDK 載入錯誤

曾用：

`new Function(...)`
`https://esm.sh/@supabase/supabase-js`

此方式不穩定，已改為 package dependency + static import。

### Vercel 正式站仍顯示 mock data 警告

曾出現 Vercel Environment Variables 已存在，但正式站仍顯示：

`Supabase 尚未設定環境變數，現在使用 mock data。`

處理方式：

- 到 Vercel `new-pighouse-pjdh` 的 Deployments
- 找 Production / Current / Ready
- 使用 Redeploy
- 不勾選 `Use existing Build Cache`
- 等新 Production / Current / Ready 完成後，正式站恢復讀取 Supabase 真資料

### 測試資料重複

曾因重複執行測試 seed SQL，導致 appointment_requests / manual_reply_tasks 出現重複測試資料。

這不代表功能錯誤，但正式整理前可另開清理測試資料任務。

## 給新對話的接手提醒

如果把本專案交給新的 ChatGPT 對話，請先貼上本 PROJECT_STATUS.md。

新對話應從以下狀態接手：

- Knowledge Base 的 Supabase 讀寫已成功
- Appointment Requests 的 Supabase 讀寫已成功
- Abnormal Alerts 的 Supabase 讀寫已成功
- Manual Reply Tasks 已升級為人工回覆工作台 v1
- Manual Reply Tasks 的 Supabase 讀寫已成功
- 目前正式站是 `https://new-pighouse-pjdh.vercel.app`
- 不要重新建立 Vercel
- 不要重新建立 Supabase
- 不要重新建立 Next.js 專案
- 不要再修已完成的 next.config.js 問題
- 不要再處理已解決的 Supabase URL 問題
- 不要把 LINE / OpenAI / RLS / 中文化混在同一個任務
- 不要一次給使用者太多步驟

完成任何新任務後請：

1. 建立 PR，不要直接合併
2. 列出修改檔案
3. 確認沒有改到不相關功能
4. 先檢查 Files changed
5. merge 後等待 Vercel Production / Current / Ready
6. 再測正式網址
