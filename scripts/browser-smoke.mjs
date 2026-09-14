import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = process.cwd();
const PORT = 4173;
const HOST = "127.0.0.1";
const baseURL = `http://${HOST}:${PORT}`;
const errors = [];

function fail(message) {
  errors.push(message);
  console.error(`ERROR: ${message}`);
}

function check(condition, message) {
  if (!condition) fail(message);
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return ({
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".mp3": "audio/mpeg"
  })[ext] || "application/octet-stream";
}

function safeFilePath(urlPath) {
  let pathname;
  try {
    pathname = decodeURIComponent(urlPath.split("?")[0]);
  } catch {
    return null;
  }
  if (pathname === "/") pathname = "/index.html";
  if (pathname === "/favicon.ico") return "__favicon__";
  const relative = path.posix.normalize(pathname).replace(/^\/+/, "");
  if (!relative || relative.startsWith("..") || relative.includes("/../")) return null;
  const full = path.join(root, relative);
  if (!full.startsWith(root + path.sep) && full !== root) return null;
  return full;
}

const server = http.createServer((req, res) => {
  const filePath = safeFilePath(req.url || "/");
  if (filePath === "__favicon__") {
    res.writeHead(204, { "Cache-Control": "public, max-age=86400" });
    res.end();
    return;
  }
  if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  const body = fs.readFileSync(filePath);
  const relative = `/${path.relative(root, filePath).split(path.sep).join("/")}`;
  const headers = {
    "Content-Type": contentType(filePath),
    "Content-Length": String(body.length)
  };
  if (relative.startsWith("/assets/build/")) {
    headers["Cache-Control"] = "public, max-age=31536000, immutable";
  } else if (relative === "/index.html" || relative.startsWith("/data/")) {
    headers["Cache-Control"] = "no-cache";
  }
  res.writeHead(200, headers);
  res.end(body);
});

function listen() {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(PORT, HOST, resolve);
  });
}

function closeServer() {
  return new Promise((resolve) => server.close(resolve));
}

async function waitForTitle(page, text) {
  await page.locator(".page-title", { hasText: text }).waitFor({ state: "visible", timeout: 4000 });
  await page.locator(".loading-state").waitFor({ state: "detached", timeout: 4000 }).catch(() => {});
}

async function navigationMetrics(page) {
  return page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    const resources = performance.getEntriesByType("resource").map((r) => ({
      name: r.name,
      initiatorType: r.initiatorType,
      transferSize: r.transferSize,
      encodedBodySize: r.encodedBodySize,
      decodedBodySize: r.decodedBodySize,
      duration: r.duration
    }));
    return {
      domContentLoaded: nav ? nav.domContentLoadedEventEnd : null,
      load: nav ? nav.loadEventEnd : null,
      resources
    };
  });
}

function pathname(url) {
  try { return new URL(url).pathname; } catch { return url; }
}

await listen();
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const requestPaths = [];

  page.on("request", (req) => requestPaths.push(pathname(req.url())));
  page.on("requestfailed", (req) => fail(`request failed: ${req.method()} ${req.url()} (${req.failure()?.errorText || "unknown"})`));
  page.on("pageerror", (err) => fail(`page runtime error: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") fail(`console error: ${msg.text()}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) fail(`HTTP ${response.status()}: ${response.url()}`);
  });

  const coldStart = Date.now();
  await page.goto(`${baseURL}/#/`, { waitUntil: "networkidle", timeout: 10000 });
  await waitForTitle(page, "讀懂經典");
  const homeReadyMs = Date.now() - coldStart;
  const mapCount = await page.locator(".map-card").count();
  check(mapCount === 16, `home should render 16 curriculum cards, got ${mapCount}`);

  const cold = await navigationMetrics(page);
  const coldScripts = cold.resources.filter((r) => r.initiatorType === "script").map((r) => pathname(r.name));
  check(coldScripts.length === 3, `home should request exactly 3 bootstrap scripts, got ${coldScripts.length}: ${coldScripts.join(", ")}`);
  check(coldScripts.every((p) => /^\/assets\/build\/(progress|router|app)\.[0-9a-f]{12}\.js$/.test(p)), `home bootstrap scripts must be fingerprinted progress/router/app assets: ${coldScripts.join(", ")}`);
  for (const heavy of ["content-renderer", "question-engine", "memorisation-engine"]) {
    check(!coldScripts.some((p) => p.includes(heavy)), `${heavy} must not load on the home route`);
  }
  const eagerJsEncoded = cold.resources
    .filter((r) => r.initiatorType === "script" && coldScripts.includes(pathname(r.name)))
    .reduce((sum, r) => sum + r.encodedBodySize, 0);
  check(eagerJsEncoded <= 50000, `browser-observed eager JavaScript budget exceeded: ${eagerJsEncoded} bytes > 50000`);
  check((cold.domContentLoaded ?? Infinity) <= 2500, `DOMContentLoaded too slow on local smoke server: ${cold.domContentLoaded}ms > 2500ms`);
  check((cold.load ?? Infinity) <= 3000, `load event too slow on local smoke server: ${cold.load}ms > 3000ms`);
  check(homeReadyMs <= 4000, `home did not become visibly ready within 4000ms (took ${homeReadyMs}ms)`);

  await page.reload({ waitUntil: "networkidle", timeout: 10000 });
  await waitForTitle(page, "讀懂經典");
  const warm = await navigationMetrics(page);
  const warmVersioned = warm.resources.filter((r) => pathname(r.name).startsWith("/assets/build/"));
  const warmTransferred = warmVersioned.reduce((sum, r) => sum + r.transferSize, 0);
  check(warmTransferred <= 5000, `fingerprinted CSS/JS should be served from browser cache on warm reload; transferred ${warmTransferred} bytes`);

  await page.evaluate(() => { window.location.hash = "#/unit/yueyanglouji"; });
  await waitForTitle(page, "《岳陽樓記》");
  check(requestPaths.filter((p) => /\/content-renderer\.[0-9a-f]{12}\.js$/.test(p)).length === 1, "content renderer should load exactly once when first entering a content route");

  await page.evaluate(() => { window.location.hash = "#/unit/yueyanglouji/text"; });
  await waitForTitle(page, "原文與誦讀");
  const term = page.locator("button.term").first();
  await term.waitFor({ state: "visible", timeout: 4000 });
  await term.click();
  await page.locator('.annotation-popover[role="dialog"]').waitFor({ state: "visible", timeout: 2000 });
  await page.keyboard.press("Escape");
  check(await term.evaluate((el) => document.activeElement === el), "closing an annotation with Escape should restore focus to the triggering term");
  check(requestPaths.filter((p) => /\/content-renderer\.[0-9a-f]{12}\.js$/.test(p)).length === 1, "content renderer should stay single-loaded across content routes");

  await page.evaluate(() => { window.location.hash = "#/unit/yueyanglouji/words/quiz"; });
  await page.locator(".q-stem").first().waitFor({ state: "visible", timeout: 5000 });
  check(requestPaths.filter((p) => /\/question-engine\.[0-9a-f]{12}\.js$/.test(p)).length === 1, "question engine should load exactly once when first entering a quiz route");
  const submit = page.locator("#submit-btn");
  await submit.waitFor({ state: "visible", timeout: 2000 });
  await submit.click();
  await page.locator("#reveal-slot .reveal-panel").waitFor({ state: "visible", timeout: 2000 });
  const savedProgress = await page.evaluate(() => localStorage.getItem("ccsl_progress_v1"));
  check(!!savedProgress, "submitting a real browser quiz answer should persist local progress");

  await page.evaluate(() => { window.location.hash = "#/unit/yueyanglouji/progress"; });
  await waitForTitle(page, "待修正");
  check(await page.locator(".unit-progress-hero").count() === 1, "unit progress should render the learning-decision hero");
  check(await page.locator(".evidence-strip").count() === 1, "unit progress should render an evidence summary strip");

  await page.evaluate(() => { window.location.hash = "#/overview"; });
  await page.locator(".overview-hero").waitFor({ state: "visible", timeout: 5000 });
  check(await page.locator(".priority-stack").count() === 1, "cross-unit overview should render priority learning actions");

  await page.evaluate(() => { window.location.hash = "#/unit/yueyanglouji/memorisation"; });
  await waitForTitle(page, "背誦精華");
  check(requestPaths.filter((p) => /\/memorisation-engine\.[0-9a-f]{12}\.js$/.test(p)).length === 1, "memorisation engine should load exactly once when first entering memorisation");
  await page.locator('[data-tab="cloze"]').click();
  await page.locator("#cloze-check-btn").waitFor({ state: "visible", timeout: 3000 });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { window.location.hash = "#/"; });
  await waitForTitle(page, "讀懂經典");
  const homeOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(homeOverflow <= 1, `mobile home has horizontal overflow of ${homeOverflow}px`);
  await page.evaluate(() => { window.location.hash = "#/unit/yueyanglouji/words/quiz"; });
  await page.locator(".q-stem").first().waitFor({ state: "visible", timeout: 5000 });
  const quizOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(quizOverflow <= 1, `mobile quiz has horizontal overflow of ${quizOverflow}px`);
  await page.evaluate(() => { window.location.hash = "#/unit/yueyanglouji/progress"; });
  await page.locator(".unit-progress-hero").waitFor({ state: "visible", timeout: 5000 });
  const progressOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(progressOverflow <= 1, `mobile unit progress has horizontal overflow of ${progressOverflow}px`);
  await page.evaluate(() => { window.location.hash = "#/overview"; });
  await page.locator(".overview-hero").waitFor({ state: "visible", timeout: 5000 });
  const overviewOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(overviewOverflow <= 1, `mobile cross-unit overview has horizontal overflow of ${overviewOverflow}px`);

  console.log(`Browser smoke metrics: home ready ${homeReadyMs}ms; DOMContentLoaded ${Math.round(cold.domContentLoaded || 0)}ms; load ${Math.round(cold.load || 0)}ms; eager JS ${eagerJsEncoded} encoded bytes; warm fingerprinted transfer ${warmTransferred} bytes.`);
  console.log(`Browser smoke routes passed: home → unit → text annotation → quiz submit → memorisation cloze; mobile overflow checks passed.`);

  await context.close();
} finally {
  if (browser) await browser.close();
  await closeServer();
}

if (errors.length) {
  console.error(`Browser smoke failed with ${errors.length} error(s).`);
  process.exit(1);
}

console.log("Real-browser smoke and performance contract passed.");
