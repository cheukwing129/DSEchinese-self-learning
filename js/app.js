/* ============================================================
   app.js — 入口、資料載入、路由註冊、共用版面元件
   ============================================================ */

const App = (() => {
  const mainEl = () => document.getElementById("app-main");
  const crumbEl = () => document.getElementById("header-crumb");
  let pendingRouteFocus = false, skipInitialHashFocus = !window.location.hash;

  const cache = { curriculum: null, json: {}, scripts: {} };
  const UI_MODULES = Object.freeze({
    content: "js/content-renderer.js",
    contentReader: "js/content-renderer.js",
    contentStudy: "js/content-renderer.js",
    contentProgress: "js/content-renderer.js",
    progressAnalytics: "js/progress-analytics.js",
    questions: "js/question-engine.js",
    memorisation: "js/memorisation-engine.js"
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
    const main = mainEl();
    main.innerHTML = html;
    if (pendingRouteFocus && !main.querySelector(".loading-state")) {
      pendingRouteFocus = false;
      const target = main.querySelector("h1") || main;
      target.tabIndex = -1;
      target.focus({ preventScroll: true });
    }
  }

  function bindKeyboardNavigation() {
    document.querySelector(".skip-link").addEventListener("click", (event) => {
      event.preventDefault();
      mainEl().focus();
    });
    window.addEventListener("hashchange", () => {
      if (skipInitialHashFocus) skipInitialHashFocus = false;
      else pendingRouteFocus = true;
    });
  }

  function syncHeaderState() {
    const path = Router.currentPath();
    const routeKind = path.startsWith("/overview") ? "overview" : (path === "/" || path.startsWith("/unit/")) ? "chapters" : "other";
    document.body.dataset.route = routeKind;
    document.querySelectorAll(".header-nav-link").forEach((link) => {
      const active = link.dataset.nav === routeKind;
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  }

  function setCrumb(text) {
    const label = text || "";
    crumbEl().textContent = label;
    document.title = label ? `${label} · 文脈` : "文脈 · DSE 經典自學";
    syncHeaderState();
  }

  function renderLoading(label) {
    syncHeaderState();
    const safeLabel = escapeHTML(label || "學習內容");
    mount(`
      <div class="loading-state launch-loading" role="status" aria-live="polite">
        <span class="loading-mark" aria-hidden="true"><span>文</span></span>
        <div><strong>正在整理${safeLabel}</strong><small>只載入這一頁真正需要的內容。</small></div>
      </div>
    `);
  }

  function scheduleLoading(label, navigationId, delay = 120) {
    syncHeaderState();
    const timer = window.setTimeout(() => {
      if (Router.isCurrentNavigation(navigationId)) renderLoading(label);
    }, delay);
    return () => window.clearTimeout(timer);
  }

  function renderFatalError(message) {
    setCrumb("載入失敗");
    mount(`
      <section class="launch-state is-error" role="alert" aria-labelledby="fatal-title">
        <div class="launch-state-mark" aria-hidden="true">!</div>
        <p class="launch-state-kicker">LOAD ERROR</p>
        <h1 id="fatal-title" class="page-title">這一頁暫時未能載入</h1>
        <p class="launch-state-copy">${escapeHTML(message)}</p>
        <p class="launch-state-help">你的本機學習紀錄不會因這次載入失敗而被清除。</p>
        <div class="launch-state-actions">
          <button type="button" class="btn btn-primary" id="retry-page-btn">再試一次</button>
          <a class="btn btn-secondary" href="#/">返回首頁</a>
        </div>
      </section>
    `);
    const retry = document.getElementById("retry-page-btn");
    if (retry) retry.addEventListener("click", () => Router.navigate(Router.currentPath()));
  }

  function renderNotFound(path) {
    setCrumb("找不到頁面");
    mount(`
      <section class="launch-state is-not-found" aria-labelledby="not-found-title">
        <div class="launch-state-code" aria-hidden="true">404</div>
        <p class="launch-state-kicker">LOST IN THE MARGIN</p>
        <h1 id="not-found-title" class="page-title">這一頁不在文脈裡</h1>
        <p class="launch-state-copy">網址「${escapeHTML(path)}」沒有對應的學習頁面。你可以回到篇章地圖，或查看目前的學習總覽。</p>
        <div class="launch-state-actions">
          <a class="btn btn-primary" href="#/">回到篇章</a>
          <a class="btn btn-secondary" href="#/overview">學習總覽</a>
        </div>
      </section>
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
    if (path.endsWith("/text")) return "文章內容";
    if (path.endsWith("/words")) return "字詞與句式";
    if (path.endsWith("/comprehension")) return "文章內容";
    if (path.endsWith("/analysis")) return "結構與鑒賞";
    if (path.endsWith("/theme")) return "主旨與思考";
    if (path.endsWith("/memorisation")) return "背誦精華";
    if (path.endsWith("/challenge")) return "核心篇章挑戰";
    if (path.endsWith("/progress/retry-wrong")) return "錯題重練";
    if (path.endsWith("/progress")) return "我的掌握";
    if (path.endsWith("/cross-text")) return "跨篇比較與進階題";
    return "篇章學習";
  }

  // 文脈藏書閣：獨立輕量線描，不另發圖片網絡請求。
  const BOOKPLATES = {"lunyu-renxiaojunzi":["先秦 · 語錄","仁、孝與君子","bamboo","jade"],"yu-wo-suoyu":["先秦 · 論說","捨生取義","fish","blue"],"xiaoyaoyou":["先秦 · 哲思","乘風逍遙","crane","sea"],"quanxue":["先秦 · 論說","積學成德","books","umber"],"lianpo-linxiangru":["漢 · 史傳","將相和合","horse","rust"],"shishuo":["唐 · 論說","傳道授業","scroll","gold"],"chushibiao":["三國 · 表奏","忠誠與北伐","standard","blue"],"shide-xishan-yanyouji":["唐 · 遊記","遊觀西山","peaks","jade"],"yueyanglouji":["宋 · 記","洞庭煙波","tower","blue"],"liuguolun":["宋 · 論說","六國興亡","fortress","umber"],"shanju-qiuming":["唐 · 詩","空山新雨","pines","jade"],"yuexia-duzhuo":["唐 · 詩","花間月下","wine","gold"],"denglou":["唐 · 詩","登高望遠","terrace","blue"],"niannujiao-chibihuaigu":["宋 · 詞","大江東去","cliffs","rust"],"shengshengman-qiuqing":["宋 · 詞","梧桐細雨","leaves","umber"],"qingyu'an-yuanxi":["宋 · 詞","東風夜放花千樹","lanterns","gold"]};

  function bookplateArt(motif) {
  const scenes={
    bamboo:'<path d="M65 120 87 24M97 120 105 16M135 120 133 33" stroke-width="3"/><path d="M87 53q-20-24-39-10 18 20 39 17M87 67q22-29 47-21-20 24-45 28M106 36q-15-21-30-15 13 21 30 22M134 59q17-23 43-23-15 25-43 29M134 86q-20-19-40-14 19 17 40 20" fill="#4b8174" stroke="none"/><path d="M74 75l24 4M93 103l25 3M123 73l23 2" stroke-width="1.7"/>',
    fish:'<path d="M38 89c28-34 64-37 98-15l26-17-3 40-24-12C107 108 65 108 38 89Z" fill="#476f83" stroke-width="2"/><path d="M39 88l-18-15 4 29 14-14ZM85 74q20 15 39 0M88 104q18-20 38-10M66 89h2" stroke-width="2"/><circle cx="56" cy="85" r="2.5" fill="#f7efe0" stroke="none"/><path d="M139 35q10-15 21 0t21 0M45 40q7-12 15 0t15 0" stroke="#b89054" stroke-width="2"/>',
    crane:'<path d="M30 86Q70 48 113 71q28 5 42-18-5 31-35 32l-21 31-9-37-42 27-18-20Z" fill="#62899a" stroke-width="1.7"/><path d="M104 68q37-46 92-42-41 19-83 56" stroke-width="4"/><path d="M168 46l25-7-17 13" stroke="#b89054"/><path d="M32 65q5-8 11 0M15 48q8-9 17 0M160 101q18-10 36 0" stroke="#b89054" stroke-width="2"/>',
    books:'<path d="M48 93v-24l81-24 50 18v25l-84 24-47-19Z" fill="#e8d7ba" stroke-width="2"/><path d="M48 69l47 19 84-25M95 88v24M58 66V47l71-20 42 17v18M57 47l43 18 71-21M100 65v21M67 43V31l59-16 34 12v17M67 31l35 14 58-18" stroke-width="2"/><path d="m118 60 24-8m-20 18 24-8m-33 33 45-14" stroke="#b89054" stroke-width="2"/>',
    horse:'<path d="M40 100 59 71 94 66l17-18 20 5 7 21-17 13-15-4-19 10-10 24-12-1 2-27-17 26-13-4Z" fill="#36586b" stroke-width="2.5"/><path d="M115 50q-1-15 12-23l-2 26M68 70Q47 59 43 36M77 84l14 14M115 83l16 29" stroke-width="3"/><path d="M144 44q18-12 31 0M149 58q24-7 40 4" stroke="#b89054" stroke-width="2"/>',
    scroll:'<path d="M50 41q0-11 11-11h109q11 0 11 11v55q0 11-11 11H61q-11 0-11-11Z" fill="#eee0c8" stroke-width="2"/><path d="M65 24v92M169 24v92" stroke-width="4"/><path d="M90 53h55M90 65h51M90 77h55M90 89h35" stroke="#9b7546" stroke-width="1.7"/>',
    standard:'<path d="M96 14v108" stroke-width="3"/><path d="M99 23q30-9 80 1v42q-44-18-80-1Z" fill="#496579" stroke-width="2"/><path d="M105 32q28-7 63 1M105 44q29-6 63 3M105 56q26-4 60 3" stroke="#d3b47f" stroke-width="2"/><path d="M24 119q45-30 78-9 30-24 92-6" stroke-width="2"/>',
    peaks:'<path d="M8 121 77 22l23 35 19-26 69 90Z" fill="#b6cbd0" stroke-width="2"/><path d="M37 121 77 22l31 49M90 121l29-90 49 90" stroke-width="2"/><path d="M17 109q35-21 66-8t91-9M61 83q37-15 83 6" stroke="#b89054" stroke-width="1.8"/><circle cx="169" cy="31" r="16" fill="#d8b781" stroke="none"/>',
    tower:'<path d="M65 108h110M80 108V64M159 108V64M73 87h96M69 67l56-17 51 17-14 7H83Z" fill="#e9d6b5" stroke-width="2"/><path d="M81 52l44-13 39 13-12 7H93Z" fill="#355873" stroke-width="2"/><path d="M100 107V84h34v23M77 52V43m91 12V43" stroke-width="2"/><path d="M8 111q28-17 49 0t46 0 53 0 53 0" stroke="#a0bac1" stroke-width="2.5"/>',
    fortress:'<path d="M31 110V73l29-17 28 7 25-17 43 18 21-8v54Z" fill="#b3bcc0" stroke-width="2"/><path d="M31 73 60 61 88 67l25-15 43 18 21-8M45 71v-17l11-6v14M119 51V35l12-4v25M150 67V47l10-4v26" stroke-width="2"/><path d="M41 89h12m21 0h10m31-10h12m23 8h12" stroke="#f3e9d8" stroke-width="3"/>',
    pines:'<path d="M56 115V41m0 2-33 19 31-1-38 19 38-3-37 24 39-7m0-50 37 21-37-4 41 23-41-5 35 28-35-9" stroke-width="2.5"/><path d="M145 115V62m0 0-27 19 27-5-25 20 25-7m0-27 31 19-31-5 25 20-25-7" stroke-width="2.2"/><circle cx="163" cy="35" r="21" fill="#dbbd88" stroke="none"/>',
    wine:'<circle cx="164" cy="34" r="27" fill="#e7cda1" stroke="none"/><path d="M69 60h63l-8 26q-23 14-47 0Z" fill="#d1b98e" stroke-width="2.5"/><path d="M101 92v15m-23 0h46M70 52q30-11 61 0M38 112q14-39 36-33m72 32q13-43 36-30" stroke-width="2.5"/>',
    terrace:'<path d="M50 114h142M79 114V71M168 114V71M69 71l58-24 58 24-13 8H81Z" fill="#d6cab4" stroke-width="2"/><path d="M91 50l36-18 37 18-12 9H103Z" fill="#49677e" stroke-width="2"/><path d="M94 94h56m-25-16v36m-67 0V92m121 22V92" stroke-width="2"/><path d="M9 53q11-10 23 0m3-15q12-10 24 1" stroke="#b89054" stroke-width="2"/>',
    cliffs:'<path d="M0 114 46 43l28 20 28-37 32 34 16-17 47 71Z" fill="#b6bdbe" stroke-width="2"/><path d="M46 43 66 77 91 61M102 26l11 40M150 43l-13 31" stroke-width="2.5"/><path d="M0 112q25-14 50 0t51 0 50 0 50 0M0 125q28-14 54 0t53 0 53 0 51 0" stroke="#426c82" stroke-width="3"/>',
    leaves:'<path d="M87 6q13 53 16 118M87 53Q58 35 23 29M93 75q24-27 70-28M100 95Q63 85 43 100" stroke-width="2.5"/><path d="M35 28q15-13 29-4-9 17-29 4M134 41q14-18 36-10-7 19-36 10M46 97q21-12 31 0-13 15-31 0M120 82q20-13 37 0-14 13-37 0" fill="#be8a6e" stroke-width="1"/>',
    lanterns:'<path d="M45 15v23m68-28v18m56-11v25" stroke-width="2"/><path d="M25 42q20-17 40 0v39q-20 16-40 0ZM92 30q21-14 42 0v48q-21 16-42 0Zm59 15q19-14 38 0v35q-19 14-38 0Z" fill="#dfbc85" stroke-width="2"/><path d="M27 54h36M94 44h38M151 56h37M44 86v20m69-22v25m57-22v19" stroke-width="2"/>'
  };
  return `<svg class="bookplate-illustration" viewBox="0 0 220 132" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
    <path d="M0 110Q42 79 73 100T148 94T220 103V132H0Z" fill="#b9cbd0" opacity=".35"/>
    <path d="M0 119Q39 99 70 118T149 113T220 111V132H0Z" fill="#c7a77c" opacity=".18"/>
    <circle cx="193" cy="30" r="21" fill="#dcbf94" opacity=".26"/>
    <path d="M10 36q18-10 34 0M166 101q19-10 42-4" fill="none" stroke="#b89054" stroke-width="1.3" opacity=".48"/>
    <g stroke="#193f59" stroke-linecap="round" stroke-linejoin="round" fill="none">${scenes[motif] || scenes.peaks}</g>
    <path d="M5 123q48-8 86 0t68 0 58-2" stroke="#b89054" stroke-width="1.3" fill="none" opacity=".55"/>
  </svg>`;
}

  function renderBookcaseCards(units) {
  const allCards=units.map((u,i)=>{
    const isAvailable=u.status==="available";
    const p=BOOKPLATES[u.id]||["指定篇章","文言經典","peaks","blue"];
    const tag=isAvailable?"a":"div";
    const link=isAvailable?`href="#/unit/${encodeURIComponent(u.id)}"`:"";
    const badge=isAvailable?'<span class="badge badge-available">可學習</span>':'<span class="badge badge-soon">準備中</span>';
    return `<${tag} class="card map-card bookplate-card card-tappable ${isAvailable?"":"is-disabled"}" data-bookplate-tone="${p[3]}" ${link}>
      <span class="bookplate-spine" aria-hidden="true"></span>
      <span class="bookplate-corner corner-tl" aria-hidden="true">❧</span>
      <span class="bookplate-corner corner-br" aria-hidden="true">❧</span>
      <div class="map-card-top"><div class="map-card-meta">
        <span class="map-sequence">${String(i+1).padStart(2,"0")}</span>
        <span class="bookplate-era">${escapeHTML(p[0])}</span>
      </div>${badge}</div>
      <div class="bookplate-copy">
        <p class="map-title">${escapeHTML(u.title)}</p>
        <p class="map-author">${escapeHTML(u.author)}</p>
        <p class="bookplate-caption">${escapeHTML(p[1])}</p>
      </div>
      <div class="bookplate-art">${bookplateArt(p[2])}</div>
      <div class="bookplate-footer">
        <span>${isAvailable?"打開篇章":"準備中"}</span>
        <span class="map-arrow" aria-hidden="true">↗</span>
      </div>
    </${tag}>`;
  });
  const shelves=[];
  for(let i=0;i<allCards.length;i+=4)shelves.push(
    `<div class="bookcase-row" role="group" aria-label="第${Math.floor(i/4)+1}層藏書">${allCards.slice(i,i+4).join("")}<div class="bookcase-plank" aria-hidden="true"></div></div>`
  );
  return shelves.join("");
}

  // ---------- 路由頁面 ----------
  async function pageHome() {
    const navigationId = Router.currentNavigationId();
    setCrumb("");
    const cancelLoading = scheduleLoading("課程地圖", navigationId);
    let curriculum;
    try {
      curriculum = await loadCurriculum();
      if (!Router.isCurrentNavigation(navigationId)) return;
    } catch (e) {
      if (!Router.isCurrentNavigation(navigationId)) return;
      renderFatalError(e.message);
      return;
    } finally {
      cancelLoading();
    }

    const recent = Progress.latestLearning(curriculum.units);
    const recentUnit = recent ? curriculum.units.find((u) => u.id === recent.unitId) : null;
    const firstAvailable = curriculum.units.find((u) => u.status === "available");
    const primaryCard = recent && recentUnit ? `
      <article class="home-action-card home-action-primary">
        <p class="home-action-eyebrow">繼續上次學習</p>
        <h2 class="home-action-title">《${escapeHTML(recentUnit.title)}》</h2>
        <p class="home-action-meta">${escapeHTML(learningPathLabel(recent.path))}</p>
        <a class="btn home-action-button" href="#${escapeHTML(recent.path)}">繼續學習 <span aria-hidden="true">→</span></a>
      </article>` : firstAvailable ? `
      <article class="home-action-card home-action-primary">
        <p class="home-action-eyebrow">開始學習</p>
        <h2 class="home-action-title">《${escapeHTML(firstAvailable.title)}》</h2>
        <p class="home-action-meta">${escapeHTML(firstAvailable.author || "")}</p>
        <a class="btn home-action-button" href="#/unit/${firstAvailable.id}">進入篇章 <span aria-hidden="true">→</span></a>
      </article>` : "";
    const overviewCard = `
      <article class="home-action-card home-action-secondary">
        <div class="home-action-symbol" aria-hidden="true">總</div>
        <div>
          <p class="home-action-eyebrow">學習紀錄</p>
          <h2 class="home-action-title">跨篇章學習總覽</h2>
          <a class="home-text-link" href="#/overview">查看總覽 <span aria-hidden="true">→</span></a>
        </div>
      </article>`;

    const cards = renderBookcaseCards(curriculum.units);

    mount(`
      <header class="home-simple-head">
        <div>
          <p class="section-kicker">DSE 中文 · 指定文言篇章</p>
          <h1 id="home-title" class="page-title">篇章目錄</h1>
        </div>
        <span class="home-count-pill">${curriculum.units.length} 篇</span>
      </header>
      <section class="home-action-grid" aria-label="學習捷徑">
        ${primaryCard}
        ${overviewCard}
      </section>
      <section class="home-curriculum" aria-labelledby="curriculum-title">
        <div class="home-section-heading bookcase-heading">
          <div><p class="section-kicker">經典藏書閣 · 十六篇</p><h2 id="curriculum-title">打開一篇經典</h2></div>
          <span class="bookcase-heading-stamp" aria-hidden="true">文脈藏書</span>
        </div>
        <div class="map-grid bookcase-shelves">${cards}</div>
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
    const cancelLoading = scheduleLoading("跨篇章學習總覽", navigationId);
    try {
      const [{ curriculum, unitBundles }] = await Promise.all([
        loadCrossUnitBundles(),
        loadUIModules(["contentProgress", "progressAnalytics"])
      ]);
      if (!Router.isCurrentNavigation(navigationId)) return;
      ContentRenderer.renderCrossUnitOverview(curriculum, unitBundles);
    } catch (e) {
      if (!Router.isCurrentNavigation(navigationId)) return;
      renderFatalError(e.message);
    } finally {
      cancelLoading();
    }
  }

  async function pageCrossUnitRetry(params) {
    const navigationId = Router.currentNavigationId();
    const ability = params.ability === "all" ? null : params.ability;
    setCrumb(ability ? `${ability} · 跨篇章重練` : "跨篇章錯題重練");
    const cancelLoading = scheduleLoading("跨篇章錯題重練", navigationId);
    try {
      const [{ unitBundles }] = await Promise.all([
        loadCrossUnitBundles(),
        loadUIModules(["questions", "progressAnalytics"])
      ]);
      if (!Router.isCurrentNavigation(navigationId)) return;
      QuestionEngine.renderCrossUnitWrongRetry(unitBundles, ability);
    } catch (e) {
      if (!Router.isCurrentNavigation(navigationId)) return;
      renderFatalError(e.message);
    } finally {
      cancelLoading();
    }
  }

  async function withUnitBundle(unitId, options, onReady) {
    const navigationId = Router.currentNavigationId();
    if (typeof options === "function") {
      onReady = options;
      options = {};
    }
    const uiModules = [...new Set(options.uiModules || [])];
    const cancelLoading = scheduleLoading("篇章資料", navigationId);
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
    } finally {
      cancelLoading();
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
    await withUnitBundle(params.unitId, { resources: ["text"], uiModules: ["contentReader"] }, (bundle) => {
      ContentRenderer.renderTextPage(bundle, params.unitId);
    });
  }

  async function pageWords(params) {
    await withUnitBundle(params.unitId, { resources: ["text"], uiModules: ["contentStudy"] }, (bundle) => {
      ContentRenderer.renderWordsPage(bundle, params.unitId);
    });
  }

  async function pageAnalysis(params) {
    await withUnitBundle(params.unitId, { resources: ["structure"], uiModules: ["contentStudy"] }, (bundle) => {
      ContentRenderer.renderAnalysisPage(bundle, params.unitId);
    });
  }

  async function pageTheme(params) {
    await withUnitBundle(params.unitId, { resources: ["appreciation"], uiModules: ["contentStudy"] }, (bundle) => {
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
    await withUnitBundle(params.unitId, { resources: ["memorisation", "rubrics"], allQuestionBanks: true, uiModules: ["contentProgress"] }, (bundle) => {
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
    // Preserve existing bookmarks without bringing back the duplicate lesson.
    Router.register("/unit/:unitId/comprehension", (p) => Router.navigate(`/unit/${p.unitId}/text`));
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
    bindKeyboardNavigation();
    registerRoutes();
    Router.start();
  }

  return {
    init, mount, setCrumb, renderLoading, renderFatalError, renderNotFound,
    escapeHTML, footerNav, moduleIconGlyph, fetchJSON
  };
})();

document.addEventListener("DOMContentLoaded", App.init);
