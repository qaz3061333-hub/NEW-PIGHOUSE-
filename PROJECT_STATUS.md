# PROJECT_STATUS.md

## 專案名稱

NEW-PIGHOUSE- / new-pighouse-pjdh

## 專案目標

本專案是寵物店用的官方 LINE 客服後台 MVP。

目前仍處於「沙盒與後台流程驗證階段」。第一階段目標不是直接接真 LINE，而是先把 AI 客服沙盒、資料分流、預約申請與後台人工處理流程做穩，之後再串接官方 LINE Messaging API、正式知識庫查詢、員工登入與 RLS 權限。

目前只做 LINE 客服後台方向；暫不做 FB、IG、POS、金流、自動排班。

## 使用者背景與操作原則

使用者是程式 0 經驗的小白，主要透過 ChatGPT + Codex + Vercel + Supabase + GitHub 完成開發。

操作指引必須白話、一次給 3～5 個具體小步驟；需要說明按鈕大約在哪裡。高風險操作要拆成更少步驟並逐步確認。

目前固定合作模式：

1. ChatGPT 先整理 Codex 指令，並明確說明「請開新任務」或「延續上一個任務」。
2. 使用者把指令貼給 Codex。
3. Codex 完成後，使用者可直接建立 PR。
4. 使用者回來說「PR 已建立，請去 GitHub 檢查」。
5. ChatGPT 檢查 GitHub 實際改了哪些檔案。
6. 若範圍正確，ChatGPT 可直接 merge PR。
7. merge 後使用者到 Vercel 等 Production / Current / Ready，再到正式站驗收。
8. 若需要 Supabase SQL，ChatGPT 需提供可直接貼到 SQL Editor 的 SQL 與操作步驟。

不要叫使用者重新建立 Vercel / Supabase / Next.js。

## 技術架構

- Frontend / Backend framework: Next.js 14.2.33
- Language: TypeScript
- Styling: Tailwind CSS
- Hosting: Vercel
- Database: Supabase
- Repository: GitHub repo `NEW-PIGHOUSE-`
- Vercel project: `new-pighouse-pjdh`
- Supabase project: `new-pighouse`
- 正式測試網址：`https://new-pighouse-pjdh.vercel.app`

## 目前重要限制

### 1. 仍是沙盒階段

目前不接真 LINE、不發送 LINE 訊息、不自動通知真客人、不把 Sandbox 資料偽裝成正式預約。

### 2. RLS / 權限仍是測試用

目前 Supabase policy 曾使用類似 `Allow anon full access`。這只適合 MVP 測試，不適合正式給員工或外部使用者使用。

正式接 LINE 或讓員工使用前，需要處理：

- 後台登入
- staff_users 或 Supabase Auth 設計
- RLS policy 收斂
- server-side API route 權限控管
- 操作紀錄與避免誤發訊息

### 3. 不要把 secret 貼到 ChatGPT / GitHub

- 不要把 service_role key 放到前端
- 不要把 LINE channel secret、access token、Gemini API key、OpenAI key 貼到 ChatGPT 或 GitHub
- `NEXT_PUBLIC_` 變數會暴露到前端，只能放公開型 key

## 已完成基礎功能

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

### 3. Supabase 專案與正確 URL

Supabase 專案已建立，Project URL 正確值為：

`https://iiwyaopmpdglpsnltaij.supabase.co`

注意：之前曾誤填成：

`https://iiwyaopmpdglpsnltajj.supabase.co`

錯誤差異在最後：

- 錯：`...psnltajj`
- 對：`...psnltaij`

這曾導致前端出現 `ERR_NAME_NOT_RESOLVED`。

### 4. Supabase 資料表

已透過 Supabase SQL Editor 成功建立 6 張表：

- customers
- messages
- knowledge_articles
- appointment_requests
- abnormal_alerts
- manual_reply_tasks

後續又為 `appointment_requests` 新增 `is_sandbox` 欄位與索引，詳見 Appointment Requests 最新狀態。

### 5. Vercel 環境變數

Vercel 已設定：

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- GEMINI_API_KEY
- GEMINI_MODEL

目前使用 Supabase Publishable / anon key，不使用 service_role key。

`GEMINI_MODEL` 已可透過 Vercel Environment Variables 調整模型，不需改程式碼。

### 6. Supabase 前端連線問題已修正

曾經出現：

`Supabase 讀取失敗，已使用 mock data。TypeError: Failed to fetch`

原因包含：

1. Vercel 的 NEXT_PUBLIC_SUPABASE_URL 曾誤填錯誤 Supabase URL
2. Codex 曾用 `new Function` + `https://esm.sh` 動態載入 Supabase SDK，不穩定
3. 後來已改成正式在 package.json dependencies 加入 `@supabase/supabase-js`
4. `lib/supabaseClient.ts` 已改用標準靜態匯入：

`import { createClient } from "@supabase/supabase-js";`

### 7. Knowledge Base 讀寫已驗證成功

已完成雙向驗證：

- 在 Supabase Table Editor 手動新增 `測試營業時間`
- 前端 Knowledge Base 成功讀到該筆資料
- 在前端 Knowledge Base 新增 `測試寫入`
- Supabase Table Editor 成功看到 `測試寫入`

目前可判定：

- Supabase read 成功
- Supabase write 成功
- Vercel env vars 正確
- frontend-to-Supabase 連線成功

但 Gemini 尚未接真實 Knowledge Base 回答。

### 8. Dashboard 三頁 Supabase 讀寫已驗證

以下頁面已接上 Supabase 真資料，不再使用 mock data：

- Appointment Requests
- Abnormal Alerts
- Manual Reply Tasks

已驗證：

- `appointment_requests` 可從 Supabase 讀取資料
- `appointment_requests.status` 可從前端更新，重新整理後仍保留
- 狀態值包含：pending / confirmed / proposed_new_time / rejected
- `abnormal_alerts` 可讀取
- `abnormal_alerts.is_resolved` 與 `resolved_at` 可更新並保留
- `manual_reply_tasks` 可讀取
- `manual_reply_tasks.is_replied` 與 `replied_at` 可更新並保留

## Conversation Logs / Gemini LINE 沙盒最新狀態

Conversation Logs 已升級為「LINE 沙盒對話模擬器」。

目前已完成：

- Gemini API 已接上
- Gemini API Key 由 Vercel Environment Variables 提供，不放前端、不貼 GitHub
- Gemini model 已改為可透過 Vercel `GEMINI_MODEL` 調整
- 沙盒會顯示客人訊息泡泡、系統回覆泡泡、系統判斷結果
- 系統判斷結果包含 intent、confidence、target_module、summary、extracted
- 不會真的送 LINE
- 不會寫入正式資料
- 只有在使用者按「建立沙盒預約申請」且時間有效時，才會寫入 Sandbox appointment_requests

Gemini 沙盒 intent 類型包含：

- appointment_request
- abnormal_alert
- knowledge_question
- manual_reply_task
- unknown

### Gemini 台灣時間理解

Gemini sandbox API route 會注入目前台灣時間：

- 時區：Asia/Taipei
- 目前日期
- 目前時間
- 目前星期

目前可理解：

- 今天
- 明天
- 後天
- 下週
- 下週三
- 上午 / 下午 / 晚上 / 中午

`extracted` 已新增：

- `time_status`: valid / past / unclear
- `needs_clarification`: boolean

若客人說過去時間，例如現在晚上 7 點卻約今天 6 點，系統會判斷需要重新確認，不能建立 Sandbox 預約。

只有在以下條件都成立時，才允許建立 Sandbox 預約：

- intent = appointment_request
- time_status = valid
- needs_clarification = false
- preferred_date 格式為 YYYY-MM-DD
- preferred_time 格式為 HH:mm

### Conversation Logs 多輪沙盒對話

已完成多輪對話記憶：

- 沙盒聊天不再只有一次來回
- 新訊息會 append 到聊天紀錄
- 前端會把 history 一起送給 API
- API 會正規化 history
- API 只取最近 10 則對話放入 Gemini prompt
- 有「清除沙盒對話」按鈕
- 已驗收：確認有上下文記憶功能

## Appointment Requests 最新狀態

### 1. Sandbox / 正式資料分流

`appointment_requests` 已新增：

```sql
alter table public.appointment_requests
add column if not exists is_sandbox boolean not null default false;

create index if not exists idx_appointment_requests_is_sandbox_requested_at
on public.appointment_requests (is_sandbox, requested_at desc);
```

此 SQL 已於 Supabase SQL Editor 執行成功。

Appointment Requests 頁面目前會：

- 顯示「正式 / Sandbox」來源欄
- Sandbox 資料列使用淡色背景
- 頁面上方提醒：`Sandbox 資料僅供測試，不代表正式預約，不會通知客人。`

### 2. Conversation Logs 可建立 Sandbox 預約

Conversation Logs 若判斷結果為 appointment_request 且時間有效，會顯示「建立沙盒預約申請」按鈕。

建立資料時：

- owner_name ← extracted.customer_name，缺值用 `Sandbox Customer`
- service ← extracted.service_item，缺值用 `Sandbox Service`
- pet_name ← `Sandbox Pet`
- requested_at ← preferred_date + preferred_time + Asia/Taipei 轉 ISO
- status ← `pending`
- is_sandbox ← true

Appointment Requests 頁面可看到該筆 Sandbox 預約。

### 3. Appointment Requests 基礎操作 v1

已完成且已驗收：

- 每筆資料有「查看詳情」按鈕
- 可展開 / 收合詳情
- 詳情顯示 id、來源、pet_name、service、owner_name、requested_at、status、is_sandbox
- Sandbox 詳情會提示：`這是 Sandbox 測試預約，不會通知客人。`
- 每筆資料有「刪除」按鈕
- Sandbox 顯示「刪除（Sandbox）」
- 刪除前會跳瀏覽器 confirm
- 取消不會刪除
- 確認後可刪除
- 刪除成功會從畫面移除並顯示成功訊息
- 已用 Sandbox 預約驗收刪除成功
- `lib/supabaseClient.ts` 已新增 DELETE method 支援

### 4. Appointment Requests 尚未完成

目前 status 下拉可以更新 DB，但還只是基礎狀態更新。

尚未完成：

- confirmed：確認預約後產生沙盒確認回覆文字
- proposed_new_time：選擇後跳出員工可填寫一個或多個可改約時間
- rejected：選擇後跳出拒絕原因欄位
- Appointment Requests 處理結果回寫到 Conversation Logs 沙盒對話
- 客人回覆新時間後覆蓋 / 更新原本預約申請

## Manual Reply Tasks 最新狀態

Manual Reply Tasks 已升級為「人工回覆工作台」第一版。

此版本仍不接 LINE、不接 OpenAI，只是先改善人工客服工作流程。

已完成：

- 任務編號不再作為主要欄位顯示
- 任務編號改放在「詳細資訊」摺疊區
- 頁面主要顯示客戶、來源渠道、主題、最後訊息、建議回覆重點、等待時間、優先度、狀態 / 操作
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

## 尚未完成的重要功能

### 1. Knowledge Base 尚未接 Gemini 真實回答

目前 Gemini 還沒有查真實 Knowledge Base。

未來正確流程應是：

客人問題 → 判斷 knowledge_question → 搜尋 Knowledge Base 相關資料 → 只把相關資料給 Gemini → 根據知識庫回答。

不要把整個知識庫無差別丟給 Gemini。

### 2. Abnormal Alerts 尚未接沙盒建立

目前 Gemini 可以判斷 abnormal_alert，但還沒有按鈕建立 Sandbox 異常提醒，也沒有異常處理回饋流程。

### 3. Manual Reply Tasks 尚未接沙盒建立

目前 Gemini 可以判斷 manual_reply_task，但還沒有完整沙盒任務建立與回饋流程。

### 4. 真 LINE 尚未接入

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

### 5. 多分店 API / KEY 設定頁尚未做

使用者有多間分店，每間 LINE 官方帳號可能不同。

未來需要設定頁管理分店 / channel / webhook / API key。

但目前先不要做正式 key 儲存，因為登入、權限與 secret 儲存安全還沒設計。

### 6. 後台登入與 RLS 尚未做

目前仍是 MVP 測試階段，不應直接給員工或外部使用者正式使用。

正式上線前仍需處理：

- 後台登入
- staff_users 或員工權限設計
- session / auth 流程
- RLS policy 收斂
- server-side API route 權限控管

### 7. 全站中文化尚未完成

目前部分頁面與欄位仍是英文，例如頁面名稱、status 值、priority 值等。

全站中文化可以做，但建議另開小範圍 PR；不要改 DB 實際儲存值，只做 UI 顯示映射。

## 重要 PR 紀錄

近期已完成並 merge：

- PR #12：第一版 AI / LINE 回覆沙盒模擬
- PR #13：Gemini 沙盒判斷 v1
- PR #15：Gemini model 改成可設定
- PR #16：appointment_requests 新增 is_sandbox SQL + UI 顯示正式 / Sandbox
- PR #17：Conversation Logs 可建立 Sandbox 預約申請
- PR #18：Gemini 沙盒時間理解 v1
- PR #19：Conversation Logs 沙盒多輪對話記憶 v1
- PR #20：Appointment Requests 查看詳情 + 安全刪除

注意：

- PR #14：舊的重複 Gemini PR，已關閉，不要用
- PR #7：舊的 Dashboard/Supabase 強化 PR，仍開著但暫時不要處理，之前有 build / dependency 問題，不要誤合併

## 建議下一步

建議下一個最小風險任務是：

### Appointment Requests confirmed 流程 v1

目標：

- 當員工把 Sandbox 預約 status 改成 confirmed 時，產生一段沙盒確認回覆文字
- 例如：`已確認您的預約：日期、時間、服務項目。這是沙盒模擬，不會真的通知客人。`
- 不送 LINE
- 不回寫 Conversation Logs
- 先只在 Appointment Requests 頁面顯示確認訊息
- 下一階段再處理 proposed_new_time / rejected / 回寫沙盒對話

原因：

confirmed 流程最安全，通常不需要新增資料表欄位，適合作為下一個小 PR。

暫時不要一次做：

- confirmed + proposed_new_time + rejected
- Appointment Requests 回寫 Conversation Logs
- 真 LINE 發送
- Gemini 查知識庫

## 操作原則

每次 Codex 任務必須小範圍：

- 一次只改一個功能或一個錯誤
- 不要一次接 LINE + Gemini + Supabase + RLS
- 不要重構整個專案
- 不要刪除既有功能
- 不要硬編 API key
- 不要直接改 main
- 先建立 PR
- 看過 Files changed 後再 merge
- merge 後等 Vercel Production / Current / Ready
- 再測正式網址

## 已知排錯紀錄

### next.config.ts 錯誤

曾出現：

`Configuring Next.js via next.config.ts is not supported`

原因：Next.js 14 不支援 `next.config.ts`。

已修正為：`next.config.js`。

### Supabase URL 錯誤

曾出現：`ERR_NAME_NOT_RESOLVED`。

原因：Supabase Project URL 拼錯。

正確：`https://iiwyaopmpdglpsnltaij.supabase.co`

### Supabase SDK 載入錯誤

曾用 `new Function(...)` 與 `https://esm.sh/@supabase/supabase-js`。

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

### Gemini model 不可用 / quota 錯誤

曾遇到：

- `gemini-1.5-flash is not found`
- `gemini-2.0-flash is no longer available to new users`
- quota / RESOURCE_EXHAUSTED

已將模型改成由 Vercel `GEMINI_MODEL` 設定。若模型不可用，優先到 Vercel 調整 `GEMINI_MODEL`，不一定要改程式。

### 測試資料重複

曾因重複執行測試 seed SQL，導致 appointment_requests / manual_reply_tasks 出現重複測試資料。

這不代表功能錯誤，但正式整理前可另開清理測試資料任務。

## 給新對話的接手提醒

如果把本專案交給新的 ChatGPT 對話，請先貼上本 PROJECT_STATUS.md。

新對話應從以下狀態接手：

- Knowledge Base 的 Supabase 讀寫已成功，但尚未接 Gemini 真實回答
- Appointment Requests 可讀寫、可建立 Sandbox 預約、可看詳情、可刪除 Sandbox 資料
- Conversation Logs 已具備 Gemini 沙盒、多輪對話、台灣時間理解、建立 Sandbox 預約能力
- Abnormal Alerts 可讀寫，但尚未接沙盒建立流程
- Manual Reply Tasks 已升級人工回覆工作台 v1，但尚未接沙盒建立流程
- 目前正式站是 `https://new-pighouse-pjdh.vercel.app`
- 不要重新建立 Vercel
- 不要重新建立 Supabase
- 不要重新建立 Next.js 專案
- 不要再修已完成的 next.config.js 問題
- 不要再處理已解決的 Supabase URL 問題
- 不要把 LINE / Gemini / RLS / 中文化混在同一個任務
- 不要一次給使用者太多步驟

新對話若要驗證是否理解，應能回答：

1. Conversation Logs 沙盒和 Appointment Requests 的關係是什麼？
2. 沙盒建立的預約如何避免被當成正式預約？
3. 為什麼現在不能直接接 LINE 發訊息？
4. Gemini 現在是否已經能查真實 Knowledge Base？如果不能，缺什麼？
5. appointment_requests 目前新增過哪個欄位？用途是什麼？
6. Conversation Logs 是否支援多輪對話？history 如何被使用？
7. Appointment Requests 的 status 下拉目前做到哪裡？還缺什麼？
8. 下一個最小風險任務是什麼？為什麼？
9. PR #14 與 PR #7 是什麼狀態？為什麼不能隨便處理？
10. 如果使用者要求 Gemini 查知識庫 + 預約改時間 + 真 LINE 發送一起做，應該拒絕一次做完並拆小任務。
