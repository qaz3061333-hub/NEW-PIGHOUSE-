# NEW-PIGHOUSE- / new-pighouse-pjdh

資料日期：2026-05-06

本文件是新對話接手本專案時的核心交接文件。接手順序建議：先讀本 `README.md`，再讀 `PROJECT_STATUS.md`。

## 1. 專案目標

本專案是寵物店用的官方 LINE 客服後台 MVP。

目前仍是「沙盒與後台流程驗證階段」，不是正式 LINE 上線階段。第一階段目標是先把 AI 客服沙盒、資料分流、預約申請、異常提醒、人工回覆與後台人工處理流程做穩，之後才接官方 LINE、正式 Knowledge Base 檢索、員工登入與 RLS 權限。

目前只做 LINE 客服後台方向；暫不做 FB、IG、POS、金流、自動排班。

## 2. 使用者與協作方式

使用者是程式 0 經驗，需要白話、短步驟、可驗收的指引。

固定協作原則：

1. 每次任務都要很小，不要一次做一大包。
2. 給 Codex 指令時，必須先標示「請開新任務」或「請延續上一個任務」。
3. Codex 完成後，必須建立 PR，不要直接改 main。
4. ChatGPT 必須實際檢查 GitHub PR，不可只看 Codex Summary。
5. 檢查 PR 時，不只看檔案範圍，也要檢查 code 邏輯是否正確。
6. 若 PR 範圍正確、code 合理、Vercel checks 通過、沒有高風險超改，可直接 merge。
7. merge 後，使用者到 Vercel 等 `Production / Current / Ready`，再到正式測試站驗收。

## 3. 技術架構

- Framework: Next.js 14.2.33
- Language: TypeScript
- Styling: Tailwind CSS
- Hosting: Vercel
- Database: Supabase
- Repo: `qaz3061333-hub/NEW-PIGHOUSE-`
- Vercel project: `new-pighouse-pjdh`
- Supabase project: `new-pighouse`
- 正式測試站：`https://new-pighouse-pjdh.vercel.app`

## 4. 最高安全邊界

目前仍是沙盒階段，因此：

- 不接真 LINE
- 不發送真 LINE 訊息
- 不自動通知真客人
- 不把 Sandbox 資料當正式預約
- 不寫 Supabase `messages` 作為正式對話
- 不改 Supabase schema，除非使用者明確同意
- 不改 RLS / 登入
- 不儲存正式敏感憑證
- 不處理舊 PR #7，除非使用者明確要求清理

## 5. 已完成基礎功能

已建立後台頁面：

- Dashboard
- Knowledge Base
- Appointment Requests
- Abnormal Alerts
- Manual Reply Tasks
- Conversation Logs

Supabase 已建立資料表：

- `customers`
- `messages`
- `knowledge_articles`
- `appointment_requests`
- `abnormal_alerts`
- `manual_reply_tasks`

`appointment_requests` 已新增 `is_sandbox` 欄位，用於分流正式資料與沙盒資料。

Knowledge Base 已驗證 Supabase 讀寫成功，但尚未接 Gemini 真實檢索回答。

Appointment Requests / Abnormal Alerts / Manual Reply Tasks 已可讀取 Supabase 真資料並做基礎狀態更新。

## 6. Conversation Logs / Gemini 沙盒目前狀態

Conversation Logs 已是 LINE 沙盒對話模擬器。

已完成：

- Gemini API 已接上
- Gemini model 可由 Vercel env 調整
- 支援多輪沙盒對話
- 前端會把最近 history 送給 API
- API 會把最近 10 則對話放入 Gemini prompt
- 支援台灣時間 `Asia/Taipei`
- 可判斷今天、明天、後天、下週、上午、下午、晚上、中午
- 可判斷過去時間，不允許建立過去的 Sandbox 預約
- 可從 Conversation Logs 建立 Sandbox appointment request

Gemini intent 類型包含：

- `appointment_request`
- `abnormal_alert`
- `knowledge_question`
- `manual_reply_task`
- `unknown`

目前 Gemini 尚未查真實 Knowledge Base。未來正確方向是：先搜尋相關知識庫內容，再把少量相關內容交給 Gemini，不可把整個 Knowledge Base 無差別丟給 Gemini。

## 7. Appointment Requests 沙盒主流程目前狀態

Appointment Requests 目前是本專案完成度最高的主流程。

### 7.1 建立 Sandbox 預約

Conversation Logs 判斷為 `appointment_request` 且時間有效時，可建立 Sandbox appointment request。

建立時：

- `status = pending`
- `is_sandbox = true`
- `requested_at` 使用 Asia/Taipei 解析後轉 ISO

### 7.2 查看與刪除

Appointment Requests 已完成：

- 顯示正式 / Sandbox 來源欄
- Sandbox 資料列使用淡色背景
- 可查看詳情
- 可安全刪除 Sandbox 預約
- 刪除前會跳瀏覽器 confirm

「查看詳情」目前只負責看基本資料，不再藏主要操作。

### 7.3 confirmed 流程已完成

當 Sandbox 預約 status 選為 `confirmed`：

- 該列下方直接顯示「Sandbox 確認預約回覆」
- 不需按查看詳情
- 可按「確認送出沙盒回覆」
- 回寫到 Conversation Logs 的 localStorage 沙盒事件
- 不送 LINE
- 不寫 Supabase `messages`

### 7.4 proposed_new_time 流程已完成

當 Sandbox 預約 status 選為 `proposed_new_time`：

- 該列下方直接顯示「Gemini 沙盒改約回覆」
- 員工可輸入自然語句，例如「明天3點」「後天三點」
- 透過 server-side Gemini API route 產生改約回覆
- 可按「確認送出沙盒回覆」
- 回寫到 Conversation Logs localStorage
- 不送 LINE
- 不寫 Supabase `messages`

### 7.5 rejected 流程已完成

當 Sandbox 預約 status 選為 `rejected`：

- 該列下方直接顯示「Gemini 沙盒拒絕回覆」
- 員工可輸入拒絕原因
- 透過 server-side Gemini API route 產生禮貌拒絕回覆
- 可按「確認送出沙盒回覆」
- 回寫到 Conversation Logs localStorage
- 不送 LINE
- 不寫 Supabase `messages`

### 7.6 Appointment Requests → Conversation Logs 沙盒回寫已完成

已新增 helper：

- `lib/sandboxConversationEvents.ts`

localStorage key：

- `new_pighouse_sandbox_conversation_events_v1`

confirmed / proposed_new_time / rejected 的沙盒送出結果會回寫到 Conversation Logs。

Conversation Logs 會顯示「Appointment Requests 沙盒回寫訊息」，可清除這批前端沙盒事件。

這只是同一瀏覽器 localStorage，不跨裝置同步，不寫 Supabase `messages`。

## 8. 兩種改約閉環已完成

### 8.1 客人接受員工提出的新時間

情境：員工提出改約後，客人回覆「好，明天下午三點可以」。

已完成：

- 在 Conversation Logs 的 `appointment_status = proposed_new_time` 回寫卡片中顯示「模擬客人回覆」
- 透過 server-side Gemini API route 分析客人是否接受新時間
- 若成功，PATCH 原本 `appointment_requests`
- PATCH 條件限制 `id + is_sandbox = true`
- 更新 `requested_at`
- `status` 改回 `pending`
- 不自動 confirmed，需員工最後確認
- 不寫 Supabase `messages`
- 不送 LINE

### 8.2 客人主動要求更改已 confirmed 預約

情境：客人原本 confirmed，後來說「抱歉我這個時間突然有事，可以改五點嗎？」

已完成：

- Conversation Logs 新增「客人主動改已確認預約（Sandbox）」區塊
- 可選擇 `is_sandbox = true` 且 `status = confirmed` 的預約
- 可輸入客人主動改約訊息
- 透過 server-side Gemini API route 判斷是否為主動改約
- 若成功，PATCH 原本 `appointment_requests`
- PATCH 條件限制 `id + is_sandbox = true + status = confirmed`
- 更新 `requested_at`
- `status` 改回 `pending`
- 不自動 confirmed
- 新增 helper：`lib/sandboxCustomerRescheduleEvents.ts`
- localStorage key：`new_pighouse_sandbox_customer_reschedule_events_v1`
- Appointment Requests 會提示：「客人主動要求改約，不是新預約。」並顯示原時間與新時間
- 不寫 Supabase `messages`
- 不送 LINE

## 9. Manual Reply Tasks 目前狀態

Manual Reply Tasks 已升級為人工回覆工作台 v1。

已完成：

- 顯示客戶、來源渠道、主題、最後訊息、建議回覆重點、等待時間、優先度、狀態 / 操作
- 可複製回覆重點
- 可標記已回覆
- 標記已回覆後重新整理仍保留

但 Conversation Logs 尚未能從 Gemini `manual_reply_task` intent 建立 Sandbox Manual Reply Task，也尚未做處理回饋流程。

## 10. Abnormal Alerts 目前狀態

Abnormal Alerts 可讀寫 Supabase，`is_resolved` 與 `resolved_at` 可更新並保留。

但 Conversation Logs 尚未能從 Gemini `abnormal_alert` intent 建立 Sandbox Abnormal Alert，也尚未做後台處理結果回到沙盒流程。

## 11. 尚未完成的重要功能

1. Abnormal Alerts 沙盒建立與處理回饋 v1
2. Manual Reply Tasks 沙盒建立與處理回饋 v1
3. Knowledge Base 真實查詢回答
4. 真 LINE webhook / 發訊
5. 後台登入、RLS、權限、操作紀錄
6. 多分店 / 多 LINE 官方帳號設定
7. 全站中文化 UI mapping
8. 測試資料清理與長期資料治理

## 12. 目前建議下一步

下一個最小風險功能任務：

**Abnormal Alerts 沙盒建立與處理回饋 v1**

原因：

Appointment Requests 沙盒主流程已完成，包含預約建立、確認、改時間、拒絕、回寫 Conversation Logs、客人接受改約、客人主動改約。下一步應開始補另一個 Gemini intent：`abnormal_alert`，讓 Conversation Logs 判斷到異常或客訴時，可以建立 Sandbox Abnormal Alert，並在後台處理後回到沙盒流程。

## 13. PR 與風險紀錄

重要提醒：

- PR #7 仍開著，但暫時不要處理。它是舊 Dashboard / Supabase 強化 PR，之前有 build / dependency 問題，不可誤 merge。
- PR #14 是舊的重複 Gemini PR，已關閉，不要用。
- PR #24 是舊的 proposed_new_time 分歧 PR，已關閉，不要用。

近期 Appointment Requests 主流程相關 PR 已完成：

- PR #25：proposed_new_time v1.1 clean PR
- PR #26：proposed_new_time Gemini 沙盒轉換 v1
- PR #27：proposed_new_time Gemini 流程整理 v1
- PR #28：rejected Gemini 沙盒拒絕流程 v1
- PR #29：Appointment Requests → Conversation Logs localStorage 回寫
- PR #30：confirmed 操作區塊直覺化
- PR #31：更新 PROJECT_STATUS：Appointment Requests 主流程狀態
- PR #32：客人接受員工改約後更新原本 Sandbox 預約
- PR #33：客人主動要求更改已 confirmed Sandbox 預約
- PR #34：更新 PROJECT_STATUS：兩種改約閉環完成

## 14. 新對話接手時必問的刁鑽問題

請新對話逐題回答。如果答得模糊，代表尚未完整理解本專案。

1. 目前為什麼不能接真 LINE？請列出至少 5 個尚未完成的安全條件。
2. `is_sandbox` 在 `appointment_requests` 裡的用途是什麼？哪些流程必須限制 `is_sandbox = true`？
3. Conversation Logs 建立 Sandbox appointment request 時，什麼情況不能建立？例如客人說過去時間時應如何判斷？
4. Appointment Requests 的 `confirmed`、`proposed_new_time`、`rejected` 三個狀態，目前各自做到哪裡？哪些會用 Gemini？哪些不用？
5. 為什麼 `confirmed` / `proposed_new_time` / `rejected` 的主要操作不應藏在「查看詳情」裡？目前正確 UI 行為是什麼？
6. Appointment Requests 回寫到 Conversation Logs 是寫到 Supabase `messages` 嗎？如果不是，寫在哪裡？為什麼？
7. 客人接受員工提出的新時間後，系統會把預約改成 `confirmed` 嗎？為什麼？
8. 客人主動要求更改已 confirmed 預約時，系統如何避免把它誤當成新預約？員工在哪裡看到提示？
9. 客人主動改約流程的 PATCH 條件為什麼必須包含 `id + is_sandbox = true + status = confirmed`？少掉 `status = confirmed` 會有什麼風險？
10. 目前 Gemini 能不能查真實 Knowledge Base 回答客人？如果不能，正確的未來流程應該怎麼設計？
11. Abnormal Alerts 目前已做到什麼？為什麼它是下一個合理任務？
12. Manual Reply Tasks 目前已做到什麼？它和 Abnormal Alerts 的下一步差別是什麼？
13. PR #7 是什麼狀態？為什麼不能直接 merge 或隨便清掉？
14. 如果使用者要求「直接接 LINE + Knowledge Base + Abnormal Alerts + Manual Reply Tasks + RLS 一次做完」，你應該如何回應？
15. 如果 Codex Summary 說 build 通過，但 PR diff 顯示它改了 LINE、schema、Vercel env 或正式憑證處理，你應該怎麼處理？

## 15. 給新對話的最低接手標準

新對話若要接手，至少要能清楚說出：

- 目前仍是 Sandbox 階段
- Appointment Requests 主流程已完成
- 兩種改約閉環已完成
- Conversation Logs 與 Appointment Requests 目前用 localStorage 做沙盒回寫，不是正式 messages
- 真 LINE、Knowledge Base 真檢索、RLS / 登入都尚未做
- 下一步是 Abnormal Alerts 沙盒建立與處理回饋 v1
- 每次任務必須小範圍、PR 檢查不只看 Summary，還要看 diff 與 code 邏輯
