from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"{label} not found")
    return text.replace(old, new, 1)


app_path = Path("js/app.js")
app = app_path.read_text()
old = '''  let pendingRouteFocus = false;
  let ignoreNextHashFocus = false;

  const cache = { curriculum: null, json: {}, scripts: {} };
'''
new = '''  let pendingRouteFocus = false, skipInitialHashFocus = !window.location.hash;

  const cache = { curriculum: null, json: {}, scripts: {} };
'''
app = replace_once(app, old, new, "route-focus state")

old = '''  function focusPrimaryContent() {
    const main = mainEl();
    if (!main) return;
    const heading = main.querySelector("h1.page-title, h1");
    const target = heading || main;
    const addedTabIndex = !target.hasAttribute("tabindex");
    if (addedTabIndex) target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
    if (addedTabIndex) {
      target.addEventListener("blur", () => target.removeAttribute("tabindex"), { once: true });
    }
  }

  function mount(html) {
    const main = mainEl();
    main.innerHTML = html;
    if (pendingRouteFocus && !main.querySelector(".loading-state")) {
      pendingRouteFocus = false;
      focusPrimaryContent();
    }
  }

  function bindKeyboardNavigation() {
    const skipLink = document.querySelector(".skip-link");
    if (skipLink) {
      skipLink.addEventListener("click", (event) => {
        event.preventDefault();
        pendingRouteFocus = false;
        const main = mainEl();
        main.focus({ preventScroll: true });
        main.scrollIntoView({ block: "start" });
      });
    }

    ignoreNextHashFocus = !window.location.hash;
    window.addEventListener("hashchange", () => {
      if (ignoreNextHashFocus) {
        ignoreNextHashFocus = false;
        return;
      }
      pendingRouteFocus = true;
    });
  }
'''
new = '''  function mount(html) {
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
'''
app = replace_once(app, old, new, "route-focus implementation")
app_path.write_text(app)

validator_path = Path("scripts/validate-accessibility.mjs")
validator = validator_path.read_text()
validator = replace_once(
    validator,
    'requireMatch("Skip-link hash protection", files.app, /skipLink\\.addEventListener\\("click"[\\s\\S]*?event\\.preventDefault\\(\\)[\\s\\S]*?main\\.focus/);\n',
    'requireMatch("Skip-link hash protection", files.app, /querySelector\\("\\.skip-link"\\)\\.addEventListener\\("click"[\\s\\S]*?event\\.preventDefault\\(\\)[\\s\\S]*?mainEl\\(\\)\\.focus/);\n',
    "skip-link validator",
)
validator = replace_once(
    validator,
    'requireMatch("SPA route focus management", files.app, /pendingRouteFocus[\\s\\S]*?focusPrimaryContent\\(\\)/);\n',
    'requireMatch("SPA route focus management", files.app, /pendingRouteFocus[\\s\\S]*?querySelector\\("h1"\\)[\\s\\S]*?target\\.focus/);\n',
    "route-focus validator",
)
validator_path.write_text(validator)
