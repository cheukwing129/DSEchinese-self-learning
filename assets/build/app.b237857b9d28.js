/* ============================================================
   app.js — 入口、資料載入、路由註冊、共用版面元件
   ============================================================ */

const App = (() => {
  const mainEl = () => document.getElementById("app-main");
  const crumbEl = () => document.getElementById("header-crumb");

  const cache = { curriculum: null, json: {}, scripts: {} };
  const UI_MODULES = Object.freeze({
    content: "/assets/build/content-renderer.e98250a79fe3.js",
    questions: "/assets/build/question-engine.ab36f2066af2.js",
    memorisation: "/assets/build/memorisation-engine.dab19bb23e8e.js"
  });

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

  function loadScriptCached(src) {
    if (!cache.scripts[src]) {
      cache.scripts[src] = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = src;
        script.async = true;
        script.dataset.uiModule = src;
        script.addEventListener("load", () => resolve(), { once: true });
        script.addEventListener("error", () => {
          delete cache.scripts[src];
          script.remove();
          reject(new Error(`無法載入介面模組「${src}」。`));
        }, { once: true });
        document.head.appendChild(script);
      });
    }
    return cache.scripts[src];
  }

  function loadUIModules(names = []) {
    return Promise.all([...new Set(names)].map((name) => {
      const src = UI_MODULES[name];
      if (!src) return Promise.reject(new Error(`未知介面模組「${name}」。`));
      return loadScriptCached(src);
    }));
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
    const navigationId = Router.currentNavigationId();
    setCrumb("");
    renderLoading("課程地圖");
    let curriculum;
    try {
      curriculum = await loadCurriculum();
      if (!Router.isCurrentNavigation(navigationId)) return;
    } catch (e) {
      if (!Router.isCurrentNavigation(navigationId)) return;
      renderFatalError(e.message);
      return;
    }

    const recent = Progress.latestLearning(curriculum.units);
    const recentUnit = recent ? curriculum.units.find((u) => u.id === recent.unitId) : null;
    const firstAvailable = curriculum.units.find((u) => u.status === "available");
    const primaryCard = recent && recentUnit ? `
      <article class="home-action-card home-action-primary">
        <p class="home-action-eyebrow">繼續上次學習</p>
        <h2 class="home-action-title">《${escapeHTML(recentUnit.title)}》</h2>
        <p class="home-action-meta">${escapeHTML(learningPathLabel(recent.path))}</p>
        <p class="home-action-copy">從你在這部裝置留下的最近學習位置接續，不必重新尋找進度。</p>
        <a class="btn home-action-button" href="#${escapeHTML(recent.path)}">繼續學習 <span aria-hidden="true">→</span></a>
      </article>` : firstAvailable ? `
      <article class="home-action-card home-action-primary">
        <p class="home-action-eyebrow">第一次來到這裡？</p>
        <h2 class="home-action-title">從《${escapeHTML(firstAvailable.title)}》開始</h2>
        <p class="home-action-meta">${escapeHTML(firstAvailable.author || "")}</p>
        <p class="home-action-copy">先讀原文，再按自己的節奏進入字詞、理解、賞析與練習。</p>
        <a class="btn home-action-button" href="#/unit/${firstAvailable.id}">開始學習 <span aria-hidden="true">→</span></a>
      </article>` : "";

    const overviewCard = `
      <article class="home-action-card home-action-secondary">
        <div class="home-action-symbol" aria-hidden="true">總</div>
        <div>
          <p class="home-action-eyebrow">學習整理</p>
          <h2 class="home-action-title">跨篇章學習總覽</h2>
          <p class="home-action-copy">集中查看待修正錯題、已修正紀錄與錯題較集中的能力範疇；只在開啟時載入完整題庫。</p>
          <a class="home-text-link" href="#/overview">查看總覽 <span aria-hidden="true">→</span></a>
        </div>
      </article>`;

    const cards = curriculum.units
      .map((u, unitIndex) => {
        const isAvailable = u.status === "available";
        const badge = isAvailable
          ? `<span class="badge badge-available">可學習</span>`
          : `<span class="badge badge-soon">準備中</span>`;
        const tag = isAvailable ? "a" : "div";
        const href = isAvailable ? `href="#/unit/${u.id}"` : "";
        return `
          <${tag} class="card map-card card-tappable ${isAvailable ? "" : "is-disabled"}" ${href}>
            <div class="map-card-top">
              <div class="map-card-meta">
                <span class="map-sequence">${String(unitIndex + 1).padStart(2, "0")}</span>
                ${u.group ? `<p class="map-group">${escapeHTML(u.group)}</p>` : ""}
              </div>
              ${badge}
            </div>
            <p class="map-title">${escapeHTML(u.title)}</p>
            <p class="map-author">${escapeHTML(u.author)}</p>
            ${isAvailable ? `<span class="map-arrow" aria-hidden="true">→</span>` : ""}
          </${tag}>
        `;
      })
      .join("");

    mount(`
      <section class="home-hero" aria-labelledby="home-title">
        <div class="home-hero-copy">
          <div class="home-kicker-row">
            <p class="home-kicker">DSE 中文 · 指定文言經典</p>
            <span class="home-edition-pill">SELF · STUDY</span>
          </div>
          <h1 id="home-title" class="page-title home-title">讀懂經典，<span>把每一步，<br />變成自己的能力。</span></h1>
          <p class="home-lead">從原文、字詞與文意出發，再進入賞析、背誦、作答與錯題修復。介面替你整理路徑，判斷仍然交給真實學習紀錄。</p>
          <div class="home-hero-chips" aria-label="學習內容">
            <span>原文</span><span>字詞</span><span>賞析</span><span>背誦</span><span>作答</span>
          </div>
        </div>
        <aside class="home-hero-visual" aria-label="自學路徑示意；不代表完成度或掌握程度">
          <div class="hero-visual-head">
            <div>
              <span class="hero-visual-label">LEARNING FLOW</span>
              <strong>一條清楚的自學路徑</strong>
            </div>
            <span class="hero-unit-count">${curriculum.units.length} 篇</span>
          </div>
          <div class="hero-path-grid">
            <div class="hero-path-step"><span>01</span><strong>讀</strong><small>原文與語境</small></div>
            <div class="hero-path-step"><span>02</span><strong>解</strong><small>字詞與文意</small></div>
            <div class="hero-path-step"><span>03</span><strong>析</strong><small>結構與主旨</small></div>
            <div class="hero-path-step"><span>04</span><strong>練</strong><small>作答與修正</small></div>
          </div>
          <p class="hero-visual-note">路徑只協助導航，不以瀏覽頁面推斷掌握程度。</p>
        </aside>
      </section>

      <section class="home-action-grid" aria-label="學習捷徑">
        ${primaryCard}
        ${overviewCard}
      </section>

      <section class="home-curriculum" aria-labelledby="curriculum-title">
        <div class="home-section-heading">
          <div>
            <p class="section-kicker">課程地圖</p>
            <h2 id="curriculum-title">選一篇，開始今天的學習</h2>
          </div>
          <p>不設虛假的總掌握百分比；進度只反映這部裝置留下的真實學習紀錄。</p>
        </div>
        <div class="map-grid">${cards}</div>
      </section>
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
    const navigationId = Router.currentNavigationId();
    setCrumb("跨篇章學習總覽");
    renderLoading("跨篇章學習總覽");
    try {
      const [{ curriculum, unitBundles }] = await Promise.all([
        loadCrossUnitBundles(),
        loadUIModules(["content"])
      ]);
      if (!Router.isCurrentNavigation(navigationId)) return;
      ContentRenderer.renderCrossUnitOverview(curriculum, unitBundles);
    } catch (e) {
      if (!Router.isCurrentNavigation(navigationId)) return;
      renderFatalError(e.message);
    }
  }

  async function pageCrossUnitRetry(params) {
    const navigationId = Router.currentNavigationId();
    const ability = params.ability === "all" ? null : params.ability;
    setCrumb(ability ? `${ability} · 跨篇章重練` : "跨篇章錯題重練");
    renderLoading("跨篇章錯題重練");
    try {
      const [{ unitBundles }] = await Promise.all([
        loadCrossUnitBundles(),
        loadUIModules(["questions"])
      ]);
      if (!Router.isCurrentNavigation(navigationId)) return;
      QuestionEngine.renderCrossUnitWrongRetry(unitBundles, ability);
    } catch (e) {
      if (!Router.isCurrentNavigation(navigationId)) return;
      renderFatalError(e.message);
    }
  }

  async function withUnitBundle(unitId, options, onReady) {
    const navigationId = Router.currentNavigationId();
    if (typeof options === "function") {
      onReady = options;
      options = {};
    }
    const uiModules = [...new Set(options.uiModules || [])];
    renderLoading("篇章資料");
    let bundle;
    try {
      [bundle] = await Promise.all([
        loadUnitBundle(unitId, options || {}),
        loadUIModules(uiModules)
      ]);
      if (!Router.isCurrentNavigation(navigationId)) return;
    } catch (e) {
      if (!Router.isCurrentNavigation(navigationId)) return;
      renderFatalError(e.message);
      return;
    }
    setCrumb(`《${bundle.unit.title}》`);
    const currentPath = Router.currentPath();
    if (currentPath !== `/unit/${unitId}`) Progress.recordLearningVisit(unitId, currentPath);
    onReady(bundle);
  }

  async function pageUnitHome(params) {
    await withUnitBundle(params.unitId, { resources: ["background"], uiModules: ["content"] }, (bundle) => {
      ContentRenderer.renderUnitHome(bundle, params.unitId);
    });
  }

  async function pageText(params) {
    await withUnitBundle(params.unitId, { resources: ["text"], uiModules: ["content"] }, (bundle) => {
      ContentRenderer.renderTextPage(bundle, params.unitId);
    });
  }

  async function pageWords(params) {
    await withUnitBundle(params.unitId, { resources: ["text"], uiModules: ["content"] }, (bundle) => {
      ContentRenderer.renderWordsPage(bundle, params.unitId);
    });
  }

  async function pageComprehension(params) {
    await withUnitBundle(params.unitId, { resources: ["text"], uiModules: ["content"] }, (bundle) => {
      ContentRenderer.renderComprehensionPage(bundle, params.unitId);
    });
  }

  async function pageAnalysis(params) {
    await withUnitBundle(params.unitId, { resources: ["structure"], uiModules: ["content"] }, (bundle) => {
      ContentRenderer.renderAnalysisPage(bundle, params.unitId);
    });
  }

  async function pageTheme(params) {
    await withUnitBundle(params.unitId, { resources: ["appreciation"], uiModules: ["content"] }, (bundle) => {
      ContentRenderer.renderThemePage(bundle, params.unitId);
    });
  }

  async function pageMemorisation(params) {
    await withUnitBundle(params.unitId, { resources: ["memorisation"], uiModules: ["memorisation"] }, (bundle) => {
      MemorisationEngine.render(bundle, params.unitId);
    });
  }

  async function pageCrossText(params) {
    await withUnitBundle(params.unitId, { uiModules: ["content"] }, (bundle) => {
      ContentRenderer.renderCrossTextPage(bundle, params.unitId);
    });
  }

  async function pageProgress(params) {
    await withUnitBundle(params.unitId, { resources: ["memorisation", "rubrics"], allQuestionBanks: true, uiModules: ["content"] }, (bundle) => {
      ContentRenderer.renderProgressPage(bundle, params.unitId);
    });
  }

  async function pageWrongRetry(params) {
    await withUnitBundle(params.unitId, { resources: ["rubrics"], allQuestionBanks: true, uiModules: ["questions"] }, (bundle) => {
      QuestionEngine.renderWrongRetry(bundle, params.unitId);
    });
  }

  // quiz pages: bankName 對應 data/units/x/question-banks/<bankName>.json 的 "bank" 值
  async function pageQuiz(params, bankName, title) {
    await withUnitBundle(params.unitId, { resources: ["rubrics"], banks: [bankName], uiModules: ["questions"] }, (bundle) => {
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
    await withUnitBundle(params.unitId, { resources: ["rubrics"], banks: ["cross-text"], uiModules: ["questions"] }, (bundle) => {
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
    await withUnitBundle(params.unitId, { resources: ["rubrics"], allQuestionBanks: true, uiModules: ["questions"] }, (bundle) => {
      QuestionEngine.renderChallengeSetup(bundle, params.unitId);
    });
  }

  async function pageChallengeRun(params) {
    await withUnitBundle(params.unitId, { resources: ["rubrics"], allQuestionBanks: true, uiModules: ["questions"] }, (bundle) => {
      QuestionEngine.renderChallengeRun(bundle, params.unitId);
    });
  }

  async function pageChallengeResult(params) {
    await withUnitBundle(params.unitId, { resources: ["rubrics"], allQuestionBanks: true, uiModules: ["questions"] }, (bundle) => {
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
