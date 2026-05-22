# Archive Minimal Migration Execution Plan v1

資料日期：2026-05-22

## 1. 文件目的

本文件是未來真正執行 Supabase archive minimal migration 前的執行計畫。它用來整理操作順序、執行前檢查、停止條件、驗證 SQL、rollback 風險與文件更新建議。

本文件不是 migration，不是授權執行 SQL，也不是要求使用者立刻到 Supabase SQL Editor 貼上 SQL。使用者沒有再次明確同意前，不能執行任何 SQL，不能修改遠端 Supabase DB，也不能把本文件中的 SQL 草案當成已核准指令。

目前專案仍是 NEW-PIGHOUSE- / new-pighouse-pjdh 的沙盒 / MVP / 內部流程驗證階段，不是正式 LINE 上線階段。

## 2. 執行範圍

第一波最保守 archive minimal migration 只包含三張事件表，每張表只新增三個 archive 欄位。

`abnormal_alerts`：

- `archive_status text not null default 'active'`
- `archived_at timestamptz`
- `archive_batch_id text`

`manual_reply_tasks`：

- `archive_status text not null default 'active'`
- `archived_at timestamptz`
- `archive_batch_id text`

`appointment_requests`：

- `archive_status text not null default 'active'`
- `archived_at timestamptz`
- `archive_batch_id text`

本範圍只建立未來可標記封存、記錄封存時間、追溯封存批次的最低能力。不改 UI，不自動封存，不隱藏資料，不搬移資料，不刪資料。

## 3. 明確不包含

本次 execution plan 明確不包含：

- 不包含 `resolution_note`
- 不包含 `follow_up_required`
- 不包含 `follow_up_at`
- 不包含 `resolved_at`
- 不包含 `confirmed_at`
- 不包含 `rejected_at`
- 不包含 `completed_at`
- 不包含 `deleted_at`
- 不包含 `event_audit_logs` table
- 不包含 `knowledge_gap_events` table
- 不包含 `messages` 正式 LINE 欄位
- 不包含 `sent_to_line`
- 不包含 `sent_at`
- 不包含 LINE webhook
- 不包含 LINE signature validation
- 不包含正式 LINE 自動回覆
- 不包含 RLS / login / `staff_users`
- 不包含 cron / Edge Function
- 不包含物理刪除

## 4. 執行前人工確認清單

真正執行任何會修改遠端 DB 的 SQL 前，必須逐項確認：

- [ ] 使用者已明確說「同意執行 archive minimal migration」
- [ ] 已確認 Supabase project 是 `new-pighouse`
- [ ] 已確認 Supabase URL 是 `https://iiwyaopmpdglpsnltaij.supabase.co`
- [ ] 已完成 `docs/SUPABASE_BACKUP_CHECKLIST.md`
- [ ] 已匯出三張表 CSV
- [ ] 已保存 `information_schema` 查詢結果
- [ ] 已保存 row count 查詢結果
- [ ] 已確認 `main` 最新 commit
- [ ] 已確認這會改遠端 DB
- [ ] 已確認不是 Preview / 舊 project / 錯 URL
- [ ] 已確認本次不碰 LINE / `messages` / RLS / login

## 5. 執行前必跑查詢 SQL

以下 SQL 只查詢，不修改 schema，也不修改資料。

### 查三張表目前所有欄位

```sql
select
  table_name,
  ordinal_position,
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'abnormal_alerts',
    'manual_reply_tasks',
    'appointment_requests'
  )
order by table_name, ordinal_position;
```

### 查三張表 row count

```sql
select 'abnormal_alerts' as table_name, count(*) as row_count
from public.abnormal_alerts
union all
select 'manual_reply_tasks' as table_name, count(*) as row_count
from public.manual_reply_tasks
union all
select 'appointment_requests' as table_name, count(*) as row_count
from public.appointment_requests
order by table_name;
```

### 查三個 archive 欄位是否已存在

```sql
select
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'abnormal_alerts',
    'manual_reply_tasks',
    'appointment_requests'
  )
  and column_name in (
    'archive_status',
    'archived_at',
    'archive_batch_id'
  )
order by table_name, column_name;
```

## 6. 停止條件

如果遇到以下任何狀況，不能執行 migration：

- Supabase project 或 URL 不對
- 使用者沒有明確同意
- 備份沒有完成
- `information_schema` 查詢結果不清楚
- 三個 archive 欄位已經存在但型別或 default 不一致
- 發現其他未知欄位或不確定狀況
- SQL Editor 顯示的 project 與預期不同
- ChatGPT 沒有完成最後確認

遇到停止條件時，應先停下來整理問題，不要用猜測方式繼續貼 SQL。

## 7. 最終 SQL 草案

以下 SQL 仍是 Execution Plan 文件中的草案，不可在沒有使用者再次明確同意前執行。

```sql
-- Archive Minimal Migration Execution Plan v1
-- Draft only. Do not execute without explicit user approval.
-- First-wave conservative archive columns only.

alter table public.abnormal_alerts
  add column if not exists archive_status text not null default 'active',
  add column if not exists archived_at timestamptz,
  add column if not exists archive_batch_id text;

alter table public.manual_reply_tasks
  add column if not exists archive_status text not null default 'active',
  add column if not exists archived_at timestamptz,
  add column if not exists archive_batch_id text;

alter table public.appointment_requests
  add column if not exists archive_status text not null default 'active',
  add column if not exists archived_at timestamptz,
  add column if not exists archive_batch_id text;
```

這份 SQL 草案只使用 `add column if not exists`，只加三欄，三張表都包含相同三欄。不加 check constraint，不新增 table，不新增 migration。

## 8. 執行步驟建議

未來若真的進入執行階段，建議照以下順序操作：

1. 先在 Supabase SQL Editor 貼上前置查詢 SQL。
2. 執行查詢後，截圖保存結果，並保存查詢輸出。
3. 確認沒有命中停止條件後，再貼 migration SQL。
4. 執行後立刻跑驗證 SQL。
5. 截圖保存驗證結果。
6. 開 Vercel 正式測試站 `new-pighouse-pjdh`。
7. 檢查 Appointment Requests / Abnormal Alerts / Manual Reply Tasks 頁面是否仍能打開與讀取。

## 9. 執行後驗證 SQL

以下 SQL 只查詢，不修改 schema，也不修改資料。

### 查三張表三欄是否存在

```sql
select
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'abnormal_alerts',
    'manual_reply_tasks',
    'appointment_requests'
  )
  and column_name in (
    'archive_status',
    'archived_at',
    'archive_batch_id'
  )
order by table_name, column_name;
```

### 查舊資料 archive 欄位是否維持保守狀態

```sql
select
  'abnormal_alerts' as table_name,
  count(*) as total_count,
  count(*) filter (where archive_status = 'active') as archive_status_active_count,
  count(*) filter (where archive_status is distinct from 'active') as archive_status_not_active_count,
  count(*) filter (where archived_at is null) as archived_at_null_count,
  count(*) filter (where archived_at is not null) as archived_at_not_null_count,
  count(*) filter (where archive_batch_id is null) as archive_batch_id_null_count,
  count(*) filter (where archive_batch_id is not null) as archive_batch_id_not_null_count
from public.abnormal_alerts
union all
select
  'manual_reply_tasks' as table_name,
  count(*) as total_count,
  count(*) filter (where archive_status = 'active') as archive_status_active_count,
  count(*) filter (where archive_status is distinct from 'active') as archive_status_not_active_count,
  count(*) filter (where archived_at is null) as archived_at_null_count,
  count(*) filter (where archived_at is not null) as archived_at_not_null_count,
  count(*) filter (where archive_batch_id is null) as archive_batch_id_null_count,
  count(*) filter (where archive_batch_id is not null) as archive_batch_id_not_null_count
from public.manual_reply_tasks
union all
select
  'appointment_requests' as table_name,
  count(*) as total_count,
  count(*) filter (where archive_status = 'active') as archive_status_active_count,
  count(*) filter (where archive_status is distinct from 'active') as archive_status_not_active_count,
  count(*) filter (where archived_at is null) as archived_at_null_count,
  count(*) filter (where archived_at is not null) as archived_at_not_null_count,
  count(*) filter (where archive_batch_id is null) as archive_batch_id_null_count,
  count(*) filter (where archive_batch_id is not null) as archive_batch_id_not_null_count
from public.appointment_requests
order by table_name;
```

驗證重點：舊資料的 `archive_status` 應都是 `active`，`archived_at` 應為 `null`，`archive_batch_id` 應為 `null`。

## 10. rollback 計畫

rollback 不是本次建議操作，也不是日常清理。`drop column` 會造成資料遺失。

若要 rollback，必須另開 rollback review 任務。若 `archive_status` 不全是 `active`，或 `archived_at` / `archive_batch_id` 有值，不能直接 drop。

rollback 前至少要先查三張表是否已經使用 archive 欄位：

```sql
select
  'abnormal_alerts' as table_name,
  count(*) filter (where archive_status is distinct from 'active') as archive_status_not_active_count,
  count(*) filter (where archived_at is not null) as archived_at_not_null_count,
  count(*) filter (where archive_batch_id is not null) as archive_batch_id_not_null_count
from public.abnormal_alerts
union all
select
  'manual_reply_tasks' as table_name,
  count(*) filter (where archive_status is distinct from 'active') as archive_status_not_active_count,
  count(*) filter (where archived_at is not null) as archived_at_not_null_count,
  count(*) filter (where archive_batch_id is not null) as archive_batch_id_not_null_count
from public.manual_reply_tasks
union all
select
  'appointment_requests' as table_name,
  count(*) filter (where archive_status is distinct from 'active') as archive_status_not_active_count,
  count(*) filter (where archived_at is not null) as archived_at_not_null_count,
  count(*) filter (where archive_batch_id is not null) as archive_batch_id_not_null_count
from public.appointment_requests
order by table_name;
```

### rollback 草案

不可直接執行。

```sql
-- Archive Minimal Migration Execution Plan v1 rollback draft
-- Do not execute directly.
-- Dropping columns can cause data loss.
-- Open a separate rollback review task before considering this.

alter table public.abnormal_alerts
  drop column if exists archive_batch_id,
  drop column if exists archived_at,
  drop column if exists archive_status;

alter table public.manual_reply_tasks
  drop column if exists archive_batch_id,
  drop column if exists archived_at,
  drop column if exists archive_status;

alter table public.appointment_requests
  drop column if exists archive_batch_id,
  drop column if exists archived_at,
  drop column if exists archive_status;
```

## 11. 執行後專案文件更新建議

如果未來真的執行成功，下一步才應該：

- 更新 `README.md`
- 更新 `PROJECT_STATUS.md`
- 更新或新增 schema sync 記錄
- 再規劃 Types Sync v1

本任務不做這些事。本任務只新增本 execution plan 文件。

## 12. 明確不做項目

本任務明確不做：

- 不執行 SQL
- 不改 schema
- 不新增 migration
- 不新增 table
- 不改 app / lib / api
- 不碰 `messages`
- 不接 LINE
- 不送 LINE
- 不做 RLS / login
- 不做 cron
- 不做 Edge Function
- 不刪資料
- 不處理 PR #7

## 13. 下一步建議

完成 Execution Plan v1 後，下一步不是自動執行 SQL。

下一步應由 ChatGPT 審查 PR，確認 Execution Plan 是否足夠安全。

若通過，使用者仍需另外明確同意，才可進入 Archive Minimal Migration Execution v1。
