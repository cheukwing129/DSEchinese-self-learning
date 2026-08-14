# 中文經典自學網站（chinese-classics-self-learning）

香港高中中國語文科．十二篇指定文言經典自學網站。
已正式上線：**《岳陽樓記》**（范仲淹）、**《師說》**（韓愈）、**《論仁、論孝、論君子》**（《論語》）。其餘篇章於首頁顯示「準備中」。

核心學習流程：**診斷弱項 → 微型學習 → 練習回饋 → 錯題修復 → 作品／進度累積**

---

## 一、技術架構

- 純 **HTML + CSS + JavaScript**，無 React / Vue / Tailwind / npm / 任何框架
- **Hash-based 路由**（`#/...`），單一 `index.html` 作為入口，避免靜態網站 deep-link 404 問題
- 所有內容與題庫資料以 **JSON** 檔案儲存於 `data/`，由 `fetch()` 動態載入
- 學生的作答紀錄、錯題、反思**只儲存在該裝置瀏覽器的 `localStorage`**，不會上傳到任何伺服器
- 部署：**Cloudflare Pages**；版本管理：**GitHub**

## 二、檔案結構

```
chinese-classics-self-learning/
├── index.html                      ← 網站唯一入口
├── README.md
├── css/
│   └── style.css                   ← 全站樣式（淺色 iOS 卡片風格）
├── js/
│   ├── app.js                      ← 入口、資料載入、路由註冊
│   ├── router.js                   ← hash-based 路由
│   ├── content-renderer.js         ← 內容頁面（原文/字詞/疏通/結構/主旨/跨篇/我的掌握）
│   ├── question-engine.js          ← 題目渲染與作答互動邏輯
│   ├── memorisation-engine.js      ← 背誦精華（遮字/重組/易錯字）
│   └── progress.js                 ← localStorage 進度、錯題、反思
├── data/
│   ├── curriculum.json             ← 十二篇地圖
│   └── units/
│       ├── yueyanglouji/         （結構同下，共 77 題）
│       ├── shishuo/              （結構同下，共 60 題）
│       └── lunyu-renxiaojunzi/
│           ├── unit.json           ← 篇章 meta（模組清單、跨篇對象、題庫檔案清單、音檔路徑）
│           ├── text.json           ← 原文 16 則 + 45 條教育局注釋
│           ├── background.json     ← 作者簡介、寫作背景
│           ├── appreciation.json   ← 按則賞析重點、語言特色
│           ├── structure.json      ← 論仁／論孝／論君子三部分、對比組、手法例句
│           ├── memorisation.json   ← 背誦句群、易錯字
│           ├── rubrics.json        ← 長問答通用評分元素、自評清單
│           └── question-banks/
│               ├── words.json          （27題：字詞／虛詞，含跨篇虛詞辨析）
│               ├── content.json        （14題：內容理解）
│               ├── structure-skill.json（8題：結構／手法／修辭）
│               ├── theme.json          （10題：主旨與思考，含開放題）
│               └── cross-text.json     （2題：跨篇比較，對象包括《勸學》《出師表》）
└── assets/
    └── audio/                      ← 誦讀音檔（見下方對照表）
```

日後新增篇章（例如《出師表》）只需：
1. 在 `data/units/` 下新增對應資料夾與 JSON 檔案（複製 `yueyanglouji/` 結構）
2. 把 `data/curriculum.json` 中該篇的 `status` 改為 `"available"`
3. 不需要改動任何 HTML/CSS/JS——全部頁面模板、題庫引擎、進度系統均為共用

### 誦讀音檔對照表

音檔放在 `assets/audio/`，檔名須與下表完全一致（大小寫、底線），`curriculum.json` 及各篇 `unit.json` 的 `audio_file` 欄位已對應好路徑：

| 篇章 | 檔名 |
|---|---|
| 岳陽樓記 | `yue_yang_lou_ji.mp3` |
| 師說 | `shi_shuo.mp3` |
| 論仁、論孝、論君子 | `lun_ren_lun_xiao_lun_jun_zi.mp3` |
| 出師表 | `chu_shi_biao.mp3` |
| 六國論 | `liu_guo_lun.mp3` |
| 逍遙遊 | `xiao_yao_you.mp3` |
| 勸學 | `quan_xue.mp3` |
| 魚我所欲也 | `yu_wo_suo_yu_ye.mp3` |
| 廉頗藺相如列傳 | `lian_po_lin_xiang_ru_lie_zhuan.mp3` |
| 始得西山宴遊記 | `shi_de_xi_shan_yan_you_ji.mp3` |
| 山居秋暝 | `shan_ju_qiu_ming.mp3` |
| 月下獨酌（其一） | `yue_xia_du_zhuo_1.mp3` |
| 登樓 | `deng_lou.mp3` |
| 念奴嬌．赤壁懷古 | `nian_nu_jiao_chi_bi_huai_gu.mp3` |
| 聲聲慢．秋情 | `sheng_sheng_man_qiu_qing.mp3` |
| 青玉案．元夕 | `qing_yu_an_yuan_xi.mp3` |

「原文與誦讀」頁面會自動偵測該篇 `unit.json` 中的 `audio_file` 欄位，若存在就顯示播放器；若日後新增篇章時忘記加這個欄位，播放器不會顯示（不會報錯），記得建立新篇章時補上。

---

## 三、⚠️ 重要：本機測試方法（必讀）

本專案使用 `fetch()` 讀取 JSON 檔案。**大部分瀏覽器（尤其 Chrome）基於安全限制，不允許以「直接雙擊開啟 index.html」（`file://` 協定）的方式讀取本機的 JSON 檔案**，會在瀏覽器 Console 看到類似 `CORS` 或 `Failed to fetch` 的錯誤，畫面亦會停留在「正在載入…」。

**必須透過本機伺服器開啟**，方法如下（三選一）：

### 方法 A：使用 Python（大部分電腦已安裝）
```bash
cd chinese-classics-self-learning
python3 -m http.server 8000
```
然後在瀏覽器開啟：`http://localhost:8000`

### 方法 B：使用 VS Code 的 Live Server 擴充功能
安裝 "Live Server" 擴充功能後，在 `index.html` 上按右鍵 → "Open with Live Server"。

### 方法 C：使用 Node.js 的 `npx serve`
```bash
cd chinese-classics-self-learning
npx serve .
```

> 提醒：這是**正式多檔案版本**的必要限制，屬正常現象，並非程式錯誤。

---

## 四、GitHub 上傳步驟

### 方法一：純網頁介面上傳（不需要安裝 Git／終端機）

1. 登入 [github.com](https://github.com)，右上角「+」→ **New repository**
   - Repository name：`chinese-classics-self-learning`
   - Public 或 Private 皆可
   - **不要**勾選「Add a README file」等初始化選項（保持全空的 repository，避免與我們自己的 README.md 衝突）
   - 按 **Create repository**
2. 建立後的頁面會顯示「…or push an existing repository」等指示，往下找到 **uploading an existing file** 連結並點擊（或之後在 repository 頁面按 **Add file → Upload files**）
3. 打開你電腦上解壓後的 `chinese-classics-self-learning` 資料夾，**全選裡面的所有項目**（`index.html`、`README.md`、`css`、`js`、`data`、`assets` 五項），直接拖曳到瀏覽器的上傳區
   - ⚠️ 請拖曳「資料夾裡面的內容」，不要把最外層的 `chinese-classics-self-learning` 資料夾本身拖進去，否則路徑會多一層，網站會找不到檔案
   - 建議使用 **Chrome 或 Edge** 瀏覽器操作，folder 拖放支援較完整
4. 拖放後，GitHub 會列出所有將上傳的檔案（應該有 22 個檔案，包含子資料夾），確認 `css/`、`js/`、`data/units/yueyanglouji/question-banks/` 等子資料夾結構都有正確顯示
5. 在底部「Commit changes」填寫說明（例如：「首次上線：岳陽樓記完整內容與題庫」），選擇 **Commit directly to the `main` branch**，按 **Commit changes**
6. 上傳完成後，可在 repository 頁面點開 `data/units/yueyanglouji/question-banks/` 等子資料夾，確認檔案都在正確位置

> 如果拖放大量檔案時瀏覽器沒有反應或漏掉子資料夾，可改用 **[GitHub Desktop](https://desktop.github.com/)**（圖形介面程式，不用打指令）：安裝後登入你的 GitHub 帳號 → File → Add Local Repository → 選擇解壓後的資料夾 → 它會自動顯示所有新檔案 → 填寫 commit 說明 → 按 **Commit to main** → 按 **Publish repository**。

### 方法二：使用 Git 指令（如日後電腦有裝 Git）

```bash
cd chinese-classics-self-learning
git init
git add .
git commit -m "首次上線：岳陽樓記完整內容與題庫"
git remote add origin https://github.com/<你的帳號>/chinese-classics-self-learning.git
git branch -M main
git push -u origin main
```

## 五、Cloudflare Pages 部署步驟

1. 登入 [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **建立應用程式** → **Pages** → **連接到 Git**
2. 選擇你剛推送的 `chinese-classics-self-learning` repository
3. 建置設定：
   - **Framework preset**：`None`
   - **Build command**：留空（不需要）
   - **Build output directory**：`/`（專案根目錄，因為 `index.html` 在最外層）
4. 按「儲存並部署」，完成後會得到一個 `https://<專案名>.pages.dev` 的網址
5. 日後每次 `git push` 到 `main` 分支，Cloudflare Pages 會自動重新部署

---

## 六、測試網址後的完整功能檢查表

**技術完整性**
- [ ] 透過本機伺服器（非雙擊）開啟，首頁「十二篇指定文言經典．自學地圖」正常顯示 16 張卡片
- [ ] 開啟瀏覽器開發者工具 Console，全程無紅色錯誤訊息
- [ ] 只有《岳陽樓記》可點擊進入，其餘顯示「準備中」且不可點擊
- [ ] 網址列的 hash（`#/...`）在切換頁面時正確變化，重新整理頁面後仍停留在同一頁

**導覽**
- [ ] 篇章首頁 8 個模組卡片全部可點擊並進入對應頁面
- [ ] 每個內容頁與題目頁底部均有「返回《岳陽樓記》」「返回首頁」
- [ ] 題目頁固定顯示「← 上一題」「下一題 →」，並正確地在題首/題末停用

**作答互動規則**
- [ ] 在任一客觀題選錯答案後，畫面**不會**自動跳到下一題
- [ ] 提交後立即顯示：你的答案／正確答案／解析
- [ ] 必須按「我已看完答案，下一題」才前進到下一題
- [ ] 可以不作答，直接按「下一題 →」跳過
- [ ] 返回已作答的題目時，仍顯示之前的作答與解析（重新整理頁面後也保留，因為存於 localStorage）
- [ ] 開放題／長問答輸入框沒有字數下限，可提交極短答案

**內容準確性**
- [ ] 原文與教育局 PDF 一致（5 段），41 條注釋可點擊查看
- [ ] 題庫題目、正確答案與試題庫 DOCX 一致（建議至少抽查 10 題核對）
- [ ] 「原文與誦讀」頁面的音訊播放器可正常播放對應篇章的錄音

**手機適用性**
- [ ] 以手機瀏覽器（或開發者工具的手機模擬檢視）開啟，文字與按鈕清晰可讀，可正常操作

**核心篇章挑戰 / 我的掌握**
- [ ] 核心篇章挑戰可選擇範圍與題數，作答後可看到結果與錯因分布
- [ ] 「我的掌握」頁面顯示整體正確率、能力分項、錯題本，點擊錯題可跳回該題

---

## 七、學生測試表（建議印給學生試用時填寫）

| 檢查項目 | 正常 ✓ / 有問題 ✗ | 備註 |
|---|---|---|
| 能順利進入《岳陽樓記》篇章首頁 | | |
| 原文頁可點字看注釋 | | |
| 字詞題庫作答流暢，答錯後看得懂解析 | | |
| 疏通文意的填表題可正常填寫 | | |
| 結構與鑒賞頁的結構圖清楚易懂 | | |
| 主旨與思考的反思欄可儲存 | | |
| 背誦精華的遮字／重組好玩、有幫助 | | |
| 核心篇章挑戰完成後看得懂結果 | | |
| 「我的掌握」清楚顯示自己的強弱項 | | |
| 手機上使用暢順，字夠大、按鈕好按 | | |

---

## 八、常見錯誤排查表

| 現象 | 可能原因 | 解決方法 |
|---|---|---|
| 畫面停留在「正在載入…」不動 | 用雙擊 `index.html` 直接開啟（`file://`），瀏覽器封鎖了本機 `fetch()` | 改用本機伺服器開啟（見「三、本機測試方法」） |
| 畫面顯示紅色「發生錯誤」及具體檔案路徑 | 對應的 JSON 檔案不存在、路徑打錯或格式有誤 | 訊息會直接列出出錯的檔案路徑，檢查該路徑是否存在、JSON 是否符合格式 |
| Cloudflare Pages 部署後顯示 404 | Build output directory 設定錯誤 | 確認設定為 `/`（根目錄），而非 `dist` 或其他子目錄 |
| 部署後 JSON 讀取失敗，但本機正常 | 檔案路徑大小寫問題（Cloudflare 的檔案系統對大小寫敏感，本機 macOS/Windows 有時不敏感） | 確認 `data/units/yueyanglouji/...` 各層資料夾與檔名大小寫，與程式碼內引用完全一致 |
| 用網頁拖放上傳後，Cloudflare 顯示找不到某些 JSON 檔案 | 拖放時把最外層 `chinese-classics-self-learning` 資料夾本身拖進去，導致 GitHub 上多了一層資料夾（變成 `chinese-classics-self-learning/index.html` 而非 `index.html` 在根目錄） | 打開 repository 檢查 `index.html` 是否在最頂層；如果不是，刪除該次上傳，重新只拖放「資料夾裡面的檔案與子資料夾」，不要連最外層資料夾一起拖 |
| 新增第二篇章後首頁顯示不到 | 忘記把 `curriculum.json` 對應項目的 `status` 改為 `"available"` | 檢查 `data/curriculum.json` |
| 作答紀錄在手機和電腦不同步 | 屬正常設計：進度只存在該裝置瀏覽器的 localStorage，未做帳號同步 | 如需跨裝置同步，屬日後功能，需另行設計（例如匯出/匯入） |
| 清除瀏覽器資料後進度消失 | localStorage 被清除（如清除瀏覽紀錄、無痕模式、換瀏覽器） | 屬正常現象，目前無雲端備份機制 |

---

## 九、已知限制（第一版）

- 意群停頓提示尚未提供
- 長問答／開放題不設自動精確評分，只提供參考評分元素與自評清單（`teacher_review_placeholder` 已預留，日後可接入教師評閱或 AI 教練功能）
- 進度只存於單一裝置瀏覽器，未有跨裝置同步或教師後台
- 部分試題庫原文格式不清晰之處，已按最合理判斷處理，建議教師使用前再核對一次：
  - 《岳陽樓記》：Q2／Q25／Q32／Q51（詳見對應題目的 `note` 欄位）
