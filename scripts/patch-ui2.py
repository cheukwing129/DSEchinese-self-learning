from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    if old not in text:
        raise SystemExit(f"Expected block not found in {path}")
    if text.count(old) != 1:
        raise SystemExit(f"Expected exactly one block in {path}, found {text.count(old)}")
    p.write_text(text.replace(old, new, 1), encoding="utf-8")


# Modern floating application header.
replace_once(
    "index.html",
    '''  <header id="app-header">\n    <div class="header-inner">\n      <a class="brand" id="brand-home-link" href="#/" aria-label="返回中文經典自學首頁">\n        <span class="brand-mark" aria-hidden="true">卷</span>中文經典自學\n      </a>\n      <div class="header-crumb" id="header-crumb" aria-live="polite"></div>\n    </div>\n  </header>''',
    '''  <header id="app-header">\n    <div class="header-inner">\n      <a class="brand" id="brand-home-link" href="#/" aria-label="返回中文經典自學首頁">\n        <span class="brand-mark" aria-hidden="true">卷</span>\n        <span class="brand-copy">中文經典自學</span>\n      </a>\n      <nav class="header-nav" aria-label="主要導覽">\n        <a class="header-nav-link" href="#/">篇章</a>\n        <a class="header-nav-link" href="#/overview">學習總覽</a>\n      </nav>\n      <div class="header-crumb" id="header-crumb" aria-live="polite"></div>\n    </div>\n  </header>'''
)

# Add sequence metadata to curriculum cards.
replace_once(
    "js/app.js",
    '''    const cards = curriculum.units\n      .map((u) => {''',
    '''    const cards = curriculum.units\n      .map((u, unitIndex) => {'''
)
replace_once(
    "js/app.js",
    '''            <div class="map-card-top">\n              ${u.group ? `<p class="map-group">${escapeHTML(u.group)}</p>` : `<span></span>`}\n              ${badge}\n            </div>''',
    '''            <div class="map-card-top">\n              <div class="map-card-meta">\n                <span class="map-sequence">${String(unitIndex + 1).padStart(2, "0")}</span>\n                ${u.group ? `<p class="map-group">${escapeHTML(u.group)}</p>` : ""}\n              </div>\n              ${badge}\n            </div>'''
)

# Turn the home hero into a modern editorial split hero with a non-evaluative learning-path visual.
replace_once(
    "js/app.js",
    '''      <section class="home-hero" aria-labelledby="home-title">\n        <p class="home-kicker">DSE 中文 · 指定文言經典</p>\n        <h1 id="home-title" class="page-title home-title">讀懂經典，<span>一步一步變成自己的能力。</span></h1>\n        <p class="home-lead">從原文、字詞與文意出發，再進入賞析、背誦、作答與錯題修復。每次只做眼前最值得做的一步。</p>\n      </section>''',
    '''      <section class="home-hero" aria-labelledby="home-title">\n        <div class="home-hero-copy">\n          <div class="home-kicker-row">\n            <p class="home-kicker">DSE 中文 · 指定文言經典</p>\n            <span class="home-edition-pill">SELF · STUDY</span>\n          </div>\n          <h1 id="home-title" class="page-title home-title">讀懂經典，<span>把每一步都變成自己的能力。</span></h1>\n          <p class="home-lead">從原文、字詞與文意出發，再進入賞析、背誦、作答與錯題修復。介面替你整理路徑，判斷仍然交給真實學習紀錄。</p>\n          <div class="home-hero-chips" aria-label="學習內容">\n            <span>原文</span><span>字詞</span><span>賞析</span><span>背誦</span><span>作答</span>\n          </div>\n        </div>\n        <aside class="home-hero-visual" aria-label="自學路徑示意；不代表完成度或掌握程度">\n          <div class="hero-visual-head">\n            <div>\n              <span class="hero-visual-label">LEARNING FLOW</span>\n              <strong>一條清楚的自學路徑</strong>\n            </div>\n            <span class="hero-unit-count">${curriculum.units.length} 篇</span>\n          </div>\n          <div class="hero-path-grid">\n            <div class="hero-path-step"><span>01</span><strong>讀</strong><small>原文與語境</small></div>\n            <div class="hero-path-step"><span>02</span><strong>解</strong><small>字詞與文意</small></div>\n            <div class="hero-path-step"><span>03</span><strong>析</strong><small>結構與主旨</small></div>\n            <div class="hero-path-step"><span>04</span><strong>練</strong><small>作答與修正</small></div>\n          </div>\n          <p class="hero-visual-note">路徑只協助導航，不以瀏覽頁面推斷掌握程度。</p>\n        </aside>\n      </section>'''
)

# Add module-specific classes so the core learning modules can form a real Bento layout.
replace_once(
    "js/content-renderer.js",
    '''      <a class="module-card card-tappable" href="${moduleHref(unitId, m.id)}">''',
    '''      <a class="module-card module-card-${m.id} ${m.id === "text" ? "module-card-featured" : ""} card-tappable" href="${moduleHref(unitId, m.id)}">'''
)

# Give each text a distinctive but restrained monogram artwork rather than another plain heading block.
replace_once(
    "js/content-renderer.js",
    '''      <header class="unit-hero">\n        <p class="unit-kicker">${esc(u.dynasty)} · ${esc(u.genre)}</p>\n        <h1 class="page-title unit-title">《${esc(u.title)}》</h1>\n        <p class="unit-author">${esc(u.author)}</p>\n      </header>''',
    '''      <header class="unit-hero">\n        <div class="unit-hero-copy">\n          <div class="unit-meta-row">\n            <p class="unit-kicker">${esc(u.dynasty)} · ${esc(u.genre)}</p>\n            <span class="unit-mode-pill">篇章學習</span>\n          </div>\n          <h1 class="page-title unit-title">《${esc(u.title)}》</h1>\n          <p class="unit-author">${esc(u.author)}</p>\n          <div class="unit-flow-mini" aria-label="建議學習方向">\n            <span>讀原文</span><i aria-hidden="true">→</i><span>疏文意</span><i aria-hidden="true">→</i><span>看賞析</span><i aria-hidden="true">→</i><span>做練習</span>\n          </div>\n        </div>\n        <div class="unit-hero-art" aria-hidden="true">\n          <span class="unit-art-orbit orbit-one"></span>\n          <span class="unit-art-orbit orbit-two"></span>\n          <div class="unit-monogram">${esc((u.title || "篇").slice(0, 1))}</div>\n          <span class="unit-art-caption">讀 · 解 · 析 · 練</span>\n        </div>\n      </header>'''
)

css_path = Path("css/style.css")
css = css_path.read_text(encoding="utf-8")
marker = "/* ===== UI refinement: editorial learning shell ===== */"
if marker not in css:
    raise SystemExit("UI refinement marker not found in css/style.css")
base = css.split(marker, 1)[0].rstrip()
ui2 = r'''

/* ===== UI 2.0: modern editorial learning product ===== */
:root {
  --color-bg: #F4F3EF;
  --color-surface: #FCFCFA;
  --color-surface-raised: #FFFFFF;
  --color-ink: #17221F;
  --color-ink-soft: #596561;
  --color-ink-faint: #8A938F;
  --color-accent: #174940;
  --color-accent-strong: #0D3832;
  --color-accent-soft: #E2EFEA;
  --color-jade: #24705F;
  --color-jade-soft: #E3F1EC;
  --color-reader-orange: #B75F47;
  --color-coral-soft: #F4E5DF;
  --color-gold: #B88A4A;
  --color-border: rgba(45, 68, 62, .13);
  --color-divider: rgba(45, 68, 62, .10);
  --color-highlighter: #F2E4A9;
  --shadow-card: 0 8px 24px rgba(32, 50, 45, .045), 0 1px 2px rgba(32, 50, 45, .05);
  --shadow-card-hover: 0 18px 42px rgba(32, 50, 45, .10), 0 2px 8px rgba(32, 50, 45, .05);
  --radius-lg: 20px;
  --radius-md: 14px;
  --max-width: 1120px;
}

html { scroll-behavior: smooth; }
body {
  min-height: 100vh;
  background:
    radial-gradient(58rem 34rem at -4% -8%, rgba(112, 172, 152, .17), transparent 62%),
    radial-gradient(46rem 30rem at 104% 7%, rgba(196, 108, 77, .11), transparent 62%),
    linear-gradient(180deg, #F8F7F3 0%, var(--color-bg) 42%, #F3F1EC 100%);
  background-attachment: fixed;
}
::selection { background: rgba(183, 95, 71, .19); }
a, button { -webkit-tap-highlight-color: transparent; }
a:focus-visible, button:focus-visible, summary:focus-visible {
  outline: 3px solid rgba(183, 95, 71, .34);
  outline-offset: 3px;
}

/* Floating glass navigation */
#app-header {
  top: 0;
  padding: 12px 14px 0;
  background: transparent;
  border-bottom: 0;
  backdrop-filter: none;
  pointer-events: none;
}
.header-inner {
  min-height: 60px;
  padding: 10px 12px;
  border: 1px solid rgba(59, 77, 71, .12);
  border-radius: 19px;
  background: rgba(252, 252, 250, .78);
  box-shadow: 0 12px 34px rgba(31, 47, 42, .07), inset 0 1px 0 rgba(255,255,255,.72);
  backdrop-filter: blur(22px) saturate(145%);
  -webkit-backdrop-filter: blur(22px) saturate(145%);
  pointer-events: auto;
}
.brand {
  flex: 0 0 auto;
  align-items: center;
  gap: 9px;
  font-family: var(--font-body);
  font-size: 15px;
  font-weight: 800;
  letter-spacing: -.01em;
}
.brand .brand-mark {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 11px;
  background: linear-gradient(145deg, #1D5A50, var(--color-accent-strong));
  color: #FFFDF8;
  box-shadow: 0 7px 15px rgba(13, 56, 50, .19), inset 0 1px 0 rgba(255,255,255,.18);
  font-family: var(--font-display);
  font-size: 15px;
}
.header-nav {
  display: flex;
  align-items: center;
  gap: 3px;
  margin-left: 10px;
  padding: 3px;
  border-radius: 12px;
  background: rgba(23,73,64,.045);
}
.header-nav-link {
  min-height: 34px;
  display: inline-flex;
  align-items: center;
  padding: 7px 12px;
  border-radius: 9px;
  color: var(--color-ink-soft);
  font-size: 12px;
  font-weight: 750;
  transition: background .16s ease, color .16s ease, transform .16s ease;
}
.header-nav-link:hover {
  background: rgba(255,255,255,.78);
  color: var(--color-accent);
  transform: translateY(-1px);
}
.header-crumb {
  margin-left: auto;
  max-width: 30%;
  padding: 0 8px;
  color: var(--color-ink-faint);
  font-size: 12px;
}
#app-main { padding-top: 34px; }

/* Global surfaces: cleaner depth, not a forest of borders */
.card {
  border-color: var(--color-border);
  background: rgba(252,252,250,.87);
  box-shadow: var(--shadow-card);
}
.card-tappable {
  transition: transform .18s cubic-bezier(.2,.8,.2,1), box-shadow .18s ease, border-color .18s ease, background .18s ease;
}
.card-tappable:hover {
  transform: translateY(-3px);
  border-color: rgba(23,73,64,.22);
  box-shadow: var(--shadow-card-hover);
}
.btn {
  min-height: 42px;
  border-radius: 13px;
  padding: 10px 18px;
  transition: transform .14s cubic-bezier(.2,.8,.2,1), box-shadow .16s ease, background .16s ease, color .16s ease, opacity .16s ease;
}
.btn-primary {
  background: linear-gradient(145deg, #1D5A50, var(--color-accent-strong));
  box-shadow: 0 9px 19px rgba(13,56,50,.15), inset 0 1px 0 rgba(255,255,255,.14);
}
.btn-primary:hover { opacity: 1; transform: translateY(-1px); box-shadow: 0 13px 24px rgba(13,56,50,.20); }
.btn-secondary { border-color: rgba(23,34,31,.28); }

.section-kicker,
.home-kicker,
.unit-kicker,
.home-action-eyebrow {
  margin: 0;
  color: var(--color-reader-orange);
  font-size: 11px;
  font-weight: 850;
  letter-spacing: .13em;
  text-transform: uppercase;
}

/* Home: split editorial hero */
.home-hero {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1.12fr) minmax(310px, .88fr);
  align-items: center;
  gap: clamp(34px, 6vw, 74px);
  max-width: none;
  padding: 56px 0 62px;
  border-bottom: 0;
}
.home-hero::before {
  content: "";
  position: absolute;
  z-index: -1;
  left: -90px;
  top: 10px;
  width: 310px;
  height: 310px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(111,171,151,.12), rgba(111,171,151,0) 68%);
  filter: blur(2px);
  pointer-events: none;
}
.home-kicker-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.home-edition-pill,
.unit-mode-pill {
  display: inline-flex;
  align-items: center;
  min-height: 26px;
  padding: 5px 9px;
  border: 1px solid rgba(23,73,64,.12);
  border-radius: 999px;
  background: rgba(255,255,255,.55);
  color: var(--color-accent);
  font-family: var(--font-data);
  font-size: 9px;
  font-weight: 850;
  letter-spacing: .13em;
}
.home-title {
  max-width: 700px;
  margin: 16px 0 22px;
  font-size: clamp(46px, 5.4vw, 74px);
  font-weight: 540;
  line-height: 1.035;
  letter-spacing: -.045em;
}
.home-title span {
  display: block;
  margin-top: 7px;
  color: var(--color-accent);
}
.home-lead {
  max-width: 650px;
  margin: 0;
  color: var(--color-ink-soft);
  font-size: 16px;
  line-height: 1.85;
}
.home-hero-chips {
  display: flex;
  gap: 7px;
  flex-wrap: wrap;
  margin-top: 25px;
}
.home-hero-chips span {
  padding: 7px 11px;
  border: 1px solid rgba(23,73,64,.10);
  border-radius: 999px;
  background: rgba(255,255,255,.49);
  color: #52605C;
  font-size: 11px;
  font-weight: 700;
}
.home-hero-visual {
  position: relative;
  overflow: hidden;
  min-height: 356px;
  padding: 24px;
  border: 1px solid rgba(23,73,64,.12);
  border-radius: 30px;
  background:
    radial-gradient(circle at 90% 2%, rgba(183,95,71,.15), transparent 35%),
    linear-gradient(145deg, rgba(255,255,255,.91), rgba(231,240,236,.76));
  box-shadow: 0 28px 70px rgba(37,55,49,.10), inset 0 1px 0 rgba(255,255,255,.72);
}
.home-hero-visual::after {
  content: "";
  position: absolute;
  right: -55px;
  bottom: -72px;
  width: 190px;
  height: 190px;
  border: 1px solid rgba(23,73,64,.10);
  border-radius: 50%;
  box-shadow: 0 0 0 34px rgba(23,73,64,.025), 0 0 0 68px rgba(23,73,64,.018);
  pointer-events: none;
}
.hero-visual-head {
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 22px;
}
.hero-visual-head > div { display: grid; gap: 5px; }
.hero-visual-label {
  color: var(--color-reader-orange);
  font-family: var(--font-data);
  font-size: 9px;
  font-weight: 850;
  letter-spacing: .15em;
}
.hero-visual-head strong {
  font-family: var(--font-display);
  font-size: 19px;
  font-weight: 650;
}
.hero-unit-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 54px;
  height: 30px;
  border-radius: 999px;
  background: var(--color-accent);
  color: #fff;
  font-size: 11px;
  font-weight: 800;
}
.hero-path-grid {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.hero-path-step {
  min-height: 102px;
  display: grid;
  grid-template-columns: auto 1fr;
  grid-template-rows: auto auto;
  align-items: center;
  column-gap: 11px;
  padding: 15px;
  border: 1px solid rgba(23,73,64,.09);
  border-radius: 17px;
  background: rgba(255,255,255,.61);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.72);
}
.hero-path-step > span {
  grid-row: 1 / span 2;
  color: rgba(23,73,64,.48);
  font-family: var(--font-data);
  font-size: 9px;
  font-weight: 850;
}
.hero-path-step strong {
  color: var(--color-accent);
  font-family: var(--font-display);
  font-size: 27px;
  line-height: 1;
}
.hero-path-step small { color: var(--color-ink-soft); font-size: 11px; }
.hero-visual-note {
  position: relative;
  z-index: 1;
  margin: 18px 0 0;
  color: var(--color-ink-faint);
  font-size: 10px;
  line-height: 1.55;
}

/* Home action bento */
.home-action-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(0, .65fr);
  gap: 15px;
  margin: 2px 0 70px;
}
.home-action-card {
  position: relative;
  overflow: hidden;
  min-height: 252px;
  padding: 30px;
  border-radius: 28px;
}
.home-action-primary {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  background:
    radial-gradient(circle at 86% 8%, rgba(255,255,255,.16), transparent 30%),
    linear-gradient(135deg, #1D594F 0%, #0E3A34 100%);
  color: #FEFDF9;
  border: 0;
  box-shadow: 0 22px 50px rgba(13,56,50,.16), inset 0 1px 0 rgba(255,255,255,.15);
}
.home-action-primary::after {
  content: "";
  position: absolute;
  right: -70px;
  bottom: -105px;
  width: 260px;
  height: 260px;
  border: 1px solid rgba(255,255,255,.11);
  border-radius: 50%;
  box-shadow: 0 0 0 42px rgba(255,255,255,.035), 0 0 0 84px rgba(255,255,255,.02);
}
.home-action-primary > * { position: relative; z-index: 1; }
.home-action-primary .home-action-eyebrow { color: #BFDAD1; }
.home-action-primary .home-action-meta { color: #D9E7E2; }
.home-action-primary .home-action-copy { color: rgba(255,255,255,.74); }
.home-action-secondary {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: start;
  gap: 18px;
  border: 1px solid rgba(23,73,64,.11);
  background: rgba(252,252,250,.74);
  box-shadow: 0 15px 38px rgba(37,55,49,.055), inset 0 1px 0 rgba(255,255,255,.72);
}
.home-action-symbol {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 15px;
  background: var(--color-accent-soft);
  color: var(--color-accent);
  font-family: var(--font-display);
  font-size: 18px;
  box-shadow: inset 0 0 0 1px rgba(23,73,64,.08);
}
.home-action-title {
  margin: 8px 0 4px;
  font-family: var(--font-display);
  font-size: 29px;
  font-weight: 650;
  line-height: 1.16;
}
.home-action-meta { margin: 0 0 16px; font-size: 13px; }
.home-action-copy {
  max-width: 540px;
  margin: 12px 0 22px;
  color: var(--color-ink-soft);
  font-size: 14px;
  line-height: 1.75;
}
.home-action-button {
  margin-top: auto;
  border: 1px solid rgba(255,255,255,.18);
  border-radius: 13px;
  background: rgba(255,255,255,.96);
  color: var(--color-accent-strong);
  box-shadow: 0 10px 22px rgba(0,0,0,.09);
}
.home-action-button:hover { transform: translateY(-2px); }
.home-text-link {
  display: inline-flex;
  min-height: 42px;
  align-items: center;
  gap: 8px;
  color: var(--color-accent);
  font-size: 13px;
  font-weight: 800;
}
.home-text-link:hover { text-decoration: none; transform: translateX(2px); }
.home-curriculum { margin-bottom: 42px; }
.home-section-heading,
.unit-section-heading {
  display: flex;
  justify-content: space-between;
  align-items: end;
  gap: 34px;
  margin-bottom: 22px;
}
.home-section-heading h2,
.unit-section-heading h2,
.cross-text-panel h2,
.next-step-panel h2 {
  margin: 5px 0 0;
  font-family: var(--font-display);
  font-size: 29px;
  font-weight: 650;
  line-height: 1.22;
}
.home-section-heading > p,
.unit-section-heading > p {
  max-width: 400px;
  margin: 0;
  color: var(--color-ink-soft);
  font-size: 12px;
  line-height: 1.7;
}

/* Curriculum: a clean 4 × n modern collection grid */
.map-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}
.map-card {
  position: relative;
  min-height: 184px;
  margin: 0;
  padding: 20px;
  overflow: hidden;
  border: 1px solid rgba(23,73,64,.105);
  border-radius: 20px;
  background: rgba(252,252,250,.72);
  box-shadow: 0 9px 25px rgba(36,52,47,.035), inset 0 1px 0 rgba(255,255,255,.7);
}
.map-card::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 3px;
  background: linear-gradient(90deg, var(--color-accent), rgba(23,73,64,0));
  opacity: 0;
  transition: opacity .18s ease;
}
.map-card.card-tappable:hover::before { opacity: 1; }
.map-card.card-tappable:hover {
  transform: translateY(-4px);
  border-color: rgba(23,73,64,.20);
  background: rgba(255,255,255,.93);
  box-shadow: 0 20px 40px rgba(31,48,43,.085);
}
.map-card-top {
  display: flex;
  min-height: 31px;
  justify-content: space-between;
  align-items: flex-start;
  gap: 9px;
  margin-bottom: 23px;
}
.map-card-meta { display: flex; align-items: center; gap: 8px; min-width: 0; }
.map-sequence {
  color: rgba(23,73,64,.43);
  font-family: var(--font-data);
  font-size: 9px;
  font-weight: 850;
  letter-spacing: .10em;
}
.map-card .map-group {
  margin: 0;
  color: var(--color-reader-orange);
  font-size: 9px;
  font-weight: 850;
  letter-spacing: .08em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.map-card .badge {
  position: static;
  flex: none;
  padding: 3px 7px;
  font-size: 9px;
}
.map-card .map-title {
  max-width: 88%;
  margin: 0 0 7px;
  font-size: 22px;
  font-weight: 650;
  line-height: 1.21;
}
.map-card .map-author { font-size: 12px; }
.map-arrow {
  position: absolute;
  right: 19px;
  bottom: 18px;
  display: grid;
  place-items: center;
  width: 31px;
  height: 31px;
  border-radius: 50%;
  background: rgba(23,73,64,.06);
  color: var(--color-accent);
  font-size: 14px;
  transition: transform .18s ease, background .18s ease;
}
.map-card:hover .map-arrow { transform: translateX(2px); background: var(--color-accent-soft); }

/* Unit hero: a distinctive editorial object instead of a plain heading */
.unit-hero {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: 42px;
  align-items: center;
  min-height: 330px;
  margin: 10px 0 20px;
  padding: 42px 44px;
  overflow: hidden;
  border: 1px solid rgba(23,73,64,.11);
  border-radius: 32px;
  background:
    radial-gradient(circle at 92% 8%, rgba(183,95,71,.12), transparent 31%),
    linear-gradient(140deg, rgba(255,255,255,.90), rgba(230,239,235,.76));
  box-shadow: 0 26px 65px rgba(34,51,45,.085), inset 0 1px 0 rgba(255,255,255,.76);
}
.unit-hero::before {
  content: "";
  position: absolute;
  left: -100px;
  bottom: -150px;
  width: 340px;
  height: 340px;
  border: 1px solid rgba(23,73,64,.07);
  border-radius: 50%;
  box-shadow: 0 0 0 48px rgba(23,73,64,.018), 0 0 0 96px rgba(23,73,64,.012);
}
.unit-hero-copy { position: relative; z-index: 1; }
.unit-meta-row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.unit-title {
  margin: 13px 0 10px;
  font-size: clamp(48px, 6.8vw, 76px);
  font-weight: 540;
  line-height: 1.02;
  letter-spacing: -.05em;
}
.unit-author { margin: 0; color: var(--color-ink-soft); font-size: 15px; }
.unit-flow-mini {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 28px;
  color: var(--color-ink-soft);
  font-size: 11px;
  font-weight: 700;
}
.unit-flow-mini span {
  padding: 6px 9px;
  border: 1px solid rgba(23,73,64,.10);
  border-radius: 999px;
  background: rgba(255,255,255,.56);
}
.unit-flow-mini i { color: rgba(23,73,64,.36); font-style: normal; }
.unit-hero-art {
  position: relative;
  z-index: 1;
  min-height: 230px;
  display: grid;
  place-items: center;
}
.unit-monogram {
  position: relative;
  z-index: 2;
  display: grid;
  place-items: center;
  width: 142px;
  height: 142px;
  border-radius: 38px;
  background: linear-gradient(145deg, #215F54, #103A34);
  color: #FFFDF8;
  box-shadow: 0 24px 48px rgba(13,56,50,.20), inset 0 1px 0 rgba(255,255,255,.18);
  font-family: var(--font-display);
  font-size: 72px;
  font-weight: 500;
  transform: rotate(-3deg);
}
.unit-art-orbit {
  position: absolute;
  border: 1px solid rgba(23,73,64,.12);
  border-radius: 50%;
}
.orbit-one { width: 206px; height: 206px; }
.orbit-two { width: 260px; height: 260px; opacity: .58; }
.unit-art-caption {
  position: absolute;
  z-index: 3;
  bottom: 0;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(255,255,255,.72);
  color: var(--color-reader-orange);
  font-size: 9px;
  font-weight: 850;
  letter-spacing: .16em;
  box-shadow: 0 5px 16px rgba(39,54,49,.06);
}

/* Next step is the second focal surface */
.next-step-panel {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 30px;
  align-items: center;
  margin: 18px 0 62px;
  padding: 28px 30px 28px 34px;
  overflow: hidden;
  border: 0;
  border-radius: 24px;
  background:
    radial-gradient(circle at 96% 4%, rgba(255,255,255,.14), transparent 28%),
    linear-gradient(135deg, #1A5249, #0D3832);
  color: #FFFDF9;
  box-shadow: 0 18px 42px rgba(13,56,50,.14), inset 0 1px 0 rgba(255,255,255,.14);
}
.next-step-panel::before {
  content: "NEXT";
  position: absolute;
  right: 28px;
  top: -18px;
  color: rgba(255,255,255,.055);
  font-family: var(--font-data);
  font-size: 74px;
  font-weight: 900;
  letter-spacing: -.05em;
}
.next-step-panel .section-kicker { color: #BFD9D1; }
.next-step-panel h2 { color: #FFFDF9; }
.next-step-reason { max-width: 720px; margin: 9px 0 5px; color: rgba(255,255,255,.88); line-height: 1.7; }
.next-step-note { max-width: 760px; margin: 0; color: rgba(255,255,255,.55); font-size: 10px; line-height: 1.6; }
.next-step-button {
  position: relative;
  z-index: 1;
  white-space: nowrap;
  border: 1px solid rgba(255,255,255,.18);
  background: rgba(255,255,255,.96);
  color: var(--color-accent-strong);
  box-shadow: 0 10px 20px rgba(0,0,0,.10);
}
.next-step-button:hover { color: var(--color-accent-strong); background: #fff; }

/* Real Bento module hierarchy */
.unit-section { margin: 0 0 64px; }
.unit-section-heading.compact { margin-bottom: 18px; }
.module-grid-core {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  grid-auto-rows: minmax(124px, auto);
  grid-auto-flow: dense;
  gap: 12px;
}
.module-grid-practice { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.module-card {
  position: relative;
  min-height: 138px;
  margin: 0;
  padding: 22px 50px 22px 20px;
  overflow: hidden;
  align-items: center;
  gap: 14px;
  border: 1px solid rgba(23,73,64,.105);
  border-radius: 22px;
  background: rgba(252,252,250,.76);
  box-shadow: 0 9px 24px rgba(33,49,44,.035), inset 0 1px 0 rgba(255,255,255,.68);
}
.module-card.card-tappable:hover {
  transform: translateY(-3px);
  border-color: rgba(23,73,64,.20);
  background: rgba(255,255,255,.94);
  box-shadow: 0 19px 40px rgba(31,48,43,.085);
}
.module-grid-core .module-card { grid-column: span 6; }
.module-grid-core .module-card-text {
  grid-column: span 7;
  grid-row: span 2;
  min-height: 288px;
}
.module-grid-core .module-card-words,
.module-grid-core .module-card-comprehension { grid-column: span 5; }
.module-card-featured {
  align-items: flex-end;
  padding: 28px;
  background:
    radial-gradient(circle at 85% 15%, rgba(255,255,255,.13), transparent 30%),
    linear-gradient(145deg, #1E5B51, #0E3A34);
  border-color: transparent;
  color: #FFFDF8;
  box-shadow: 0 20px 44px rgba(13,56,50,.14), inset 0 1px 0 rgba(255,255,255,.14);
}
.module-card-featured.card-tappable:hover {
  background: linear-gradient(145deg, #24665A, #103F38);
  border-color: transparent;
  box-shadow: 0 25px 50px rgba(13,56,50,.19);
}
.module-order {
  position: absolute;
  top: 15px;
  right: 17px;
  color: rgba(23,73,64,.39);
  font-family: var(--font-data);
  font-size: 9px;
  font-weight: 850;
  letter-spacing: .10em;
}
.module-icon {
  width: 42px;
  height: 42px;
  border: 1px solid rgba(23,73,64,.12);
  border-radius: 14px;
  background: var(--color-accent-soft);
  color: var(--color-accent);
  font-family: var(--font-display);
  font-size: 16px;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.65);
}
.module-card-featured .module-icon {
  width: 54px;
  height: 54px;
  border-color: rgba(255,255,255,.16);
  background: rgba(255,255,255,.10);
  color: #fff;
  font-size: 20px;
  box-shadow: none;
}
.module-copy { min-width: 0; }
.module-name {
  margin-bottom: 5px;
  color: var(--color-ink);
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 650;
}
.module-desc { font-size: 12px; line-height: 1.55; }
.module-card-featured .module-name { color: #fff; font-size: 28px; }
.module-card-featured .module-desc { max-width: 360px; color: rgba(255,255,255,.69); font-size: 13px; }
.module-card-featured .module-order { color: rgba(255,255,255,.45); }
.module-arrow {
  position: absolute;
  right: 18px;
  bottom: 18px;
  display: grid;
  place-items: center;
  width: 31px;
  height: 31px;
  border-radius: 50%;
  background: rgba(23,73,64,.055);
  color: var(--color-accent);
  transition: transform .18s ease, background .18s ease;
}
.module-card-featured .module-arrow { background: rgba(255,255,255,.10); color: #fff; }
.module-card:hover .module-arrow { transform: translateX(2px); background: var(--color-accent-soft); }
.module-card-featured:hover .module-arrow { background: rgba(255,255,255,.16); }
.module-card-challenge { background: linear-gradient(145deg, rgba(244,229,223,.88), rgba(252,252,250,.82)); }
.module-card-progress { background: linear-gradient(145deg, rgba(226,239,234,.88), rgba(252,252,250,.82)); }
.background-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.background-grid .card {
  margin: 0;
  border-radius: 20px;
  background: rgba(252,252,250,.65);
  box-shadow: 0 7px 20px rgba(34,50,45,.025);
}
.background-grid summary { color: var(--color-accent); }
.unit-background-section { margin-bottom: 46px; }
.cross-text-panel {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 30px;
  padding: 24px 27px;
  border: 1px solid rgba(23,73,64,.10);
  border-radius: 20px;
  background: rgba(255,255,255,.45);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.65);
}
.cross-text-panel h2 { font-size: 23px; }
.cross-text-panel p:not(.section-kicker) { margin: 7px 0 0; color: var(--color-ink-soft); font-size: 12px; }
.unit-footer-nav { margin-top: 32px; }

/* Gentle route-level entrance; reduced-motion users get no animation. */
.home-hero,
.home-action-grid,
.home-curriculum,
.unit-hero,
.next-step-panel,
.unit-section,
.cross-text-panel {
  animation: ui-surface-in .42s cubic-bezier(.2,.75,.2,1) both;
}
.home-action-grid,
.next-step-panel { animation-delay: .035s; }
.home-curriculum,
.unit-section { animation-delay: .065s; }
@keyframes ui-surface-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 960px) {
  .home-hero { grid-template-columns: 1fr; gap: 30px; padding-top: 38px; }
  .home-hero-copy { max-width: 800px; }
  .home-hero-visual { min-height: 0; }
  .home-action-grid { grid-template-columns: 1fr; margin-bottom: 54px; }
  .home-action-card { min-height: 0; }
  .map-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .unit-hero { grid-template-columns: minmax(0, 1fr) 220px; padding: 34px; }
  .unit-monogram { width: 124px; height: 124px; font-size: 62px; }
  .orbit-one { width: 180px; height: 180px; }
  .orbit-two { width: 222px; height: 222px; }
  .module-grid-core .module-card-text { grid-column: span 12; grid-row: auto; min-height: 218px; }
  .module-grid-core .module-card-words,
  .module-grid-core .module-card-comprehension,
  .module-grid-core .module-card-analysis,
  .module-grid-core .module-card-theme { grid-column: span 6; }
}

@media (max-width: 760px) {
  #app-header { padding: 9px 9px 0; }
  .header-inner { min-height: 54px; padding: 8px 9px; border-radius: 16px; }
  .header-crumb { display: none; }
  .brand-copy { font-size: 14px; }
  .header-nav { margin-left: auto; }
  #app-main { padding-top: 25px; }
  .home-title { font-size: clamp(42px, 11vw, 60px); }
  .home-section-heading,
  .unit-section-heading { align-items: flex-start; flex-direction: column; gap: 9px; }
  .unit-hero { grid-template-columns: 1fr; min-height: 0; gap: 26px; }
  .unit-hero-art { min-height: 190px; }
  .next-step-panel { grid-template-columns: 1fr; gap: 20px; }
  .next-step-button { justify-self: start; }
  .module-grid-practice { grid-template-columns: 1fr; }
}

@media (max-width: 560px) {
  .header-inner { padding: 8px; }
  .brand { gap: 7px; }
  .brand .brand-mark { width: 31px; height: 31px; border-radius: 10px; font-size: 14px; }
  .header-nav-link { min-height: 31px; padding: 6px 8px; font-size: 11px; }
  #app-main { padding-left: 16px; padding-right: 16px; }
  .quiz-nav-bar { margin-left: -16px; margin-right: -16px; }
  .home-hero { padding: 30px 0 40px; }
  .home-edition-pill { display: none; }
  .home-title { margin-top: 12px; font-size: 42px; line-height: 1.07; }
  .home-lead { font-size: 14px; line-height: 1.75; }
  .home-hero-chips { margin-top: 20px; }
  .home-hero-visual { padding: 19px; border-radius: 24px; }
  .hero-path-step { min-height: 92px; padding: 12px; }
  .hero-path-step strong { font-size: 23px; }
  .hero-visual-head strong { font-size: 17px; }
  .home-action-card { padding: 23px; border-radius: 23px; }
  .home-action-secondary { grid-template-columns: 1fr; }
  .home-action-title { font-size: 25px; }
  .map-grid { grid-template-columns: 1fr; }
  .map-card { min-height: 158px; }
  .unit-hero { margin-top: 4px; padding: 26px 23px 23px; border-radius: 25px; }
  .unit-title { font-size: 46px; }
  .unit-flow-mini i { display: none; }
  .unit-hero-art { min-height: 170px; }
  .unit-monogram { width: 108px; height: 108px; border-radius: 30px; font-size: 54px; }
  .orbit-one { width: 154px; height: 154px; }
  .orbit-two { width: 190px; height: 190px; }
  .next-step-panel { margin-bottom: 48px; padding: 24px; border-radius: 21px; }
  .next-step-panel::before { font-size: 56px; right: 14px; }
  .unit-section { margin-bottom: 48px; }
  .module-grid-core { grid-template-columns: 1fr; }
  .module-grid-core .module-card,
  .module-grid-core .module-card-text,
  .module-grid-core .module-card-words,
  .module-grid-core .module-card-comprehension,
  .module-grid-core .module-card-analysis,
  .module-grid-core .module-card-theme { grid-column: auto; grid-row: auto; }
  .module-card { min-height: 116px; }
  .module-card-featured { min-height: 190px; align-items: flex-end; }
  .background-grid { grid-template-columns: 1fr; }
  .cross-text-panel { align-items: flex-start; flex-direction: column; gap: 10px; padding: 21px; }
}

@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  .card-tappable,
  .btn,
  .header-nav-link,
  .map-arrow,
  .module-arrow,
  .home-hero,
  .home-action-grid,
  .home-curriculum,
  .unit-hero,
  .next-step-panel,
  .unit-section,
  .cross-text-panel {
    animation: none !important;
    transition: none !important;
  }
}
'''
css_path.write_text(base + ui2, encoding="utf-8")
print("Applied UI 2.0 source patch")
