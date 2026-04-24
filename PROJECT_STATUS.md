# PROJECT_STATUS.md

## 專案名稱

NEW-PIGHOUSE- / new-pighouse-pjdh

## 專案目標

本專案是寵物店用的官方 LINE 客服後台 MVP。

第一階段目標是建立一個可用的後台系統，之後再串接官方 LINE Messaging API 與 OpenAI，讓 LINE 客人訊息可以被分類、查詢知識庫、建立預約申請、產生異常提醒或人工回覆任務。

目前只做 LINE，不做 FB、IG、POS、金流、自動排班。

## 使用者背景

使用者是程式 0 經驗的小白，主要透過 ChatGPT + Codex + Vercel + Supabase + GitHub 完成開發。

操作指引必須一次只給 1～3 個具體步驟，不要一次給太多內容。

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

### 3. 尚未接 OpenAI

目前尚未接 OpenAI API。

尚未完成：

- 問題分類
- 知識庫查詢後產生回覆
- 預約需求解析
- 客訴 / 情緒字眼判斷
- 低信心轉人工

### 4. 目前 Appointment / Alerts / Manual Reply 可能仍需逐頁驗證

Knowledge Base 已確認讀寫成功。

但以下頁面仍需逐一確認 CRUD / 狀態更新是否真的接 Supabase：

- Appointment Requests
- Abnormal Alerts
- Manual Reply Tasks
- Conversation Logs

## 建議下一步

下一步不要急著接 LINE。

建議順序：

1. 先檢查 Appointment Requests 是否能從 Supabase 讀取 / 更新狀態
2. 檢查 Abnormal Alerts 是否能標記已處理
3. 檢查 Manual Reply Tasks 是否能標記已回覆
4. 若上述都成功，再做後台安全整理
5. 接著才接 LINE webhook
6. 最後才接 OpenAI 分類與回覆

## 下一個 Codex 任務建議

請先建立測試資料與驗證其他頁面的 Supabase CRUD，不要接 LINE / OpenAI：

- appointment_requests 新增測試資料
- abnormal_alerts 新增測試資料
- manual_reply_tasks 新增測試資料
- 確認前端頁面能讀取 Supabase
- 確認狀態按鈕能寫回 Supabase
- 不要改 UI
- 不要重構
- 不要使用 service_role
- 建立 PR，不直接合併

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

## 給新對話的接手提醒

如果把本專案交給新的 ChatGPT 對話，請先貼上本 PROJECT_STATUS.md。

新對話應從以下狀態接手：

- Knowledge Base 的 Supabase 讀寫已成功
- 接下來應驗證 Appointment Requests、Abnormal Alerts、Manual Reply Tasks 的 Supabase 讀寫
- 不要重新建立 Vercel
- 不要重新建立 Supabase
- 不要重新建立 Next.js 專案
- 不要再修已完成的 next.config.js 問題
- 不要再處理已解決的 Supabase URL 問題
- 不要一次給使用者太多步驟

完成後請：
1. 建立 PR，不要直接合併
2. 列出修改檔案
3. 確認沒有改功能程式碼
