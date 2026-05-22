# Archive Backlog Parking Record v1

資料日期：2026-05-22

本文件記錄 NEW-PIGHOUSE- / new-pighouse-pjdh 封存功能線目前暫停的狀態。此專案目前仍是沙盒 / MVP / 內部流程驗證階段，不是正式 LINE 上線階段。

## 1. 文件目的

本文件目的：

- 記錄封存功能線目前已 parking / 暫停。
- 記錄封存線尚未完成的事項，避免下一個對話或 Codex 忘記後續。
- 說明為什麼目前先不繼續做 Manual Archive Action Sandbox v1。
- 說明什麼條件下才適合恢復封存功能線。
- 明確標示本文件不是功能實作文件。

本文件只做 backlog / parking 紀錄，不是 UI 規格實作文件，不是 API 設計文件，不是 SQL 執行文件，不是 migration 文件，也不是自動封存設計文件。

## 2. 目前已完成的封存相關事項

目前封存線已完成到以下程度：

- 遠端 Supabase DB 已新增 `archive_status` / `archived_at` / `archive_batch_id`。
- 適用表包含：`appointment_requests` / `manual_reply_tasks` / `abnormal_alerts`。
- `lib/types.ts` 已同步封存欄位。
- `lib/mockData.ts` 已同步封存欄位。
- 三個頁面已顯示封存狀態：Appointment Requests / Manual Reply Tasks / Abnormal Alerts。
- 使用者已人工驗證三頁都能看到封存狀態。
- Manual Archive Action Planning v1 已完成，文件為 `docs/MANUAL_ARCHIVE_ACTION_PLANNING.md`。
- 目前沒有真正封存操作。

目前的封存狀態顯示只代表欄位與畫面可看見，不代表系統已經支援人工封存、取消封存、批次封存、自動封存或 archived 資料隱藏。

## 3. 尚未完成的封存事項

封存線尚未完成以下事項：

- Manual Archive Action Sandbox v1 尚未做。
- 尚未新增「標記封存」按鈕。
- 尚未新增單筆人工封存操作。
- 尚未新增取消封存 / 還原操作。
- 尚未新增 active / archived filter。
- 尚未規劃 `event_audit_logs` table。
- 尚未做 audit log planning。
- 尚未紀錄誰封存、何時封存、封存原因。
- 尚未做批次封存。
- 尚未做自動封存。
- 尚未做每日 00:00 cron。
- 尚未做 archived 資料預設隱藏。
- 尚未做正式封存權限 / staff identity / login / RLS。

以上項目只是 backlog，沒有在本任務實作。

## 4. 為什麼現在暫停封存線

目前封存基礎已足夠支撐未來功能：遠端 DB 已有三個 archive 欄位，型別與 mock data 已同步，三個主要事件頁面也能看見封存狀態。

再往下做就會開始改 UI 行為，例如新增「標記封存」按鈕、更新資料、或讓使用者切換 active / archived。這些已經不是單純紀錄狀態，而是會影響客服後台實際操作流程。

人工封存在沒有 audit log 前風險較高。若系統還不能記錄誰封存、何時封存、為什麼封存、封存前後狀態，未來遇到客訴、退款、受傷、異常提醒或人工接手問題時，會比較難追查處理脈絡。

目前客服系統核心更重要。下一階段應優先回到：

- Knowledge Base 回答品質。
- KB 測試案例。
- 回覆草稿與人工審核流程。
- Conversation Logs 接手流程。

因此目前先暫停封存線，避免在沙盒 / MVP 階段過度工程，也避免太早做會改變資料可見性或操作行為的功能。

## 5. 什麼時候適合回來做封存

建議至少符合以下條件後，再回來恢復封存功能線：

- KB 回答品質測試完成。
- Reply Draft Review / 人工審核流程穩定。
- Conversation Logs 接手流程更完整。
- 真的需要整理已處理資料、列表太雜，或使用者明確要求恢復封存。
- audit log planning 至少已有初步文件。
- 已確認第一版只做單筆人工封存，不做批次、不自動、不隱藏。

如果上述條件尚未成熟，封存線應繼續 parking。

## 6. 未來回來做時的建議順序

### Phase 1：Manual Archive Action Sandbox v1

- 單筆人工封存。
- 只更新 `archive_status` / `archived_at` / `archive_batch_id`。
- 不隱藏資料。
- 不批次。
- 不自動。
- 高風險 abnormal alert 先擋住。

### Phase 2：Archive Filter Readiness v1

- 顯示 active / archived。
- 可手動切換查看。
- 預設是否隱藏要另審。

### Phase 3：Audit Log Planning v1

- 規劃 `event_audit_logs`。
- 記錄操作者、時間、原因、前後狀態。

### Phase 4：Cron / Auto Archive Planning

- 只在 audit log、備份、還原策略成熟後才考慮。

## 7. 目前明確不做

本 parking 任務明確不做以下事項：

- 不改 UI。
- 不新增封存按鈕。
- 不新增封存操作。
- 不自動封存。
- 不隱藏 archived 資料。
- 不新增 filter。
- 不執行 SQL。
- 不改 schema。
- 不新增 migration。
- 不新增 table。
- 不改 app / lib / api。
- 不改 helper。
- 不接 LINE。
- 不送 LINE。
- 不寫正式 Supabase messages。
- 不做 RLS / login。
- 不做 cron / Edge Function。
- 不刪資料。
- 不處理 PR #7。

## 8. 下一步建議

封存線已 parking。

下一步建議回到 Knowledge Base Answer Test Cases v1。

目標是把 KB 回答品質測試案例整理成可人工驗收清單。
