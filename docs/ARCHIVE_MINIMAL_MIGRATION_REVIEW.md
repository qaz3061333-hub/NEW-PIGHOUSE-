# Archive Minimal Migration Review v1

資料日期：2026-05-21

本文件只審查 `docs/ARCHIVE_MINIMAL_MIGRATION_DRAFT.md` 的 SQL 草案是否適合作為未來 migration 討論基礎。本次沒有執行 SQL、沒有修改 Supabase schema、沒有新增 migration，也沒有修改 app / lib / api / helper。

## 1. Review 結論摘要

`docs/ARCHIVE_MINIMAL_MIGRATION_DRAFT.md` 可以作為未來 migration 的討論基礎，但目前草案仍偏大，不建議直接照原草案執行。

最安全方向：把「封存標記」與「處理流程欄位」拆成不同階段。第一波先解決不物理刪除、可標記封存、可回溯批次；第二波才補處理備註、追蹤、完成時間等流程欄位。

建議第一波保留的欄位：

- `archive_status`
- `archived_at`
- `archive_batch_id`

這三個欄位最貼近最小封存 migration 目的，且不會立刻定義完整客服處理流程。

建議延後的欄位：

- `abnormal_alerts.resolution_note`
- `abnormal_alerts.follow_up_required`
- `abnormal_alerts.follow_up_at`
- `manual_reply_tasks.resolved_at`
- `manual_reply_tasks.resolution_note`
- `appointment_requests.confirmed_at`
- `appointment_requests.rejected_at`
- `appointment_requests.completed_at`
- `appointment_requests.resolved_at`

延後原因：這些欄位會牽涉處理語意、頁面流程、人工責任、未來 audit log、正式 LINE 或 staff identity；現在先加可能造成「欄位存在，但沒有人正確維護」的狀態。

需要再確認的設計：

- `archive_status` 狀態值是否固定。
- 封存後是否只是標記，還是未來頁面預設隱藏。
- `manual_reply_tasks.reply_note`、`replied_at`、`resolved_at`、`resolution_note` 的語意邊界。
- `appointment_requests.status` 與多個時間欄位是否重複或衝突。
- 高風險 abnormal alert 是否要先有人工作業規則，再加追蹤欄位。
- 未來 login / staff identity / audit log 如何串接。

## 2. `abnormal_alerts` 審查

### `resolution_note`

- 是否適合最小 migration：暫不建議第一波加入。它對人工處理有價值，但屬於處理紀錄，不是最小封存欄位。
- 是否可能影響現有頁面：nullable `text` 技術風險低，但若 UI 未支援填寫，欄位會長期空白，容易讓人誤以為已有處理備註制度。
- 是否需要 default：不需要。處理備註不應自動填空字串或預設文字。
- 更保守做法：第二波再加，並同步設計後台輸入位置、必填情境與未來 audit log 關係。

### `follow_up_required`

- 是否適合最小 migration：不建議第一波加入。它會開始定義異常事件追蹤流程，超過純封存欄位。
- 是否可能影響現有頁面：`boolean not null default false` 技術上安全，但語意上有風險。預設 `false` 可能被誤讀為「不需要追蹤」，尤其高風險事件不應因預設值被太早封存。
- 是否需要 default：若未來加入，技術上可用 `default false` 避免舊資料 null；但流程上要小心，應搭配 severity 與人工複查規則。
- 更保守做法：先不加。等 abnormal alert 的高風險判斷、複查流程、UI 欄位和封存條件穩定後再加。

### `follow_up_at`

- 是否適合最小 migration：不適合第一波。這是提醒 / 複查流程欄位，不是封存最小欄位。
- 是否可能影響現有頁面：nullable `timestamptz` 本身風險低，但沒有提醒機制或人工檢視頁時，資料可能被填了也沒人追。
- 是否需要 default：不需要。追蹤時間應由人工或明確規則設定。
- 更保守做法：第二波或更晚加入，並搭配 `follow_up_required`、頁面篩選與人工操作規則一起做。

### `archive_status`

- 是否適合最小 migration：適合第一波，是最核心欄位。
- 是否可能影響現有頁面：`text not null default 'active'` 通常不會破壞既有頁面；現有 `select=*` 只會多拿到欄位，既有 PATCH 也不會自動改它。
- 是否需要 default：需要。舊資料應預設為 `active`，避免 null 狀態。
- 更保守做法：第一波只用 `text not null default 'active'`，暫不加 constraint。

### `archived_at`

- 是否適合最小 migration：適合第一波，負責記錄封存時間。
- 是否可能影響現有頁面：nullable `timestamptz` 不會破壞既有頁面。
- 是否需要 default：不需要。尚未封存前應為 null。
- 更保守做法：與 `archive_status` 同步加入，但 UI 尚不自動封存。

### `archive_batch_id`

- 是否適合最小 migration：適合第一波，但只作為未來追溯批次用。
- 是否可能影響現有頁面：nullable `text` 風險低。
- 是否需要 default：不需要。
- 更保守做法：第一波加入但不寫入值，等人工封存或未來封存流程再使用。

## 3. `manual_reply_tasks` 審查

### `resolved_at`

- 是否適合最小 migration：暫不建議第一波加入。
- 特別注意：遠端 DB 已有 `replied_at`。若再加 `resolved_at`，必須先定義「已回覆」與「已處理完成」的差異。
- 是否可能影響現有頁面：技術風險低，但語意容易重疊。
- 更保守做法：先不加，等人工任務流程需要明確分成 replied / resolved 時再加。

### `resolution_note`

- 是否適合最小 migration：暫不建議第一波加入。
- 特別注意：遠端 DB 已有 `reply_note`。若新增 `resolution_note`，要清楚分出 `reply_note` 是回覆重點或回覆備註，而 `resolution_note` 是處理結案備註。
- 是否可能影響現有頁面：nullable `text` 技術風險低，但語意混亂風險高。
- 更保守做法：第二波才加，並同步調整 UI 文字與操作流程。

### `archive_status`

- 是否適合最小 migration：適合第一波。
- 是否可能影響現有頁面：不會破壞既有讀取或 PATCH。
- 是否需要 default：需要，建議 `text not null default 'active'`。
- 更保守做法：第一波先只做標記，不讓 UI 自動隱藏 archived。

### `archived_at`

- 是否適合最小 migration：適合第一波。
- 是否可能影響現有頁面：風險低。
- 是否需要 default：不需要。
- 更保守做法：與 `archive_status` 一起加入。

### `archive_batch_id`

- 是否適合最小 migration：適合第一波。
- 是否可能影響現有頁面：風險低。
- 是否需要 default：不需要。
- 更保守做法：先保留為未來人工封存或批次封存追溯欄位。

## 4. `appointment_requests` 審查

### `confirmed_at`

- 是否適合最小 migration：暫不建議第一波加入。
- 主要原因：目前仍是 sandbox 預約流程，正式預約生命週期尚未完整定義。`status = confirmed` 與 `confirmed_at` 需要 UI 同步維護，否則容易不同步。
- 更保守做法：先不加，等正式預約流程或 UI 寫入規則穩定後再補。

### `rejected_at`

- 是否適合最小 migration：暫不建議第一波加入。
- 主要原因：拒絕流程目前仍是沙盒回寫，不代表正式通知客人。
- 更保守做法：第二波再加，並同步設計 rejected 狀態轉換時自動寫入時間。

### `completed_at`

- 是否適合最小 migration：不建議第一波加入。
- 主要原因：目前沒有完整「服務完成」流程，過早加入容易變成永遠沒維護的空欄位。
- 更保守做法：等後台有完成預約 / 服務完成流程時再加。

### `resolved_at`

- 是否適合最小 migration：暫不建議第一波加入。
- 主要原因：`resolved_at` 和 `confirmed_at` / `rejected_at` / `completed_at` 的語意容易重疊。
- 更保守做法：先不加。若未來要定義「申請處理完成」與「服務完成」差異，再新增。

### `archive_status`

- 是否適合最小 migration：適合第一波。
- 是否可能影響現有頁面：不會破壞既有讀取或 PATCH。
- 是否需要 default：需要，建議 `text not null default 'active'`。
- 更保守做法：第一波加入但不改 UI 篩選，不自動封存 pending。

### `archived_at`

- 是否適合最小 migration：適合第一波。
- 是否可能影響現有頁面：風險低。
- 是否需要 default：不需要。
- 更保守做法：與 `archive_status` 同步加入。

### `archive_batch_id`

- 是否適合最小 migration：適合第一波。
- 是否可能影響現有頁面：風險低。
- 是否需要 default：不需要。
- 更保守做法：先保留為未來人工或批次封存追溯欄位。

## 5. `archive_status` 設計審查

### `text not null default 'active'` 是否適合 MVP

適合。MVP 階段還在調整流程與命名，text 比 enum 更有彈性。`not null default 'active'` 可讓舊資料有明確預設狀態。

### 是否需要 check constraint

本階段不建議加。check constraint 的好處是限制錯字與狀態污染，例如只允許 `active`、`archive_candidate`、`archived`、`archive_blocked`。但風險是狀態命名尚未定案，後續若要改名或新增狀態，會增加 migration 成本。

建議：第一波不要加 constraint。等 UI、封存流程、人工操作規則穩定後，再用單獨任務評估 constraint。

## 6. rollback 審查

原草案的 rollback 方向合理，使用 `drop column if exists` 對應新增欄位。但 rollback 不應被當成一般操作。

必須明確提醒：

- `drop column` 會造成資料遺失。
- rollback 前必須先查欄位是否已有資料。
- 若欄位已有處理備註、封存時間、封存批次，必須先匯出或備份。
- rollback 不應由使用者臨時貼 SQL 執行，應另開 rollback review 任務。

建議 rollback 前補查：

```sql
select
  count(*) filter (where archive_status is not null and archive_status <> 'active') as non_active_archive_status_count,
  count(*) filter (where archived_at is not null) as archived_at_count,
  count(*) filter (where archive_batch_id is not null) as archive_batch_id_count
from public.abnormal_alerts;
```

同樣概念應分別套用到 `manual_reply_tasks` 與 `appointment_requests`。

## 7. 備份清單審查

原備份清單方向正確，但建議補強成更具體的操作證據。

建議補充：

- 匯出 `appointment_requests` / `abnormal_alerts` / `manual_reply_tasks` 三張表 CSV。
- 截圖 Supabase project URL，確認是 `new-pighouse`。
- 截圖 SQL Editor 執行前畫面。
- 保留 `information_schema.columns` 查詢結果。
- 保留三張表 row count 查詢結果。
- 確認使用者知道這會改遠端 DB，不是只改文件。
- 確認目前不是誤連舊 Supabase project 或錯 URL。
- 執行後再截圖欄位查詢結果。

## 8. 明確不做項目審查

以下項目仍應不做：

- `deleted_at`
- `event_audit_logs` table
- `knowledge_gap_events` table
- archive cron
- `messages` 正式 LINE 欄位
- `sent_to_line`
- `sent_at`
- LINE webhook
- LINE signature validation
- 正式 LINE 自動回覆
- RLS policy
- login / `staff_users`
- Edge Function
- Vercel Cron
- 物理刪除

理由：這些都牽涉正式資料治理、身份權限、LINE 實際發送、audit log 或排程，不應混在最小封存欄位 migration 裡。

## 9. 最終建議版本

### A. 建議第一波加入

三張事件表都只加：

- `archive_status text not null default 'active'`
- `archived_at timestamptz`
- `archive_batch_id text`

適用表：

- `abnormal_alerts`
- `manual_reply_tasks`
- `appointment_requests`

第一波不改 UI、不自動封存、不做 cron、不做刪除，只讓遠端 DB 具備未來封存標記能力。

### B. 建議第二波再加入

等 UI 與人工流程更清楚後再考慮：

- `abnormal_alerts.resolution_note`
- `abnormal_alerts.follow_up_required`
- `abnormal_alerts.follow_up_at`
- `manual_reply_tasks.resolved_at`
- `manual_reply_tasks.resolution_note`
- `appointment_requests.confirmed_at`
- `appointment_requests.rejected_at`
- `appointment_requests.completed_at`
- `appointment_requests.resolved_at`

### C. 等 login / audit log / 正式 LINE 後再加入

- `resolved_by`
- `actor_id`
- `updated_by`
- `event_audit_logs`
- 正式 `messages` 欄位
- `sent_to_line`
- `sent_at`
- LINE webhook / signature validation 相關欄位
- RLS / staff_users 相關設計

### D. 現在明確不要加入

- `deleted_at`
- 物理刪除流程
- archive cron
- Vercel Cron
- Supabase Edge Function
- Knowledge Gap 正式 table

## 10. 下一步建議

下一步不應該直接執行 SQL。

較適合的下一步是：

**Supabase Backup Checklist v1**

理由：目前已經有 draft，也有 review。下一步如果繼續改 SQL 文字，效益不高；真正要走向可執行 migration，最缺的是執行前備份與驗證流程。先把備份與確認步驟變成可照做清單，比立刻改 SQL 更安全。

備選下一步：

**Archive Minimal Migration Draft Revision v1**

如果使用者希望先把草案文件修成「第一波只含三欄」的版本，也可以先做 Draft Revision。但如果以安全上線流程來看，建議先做 Supabase Backup Checklist v1，之後再做 Draft Revision / Execution SQL。

## 11. Safety confirmations

- 未修改 app / lib / api / helper
- 未修改 supabase/schema.sql
- 未新增 migration
- 未新增 table
- 未執行 SQL
- 未做 cron
- 未做 Edge Function
- 未刪資料
- 未接 LINE
- 未送 LINE 訊息
- 未寫正式 Supabase messages
- 未改 RLS / login
- 未改 Vercel env
- 未處理 PR #7
