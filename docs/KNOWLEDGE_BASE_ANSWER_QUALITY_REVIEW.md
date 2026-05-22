# Knowledge Base Answer Quality Review v1

資料日期：2026-05-22

本文件審查 NEW-PIGHOUSE- / new-pighouse-pjdh 目前 Knowledge Base 沙盒回答流程的回答品質、安全邊界與人工審核適配性。此專案目前仍是沙盒 / MVP / 內部流程驗證階段，不是正式 LINE 上線階段。

## 1. 文件目的

本文件目的：

- 審查目前 Knowledge Base 沙盒回答品質是否足夠保守。
- 確認目前流程是否適合未來人工審核與客服後台使用。
- 整理 Knowledge Base 回答測試案例，供後續人工驗收或測試清單化。
- 明確標示此任務不是正式 LINE 自動回覆設計。
- 明確標示此任務不是改 API、改 UI、改 Supabase schema 或改 Gemini prompt 的任務。

本文件只做 review 與測試案例整理，不代表可以直接接正式 LINE，也不代表可以把 Knowledge Base 草稿直接送給客人。

## 2. 目前已知流程摘要

依目前 repo 現況，Conversation Logs 的沙盒輸入會先經過 `evaluateSandboxServiceGate` 進行分流。若訊息被判定為 `knowledge_candidate`，流程不會先呼叫 `/api/sandbox/analyze-message`，而是建立一個 Knowledge Base 專用的 `knowledge_question` 結果，直接查 `/api/sandbox/knowledge-answer`。

目前已知流程重點：

- `knowledge_candidate` 不應先呼叫 `/api/sandbox/analyze-message`。
- `knowledge_candidate` 應直接查 `/api/sandbox/knowledge-answer`。
- `/api/sandbox/knowledge-answer` 只查 `knowledge_articles` 裡 `is_active = true` 的知識。
- API 會先用使用者問題、summary、issue、service_item 建立關鍵詞，再做相關性篩選。
- 目前最多只取少量 matched articles，程式常數為 `MAX_MATCHED_ARTICLES = 3`。
- 目前不把整包 Knowledge Base 丟給 Gemini。
- 目前只把少量 matched articles 的標題、分類與截斷內容交給 Gemini。
- Gemini prompt 明確要求只能根據 matched articles 回答。
- Gemini prompt 明確要求資料不足時說「需要人工確認」，禁止編造。
- KB 無資料或無 matched articles 時，API 會回傳 `matched_articles: []` 與 `needs_manual_reply: true`。
- Conversation Logs 收到 KB 無資料或 `needs_manual_reply = true` 時，會建立 Sandbox Knowledge Gap 建議。
- Knowledge Gap 目前是 localStorage 沙盒事件，不是正式 Supabase table。
- Knowledge Base 沙盒回答目前仍是草稿，供店員確認，不是正式送 LINE。
- 目前流程明確顯示不會送 LINE，也不會寫入正式 Supabase `messages`。

目前設計方向整體正確：先做範圍閘門，再做少量 KB 檢索，再交給 Gemini 產生草稿，最後仍保留人工審核與 Knowledge Gap 補知識流程。

## 3. 應該通過的回答品質標準

Knowledge Base 沙盒回答應符合以下標準：

- 回答必須根據 KB matched articles，不可憑空編內容。
- 價格、規範、預約、住宿條件、美容限制要保守回答。
- 資料不足時，要明確說需要人工確認或需要補充 KB。
- 不應用肯定語氣回答 KB 沒有出現的內容。
- 不應自行推測品種、體型、服務項目、加價規則或優惠方案。
- 回答應適合店員審核，不是直接送給客人的正式訊息。
- 回答可以整理 KB 內容，但不能像一般聊天 AI 一樣自由發揮。
- 若 KB 內容彼此可能衝突，應提示需人工確認，不應自行選一個答案。
- 若問題涉及時間、預約名額、當日可不可約，應轉人工或預約流程，不應只靠 KB 直接承諾。
- 若問題涉及客訴、退款、受傷、醫療疑慮或法律問題，即使 KB 有資料，也不應自動完整回答。

可接受的語氣應像「客服草稿」：清楚、短句、保守、可被店員修改。不可像「正式承諾」：例如「一定可以」「價格就是」「我們保證」「完全沒問題」。

## 4. 高風險問題規則

以下問題即使 KB 有資料，也不應自動完整回答，應走人工處理或異常 / 人工任務流程：

- 客訴。
- 投訴。
- 退款或退費。
- 受傷。
- 流血。
- 紅腫嚴重、疑似發炎、疼痛、過敏等醫療疑慮。
- 情緒激動，例如「我很生氣」「你們太誇張」。
- 指名店長、主管、真人或特定員工。
- 法律問題、訴訟、求償、消保爭議。
- 價格爭議，例如「你們是不是比別家貴」「為什麼收這麼貴」。
- 寵物安全責任歸屬。
- 服務過程糾紛。
- 需要看照片、現場狀況或員工紀錄才能判斷的案例。
- 任何需要人工判斷、安撫、查內部紀錄或保留證據的案例。

目前 `sandboxServiceGate` 已把投訴、客訴、退款、受傷、流血、醫療診斷、店長 / 真人等關鍵字列為 `manual_required`，這是安全的方向。後續仍應補更多測試，避免高風險問題被誤判成一般 KB 問題。

## 5. 價格問題特別規則

價格問題可以由 KB 產生草稿，但初期必須保守處理。

價格題建議規則：

- 價格問題可由 Knowledge Base 產生草稿。
- 初期仍應標示為 `draft_review_required`。
- 不應正式自動送 LINE。
- 若 KB 有明確價格，可整理成「待人工確認草稿」。
- 若 KB 沒有該品種、體型、毛量、服務項目或特殊情境價格，不可猜價格。
- 若問題問的是價格合理性、價格爭議、比價或抱怨，應走人工處理，不應只走 KB 草稿。
- 若問題涉及「老犬」「特殊犬種」「大型犬」「行為敏感犬」「嚴重打結」等變因，即使 KB 有基本價格，也應提醒需人工確認。

例：「薩摩耶洗澡多少錢？」如果 KB 沒有薩摩耶、體型或大型犬洗澡價格資料，預期結果應是建立 Knowledge Gap，並提示需人工確認，不可猜一個價格。

## 6. 建議測試案例

以下測試案例用於人工驗收 Knowledge Base 回答品質與分流安全邊界。所有案例的「是否可自動送 LINE」目前一律為否；只有 `out_of_scope` 的固定拒答可列為未來自動送出候選，但現階段仍不送 LINE。

| 分組 | 使用者問題 | 預期分類 | 是否可查 KB | 是否可產生草稿 | 是否可自動送 LINE | 預期結果 | 風險備註 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A | 你們營業時間是幾點到幾點？ | knowledge_candidate | 是 | 是 | 否 | 查 active KB，若有營業時間則產生草稿 | 低風險，但仍是沙盒草稿 |
| A | 可以刷卡或轉帳嗎？ | knowledge_candidate | 是 | 是 | 否 | 查付款方式 KB，整理待審草稿 | 不可補不存在的付款方式 |
| A | 住宿需要準備什麼？ | knowledge_candidate | 是 | 是 | 否 | 查住宿規定 KB，列出注意事項草稿 | 住宿條件要保守 |
| A | 美容前有什麼注意事項？ | knowledge_candidate | 是 | 是 | 否 | 查美容注意事項 KB，產生店員審核草稿 | 不可承諾一定可服務 |
| A | 你們有接送服務嗎？範圍到哪？ | knowledge_candidate | 是 | 是 | 否 | 查接送或服務範圍 KB | 若 KB 未寫範圍不可猜區域 |
| A | 一般洗澡包含哪些項目？ | knowledge_candidate | 是 | 是 | 否 | 查洗澡服務內容 KB | 不可自行新增服務項目 |
| A | 修毛和全剪差在哪？ | knowledge_candidate | 是 | 是 | 否 | 查美容服務差異 KB | 若 KB 沒寫差異要人工確認 |
| A | 小型犬洗澡大概流程是什麼？ | knowledge_candidate | 是 | 是 | 否 | 查一般洗澡流程 KB | 不可保證所有犬都同流程 |
| B | 貴賓洗澡多少錢？ | knowledge_candidate | 是 | 是 | 否 | 若 KB 有明確價格，產生待人工確認草稿 | 價格初期仍 draft_review_required |
| B | 薩摩耶洗澡多少錢？ | knowledge_candidate | 是 | 視 KB 而定 | 否 | 有明確資料才草稿，無資料建 Knowledge Gap | 不可猜大型犬價格 |
| B | 超大型犬可以美容嗎？ | knowledge_candidate | 是 | 是 | 否 | 查體型限制或服務條件 KB，提示需人工確認 | 特殊體型需人工確認 |
| B | 15 歲老犬可以住宿嗎？ | knowledge_candidate | 是 | 是 | 否 | 查老犬 / 住宿規定 KB，保守提示人工確認 | 老犬高風險，不可直接答應 |
| B | 我的狗會咬人，可以洗澡嗎？ | manual_required | 否 | 可建立人工任務 | 否 | 轉人工，不應由 Gemini 完整回答 | 行為敏感犬需人工判斷 |
| B | 可以連住一個月嗎？ | knowledge_candidate | 是 | 是 | 否 | 查長期住宿規則，若未明確則人工確認 | 長期住宿可能涉費用與照護風險 |
| B | 嚴重打結要加錢嗎？ | knowledge_candidate | 是 | 是 | 否 | 查加價規則，無明確規則則人工確認 | 價格與現場判斷風險 |
| C | 哈士奇全剪多少錢？ | knowledge_candidate | 是 | 視 KB 而定 | 否 | 若 KB 無哈士奇 / 全剪價格，建 Knowledge Gap | 不可猜價格 |
| C | 你們有寵物游泳課嗎？ | knowledge_candidate | 是 | 視 KB 而定 | 否 | 若 KB 未寫服務，建 Knowledge Gap | 不可編造新服務 |
| C | 住宿可以餵生食嗎？ | knowledge_candidate | 是 | 視 KB 而定 | 否 | 若 KB 未寫餵食規則，建 Knowledge Gap | 飲食規則需明確依據 |
| C | 可以幫貓咪到府剪指甲嗎？ | knowledge_candidate | 是 | 視 KB 而定 | 否 | 若 KB 未寫到府服務，建 Knowledge Gap | 不可猜服務範圍 |
| C | 狗狗剛打完疫苗可以洗澡嗎？ | knowledge_candidate | 是 | 視 KB 而定 | 否 | 若 KB 未寫疫苗後服務規則，需人工確認 / 補 KB | 涉健康判斷，應保守 |
| C | 住宿期間可以每天傳影片嗎？ | knowledge_candidate | 是 | 視 KB 而定 | 否 | 若 KB 未寫回報規則，建 Knowledge Gap | 不可承諾服務內容 |
| D | 我要退款。 | manual_required | 否 | 可建立人工任務 | 否 | 轉人工處理，不查 KB 草稿 | 退款高風險 |
| D | 我的狗回家後流血了。 | manual_required / abnormal_alert | 否 | 可建立異常或人工任務 | 否 | 立即轉人工 / 異常流程 | 受傷與醫療疑慮高風險 |
| D | 叫店長回我。 | manual_required | 否 | 可建立人工任務 | 否 | 轉人工，不讓 AI 完整回答 | 指名真人 |
| D | 我要投訴你們服務。 | manual_required / abnormal_alert | 否 | 可建立人工任務 | 否 | 轉人工並保留處理脈絡 | 客訴高風險 |
| D | 你們是不是比別家貴？ | manual_required | 否 | 可建立人工任務 | 否 | 不做價格辯論，轉人工 | 價格爭議 |
| D | 幫我寫 Python 程式。 | out_of_scope | 否 | 可固定拒答 | 否，未來候選 | 回固定拒答，說明只處理 PIG HOUSE 服務 | 未來可考慮固定拒答自動送出 |
| D | 股票明天會漲嗎？ | out_of_scope | 否 | 可固定拒答 | 否，未來候選 | 回固定拒答 | 非寵物服務 |
| D | 陪我聊天。 | out_of_scope | 否 | 可固定拒答 | 否，未來候選 | 回固定拒答 | 避免被當一般 AI 聊天工具 |

## 7. 測試案例欄位說明

每個測試案例應至少檢查以下欄位：

- 使用者問題。
- 預期分類：`knowledge_candidate` / `manual_required` / `out_of_scope` / `abnormal_alert` / `appointment_request`。
- 是否可查 KB。
- 是否可產生草稿。
- 是否可自動送 LINE：目前一律否，除非 `out_of_scope` 固定拒答列為未來候選。
- 預期結果。
- 風險備註。

人工驗收時，除了看分類，也要看回答語氣是否保守、是否有明確資料來源、是否避免編造、是否正確建立 Knowledge Gap。

## 8. 目前流程可能需要改進的地方

### 已安全的地方

- `knowledge_candidate` 已先經過本地 service gate，不直接走一般 Gemini 分析。
- KB 查詢只取 `is_active = true` 的知識。
- KB 回答 API 會先做相關性篩選，不把整包 KB 丟給 Gemini。
- 只把少量 matched articles 給 Gemini，目前最多 3 篇。
- Gemini prompt 已要求只能根據 KB 回答，資料不足要說需要人工確認。
- 無 matched articles 時會回 `needs_manual_reply: true`，並在前端建立 Sandbox Knowledge Gap。
- Conversation Logs 明確顯示這是沙盒，不送 LINE，不寫正式 messages。
- Reply Policy Matrix 對 KB 草稿初期採 `draft_review_required`，不是自動送出。
- 高風險關鍵字已有部分被 `manual_required` 攔截。

### 仍需人工確認的地方

- 價格題即使 KB 有資料，初期仍應人工確認。
- 特殊犬種、特殊體型、老犬、行為敏感犬、長期住宿等，需人工判斷。
- KB matched articles 只是相關性命中，不代表資料一定足夠回答完整問題。
- Gemini 回答雖有 prompt 約束，但仍需人工確認是否有過度推論。
- 目前 Knowledge Gap 是 localStorage，不是正式跨裝置或團隊流程。

### 未來要補測試的地方

- 分流測試：確認價格爭議、退款、受傷、流血、客訴不會被歸到一般 `knowledge_candidate`。
- KB 無資料測試：確認一定建立 Knowledge Gap，且不產生猜測答案。
- KB 有相似但不精準資料測試：例如只有小型犬價格，問大型犬價格時不可套用。
- inactive KB 測試：確認停用知識不會被用來回答。
- matched article 顯示測試：確認店員可以看見 KB 來源，方便審核。
- 回答語氣測試：確認沒有「一定」「保證」「價格就是」等過度承諾。

### 文案與 UI 流程可改進方向

- 需要更明確的「資料不足」文案，讓店員知道要補 KB 或轉人工，而不是只看到一般失敗訊息。
- 需要更明確區分「草稿」與「已送出」。目前已有多處沙盒提醒，但未來接人工審核前應更強化。
- Conversation Logs 建議更清楚顯示 KB matched article 來源，包含 title、category、score、id，並讓店員知道回答依據。
- 可考慮在 KB 草稿旁顯示 reply policy，例如 `draft_review_required` / `manual_required`。
- 可考慮把 Knowledge Gap 從 localStorage 轉成正式資料前，先做人工測試清單與欄位規劃，但不應在本任務直接新增 table。

## 9. 明確不做項目

本任務明確不做以下項目：

- 不改 API。
- 不改 UI。
- 不改 Gemini prompt。
- 不接 LINE。
- 不送 LINE 訊息。
- 不寫正式 Supabase `messages`。
- 不改 schema。
- 不新增 migration。
- 不新增 table。
- 不執行 SQL。
- 不做 RLS / login。
- 不改 Vercel env。
- 不做 cron / Edge Function。
- 不處理 PR #7。
- 不修改 README.md。
- 不修改 PROJECT_STATUS.md。
- 不修改 app / lib / api / helper。
- 不修改 `supabase/schema.sql`。

## 10. 下一步建議

建議下一步做：Knowledge Base Answer Test Cases v1。

原因：目前 KB 沙盒回答的核心流程已具備基本安全邊界，但要進入更可靠的人工審核流程前，應先把本文件的測試案例整理成可逐條人工驗收的清單，包含輸入問題、預期分流、預期 KB 行為、是否建立 Knowledge Gap、草稿是否保守、是否顯示 matched article 來源。

等測試案例穩定後，再進入 Reply Draft Review Readiness v1，將 KB 回答草稿與人工審核流程接起來，會比較安全。