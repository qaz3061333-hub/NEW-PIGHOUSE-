# Archive Minimal Migration SQL Draft v1

資料日期：2026-05-18

本文件只是「未來可能執行的最小封存欄位 migration SQL 草案文件」，不是 migration，也不是執行指令。不可要求使用者直接複製 SQL 到 Supabase SQL Editor 執行。真正執行前，仍需要另開 `Archive Minimal Migration Review v1`，由 ChatGPT 審查 SQL、確認備份、確認 Supabase project、確認遠端欄位，並取得使用者明確同意。

本次沒有執行 SQL、沒有改 Supabase schema、沒有新增 migration 檔案、沒有新增 table、沒有修改 app / lib / api / helper，也沒有接 LINE、送 LINE 訊息、寫正式 Supabase `messages`、做 cron、做 Edge Function、改 RLS / login、改 Vercel env 或處理 PR #7。

## 1. 這次最小 migration 候選欄位

### abnormal_alerts 候選欄位

| 欄位 | 型別 | 為什麼加 |
| --- | --- | --- |
| `resolution_note` | `text` | 留下人工處理備註，避免只看到 `is_resolved` 卻不知道怎麼處理。 |
| `follow_up_required` | `boolean not null default false` | 標記是否還要追蹤，避免高風險事件被太早封存。 |
| `follow_up_at` | `timestamptz` | 記錄預計追蹤時間，方便未來人工複查或提醒。 |
| `archive_status` | `text not null default 'active'` | 先用文字狀態標記是否仍在工作區，不使用 enum，保留 MVP 調整彈性。 |
| `archived_at` | `timestamptz` | 記錄封存時間，方便未來查詢與回溯。 |
| `archive_batch_id` | `text` | 記錄同一批封存操作，未來若要追查或 rollback 才有線索。 |

### manual_reply_tasks 候選欄位

| 欄位 | 型別 | 為什麼加 |
| --- | --- | --- |
| `resolved_at` | `timestamptz` | 區分「已回覆」與「任務已處理完成」的時間。 |
| `resolution_note` | `text` | 留下人工處理備註，補足目前 `reply_note` 只偏向建議回覆重點的不足。 |
| `archive_status` | `text not null default 'active'` | 讓任務可以先被標記為 active / archived，而不是刪除。 |
| `archived_at` | `timestamptz` | 記錄封存時間。 |
| `archive_batch_id` | `text` | 記錄封存批次。 |

### appointment_requests 候選欄位

| 欄位 | 型別 | 為什麼加 |
| --- | --- | --- |
| `confirmed_at` | `timestamptz` | 記錄預約被確認的時間，避免只靠 `status` 推測。 |
| `rejected_at` | `timestamptz` | 記錄預約被拒絕的時間。 |
| `completed_at` | `timestamptz` | 記錄服務或預約流程完成時間。 |
| `resolved_at` | `timestamptz` | 記錄此申請已完成處理的時間，和狀態變更時間分開。 |
| `archive_status` | `text not null default 'active'` | 讓預約申請能被標記封存，不做物理刪除。 |
| `archived_at` | `timestamptz` | 記錄封存時間。 |
| `archive_batch_id` | `text` | 記錄封存批次。 |

會影響的表只有 `abnormal_alerts`、`manual_reply_tasks`、`appointment_requests`。若未來真的執行，因為都是新增欄位，且 `archive_status` / `follow_up_required` 都有保守 default，理論上不需要改現有頁面才可維持讀取與既有 PATCH。現有頁面目前主要使用 `select=*` 讀資料，並 PATCH 既有欄位；新增欄位不會自動出現在 UI，也不會讓頁面開始封存資料。不過真正執行前仍需在 Preview / Production 對照驗證。

## 2. SQL 草案

這只是草案，不可直接執行；需經 Archive Minimal Migration Review v1 審查後才能決定。

```sql
-- Archive Minimal Migration SQL Draft v1
-- 草案用途：未來可能新增最小封存治理欄位。
-- 這只是草案，不可直接執行；需經 Archive Minimal Migration Review v1 審查後才能決定。

alter table public.abnormal_alerts
  add column if not exists resolution_note text,
  add column if not exists follow_up_required boolean not null default false,
  add column if not exists follow_up_at timestamptz,
  add column if not exists archive_status text not null default 'active',
  add column if not exists archived_at timestamptz,
  add column if not exists archive_batch_id text;

alter table public.manual_reply_tasks
  add column if not exists resolved_at timestamptz,
  add column if not exists resolution_note text,
  add column if not exists archive_status text not null default 'active',
  add column if not exists archived_at timestamptz,
  add column if not exists archive_batch_id text;

alter table public.appointment_requests
  add column if not exists confirmed_at timestamptz,
  add column if not exists rejected_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists resolved_at timestamptz,
  add column if not exists archive_status text not null default 'active',
  add column if not exists archived_at timestamptz,
  add column if not exists archive_batch_id text;
```

可選方案，先不要當成必做：未來若確認 `archive_status` 只允許固定值，可再另外評估 check constraint，例如限制在 `active`, `archive_candidate`, `archived`, `archive_blocked`。本草案先不加入 constraint，避免 MVP 階段狀態命名還沒穩定就鎖死資料。

## 3. rollback 草案

真正 rollback 前必須先確認這些欄位是否已經有資料，不能隨便 drop。若欄位已寫入處理備註、封存批次或時間，drop column 會造成資料遺失，必須先匯出或另行備份。

```sql
-- Archive Minimal Migration SQL Draft v1 rollback draft
-- 這只是 rollback 草案，不可直接執行。
-- 真正 rollback 前要確認欄位是否已有資料，不能隨便 drop。

alter table public.abnormal_alerts
  drop column if exists archive_batch_id,
  drop column if exists archived_at,
  drop column if exists archive_status,
  drop column if exists follow_up_at,
  drop column if exists follow_up_required,
  drop column if exists resolution_note;

alter table public.manual_reply_tasks
  drop column if exists archive_batch_id,
  drop column if exists archived_at,
  drop column if exists archive_status,
  drop column if exists resolution_note,
  drop column if exists resolved_at;

alter table public.appointment_requests
  drop column if exists archive_batch_id,
  drop column if exists archived_at,
  drop column if exists archive_status,
  drop column if exists resolved_at,
  drop column if exists completed_at,
  drop column if exists rejected_at,
  drop column if exists confirmed_at;
```

## 4. 執行前備份清單

真正執行前至少要完成以下確認：

1. 確認 Supabase project 是 `new-pighouse`。
2. 重新查 `information_schema.columns`，確認遠端欄位最新狀態。
3. 匯出或截圖目前 `appointment_requests` / `abnormal_alerts` / `manual_reply_tasks` 欄位。
4. 匯出重要資料，或至少確認目前三張表的資料量。
5. 確認執行者知道這會改遠端 DB，不是只改文件。
6. 確認不是 Preview / 舊 project / 錯 Supabase URL。
7. 確認使用者明確同意執行。

可用的執行前欄位盤點 SQL 草案：

```sql
select
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('appointment_requests', 'abnormal_alerts', 'manual_reply_tasks')
order by table_name, ordinal_position;
```

可用的資料量確認 SQL 草案：

```sql
select 'appointment_requests' as table_name, count(*) as row_count from public.appointment_requests
union all
select 'abnormal_alerts' as table_name, count(*) as row_count from public.abnormal_alerts
union all
select 'manual_reply_tasks' as table_name, count(*) as row_count from public.manual_reply_tasks;
```

## 5. 執行後驗證 SQL

若未來真的經審查後執行 migration，至少要用以下 SQL 確認候選欄位存在：

```sql
select
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'abnormal_alerts' and column_name in (
      'resolution_note',
      'follow_up_required',
      'follow_up_at',
      'archive_status',
      'archived_at',
      'archive_batch_id'
    ))
    or
    (table_name = 'manual_reply_tasks' and column_name in (
      'resolved_at',
      'resolution_note',
      'archive_status',
      'archived_at',
      'archive_batch_id'
    ))
    or
    (table_name = 'appointment_requests' and column_name in (
      'confirmed_at',
      'rejected_at',
      'completed_at',
      'resolved_at',
      'archive_status',
      'archived_at',
      'archive_batch_id'
    ))
  )
order by table_name, column_name;
```

## 6. 本次明確不做

本次不做以下欄位、table 或功能：

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
- Supabase schema 實際修改
- migration 檔案
- app / lib / api 行為修改

## 7. 暫緩欄位與 table 的原因

`resolved_by` / `actor_id` / `updated_by` 暫緩，因為目前沒有 login、staff identity、staff_users 或穩定的權限模型。若現在先加這些欄位，未來可能填入不一致的人名、空值或臨時字串，反而讓 audit 與責任歸屬更混亂。

`event_audit_logs` 很重要，因為未來狀態變更、人工處理、AI 分流、LINE 發送與封存都應留下可追查紀錄。不過它需要先決定 actor、action、event type、metadata、RLS 與保留政策。本次目標是最小欄位草案，不新增 table，避免在 audit log 設計還沒穩定前先建立錯誤結構。

`deleted_at` 本次不加，因為目前仍是沙盒 / MVP 階段，還沒有完整備份、還原、audit log 與權限流程。封存應先用 `archive_status` 這種可回溯的標記，不應太早導入容易被誤解成刪除流程的欄位。

`messages` 正式 LINE 欄位本次不加，包含 `sent_to_line`、`sent_at`、正式 `conversation_id`、`sender_type`、`reply_policy_mode` 等。原因是目前不接真 LINE、不送 LINE、不寫正式 Supabase `messages`，且正式 LINE 需要 webhook、signature validation、權限、稽核與資料模型一起設計，不能只補幾個欄位就上線。
