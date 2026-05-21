# Handoff Automation Notes

資料日期：2026-05-21

本文件記錄 NEW-PIGHOUSE- / new-pighouse-pjdh 專案後續交接時的自動化協作規則。

## 1. ChatGPT 的角色

ChatGPT 在本專案中不是只回答問題，而是專案顧問、架構顧問、PR 審查助手與 Codex 任務規劃助手。使用者主要負責轉達需求、提供必要畫面或工具無法完成的操作；能由 ChatGPT / Codex / GitHub connector 自動完成的事，應優先自動化，減少使用者手動工作。

## 2. Codex 正常流程

正常情況下：

1. ChatGPT 產出明確 Codex 任務指令。
2. Codex 修改檔案。
3. Codex 建立非 draft PR。
4. 使用者回報 PR 編號。
5. ChatGPT 檢查 GitHub 實際 Files changed / diff / checks，不只看 Codex Summary。
6. 若安全、範圍正確、Vercel `new-pighouse-pjdh` check 通過，ChatGPT 可依使用者授權 merge。

## 3. Codex 無法建立 PR 時的 fallback 流程

若 Codex 回報無法建立 PR，例如 GitHub connector 無法初始化、本機 git 無法使用、gh 未安裝、沒有 GitHub token，ChatGPT 不應直接要求使用者手動重做。

優先流程：

1. 要求 Codex 輸出完整 unified diff / patch。
2. ChatGPT 先審查 diff 是否符合任務範圍與安全邊界。
3. 若 diff 合格，ChatGPT 可用 GitHub connector 接手建立 branch / commit / PR。
4. 若 diff 是修改大檔，例如 README.md / PROJECT_STATUS.md，而 GitHub connector 無法安全套用 patch 或完整覆蓋風險過高，ChatGPT 應採取安全替代方式，例如新增 docs 草案文件，而不是覆蓋大檔。
5. PR 說明中要清楚註明這是 ChatGPT GitHub connector fallback publication。

## 4. 安全邊界

即使是 fallback，也不得越過專案最高安全邊界：

- 不接真 LINE
- 不送 LINE 訊息
- 不寫正式 Supabase messages
- 不改 Supabase schema，除非使用者明確同意且已完成 planning / review / backup
- 不新增 migration
- 不新增 table
- 不改 RLS / login / staff 權限
- 不改 Vercel env
- 不做 Vercel Cron
- 不做 Supabase Edge Function
- 不做物理刪除
- 不處理舊 PR #7
- 不只看 Summary，必須看 Files changed / diff / checks

## 5. 本次案例紀錄

本次 Codex 已完成 Archive Minimal Migration SQL Draft v1 的本地 README.md / PROJECT_STATUS.md 文件修改，但無法建立 PR。ChatGPT 先審查使用者貼回的完整 diff，確認內容合格；之後因 GitHub connector 不適合直接覆蓋大型既有文件，改以安全方式新增獨立 docs 文件：

- `docs/ARCHIVE_MINIMAL_MIGRATION_DRAFT.md`

並建立 PR：

- PR #49 `[chatgpt] Archive Minimal Migration SQL Draft v1`

後續新對話接手時，若再次遇到 Codex 不能開 PR，應照本文件第 3 節 fallback 流程處理。
