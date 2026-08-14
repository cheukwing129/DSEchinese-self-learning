/* ============================================================
   app.js — 入口、資料載入、路由註冊、共用版面元件
   ============================================================ */

const App = (() => {
  const mainEl = () => document.getElementById("app-main");
  const crumbEl = () => document.getElementById("header-crumb");

  const cache = { curriculum: null, units: {} }; // units[unitId] = bundle

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

  async function loadCurriculum() {
    if (cache.curriculum) return cache.curriculum;
    cache.curriculum = await fetchJSON("data/curriculum.json");
    return cache.curriculum;
  }

  async function loadUnitBundle(unitId) {
    if (cache.units[unitId]) return cache.units[unitId];
    const base = `data/units/${unitId}`;
    const unit = await fetchJSON(`${base}/unit.json`);

    const [text, background, appreciation, structure, memorisation, rubrics] = await Promise.all([
      fetchJSON(`${base}/text.json`),
      fetchJSON(`${base}/background.json`),
      fetchJSON(`${base}/appreciation.json`),
      fetchJSON(`${base}/structure.json`),
      fetchJSON(`${base}/memorisation.json`),
      fetchJSON(`${base}/rubrics.json`)
    ]);

    const bankFiles = unit.question_bank_files || [];
    const bankResults = await Promise.all(bankFiles.map((f) => fetchJSON(`${base}/${f}`)));
    const banks = {};
    let allQuestions = [];
    bankResults.forEach((b) => {
      banks[b.bank] = b.questions;
      allQuestions = allQuestions.concat(b.questions);
    });

    const bundle = { unit, text, background, appreciation, structure, memorisation, rubrics, banks, allQuestions };
    cache.units[unitId] = bundle;
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
      <div class="map-grid">${cards}</div>
    `);
  }

  async function withUnitBundle(unitId, onReady) {
    renderLoading("篇章資料");
    let bundle;
    try {
      bundle = await loadUnitBundle(unitId);
    } catch (e) {
      renderFatalError(e.message);
      return;
    }
    setCrumb(`《${bundle.unit.title}》`);
    onReady(bundle);
  }

  async function pageUnitHome(params) {
    await withUnitBundle(params.unitId, (bundle) => {
      ContentRenderer.renderUnitHome(bundle, params.unitId);
    });
  }

  async function pageText(params) {
    await withUnitBundle(params.unitId, (bundle) => {
      ContentRenderer.renderTextPage(bundle, params.unitId);
    });
  }

  async function pageWords(params) {
    await withUnitBundle(params.unitId, (bundle) => {
      ContentRenderer.renderWordsPage(bundle, params.unitId);
    });
  }

  async function pageComprehension(params) {
    await withUnitBundle(params.unitId, (bundle) => {
      ContentRenderer.renderComprehensionPage(bundle, params.unitId);
    });
  }

  async function pageAnalysis(params) {
    await withUnitBundle(params.unitId, (bundle) => {
      ContentRenderer.renderAnalysisPage(bundle, params.unitId);
    });
  }

  async function pageTheme(params) {
    await withUnitBundle(params.unitId, (bundle) => {
      ContentRenderer.renderThemePage(bundle, params.unitId);
    });
  }

  async function pageMemorisation(params) {
    await withUnitBundle(params.unitId, (bundle) => {
      MemorisationEngine.render(bundle, params.unitId);
    });
  }

  async function pageCrossText(params) {
    await withUnitBundle(params.unitId, (bundle) => {
      ContentRenderer.renderCrossTextPage(bundle, params.unitId);
    });
  }

  async function pageProgress(params) {
    await withUnitBundle(params.unitId, (bundle) => {
      ContentRenderer.renderProgressPage(bundle, params.unitId);
    });
  }

  // quiz pages: bankName 對應 data/units/x/question-banks/<bankName>.json 的 "bank" 值
  async function pageQuiz(params, bankName, title) {
    await withUnitBundle(params.unitId, (bundle) => {
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
    await withUnitBundle(params.unitId, (bundle) => {
      const all = bundle.banks["cross-text"] || [];
      const questions = params.target === "all" ? all : all.filter((q) => q.cross_text_target === params.target);
      if (!questions.length) {
        mount(`<div class="empty-state">找不到對應的跨篇題目。</div>${footerNav(params.unitId, bundle.unit.title)}`);
        return;
      }
      QuestionEngine.renderQuizSequence({
        bundle, unitId: params.unitId, questions,
        title: "跨篇比較與進階題",
        basePath: `#/unit/${params.unitId}`,
        startIndex: 0, listKind: "cross-text"
      });
    });
  }

  async function pageChallengeSetup(params) {
    await withUnitBundle(params.unitId, (bundle) => {
      QuestionEngine.renderChallengeSetup(bundle, params.unitId);
    });
  }

  async function pageChallengeRun(params) {
    await withUnitBundle(params.unitId, (bundle) => {
      QuestionEngine.renderChallengeRun(bundle, params.unitId);
    });
  }

  async function pageChallengeResult(params) {
    await withUnitBundle(params.unitId, (bundle) => {
      QuestionEngine.renderChallengeResult(bundle, params.unitId);
    });
  }

  // ---------- 初始化 ----------
  function registerRoutes() {
    Router.register("/", pageHome);
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
  }

  function init() {
    registerRoutes();
    document.getElementById("brand-home-link").addEventListener("click", () => Router.navigate("/"));
    Router.start();
  }

  return {
    init, mount, setCrumb, renderLoading, renderFatalError, renderNotFound,
    escapeHTML, footerNav, moduleIconGlyph, fetchJSON
  };
})();

document.addEventListener("DOMContentLoaded", App.init);
