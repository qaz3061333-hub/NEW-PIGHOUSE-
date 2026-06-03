# System Audit v1

資料日期：2026-06-03

本文件是目前 NEW-PIGHOUSE- 系統的盤點文件。目的不是新增功能、不是修 LINE、不是開始 V2，而是先把現有系統看清楚，避免在原型殘留上繼續堆正式功能。

本次盤點只根據 repo 內現有文件與程式碼整理，沒有修改 app / lib 功能邏輯，沒有修改 schema，沒有新增 migration，沒有新增 SQL。

## 一、目前產品方向

目前產品方向已收斂為：

「可複製給不同寵物店使用的 LINE AI 客服工作台」

這代表未來重點不是單店 sandbox，也不是複雜預約系統，而是：

- 每間店有自己的 Knowledge Base。
- 每間店有自己的 LINE 官方帳號設定。
- 客人訊息要先被分類。
- 明確低風險 KB 問題才可考慮自動回覆。
- 預約、問空檔、改約、取消、客訴、退款、異常、高風險、AI 不確定、KB 找不到，都必須進人工回覆工作台。
- 如果系統對客人說「轉門市」或「轉人工」，後台就一定要真的產生人工任務。
- AI 的定位是分類、查資料、產生草稿、整理待辦，不是取代人工。

## 二、現有主要功能盤點

| 功能 | 目前狀態 | V2 分類 | 說明 |
| --- | --- | --- | --- |
| Dashboard | 已改成以人工任務統計為主 | 保留作為 V2 核心概念 | 現在只讀 manual_reply_tasks 與 sandbox manual events，方向正確，但 V2 需要依 store / conversation / task / audit 重新設計資料來源。 |
| Knowledge Base | 可 CRUD Supabase `knowledge_articles`，也顯示 sandbox KB gap | 保留作為 V2 核心 | 是自動回覆唯一依據的概念正確。V2 需要加上 store scope、審核狀態、版本與更清楚的 article 類型。 |
| Conversation Logs | 同時是 LINE 對話紀錄頁與 sandbox 測試入口 | 保留概念，不建議沿用完整 code | 有對話檢視與 sandbox triage 價值，但頁面同時承擔測試、KB 查詢、人工任務建立、debug 顯示，V2 應拆清楚。 |
| Manual Reply Tasks / 人工回覆工作台 | 已是目前主流程入口，可讀 Supabase 舊任務，也可處理 localStorage sandbox 任務 | 保留作為 V2 核心 | 人工工作台方向最接近 V2。V2 需要改成正式 conversation + task + LINE reply，而不是 localStorage sandbox。 |
| Appointment Requests | 現在頁面標為舊版沙盒資料檢視 | legacy / sandbox / 暫停使用 | 預約不應再作為主產品入口。V2 只把預約與問空檔視為人工任務類型，不自動成立預約。 |
| Abnormal Alerts | 現在頁面標為舊版異常提醒沙盒 | legacy / sandbox / 暫停使用 | 異常 / 高風險應進人工回覆工作台。獨立頁面可暫時保留看舊資料，但不應繼續擴功能。 |
| LINE webhook | 已有 `/api/line/webhook`，會驗證 signature 並用 LINE Reply API 回覆 | 需要重寫 | 目前是單一 env token / secret，使用 sandbox triage，沒有正式 conversation 保存，也沒有真的建立人工任務。這不適合直接正式化。 |
| Knowledge Base answer API | `/api/sandbox/knowledge-answer` 會查 active KB、做簡易匹配、交給 Gemini 回答 | 保留概念，不建議照搬完整 code | 「少量相關 KB → AI 回答」方向正確，但目前仍是 sandbox API，沒有 store scope，搜尋與安全規則需要正式化。 |
| sandbox helpers | 有多個 triage、appointment、KB、manual task、reply policy helper | 保留概念，重整 code | 可參考分類與安全文案，但目前檔名、資料流與用途都偏 sandbox。V2 應用正式 module 命名重寫。 |
| localStorage sandbox data | 用於 sandbox 任務、回寫、知識缺口、異常事件 | legacy / sandbox / 暫停使用 | 適合 prototype，不適合正式 LINE、多店、多員工或跨裝置工作台。 |
| Supabase tables | repo schema 有 6 張表，遠端曾有 schema drift 記錄 | 部分沿用概念，多數需要重設 | `knowledge_articles`, `manual_reply_tasks`, `messages` 等概念可沿用，但 V2 需要 stores / conversations / messages / tasks / audit logs 的正式資料模型。 |

## 三、目前可能混亂的邏輯

### 1. Conversation Logs 與 LINE webhook 各自有分流邏輯

Conversation Logs 頁面目前會在前端執行 `evaluateSandboxCustomerServiceTriage` 與 `evaluateSandboxConversationFlow`，需要查 KB 時再呼叫 `/api/sandbox/knowledge-answer`。若需要人工，Conversation Logs 會寫入 localStorage 的 sandbox manual task。

LINE webhook 則在 `/api/line/webhook/route.ts` 接收 LINE event，驗證 signature 後呼叫 `buildSandboxLineCustomerServiceReply`，再用 LINE Reply API 直接回覆客人。

兩者有共用一部分 triage helper，但實際落地不同：

- Conversation Logs 會建立 localStorage sandbox 人工任務。
- LINE webhook 只記錄 `manualTaskWouldBeCreated`，沒有真正寫入人工工作台。
- LINE webhook 的 history 只放本次訊息，沒有正式對話記憶。
- LINE webhook 會真的回 LINE，但使用的仍是 sandbox 命名與 sandbox 流程。

這是目前最高優先級要釐清的混亂點。

### 2. Knowledge Base 查詢有多套入口

目前 Knowledge Base 相關入口包含：

- Knowledge Base 頁面：維護 `knowledge_articles`。
- `/api/sandbox/knowledge-answer`：server-side KB 回答 API。
- `lib/sandboxKnowledgeAnswer.ts`：查 active articles、做簡易 scoring、呼叫 Gemini。
- `lib/sandboxKnowledgeQueryGuard.ts`：針對 KB 內容做安全限制。
- Conversation Logs：需要 KB 時呼叫 `/api/sandbox/knowledge-answer`。
- LINE webhook：透過 `buildSandboxLineCustomerServiceReply` 間接呼叫 `runSandboxKnowledgeAnswer`。

方向是對的：不把整包 KB 丟給 AI，只拿少量匹配資料。但目前仍缺 store scope、正式搜尋策略、query log、answer audit、人工 fallback 的正式任務落地。

### 3. 預約判斷散落在多個檔案

預約與問空檔相關邏輯目前分散在：

- `lib/sandboxCustomerServiceTriage.ts`
- `lib/sandboxConversationFlow.ts`
- `lib/sandboxAppointmentInfoExtraction.ts`
- `lib/sandboxAppointmentAvailabilityReply.ts`
- `app/api/sandbox/analyze-message/route.ts`
- `app/api/sandbox/proposed-new-time/route.ts`
- `app/api/sandbox/appointment-reschedule-reply/route.ts`
- `app/api/sandbox/customer-reschedule-request/route.ts`
- `app/api/sandbox/rejected-reply/route.ts`

目前主產品方向已不再把預約當主流程，所以這些預約原型不建議繼續擴。V2 應只保留「預約 / 問空檔一定進人工任務」與「不可自動承諾空檔」這兩個核心規則。

### 4. 安全文案散落在多個檔案

目前安全文案分散在：

- `lib/sandboxAppointmentAvailabilityReply.ts`
- `lib/sandboxCustomerServiceTriage.ts`
- `lib/sandboxLineCustomerService.ts`
- `lib/sandboxReplyPolicy.ts`
- 多個 sandbox API prompt
- `lib/sandboxManualReplyTaskEvents.ts` 的 unsafe reply normalizer

這些文案都在防止系統說出「已預約」、「有空」、「可以安排」等會讓客人誤以為預約成立的句子。規則重要，但 V2 不應分散在多個 sandbox helper；應集中成 Safe Reply Engine。

### 5. 人工任務混用 localStorage 與 Supabase

目前人工任務有兩種來源：

- Supabase `manual_reply_tasks`：Manual Reply Tasks 頁面會讀取並可標記已回覆。
- localStorage `new_pighouse_sandbox_manual_reply_task_events_v1`：Conversation Logs 建立 sandbox 任務，Manual Reply Tasks 頁面上方顯示。

這對 prototype 很有用，但正式 LINE 不可沿用。正式 V2 應只有一套 server-side 任務資料來源，並且要連到 store、conversation、message、staff action 與 audit log。

### 6. Appointment Requests / Abnormal Alerts 仍可能干擾主產品方向

目前 UI 已把 Appointment Requests 和 Abnormal Alerts 標成舊版沙盒資料檢視，這是正確方向。但 repo 內仍存在不少舊流程與舊文件，容易讓後續任務誤以為要繼續補這兩頁。

V2 應避免把它們當成獨立主模組。比較安全的做法是：預約、異常、高風險都變成人工回覆工作台內的 task type。

### 7. sandbox 與 live LINE 的界線不清楚

最大的界線問題是 `/api/line/webhook/route.ts`。它是 live LINE webhook route，會驗證 LINE signature，也會真的呼叫 Reply API，但內部使用的是 sandbox customer service triage。

目前它沒有：

- 依 LINE user 建立或查詢正式 contact。
- 建立正式 conversation。
- 寫入 conversation_messages。
- 建立正式 manual_reply_tasks。
- 記錄 AI triage audit。
- 使用多店 store 設定。

因此目前可視為 live test endpoint，不應視為正式 LINE 架構。

### 8. 寫死 PIG HOUSE 或單店設定

目前可看到多處單店假設：

- README / PROJECT_STATUS / PageShell 都以 PIG HOUSE 或單一專案為中心。
- `lib/sandboxServiceGate.ts` 的 out-of-scope reply 寫死 PIG HOUSE。
- `lib/sandboxKnowledgeAnswer.ts` 的 prompt 寫「使用者問題預設是 PIG HOUSE 寵物服務情境」。
- LINE webhook 只讀 `LINE_CHANNEL_SECRET` 與 `LINE_CHANNEL_ACCESS_TOKEN`。
- Supabase tables 沒有 `store_id`。
- Knowledge Base 沒有 store scope。

這些都不適合多店 V2 直接沿用。

## 四、現有資料表盤點

以下只根據 `supabase/schema.sql` 盤點。注意：既有文件已記錄過遠端 Supabase DB 可能比 repo 內 `schema.sql` 更新，例如 `appointment_requests.is_sandbox` 與 manual reply 相關欄位；因此這裡不能當成遠端 DB 的完整現況。

| table | schema.sql 目前用途 | V2 判斷 |
| --- | --- | --- |
| `customers` | 客戶基本資料，包含 `name`, `phone`, `line_user_id` | 概念可沿用，但需要重設為 `line_contacts` 或加上 `store_id`、LINE profile、封鎖狀態、最後互動時間。 |
| `messages` | 簡單訊息紀錄，連到 `customers` | 需要重寫。V2 應拆成 `conversations` 與 `conversation_messages`，並記錄 sender、direction、LINE message id、AI summary、reply state。 |
| `knowledge_articles` | 知識庫文章，含 `title`, `category`, `content`, `is_active` | 核心概念可沿用，但 V2 必須加 `store_id`，並可能加文章類型、審核、版本、最後更新者。 |
| `appointment_requests` | 舊預約申請，含服務、飼主、時間、status | 不建議作為 V2 主表沿用。V2 MVP 不自動成立預約，預約需求應先進 `manual_reply_tasks`。 |
| `abnormal_alerts` | 舊異常提醒，含 severity、summary、resolved 狀態 | 不建議作為 V2 主表沿用。異常 / 高風險應先作為人工任務類型，再視需要設計事件表。 |
| `manual_reply_tasks` | 人工回覆任務，含 customer、topic、priority、is_replied | 核心概念可沿用，但需要重設欄位：`store_id`, `conversation_id`, `message_id`, `task_type`, `status`, `draft_reply`, `assigned_to`, `resolved_at`, `audit_log_id`。 |

`schema.sql` 也啟用這 6 張表的 RLS，但 policy 是 `Allow anon full access ...`。這只適合 MVP 測試，不適合正式員工後台、多店或真 LINE。

## 五、現有程式風險

### 高風險

1. LINE webhook 已會真的回 LINE，但沒有正式對話記憶、conversation 保存、manual task 落地與 audit log。
2. live LINE 轉人工目前不是完整落地：程式只知道 `manualTaskWouldBeCreated`，沒有把任務寫入後台工作台。
3. LINE token / channel secret 目前依賴單一 env，不支援多店，也沒有後端加密設定模型。
4. sandbox code 與 live webhook 混用，容易把 prototype 規則誤當正式 LINE 架構。
5. `schema.sql` 的 RLS policy 是 anon full access 測試型，不適合正式營運。
6. repo schema、types、遠端 DB 之間已有 drift 紀錄，未來 migration 前不能只看單一檔案判斷。
7. 目前沒有正式 audit log；如果真的送 LINE 或改狀態，事後難以追查誰做了什麼。

### 中風險

1. KB 查詢入口與安全規則有價值，但目前是 sandbox 命名、無 store scope、無查詢紀錄。
2. 預約判斷與安全文案散落在多個 helper 與 API prompt，後續修改容易漏改。
3. Manual Reply Tasks 同時顯示 Supabase 舊資料與 localStorage sandbox 任務，資料來源不一致。
4. Appointment Requests / Abnormal Alerts 雖已標為舊版，但仍保留頁面與資料表，後續任務容易被舊方向牽走。
5. 多處寫死 PIG HOUSE 與單店服務情境，不適合多店複製。
6. Conversation Logs 目前同時是紀錄頁、測試入口、debug 頁與任務產生器，職責過多。

### 低風險

1. mock data fallback 對測試友善，但正式後台若仍出現可能誤導使用者。
2. README / PROJECT_STATUS 很詳細，但歷史段落多，後續接手容易被舊下一步誤導。
3. 舊 sandbox API routes 仍在 repo 內，短期不一定出錯，但應在 V2 前確認哪些已不用。
4. Dashboard 目前是簡化統計，適合 MVP，但不夠支撐正式營運。

## 六、建議凍結範圍

在本次審計完成、V2 方向確認前，不建議繼續新增以下功能：

- LINE 對話記憶
- 正式人工送 LINE
- 多店設定頁
- schema 擴充
- POS / Google Calendar
- 自動預約成立
- 新 dashboard
- 新 Appointment Requests 流程

原因是目前最大問題不是少一個功能，而是正式架構邊界尚未整理好。繼續加功能會讓 sandbox、legacy、live LINE、資料表與人工工作台更難拆。

## 七、初步結論

目前系統已累積很多有價值的 prototype 成果，尤其是：

- Knowledge Base 作為唯一回答依據。
- 預約 / 問空檔不自動承諾。
- 高風險、客訴、退款、KB 找不到、AI 不確定要轉人工。
- 人工回覆工作台作為主入口。
- 少量相關 KB + AI 回答，而不是整包 KB 丟給 AI。

但目前 code 層面仍混有 sandbox、legacy、live LINE test、localStorage 與單店 env 設定。若目標是多店 LINE AI 客服工作台，建議不要在現有 prototype 上直接硬改成 V2。比較安全的方向是：保留概念與測試經驗，另開乾淨 branch 或新 repo 設計 V2 架構，再選擇性搬移可用 helper。
