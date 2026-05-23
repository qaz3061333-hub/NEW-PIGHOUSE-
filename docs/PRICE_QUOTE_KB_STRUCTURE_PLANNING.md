# Price Quote KB Structure Planning v1

資料日期：2026-05-23

本文件適用於 NEW-PIGHOUSE- / new-pighouse-pjdh 專案。此專案目前仍是沙盒 / MVP / 內部流程驗證階段，不是正式 LINE 上線階段。

## 1. 文件目的

本文件只規劃「價格資料未來應如何放進 Knowledge Base」，以及未來價格報價草稿應遵守哪些資料結構與規則。本文件不是功能實作文件，也不是把完整價目表 PDF 轉成 KB 內容的任務。

本任務明確不做以下事項：

- 不改程式。
- 不改 API。
- 不改 UI。
- 不改 Supabase schema。
- 不新增 migration。
- 不執行 SQL。
- 不匯入價目表。
- 不接 LINE。
- 不送 LINE 訊息。
- 不寫正式 Supabase messages。

本文件的目標，是讓未來 Codex / ChatGPT / 使用者接手時，知道價格 KB 應該長什麼樣子、哪些資訊一定要有、缺資料時要怎麼處理，以及未來報價草稿應如何避免猜價或硬套。

## 2. 價格資料原則

價格資料必須遵守以下原則：

- 價格不可寫死在 app / API / prompt / Gemini 記憶裡。
- 價格來源應是 active Knowledge Base。
- KB 更新後，未來報價應以最新 active KB 為準。
- inactive KB 不應被用來報價。
- 不應把整張 PDF 價目表丟給 Gemini 自由解讀。
- 應把價目表整理成標準化 KB 文章。

價格 KB 應該是「人可讀、但格式固定」的 key-value / 條列格式，而不是只用一大段自然語言描述。原因是自然語言容易讓系統解析不穩，未來做價格檢索、區間計算、缺資料判斷時也比較容易出錯。

建議未來每篇價格 KB 使用類似以下欄位名稱：

- `breed`
- `weight_tier`
- `service_type`
- `bath_base`
- `grooming_base`
- `monthly_base`
- `surcharge_type`
- `surcharge_min`
- `surcharge_max`
- `quote_notice`

本任務不是將完整價目表 PDF 轉成 KB 內容，也不是匯入價目表。本任務只定義未來價格 KB 的資料結構與報價規則。

## 3. 報價前必須知道的資訊

未來系統要報價前，必須知道：

- 品種。
- 體重。

如果缺品種或缺體重：

- 系統應先追問。
- 不應猜價格。
- 不應用相似品種或相似體型硬套。

如果可以知道以下資訊，報價會更精準：

- 毛長狀況，例如剃完了還是有流毛、是否有腳柱、是否有手修習慣。
- 年紀與體況，例如老犬、幼犬、特殊體況。
- 特殊注意事項，例如激動、攻擊、敏感、舊傷、皮膚狀況、嚴重打結、廢毛、體外蟲。

這些資訊不一定每次都要先問完才可以給初步區間，但只要缺少品種或體重，就不應進入報價。

## 4. 對客報價區間公式

未來對客報價應使用區間，不應只回單一死價格。

核心公式：

```text
對客報價區間 = base ～ base + surcharge_max
```

說明：

- `base` 是該品種、體重區間、服務項目的基礎價格。
- `surcharge_max` 是該項可能加價的最高值。
- 對客不要只回單一死價格。
- 對客應回最低到最高可能區間。
- 實際價格仍需依現場狀況確認。

範例：

- 馬爾濟斯 3kg 以下單次洗澡 `base = 500`，體型 / 長毛 / 激動加價最高 `250`，則對客報價為 `500～750`。
- 馬爾濟斯 3kg 以下包月 `base = 1800`，體型 / 長毛 / 激動加價最高 `250`，則對客報價為 `1800～2050`。

以上範例只是說明公式，不代表要把整張價目表寫入本文件，也不代表本任務已匯入價格資料。

## 5. 單次洗澡 / 大美容資料格式

未來每篇犬種價格 KB 建議以固定格式記錄，至少包含以下欄位：

- 品種。
- 體重區間。
- 單次洗澡 base。
- 單次大美容 base。
- surcharge 類型。
- surcharge_min。
- surcharge_max。
- 報價備註。
- 適用條件。
- 不適用 / 需人工確認條件。

建議格式範例：

```text
kb_type: price_quote_dog_single_service
breed: 馬爾濟斯
weight_tier: 3kg 以下
bath_base: 500
grooming_base: 1100
surcharge_type: 體型 / 長毛 / 激動
surcharge_min: 0
surcharge_max: 250
quote_notice: 實際價格依體型、毛長、激動或攻擊程度調整。
applies_when: 客人已提供品種、體重，且詢問單次洗澡或單次大美容。
manual_required_when: 品種或體重缺少、嚴重打結、體外蟲、攻擊性明顯、需看照片或現場判斷。
```

價目表中若出現 `500/1100`，代表：

- 單次洗澡 `base = 500`。
- 單次大美容 `base = 1100`。

未來系統不應把 `500/1100` 當成一個混合價格，也不應自行猜第一個或第二個數字的意思。KB 文章應先把它拆成明確欄位。

## 6. 包月價格資料格式

包月價格建議獨立成包月 KB，至少包含以下欄位：

- 品種或體型分類。
- 體重區間。
- 包月級距，例如 S / M / L。
- 包月 base。
- surcharge 類型。
- surcharge_min。
- surcharge_max。
- 報價備註。

建議格式範例：

```text
kb_type: price_quote_dog_monthly
breed_or_size_group: 馬爾濟斯
weight_tier: 3kg 以下
monthly_tier: S
monthly_base: 1800
surcharge_type: 體型 / 長毛 / 激動
surcharge_min: 0
surcharge_max: 250
quote_notice: 包月實際價格依現場評估與最新 active KB 為準。
```

包月對客報價也應使用：

```text
base ～ base + surcharge_max
```

例如 `monthly_base = 1800`，`surcharge_max = 250`，則對客報價區間為 `1800～2050`。

## 7. 手修加價規則

手修加價不是每次都自動加入。

只有客人提到以下需求時，才應納入手修加價：

- 腳柱。
- 全身手剪。
- 領巾。
- 屁屁修剪。
- 手剪造型。
- 其他明確手修需求。

如果客人沒提到手修，報價時不應自動把手修加價算進去。

未來 KB 可把手修規則獨立記錄，例如：

```text
kb_type: price_quote_hand_scissor_rule
trigger_terms: 腳柱 / 全身手剪 / 領巾 / 屁屁修剪 / 手剪造型 / 明確手修需求
apply_by_default: false
quote_rule: 只有客人明確提到手修需求時，才把手修加價納入報價區間或提示另計。
manual_required_when: 造型複雜、需看照片、犬隻不配合、毛況特殊。
```

## 8. 加購項目 KB 規劃

剪指甲、磨指甲、拔耳毛、草本泥、火山泥、RENADOG 洗劑等，應獨立成加購項目 KB。

加購項目 KB 應與犬種基礎價格分開，避免混在單一犬種報價裡。這樣未來查詢「馬爾濟斯洗澡多少」時，不會誤把所有加購項目都算進基本報價；查詢「草本泥多少」時，也可以直接命中加購 KB。

加購項目 KB 應包含：

- 項目名稱。
- 適用對象。
- 價格或價格區間。
- 注意事項。
- 是否需要現場評估。
- 是否可自動報價。
- 需轉人工條件。

建議格式範例：

```text
kb_type: price_quote_addon
addon_name: 草本泥
applies_to: 犬 / 貓，依店內實際服務規則填寫
price_or_range: 待價目表整理
notice: 是否適合需依皮膚狀況與現場評估。
needs_onsite_assessment: true
can_auto_quote: 視 KB 是否有明確價格而定
manual_required_when: 皮膚狀況嚴重、客人有醫療疑慮、需要美容師判斷是否適合。
```

## 9. 缺資料處理

未來價格回答遇到缺資料時，應保守處理。

規則如下：

- 如果缺品種或體重，系統應追問。
- 如果 KB 找不到該品種 / 體重區間 / 服務項目，不可猜。
- 應建立 Knowledge Gap，並轉人工或提示需人工確認。
- 如果只有相似犬種資料，不可直接套用。
- 如果價格資料衝突，應轉人工確認。

範例：

- 客人問「小型犬洗澡多少」但沒說品種與體重：應追問品種和體重，不應直接報小型犬平均價。
- 客人問「薩摩耶大美容多少」但 KB 沒有薩摩耶資料：應建立 Knowledge Gap，並提示需人工確認，不應套用哈士奇或大型犬價格。
- 客人問「我家狗 6kg，像貴賓但混種」：若 KB 沒有混種或明確分類規則，應轉人工或請店員確認，不應硬套貴賓。

## 10. 高風險與價格爭議

一般查價可以走價格 KB。但以下情境不能自動完整回答，應轉人工：

- 為什麼你們這麼貴。
- 你們是不是比別家貴。
- 價格抱怨。
- 退款。
- 客訴。
- 投訴。
- 受傷 / 流血。
- 醫療疑慮。
- 特殊皮毛狀況嚴重。
- 攻擊性或高風險犬隻。
- 需要看照片或現場狀況才能判斷。

價格 KB 的目標是回答「依 active KB 可查到的基本價格區間」，不是處理爭議、抱怨、責任歸屬、退款或醫療判斷。

## 11. 報價固定提醒文字規劃

未來報價草稿建議固定提醒以下內容：

- 實際價格會依體型、毛長、激動或攻擊程度調整。
- 若有嚴重打結、廢毛、體外蟲、特殊皮毛狀況，需現場評估另計。
- 若有手修、特殊造型或加購項目，會另外計算。
- 報價以現場評估與最新 Knowledge Base 為準。

對客草稿可使用白話版本，例如：

```text
初步報價大約是 {quote_range}。
實際價格會依現場評估的體型、毛長、激動或攻擊程度調整。
如果有嚴重打結、廢毛、體外蟲或特殊皮毛狀況，會需要現場評估另計。
若有手修、特殊造型或加購項目，也會另外計算。
```

未來正式上線前，這段文字仍需要 Reply Policy Matrix 與人工測試確認，不能因為本文件完成就直接自動送 LINE。

## 12. 與 Auto KB Reply Readiness 的關係

本文件完成後，不代表可以直接自動回覆 LINE。

後續仍需完成：

- Price Quote KB Seed Draft v1。
- Price Quote KB Seed Review v1。
- Price Quote Addon KB Seed Draft v1。
- Price Quote Missing Info Handling Planning v1。
- Price Quote Range Calculation Planning v1。
- Price Quote Retrieval Test v1。
- Auto KB Reply Readiness v1。
- Reply Policy Matrix 進一步具體化。
- 人工測試通過。
- 正式 LINE 送出防線完成。

本文件只讓價格 KB 的資料結構與報價規則先有共同語言。真正自動回覆、正式 LINE 送出、資料庫匯入與 API 實作都必須另開小任務。

## 13. 明確不做項目

本任務不做以下項目：

- 不改程式。
- 不改 API。
- 不改 UI。
- 不改 Gemini prompt。
- 不接 LINE。
- 不送 LINE 訊息。
- 不寫正式 Supabase messages。
- 不改 Supabase schema。
- 不新增 migration。
- 不新增 table。
- 不執行 SQL。
- 不做 RLS / login。
- 不改 Vercel env。
- 不做 cron。
- 不做 Edge Function。
- 不處理 PR #7。
- 不匯入完整價目表。
- 不把價格硬編進程式碼。
- 不把整張價目表寫進 prompt。
- 不把完整價目表 PDF 轉成 KB 內容。

## 14. 下一步建議

下一步建議是 `Price Quote KB Seed Draft v1`。

該任務才開始把少量犬種，例如馬爾濟斯、貴賓、薩摩耶，整理成標準 KB 草案。

但下一步仍應保持安全邊界：

- 不匯入 DB。
- 不改程式。
- 不改 API。
- 不改 UI。
- 不接 LINE。
- 不送 LINE 訊息。
- 不寫正式 Supabase messages。
- 不把完整價目表 PDF 一次轉成正式 KB。

先用少量犬種做 seed draft，確認格式、人可讀性、系統可解析性與缺資料處理規則都穩定後，再評估是否進入 KB Seed Review 或 Retrieval Test。