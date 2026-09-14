/* ============================================================
   app.js — 入口、資料載入、路由註冊、共用版面元件
   ============================================================ */

const App = (() => {
  const mainEl = () => document.getElementById("app-main");
  const crumbEl = () => document.getElementById("header-crumb");

  const cache = { curriculum: null, json: {} };

  // ---------- 資料載入 ----------
  async function fetchJSON(path) {
    let res;
    try {
      res = await fetch(path);
    } catch (networkErr) {
      throw new Error(`無法連接到檔案「${path}」（網絡或路徑錯誤）。`);
    }
    if (!res.ok) {
      throw new Error(`找不到檔案「${path}」（伺服器回應 ${res.status}）。請確認此 JSON 檔案存在於正確路徑。`);
    }
    try {
      return await res.json();
    } catch (parseErr) {
      throw new Error(`檔案「${path}」的 JSON 格式有誤，無法解析：${parseErr.message}`);
    }
  }

  function loadJSONCached(path) {
    if (!cache.json[path]) {
      cache.json[path] = fetchJSON(path).catch((err) => {
        delete cache.json[path];
        throw err;
      });
    }
    return cache.json[path];
  }

  async function loadCurriculum() {
    if (cache.curriculum) return cache.curriculum;
    cache.curriculum = await loadJSONCached("data/curriculum.json");
    return cache.curriculum;
  }

  function unitBase(unitId) {
    return `data/units/${unitId}`;
  }

  function bankFileName(path) {
    const leaf = path.split("/").pop() || "";
    return leaf.replace(/\.json$/i, "");
  }

  async function loadUnitMeta(unitId) {
    return loadJSONCached(`${unitBase(unitId)}/unit.json`);
  }

  async function loadUnitResource(unitId, resource) {
    return loadJSONCached(`${unitBase(unitId)}/${resource}.json`);
  }

  async function loadQuestionBank(unitId, unit, bankName) {
    const file = (unit.question_bank_files || []).find((f) => bankFileName(f) === bankName);
    if (!file) throw new Error(`篇章「${unit.title || unitId}」沒有題庫「${bankName}」。`);
    return loadJSONCached(`${unitBase(unitId)}/${file}`);
  }

  async function loadUnitBundle(unitId, options = {}) {
    const unit = await loadUnitMeta(unitId);
    const resources = [...new Set(options.resources || [])];
    const requestedBanks = [...new Set(options.banks || [])];
    const bankNames = options.allQuestionBanks
      ? (unit.question_bank_files || []).map(bankFileName)
      : requestedBanks;

    const bundle = { unit, banks: {} };

    await Promise.all(resources.map(async (resource) => {
      bundle[resource] = await loadUnitResource(unitId, resource);
    }));

    if (bankNames.length) {
      const results = await Promise.all(bankNames.map((name) => loadQuestionBank(unitId, unit, name)));
      results.forEach((bank, index) => {
        const name = bank.bank || bankNames[index];
        bundle.banks[name] = bank.questions || [];
      });
    }

    if (options.allQuestionBanks) {
      bundle.allQuestions = Object.values(bundle.banks).flat();
    }

    return bundle;
  }

  // ---------- 版面共用元件 ----------
  function mount(html) {
    mainEl().innerHTML = html;
  }

  function setCrumb(text) {
    crumbEl().textContent = text || "";
  }

  function renderLoading(label) {
    mount(`<div class="loading-state">正在載入${label || ""}…</div>`);
  }

  function renderFatalError(message) {
    mount(`
      <div class="card">
        <div class="error-banner">
          <strong>發生錯誤</strong><br/>${escapeHTML(message)}
        </div>
        <div class="btn-row">
          <a class="btn btn-secondary" href="#/">返回首頁</a>
        </div>
      </div>
    `);
  }

  function renderNotFound(path) {
    mount(`
      <div class="empty-state">
        <p>找不到頁面：${escapeHTML(path)}</p>
        <a class="btn btn-primary" href="#/">返回首頁</a>
      </div>
    `);
  }

  function escapeHTML(str) {
    const div = document.createElement("div");
    div.textContent = String(str == null ? "" : str);
    return div.innerHTML;
  }

  function footerNav(unitId, unitTitle) {
    return `
      <div class="footer-nav">
        ${unitId ? `<a class="btn btn-secondary" href="#/unit/${unitId}">返回《${escapeHTML(unitTitle || "")}》</a>` : ""}
        <a class="btn btn-ghost" href="#/">返回首頁</a>
      </div>
    `;
  }

  function moduleIconGlyph(icon) {
    const map = {
      book: "文", characters: "字", translate: "譯", structure: "構",
      lightbulb: "思", memory: "誦", target: "戰", chart: "統"
    };
    return map[icon] || "頁";
  }

  function learningPathLabel(path) {
    if (!path) return "篇章學習";
    if (path.includes("/words/quiz")) return "字詞與虛詞題庫";
    if (path.includes("/comprehension/quiz")) return "內容理解題庫";
    if (path.includes("/analysis/quiz")) return "結構與手法題庫";
    if (path.includes("/theme/quiz")) return "主旨與思考題庫";
    if (path.includes("/cross-text/quiz")) return "跨篇比較題";
    if (path.endsWith("/text")) return "原文與誦讀";
    if (path.endsWith("/words")) return "字詞與句式";
    if (path.endsWith("/comprehension")) return "疏通文意";
    if (path.endsWith("/analysis")) return "結構與鑒賞";
    if (path.endsWith("/theme")) return "主旨與思考";
    if (path.endsWith("/memorisation")) return "背誦精華";
    if (path.endsWith("/challenge")) return "核心篇章挑戰";
    if (path.endsWith("/progress/retry-wrong")) return "錯題重練";
    if (path.endsWith("/progress")) return "我的掌握";
    if (path.endsWith("/cross-text")) return "跨篇比較與進階題";
    return "篇章學習";
  }

  // ---------- 路由頁面 ----------
  async function pageHome() {
    setCrumb("");
    renderLoading("課程地圖");
    let curriculum;
    try {
      curriculum = await loadCurriculum();
    } catch (e) {
      renderFatalError(e.message);
      return;
    }
    const recent = Progress.latestLearning(curriculum.units);
    const recentUnit = recent ? curriculum.units.find((u) => u.id === recent.unitId) : null;
    const continueCard = recent && recentUnit ? `
      <div class="card" style="margin-bottom:24px;">
        <div class="section-title"><span class="seal">續</span>繼續上次學習</div>
        <p style="margin:0 0 6px; font-weight:700;">《${escapeHTML(recentUnit.title)}》 · ${escapeHTML(learningPathLabel(recent.path))}</p>
        <p style="margin:0 0 14px; color:var(--color-ink-soft); font-size:13px;">根據這部裝置最近的學習位置或活動紀錄。</p>
        <a class="btn btn-primary" href="#${escapeHTML(recent.path)}">繼續學習 →</a>
      </div>` : "";

    const overviewCard = `
      <div class="card" style="margin-bottom:24px;">
        <div class="section-title"><span class="seal">總</span>跨篇章學習總覽</div>
        <p style="margin:0 0 14px; color:var(--color-ink-soft); font-size:13px; line-height:1.7;">集中查看各篇待修正錯題、曾答錯後已修正的題目，以及錯題較集中的能力範疇。總覽只在你開啟時才載入各篇題庫。</p>
        <a class="btn btn-secondary" href="#/overview">查看跨篇章總覽 →</a>
      </div>`;

    const cards = curriculum.units
      .map((u) => {
        const isAvailable = u.status === "available";
        const badge = isAvailable
          ? `<span class="badge badge-available">可學習</span>`
          : `<span class="badge badge-soon">準備中</span>`;
        const tag = isAvailable ? "a" : "div";
        const href = isAvailable ? `href="#/unit/${u.id}"` : "";
        return `
          <${tag} class="card map-card card-tappable ${isAvailable ? "" : "is-disabled"}" ${href}>
            ${badge}
            ${u.group ? `<p class="map-group">${escapeHTML(u.group)}</p>` : ""}
            <p class="map-title">${escapeHTML(u.title)}</p>
            <p class="map-author">${escapeHTML(u.author)}</p>
          </${tag}>
        `;
      })
      .join("");
    mount(`
      <h1 class="page-title">十二篇指定文言經典 · 自學地圖</h1>
      <p class="page-subtitle">診斷弱項 → 微型學習 → 練習回饋 → 錯題修復 → 作品／進度累積</p>
      ${continueCard}
      ${overviewCard}
      <div class="map-grid">${cards}</div>
    `);
  }

  async function loadCrossUnitBundles() {
    const curriculum = await loadCurriculum();
    const available = (curriculum.units || []).filter((u) => u.status === "available");
    const unitBundles = await Promise.all(available.map(async (entry) => ({
      entry,
      bundle: await loadUnitBundle(entry.id, { allQuestionBanks: true })
    })));
    return { curriculum, unitBundles };
  }

  async function pageOverview() {
    setCrumb("跨篇章學習總覽");
    renderLoading("跨篇章學習總覽");
    try {
      const { curriculum, unitBundles } = await loadCrossUnitBundles();
      ContentRenderer.renderCrossUnitOverview(curriculum, unitBundles);
    } catch (e) {
      renderFatalError(e.message);
    }
  }

  async function pageCrossUnitRetry(params) {
    const ability = params.ability === "all" ? null : params.ability;
    setCrumb(ability ? `${ability} · 跨篇章重練` : "跨篇章錯題重練");
    renderLoading("跨篇章錯題重練");
    try {
      const { unitBundles } = await loadCrossUnitBundles();
      QuestionEngine.renderCrossUnitWrongRetry(unitBundles, ability);
    } catch (e) {
      renderFatalError(e.message);
    }
  }

  async function withUnitBundle(unitId, options, onReady) {
    if (typeof options === "function") {
      onReady = options;
      options = {};
    }
    renderLoading("篇章資料");
    let bundle;
    try {
      bundle = await loadUnitBundle(unitId, options || {});
    } catch (e) {
      renderFatalError(e.message);
      return;
    }
    setCrumb(`《${bundle.unit.title}》`);
    const currentPath = Router.currentPath();
    if (currentPath !== `/unit/${unitId}`) Progress.recordLearningVisit(unitId, currentPath);
    onReady(bundle);
  }

  async function pageUnitHome(params) {
    await withUnitBundle(params.unitId, { resources: ["background"] }, (bundle) => {
      ContentRenderer.renderUnitHome(bundle, params.unitId);
    });
  }

  async function pageText(params) {
    await withUnitBundle(params.unitId, { resources: ["text"] }, (bundle) => {
      ContentRenderer.renderTextPage(bundle, params.unitId);
    });
  }

  async function pageWords(params) {
    await withUnitBundle(params.unitId, { resources: ["text"] }, (bundle) => {
      ContentRenderer.renderWordsPage(bundle, params.unitId);
    });
  }

  async function pageComprehension(params) {
    await withUnitBundle(params.unitId, { resources: ["text"] }, (bundle) => {
      ContentRenderer.renderComprehensionPage(bundle, params.unitId);
    });
  }

  async function pageAnalysis(params) {
    await withUnitBundle(params.unitId, { resources: ["structure"] }, (bundle) => {
      ContentRenderer.renderAnalysisPage(bundle, params.unitId);
    });
  }

  async function pageTheme(params) {
    await withUnitBundle(params.unitId, { resources: ["appreciation"] }, (bundle) => {
      ContentRenderer.renderThemePage(bundle, params.unitId);
    });
  }

  async function pageMemorisation(params) {
    await withUnitBundle(params.unitId, { resources: ["memorisation"] }, (bundle) => {
      MemorisationEngine.render(bundle, params.unitId);
    });
  }

  async function pageCrossText(params) {
    await withUnitBundle(params.unitId, (bundle) => {
      ContentRenderer.renderCrossTextPage(bundle, params.unitId);
    });
  }

  async function pageProgress(params) {
    await withUnitBundle(params.unitId, { resources: ["memorisation", "rubrics"], allQuestionBanks: true }, (bundle) => {
      ContentRenderer.renderProgressPage(bundle, params.unitId);
    });
  }

  async function pageWrongRetry(params) {
    await withUnitBundle(params.unitId, { resources: ["rubrics"], allQuestionBanks: true }, (bundle) => {
      QuestionEngine.renderWrongRetry(bundle, params.unitId);
    });
  }

  // quiz pages: bankName 對應 data/units/x/question-banks/<bankName>.json 的 "bank" 值
  async function pageQuiz(params, bankName, title) {
    await withUnitBundle(params.unitId, { resources: ["rubrics"], banks: [bankName] }, (bundle) => {
      const questions = bundle.banks[bankName] || [];
      if (!questions.length) {
        mount(`<div class="empty-state">此題庫（${escapeHTML(bankName)}）暫無題目。</div>${footerNav(params.unitId, bundle.unit.title)}`);
        return;
      }
      const startIndex = params.__query.qi ? parseInt(params.__query.qi, 10) : 0;
      QuestionEngine.renderQuizSequence({
        bundle, unitId: params.unitId, questions,
        title, basePath: `#/unit/${params.unitId}`,
        startIndex, listKind: bankName
      });
    });
  }

  async function pageCrossTextQuiz(params) {
    await withUnitBundle(params.unitId, { resources: ["rubrics"], banks: ["cross-text"] }, (bundle) => {
      const all = bundle.banks["cross-text"] || [];
      const questions = params.target === "all" ? all : all.filter((q) => q.cross_text_target === params.target);
      if (!questions.length) {
        mount(`<div class="empty-state">找不到對應的跨篇題目。</div>${footerNav(params.unitId, bundle.unit.title)}`);
        return;
      }

      // 錯題本舊連結使用 qi=「完整 cross-text 題庫的 index」。
      // 當頁面再按 target 篩選時，需要把該 index 轉回本頁的 index，否則會跳錯題。
      let startIndex = 0;
      if (params.__query.qid) {
        const byId = questions.findIndex((q) => q.id === params.__query.qid);
        if (byId >= 0) startIndex = byId;
      } else if (params.__query.qi) {
        const rawIndex = parseInt(params.__query.qi, 10);
        if (!Number.isNaN(rawIndex)) {
          if (params.target === "all") {
            startIndex = rawIndex;
          } else {
            const original = all[rawIndex];
            const filteredIndex = original ? questions.findIndex((q) => q.id === original.id) : -1;
            if (filteredIndex >= 0) startIndex = filteredIndex;
          }
        }
      }

      QuestionEngine.renderQuizSequence({
        bundle, unitId: params.unitId, questions,
        title: "跨篇比較與進階題",
        basePath: `#/unit/${params.unitId}`,
        startIndex, listKind: "cross-text"
      });
    });
  }

  async function pageChallengeSetup(params) {
    await withUnitBundle(params.unitId, { resources: ["rubrics"], allQuestionBanks: true }, (bundle) => {
      QuestionEngine.renderChallengeSetup(bundle, params.unitId);
    });
  }

  async function pageChallengeRun(params) {
    await withUnitBundle(params.unitId, { resources: ["rubrics"], allQuestionBanks: true }, (bundle) => {
      QuestionEngine.renderChallengeRun(bundle, params.unitId);
    });
  }

  async function pageChallengeResult(params) {
    await withUnitBundle(params.unitId, { resources: ["rubrics"], allQuestionBanks: true }, (bundle) => {
      QuestionEngine.renderChallengeResult(bundle, params.unitId);
    });
  }

  // ---------- 初始化 ----------
  function registerRoutes() {
    Router.register("/", pageHome);
    Router.register("/overview", pageOverview);
    Router.register("/overview/retry/:ability", pageCrossUnitRetry);
    Router.register("/unit/:unitId", pageUnitHome);
    Router.register("/unit/:unitId/text", pageText);
    Router.register("/unit/:unitId/words", pageWords);
    Router.register("/unit/:unitId/words/quiz", (p) => pageQuiz(p, "words", "字詞與虛詞題庫"));
    Router.register("/unit/:unitId/comprehension", pageComprehension);
    Router.register("/unit/:unitId/comprehension/quiz", (p) => pageQuiz(p, "content", "內容理解題庫"));
    Router.register("/unit/:unitId/analysis", pageAnalysis);
    Router.register("/unit/:unitId/analysis/quiz", (p) => pageQuiz(p, "structure-skill", "結構與手法題庫"));
    Router.register("/unit/:unitId/theme", pageTheme);
    Router.register("/unit/:unitId/theme/quiz", (p) => pageQuiz(p, "theme", "主旨與思考題庫"));
    Router.register("/unit/:unitId/memorisation", pageMemorisation);
    Router.register("/unit/:unitId/challenge", pageChallengeSetup);
    Router.register("/unit/:unitId/challenge/run", pageChallengeRun);
    Router.register("/unit/:unitId/challenge/result", pageChallengeResult);
    Router.register("/unit/:unitId/cross-text", pageCrossText);
    Router.register("/unit/:unitId/cross-text/quiz/:target", pageCrossTextQuiz);
    Router.register("/unit/:unitId/progress", pageProgress);
    Router.register("/unit/:unitId/progress/retry-wrong", pageWrongRetry);
  }

  function init() {
    registerRoutes();
    Router.start();
  }

  return {
    init, mount, setCrumb, renderLoading, renderFatalError, renderNotFound,
    escapeHTML, footerNav, moduleIconGlyph, fetchJSON
  };
})();

document.addEventListener("DOMContentLoaded", App.init);
