# Archive Minimal Migration SQL Draft v1

資料日期：2026-05-22

本文件已依 `Archive Minimal Migration Review v1` 修訂為「第一波保守版」。本文件仍然只是未來可能執行的 SQL 草案，不是 migration，也不是執行指令。不可要求使用者直接複製 SQL 到 Supabase SQL Editor 執行。

真正執行前，必須先完成 `docs/SUPABASE_BACKUP_CHECKLIST.md` 的 Supabase Backup Checklist v1，並另行整理 execution plan、檢查點與人工確認步驟。沒有使用者明確同意前，不得執行任何 SQL，也不得修改遠端 Supabase DB。

本次文件修訂沒有執行 SQL、沒有改 Supabase schema、沒有新增 migration 檔案、沒有新增 table、沒有修改 app / lib / api / helper，也沒有接 LINE、送 LINE 訊息、寫正式 Supabase `messages`、做 cron、做 Edge Function、改 RLS / login、改 Vercel env、刪資料或處理 PR #7。

## 1. 第一波保守版候選欄位

第一波只建議在三張事件表加入三個 archive 欄位：

- `archive_status text not null default 'active'`
- `archived_at timestamptz`
- `archive_batch_id text`

適用表：

- `abnormal_alerts`
- `manual_reply_tasks`
- `appointment_requests`

這三個欄位的目的只是先建立「可標記封存、可記錄封存時間、可追溯封存批次」的最低能力。第一波不定義完整處理流程，不要求頁面開始隱藏 archived 資料，也不做任何自動封存。

## 2. 為什麼第一波只做 archive 三欄

第一波只做 archive 三欄，是因為目前專案仍是沙盒 / MVP / 內部流程驗證階段，不是正式 LINE 上線階段。比較安全的做法是先建立封存標記能力，讓資料未來可以被標記為 active / archived 類型的狀態，而不是現在就補齊完整客服處理流程。

這樣做的好處是：

- 先建立封存標記能力，但不先定義完整處理流程。
- 不影響現有頁面；現有頁面目前不會因為這三欄自動改變篩選、隱藏或封存行為。
- 不碰人工責任歸屬；目前還沒有正式 login、staff identity、RLS 與 audit log 設計，不適合先加 `resolved_by` / `actor_id` 類欄位。
- 不碰正式 LINE messages；目前仍不接 LINE、不送 LINE、不寫正式 Supabase `messages`。
- 不碰 audit log；`event_audit_logs` 需要獨立設計 actor、action、event type、metadata、權限與保存政策。
- 不做自動封存；第一波只讓 DB 未來具備標記能力，不做 cron、Edge Function、排程或自動搬移資料。

## 3. 第二波延後欄位

以下欄位不放在第一波 SQL 草案中。它們可能有價值，但牽涉處理語意、頁面流程、人工責任、正式 LINE、audit log 或 staff identity，應等 UI 與人工流程更清楚後再討論。

`abnormal_alerts` 第二波延後欄位：

- `resolution_note`
- `follow_up_required`
- `follow_up_at`

`manual_reply_tasks` 第二波延後欄位：

- `resolved_at`
- `resolution_note`

`appointment_requests` 第二波延後欄位：

- `confirmed_at`
- `rejected_at`
- `completed_at`
- `resolved_at`

## 4. SQL 草案

這只是第一波保守版 SQL 草案，不可直接執行。真正執行前必須先完成 `docs/SUPABASE_BACKUP_CHECKLIST.md`，並另開 `Archive Minimal Migration Execution Plan v1` 整理最終操作計畫、檢查點與人工確認步驟。

```sql
-- Archive Minimal Migration SQL Draft v1
-- Revision: first-wave conservative version based on Archive Minimal Migration Review v1.
-- Draft only. Do not execute directly.

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

第一波先不加 check constraint。`archive_status` 先使用 `text not null default 'active'`，保留 MVP 階段調整命名與流程的彈性。等 UI、人工封存規則與未來 audit log 設計更穩定後，再用單獨任務評估是否需要 constraint。

## 5. rollback 草案

這只是 rollback 草案，不可直接執行。`drop column` 會造成資料遺失；真正 rollback 前必須先確認欄位是否已有資料，並另開 rollback review 任務。

```sql
-- Archive Minimal Migration SQL Draft v1 rollback draft
-- Draft only. Do not execute directly.
-- Dropping columns can cause data loss.

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

## 6. 執行前備份清單

執行前備份清單以 `docs/SUPABASE_BACKUP_CHECKLIST.md` 為準。真正執行前必須先完成 Supabase Backup Checklist v1，至少包含：

1. 確認 Supabase project 是 `new-pighouse`。
2. 確認 Supabase URL 是 `https://iiwyaopmpdglpsnltaij.supabase.co`。
3. 確認不是舊 project / preview / 錯 URL。
4. 重新查 `information_schema.columns`，確認遠端欄位最新狀態。
5. 匯出或截圖 `abnormal_alerts` / `manual_reply_tasks` / `appointment_requests` 欄位狀態。
6. 匯出三張表 CSV，或至少保存 row count 查詢結果。
7. 確認使用者知道這會改遠端 DB，不是只改文件。
8. 確認使用者明確同意執行。

可用的執行前欄位盤點 SQL 草案：

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

可用的資料量確認 SQL 草案：

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

## 7. 執行後驗證 SQL

若未來真的經審查後執行 migration，至少要用以下 SQL 確認三張表都只新增第一波三個 archive 欄位：

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

也可用以下 SQL 確認舊資料是否維持保守預設狀態：

```sql
select
  'abnormal_alerts' as table_name,
  count(*) filter (where archive_status = 'active') as active_count,
  count(*) filter (where archive_status is distinct from 'active') as not_active_count,
  count(*) filter (where archived_at is null) as archived_at_null_count,
  count(*) filter (where archived_at is not null) as archived_at_not_null_count,
  count(*) filter (where archive_batch_id is null) as archive_batch_id_null_count,
  count(*) filter (where archive_batch_id is not null) as archive_batch_id_not_null_count
from public.abnormal_alerts
union all
select
  'manual_reply_tasks' as table_name,
  count(*) filter (where archive_status = 'active') as active_count,
  count(*) filter (where archive_status is distinct from 'active') as not_active_count,
  count(*) filter (where archived_at is null) as archived_at_null_count,
  count(*) filter (where archived_at is not null) as archived_at_not_null_count,
  count(*) filter (where archive_batch_id is null) as archive_batch_id_null_count,
  count(*) filter (where archive_batch_id is not null) as archive_batch_id_not_null_count
from public.manual_reply_tasks
union all
select
  'appointment_requests' as table_name,
  count(*) filter (where archive_status = 'active') as active_count,
  count(*) filter (where archive_status is distinct from 'active') as not_active_count,
  count(*) filter (where archived_at is null) as archived_at_null_count,
  count(*) filter (where archived_at is not null) as archived_at_not_null_count,
  count(*) filter (where archive_batch_id is null) as archive_batch_id_null_count,
  count(*) filter (where archive_batch_id is not null) as archive_batch_id_not_null_count
from public.appointment_requests
order by table_name;
```

## 8. 明確不做項目

本文件與本次 Draft Revision v1 明確不做：

- 不執行 SQL
- 不改 schema
- 不新增 migration
- 不新增 table
- 不改 app / lib / api
- 不改 helper
- 不碰 `messages`
- 不接 LINE
- 不送 LINE
- 不寫正式 Supabase messages
- 不做 RLS / login
- 不做 cron
- 不做 Edge Function
- 不刪資料
- 不改 Vercel env
- 不處理 PR #7
- 不新增 `deleted_at`
- 不新增 `event_audit_logs` table
- 不新增 `knowledge_gap_events` table
- 不新增 LINE webhook / LINE signature validation
- 不新增正式 LINE 自動回覆
- 不新增物理刪除流程

## 9. 下一步建議

完成 Draft Revision v1 後，下一步才適合做：

**Archive Minimal Migration Execution Plan v1**

但 Execution Plan v1 仍不代表直接執行 SQL。它只是整理真正要貼到 Supabase SQL Editor 前的最終操作計畫、檢查點與人工確認步驟。

Execution Plan v1 應該至少確認：

- 是否已完成 `docs/SUPABASE_BACKUP_CHECKLIST.md`。
- 最終 SQL 是否仍只包含三個 archive 欄位。
- rollback 風險與資料遺失提醒是否清楚。
- 使用者是否明確知道下一步會改遠端 DB。
- 使用者是否明確同意執行。

在 Execution Plan v1 完成且使用者再次明確同意前，仍不得執行 SQL。