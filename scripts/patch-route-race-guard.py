from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 match, found {count}")
    return text.replace(old, new, 1)

# router.js: every resolve gets a monotonically increasing navigation generation.
path = Path("js/router.js")
text = path.read_text()
text = replace_once(
    text,
    '  const routes = []; // { pattern: RegExp, keys: [string], handler: fn }\n',
    '  const routes = []; // { pattern: RegExp, keys: [string], handler: fn }\n  let navigationId = 0;\n',
    'router navigation generation state'
)
text = replace_once(
    text,
    '  function resolve() {\n    const path = currentPath();\n',
    '  function resolve() {\n    const path = currentPath();\n    navigationId += 1;\n',
    'router resolve generation increment'
)
text = replace_once(
    text,
    '  function start() {\n',
    '  function currentNavigationId() {\n    return navigationId;\n  }\n\n  function isCurrentNavigation(id) {\n    return id === navigationId;\n  }\n\n  function start() {\n',
    'router navigation helpers'
)
text = replace_once(
    text,
    '  return { register, navigate, start, currentPath, currentQuery };\n',
    '  return { register, navigate, start, currentPath, currentQuery, currentNavigationId, isCurrentNavigation };\n',
    'router navigation helper exports'
)
path.write_text(text)

# app.js: async route handlers capture their navigation generation and refuse stale commits/errors.
path = Path("js/app.js")
text = path.read_text()
text = replace_once(
    text,
    '  async function pageHome() {\n    setCrumb("");\n',
    '  async function pageHome() {\n    const navigationId = Router.currentNavigationId();\n    setCrumb("");\n',
    'home navigation capture'
)
text = replace_once(
    text,
    '      curriculum = await loadCurriculum();\n    } catch (e) {\n      renderFatalError(e.message);\n      return;\n    }\n    const recent = Progress.latestLearning(curriculum.units);\n',
    '      curriculum = await loadCurriculum();\n      if (!Router.isCurrentNavigation(navigationId)) return;\n    } catch (e) {\n      if (!Router.isCurrentNavigation(navigationId)) return;\n      renderFatalError(e.message);\n      return;\n    }\n    const recent = Progress.latestLearning(curriculum.units);\n',
    'home stale result/error guard'
)
text = replace_once(
    text,
    '  async function pageOverview() {\n    setCrumb("跨篇章學習總覽");\n',
    '  async function pageOverview() {\n    const navigationId = Router.currentNavigationId();\n    setCrumb("跨篇章學習總覽");\n',
    'overview navigation capture'
)
text = replace_once(
    text,
    '      const { curriculum, unitBundles } = await loadCrossUnitBundles();\n      ContentRenderer.renderCrossUnitOverview(curriculum, unitBundles);\n    } catch (e) {\n      renderFatalError(e.message);\n    }\n  }\n\n  async function pageCrossUnitRetry(params) {\n',
    '      const { curriculum, unitBundles } = await loadCrossUnitBundles();\n      if (!Router.isCurrentNavigation(navigationId)) return;\n      ContentRenderer.renderCrossUnitOverview(curriculum, unitBundles);\n    } catch (e) {\n      if (!Router.isCurrentNavigation(navigationId)) return;\n      renderFatalError(e.message);\n    }\n  }\n\n  async function pageCrossUnitRetry(params) {\n',
    'overview stale result/error guard'
)
text = replace_once(
    text,
    '  async function pageCrossUnitRetry(params) {\n    const ability = params.ability === "all" ? null : params.ability;\n',
    '  async function pageCrossUnitRetry(params) {\n    const navigationId = Router.currentNavigationId();\n    const ability = params.ability === "all" ? null : params.ability;\n',
    'targeted retry navigation capture'
)
text = replace_once(
    text,
    '      const { unitBundles } = await loadCrossUnitBundles();\n      QuestionEngine.renderCrossUnitWrongRetry(unitBundles, ability);\n    } catch (e) {\n      renderFatalError(e.message);\n    }\n  }\n\n  async function withUnitBundle(unitId, options, onReady) {\n',
    '      const { unitBundles } = await loadCrossUnitBundles();\n      if (!Router.isCurrentNavigation(navigationId)) return;\n      QuestionEngine.renderCrossUnitWrongRetry(unitBundles, ability);\n    } catch (e) {\n      if (!Router.isCurrentNavigation(navigationId)) return;\n      renderFatalError(e.message);\n    }\n  }\n\n  async function withUnitBundle(unitId, options, onReady) {\n',
    'targeted retry stale result/error guard'
)
text = replace_once(
    text,
    '  async function withUnitBundle(unitId, options, onReady) {\n    if (typeof options === "function") {\n',
    '  async function withUnitBundle(unitId, options, onReady) {\n    const navigationId = Router.currentNavigationId();\n    if (typeof options === "function") {\n',
    'unit bundle navigation capture'
)
text = replace_once(
    text,
    '    try {\n      bundle = await loadUnitBundle(unitId, options || {});\n    } catch (e) {\n      renderFatalError(e.message);\n      return;\n    }\n    setCrumb(`《${bundle.unit.title}》`);\n',
    '    try {\n      bundle = await loadUnitBundle(unitId, options || {});\n      if (!Router.isCurrentNavigation(navigationId)) return;\n    } catch (e) {\n      if (!Router.isCurrentNavigation(navigationId)) return;\n      renderFatalError(e.message);\n      return;\n    }\n    setCrumb(`《${bundle.unit.title}》`);\n',
    'unit bundle stale result/error guard'
)
path.write_text(text)

# Loading validator: retain route-specific loading and require race guards around aggregate/unit async paths.
path = Path("scripts/validate-loading.mjs")
text = path.read_text()
needle = 'requireText("async function loadCrossUnitBundles()", "shared on-demand aggregate loader");\n'
insert = needle + 'requireText("Router.currentNavigationId()", "navigation generation capture for async routes");\nrequireText("Router.isCurrentNavigation(navigationId)", "stale async route guard");\n'
text = replace_once(text, needle, insert, 'loading validator route race guards')
path.write_text(text)
