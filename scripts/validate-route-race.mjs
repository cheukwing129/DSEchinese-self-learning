import fs from "node:fs";
import vm from "node:vm";

const routerSource = fs.readFileSync("js/router.js", "utf8");
const appSource = fs.readFileSync("js/app.js", "utf8");
const errors = [];

function check(condition, message) {
  if (!condition) errors.push(message);
}

check(routerSource.includes("let navigationId = 0"), "router must keep a monotonic navigation generation");
check(routerSource.includes("navigationId += 1"), "every route resolve must advance navigation generation");
check(routerSource.includes("function currentNavigationId()"), "router must expose current navigation generation");
check(routerSource.includes("function isCurrentNavigation(id)"), "router must expose stale-navigation checks");
check(routerSource.includes("currentNavigationId, isCurrentNavigation"), "navigation helpers must be exported");

const captureCount = (appSource.match(/Router\.currentNavigationId\(\)/g) || []).length;
const guardCount = (appSource.match(/Router\.isCurrentNavigation\(navigationId\)/g) || []).length;
check(captureCount >= 4, "all async route families must capture their navigation generation");
check(guardCount >= 8, "async success and error paths must reject stale navigation generations");

const unitStart = appSource.indexOf("async function withUnitBundle");
const unitEnd = appSource.indexOf("async function pageUnitHome", unitStart);
const unitBlock = unitStart >= 0 && unitEnd > unitStart ? appSource.slice(unitStart, unitEnd) : "";
const guardPos = unitBlock.indexOf("if (!Router.isCurrentNavigation(navigationId)) return;");
const crumbPos = unitBlock.indexOf("setCrumb(`《${bundle.unit.title}》`)");
const visitPos = unitBlock.indexOf("Progress.recordLearningVisit");
const readyPos = unitBlock.indexOf("onReady(bundle)");
check(guardPos >= 0 && crumbPos > guardPos && visitPos > crumbPos && readyPos > visitPos,
  "unit routes must reject stale loads before breadcrumb, visit persistence, and rendering");

for (const functionName of ["pageHome", "pageOverview", "pageCrossUnitRetry"]) {
  const start = appSource.indexOf(`async function ${functionName}`);
  const next = appSource.indexOf("\n  async function ", start + 1);
  const block = start >= 0 ? appSource.slice(start, next > start ? next : appSource.length) : "";
  check(block.includes("const navigationId = Router.currentNavigationId();"), `${functionName} must capture navigation generation`);
  check(block.includes("if (!Router.isCurrentNavigation(navigationId)) return;"), `${functionName} must suppress stale completion/error rendering`);
}

// Dynamic race simulation: a slow route starts first, a fast route becomes current,
// then the slow work finishes. The stale route must not be allowed to commit.
const listeners = {};
const window = {
  location: { hash: "#/slow" },
  addEventListener(type, handler) { listeners[type] = handler; },
  scrollTo() {}
};
const App = {
  renderFatalError(message) { throw new Error(`unexpected fatal render: ${message}`); },
  renderNotFound(path) { throw new Error(`unexpected not-found render: ${path}`); }
};
const context = vm.createContext({ console, window, App, URLSearchParams, decodeURIComponent });
vm.runInContext(routerSource, context);
const Router = vm.runInContext("Router", context);

let releaseSlow;
const slowGate = new Promise((resolve) => { releaseSlow = resolve; });
let committed = "none";
let slowGeneration = null;
Router.register("/slow", async () => {
  slowGeneration = Router.currentNavigationId();
  await slowGate;
  if (Router.isCurrentNavigation(slowGeneration)) committed = "slow";
});
Router.register("/fast", () => {
  committed = "fast";
});

Router.start();
check(slowGeneration === 1, "first route should receive navigation generation 1");
window.location.hash = "#/fast";
listeners.hashchange();
check(committed === "fast", "newer fast route should render immediately");
check(Router.currentNavigationId() === 2, "second route should advance navigation generation");
check(!Router.isCurrentNavigation(slowGeneration), "first route generation must become stale after navigation");
releaseSlow();
await Promise.resolve();
await Promise.resolve();
check(committed === "fast", "late completion from stale route must not overwrite newer route");

const beforeSamePath = Router.currentNavigationId();
Router.navigate("/fast");
check(Router.currentNavigationId() === beforeSamePath + 1, "same-path refresh must also invalidate older async work");

if (errors.length) {
  errors.forEach((error) => console.error(`ERROR: ${error}`));
  process.exit(1);
}

console.log("Route race protection validated: stale async loads cannot overwrite newer navigation or persist stale unit visits.");
