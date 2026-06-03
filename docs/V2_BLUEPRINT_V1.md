# V2 Blueprint v1

資料日期：2026-06-03

本文件是 V2 產品藍圖。目的不是開始寫 code，而是先定義未來產品邊界、主模組、資料表概念、LINE webhook 架構與開發順序。

V2 目標：

「一套可多店使用的寵物店 LINE AI 客服工作台」

## 一、V2 核心原則

1. 一份 code，多間店使用。
2. 每店獨立 Knowledge Base。
3. 每店獨立 LINE 官方帳號設定。
4. 每店獨立人工任務。
5. 每店獨立對話紀錄。
6. AI 只做分類、查資料、產生草稿、整理待辦。
7. 高風險、預約、客訴、退款、AI 不確定、KB 找不到，一定進人工。
8. 不自動承諾空檔。
9. 不自動成立預約。
10. 系統對客人說「轉門市」或「轉人工」時，後台必須真的建立人工任務。
11. Token、API key、LINE secret 不可放前端，不可用 localStorage 保存。
12. 所有正式 LINE 回覆、人工送出、AI 分流、狀態變更都應留下 audit log。

## 二、V2 建議主模組

| 模組 | 用途 | MVP 優先度 |
| --- | --- | --- |
| Store Settings | 管理店家基本資料、店名、服務範圍、客服語氣、預設時區 | 高 |
| Knowledge Base | 管理每店可回答的價格、規則、營業時間、服務內容、FAQ | 高 |
| LINE Conversations | 保存 LINE contact、conversation、messages、AI 分流與人工處理狀態 | 高 |
| AI Triage Engine | 判斷訊息類型：KB 可回答、需補資料、預約、客訴、退款、高風險、AI 不確定 | 高 |
| Safe Reply Engine | 控制 AI 與人工草稿不可承諾空檔、不可自動成立預約、不可亂報價 | 高 |
| Human Reply Workbench | 員工每天處理人工任務、看上下文、編輯草稿、送 LINE 回覆 | 高 |
| Integration Settings | 管理 LINE、未來 POS、Google Calendar 等外部整合設定 | 中 |
| Audit Logs | 記錄 AI 判斷、人工操作、LINE 發送、設定異動 | 高 |
| Admin Dashboard | 看待處理任務、風險訊息、KB 缺口、回覆量 | 中 |

## 三、V2 建議資料表概念

以下只是概念，不是正式 SQL。

### `stores`

店家主資料。

可能欄位：

- `id`
- `slug`
- `name`
- `timezone`
- `default_locale`
- `status`
- `created_at`
- `updated_at`

### `store_integrations`

每間店的外部整合設定。

可能欄位：

- `id`
- `store_id`
- `provider`，例如 `line`
- `channel_id`
- `encrypted_channel_secret`
- `encrypted_channel_access_token`
- `status`
- `last_tested_at`
- `created_at`
- `updated_at`

### `knowledge_articles`

每店獨立知識庫。

可能欄位：

- `id`
- `store_id`
- `title`
- `category`
- `content`
- `is_active`
- `review_status`
- `created_by`
- `updated_by`
- `created_at`
- `updated_at`

### `line_contacts`

LINE 使用者與店家的關係。

可能欄位：

- `id`
- `store_id`
- `line_user_id`
- `display_name`
- `profile_picture_url`
- `status`
- `last_seen_at`
- `created_at`
- `updated_at`

### `conversations`

一段客服對話。

可能欄位：

- `id`
- `store_id`
- `line_contact_id`
- `channel`
- `status`
- `last_message_at`
- `last_ai_summary`
- `human_required`
- `created_at`
- `updated_at`

### `conversation_messages`

對話中的每一則訊息。

可能欄位：

- `id`
- `store_id`
- `conversation_id`
- `line_message_id`
- `sender_type`，例如 `customer`, `ai`, `staff`, `system`
- `direction`，例如 `incoming`, `outgoing`
- `content`
- `raw_payload`
- `created_at`

### `manual_reply_tasks`

人工回覆工作台任務。

可能欄位：

- `id`
- `store_id`
- `conversation_id`
- `source_message_id`
- `task_type`
- `priority`
- `status`
- `ai_summary`
- `draft_reply`
- `assigned_to`
- `resolved_at`
- `created_at`
- `updated_at`

### `ai_triage_logs`

AI 分流與 KB 查詢紀錄。

可能欄位：

- `id`
- `store_id`
- `conversation_id`
- `message_id`
- `triage_result`
- `task_type`
- `confidence`
- `used_knowledge_base`
- `matched_article_ids`
- `fallback_reason`
- `model`
- `created_at`

### `audit_logs`

正式操作稽核紀錄。

可能欄位：

- `id`
- `store_id`
- `actor_type`
- `actor_id`
- `action`
- `target_type`
- `target_id`
- `before`
- `after`
- `metadata`
- `created_at`

### `staff_users` 或 `staff_members`

店家員工與權限。

可能欄位：

- `id`
- `store_id`
- `user_id`
- `name`
- `role`
- `status`
- `created_at`
- `updated_at`

## 四、多店 LINE webhook 建議架構

未來不適合只用一個固定 webhook，原因是：

- 每間店的 LINE Channel Secret 不同。
- 每間店的 Channel Access Token 不同。
- 每間店的 Knowledge Base 不同。
- 每間店的人工任務與對話紀錄必須隔離。
- 如果只靠單一 env，未來新增店家就會變成改部署環境變數，無法由後台安全管理。

建議架構可以使用：

`/api/line/webhook/[storeSlug]`

或其他能穩定識別店家的方法。

webhook 收到事件後應做：

1. 依 `storeSlug` 找到 `stores`。
2. 取得該店 `store_integrations` 中加密保存的 LINE Channel Secret。
3. 用該店 Channel Secret 驗證 `x-line-signature`。
4. 取得該店加密保存的 Channel Access Token。
5. 依 LINE user id 找到或建立 `line_contacts`。
6. 找到或建立該店的 `conversations`。
7. 將 incoming message 寫入 `conversation_messages`。
8. 依該店 Knowledge Base 與店家設定執行 AI triage。
9. 若可安全自動回覆，產生回覆並記錄 `ai_triage_logs` 與 outgoing message。
10. 若需人工，建立 `manual_reply_tasks`，並只回安全安撫文或不自動回覆，依產品設定決定。
11. 所有重要動作寫入 `audit_logs`。

## 五、API Key / Token 管理

V2 的 token 管理原則：

- Token 不可放前端。
- 不可用 `NEXT_PUBLIC_` 暴露 secret。
- 不可存 localStorage。
- 不可把 LINE token、Channel Secret、Gemini API Key 貼進 GitHub。
- 未來應加密保存在後端資料表或安全 secret store。
- 後台只能顯示遮蔽值，例如 `••••••abcd`。
- 後台應提供「測試連線」功能。
- 後台應提供「重新設定」功能。
- token 更新、測試、失敗、停用都要寫 audit log。

對多店 V2 來說，LINE token 不應長期依賴單一 Vercel env。env 可以保留系統級 master secret 或加密 key，但每店 LINE 設定應透過後端安全流程管理。

## 六、V2 與現有系統的取捨

### 可以直接沿用的概念

- Knowledge Base 是自動回覆唯一依據。
- 不把整包 KB 丟給 AI，只取少量相關內容。
- AI 不確定、KB 找不到、高風險、客訴、退款、預約、改約、取消都進人工。
- 預約與問空檔不能自動承諾。
- 人工回覆工作台是員工日常主入口。
- Sandbox 已驗證出多種任務類型，這些分類可成為 V2 task type。

### 可以參考但不建議照搬的 code

- `lib/sandboxCustomerServiceTriage.ts`：可參考分類規則，但 V2 應改正式命名與 store-aware input。
- `lib/sandboxKnowledgeAnswer.ts`：可參考 active KB + Gemini 回答流程，但 V2 需要正式搜尋、store scope、triage log。
- `lib/sandboxKnowledgeQueryGuard.ts`：可參考安全限制，但 V2 應併入 Safe Reply Engine。
- `lib/sandboxAppointmentAvailabilityReply.ts`：可參考安全文案，但 V2 應集中管理。
- `app/conversation-logs/page.tsx`：可參考測試體驗與 debug 欄位，但 V2 頁面應拆成正式 conversation view 與測試工具。
- `app/manual-reply-tasks/page.tsx`：可參考工作台概念，但正式資料來源應只來自 server-side DB。

### 應該重寫的部分

- LINE webhook。
- conversation / messages 資料模型。
- manual reply task 正式落地。
- token / integration settings 管理。
- audit log。
- 多店 store scope。
- RLS / login / staff 權限。
- 正式 LINE 人工送出流程。

### 應該移除或停止延伸的 sandbox / legacy 方向

- localStorage sandbox 任務作為正式資料來源。
- Appointment Requests 作為主產品流程。
- Abnormal Alerts 作為獨立主產品流程。
- 單店 PIG HOUSE prompt 與固定 env token 假設。
- 舊預約改約 / 拒絕 / reschedule sandbox API 作為正式流程。
- mock data fallback 在正式營運頁面中扮演主要資料。

## 七、V2 最小可行版本建議

V2 MVP 只做：

- 單店，但以多店架構設計。
- Store Settings 基本資料。
- KB CRUD。
- LINE webhook。
- 對話保存。
- AI 分流。
- 人工回覆工作台。
- 人工送出 LINE 回覆。
- 基本 audit log。

V2 MVP 不做：

- POS。
- Google Calendar。
- 自動預約成功。
- 複雜 dashboard。
- 多角色權限細節。
- 付款。
- 多租戶商業版 billing。

MVP 的重要判斷是：就算第一版只開一間店，也要先有 `store_id` 與 store-aware 架構，避免之後從單店硬改多店。

## 八、V2 開發順序建議

### Phase 0：建立新 repo 或新乾淨 branch

目標是把 V2 與現有 prototype 隔離。

建議：

- 從目前 repo 開新乾淨 branch，或另開 V2 repo。
- 先不要搬全部 app / lib。
- 只挑概念與必要 helper 重寫。
- 保留現有 main 作為 prototype 參考，不在上面繼續堆正式功能。

### Phase 1：資料模型與 Store Settings

先定義：

- stores
- staff_members 或 staff_users
- store_integrations
- knowledge_articles store scope
- conversations
- conversation_messages
- manual_reply_tasks
- ai_triage_logs
- audit_logs

這階段先做資料模型與最小頁面，不接正式 LINE 發送。

### Phase 2：KB 與 LINE contact / conversation 保存

建立：

- KB CRUD。
- LINE contact 建立 / 查詢。
- conversation 建立 / 查詢。
- incoming message 保存。

這階段可以先做 webhook 接收與保存，但不急著自動回覆。

### Phase 3：AI triage engine

建立：

- 訊息分類。
- KB 查詢。
- 低風險 KB 自動回覆候選。
- 人工任務建立規則。
- ai_triage_logs。

這階段應先驗證「該轉人工時一定真的有任務」。

### Phase 4：Human Reply Workbench

建立員工主入口：

- 看 conversation context。
- 看 AI summary。
- 看 task type / priority。
- 編輯草稿。
- 標記處理中 / 已處理。
- 留下 audit log。

這階段仍可先不送真 LINE，只做草稿與狀態。

### Phase 5：LINE 人工回覆

建立正式人工送 LINE：

- staff 按下送出。
- server-side 使用該店 token 發送。
- 寫 outgoing message。
- 更新 task status。
- 寫 audit log。
- 防止重送。

這階段不應讓前端持有 token。

### Phase 6：安全與審計

補齊：

- RLS / login / staff permission。
- token rotation。
- masked token display。
- test connection。
- audit log 查詢。
- error retry。
- webhook failure log。

## 九、初步建議

若目標是真正可多店複製的 LINE AI 客服工作台，建議 V2 不要直接在現有 prototype 上一路改到底。

比較安全的做法是：

1. 凍結現有 main 新功能。
2. 用本次 audit 文件確認哪些概念要保留。
3. 開新乾淨 branch 或新 repo 建 V2。
4. 先做 store-aware 資料模型。
5. 再把現有 sandbox 裡已驗證過的分類、安全文案、KB guard 概念重寫進正式 module。

這樣可以保留原型驗證成果，但避免把 sandbox、legacy、localStorage、單店 env 與 live LINE test 混成正式產品。
