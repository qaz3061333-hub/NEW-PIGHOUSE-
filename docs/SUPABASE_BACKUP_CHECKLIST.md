# Supabase Backup Checklist v1

資料日期：2026-05-22

本文件是未來真正執行 Supabase schema migration 前的備份與檢查 SOP。它只用來確認遠端 DB、保存執行前證據、降低誤改風險，不是 SQL 執行文件，也不代表現在要執行 migration。

在使用者沒有明確同意前，不能執行任何 SQL，不能改 Supabase 遠端 DB，也不能把本文件中的查詢誤當成 migration 指令。

## 1. 文件目的

- 這是改遠端 DB 前的備份與檢查清單。
- 這不是 SQL 執行文件。
- 這不代表現在要執行 migration。
- 使用者沒有明確同意前，不能執行任何 SQL。
- 本文件只整理未來執行前要先做的確認、備份、查詢與驗證。

## 2. 適用範圍

本 checklist 只適用於未來 Archive Minimal Migration 第一波最保守欄位：

- `archive_status`
- `archived_at`
- `archive_batch_id`

適用表只有三張：

- `abnormal_alerts`
- `manual_reply_tasks`
- `appointment_requests`

本 checklist 不包含：

- `messages`
- LINE webhook / LINE Messaging API
- RLS / login / staff identity
- `event_audit_logs`
- `knowledge_gap_events`
- cron
- Supabase Edge Function

## 3. 執行前確認

真正執行任何會改遠端 DB 的 SQL 前，至少要逐項確認：

- [ ] 確認 Supabase project 是 `new-pighouse`。
- [ ] 確認 Supabase URL 是 `https://iiwyaopmpdglpsnltaij.supabase.co`。
- [ ] 確認不是舊 project / preview / 錯 URL。
- [ ] 確認使用者知道這會改遠端 DB，不是只改文件。
- [ ] 確認使用者明確同意執行。
- [ ] 確認已閱讀 `Archive Minimal Migration Review v1`。
- [ ] 確認本次不碰 `messages` / LINE / RLS / login。

## 4. 執行前必查 SQL

以下 SQL 只查詢欄位狀態，不會改 schema。用途是確認三張表目前有哪些欄位、型別、nullable 與 default。

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

如果需要只看未來第一波 archive 欄位是否已存在，可用：

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

## 5. 執行前資料量查詢 SQL

以下 SQL 只查詢三張表目前 row count，不會改資料。

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

## 6. 執行前資料備份建議

真正執行 migration 前，請先保存足夠證據，讓之後能回頭確認「執行前長什麼樣子」。

- 匯出 `abnormal_alerts` / `manual_reply_tasks` / `appointment_requests` 三張表 CSV。
- 截圖每張表目前欄位。
- 截圖 SQL Editor 執行前畫面，包含 Supabase project 與 URL。
- 保存 `information_schema.columns` 查詢結果。
- 保存三張表 row count 查詢結果。
- 保存目前 main commit / PR 編號 / 日期。
- 保存使用者明確同意執行的對話紀錄或任務文字。

## 7. 建議備份命名規則

CSV 備份檔名建議包含 table name、日期、用途，避免之後分不清是哪一次 migration 前備份。

- `appointment_requests_backup_YYYYMMDD_before_archive_migration.csv`
- `abnormal_alerts_backup_YYYYMMDD_before_archive_migration.csv`
- `manual_reply_tasks_backup_YYYYMMDD_before_archive_migration.csv`

也可以把 SQL 查詢結果另外保存成：

- `information_schema_columns_YYYYMMDD_before_archive_migration.csv`
- `table_row_counts_YYYYMMDD_before_archive_migration.csv`

## 8. 執行後驗證清單

本任務不執行 SQL。以下只列出未來真的執行 migration 後，應該確認的事項：

- [ ] 三張表都存在 `archive_status` 欄位。
- [ ] 三張表都存在 `archived_at` 欄位。
- [ ] 三張表都存在 `archive_batch_id` 欄位。
- [ ] 舊資料的 `archive_status` 是否為 `active`。
- [ ] 舊資料的 `archived_at` 是否為 `null`。
- [ ] 舊資料的 `archive_batch_id` 是否為 `null`。
- [ ] 現有頁面是否還能打開。
- [ ] Appointment Requests 是否仍能讀取。
- [ ] Abnormal Alerts 是否仍能讀取。
- [ ] Manual Reply Tasks 是否仍能讀取。

## 9. 執行後驗證 SQL

以下 SQL 只查詢欄位是否存在，不會改 schema。

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

以下 SQL 只查詢舊資料是否仍維持安全預設狀態，不會改資料。

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

## 10. rollback 前檢查

rollback 不是日常操作，也不應該臨時貼 SQL 執行。

- rollback 不是一般清理步驟。
- `drop column` 會造成資料遺失。
- rollback 前要先查三個欄位是否已有資料。
- 若 `archive_status` 不全是 `active`，不能直接 drop。
- 若 `archived_at` 有任何值，不能直接 drop。
- 若 `archive_batch_id` 有任何值，不能直接 drop。
- 若欄位已經被任何流程使用，必須另開 rollback review 任務。
- rollback 前也應再次匯出三張表 CSV 與欄位查詢結果。

## 11. rollback 前資料檢查 SQL

以下 SQL 只查詢 rollback 風險，不會改資料。

### abnormal_alerts

```sql
select
  count(*) filter (where archive_status is distinct from 'active') as archive_status_not_active_count,
  count(*) filter (where archived_at is not null) as archived_at_not_null_count,
  count(*) filter (where archive_batch_id is not null) as archive_batch_id_not_null_count
from public.abnormal_alerts;
```

### manual_reply_tasks

```sql
select
  count(*) filter (where archive_status is distinct from 'active') as archive_status_not_active_count,
  count(*) filter (where archived_at is not null) as archived_at_not_null_count,
  count(*) filter (where archive_batch_id is not null) as archive_batch_id_not_null_count
from public.manual_reply_tasks;
```

### appointment_requests

```sql
select
  count(*) filter (where archive_status is distinct from 'active') as archive_status_not_active_count,
  count(*) filter (where archived_at is not null) as archived_at_not_null_count,
  count(*) filter (where archive_batch_id is not null) as archive_batch_id_not_null_count
from public.appointment_requests;
```

如果上述任一結果不是 0，就不能直接 drop 欄位，因為代表欄位可能已經承載狀態、時間或批次資料。

## 12. 明確不做項目

本任務明確不做：

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

## 13. 下一步建議

完成 Supabase Backup Checklist v1 後，下一步才適合做：

**Archive Minimal Migration Draft Revision v1**

目標是把原 SQL 草案修成更保守版本：第一波只包含 `archive_status` / `archived_at` / `archive_batch_id`。
