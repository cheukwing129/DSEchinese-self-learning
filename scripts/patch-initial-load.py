from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 match, found {count}")
    return text.replace(old, new, 1)

# index.html — remove third-party font blocking and eagerly load only the three bootstrap scripts.
path = Path("index.html")
text = path.read_text()
text = replace_once(
    text,
    '''  <link rel="preconnect" href="https://fonts.googleapis.com">\n  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n  <link href="https://fonts.googleapis.com/css2?family=Source+Serif+Pro:wght@400;600&family=Mulish:wght@400;600;700;800&display=swap" rel="stylesheet">\n  <link rel="stylesheet" href="css/style.css" />\n</head>''',
    '''  <link rel="stylesheet" href="css/style.css" />\n  <script defer src="js/progress.js"></script>\n  <script defer src="js/router.js"></script>\n  <script defer src="js/app.js"></script>\n</head>''',
    "head bootstrap resources"
)
text = replace_once(
    text,
    '''\n  <!-- 載入次序很重要：Progress / Router 無外部依賴 → App（提供 escapeHTML 等共用工具）\n       → 三個渲染模組（載入時需要 App 已存在）-->\n  <script src="js/progress.js"></script>\n  <script src="js/router.js"></script>\n  <script src="js/app.js"></script>\n  <script src="js/content-renderer.js"></script>\n  <script src="js/question-engine.js"></script>\n  <script src="js/memorisation-engine.js"></script>\n''',
    '''\n  <!-- ContentRenderer / QuestionEngine / MemorisationEngine 會按目前路由需要才載入。 -->\n''',
    "remove eager route-only scripts"
)
path.write_text(text)

# style.css — system font stacks avoid two external origins and multiple Latin-only font files.
path = Path("css/style.css")
text = path.read_text()
text = replace_once(
    text,
    '''/* 字體：Charter 襯線體處理標題／顯示文字，Mulish 人文無襯線體處理其餘一切 */\n--font-display: "Charter", "Source Serif Pro", "Noto Serif TC", "Songti TC", serif;\n--font-body: "Mulish", "Inter", "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif;\n--font-data: "Mulish", "Noto Sans TC", monospace;''',
    '''/* 字體：優先使用系統內建中西文字體，避免首屏依賴第三方字體網絡請求。 */\n--font-display: "Charter", "Iowan Old Style", "Palatino Linotype", "Songti TC", "Noto Serif TC", "PMingLiU", serif;\n--font-body: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang TC", "Noto Sans TC", "Microsoft JhengHei", sans-serif;\n--font-data: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang TC", "Noto Sans TC", "Microsoft JhengHei", sans-serif;''',
    "system font stacks"
)
path.write_text(text)

# app.js — lazy-load heavy UI engines in parallel with route data.
path = Path("js/app.js")
text = path.read_text()
text = replace_once(
    text,
    '  const cache = { curriculum: null, json: {} };\n',
    '''  const cache = { curriculum: null, json: {}, scripts: {} };\n  const UI_MODULES = Object.freeze({\n    content: "js/content-renderer.js",\n    questions: "js/question-engine.js",\n    memorisation: "js/memorisation-engine.js"\n  });\n''',
    "script cache and UI module map"
)
needle = '''  function loadJSONCached(path) {\n    if (!cache.json[path]) {\n      cache.json[path] = fetchJSON(path).catch((err) => {\n        delete cache.json[path];\n        throw err;\n      });\n    }\n    return cache.json[path];\n  }\n\n'''
insert = needle + '''  function loadScriptCached(src) {\n    if (!cache.scripts[src]) {\n      cache.scripts[src] = new Promise((resolve, reject) => {\n        const script = document.createElement("script");\n        script.src = src;\n        script.async = true;\n        script.dataset.uiModule = src;\n        script.addEventListener("load", () => resolve(), { once: true });\n        script.addEventListener("error", () => {\n          delete cache.scripts[src];\n          script.remove();\n          reject(new Error(`無法載入介面模組「${src}」。`));\n        }, { once: true });\n        document.head.appendChild(script);\n      });\n    }\n    return cache.scripts[src];\n  }\n\n  function loadUIModules(names = []) {\n    return Promise.all([...new Set(names)].map((name) => {\n      const src = UI_MODULES[name];\n      if (!src) return Promise.reject(new Error(`未知介面模組「${name}」。`));\n      return loadScriptCached(src);\n    }));\n  }\n\n'''
text = replace_once(text, needle, insert, "cached dynamic UI loader")
text = replace_once(
    text,
    '''    try {\n      const { curriculum, unitBundles } = await loadCrossUnitBundles();\n      if (!Router.isCurrentNavigation(navigationId)) return;\n      ContentRenderer.renderCrossUnitOverview(curriculum, unitBundles);''',
    '''    try {\n      const [{ curriculum, unitBundles }] = await Promise.all([\n        loadCrossUnitBundles(),\n        loadUIModules(["content"])\n      ]);\n      if (!Router.isCurrentNavigation(navigationId)) return;\n      ContentRenderer.renderCrossUnitOverview(curriculum, unitBundles);''',
    "overview UI module loading"
)
text = replace_once(
    text,
    '''    try {\n      const { unitBundles } = await loadCrossUnitBundles();\n      if (!Router.isCurrentNavigation(navigationId)) return;\n      QuestionEngine.renderCrossUnitWrongRetry(unitBundles, ability);''',
    '''    try {\n      const [{ unitBundles }] = await Promise.all([\n        loadCrossUnitBundles(),\n        loadUIModules(["questions"])\n      ]);\n      if (!Router.isCurrentNavigation(navigationId)) return;\n      QuestionEngine.renderCrossUnitWrongRetry(unitBundles, ability);''',
    "cross-unit retry UI module loading"
)
text = replace_once(
    text,
    '''    renderLoading("篇章資料");\n    let bundle;\n    try {\n      bundle = await loadUnitBundle(unitId, options || {});\n      if (!Router.isCurrentNavigation(navigationId)) return;''',
    '''    const uiModules = [...new Set(options.uiModules || [])];\n    renderLoading("篇章資料");\n    let bundle;\n    try {\n      [bundle] = await Promise.all([\n        loadUnitBundle(unitId, options || {}),\n        loadUIModules(uiModules)\n      ]);\n      if (!Router.isCurrentNavigation(navigationId)) return;''',
    "parallel bundle and UI module loading"
)
replacements = [
    ('{ resources: ["background"] }', '{ resources: ["background"], uiModules: ["content"] }'),
    ('{ resources: ["text"] }', '{ resources: ["text"], uiModules: ["content"] }'),
    ('{ resources: ["structure"] }', '{ resources: ["structure"], uiModules: ["content"] }'),
    ('{ resources: ["appreciation"] }', '{ resources: ["appreciation"], uiModules: ["content"] }'),
    ('{ resources: ["memorisation"] }', '{ resources: ["memorisation"], uiModules: ["memorisation"] }'),
    ('{ resources: ["memorisation", "rubrics"], allQuestionBanks: true }', '{ resources: ["memorisation", "rubrics"], allQuestionBanks: true, uiModules: ["content"] }'),
    ('{ resources: ["rubrics"], allQuestionBanks: true }', '{ resources: ["rubrics"], allQuestionBanks: true, uiModules: ["questions"] }'),
    ('{ resources: ["rubrics"], banks: [bankName] }', '{ resources: ["rubrics"], banks: [bankName], uiModules: ["questions"] }'),
    ('{ resources: ["rubrics"], banks: ["cross-text"] }', '{ resources: ["rubrics"], banks: ["cross-text"], uiModules: ["questions"] }')
]
for old, new in replacements:
    if old not in text:
        raise SystemExit(f"route module mapping: missing {old}")
    text = text.replace(old, new)
text = replace_once(
    text,
    '''  async function pageCrossText(params) {\n    await withUnitBundle(params.unitId, (bundle) => {''',
    '''  async function pageCrossText(params) {\n    await withUnitBundle(params.unitId, { uiModules: ["content"] }, (bundle) => {''',
    "cross-text content module"
)
path.write_text(text)

# Cloudflare Pages: preload only the bootstrap resources as Early Hints. No aggressive cache TTLs while filenames are unversioned.
Path("_headers").write_text('''/\n  Link: </css/style.css>; rel=preload; as=style, </js/progress.js>; rel=preload; as=script, </js/router.js>; rel=preload; as=script, </js/app.js>; rel=preload; as=script\n\n/index.html\n  Link: </css/style.css>; rel=preload; as=style, </js/progress.js>; rel=preload; as=script, </js/router.js>; rel=preload; as=script, </js/app.js>; rel=preload; as=script\n''')

# Performance contract: startup must stay lightweight and free of third-party font dependencies.
Path("scripts/validate-performance.mjs").write_text(r'''import fs from "node:fs";

const errors = [];
const index = fs.readFileSync("index.html", "utf8");
const app = fs.readFileSync("js/app.js", "utf8");
const css = fs.readFileSync("css/style.css", "utf8");
const headers = fs.readFileSync("_headers", "utf8");

function check(condition, message) {
  if (!condition) errors.push(message);
}

check(!index.includes("fonts.googleapis.com") && !index.includes("fonts.gstatic.com"), "initial HTML must not depend on Google Fonts");
check(!css.includes('"Mulish"') && !css.includes('"Source Serif Pro"'), "CSS must use local/system font stacks");

const scriptTags = [...index.matchAll(/<script\s+([^>]*?)src="([^"]+)"([^>]*)><\/script>/g)].map((m) => ({ attrs: `${m[1]} ${m[3]}`, src: m[2] }));
const startupScripts = scriptTags.map((s) => s.src);
const expectedStartup = ["js/progress.js", "js/router.js", "js/app.js"];
check(JSON.stringify(startupScripts) === JSON.stringify(expectedStartup), `startup scripts must be exactly ${expectedStartup.join(", ")}`);
check(scriptTags.every((s) => /\bdefer\b/.test(s.attrs)), "all startup scripts must use defer");
for (const heavy of ["js/content-renderer.js", "js/question-engine.js", "js/memorisation-engine.js"]) {
  check(!startupScripts.includes(heavy), `${heavy} must remain route-lazy`);
}

check(app.includes("function loadScriptCached(src)"), "App must cache route-only script requests");
check(app.includes("function loadUIModules(names = [])"), "App must expose route UI module loading");
check(app.includes('content: "js/content-renderer.js"'), "content renderer must be dynamically mapped");
check(app.includes('questions: "js/question-engine.js"'), "question engine must be dynamically mapped");
check(app.includes('memorisation: "js/memorisation-engine.js"'), "memorisation engine must be dynamically mapped");
check(app.includes('loadUIModules(["content"])'), "cross-unit overview must load content UI on demand");
check(app.includes('loadUIModules(["questions"])'), "cross-unit retry must load question UI on demand");
check(app.includes('uiModules: ["memorisation"]'), "memorisation route must load its engine on demand");
check(app.includes('uiModules: ["questions"]'), "quiz routes must load question engine on demand");
check(app.includes('uiModules: ["content"]'), "content routes must load content renderer on demand");

check(headers.includes("rel=preload; as=style"), "Cloudflare Early Hints must preload the stylesheet");
for (const src of expectedStartup) check(headers.includes(`<\/${src}>`) || headers.includes(`<${src.startsWith('/') ? src : '/' + src}>`), `_headers must hint ${src}`);
check(!/Cache-Control:\s*[^\n]*max-age=(?:[1-9]\d{4,}|31536000)/i.test(headers), "do not apply aggressive browser caching to unversioned CSS/JS/data assets");

const eagerBytes = expectedStartup.reduce((sum, file) => sum + fs.statSync(file).size, 0);
const deferredFiles = ["js/content-renderer.js", "js/question-engine.js", "js/memorisation-engine.js"];
const deferredBytes = deferredFiles.reduce((sum, file) => sum + fs.statSync(file).size, 0);
const previousBytes = eagerBytes + deferredBytes;
const reduction = Math.round((1 - eagerBytes / previousBytes) * 1000) / 10;
check(eagerBytes <= 50000, `startup JavaScript budget exceeded: ${eagerBytes} bytes > 50000 bytes`);

if (errors.length) {
  errors.forEach((error) => console.error(`ERROR: ${error}`));
  process.exit(1);
}

console.log(`Initial-load contract validated: ${eagerBytes} raw JS bytes eager, ${deferredBytes} bytes route-lazy (${reduction}% less eager JS than the previous six-script bootstrap), with zero third-party font origins.`);
''')

# Add validator to formal CI.
path = Path(".github/workflows/validate-content.yml")
text = path.read_text()
text = replace_once(
    text,
    '    name: JavaScript, content, accessibility, loading, learning flows and route safety\n',
    '    name: JavaScript, content, accessibility, loading, learning flows, route safety and performance\n',
    "CI job name"
)
text = text.rstrip() + '''\n\n      - name: Validate initial-load performance contract\n        run: node scripts/validate-performance.mjs\n'''
path.write_text(text)
