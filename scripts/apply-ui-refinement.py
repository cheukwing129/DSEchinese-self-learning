from pathlib import Path
import re

APP = Path('js/app.js')
RENDERER = Path('js/content-renderer.js')
CSS = Path('css/style.css')

app = APP.read_text(encoding='utf-8')
renderer = RENDERER.read_text(encoding='utf-8')
css = CSS.read_text(encoding='utf-8')

home = r'''  async function pageHome() {
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
      .map((u) => {
        const isAvailable = u.status === "available";
        const badge = isAvailable
          ? `<span class="badge badge-available">可學習</span>`
          : `<span class="badge badge-soon">準備中</span>`;
        const tag = isAvailable ? "a" : "div";
        const href = isAvailable ? `href="#/unit/${u.id}"` : "";
        return `
          <${tag} class="card map-card card-tappable ${isAvailable ? "" : "is-disabled"}" ${href}>
            <div class="map-card-top">
              ${u.group ? `<p class="map-group">${escapeHTML(u.group)}</p>` : `<span></span>`}
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
        <p class="home-kicker">DSE 中文 · 指定文言經典</p>
        <h1 id="home-title" class="home-title">讀懂經典，<span>一步一步變成自己的能力。</span></h1>
        <p class="home-lead">從原文、字詞與文意出發，再進入賞析、背誦、作答與錯題修復。每次只做眼前最值得做的一步。</p>
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

  async function loadCrossUnitBundles'''

app2, n = re.subn(r'  async function pageHome\(\) \{.*?\n  \}\n\n  async function loadCrossUnitBundles', home, app, count=1, flags=re.S)
if n != 1:
    raise SystemExit(f'pageHome replacement failed: {n}')
APP.write_text(app2, encoding='utf-8')

unit_home = r'''  function renderUnitHome(bundle, unitId) {
    const u = bundle.unit;
    const background = bundle.background || {};
    const nextStep = Progress.recommendNextStep(unitId);
    const backgroundCards = [
      backgroundCardHTML(background.author_intro, "作者簡介"),
      backgroundCardHTML(background.writing_background, "寫作背景")
    ].filter(Boolean).join("");
    const moduleDescs = {
      text: "全文分段、點字看注釋、朗讀提示",
      words: "實詞／虛詞／通假／古今義",
      comprehension: "白話理解、段意、內容理解練習",
      analysis: "結構圖、景情配對、手法賞析",
      theme: "主旨解說、生活反思、開放題",
      memorisation: "句群背誦、遮字、重組",
      challenge: "整合各分類抽題，標示需補強範疇與補救",
      progress: "能力分項、錯題、背誦重溫、反思"
    };
    const coreIds = new Set(["text", "words", "comprehension", "analysis", "theme"]);
    const moduleCard = (m, index) => `
      <a class="module-card card-tappable" href="${moduleHref(unitId, m.id)}">
        <span class="module-order">${String(index + 1).padStart(2, "0")}</span>
        <div class="module-icon" aria-hidden="true">${App.moduleIconGlyph(m.icon)}</div>
        <div class="module-copy">
          <p class="module-name">${esc(m.title)}</p>
          <p class="module-desc">${esc(moduleDescs[m.id] || "")}</p>
        </div>
        <span class="module-arrow" aria-hidden="true">→</span>
      </a>`;
    const coreModules = u.modules.filter((m) => coreIds.has(m.id));
    const practiceModules = u.modules.filter((m) => !coreIds.has(m.id));
    const coreCards = coreModules.map((m, index) => moduleCard(m, index)).join("");
    const practiceCards = practiceModules.map((m, index) => moduleCard(m, coreModules.length + index)).join("");

    App.mount(`
      <header class="unit-hero">
        <p class="unit-kicker">${esc(u.dynasty)} · ${esc(u.genre)}</p>
        <h1 class="unit-title">《${esc(u.title)}》</h1>
        <p class="unit-author">${esc(u.author)}</p>
      </header>

      <section class="next-step-panel" aria-labelledby="next-step-title">
        <div class="next-step-copy">
          <p class="section-kicker">建議下一步</p>
          <h2 id="next-step-title">${esc(nextStep.label)}</h2>
          <p class="next-step-reason">${esc(nextStep.reason)}</p>
          <p class="next-step-note">建議只根據這部裝置的作答、背誦、自評與反思紀錄，不等同系統判定你已掌握前一階段。</p>
        </div>
        <a class="btn btn-primary next-step-button" href="#${esc(nextStep.path)}">${esc(nextStep.label)} <span aria-hidden="true">→</span></a>
      </section>

      <section class="unit-section" aria-labelledby="core-learning-title">
        <div class="unit-section-heading">
          <div>
            <p class="section-kicker">核心學習</p>
            <h2 id="core-learning-title">先讀懂，再看深一層</h2>
          </div>
          <p>原文、字詞、文意、結構與主旨依次展開；不必一次完成所有模組。</p>
        </div>
        <div class="module-grid module-grid-core">${coreCards}</div>
      </section>

      ${practiceCards ? `
        <section class="unit-section" aria-labelledby="practice-title">
          <div class="unit-section-heading compact">
            <div>
              <p class="section-kicker">鞏固與挑戰</p>
              <h2 id="practice-title">把理解變成可用的能力</h2>
            </div>
          </div>
          <div class="module-grid module-grid-practice">${practiceCards}</div>
        </section>
      ` : ""}

      ${backgroundCards ? `
        <section class="unit-section unit-background-section" aria-labelledby="background-title">
          <div class="unit-section-heading compact">
            <div>
              <p class="section-kicker">延伸閱讀</p>
              <h2 id="background-title">作者與背景</h2>
            </div>
          </div>
          <div class="background-grid">${backgroundCards}</div>
        </section>
      ` : ""}

      <section class="cross-text-panel" aria-labelledby="cross-text-title">
        <div>
          <p class="section-kicker">選做 · 進階</p>
          <h2 id="cross-text-title">跨篇比較與進階題</h2>
          <p>如尚未學習相關篇章，可先略過；完成更多篇章後再回來比較會更有價值。</p>
        </div>
        <a class="home-text-link" href="#/unit/${unitId}/cross-text">前往跨篇比較 <span aria-hidden="true">→</span></a>
      </section>

      ${App.footerNav(null, null).replace('<div class="footer-nav">', '<div class="footer-nav unit-footer-nav">')}
    `);
  }

  function audioPlayerHTML'''

renderer2, n = re.subn(r'  function renderUnitHome\(bundle, unitId\) \{.*?\n  \}\n\n  function audioPlayerHTML', unit_home, renderer, count=1, flags=re.S)
if n != 1:
    raise SystemExit(f'renderUnitHome replacement failed: {n}')
RENDERER.write_text(renderer2, encoding='utf-8')

marker = '/* ===== UI refinement: editorial learning shell ===== */'
if marker not in css:
    css += r'''

/* ===== UI refinement: editorial learning shell ===== */
:root {
  --color-bg: #F3F0E8;
  --color-surface: #FFFDFC;
  --color-surface-raised: #FFFFFF;
  --color-ink: #1D2825;
  --color-ink-soft: #5C6662;
  --color-ink-faint: #8A918D;
  --color-accent: #315F58;
  --color-accent-soft: #E4EFEB;
  --color-jade: #315F58;
  --color-jade-soft: #E4EFEB;
  --color-border: #DDD9CF;
  --color-divider: #E7E3DA;
  --color-highlighter: #F4E6A8;
  --color-reader-orange: #A9563B;
  --shadow-card: 0 1px 2px rgba(29,40,37,0.035);
  --shadow-card-hover: 0 12px 28px rgba(29,40,37,0.08);
  --max-width: 1080px;
}

body { background: var(--color-bg); }
#app-header {
  background: rgba(250,248,243,0.9);
  border-bottom-color: rgba(117,112,101,0.18);
}
.header-inner { padding-top: 16px; padding-bottom: 16px; }
.brand { font-size: 19px; letter-spacing: .01em; }
.brand .brand-mark { color: var(--color-reader-orange); }
#app-main { padding-top: 42px; }

.section-kicker,
.home-kicker,
.unit-kicker,
.home-action-eyebrow {
  margin: 0;
  color: var(--color-reader-orange);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: .11em;
}

/* Home */
.home-hero {
  max-width: 880px;
  padding: 38px 0 46px;
  border-bottom: 1px solid var(--color-border);
}
.home-title {
  margin: 12px 0 20px;
  max-width: 820px;
  color: var(--color-ink);
  font-family: var(--font-display);
  font-size: clamp(38px, 5.2vw, 61px);
  font-weight: 500;
  line-height: 1.12;
  letter-spacing: -.025em;
}
.home-title span { color: var(--color-accent); }
.home-lead {
  max-width: 700px;
  margin: 0;
  color: var(--color-ink-soft);
  font-size: 17px;
  line-height: 1.85;
  letter-spacing: -.01em;
}
.home-action-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, .8fr);
  gap: 18px;
  margin: 34px 0 62px;
}
.home-action-card {
  position: relative;
  min-height: 244px;
  border-radius: 24px;
  padding: 30px;
  overflow: hidden;
}
.home-action-primary {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  background: var(--color-accent);
  color: #FDFCF8;
  border: 1px solid var(--color-accent);
}
.home-action-primary .home-action-eyebrow { color: #CFE0DA; }
.home-action-primary .home-action-meta { color: #DCE8E4; }
.home-action-primary .home-action-copy { color: rgba(255,255,255,.78); }
.home-action-secondary {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 18px;
  background: rgba(255,253,252,.82);
  border: 1px solid var(--color-border);
}
.home-action-symbol {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border: 1px solid #CFCCC3;
  border-radius: 50%;
  color: var(--color-accent);
  font-family: var(--font-display);
  font-size: 18px;
}
.home-action-title {
  margin: 8px 0 4px;
  font-family: var(--font-display);
  font-size: 28px;
  font-weight: 600;
  line-height: 1.2;
}
.home-action-meta { margin: 0 0 16px; font-size: 13px; }
.home-action-copy {
  max-width: 520px;
  margin: 12px 0 22px;
  color: var(--color-ink-soft);
  font-size: 14px;
  line-height: 1.75;
}
.home-action-button {
  margin-top: auto;
  background: #FDFCF8;
  color: var(--color-accent);
  border-radius: 999px;
  padding-inline: 20px;
}
.home-text-link {
  display: inline-flex;
  min-height: 44px;
  align-items: center;
  gap: 8px;
  color: var(--color-accent);
  font-size: 14px;
  font-weight: 800;
}
.home-text-link:hover { text-decoration: underline; text-underline-offset: 4px; }
.home-curriculum { margin-bottom: 36px; }
.home-section-heading,
.unit-section-heading {
  display: flex;
  justify-content: space-between;
  align-items: end;
  gap: 32px;
  margin-bottom: 22px;
}
.home-section-heading h2,
.unit-section-heading h2,
.cross-text-panel h2,
.next-step-panel h2 {
  margin: 5px 0 0;
  font-family: var(--font-display);
  font-size: 28px;
  font-weight: 600;
  line-height: 1.25;
}
.home-section-heading > p,
.unit-section-heading > p {
  max-width: 390px;
  margin: 0;
  color: var(--color-ink-soft);
  font-size: 13px;
  line-height: 1.65;
}

.map-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}
.map-card {
  min-height: 172px;
  margin: 0;
  padding: 22px;
  background: rgba(255,253,252,.8);
  border-color: var(--color-border);
  box-shadow: none;
}
.map-card.card-tappable:hover {
  transform: translateY(-2px);
  border-color: #B9C9C4;
  box-shadow: var(--shadow-card-hover);
}
.map-card-top {
  display: flex;
  min-height: 24px;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  margin-bottom: 20px;
}
.map-card .map-group {
  margin: 0;
  color: var(--color-reader-orange);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .08em;
}
.map-card .badge {
  position: static;
  flex: none;
  padding: 3px 8px;
  font-size: 10px;
}
.map-card .map-title {
  margin-bottom: 6px;
  font-size: 22px;
  font-weight: 600;
  line-height: 1.25;
}
.map-card .map-author { font-size: 13px; }
.map-arrow {
  position: absolute;
  right: 22px;
  bottom: 20px;
  color: var(--color-accent);
  font-size: 19px;
  transition: transform .16s ease;
}
.map-card:hover .map-arrow { transform: translateX(3px); }

/* Unit home */
.unit-hero {
  padding: 34px 0 42px;
  border-bottom: 1px solid var(--color-border);
}
.unit-title {
  margin: 8px 0 8px;
  font-family: var(--font-display);
  font-size: clamp(40px, 6vw, 64px);
  font-weight: 500;
  line-height: 1.08;
  letter-spacing: -.02em;
}
.unit-author {
  margin: 0;
  color: var(--color-ink-soft);
  font-size: 16px;
}
.next-step-panel {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 32px;
  align-items: center;
  margin: 32px 0 58px;
  padding: 28px 30px;
  background: var(--color-accent-soft);
  border: 1px solid #CADBD5;
  border-radius: 22px;
}
.next-step-panel h2 { color: var(--color-accent); }
.next-step-reason {
  max-width: 720px;
  margin: 9px 0 5px;
  color: var(--color-ink);
  line-height: 1.7;
}
.next-step-note {
  max-width: 760px;
  margin: 0;
  color: var(--color-ink-faint);
  font-size: 11px;
  line-height: 1.6;
}
.next-step-button { white-space: nowrap; border-radius: 999px; }
.unit-section { margin: 0 0 56px; }
.unit-section-heading.compact { margin-bottom: 18px; }
.module-grid-core { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.module-grid-practice { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.module-card {
  position: relative;
  min-height: 126px;
  margin: 0;
  padding: 20px 48px 20px 18px;
  align-items: center;
  gap: 13px;
  background: rgba(255,253,252,.78);
  border: 1px solid var(--color-border);
  border-radius: 18px;
  box-shadow: none;
}
.module-card.card-tappable:hover {
  transform: translateY(-1px);
  border-color: #B9C9C4;
  box-shadow: 0 10px 24px rgba(29,40,37,.055);
}
.module-order {
  position: absolute;
  top: 13px;
  right: 15px;
  color: #A3A69F;
  font-family: var(--font-data);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: .08em;
}
.module-icon {
  width: 38px;
  height: 38px;
  background: transparent;
  color: var(--color-accent);
  border: 1px solid #C8D6D1;
  border-radius: 50%;
  font-family: var(--font-display);
  font-size: 15px;
}
.module-copy { min-width: 0; }
.module-name {
  margin-bottom: 5px;
  color: var(--color-ink);
  font-family: var(--font-display);
  font-size: 19px;
  font-weight: 600;
}
.module-desc { font-size: 12px; line-height: 1.55; }
.module-arrow {
  position: absolute;
  right: 18px;
  bottom: 18px;
  color: var(--color-accent);
  transition: transform .16s ease;
}
.module-card:hover .module-arrow { transform: translateX(3px); }
.background-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.background-grid .card {
  margin: 0;
  background: rgba(255,253,252,.62);
  box-shadow: none;
}
.background-grid summary { color: var(--color-accent); }
.unit-background-section { margin-bottom: 42px; }
.cross-text-panel {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 30px;
  padding: 24px 0;
  border-top: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
}
.cross-text-panel h2 { font-size: 23px; }
.cross-text-panel p:not(.section-kicker) {
  margin: 7px 0 0;
  color: var(--color-ink-soft);
  font-size: 13px;
}
.unit-footer-nav { margin-top: 34px; }

@media (max-width: 820px) {
  #app-main { padding-top: 24px; }
  .home-hero { padding-top: 18px; }
  .home-action-grid { grid-template-columns: 1fr; margin-bottom: 48px; }
  .home-action-card { min-height: 0; }
  .map-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .home-section-heading,
  .unit-section-heading { align-items: flex-start; flex-direction: column; gap: 9px; }
  .next-step-panel { grid-template-columns: 1fr; gap: 20px; }
  .next-step-button { justify-self: start; }
  .module-grid-practice { grid-template-columns: 1fr; }
}

@media (max-width: 560px) {
  .header-inner { padding: 12px 16px; }
  #app-main { padding-left: 16px; padding-right: 16px; }
  .home-title { font-size: 38px; }
  .home-lead { font-size: 15px; }
  .home-action-card { padding: 23px; border-radius: 20px; }
  .home-action-secondary { grid-template-columns: 1fr; }
  .home-action-symbol { width: 36px; height: 36px; }
  .map-grid,
  .module-grid-core,
  .background-grid { grid-template-columns: 1fr; }
  .map-card { min-height: 150px; }
  .unit-title { font-size: 42px; }
  .next-step-panel { margin-bottom: 44px; padding: 22px; border-radius: 18px; }
  .unit-section { margin-bottom: 44px; }
  .module-card { min-height: 112px; }
  .cross-text-panel { align-items: flex-start; flex-direction: column; gap: 10px; }
}

@media (prefers-reduced-motion: reduce) {
  .map-arrow,
  .module-arrow { transition: none; }
}
'''
    CSS.write_text(css, encoding='utf-8')

print('UI refinement patch applied.')
