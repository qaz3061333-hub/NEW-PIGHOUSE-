# Manual Archive Action Planning v1

資料日期：2026-05-22

## 1. 文件目的

本文件用來規劃未來「人工封存操作」應該怎麼做，適用於 NEW-PIGHOUSE- / new-pighouse-pjdh 目前的沙盒 / MVP / 內部流程驗證階段。

本文件只做 planning，不是功能實作文件，不是 SQL 執行文件，也不是自動封存設計。本次不改 UI、不新增封存按鈕、不新增封存操作、不執行 SQL、不改 Supabase schema。

目前遠端 Supabase DB 已在以下三張表新增 archive 三欄：

- `archive_status`
- `archived_at`
- `archive_batch_id`

適用資料表為：

- `appointment_requests`
- `manual_reply_tasks`
- `abnormal_alerts`

## 2. 現階段可考慮人工封存的資料

### appointment_requests

`appointment_requests` 是預約申請資料。現階段若未來要做人工封存，應只考慮流程已明確結束、已不需要客服或店員追蹤的預約。

封存候選應以人工判斷為主，不能只看單一狀態欄位就自動封存。特別是客人改約、等待確認、或還需要人工處理的預約，都不應收起。

### manual_reply_tasks

`manual_reply_tasks` 是需要人工回覆的任務。現階段若未來要做人工封存，應只考慮已回覆、已有處理紀錄、且不需要再追蹤的任務。

人工回覆任務可能包含客訴、退款、受傷、醫療疑慮等高風險內容。即使欄位看起來已回覆，也應由人確認處理內容足夠，不能自動收起。

### abnormal_alerts

`abnormal_alerts` 是異常提醒資料。現階段若未來要做人工封存，應只考慮已處理完成、風險較低、且不需要後續追蹤的事件。

高風險、受傷、退款、重大客訴、醫療疑慮、未來可能需要 audit log 的事件，不應太早開放封存。這類資料即使已標記處理，也應保守保留在可見流程中。

## 3. 每張表的封存條件草案

### appointment_requests

可封存候選：

- 已 `confirmed` 且流程已完成
- 已 `rejected` 且不需再追蹤
- sandbox 測試資料經人工確認可收起

不應封存：

- `pending`
- `proposed_new_time`
- 客人改約等待確認
- 還需要人工確認的預約

### manual_reply_tasks

可封存候選：

- `is_replied = true`
- 已有 `reply_note` 或處理紀錄
- 不需再追蹤

不應封存：

- `is_replied = false`
- `urgent` 且未處理
- 客訴、退款、受傷、醫療疑慮尚未確認

### abnormal_alerts

可封存候選：

- `is_resolved = true`
- 低風險或中風險事件已人工確認處理完成
- 不需追蹤

不應封存：

- `is_resolved = false`
- `high` severity 尚未複查
- 受傷、退款、重大客訴、醫療疑慮
- 未來需要 audit log 的事件

## 4. 人工封存操作應改哪些欄位

未來若實作單筆人工封存，點擊人工封存時只應更新以下三個欄位：

- `archive_status = 'archived'`
- `archived_at = current timestamp`
- `archive_batch_id = manually generated batch id or simple manual batch marker`

本任務不實作上述操作。本文件只記錄未來規劃，不新增任何按鈕、API、SQL、migration 或資料更新流程。

第一版人工封存不應改原本業務狀態，例如不應順手修改 `status`、`is_replied`、`is_resolved`，也不應刪除資料。

## 5. 人工取消封存 / 還原草案

未來若需要做人工取消封存或還原，可能更新以下欄位：

- `archive_status = 'active'`
- `archived_at = null`
- `archive_batch_id = null`

但還原也應該留下 audit log，記錄誰還原、何時還原、為什麼還原、還原前後狀態。目前專案還沒有 `event_audit_logs` table，因此不建議太早做還原功能。

在沒有 audit log 前，即使未來先做人工封存，也應先保持功能非常保守，避免封存與還原來回切換後無法追蹤責任與脈絡。

## 6. UI 放置規劃

以下只做未來 UI 規劃，本任務不實作：

- 按鈕應放在每筆資料的操作區
- 按鈕文字可為「標記封存」
- 點擊前應有確認訊息
- 對高風險 abnormal alert 應顯示更強警告
- 不應一開始做批次封存

確認訊息應提醒使用者：封存只是標記，不是刪除；封存後資料仍應可被查到；若缺少 audit log，封存高風險事件會增加追蹤風險。

第一版不應把「封存」放在列表頂部做大量操作，也不應提供全選或批次封存，以免誤收起尚未完成的事件。

## 7. 風險控管

第一版人工封存應採取以下限制：

- 第一版只做單筆人工封存，不做批次
- 不做自動封存
- 不做每日 00:00 cron
- 不做物理刪除
- 不預設隱藏 archived 資料
- 不封存 `high` severity 未處理事件
- 不封存 `manual_required` 未完成任務
- 不封存尚未完成的預約

其他風險控管原則：

- 封存不應取代處理完成
- 封存不應取代人工確認
- 封存不應讓資料從後台完全消失
- 封存不應讓未處理事件被誤認為已處理
- 封存不應影響 LINE、messages、RLS、login 或正式客服流程

## 8. audit log 關係

正式封存最好要有 audit log。封存與還原都屬於重要狀態變更，應能追蹤操作者、操作時間、原因、原始狀態與新狀態。

目前專案還沒有 `event_audit_logs` table。因此第一版人工封存即使可規劃，也應保守，不應擴大到批次、自動封存、預設隱藏 archived 資料，或高風險事件封存。

高風險事件最好等 audit log planning 後再開放封存。特別是受傷、退款、重大客訴、醫療疑慮、未來需要追查的事件，應先保留完整可見脈絡。

## 9. 未來實作切分建議

### Phase 1：Manual Archive Action Sandbox / MVP

- 單筆人工封存
- 只更新 `archive_status` / `archived_at` / `archive_batch_id`
- 不隱藏資料
- 不批次
- 不自動

### Phase 2：Archive Filter Readiness

- 顯示 active / archived
- 可手動切換查看
- 預設是否隱藏要另外審查

### Phase 3：Audit Log Planning

- 規劃 `event_audit_logs`
- 紀錄誰封存、何時封存、封存原因、還原紀錄

### Phase 4：Cron / 自動封存

- 只能在 audit log、備份、還原策略都完成後再考慮

## 10. 明確不做項目

本任務明確不做以下項目：

- 不改 UI
- 不新增封存按鈕
- 不新增封存操作
- 不自動封存
- 不隱藏 archived 資料
- 不新增 filter
- 不執行 SQL
- 不改 schema
- 不新增 migration
- 不新增 table
- 不改 app / lib / api
- 不接 LINE
- 不送 LINE
- 不寫正式 Supabase messages
- 不做 RLS / login
- 不做 cron / Edge Function
- 不刪資料
- 不處理 PR #7

## 11. 下一步建議

完成 Manual Archive Action Planning v1 後，下一步才可考慮 Manual Archive Action Sandbox v1。

但 Sandbox v1 仍應只做單筆人工封存，不做批次、不做自動、不做隱藏 archived 資料。