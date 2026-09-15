# 內容審核封板紀錄（2026-09-15）

## 審核範圍

本輪審核以 16 篇 DSE 中文科指定文言經典學習單元為範圍，集中檢查題目內容的語義正確性、文本依據、答案唯一性、開放題評分元素，以及跨篇比較題的比較邏輯。

- 題庫總題數：717
- 開放題總數：235（`short_answer`、`long_answer`、`fill_table`）
- 逐篇非跨篇開放題：178
- 跨篇／延後集中審核的開放題：57
- 16 個單元均已完成逐篇審核
- dedicated `cross-text.json` 與普通題庫中 `is_cross_text: true` 的 embedded 跨篇題均已集中反向核對

## 審核原則

1. 優先依據指定篇章文本本身，不把課外背景、作者生平或傳統詮釋當成唯一直接事實。
2. 傳統詮釋可以保留，但須標示為詮釋，不應偽裝成文本明言。
3. 開放題的每一分都應對應學生實際可作答、可區分的評分機會，避免重複計分。
4. 題目若允許多種立場，評分準則亦須真正接受多種立場，而非表面寫「言之成理」卻只給單一路線。
5. 單選題必須只有一個可辯護答案；如兩個選項在詞義、修辭或論證上均成立，需重寫題幹或選項。
6. 跨篇比較須分清「共同點」與各篇各自的文本證據，避免把不同思想概念因名稱相近而強行等同。
7. 詩詞意象、典故與象徵不作過度固定化；若存在合理歧義，評分準則須保留解讀空間。

## 主要修正類型

本輪修正包括但不限於：

- 將缺乏文本支持的作者思想／生平推論改為文本可直接支持的表述。
- 修正表格題「可填空格數」與分數／評分元素不一致的情況。
- 把開放立場題的 rubric 改為立場、證據、推理、比較等獨立評分元素。
- 修正跨篇比較中把不同概念強行等同的問題，例如把《岳陽樓記》的「古仁人」直接等同《論語》的「仁者」。
- 修正客觀題多答案／判準過鬆問題，例如虛詞、修辭與對比手法的選項唯一性。
- 修正文本硬錯，包括引文、字義、主體指涉與歷史典故。

## 最後反向掃描新增修正

封板前再次反向搜尋所有 embedded 跨篇題，另發現並修正：

- `yyl-content-037`：原題把第三、四段「遷客騷人」的兩種登樓情景誤寫為范仲淹本人兩次登樓；已改正主體與選項。
- `yw-words-002`：原單選題實際有兩個不同詞義答案；改為多選，正確辨別「患」作名詞「禍患」與動詞「擔心」。
- `yw-words-004`：原題只問「為」的詞性，存在多個動詞選項；改為更精確的詞義比較。
- `xy-words-001`：原題把因果承接與單純時間承接視為同一用法；改成明確比較前因後果關係。

相關收尾 commits：

- `11edcc1a88cda2971531c75772ae570c4b22edd5`
- `01098def1b1e149d23b5939c378ee81e866d2b32`
- `44c3f79858454d1751a7e4d4744226bed3428e54`

## 驗證狀態

在 `44c3f79858454d1751a7e4d4744226bed3428e54` 上，GitHub Actions `Validate content` run #159 已完整通過：

- JavaScript syntax
- curriculum / question data validation
- question and source-text correctness contracts
- accessibility interactions
- lazy-loading contract
- background and rubric integration
- learning continuity guidance
- wrong-answer retry loop
- cross-unit learning overview / targeted retry
- route race protection
- fingerprinted asset build
- initial-load performance contract
- Chromium real-browser smoke and performance contract
- full pre-launch browser QA matrix
- lazy-engine / warm-cache performance

## 封板結論

截至 2026-09-15，本輪「開放題評分語義 + 全跨篇題內容正確性」審核可視為完成。後續若新增或大幅改寫題目，應重新套用上述原則及 validator；現階段開發重點可轉入實際效能、手機操作體驗與上線前細節優化。
