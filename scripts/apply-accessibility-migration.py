from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"{label} not found")
    return text.replace(old, new, 1)


app_path = Path("js/app.js")
app = app_path.read_text()
app = replace_once(
    app,
    '  const crumbEl = () => document.getElementById("header-crumb");\n',
    '  const crumbEl = () => document.getElementById("header-crumb");\n'
    '  let pendingRouteFocus = false;\n'
    '  let ignoreNextHashFocus = false;\n',
    "app header insertion point",
)
app = replace_once(
    app,
    '  function mount(html) {\n'
    '    mainEl().innerHTML = html;\n'
    '  }\n',
    '  function focusPrimaryContent() {\n'
    '    const main = mainEl();\n'
    '    if (!main) return;\n'
    '    const heading = main.querySelector("h1.page-title, h1");\n'
    '    const target = heading || main;\n'
    '    const addedTabIndex = !target.hasAttribute("tabindex");\n'
    '    if (addedTabIndex) target.setAttribute("tabindex", "-1");\n'
    '    target.focus({ preventScroll: true });\n'
    '    if (addedTabIndex) {\n'
    '      target.addEventListener("blur", () => target.removeAttribute("tabindex"), { once: true });\n'
    '    }\n'
    '  }\n\n'
    '  function mount(html) {\n'
    '    const main = mainEl();\n'
    '    main.innerHTML = html;\n'
    '    if (pendingRouteFocus && !main.querySelector(".loading-state")) {\n'
    '      pendingRouteFocus = false;\n'
    '      focusPrimaryContent();\n'
    '    }\n'
    '  }\n\n'
    '  function bindKeyboardNavigation() {\n'
    '    const skipLink = document.querySelector(".skip-link");\n'
    '    if (skipLink) {\n'
    '      skipLink.addEventListener("click", (event) => {\n'
    '        event.preventDefault();\n'
    '        pendingRouteFocus = false;\n'
    '        const main = mainEl();\n'
    '        main.focus({ preventScroll: true });\n'
    '        main.scrollIntoView({ block: "start" });\n'
    '      });\n'
    '    }\n\n'
    '    ignoreNextHashFocus = !window.location.hash;\n'
    '    window.addEventListener("hashchange", () => {\n'
    '      if (ignoreNextHashFocus) {\n'
    '        ignoreNextHashFocus = false;\n'
    '        return;\n'
    '      }\n'
    '      pendingRouteFocus = true;\n'
    '    });\n'
    '  }\n',
    "app mount block",
)
app = replace_once(
    app,
    '  function init() {\n'
    '    registerRoutes();\n'
    '    Router.start();\n'
    '  }\n',
    '  function init() {\n'
    '    bindKeyboardNavigation();\n'
    '    registerRoutes();\n'
    '    Router.start();\n'
    '  }\n',
    "app init block",
)
app_path.write_text(app)

content_path = Path("js/content-renderer.js")
content = content_path.read_text()
content = replace_once(
    content,
    'aria-selected="${i === activeIndex ? "true" : "false"}" data-idx="${i}" class="${i === activeIndex ? "is-active" : ""}"',
    'aria-selected="${i === activeIndex ? "true" : "false"}" tabindex="${i === activeIndex ? "0" : "-1"}" data-idx="${i}" class="${i === activeIndex ? "is-active" : ""}"',
    "reader tab markup",
)
content = replace_once(
    content,
    '      document.querySelectorAll(".reader-nav button").forEach((btn) => {\n'
    '        btn.addEventListener("click", () => setActive(parseInt(btn.dataset.idx, 10)));\n'
    '      });\n',
    '      const activateTab = (index) => {\n'
    '        setActive(index);\n'
    '        const tab = document.getElementById(`reader-tab-${index}`);\n'
    '        if (tab) tab.focus({ preventScroll: true });\n'
    '      };\n'
    '      document.querySelectorAll(".reader-nav button").forEach((btn) => {\n'
    '        btn.addEventListener("click", () => activateTab(parseInt(btn.dataset.idx, 10)));\n'
    '        btn.addEventListener("keydown", (event) => {\n'
    '          const current = parseInt(btn.dataset.idx, 10);\n'
    '          let nextIndex = null;\n'
    '          if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = (current + 1) % groups.length;\n'
    '          else if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = (current - 1 + groups.length) % groups.length;\n'
    '          else if (event.key === "Home") nextIndex = 0;\n'
    '          else if (event.key === "End") nextIndex = groups.length - 1;\n'
    '          if (nextIndex == null) return;\n'
    '          event.preventDefault();\n'
    '          activateTab(nextIndex);\n'
    '        });\n'
    '      });\n',
    "reader tab event block",
)
content_path.write_text(content)

validator_path = Path("scripts/validate-accessibility.mjs")
validator = validator_path.read_text()
validator = replace_once(
    validator,
    'const files = {\n  questions:',
    'const files = {\n  app: fs.readFileSync("js/app.js", "utf8"),\n  questions:',
    "accessibility files map",
)
marker = 'requireMatch("Mobile header touch target", files.index, /@media\\s*\\(max-width:\\s*600px\\)\\s*\\{\\s*\\.header-nav-link\\s*\\{\\s*min-height:\\s*44px/s);'
validator = replace_once(
    validator,
    marker,
    marker
    + '\nrequireMatch("Skip-link hash protection", files.app, /skipLink\\.addEventListener\\("click"[\\s\\S]*?event\\.preventDefault\\(\\)[\\s\\S]*?main\\.focus/);'
    + '\nrequireMatch("SPA route focus management", files.app, /pendingRouteFocus[\\s\\S]*?focusPrimaryContent\\(\\)/);'
    + '\nrequireMatch("Reader roving tab stop", files.content, /role=\\"tab\\"[\\s\\S]*?tabindex=\\"\\$\\{i === activeIndex \\? \\"0\\" : \\"-1\\"\\}\\"/);'
    + '\nrequireMatch("Reader arrow-key tabs", files.content, /ArrowRight[\\s\\S]*?ArrowLeft[\\s\\S]*?Home[\\s\\S]*?End/);',
    "accessibility validator insertion point",
)
validator_path.write_text(validator)
