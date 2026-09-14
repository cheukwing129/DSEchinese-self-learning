from pathlib import Path

root = Path('.')
index_path = root / 'index.template.html'
app_path = root / 'js/app.js'
css_path = root / 'css/style.css'
browser_path = root / 'scripts/browser-smoke.mjs'
prod_path = root / 'scripts/production-smoke.mjs'

index = index_path.read_text()
old_head = '''  <title>文脈 · DSE 經典自學</title>\n  <meta name="description" content="文脈是為 DSE 中文十二篇指定文言經典而設的自學平台，從原文、字詞與文意，逐步進入賞析、背誦、作答與錯題修復。" />\n  <link rel="stylesheet" href="{{STYLE_ASSET}}" />'''
new_head = '''  <title>文脈 · DSE 經典自學</title>\n  <meta name="description" content="文脈是為 DSE 中文指定文言經典而設的自學平台，從原文、字詞與文意，逐步進入賞析、背誦、作答與錯題修復。" />\n  <meta name="application-name" content="文脈" />\n  <meta name="theme-color" content="#174940" />\n  <meta name="color-scheme" content="light" />\n  <meta name="robots" content="index,follow" />\n  <link rel="canonical" href="https://dsechinese-self-learning.pages.dev/" />\n  <link rel="icon" type="image/svg+xml" href="/assets/brand/wenmai-mark.svg" />\n  <meta property="og:locale" content="zh_HK" />\n  <meta property="og:type" content="website" />\n  <meta property="og:site_name" content="文脈" />\n  <meta property="og:title" content="文脈 · DSE 經典自學" />\n  <meta property="og:description" content="從原文、字詞與文意，逐步進入賞析、背誦、作答與錯題修復。" />\n  <meta property="og:url" content="https://dsechinese-self-learning.pages.dev/" />\n  <meta property="og:image" content="https://dsechinese-self-learning.pages.dev/assets/brand/wenmai-share.png" />\n  <meta property="og:image:width" content="1200" />\n  <meta property="og:image:height" content="630" />\n  <meta name="twitter:card" content="summary_large_image" />\n  <meta name="twitter:title" content="文脈 · DSE 經典自學" />\n  <meta name="twitter:description" content="讀懂經典，把每一步變成自己的能力。" />\n  <meta name="twitter:image" content="https://dsechinese-self-learning.pages.dev/assets/brand/wenmai-share.png" />\n  <script type="application/ld+json">{"@context":"https://schema.org","@type":"WebApplication","name":"文脈","url":"https://dsechinese-self-learning.pages.dev/","description":"DSE 中文指定文言經典自學平台","applicationCategory":"EducationalApplication","inLanguage":"zh-Hant-HK","isAccessibleForFree":true}</script>\n  <link rel="stylesheet" href="{{STYLE_ASSET}}" />'''
if old_head not in index:
    raise SystemExit('index head anchor not found')
index = index.replace(old_head, new_head, 1)
old_brand = '''      <a class="brand" id="brand-home-link" href="#/" aria-label="返回文脈首頁">\n        <span class="brand-mark" aria-hidden="true">典</span>\n        <span class="brand-copy">文脈</span>\n      </a>\n      <nav class="header-nav" aria-label="主要導覽">\n        <a class="header-nav-link" href="#/">篇章</a>\n        <a class="header-nav-link" href="#/overview">學習總覽</a>\n      </nav>'''
new_brand = '''      <a class="brand" id="brand-home-link" href="#/" aria-label="返回文脈首頁">\n        <img class="brand-mark-image" src="/assets/brand/wenmai-mark.svg" alt="" width="36" height="36" />\n        <span class="brand-copy-group">\n          <span class="brand-word">文脈</span>\n          <span class="brand-tagline">DSE CLASSICS</span>\n        </span>\n      </a>\n      <nav class="header-nav" aria-label="主要導覽">\n        <a class="header-nav-link" data-nav="chapters" href="#/">篇章</a>\n        <a class="header-nav-link" data-nav="overview" href="#/overview">總覽</a>\n      </nav>'''
if old_brand not in index:
    raise SystemExit('brand anchor not found')
index = index.replace(old_brand, new_brand, 1)
index = index.replace('<body>\n  <header id="app-header">', '<body>\n  <a class="skip-link" href="#app-main">跳到主要內容</a>\n  <header id="app-header">', 1)
index = index.replace('''  <main id="app-main">\n    <div class="loading-state">正在載入…</div>\n  </main>''', '''  <main id="app-main" tabindex="-1">\n    <div class="loading-state launch-loading" role="status" aria-live="polite">\n      <span class="loading-mark" aria-hidden="true"><span>文</span></span>\n      <div><strong>正在整理學習內容</strong><small>文脈會在需要時才載入這一頁的資料。</small></div>\n    </div>\n  </main>\n  <noscript><div class="noscript-state">文脈需要 JavaScript 才能載入篇章、練習與本機學習紀錄。</div></noscript>''', 1)
index_path.write_text(index)

brand_dir = root / 'assets/brand'
brand_dir.mkdir(parents=True, exist_ok=True)
brand_dir.joinpath('wenmai-mark.svg').write_text('''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="文脈標誌">\n  <rect x="3" y="3" width="58" height="58" rx="18" fill="#174940"/>\n  <circle cx="49" cy="15" r="4" fill="#B85940"/>\n  <text x="32" y="43" text-anchor="middle" font-family="serif" font-size="34" font-weight="700" fill="#F7F2E9">典</text>\n</svg>\n''')

app = app_path.read_text()
old_common = '''  function setCrumb(text) {\n    crumbEl().textContent = text || "";\n  }\n\n  function renderLoading(label) {\n    mount(`<div class="loading-state">正在載入${label || ""}…</div>`);\n  }\n\n  function renderFatalError(message) {\n    mount(`\n      <div class="card">\n        <div class="error-banner">\n          <strong>發生錯誤</strong><br/>${escapeHTML(message)}\n        </div>\n        <div class="btn-row">\n          <a class="btn btn-secondary" href="#/">返回首頁</a>\n        </div>\n      </div>\n    `);\n  }\n\n  function renderNotFound(path) {\n    mount(`\n      <div class="empty-state">\n        <p>找不到頁面：${escapeHTML(path)}</p>\n        <a class="btn btn-primary" href="#/">返回首頁</a>\n      </div>\n    `);\n  }'''
new_common = '''  function syncHeaderState() {\n    const path = Router.currentPath();\n    const routeKind = path.startsWith("/overview") ? "overview" : (path === "/" || path.startsWith("/unit/")) ? "chapters" : "other";\n    document.body.dataset.route = routeKind;\n    document.querySelectorAll(".header-nav-link").forEach((link) => {\n      const active = link.dataset.nav === routeKind;\n      if (active) link.setAttribute("aria-current", "page");\n      else link.removeAttribute("aria-current");\n    });\n  }\n\n  function setCrumb(text) {\n    const label = text || "";\n    crumbEl().textContent = label;\n    document.title = label ? `${label} · 文脈` : "文脈 · DSE 經典自學";\n    syncHeaderState();\n  }\n\n  function renderLoading(label) {\n    syncHeaderState();\n    const safeLabel = escapeHTML(label || "學習內容");\n    mount(`\n      <div class="loading-state launch-loading" role="status" aria-live="polite">\n        <span class="loading-mark" aria-hidden="true"><span>文</span></span>\n        <div><strong>正在整理${safeLabel}</strong><small>只載入這一頁真正需要的內容。</small></div>\n      </div>\n    `);\n  }\n\n  function renderFatalError(message) {\n    setCrumb("載入失敗");\n    mount(`\n      <section class="launch-state is-error" role="alert" aria-labelledby="fatal-title">\n        <div class="launch-state-mark" aria-hidden="true">!</div>\n        <p class="launch-state-kicker">LOAD ERROR</p>\n        <h1 id="fatal-title" class="page-title">這一頁暫時未能載入</h1>\n        <p class="launch-state-copy">${escapeHTML(message)}</p>\n        <p class="launch-state-help">你的本機學習紀錄不會因這次載入失敗而被清除。</p>\n        <div class="launch-state-actions">\n          <button type="button" class="btn btn-primary" id="retry-page-btn">再試一次</button>\n          <a class="btn btn-secondary" href="#/">返回首頁</a>\n        </div>\n      </section>\n    `);\n    const retry = document.getElementById("retry-page-btn");\n    if (retry) retry.addEventListener("click", () => Router.navigate(Router.currentPath()));\n  }\n\n  function renderNotFound(path) {\n    setCrumb("找不到頁面");\n    mount(`\n      <section class="launch-state is-not-found" aria-labelledby="not-found-title">\n        <div class="launch-state-code" aria-hidden="true">404</div>\n        <p class="launch-state-kicker">LOST IN THE MARGIN</p>\n        <h1 id="not-found-title" class="page-title">這一頁不在文脈裡</h1>\n        <p class="launch-state-copy">網址「${escapeHTML(path)}」沒有對應的學習頁面。你可以回到篇章地圖，或查看目前的學習總覽。</p>\n        <div class="launch-state-actions">\n          <a class="btn btn-primary" href="#/">回到篇章</a>\n          <a class="btn btn-secondary" href="#/overview">學習總覽</a>\n        </div>\n      </section>\n    `);\n  }'''
if old_common not in app:
    raise SystemExit('app common state anchor not found')
app = app.replace(old_common, new_common, 1)
app_path.write_text(app)

css = css_path.read_text()
launch_css = r'''

/* ============================================================
   Launch polish — 品牌 chrome、狀態頁、mobile header、motion
   ============================================================ */
::selection { background: rgba(184,89,64,.18); color: var(--color-ink); }

.skip-link {
  position: fixed;
  left: 14px;
  top: 10px;
  z-index: 1000;
  transform: translateY(-150%);
  padding: 9px 13px;
  border-radius: 999px;
  background: var(--color-accent-strong);
  color: #fff;
  font-size: 12px;
  font-weight: 800;
  transition: transform .16s ease;
}
.skip-link:focus { transform: translateY(0); }

.brand { align-items: center; gap: 10px; min-width: 0; }
.brand-mark-image {
  display: block;
  width: 36px;
  height: 36px;
  flex: 0 0 36px;
  border-radius: 12px;
  box-shadow: 0 7px 18px rgba(13,56,50,.14);
}
.brand-copy-group { display: flex; flex-direction: column; min-width: 0; line-height: 1; }
.brand-word { font-family: var(--font-display); font-size: 18px; font-weight: 760; letter-spacing: -.035em; }
.brand-tagline { margin-top: 4px; color: var(--color-ink-faint); font-family: var(--font-data); font-size: 7px; font-weight: 850; letter-spacing: .18em; }
.header-crumb:empty { display: none; }
.header-nav-link {
  position: relative;
  transition: background .16s ease, color .16s ease, transform .16s ease;
}
.header-nav-link[aria-current="page"] {
  background: rgba(23,73,64,.09);
  color: var(--color-accent-strong);
}
.header-nav-link[aria-current="page"]::after {
  content: "";
  position: absolute;
  left: 50%;
  bottom: 3px;
  width: 12px;
  height: 2px;
  transform: translateX(-50%);
  border-radius: 999px;
  background: var(--color-reader-orange);
}

.loading-state.launch-loading {
  min-height: min(52vh, 420px);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 48px 20px;
  text-align: left;
  color: var(--color-ink);
}
.launch-loading > div { display: grid; gap: 4px; }
.launch-loading strong { font-family: var(--font-display); font-size: 18px; font-weight: 720; letter-spacing: -.025em; }
.launch-loading small { color: var(--color-ink-faint); font-size: 11px; }
.loading-mark {
  position: relative;
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  flex: 0 0 46px;
  border-radius: 15px;
  background: var(--color-accent);
  color: #fff;
  font-family: var(--font-display);
  font-weight: 800;
  box-shadow: 0 14px 30px rgba(23,73,64,.15);
}
.loading-mark::after {
  content: "";
  position: absolute;
  inset: -6px;
  border: 1px solid rgba(23,73,64,.16);
  border-top-color: var(--color-reader-orange);
  border-radius: 19px;
  animation: launch-spin 1.4s linear infinite;
}
@keyframes launch-spin { to { transform: rotate(360deg); } }

.launch-state {
  position: relative;
  overflow: hidden;
  max-width: 720px;
  margin: 54px auto 0;
  padding: clamp(30px, 6vw, 54px);
  border: 1px solid rgba(23,73,64,.12);
  border-radius: 30px;
  background:
    radial-gradient(circle at 92% 10%, rgba(184,89,64,.10), transparent 28%),
    linear-gradient(145deg, rgba(255,255,255,.92), rgba(246,242,232,.78));
  box-shadow: 0 28px 70px rgba(31,48,43,.08);
}
.launch-state::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image: linear-gradient(rgba(23,73,64,.025) 1px, transparent 1px), linear-gradient(90deg, rgba(23,73,64,.025) 1px, transparent 1px);
  background-size: 28px 28px;
  mask-image: linear-gradient(to bottom, #000, transparent 72%);
}
.launch-state > * { position: relative; z-index: 1; }
.launch-state-kicker { margin: 0 0 10px; color: var(--color-reader-orange); font-family: var(--font-data); font-size: 9px; font-weight: 900; letter-spacing: .18em; }
.launch-state .page-title { max-width: 560px; margin-bottom: 14px; font-size: clamp(32px, 6vw, 48px); letter-spacing: -.055em; }
.launch-state-copy { max-width: 590px; margin: 0; color: var(--color-ink-soft); font-size: 14px; line-height: 1.8; }
.launch-state-help { margin: 14px 0 0; color: var(--color-ink-faint); font-size: 11px; line-height: 1.7; }
.launch-state-actions { display: flex; gap: 9px; flex-wrap: wrap; margin-top: 26px; }
.launch-state-mark {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  margin-bottom: 22px;
  border-radius: 16px;
  background: var(--color-error-soft);
  color: var(--color-error);
  font-family: var(--font-display);
  font-size: 26px;
  font-weight: 800;
}
.launch-state-code {
  margin-bottom: 18px;
  color: rgba(23,73,64,.11);
  font-family: var(--font-display);
  font-size: clamp(66px, 14vw, 112px);
  font-weight: 800;
  line-height: .8;
  letter-spacing: -.08em;
}

.empty-state {
  border: 1px dashed rgba(23,73,64,.16);
  border-radius: 20px;
  background: rgba(255,255,255,.5);
}
.noscript-state {
  max-width: 720px;
  margin: 24px auto;
  padding: 16px 18px;
  border-radius: 14px;
  background: #fff4e8;
  color: #6f4b2c;
  font-size: 13px;
}

:where(a, button, input, textarea, select, [tabindex]):focus-visible {
  outline: 3px solid rgba(184,89,64,.36);
  outline-offset: 3px;
}

@media (max-width: 680px) {
  #app-header { background: rgba(250,248,243,.92); }
  .header-inner { padding: 9px 14px 8px; gap: 8px; flex-wrap: wrap; }
  .brand { flex: 1 1 auto; gap: 8px; }
  .brand-mark-image { width: 32px; height: 32px; flex-basis: 32px; border-radius: 10px; }
  .brand-word { font-size: 17px; }
  .brand-tagline { display: none; }
  .header-nav { flex: 0 0 auto; gap: 3px; }
  .header-nav-link { min-height: 36px; padding: 0 11px; border-radius: 999px; font-size: 11px; }
  .header-crumb { order: 3; flex: 1 0 100%; max-width: none; padding: 3px 2px 0 40px; font-size: 10px; }
  .launch-state { margin-top: 28px; padding: 28px 22px; border-radius: 24px; }
  .launch-state .page-title { font-size: clamp(30px, 10vw, 40px); }
  .launch-state-actions .btn { flex: 1 1 150px; }
  .loading-state.launch-loading { min-height: 46vh; padding-inline: 10px; }
}

@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto !important; }
  *, *::before, *::after {
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .01ms !important;
  }
}
'''
if 'Launch polish — 品牌 chrome' in css:
    raise SystemExit('launch css already present')
css_path.write_text(css + launch_css)

browser = browser_path.read_text()
needle = '''  await page.reload({ waitUntil: "networkidle", timeout: 10000 });\n  await waitForTitle(page, "讀懂經典");\n  const warm = await navigationMetrics(page);'''
insert = '''  await page.reload({ waitUntil: "networkidle", timeout: 10000 });\n  await waitForTitle(page, "讀懂經典");\n  check(await page.locator('link[rel="icon"][href="/assets/brand/wenmai-mark.svg"]').count() === 1, "launch shell should expose the Wenmai favicon");\n  const launchMeta = await page.evaluate(() => ({\n    canonical: document.querySelector('link[rel="canonical"]')?.href || "",\n    ogTitle: document.querySelector('meta[property="og:title"]')?.content || "",\n    ogImage: document.querySelector('meta[property="og:image"]')?.content || "",\n    theme: document.querySelector('meta[name="theme-color"]')?.content || "",\n    chapterCurrent: document.querySelector('[data-nav="chapters"]')?.getAttribute('aria-current') || ""\n  }));\n  check(launchMeta.canonical.endsWith('/'), "launch shell should expose a canonical URL");\n  check(launchMeta.ogTitle.includes("文脈"), "Open Graph title should carry the Wenmai brand");\n  check(launchMeta.ogImage.endsWith('/assets/brand/wenmai-share.png'), "Open Graph image should point at the Wenmai share card");\n  check(launchMeta.theme.toLowerCase() === '#174940', "theme-color should match the Wenmai ink green");\n  check(launchMeta.chapterCurrent === 'page', "home route should mark the chapter navigation as current");\n  check(await page.locator('.brand-mark-image').count() === 1, "header should render the Wenmai brand mark");\n  check(await page.evaluate(() => fetch('/assets/brand/wenmai-mark.svg').then((r) => r.ok).catch(() => false)), "Wenmai brand mark asset should be fetchable");\n  check(await page.evaluate(() => fetch('/assets/brand/wenmai-share.png').then((r) => r.ok).catch(() => false)), "Wenmai share image should be fetchable");\n  const warm = await navigationMetrics(page);'''
if needle not in browser:
    raise SystemExit('browser warm anchor not found')
browser = browser.replace(needle, insert, 1)
needle2 = '''  await page.evaluate(() => { window.location.hash = "#/overview"; });\n  await page.locator(".overview-hero").waitFor({ state: "visible", timeout: 5000 });\n  check(await page.locator(".priority-stack").count() === 1, "cross-unit overview should render priority learning actions");\n\n  await page.evaluate(() => { window.location.hash = "#/unit/yueyanglouji/memorisation"; });'''
insert2 = '''  await page.evaluate(() => { window.location.hash = "#/overview"; });\n  await page.locator(".overview-hero").waitFor({ state: "visible", timeout: 5000 });\n  check(await page.locator(".priority-stack").count() === 1, "cross-unit overview should render priority learning actions");\n  check(await page.locator('[data-nav="overview"][aria-current="page"]').count() === 1, "overview route should expose an active header navigation state");\n\n  await page.evaluate(() => { window.location.hash = "#/not-a-real-route"; });\n  await page.locator(".launch-state.is-not-found").waitFor({ state: "visible", timeout: 3000 });\n  check(await page.locator(".launch-state-code", { hasText: "404" }).count() === 1, "unknown routes should render the branded 404 state");\n  await page.evaluate(() => App.renderLoading("測試內容"));\n  check(await page.locator(".launch-loading .loading-mark").count() === 1, "loading state should render the branded loading treatment");\n  await page.evaluate(() => App.renderFatalError("測試錯誤"));\n  check(await page.locator(".launch-state.is-error").count() === 1, "fatal errors should render the branded recovery state");\n\n  await page.evaluate(() => { window.location.hash = "#/unit/yueyanglouji/memorisation"; });'''
if needle2 not in browser:
    raise SystemExit('browser overview anchor not found')
browser = browser.replace(needle2, insert2, 1)
needle3 = '''  const homeOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);\n  check(homeOverflow <= 1, `mobile home has horizontal overflow of ${homeOverflow}px`);'''
insert3 = '''  const homeOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);\n  check(homeOverflow <= 1, `mobile home has horizontal overflow of ${homeOverflow}px`);\n  check(await page.locator('.header-nav').count() === 1, "mobile shell should retain compact primary navigation");\n  const headerOverflow = await page.evaluate(() => document.querySelector('.header-inner').scrollWidth - document.querySelector('.header-inner').clientWidth);\n  check(headerOverflow <= 1, `mobile header has horizontal overflow of ${headerOverflow}px`);'''
if needle3 not in browser:
    raise SystemExit('browser mobile anchor not found')
browser = browser.replace(needle3, insert3, 1)
browser_path.write_text(browser)

prod = prod_path.read_text()
needle4 = '''  const homeOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);\n  check(homeOverflow <= 1, `production mobile home has horizontal overflow of ${homeOverflow}px`);'''
insert4 = '''  const homeOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);\n  check(homeOverflow <= 1, `production mobile home has horizontal overflow of ${homeOverflow}px`);\n  const brandAssets = await page.evaluate(async () => {\n    const [mark, share] = await Promise.all([fetch('/assets/brand/wenmai-mark.svg'), fetch('/assets/brand/wenmai-share.png')]);\n    return { mark: mark.ok, share: share.ok, og: document.querySelector('meta[property="og:image"]')?.content || "" };\n  });\n  check(brandAssets.mark, "production Wenmai favicon/mark should be available");\n  check(brandAssets.share, "production Wenmai social share card should be available");\n  check(brandAssets.og.endsWith('/assets/brand/wenmai-share.png'), "production Open Graph image metadata should be current");\n  await page.evaluate(() => { window.location.hash = "#/not-a-real-route"; });\n  await page.locator(".launch-state.is-not-found").waitFor({ state: "visible", timeout: 4000 });\n  await page.evaluate(() => { window.location.hash = "#/"; });\n  await page.locator(".home-hero").waitFor({ state: "visible", timeout: 5000 });'''
if needle4 not in prod:
    raise SystemExit('production mobile home anchor not found')
prod = prod.replace(needle4, insert4, 1)
prod_path.write_text(prod)

print('Launch polish product patch applied.')
