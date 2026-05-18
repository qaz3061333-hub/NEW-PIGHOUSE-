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

### 4.1 Archive Schema Planning v1

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

**Archive Schema Review v1**

必須清楚遵守：

- 這仍不代表要馬上改 schema
- 下一步應該先審查目前 Supabase schema 是否已有類似欄位
- 再決定是否需要 migration
- 真正改 schema 前，必須先備份與人工確認
- 仍然不接 LINE、不寫 Supabase `messages`、不做 cron、不做物理刪除

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
- PR #45：Archive Policy v1 + Sandbox Archive Preview v1

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
10. 為什麼目前不做物理刪除？
11. 為什麼已處理事件也不應立刻刪除？
12. Manual Reply Task 什麼條件下才適合封存？
13. Abnormal Alert 為什麼不能只靠 resolved 就自動封存？
14. Knowledge Gap 什麼狀態才適合封存？
15. Conversation Logs 為什麼不建議自動刪除？
16. audit log 未完成前為什麼不能做真正刪除？
17. 未來每日 00:00 封存要注意什麼時區問題？

## 15. 給新對話的最低接手標準

新對話若要接手，至少要能清楚說出：

- 目前仍是 Sandbox 階段
- Appointment Requests 主流程已完成
- 兩種改約閉環已完成
- Conversation Logs 與 Appointment Requests 目前用 localStorage 做沙盒回寫，不是正式 messages
- 真 LINE、Knowledge Base 真檢索、RLS / 登入都尚未做
- 下一步是 Archive Schema Review v1，但不代表要馬上改 schema
- 每次任務必須小範圍、PR 檢查不只看 Summary，還要看 diff 與 code 邏輯

## 16. Archive Schema Review v1

本段是 PR #46「Archive Schema Planning v1」之後的文件審查整理。本次只是 review，不是 migration；本次沒有改 Supabase schema、沒有新增 table、沒有新增 migration、沒有做 cron、沒有做 Edge Function、沒有刪資料、沒有接 LINE、沒有送 LINE 訊息、沒有寫 Supabase `messages`、沒有處理 PR #7。

### 16.1 目前 Supabase schema.sql 已存在的表

依 `supabase/schema.sql` 實際內容，目前列出的表只有 6 張：

- `customers`
- `messages`
- `knowledge_articles`
- `appointment_requests`
- `abnormal_alerts`
- `manual_reply_tasks`

`schema.sql` 也有啟用上述 6 張表的 RLS，並建立 `Allow anon full access ...` 測試用 policy。這代表目前仍是 MVP / 沙盒驗證用權限，不是正式員工登入與正式 RLS 權限設計。

### 16.2 目前各表已有欄位

以下只根據 `supabase/schema.sql` 實際內容整理，不把文件或前端型別裡的欄位誤當成 schema 已存在欄位。

| 表 | schema.sql 目前欄位 | 白話用途 |
| --- | --- | --- |
| `customers` | `id`, `name`, `phone`, `line_user_id`, `created_at` | 客戶基本資料與 LINE user id |
| `messages` | `id`, `customer_id`, `channel`, `content`, `created_at` | 對話訊息紀錄，連到 `customers` |
| `knowledge_articles` | `id`, `title`, `category`, `content`, `is_active`, `created_at`, `updated_at` | 知識庫文章與啟用狀態 |
| `appointment_requests` | `id`, `pet_name`, `service`, `owner_name`, `requested_at`, `status`, `created_at`, `updated_at` | 預約申請與目前處理狀態 |
| `abnormal_alerts` | `id`, `severity`, `title`, `triggered_at`, `summary`, `is_resolved`, `resolved_at`, `created_at` | 異常提醒、嚴重度與是否已處理 |
| `manual_reply_tasks` | `id`, `customer`, `topic`, `waiting_minutes`, `priority`, `is_replied`, `replied_at`, `created_at` | 需要人工回覆的任務與是否已回覆 |

注意：`schema.sql` 目前沒有列出 `appointment_requests.is_sandbox`，但目前文件、型別與程式流程都有使用 `is_sandbox`。這表示 repo 內的 `schema.sql` 可能不是目前 Supabase 遠端資料庫的完整最新狀態，未來真正 migration 前要先備份並重新比對遠端 schema。

### 16.3 TypeScript 型別狀態

`lib/types.ts` 目前有這些型別：

- `Customer`：大致對應 `customers`
- `Message`：大致對應 `messages`
- `KbArticle`：對應 `knowledge_articles` 的前端顯示需求
- `AppointmentStatus` / `AppointmentRequest`：對應 `appointment_requests` 的前端顯示與狀態值
- `AbnormalAlert`：對應 `abnormal_alerts` 的前端顯示需求
- `ManualReplyTask`：對應 `manual_reply_tasks` 的前端工作台需求
- `ConversationLog`：前端 Conversation Logs 顯示用，不是完整 `messages` DB schema 型別
- `SandboxKnowledgeAnswer`：Knowledge Base 沙盒回答 API 的回傳型別，不是 Supabase table 型別

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

### 16.4 supabaseClient 使用方式

`lib/supabaseClient.ts` 使用 `@supabase/supabase-js` 的 `createClient` 建立 client，讀取：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

目前仍有 `isSupabaseConfigured` 與 `supabaseEnvWarning`，環境變數缺少時頁面會回到 mock data / warning 流程。client 建立時關閉 `autoRefreshToken` 與 `persistSession`。這份檔案沒有使用或暴露 `service_role` key。

目前 `supabaseRequest` 支援：

- `GET`：`.select(...)`，支援 `select` 與 `order`
- `POST`：`.insert(body).select()`
- `PATCH`：`.update(body)`，支援 query 裡的 `eq.` 條件後 `.select()`
- `DELETE`：`.delete()`，支援 query 裡的 `eq.` 條件後 `.select()`

程式裡有傳入 `prefer: "return=representation"` 的地方，但目前 `supabaseRequest` 沒有實際使用 `prefer` 參數；實際回傳是靠 supabase-js 的 `.select()`。

### 16.5 目前頁面實際使用的表與欄位

- Knowledge Base 頁面使用 `knowledge_articles`：讀取 `*` 並依 `updated_at` 排序；新增 / 更新 `title`, `category`, `content`, `is_active`, `updated_at`；切換 `is_active`；依 `id` 刪除。`/api/sandbox/knowledge-answer` 會查 `id`, `title`, `category`, `content`, `is_active`，只取 `is_active = true` 並依 `updated_at` 排序。
- Appointment Requests 頁面使用 `appointment_requests`：讀取 `*` 並依 `requested_at` 排序；顯示 `id`, `is_sandbox`, `pet_name`, `service`, `owner_name`, `requested_at`, `status`；更新 `status`, `updated_at`；刪除 `id`；Conversation Logs 建立 Sandbox 預約時寫入 `owner_name`, `service`, `pet_name`, `requested_at`, `status`, `is_sandbox`；改約流程會用 `id`, `is_sandbox`, `status` 當條件更新 `requested_at`, `status`。
- Abnormal Alerts 頁面使用 `abnormal_alerts`：讀取 `*` 並依 `triggered_at` 排序；顯示 `id`, `severity`, `title`, `triggered_at`, `summary`, `is_resolved`；標記已處理時更新 `is_resolved`, `resolved_at`。
- Manual Reply Tasks 頁面使用 `manual_reply_tasks`：讀取 `*` 並依 `waiting_minutes` 排序；顯示 `id`, `customer`, `source_channel`, `customer_line_user_id`, `topic`, `last_message`, `reply_note`, `waiting_minutes`, `priority`, `is_replied`, `replied_at`；標記已回覆時更新 `is_replied`, `replied_at`。
- Conversation Logs 頁面目前讀取 `messages`：查 `id`, `channel`, `content`, `created_at`, `customers(name)`，整理成前端 `ConversationLog` 顯示。沙盒對話本身存在前端 state，Appointment / Abnormal / Manual Reply / Knowledge Gap 的沙盒回寫多數走 localStorage helper。
- 目前明確沒有把沙盒回覆寫入 Supabase `messages`，也沒有送 LINE。

目前 localStorage sandbox helper 包含：

- `lib/sandboxConversationEvents.ts`
- `lib/sandboxCustomerRescheduleEvents.ts`
- `lib/sandboxAbnormalAlertEvents.ts`
- `lib/sandboxAbnormalAlertResolutionEvents.ts`
- `lib/sandboxManualReplyTaskEvents.ts`
- `lib/sandboxManualReplyResolutionEvents.ts`
- `lib/sandboxKnowledgeGapEvents.ts`
- `lib/sandboxArchivePolicy.ts`

### 16.6 對照 Archive Schema Planning v1 的缺口

`manual_reply_tasks` 目前在 `schema.sql` 已有 `is_replied`, `replied_at`，但未來可能仍缺：

- `reply_note`（types / 頁面已用，但 `schema.sql` 沒有）
- `source_channel`（types / 頁面已用，但 `schema.sql` 沒有）
- `customer_line_user_id`（types / 頁面已用，但 `schema.sql` 沒有）
- `last_message`（types / 頁面已用，但 `schema.sql` 沒有）
- `resolved_at`
- `resolved_by`
- `resolution_note`
- `archive_status`
- `archived_at`
- `archive_batch_id`

`abnormal_alerts` 目前在 `schema.sql` 已有 `severity`, `is_resolved`, `resolved_at`，但未來可能仍缺：

- `resolved_by`
- `resolution_note`
- `follow_up_required`
- `follow_up_at`
- `archive_status`
- `archived_at`
- `archive_batch_id`

`appointment_requests` 目前在 `schema.sql` 已有 `status`，但未來可能仍缺：

- `is_sandbox`（目前程式已使用，但 `schema.sql` 沒列）
- `confirmed_at`
- `rejected_at`
- `completed_at`
- `resolved_at`
- `archive_status`
- `archived_at`
- `archive_batch_id`

`messages` / Conversation Logs 未來可能缺：

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

`knowledge_gap_events` 目前不是 Supabase table。Knowledge Gap 仍是 localStorage sandbox，不應本次急著新增 table。只有未來正式決定要把 Knowledge Gap 從沙盒轉成 Supabase 儲存時，才需要重新討論 table 與 migration。

`event_audit_logs` 目前也是未來規劃，不應本次新增 table。未來要做正式 LINE、封存、狀態變更追蹤、人工操作追查時，才適合進入 migration planning。

### 16.7 目前不建議急著加的內容

目前不建議急著加：

- `deleted_at`
- `event_audit_logs` table
- `knowledge_gap_events` table
- archive cron 相關欄位或排程
- LINE `sent_to_line` / `sent_at` 相關正式送訊息欄位
- staff / actor / `resolved_by`，在尚未完成登入與員工身份前不急著加
- RLS / login 相關欄位或 policy

原因是目前仍是沙盒階段，還沒有正式 LINE、登入 / RLS、audit log、備份 / 還原機制。太早 migration 會讓資料模型變複雜，而且不一定符合之後真實營運流程。

### 16.8 未來最小 migration v1 候選方向

以下不是本次 PR 要做的事，只是 review 結論。未來若使用者明確確認要進入 migration planning，可以偏保守考慮：

- 先只補 `manual_reply_tasks` / `abnormal_alerts` / `appointment_requests` 的處理備註與處理時間欄位。
- 先釐清 `schema.sql` 與遠端 Supabase 是否不同步，特別是 `appointment_requests.is_sandbox` 與 `manual_reply_tasks.reply_note` 等欄位。
- 先不要新增 `event_audit_logs`。
- 先不要新增 `deleted_at`。
- 先不要做 archive cron。
- 先不要讓 `messages` 進入正式 LINE 流程。
- 真正 migration 前，要先備份 Supabase schema / data，並由使用者明確確認。

### 16.9 需要等後續階段再討論的欄位或表

以下內容需要等 audit log / login / RLS / 正式 LINE 階段再討論：

- `event_audit_logs`
- `actor_id`, `actor_name`, `resolved_by`, `updated_by`
- `sent_to_line`, `sent_at`
- `reply_policy_mode`
- `audit_log_id`
- 正式 `conversation_id` 設計
- RLS policy、staff users、登入身份與權限欄位

### 16.10 安全結論

Archive Schema Review v1 完成後，下一步仍不應直接進入正式封存或 LINE 上線。比較安全的下一步可能是：

- Archive Minimal Migration Planning v1
- Audit Log Planning v1
- Formal LINE Readiness Checklist v1

實際下一步仍需要由使用者明確確認。本次 review 不代表要馬上 migration。
