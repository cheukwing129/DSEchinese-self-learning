import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { webkit, devices } from "playwright";

const root = process.cwd();
const PORT = 4174;
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

function isKnownWebKitGTKConsoleNoise(message) {
  return /^Button failed to load, iconName = invalid-placard, layoutTraits = \[AdwaitaLayoutTraits Inline\], src = data:image\/png;base64,$/.test(message);
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

function pathname(url) {
  try { return new URL(url).pathname; } catch { return url; }
}

async function waitForTitle(page, text) {
  await page.locator(".page-title", { hasText: text }).waitFor({ state: "visible", timeout: 6000 });
  await page.locator(".loading-state").waitFor({ state: "detached", timeout: 4000 }).catch(() => {});
}

async function checkMobileLayout(page, label) {
  const layout = await page.evaluate(() => ({
    viewport: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body?.scrollWidth || 0
  }));
  const overflow = Math.max(layout.documentWidth, layout.bodyWidth) - layout.viewport;
  check(overflow <= 1, `${label} has horizontal overflow of ${overflow}px in iPhone WebKit`);
}

await listen();
let browser;
try {
  browser = await webkit.launch({ headless: true });
  const context = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await context.newPage();

  page.on("requestfailed", (req) => fail(`request failed: ${req.method()} ${req.url()} (${req.failure()?.errorText || "unknown"})`));
  page.on("pageerror", (err) => fail(`page runtime error: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (isKnownWebKitGTKConsoleNoise(text)) {
      console.log(`Ignoring known WebKitGTK browser chrome noise: ${text}`);
      return;
    }
    fail(`console error: ${text}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && pathname(response.url()) !== "/favicon.ico") {
      fail(`HTTP ${response.status()}: ${response.url()}`);
    }
  });

  await page.goto(`${baseURL}/#/`, { waitUntil: "domcontentloaded", timeout: 15000 });
  await waitForTitle(page, "讀懂經典");
  check(await page.locator(".map-card").count() === 16, "WebKit home should render 16 curriculum cards");
  check(await page.locator(".brand-mark-image").count() === 1, "WebKit home should render the Wenmai brand mark");
  await checkMobileLayout(page, "home");

  await page.evaluate(() => { window.location.hash = "#/unit/yueyanglouji/text"; });
  await waitForTitle(page, "原文與誦讀");
  await page.locator(".reader-shell").waitFor({ state: "visible", timeout: 5000 });
  check(await page.locator(".reader-nav [role=\"tab\"]").count() === 5, "WebKit reader should expose five paragraph tabs");
  const firstLabel = await page.locator("#reader-section-title").textContent();
  await page.locator("#reader-next-btn").click();
  const secondLabel = await page.locator("#reader-section-title").textContent();
  check(firstLabel !== secondLabel, "WebKit reader next control should advance the section");
  await page.locator(".reader-nav [role=\"tab\"]").first().click();
  const term = page.locator("button.term").first();
  await term.waitFor({ state: "visible", timeout: 5000 });
  await term.click();
  await page.locator('.annotation-popover[role="dialog"]').waitFor({ state: "visible", timeout: 3000 });
  await page.keyboard.press("Escape");
  check(await term.evaluate((el) => document.activeElement === el), "WebKit annotation dismissal should restore trigger focus");
  await checkMobileLayout(page, "reader");

  await page.evaluate(() => { window.location.hash = "#/unit/yueyanglouji/words"; });
  await waitForTitle(page, "字詞與句式");
  await page.locator("#word-filter").fill("謫守");
  check(await page.locator("[data-word-card]:visible").count() >= 1, "WebKit word filtering should reveal a matching card");
  await page.locator("#word-filter").fill("");
  await checkMobileLayout(page, "words study");

  await page.evaluate(() => { window.location.hash = "#/unit/yueyanglouji/words/quiz"; });
  await page.locator(".q-stem").first().waitFor({ state: "visible", timeout: 6000 });
  await page.locator("#submit-btn").click();
  await page.locator("#reveal-slot .reveal-panel").waitFor({ state: "visible", timeout: 4000 });
  const savedProgress = await page.evaluate(() => localStorage.getItem("ccsl_progress_v1"));
  check(!!savedProgress, "WebKit quiz submission should persist local progress");
  await checkMobileLayout(page, "quiz");

  await page.evaluate(() => { window.location.hash = "#/unit/yueyanglouji/memorisation"; });
  await waitForTitle(page, "背誦精華");
  await page.locator('[data-tab="cloze"]').click();
  await page.locator("#cloze-check-btn").waitFor({ state: "visible", timeout: 4000 });
  await checkMobileLayout(page, "memorisation");

  await page.evaluate(() => { window.location.hash = "#/overview"; });
  await page.locator(".overview-hero").waitFor({ state: "visible", timeout: 6000 });
  check(await page.locator(".priority-stack").count() === 1, "WebKit overview should render priority learning actions");
  await checkMobileLayout(page, "overview");

  await page.evaluate(() => { window.location.hash = "#/not-a-real-route"; });
  await page.locator(".launch-state.is-not-found").waitFor({ state: "visible", timeout: 4000 });
  await checkMobileLayout(page, "not-found state");

  await context.close();
} finally {
  if (browser) await browser.close();
  await closeServer();
}

if (errors.length) {
  console.error(`WebKit iPhone smoke failed with ${errors.length} error(s).`);
  process.exit(1);
}

console.log("WebKit iPhone smoke passed. Core student routes, interactions, persistence and mobile layout are healthy in the Safari engine.");
