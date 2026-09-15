import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";

const root = process.cwd();
const HOST = "127.0.0.1";
const PORT = 4175;
const baseURL = `http://${HOST}:${PORT}`;
const sourceCssBytes = fs.statSync(path.join(root, "css", "style.css")).size;

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

function mergedRanges(ranges) {
  const sorted = ranges
    .map(({ start, end }) => ({ start, end }))
    .sort((a, b) => a.start - b.start || a.end - b.end);
  const merged = [];
  for (const range of sorted) {
    const last = merged.at(-1);
    if (!last || range.start > last.end) merged.push({ ...range });
    else last.end = Math.max(last.end, range.end);
  }
  return merged;
}

function coverageBytes(entry) {
  const total = Buffer.byteLength(entry.text, "utf8");
  const used = mergedRanges(entry.ranges)
    .reduce((sum, range) => sum + Buffer.byteLength(entry.text.slice(range.start, range.end), "utf8"), 0);
  return { total, used };
}

function styleName(url) {
  const match = String(url).match(/\/assets\/build\/(style|content-style|questions-style)\.[0-9a-f]{12}\.css(?:$|\?)/);
  return match?.[1] || null;
}

async function measureRoute(context, route) {
  const page = await context.newPage();
  await page.coverage.startCSSCoverage({ resetOnNavigation: true });
  await page.goto(`${baseURL}/${route.hash}`, { waitUntil: "domcontentloaded", timeout: 10000 });
  await page.locator(route.selector).first().waitFor({ state: "visible", timeout: 8000 });
  if (route.title) {
    await page.locator(".page-title", { hasText: route.title }).waitFor({ state: "visible", timeout: 8000 });
  }
  await page.waitForTimeout(75);
  const coverage = await page.coverage.stopCSSCoverage();
  const bundleEntries = coverage
    .map((entry) => ({ entry, name: styleName(entry.url) }))
    .filter((item) => item.name);
  const names = bundleEntries.map((item) => item.name).sort();
  const expectedNames = [...route.styles].sort();
  if (JSON.stringify(names) !== JSON.stringify(expectedNames)) {
    throw new Error(`${route.label}: expected styles ${expectedNames.join(", ")}, got ${names.join(", ") || "none"}`);
  }
  const pieces = bundleEntries.map(({ entry, name }) => ({ name, ...coverageBytes(entry) }));
  const result = {
    total: pieces.reduce((sum, piece) => sum + piece.total, 0),
    used: pieces.reduce((sum, piece) => sum + piece.used, 0),
    pieces
  };
  await page.close();
  return result;
}

const routes = [
  { label: "home", hash: "#/", selector: ".map-grid", title: "讀懂經典", styles: ["style"] },
  { label: "unit", hash: "#/unit/yueyanglouji", selector: ".unit-hero", title: "《岳陽樓記》", styles: ["style", "content-style"] },
  { label: "reader", hash: "#/unit/yueyanglouji/text", selector: ".reader-shell", title: "原文與誦讀", styles: ["style", "content-style"] },
  { label: "quiz", hash: "#/unit/yueyanglouji/words/quiz", selector: ".q-stem", styles: ["style", "questions-style"] },
  { label: "progress", hash: "#/unit/yueyanglouji/progress", selector: ".unit-progress-hero", styles: ["style", "content-style"] }
];

await listen();
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const results = [];
  for (const route of routes) {
    const result = await measureRoute(context, route);
    results.push({ ...route, ...result });
  }
  for (const result of results) {
    const percent = result.total ? (result.used / result.total) * 100 : 0;
    const files = result.pieces.map((piece) => `${piece.name}:${piece.total}`).join(" + ");
    console.log(`CSS coverage ${result.label}: ${result.used}/${result.total} loaded bytes used (${percent.toFixed(1)}%); ${files}.`);
  }
  const home = results.find((result) => result.label === "home");
  if (home) {
    const avoided = sourceCssBytes - home.total;
    console.log(`CSS split audit: home loads ${home.total}/${sourceCssBytes} source CSS bytes and avoids ${avoided} bytes (${((avoided / sourceCssBytes) * 100).toFixed(1)}%) before route navigation.`);
    if (home.total >= sourceCssBytes) throw new Error("home CSS split did not reduce startup stylesheet bytes");
  }
  await context.close();
} finally {
  if (browser) await browser.close();
  await closeServer();
}

console.log("CSS coverage audit completed.");
