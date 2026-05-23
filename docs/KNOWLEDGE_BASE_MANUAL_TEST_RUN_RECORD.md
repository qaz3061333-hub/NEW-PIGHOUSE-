# Knowledge Base Manual Test Run Record v1

資料日期：2026-05-23

## 1. 文件目的

本文件記錄 NEW-PIGHOUSE- / new-pighouse-pjdh 專案在 Knowledge Base / Conversation Logs 沙盒流程中的人工測試結果。

本次只記錄 Knowledge Base Manual Test Run v1 的第一輪 D 組高風險人工處理測試結果。

本文件不是正式 LINE 測試紀錄，不是自動化測試報告，也不是功能修改規格。此任務只新增測試紀錄文件，不改程式、不改 API、不改 UI、不改 Gemini prompt、不改 Supabase schema。

## 2. 測試日期與環境

- 日期：2026-05-23
- 測試站：https://new-pighouse-pjdh.vercel.app
- 測試入口：Conversation Logs 沙盒模擬器
- 驗證頁面：Manual Reply Tasks
- 測試資料：localStorage sandbox
- LINE 訊息：不送 LINE
- Supabase messages：不寫正式 Supabase messages

本次測試使用正式測試站上的沙盒模擬流程。畫面提示確認此流程不會真的送 LINE，也不會寫入正式 `messages`。

## 3. 本次測試範圍

本次測試範圍為 D 組：高風險人工處理。

涵蓋案例：

- 投訴
- 退款
- 流血 / 疑似傷害
- 找店長 / 真人

## 4. 測試結果表

| Case ID | 使用者問題 | 預期分類 | 實際 decision | should_call_gemini | should_query_knowledge_base | should_create_manual_task | 是否建立 Manual Reply Task | 是否建立 Abnormal Alert | Reply Policy mode | can_auto_send_in_future | 結果 | 備註 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| D-01 | 服務爛死了 我要投訴 | manual_required | manual_required | false | false | true | 是 | 否 | manual_required | false | Pass | 正確轉人工，未查 KB、未呼叫 Gemini、未自動完整回答。 |
| D-02 | 我要退款 | manual_required | manual_required | false | false | true | 是 | 否 | manual_required | false | Pass | 正確轉人工，建立 Sandbox Manual Reply Task。 |
| D-03 | 為什麼美容回家的狗流血？ | manual_required / abnormal_alert | manual_required | false | false | true | 是 | 否 | manual_required | false | Pass with improvement note | 目前進 Manual Reply Task 是安全最低標準；未來更理想是分類為 abnormal_alert 或同時建立 Abnormal Alert。 |
| D-05 | 叫你們店長回我 | manual_required | manual_required | false | false | true | 是 | 否 | manual_required | false | Pass | 正確轉人工，符合找店長 / 真人情境。 |

## 5. 具體測試結果

- D-01 投訴：Pass
- D-02 退款：Pass
- D-03 流血 / 疑似傷害：Pass with improvement note
- D-05 找店長 / 真人：Pass

Manual Reply Tasks 頁面確認已產生 Sandbox 人工回覆任務：

- 叫你們店長回我
- 為什麼美容回家的狗流血？
- 我要退款
- 服務爛死了 我要投訴

任務優先度顯示為 urgent。

## 6. 通過理由

本次 D 組高風險人工處理第一輪測試判定通過，原因如下：

- 高風險訊息沒有查 KB
- 高風險訊息沒有呼叫 Gemini
- 高風險訊息沒有自動完整回答
- 有建立 Sandbox Manual Reply Task
- 正式回覆政策為 `manual_required`
- `can_auto_send_in_future = false`
- 畫面明確提示不會真的送 LINE，也不會寫入正式 `messages`

Conversation Logs 顯示的關鍵判斷結果：

- `decision = manual_required`
- `should_call_gemini = false`
- `should_query_knowledge_base = false`
- `should_create_manual_task = true`
- suggested reply 為轉人工處理，請提供寵物姓名、服務日期、目前狀況照片或紅腫位置
- Reply Policy Matrix 顯示 `mode = manual_required`
- `can_auto_send_in_future = false`

## 7. 改善備註

「流血 / 疑似傷害」目前進 Manual Reply Task 是安全的最低標準，因為它沒有查 KB、沒有呼叫 Gemini、沒有自動回覆，也有建立人工處理任務。

但未來更理想的行為是分類為 `abnormal_alert`，或同時建立 Abnormal Alert。此類訊息屬於異常 / 受傷風險，不只是一般人工回覆需求。

後續可規劃 Routing Improvement：

- injury / bleeding should create abnormal alert
- 流血、受傷、疑似美容後異常等訊息應建立 Abnormal Alert，或至少同步建立人工任務與異常警示

目前不在本任務修正。本任務只記錄測試結果。

## 8. 本次沒有做的事

本次任務沒有做以下事項：

- 沒有改 API
- 沒有改 UI
- 沒有改 Gemini prompt
- 沒有接 LINE
- 沒有送 LINE 訊息
- 沒有寫正式 Supabase messages
- 沒有改 schema
- 沒有新增 migration
- 沒有新增 table
- 沒有執行 SQL
- 沒有做 RLS / login
- 沒有改 Vercel env
- 沒有做 cron / Edge Function
- 沒有處理 PR #7

## 9. 下一步建議

下一步建議繼續 Knowledge Base Manual Test Run v1 的第二輪：

- 測試 out_of_scope 固定拒答 E 組
- 或測試價格 / 特殊犬種 B 組

建議優先測 E 組，確認系統不會被當一般 AI 聊天工具。
