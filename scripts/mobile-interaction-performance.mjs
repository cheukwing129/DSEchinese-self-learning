import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";

const root = process.cwd();
const HOST = "127.0.0.1";
const PORT = 4178;
const baseURL = `http://${HOST}:${PORT}`;
const errors = [];

const PROFILE = {
  cpuSlowdown: 4,
  latencyMs: 150,
  downloadMbps: 1.6,
  uploadMbps: 0.75,
  viewport: { width: 390, height: 844 }
};

const BUDGETS = {
  readerTabMs: 600,
  annotationOpenMs: 600,
  annotationCloseMs: 600,
  warmRouteMs: 700,
  optionSelectMs: 600,
  submitMs: 800,
  nextQuestionMs: 700
};

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

async function configure(context, page) {
  const session = await context.newCDPSession(page);
  await session.send("Network.enable");
  await session.send("Network.setCacheDisabled", { cacheDisabled: true });
  await session.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: PROFILE.latencyMs,
    downloadThroughput: (PROFILE.downloadMbps * 1000 * 1000) / 8,
    uploadThroughput: (PROFILE.uploadMbps * 1000 * 1000) / 8,
    connectionType: "cellular3g"
  });
  await session.send("Emulation.setCPUThrottlingRate", { rate: PROFILE.cpuSlowdown });
  return session;
}

async function waitVisible(page, selector, timeout = 12000) {
  await page.locator(selector).first().waitFor({ state: "visible", timeout });
}

async function elapsed(action, ready) {
  const start = Date.now();
  await action();
  await ready();
  return Date.now() - start;
}

await listen();
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: PROFILE.viewport });
  const page = await context.newPage();
  const session = await configure(context, page);

  page.on("pageerror", (err) => fail(`runtime error: ${err.message}`));
  page.on("requestfailed", (req) => fail(`request failed: ${req.method()} ${req.url()} (${req.failure()?.errorText || "unknown"})`));
  page.on("response", (response) => {
    if (response.status() >= 400) fail(`HTTP ${response.status()}: ${response.url()}`);
  });

  await page.goto(`${baseURL}/#/unit/yueyanglouji/text`, { waitUntil: "domcontentloaded", timeout: 15000 });
  await waitVisible(page, ".reader-shell");

  const tabs = page.locator('.reader-nav [role="tab"]');
  check(await tabs.count() >= 2, "reader needs at least two tabs for interaction timing");
  const readerTabMs = await elapsed(
    () => tabs.nth(1).click(),
    () => page.waitForFunction(() => document.querySelector('#reader-tab-1')?.getAttribute('aria-selected') === 'true')
  );
  check(readerTabMs <= BUDGETS.readerTabMs, `reader tab interaction ${readerTabMs}ms > ${BUDGETS.readerTabMs}ms`);

  const term = page.locator("button.term").first();
  check(await term.count() === 1, "reader needs an annotation term for interaction timing");
  const annotationOpenMs = await elapsed(
    () => term.click(),
    () => waitVisible(page, '.annotation-popover[role="dialog"]', 3000)
  );
  check(annotationOpenMs <= BUDGETS.annotationOpenMs, `annotation open ${annotationOpenMs}ms > ${BUDGETS.annotationOpenMs}ms`);

  const annotationCloseMs = await elapsed(
    () => page.keyboard.press("Escape"),
    () => page.locator(".annotation-popover").waitFor({ state: "detached", timeout: 3000 })
  );
  check(annotationCloseMs <= BUDGETS.annotationCloseMs, `annotation close ${annotationCloseMs}ms > ${BUDGETS.annotationCloseMs}ms`);

  // Prime the study route and then return to the reader so the following
  // transition uses App's in-memory JSON/script/style caches. Fast warm routes
  // should not blank the screen with a transient loading state.
  await page.evaluate(() => { window.location.hash = "#/unit/yueyanglouji/words"; });
  await page.locator("#study-page-title", { hasText: "字詞與句式" }).waitFor({ state: "visible", timeout: 12000 });
  await page.evaluate(() => { window.location.hash = "#/unit/yueyanglouji/text"; });
  await waitVisible(page, ".reader-shell");
  await page.evaluate(() => {
    window.__warmLoadingFlashes = 0;
    window.__warmLoadingObserver?.disconnect?.();
    window.__warmLoadingObserver = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (!(node instanceof Element)) continue;
          if (node.matches?.(".loading-state") || node.querySelector?.(".loading-state")) {
            window.__warmLoadingFlashes += 1;
          }
        }
      }
    });
    window.__warmLoadingObserver.observe(document.getElementById("app-main"), { childList: true, subtree: true });
  });

  const warmRouteMs = await elapsed(
    () => page.evaluate(() => { window.location.hash = "#/unit/yueyanglouji/words"; }),
    () => page.locator("#study-page-title", { hasText: "字詞與句式" }).waitFor({ state: "visible", timeout: 3000 })
  );
  await page.waitForTimeout(160);
  const warmLoadingFlashes = await page.evaluate(() => {
    window.__warmLoadingObserver?.disconnect?.();
    return Number(window.__warmLoadingFlashes || 0);
  });
  check(warmRouteMs <= BUDGETS.warmRouteMs, `warm same-unit route ${warmRouteMs}ms > ${BUDGETS.warmRouteMs}ms`);
  check(warmLoadingFlashes === 0, `warm same-unit route showed ${warmLoadingFlashes} transient loading state(s)`);

  await page.evaluate(() => { window.location.hash = "#/unit/yueyanglouji/words/quiz?qi=0"; });
  await waitVisible(page, ".quiz-shell .q-stem");

  const option = page.locator('[data-role="option-main"]').first();
  check(await option.count() === 1, "first words quiz question should expose a single-choice option");
  const optionKey = await option.getAttribute("data-key");
  const optionSelectMs = await elapsed(
    () => option.click(),
    () => page.waitForFunction((key) => document.querySelector(`[data-role="option-main"][data-key="${key}"]`)?.getAttribute("aria-checked") === "true", optionKey)
  );
  check(optionSelectMs <= BUDGETS.optionSelectMs, `quiz option repaint ${optionSelectMs}ms > ${BUDGETS.optionSelectMs}ms`);

  const submitMs = await elapsed(
    () => page.locator("#submit-btn").click(),
    () => waitVisible(page, "#confirm-next-btn", 4000)
  );
  check(submitMs <= BUDGETS.submitMs, `quiz submit/reveal ${submitMs}ms > ${BUDGETS.submitMs}ms`);

  const oldStem = await page.locator(".q-stem").first().innerText();
  const nextQuestionMs = await elapsed(
    () => page.locator("#confirm-next-btn").click(),
    () => page.waitForFunction((previous) => {
      const current = document.querySelector(".q-stem")?.textContent?.trim() || "";
      return current && current !== previous.trim();
    }, oldStem)
  );
  check(nextQuestionMs <= BUDGETS.nextQuestionMs, `quiz next-question repaint ${nextQuestionMs}ms > ${BUDGETS.nextQuestionMs}ms`);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(overflow <= 1, `interaction flow has horizontal overflow of ${overflow}px`);

  console.log(
    `Constrained-mobile interactions: reader tab ${readerTabMs}ms; annotation open/close ${annotationOpenMs}/${annotationCloseMs}ms; ` +
    `warm route ${warmRouteMs}ms with ${warmLoadingFlashes} loading flashes; option ${optionSelectMs}ms; ` +
    `submit ${submitMs}ms; next question ${nextQuestionMs}ms; ${PROFILE.cpuSlowdown}x CPU, ${PROFILE.latencyMs}ms RTT, ` +
    `${PROFILE.downloadMbps}Mbps down / ${PROFILE.uploadMbps}Mbps up.`
  );

  await session.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  await context.close();
} finally {
  if (browser) await browser.close();
  await closeServer();
}

if (errors.length) {
  console.error(`Constrained-mobile interaction contract failed with ${errors.length} error(s).`);
  process.exit(1);
}

console.log("Constrained-mobile interaction performance contract passed.");
