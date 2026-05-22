# Archive Minimal Migration Execution Record v1

資料日期：2026-05-22

## 1. 文件目的

本文件記錄 Archive Minimal Migration 第一波已實際在遠端 Supabase DB 執行完成。

本文件只作為執行完成後的紀錄，目的在於保留實際執行範圍、驗證結果、頁面確認結果與後續風險提醒。

本文件不是 SQL 執行文件，不是新的 migration，也不是 app 功能修改。

## 2. 執行日期與環境

- 日期：2026-05-22
- Supabase project：`new-pighouse`
- Supabase URL：`https://iiwyaopmpdglpsnltaij.supabase.co`
- Vercel project：`new-pighouse-pjdh`
- 專案階段：沙盒 / MVP / 內部流程驗證階段，不是正式 LINE 上線階段
- 相關 repo 參考：PR #53 已合併，merge commit `c65045dd9e9e1ff248030a4c246639247cc10202`

## 3. 已執行 DB 變更

使用者已於 2026-05-22 明確同意，並實際在 Supabase `new-pighouse` 執行 Archive Minimal Migration 第一波 SQL。

本次已在三張事件表新增相同三個 archive 欄位。

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

本次只新增上述三張表的 archive 欄位。沒有新增 table，沒有新增 repo migration 檔，也沒有修改 app 行為。

## 4. 驗證結果

使用者提供的執行後驗證結果如下：

- `information_schema` 查詢確認 9 個欄位存在。
- `abnormal_alerts` 共有 6 筆舊資料，全部 `archive_status = active`。
- `appointment_requests` 共有 13 筆舊資料，全部 `archive_status = active`。
- `manual_reply_tasks` 共有 9 筆舊資料，全部 `archive_status = active`。
- 三張表的 `archived_at` 全部為 `null`。
- 三張表的 `archive_batch_id` 全部為 `null`。

這代表第一波 archive 欄位已存在，且舊資料維持保守預設狀態：尚未封存、沒有封存時間、沒有封存批次。

## 5. 後台頁面驗證

使用者已確認正式測試站 `new-pighouse-pjdh` 以下三個後台頁面仍可正常打開：

- Appointment Requests
- Abnormal Alerts
- Manual Reply Tasks

本次執行後沒有回報上述頁面無法打開或讀取異常。

## 6. 本次沒有做的事

本次 execution record 只記錄已完成的遠端 DB 第一波 archive 欄位新增與驗證結果。

本次沒有做以下事項：

- 沒有接 LINE
- 沒有送 LINE
- 沒有寫正式 Supabase messages
- 沒有改 app / lib / api
- 沒有改 helper
- 沒有改 `lib/types.ts`
- 沒有改 `supabase/schema.sql`
- 沒有新增 migration 檔
- 沒有新增 table
- 沒有做 RLS / login
- 沒有做 cron / Edge Function
- 沒有刪資料
- 沒有改 Vercel env
- 沒有處理 PR #7

## 7. 重要風險提醒

遠端 Supabase DB 已經比 repo 的 `supabase/schema.sql` 更新。

之後不能只看 repo 內的 `supabase/schema.sql` 判斷欄位是否存在，因為 `abnormal_alerts`、`manual_reply_tasks`、`appointment_requests` 遠端 DB 已新增 archive 欄位，但 repo schema 檔尚未同步反映這次遠端狀態。

下個階段應先做 Types Sync v1。Types Sync v1 只能根據已執行的遠端 DB 欄位更新 `lib/types.ts`，讓 TypeScript 型別反映目前 DB 已存在的 archive 欄位。

Types Sync v1 仍不應改 app 行為，不應自動封存，不應做 cron，也不應接 LINE。

## 8. 下一步建議

下一步建議是 Types Sync v1。

目標是讓 `lib/types.ts` 反映遠端 DB 已新增的 archive 欄位。

Types Sync v1 仍不應改 UI 行為、不應自動封存、不應接 LINE、不應新增 cron。
