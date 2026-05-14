# NEW-PIGHOUSE- / new-pighouse-pjdh

資料日期：2026-05-14

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

即使目前三條沙盒流程已完成，也不能直接接真 LINE。真 LINE 發送必須等 webhook、signature validation、messages 資料模型、登入/RLS、人工確認、操作紀錄都完成後才可以做。Knowledge Base 也必須先做「搜尋少量相關資料 → Gemini 回答」，不能整包丟給 Gemini。

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

## 9. Abnormal Alerts / Manual Reply Tasks 最新狀態

以下兩條流程已完成並驗收：

1. PR #35：Abnormal Alerts 沙盒建立 v1
   - Conversation Logs 可判斷 `abnormal_alert`
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
   - Conversation Logs 可判斷 `manual_reply_task`
   - 可建立 Sandbox 人工回覆任務
   - Manual Reply Tasks 頁面可顯示 Sandbox 任務
   - 可複製回覆重點
   - 可輸入處理備註並標記沙盒已回覆
   - 標記後可回寫到 Conversation Logs
   - 全程只使用 localStorage，不寫 Supabase `messages`

## 10. 目前三條主要沙盒後台流程總狀態

目前 **Appointment Requests / Abnormal Alerts / Manual Reply Tasks** 三條主要沙盒後台流程都已完成基本閉環。

但這些仍然是：

- 沙盒流程
- localStorage 沙盒事件
- 內部流程驗證
- 不是正式 LINE
- 不是正式 messages
- 不會通知真客人

## 11. 尚未完成的重要功能

1. Knowledge Base 真實查詢回答尚未完成
2. 真 LINE webhook / 接收 / 發送尚未完成
3. 後台登入、RLS、員工權限尚未完成
4. 多分店 / 多 LINE 官方帳號設定尚未完成
5. 全站中文化 UI mapping 尚未完成
6. 測試資料清理與長期資料治理尚未完成
7. 沙盒 localStorage 是否升級 Supabase 儲存尚未決定

## 12. 目前建議下一步

下一個建議任務：

**Knowledge Base 沙盒查詢回答 v1**

必須清楚遵守：

- 不是直接接真 LINE
- 不是把整個知識庫丟給 Gemini
- 不是正式自動回覆客人
- 先做沙盒版：
  - Conversation Logs 判斷 `knowledge_question`
  - 搜尋 Supabase `knowledge_articles` 中 `is_active = true` 的少量相關資料
  - 只把相關資料交給 Gemini
  - 在 Conversation Logs 顯示沙盒知識庫回答
  - 不寫 Supabase `messages`
  - 不送 LINE

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

1. Appointment Requests 沙盒閉環完成到哪裡？
2. Abnormal Alerts 沙盒閉環完成到哪裡？
3. Manual Reply Tasks 沙盒閉環完成到哪裡？
4. 為什麼這三條流程仍然不能算正式 LINE 上線？
5. 為什麼 localStorage 目前仍然比寫 Supabase `messages` 安全？
6. 下一步為什麼是 Knowledge Base 沙盒查詢回答 v1，而不是直接接 LINE？
7. Knowledge Base 為什麼不能整包丟給 Gemini？
8. 什麼條件達成後才能真的送 LINE？
9. 如果 PR 改了 schema / LINE / env / RLS，但任務沒要求，該怎麼處理？

## 15. 給新對話的最低接手標準

新對話若要接手，至少要能清楚說出：

- 目前仍是 Sandbox 階段
- Appointment Requests 主流程已完成
- 兩種改約閉環已完成
- Conversation Logs 與 Appointment Requests 目前用 localStorage 做沙盒回寫，不是正式 messages
- 真 LINE、Knowledge Base 真檢索、RLS / 登入都尚未做
- 下一步是 Knowledge Base 沙盒查詢回答 v1
- 每次任務必須小範圍、PR 檢查不只看 Summary，還要看 diff 與 code 邏輯
