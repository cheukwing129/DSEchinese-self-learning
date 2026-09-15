import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";

const root = process.cwd();
const PORT = 4174;
const HOST = "127.0.0.1";
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
  homeReadyMs: 2500,
  textReadyMs: 2500,
  quizReadyMs: 3000
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

async function configureConstrainedMobile(context, page) {
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

async function waitVisible(page, selector, timeout = 10000) {
  await page.locator(selector).first().waitFor({ state: "visible", timeout });
}

await listen();
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: PROFILE.viewport });
  const page = await context.newPage();
  const session = await configureConstrainedMobile(context, page);

  page.on("requestfailed", (req) => fail(`request failed: ${req.method()} ${req.url()} (${req.failure()?.errorText || "unknown"})`));
  page.on("pageerror", (err) => fail(`page runtime error: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") fail(`console error: ${msg.text()}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) fail(`HTTP ${response.status()}: ${response.url()}`);
  });

  await page.goto(`${baseURL}/#/`, { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.locator(".page-title", { hasText: "讀懂經典" }).waitFor({ state: "visible", timeout: 10000 });
  await page.locator(".loading-state").waitFor({ state: "detached", timeout: 10000 }).catch(() => {});
  const homeReadyMs = await page.evaluate(() => performance.now());
  check(homeReadyMs <= BUDGETS.homeReadyMs, `constrained-mobile home ready ${Math.round(homeReadyMs)}ms > ${BUDGETS.homeReadyMs}ms`);
  check(await page.locator(".map-card").count() === 16, "constrained-mobile home should render 16 curriculum cards");

  const textStart = Date.now();
  await page.evaluate(() => { window.location.hash = "#/unit/yueyanglouji/text"; });
  await waitVisible(page, ".reader-shell", 12000);
  await page.locator(".page-title", { hasText: "原文與誦讀" }).waitFor({ state: "visible", timeout: 12000 });
  const textReadyMs = Date.now() - textStart;
  check(textReadyMs <= BUDGETS.textReadyMs, `constrained-mobile first reader ready ${textReadyMs}ms > ${BUDGETS.textReadyMs}ms`);
  check(await page.locator("audio[preload=\"none\"]").count() === 1, "reader audio must remain non-preloading on constrained mobile");

  const quizStart = Date.now();
  await page.evaluate(() => { window.location.hash = "#/unit/yueyanglouji/words/quiz"; });
  await waitVisible(page, ".q-stem", 12000);
  const quizReadyMs = Date.now() - quizStart;
  check(quizReadyMs <= BUDGETS.quizReadyMs, `constrained-mobile first quiz ready ${quizReadyMs}ms > ${BUDGETS.quizReadyMs}ms`);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(overflow <= 1, `constrained-mobile quiz has horizontal overflow of ${overflow}px`);

  console.log(
    `Constrained mobile metrics: home ${Math.round(homeReadyMs)}ms; first reader ${textReadyMs}ms; first quiz ${quizReadyMs}ms; ` +
    `${PROFILE.cpuSlowdown}x CPU, ${PROFILE.latencyMs}ms RTT, ${PROFILE.downloadMbps}Mbps down / ${PROFILE.uploadMbps}Mbps up, cache disabled.`
  );

  await session.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  await context.close();
} finally {
  if (browser) await browser.close();
  await closeServer();
}

if (errors.length) {
  console.error(`Constrained-mobile performance contract failed with ${errors.length} error(s).`);
  process.exit(1);
}

console.log("Constrained-mobile performance contract passed.");
