import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";

const root = process.cwd();
const HOST = "127.0.0.1";
const PORT = 4176;
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
    pathname = decodeURIComponent(String(urlPath || "/").split("?")[0]);
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
  const filePath = safeFilePath(req.url);
  if (filePath === "__favicon__") {
    res.writeHead(204);
    res.end();
    return;
  }
  if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }
  const body = fs.readFileSync(filePath);
  res.writeHead(200, {
    "Content-Type": contentType(filePath),
    "Content-Length": String(body.length),
    "Cache-Control": "no-store"
  });
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

async function activeState(page) {
  return page.evaluate(() => {
    const el = document.activeElement;
    return {
      tag: el?.tagName || "",
      id: el?.id || "",
      className: typeof el?.className === "string" ? el.className : "",
      role: el?.getAttribute?.("role") || "",
      dataIdx: el?.dataset?.idx ?? null,
      dataAnno: el?.dataset?.anno ?? null,
      dataKey: el?.dataset?.key ?? null
    };
  });
}

async function waitReady(page, selector, timeout = 10000) {
  await page.locator(selector).first().waitFor({ state: "visible", timeout });
  await page.locator("#app-main .loading-state").waitFor({ state: "detached", timeout }).catch(() => {});
}

await listen();
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  page.on("pageerror", (err) => fail(`runtime error: ${err.message}`));
  page.on("requestfailed", (req) => fail(`request failed: ${req.method()} ${req.url()} (${req.failure()?.errorText || "unknown"})`));
  page.on("response", (response) => {
    if (response.status() >= 400) fail(`HTTP ${response.status()}: ${response.url()}`);
  });

  await page.goto(`${baseURL}/#/`, { waitUntil: "domcontentloaded", timeout: 12000 });
  await waitReady(page, ".map-grid");

  // Skip link must be the first keyboard stop and must not collide with the
  // hash router when activated.
  await page.keyboard.press("Tab");
  let active = await activeState(page);
  check(active.className.split(/\s+/).includes("skip-link"), "first Tab should focus the skip link");
  const skipBox = await page.locator(".skip-link").boundingBox();
  check(Boolean(skipBox && skipBox.y >= 0), "skip link should become visibly positioned when keyboard-focused");
  const hashBeforeSkip = await page.evaluate(() => window.location.hash);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(40);
  const hashAfterSkip = await page.evaluate(() => window.location.hash);
  active = await activeState(page);
  check(hashAfterSkip === hashBeforeSkip, `skip link must preserve SPA route hash (${hashBeforeSkip} -> ${hashAfterSkip})`);
  check(active.id === "app-main", "skip link should move keyboard focus to #app-main");

  // Keyboard-activated SPA links should announce the destination by moving
  // focus to the newly rendered page heading after async data loading.
  const unitLink = page.locator('a[href="#/unit/yueyanglouji"]').first();
  await unitLink.focus();
  await page.keyboard.press("Enter");
  await waitReady(page, ".unit-hero");
  active = await activeState(page);
  check(active.tag === "H1" && active.className.includes("page-title"), "unit route should focus its H1 after keyboard navigation");

  const readerLink = page.locator('a[href="#/unit/yueyanglouji/text"]').first();
  await readerLink.focus();
  await page.keyboard.press("Enter");
  await waitReady(page, ".reader-shell");
  active = await activeState(page);
  check(active.tag === "H1" && active.className.includes("reader-page-title"), "reader route should focus its H1 after keyboard navigation");

  // ARIA tablist contract: one tab stop, arrow-key activation/focus, Home/End.
  const tabs = page.locator('.reader-nav [role="tab"]');
  const tabCount = await tabs.count();
  check(tabCount >= 2, "reader should expose at least two paragraph tabs for keyboard testing");
  const zeroTabStops = await tabs.evaluateAll((nodes) => nodes.filter((node) => node.tabIndex === 0).length);
  check(zeroTabStops === 1, `reader tablist should have exactly one tabindex=0 tab, got ${zeroTabStops}`);
  await tabs.first().focus();
  await page.keyboard.press("ArrowRight");
  active = await activeState(page);
  check(active.id === "reader-tab-1", `ArrowRight should focus reader-tab-1, got ${active.id || active.tag}`);
  check(await page.locator("#reader-tab-1").getAttribute("aria-selected") === "true", "ArrowRight should activate the next reader tab");
  check(await page.locator("#reader-tab-0").getAttribute("tabindex") === "-1", "inactive reader tab should leave the Tab sequence");

  await page.keyboard.press("End");
  active = await activeState(page);
  check(active.id === `reader-tab-${tabCount - 1}`, "End should move to the final reader tab");
  await page.keyboard.press("Home");
  active = await activeState(page);
  check(active.id === "reader-tab-0", "Home should return to the first reader tab");

  // Annotation dialog must receive focus and Escape must restore the exact
  // trigger button, not leave focus on a detached dialog node.
  const term = page.locator("button.term").first();
  check(await term.count() === 1, "reader should expose an annotation term button");
  const annotationId = await term.getAttribute("data-anno");
  await term.focus();
  await page.keyboard.press("Enter");
  await page.locator('.annotation-popover[role="dialog"]').waitFor({ state: "visible", timeout: 3000 });
  active = await activeState(page);
  check(active.role === "dialog" && active.className.includes("annotation-popover"), "opening an annotation should focus its dialog");
  await page.keyboard.press("Escape");
  await page.locator(".annotation-popover").waitFor({ state: "detached", timeout: 3000 });
  active = await activeState(page);
  check(active.dataAnno === annotationId, "Escape should restore focus to the annotation trigger");

  // Direct hash navigation models browser back/forward and should also focus
  // the destination heading. Native button keyboard activation must survive
  // the quiz engine repaint and retain focus on the selected answer.
  await page.evaluate(() => { window.location.hash = "#/unit/yueyanglouji/words/quiz?qi=0"; });
  await waitReady(page, ".quiz-shell .q-stem");
  active = await activeState(page);
  check(active.tag === "H1" && active.className.includes("page-title"), "hash route change should focus the quiz H1");

  const option = page.locator('[data-role="option-main"]').first();
  check(await option.getAttribute("role") === "radio", "single-choice option should expose radio semantics");
  const optionKey = await option.getAttribute("data-key");
  await option.focus();
  await page.keyboard.press("Space");
  const selected = page.locator(`[data-role="option-main"][data-key="${optionKey}"]`);
  check(await selected.getAttribute("aria-checked") === "true", "Space should select the focused single-choice answer");
  active = await activeState(page);
  check(active.dataKey === optionKey, "quiz repaint should restore keyboard focus to the selected answer");

  await context.close();
} finally {
  if (browser) await browser.close();
  await closeServer();
}

if (errors.length) {
  console.error(`Browser accessibility contract failed with ${errors.length} error(s).`);
  process.exit(1);
}

console.log("Browser accessibility contract passed: skip navigation, SPA route focus, reader tab keyboard model, annotation focus restoration and quiz keyboard selection are intact.");
