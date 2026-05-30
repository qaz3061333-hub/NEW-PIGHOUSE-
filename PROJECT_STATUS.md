# PROJECT_STATUS.md

## 專案名稱

NEW-PIGHOUSE- / new-pighouse-pjdh

## 專案目標

本專案是寵物店用的官方 LINE 客服後台 MVP。

目前仍處於「沙盒與後台流程驗證階段」。第一階段目標不是直接接真 LINE，而是先把 AI 客服沙盒、資料分流、預約申請、異常提醒、人工回覆與後台人工處理流程做穩，之後再串接官方 LINE Messaging API、正式知識庫查詢、員工登入與 RLS 權限。

目前只做 LINE 客服後台方向；暫不做 FB、IG、POS、金流、自動排班。

## Customer Service Triage MVP v1 方向更新

主線已收斂為「寵物店 LINE 客服分流系統」，不是複雜線上預約系統。Conversation Logs sandbox 的核心應先處理重複問題自動查 active Knowledge Base 回覆，並把預約、問空檔、改約、取消、客訴、退款、異常、高風險、AI 不確定、KB 找不到等情境建立 Manual Reply Task，避免自動回覆後被視為已讀而漏處理。

目前仍是 sandbox：不接真 LINE、不送 LINE、不寫正式 Supabase `messages`、不改 Supabase schema、不新增 migration / SQL、不改 env / RLS。預約在目前 MVP 只是 `human_required` 的一種人工待辦，不再作為 Conversation Logs sandbox 主流程。

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

### 4. Archive Schema Planning v1

本段是未來正式封存前的 schema 規劃文件。本次只做文件規劃，尚未實作，不改 Supabase schema，不新增 table，不新增 migration，不做 cron，不做 Edge Function，也不做任何真封存或刪除。

#### 為什麼先規劃 schema，不直接做每日封存

目前沒有專業維護團隊，資料狀態混亂比資料量大更危險。資料多一點還可以慢慢整理，但如果狀態欄位各自定義、沒有 audit log、沒有處理備註，之後會很難判斷一筆事件到底是已處理、誤判、已忽略，還是還在追蹤中。

如果太早做自動刪除或自動搬資料，未來遇到客訴、退款、受傷、流血、人工處理紀錄時，可能追不回當時的對話與處理脈絡。先規劃欄位與生命週期，之後再決定是否改 schema，比直接開發每日封存安全。

現階段仍不做物理刪除。未來即使有刪除功能，也應先 soft delete，不應直接物理刪除。

#### 事件生命週期標準

未來各事件表應盡量共用相同狀態語意，避免每個頁面各自發明狀態。

- `open`：待處理
- `in_progress`：處理中
- `resolved`：已處理
- `archived`：已封存
- `ignored`：不處理 / 已忽略

#### 未來建議新增的共通欄位（尚未實作）

以下是未來事件表可能需要的共通欄位，本次沒有新增，也不代表下一步一定要立刻 migration。

- `resolved_at`：處理完成時間
- `resolved_by`：處理人員 ID 或名稱
- `resolution_note`：處理備註
- `archive_status`：封存狀態，例如 `active` / `archive_candidate` / `archived` / `archive_blocked`
- `archived_at`：封存時間
- `archive_batch_id`：封存批次 ID
- `archive_reason`：封存原因
- `audit_log_id`：對應稽核紀錄
- `deleted_at`：軟刪除時間，只保留未來擴充，不建議目前使用
- `updated_by`：最後更新人員
- `last_status_changed_at`：最後狀態變更時間

`deleted_at` 不等於真的刪除，只代表資料被標記為軟刪除。高風險事件不可只靠 `resolved_at` 自動封存，必須有人工複查、處理備註與 audit log。

#### 不同事件表的規劃方向（尚未實作）

`manual_reply_tasks` 未來建議欄位：

- `is_replied`
- `replied_at`
- `reply_note`
- `resolved_at`
- `resolved_by`
- `resolution_note`
- `archive_status`
- `archived_at`
- `archive_batch_id`

封存條件建議：已回覆、有處理備註、超過 24～48 小時、沒有待追蹤事項。

`abnormal_alerts` 未來建議欄位：

- `is_resolved`
- `resolved_at`
- `resolved_by`
- `resolution_note`
- `severity`
- `follow_up_required`
- `follow_up_at`
- `archive_status`
- `archived_at`
- `archive_batch_id`

封存條件建議：即使已處理，也應先進 `needs_review`；高風險、受傷、流血、退款、客訴不可自動封存；必須有處理備註與人工複查。

`appointment_requests` 未來建議欄位：

- `status`
- `confirmed_at`
- `rejected_at`
- `completed_at`
- `resolved_at`
- `archive_status`
- `archived_at`
- `archive_batch_id`

封存條件建議：`confirmed` / `rejected` / `completed` 且超過 24～48 小時才可考慮封存；`pending` 不可封存。

`knowledge_gap_events` 或未來正式知識缺口表：目前 Knowledge Gap 還是 localStorage 沙盒，尚未正式 Supabase table。未來若正式化，建議欄位：

- `normalized_question`
- `representative_message`
- `suggested_title`
- `suggested_category`
- `count`
- `status`
- `first_seen_at`
- `last_seen_at`
- `resolved_at`
- `resolved_by`
- `archive_status`
- `archived_at`

封存條件建議：`status = added` 或 `ignored` 才可封存；`open` 不可封存。

`messages` / conversation logs 是最敏感的紀錄，不建議自動刪除。未來建議欄位：

- `conversation_id`
- `customer_id`
- `source_channel`
- `sender_type`
- `content`
- `ai_intent`
- `ai_summary`
- `reply_policy_mode`
- `sent_to_line`
- `sent_at`
- `archive_status`
- `archived_at`
- `audit_log_id`

封存條件建議：對話可以被後台預設隱藏，但不建議自動物理刪除。若涉及客訴、異常、退款、人工介入，必須保留 audit log。

#### event_audit_logs 未來規劃

`event_audit_logs` 未來可能是獨立資料表，但本次不建立。

建議欄位：

- `id`
- `event_type`
- `event_id`
- `action`
- `old_status`
- `new_status`
- `actor_type`
- `actor_id`
- `actor_name`
- `source`
- `note`
- `created_at`
- `metadata`

Audit log 是未來追查用，不應每日清除。任何狀態變更、人工處理、AI 分流、LINE 發送、封存動作都應留下 audit log。沒有 audit log 之前，不應做物理刪除。

#### 未來每日封存流程草案（不是現在）

以下只是未來流程草案，不代表現在要開發。

1. Vercel Cron 或 Supabase Edge Function 在每日台灣時間 00:00 觸發
2. 掃描符合封存條件的事件
3. 排除高風險或需要複查事件
4. 寫入 audit log
5. 標記原事件 `archive_status = archived`
6. 寫入 `archived_at` 與 `archive_batch_id`
7. 後台預設不顯示 `archived`
8. 需要時可用封存查詢頁找回

台灣 00:00 約等於 UTC 前一天 16:00，未來若用 Vercel Cron 要注意時區。排程失敗時不能刪資料；封存失敗時應保留 `active` 狀態並記錄錯誤。

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


### Conversation Logs：客人接受員工改約後回寫原 Sandbox 預約（已完成）

已完成並驗收：

- 在「Appointment Requests 沙盒回寫訊息」中，僅 `appointment_status = proposed_new_time` 卡片顯示「模擬客人回覆」
- 可輸入如「好，明天下午三點可以」
- 透過 server-side Gemini API route 判斷客人是否接受改約
- 若 `success = true` 且 `requested_at_iso` 有效，會 PATCH 原本 appointment request
- PATCH 條件：`id + is_sandbox = true`
- 更新 `requested_at`
- `status` 改回 `pending`
- 不會自動 `confirmed`，仍需員工最後確認
- 不寫 Supabase `messages`
- 不送 LINE
- 不通知真客人

### Conversation Logs：客人主動改已確認預約（Sandbox）（已完成）

已完成並驗收：

- Conversation Logs 已新增「客人主動改已確認預約（Sandbox）」區塊
- 可選擇一筆 `is_sandbox = true` 且 `status = confirmed` 的預約
- 可輸入如「抱歉我這個時間突然有事，可以改五點嗎？」
- 透過 server-side Gemini API route 判斷是否為客人主動改約
- 若 `success = true` 且 `requested_at_iso` 有效，會 PATCH 原本 appointment request
- PATCH 條件：`id + is_sandbox = true + status = confirmed`
- 更新 `requested_at`
- `status` 改回 `pending`（不自動 confirmed）
- 已新增 localStorage helper：`lib/sandboxCustomerRescheduleEvents.ts`
- localStorage key：`new_pighouse_sandbox_customer_reschedule_events_v1`
- Appointment Requests 會顯示提示「客人主動要求改約，不是新預約。」並顯示原時間與新時間
- 不寫 Supabase `messages`
- 不送 LINE
- 不通知真客人

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

### 4. Appointment Requests confirmed 沙盒處理流程（已完成）

當 Sandbox 預約 status = `confirmed` 時：

- 該列下方會直接顯示「Sandbox 確認預約回覆」
- 不需要按「查看詳情」
- 可按「確認送出沙盒回覆」
- 會回寫到 Conversation Logs 的 localStorage 沙盒事件
- 不送 LINE
- 不寫 Supabase `messages`
- 不通知真客人

### 5. Appointment Requests proposed_new_time Gemini 沙盒改約流程（已完成）

當 Sandbox 預約 status = `proposed_new_time` 時：

- 該列下方會直接顯示「Gemini 沙盒改約回覆」
- 員工可輸入自然語句（例如「明天3點」「後天三點」）
- 透過 server-side API route 呼叫 Gemini
- Gemini 產生 `interpreted_time` 與 `customer_reply`
- 可按「確認送出沙盒回覆」
- 會回寫到 Conversation Logs 的 localStorage 沙盒事件
- 不送 LINE
- 不寫 Supabase `messages`
- 不通知真客人

### 6. Appointment Requests rejected Gemini 沙盒拒絕流程（已完成）

當 Sandbox 預約 status = `rejected` 時：

- 該列下方會直接顯示「Gemini 沙盒拒絕回覆」
- 員工可輸入拒絕原因
- 透過 server-side API route 呼叫 Gemini
- Gemini 產生禮貌拒絕回覆 `customer_reply`
- 可按「確認送出沙盒回覆」
- 會回寫到 Conversation Logs 的 localStorage 沙盒事件
- 不送 LINE
- 不寫 Supabase `messages`
- 不通知真客人

### 7. Appointment Requests → Conversation Logs 沙盒回寫（已完成）

已新增 localStorage helper：

- `lib/sandboxConversationEvents.ts`

localStorage key：

- `new_pighouse_sandbox_conversation_events_v1`

目前 confirmed / proposed_new_time / rejected 的沙盒送出結果都會寫入 localStorage，Conversation Logs 頁面會顯示「Appointment Requests 沙盒回寫訊息」，且可清除這批回寫資料。

此機制是同一瀏覽器內的前端沙盒事件：

- 不寫 Supabase `messages`
- 不送 LINE
- 不跨裝置同步

### 8. Appointment Requests「查看詳情」目前定位

- 「查看詳情」功能仍保留
- 目前只顯示基本資料：id、來源、pet_name、service、owner_name、requested_at、status、is_sandbox、Sandbox 提醒
- confirmed / proposed_new_time / rejected 的主要操作已改為選擇 status 後直接在列下方顯示
- 不再把主要操作藏在查看詳情裡


### 9. 客人接受員工改約與客人主動改約（Sandbox）同步狀態（已完成）

已完成並驗收：

- 針對 `proposed_new_time` 沙盒回寫卡片，客人接受改約後可回寫更新原預約時間
- 針對 `confirmed` Sandbox 預約，客人主動要求改時間時可回寫更新原預約時間
- 以上兩條流程都僅允許更新 `is_sandbox = true` 的原始預約
- 兩條流程都會把 `status` 改回 `pending`，交由員工最後確認
- 兩條流程都不寫 Supabase `messages`、不送 LINE、不通知真客人

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

### 2. Abnormal Alerts 尚未接沙盒建立與回饋流程

目前 Gemini 可以判斷 abnormal_alert，但還沒有按鈕建立 Sandbox 異常提醒，也沒有異常處理回饋流程。

### 3. Manual Reply Tasks 尚未接沙盒建立與回饋流程

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
- 不接 webhook（目前階段）
- 不發送真 LINE（目前階段）
- 不通知真客人（目前階段）

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
- PR #45：Archive Policy v1 + Sandbox Archive Preview v1

注意：

- PR #14：舊的重複 Gemini PR，已關閉，不要用
- PR #7：舊的 Dashboard/Supabase 強化 PR，仍開著但暫時不要處理，之前有 build / dependency 問題，不要誤合併

## 建議下一步

下一個最小風險功能任務：

### Archive Schema Review v1

原因：

Archive Schema Planning v1 只是文件規劃，仍不代表要馬上改 schema。下一步應該先審查目前 Supabase schema 是否已有類似欄位，再決定是否需要 migration。真正改 schema 前，必須先備份與人工確認。

邊界：

- 不改 schema
- 不新增 table
- 不新增 migration
- 不做 cron
- 不做物理刪除
- 不接 LINE

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
- Appointment Requests 可讀寫、可建立 Sandbox 預約、可看詳情、可刪除 Sandbox 資料，且已完成客人接受改約/主動改約回寫原預約流程
- Conversation Logs 已具備 Gemini 沙盒、多輪對話、台灣時間理解、建立 Sandbox 預約能力，且已完成兩種改約回寫驗收
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
8. 下一個最小風險任務是「Abnormal Alerts 沙盒建立與處理回饋 v1」嗎？為什麼？
9. PR #14 與 PR #7 是什麼狀態？為什麼不能隨便處理？
10. 如果使用者要求 Gemini 查知識庫 + 預約改時間 + 真 LINE 發送一起做，應該拒絕一次做完並拆小任務。


## 三條主要沙盒後台流程（最新）

目前 Appointment Requests / Abnormal Alerts / Manual Reply Tasks 三條主要沙盒後台流程都已完成基本閉環。

### 已完成新增紀錄

1. PR #35：Abnormal Alerts 沙盒建立 v1
- Conversation Logs 判斷 `abnormal_alert`
- 可建立 Sandbox 異常提醒
- 使用 localStorage，不寫 Supabase
- Abnormal Alerts 頁面可顯示 Sandbox 異常提醒
- 可標記沙盒已處理 / 清除沙盒提醒

2. PR #36：Abnormal Alerts 沙盒處理回寫 v1
- 修正 urgency / severity mapping
- 中文 `緊急 / 高` 不再錯誤落到 `low`
- Abnormal Alerts 處理後可寫入 localStorage resolution event
- Conversation Logs 可顯示「Abnormal Alerts 沙盒處理回寫訊息」

3. PR #37：Manual Reply Tasks 沙盒建立與處理回寫 v1
- Conversation Logs 判斷 `manual_reply_task`
- 可建立 Sandbox 人工回覆任務
- Manual Reply Tasks 頁面可顯示 Sandbox 任務
- 可複製回覆重點
- 可輸入處理備註並標記沙盒已回覆
- 標記後可回寫到 Conversation Logs
- 全程只使用 localStorage，不寫 Supabase `messages`

### 目前性質（務必維持）

- 沙盒流程
- localStorage 沙盒事件
- 內部流程驗證
- 不是正式 LINE
- 不是正式 messages
- 不會通知真客人

## 尚未完成事項（更新）

1. Knowledge Base 真實查詢回答尚未完成
2. 真 LINE webhook / 接收 / 發送尚未完成
3. 後台登入、RLS、員工權限尚未完成
4. 多分店 / 多 LINE 官方帳號設定尚未完成
5. 全站中文化 UI mapping 尚未完成
6. 測試資料清理與長期資料治理尚未完成
7. 沙盒 localStorage 是否升級 Supabase 儲存尚未決定

## 下一步建議（更新）

下一個建議任務：`Archive Schema Review v1`

邊界：

- 這仍不代表要馬上改 schema
- 下一步應該先審查目前 Supabase schema 是否已有類似欄位
- 再決定是否需要 migration
- 真正改 schema 前，必須先備份與人工確認
- 仍然不接 LINE、不寫 Supabase `messages`、不做 cron、不做物理刪除

## 安全邊界再確認

現在仍是沙盒與後台流程驗證階段，不能因為三條沙盒流程完成，就直接接真 LINE。

真 LINE 發送必須等 webhook、signature validation、messages 資料模型、登入/RLS、人工確認、操作紀錄都完成後才可以做。

Knowledge Base 也必須先做「搜尋少量相關資料 → Gemini 回答」，不能整包丟給 Gemini。

## Archive Schema Review v1

本段是 PR #46「Archive Schema Planning v1」之後的文件審查整理。本次只是 review，不是 migration；本次沒有改 Supabase schema、沒有新增 table、沒有新增 migration、沒有做 cron、沒有做 Edge Function、沒有刪資料、沒有接 LINE、沒有送 LINE 訊息、沒有寫 Supabase `messages`、沒有處理 PR #7。

### 一、Archive Schema Review v1 結論

- 本次只讀現有 repo 狀態並整理文件。
- 本次沒有改 app / lib / API / helper。
- 本次沒有改 `supabase/schema.sql`。
- 本次沒有新增 table 或 migration。
- 本次沒有做正式封存、cron、Edge Function 或資料刪除。
- 本次沒有接 LINE、沒有送 LINE 訊息，也沒有寫 Supabase `messages`。
- 本次 review 不代表要馬上 migration。

### 二、目前 Supabase schema.sql 已存在的表與欄位

依 `supabase/schema.sql` 實際內容，目前列出的表只有 6 張：

| 表 | schema.sql 目前欄位 | 白話用途 |
| --- | --- | --- |
| `customers` | `id`, `name`, `phone`, `line_user_id`, `created_at` | 客戶基本資料與 LINE user id |
| `messages` | `id`, `customer_id`, `channel`, `content`, `created_at` | 對話訊息紀錄，連到 `customers` |
| `knowledge_articles` | `id`, `title`, `category`, `content`, `is_active`, `created_at`, `updated_at` | 知識庫文章與啟用狀態 |
| `appointment_requests` | `id`, `pet_name`, `service`, `owner_name`, `requested_at`, `status`, `created_at`, `updated_at` | 預約申請與目前處理狀態 |
| `abnormal_alerts` | `id`, `severity`, `title`, `triggered_at`, `summary`, `is_resolved`, `resolved_at`, `created_at` | 異常提醒、嚴重度與是否已處理 |
| `manual_reply_tasks` | `id`, `customer`, `topic`, `waiting_minutes`, `priority`, `is_replied`, `replied_at`, `created_at` | 需要人工回覆的任務與是否已回覆 |

`schema.sql` 也有啟用這 6 張表的 RLS，並建立 `Allow anon full access ...` 測試用 policy。這代表目前仍是 MVP / 沙盒驗證用權限，不是正式員工登入與正式 RLS 權限設計。

注意：`schema.sql` 目前沒有列出 `appointment_requests.is_sandbox`，但目前文件、型別與程式流程都有使用 `is_sandbox`。這表示 repo 內的 `schema.sql` 可能不是目前 Supabase 遠端資料庫的完整最新狀態，未來真正 migration 前要先備份並重新比對遠端 schema。

### 三、TypeScript 型別狀態

`lib/types.ts` 目前有 `Customer`, `Message`, `KbArticle`, `AppointmentStatus`, `AppointmentRequest`, `AbnormalAlert`, `ManualReplyTask`, `ConversationLog`, `SandboxKnowledgeAnswer`。

大致對應 Supabase table 的型別：

- `Customer` 對應 `customers`
- `Message` 對應 `messages`
- `KbArticle` 對應 `knowledge_articles`
- `AppointmentRequest` 對應 `appointment_requests`
- `AbnormalAlert` 對應 `abnormal_alerts`
- `ManualReplyTask` 對應 `manual_reply_tasks`

types 裡存在但 `schema.sql` 沒有的欄位：

- `AppointmentRequest.is_sandbox`
- `ManualReplyTask.source_channel`
- `ManualReplyTask.customer_line_user_id`
- `ManualReplyTask.last_message`
- `ManualReplyTask.reply_note`
- `ConversationLog.customer`, `last_message`, `updated_at` 是前端整理後顯示欄位，不是 `messages` 表原始欄位

`schema.sql` 裡存在但 types 裡不完整或未列出的欄位：

- `knowledge_articles.created_at`
- `appointment_requests.created_at`, `updated_at`
- `abnormal_alerts.resolved_at`, `created_at`
- `manual_reply_tasks.created_at`

因此目前 `types.ts` 比較像「前端畫面會用到的資料形狀」，不一定是完整、嚴格同步的 DB schema 型別。

### 四、supabaseClient 使用方式

`lib/supabaseClient.ts` 使用 `@supabase/supabase-js` 的 `createClient` 建立 client，讀取 `NEXT_PUBLIC_SUPABASE_URL` 與 `NEXT_PUBLIC_SUPABASE_ANON_KEY`。目前仍有 `isSupabaseConfigured` 與 `supabaseEnvWarning`，環境變數缺少時頁面會回到 mock data / warning 流程。這份檔案沒有使用或暴露 `service_role` key。

目前 `supabaseRequest` 支援 `GET`, `POST`, `PATCH`, `DELETE`。`GET` 支援 `select` 與 `order`；`PATCH` / `DELETE` 支援 query 裡的 `eq.` 條件；`POST`, `PATCH`, `DELETE` 都會接 `.select()` 取得回傳資料。程式裡有傳入 `prefer: "return=representation"` 的地方，但目前 `supabaseRequest` 沒有實際使用 `prefer` 參數。

### 五、目前頁面實際使用的表與欄位

- Knowledge Base 使用 `knowledge_articles`：讀取 `*` 並依 `updated_at` 排序；新增 / 更新 `title`, `category`, `content`, `is_active`, `updated_at`；切換 `is_active`；依 `id` 刪除。`/api/sandbox/knowledge-answer` 會查 `id`, `title`, `category`, `content`, `is_active`，只取 `is_active = true`。
- Appointment Requests 使用 `appointment_requests`：讀取 `*` 並依 `requested_at` 排序；顯示 `id`, `is_sandbox`, `pet_name`, `service`, `owner_name`, `requested_at`, `status`；更新 `status`, `updated_at`；刪除 `id`；Conversation Logs 建立 Sandbox 預約時寫入 `owner_name`, `service`, `pet_name`, `requested_at`, `status`, `is_sandbox`；改約流程會用 `id`, `is_sandbox`, `status` 當條件更新 `requested_at`, `status`。
- Abnormal Alerts 使用 `abnormal_alerts`：讀取 `*` 並依 `triggered_at` 排序；顯示 `id`, `severity`, `title`, `triggered_at`, `summary`, `is_resolved`；標記已處理時更新 `is_resolved`, `resolved_at`。
- Manual Reply Tasks 使用 `manual_reply_tasks`：讀取 `*` 並依 `waiting_minutes` 排序；顯示 `id`, `customer`, `source_channel`, `customer_line_user_id`, `topic`, `last_message`, `reply_note`, `waiting_minutes`, `priority`, `is_replied`, `replied_at`；標記已回覆時更新 `is_replied`, `replied_at`。
- Conversation Logs 讀取 `messages`：查 `id`, `channel`, `content`, `created_at`, `customers(name)`，整理成前端顯示用 `ConversationLog`。沙盒對話本身存在前端 state，Appointment / Abnormal / Manual Reply / Knowledge Gap 的沙盒回寫多數走 localStorage helper。
- 目前明確沒有把沙盒回覆寫入 Supabase `messages`，也沒有送 LINE。

目前 localStorage sandbox helper 包含 `sandboxConversationEvents`, `sandboxCustomerRescheduleEvents`, `sandboxAbnormalAlertEvents`, `sandboxAbnormalAlertResolutionEvents`, `sandboxManualReplyTaskEvents`, `sandboxManualReplyResolutionEvents`, `sandboxKnowledgeGapEvents`, `sandboxArchivePolicy`。

### 六、對照 Archive Schema Planning v1 的缺口

`manual_reply_tasks` 目前在 `schema.sql` 已有 `is_replied`, `replied_at`，但未來可能仍缺 `reply_note`, `source_channel`, `customer_line_user_id`, `last_message`, `resolved_at`, `resolved_by`, `resolution_note`, `archive_status`, `archived_at`, `archive_batch_id`。

`abnormal_alerts` 目前在 `schema.sql` 已有 `severity`, `is_resolved`, `resolved_at`，但未來可能仍缺 `resolved_by`, `resolution_note`, `follow_up_required`, `follow_up_at`, `archive_status`, `archived_at`, `archive_batch_id`。

`appointment_requests` 目前在 `schema.sql` 已有 `status`，但未來可能仍缺 `is_sandbox`（程式已使用但 `schema.sql` 沒列）、`confirmed_at`, `rejected_at`, `completed_at`, `resolved_at`, `archive_status`, `archived_at`, `archive_batch_id`。

`messages` / Conversation Logs 未來可能缺 `conversation_id`, `source_channel`, `sender_type`, `ai_intent`, `ai_summary`, `reply_policy_mode`, `sent_to_line`, `sent_at`, `archive_status`, `archived_at`, `audit_log_id`。

`knowledge_gap_events` 目前不是 Supabase table。Knowledge Gap 仍是 localStorage sandbox，不應本次急著新增 table。只有未來正式決定要把 Knowledge Gap 從沙盒轉成 Supabase 儲存時，才需要重新討論 table 與 migration。

`event_audit_logs` 目前也是未來規劃，不應本次新增 table。未來要做正式 LINE、封存、狀態變更追蹤、人工操作追查時，才適合進入 migration planning。

### 七、哪些欄位現在不該急著加

目前不建議急著加：

- `deleted_at`
- `event_audit_logs` table
- `knowledge_gap_events` table
- archive cron 相關欄位或排程
- LINE `sent_to_line` / `sent_at` 相關正式送訊息欄位
- staff / actor / `resolved_by`，在尚未完成登入與員工身份前不急著加
- RLS / login 相關欄位或 policy

原因是目前仍是沙盒階段，還沒有正式 LINE、登入 / RLS、audit log、備份 / 還原機制。太早 migration 會讓資料模型變複雜，而且不一定符合之後真實營運流程。

### 八、未來最小 migration v1 候選方向

以下不是本次 PR 要做的事，只是 review 結論。未來若使用者明確確認要進入 migration planning，可以偏保守考慮：

- 先只補 `manual_reply_tasks` / `abnormal_alerts` / `appointment_requests` 的處理備註與處理時間欄位。
- 先釐清 `schema.sql` 與遠端 Supabase 是否不同步，特別是 `appointment_requests.is_sandbox` 與 `manual_reply_tasks.reply_note` 等欄位。
- 先不要新增 `event_audit_logs`。
- 先不要新增 `deleted_at`。
- 先不要做 archive cron。
- 先不要讓 `messages` 進入正式 LINE 流程。
- 真正 migration 前，要先備份 Supabase schema / data，並由使用者明確確認。

### 九、需要等後續階段再討論的欄位或表

以下內容需要等 audit log / login / RLS / 正式 LINE 階段再討論：

- `event_audit_logs`
- `actor_id`, `actor_name`, `resolved_by`, `updated_by`
- `sent_to_line`, `sent_at`
- `reply_policy_mode`
- `audit_log_id`
- 正式 `conversation_id` 設計
- RLS policy、staff users、登入身份與權限欄位

### 十、安全結論

Archive Schema Review v1 完成後，下一步仍不應直接進入正式封存或 LINE 上線。比較安全的下一步可能是：

- Archive Minimal Migration Planning v1
- Audit Log Planning v1
- Formal LINE Readiness Checklist v1

實際下一步仍需要由使用者明確確認。本次 review 不代表要馬上 migration。

## Schema Sync Review v1

本段是 PR #47「Archive Schema Review v1」merge 後，使用者在 Supabase SQL Editor 查詢遠端 `public` schema 的同步整理。這次只更新文件，目的是釐清「遠端 Supabase DB 真實欄位」與 repo 內 `supabase/schema.sql` 的差異，避免未來只看 `schema.sql` 就誤判遠端缺欄位。

### 一、結論

- 遠端 Supabase DB 比 repo 的 `supabase/schema.sql` 更新。
- `appointment_requests.is_sandbox` 遠端已存在。
- `manual_reply_tasks.source_channel`, `manual_reply_tasks.customer_line_user_id`, `manual_reply_tasks.last_message`, `manual_reply_tasks.reply_note` 遠端已存在。
- repo 的 `schema.sql` 目前落後，未來不能只看 `schema.sql` 就判斷欄位不存在。
- 本次不改資料庫、不改 schema、不新增 migration。

### 二、遠端 DB 與 repo schema.sql 差異

| 欄位 / 表 | 遠端 Supabase 是否存在 | repo schema.sql 是否列出 | 判斷 | 後續建議 |
| --- | --- | --- | --- | --- |
| `appointment_requests.is_sandbox` | 是 | 否 | 遠端 DB 已有欄位，`schema.sql` 落後 | 未來若要同步 schema 文件，先確認遠端型別與預設值，再由使用者確認是否更新 repo schema |
| `manual_reply_tasks.source_channel` | 是 | 否 | 遠端 DB 已有欄位，`schema.sql` 落後 | 不需要把它當成缺欄位 migration；未來只需納入 schema 同步整理 |
| `manual_reply_tasks.customer_line_user_id` | 是 | 否 | 遠端 DB 已有欄位，`schema.sql` 落後 | 正式 LINE 前仍需重新設計資料治理與權限，不應直接接 LINE |
| `manual_reply_tasks.last_message` | 是 | 否 | 遠端 DB 已有欄位，`schema.sql` 落後 | 可視為人工回覆工作台已用欄位，未來同步文件即可 |
| `manual_reply_tasks.reply_note` | 是 | 否 | 遠端 DB 已有欄位，`schema.sql` 落後 | 不再列為遠端缺欄位；未來只評估是否需要更完整的 resolution 欄位 |

### 三、目前真正仍缺的治理欄位

以下欄位是目前遠端 DB 仍沒有、但未來可能需要的治理欄位。這些不是本次要新增的 migration。

`abnormal_alerts`：

- `resolved_by`
- `resolution_note`
- `follow_up_required`
- `follow_up_at`
- `archive_status`
- `archived_at`
- `archive_batch_id`

`manual_reply_tasks`：

- `resolved_at`
- `resolved_by`
- `resolution_note`
- `archive_status`
- `archived_at`
- `archive_batch_id`

`appointment_requests`：

- `confirmed_at`
- `rejected_at`
- `completed_at`
- `resolved_at`
- `archive_status`
- `archived_at`
- `archive_batch_id`

`messages`：

- `conversation_id`
- `source_channel`
- `sender_type`
- `ai_intent`
- `ai_summary`
- `reply_policy_mode`
- `sent_to_line`
- `sent_at`
- `archive_status`
- `archived_at`
- `audit_log_id`

`messages` 目前遠端仍很簡單，只有 `id`, `customer_id`, `channel`, `content`, `created_at`。這代表目前仍不能接正式 LINE，不能寫正式 Supabase `messages` 作為正式對話紀錄。

### 四、最小 migration 候選方向

A. 可優先考慮，但仍需使用者確認後才 migration：

- `manual_reply_tasks` / `abnormal_alerts` / `appointment_requests` 的 `resolution_note` / `resolved_at` 類處理紀錄欄位。
- `archive_status` / `archived_at` / `archive_batch_id` 是否先加在事件表，仍需再確認。

B. 暫時不要做：

- `deleted_at`
- `event_audit_logs` table
- `knowledge_gap_events` table
- archive cron
- LINE `sent_to_line` / `sent_at`

C. 必須等正式 LINE / login / RLS / audit log 規劃後再做：

- `messages` 正式 LINE 欄位
- `actor_id` / `actor_name` / `resolved_by` / `updated_by`
- `event_audit_logs`
- RLS policy

### 五、安全結論

- 本次只是文件同步與 migration 候選整理。
- 本次沒有改 Supabase schema。
- 本次沒有新增 table。
- 本次沒有新增 migration。
- 本次沒有做 cron。
- 本次沒有刪資料。
- 本次沒有接 LINE。
- 本次沒有寫 Supabase `messages`。
- 本次沒有處理 PR #7。
