import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";

const root = process.cwd();
const HOST = "127.0.0.1";
const PORT = 4175;
const baseURL = `http://${HOST}:${PORT}`;
const sourceCssBytes = fs.statSync(path.join(root, "css", "style.css")).size;
const curriculum = JSON.parse(fs.readFileSync(path.join(root, "data", "curriculum.json"), "utf8"));

const BANK_ROUTE = {
  words: "words/quiz",
  content: "comprehension/quiz",
  "structure-skill": "analysis/quiz",
  theme: "theme/quiz",
  "cross-text": "cross-text/quiz/all"
};

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
  const match = String(url).match(/\/assets\/build\/(style|reader-style|study-style|progress-style|questions-style)\.[0-9a-f]{12}\.css(?:$|\?)/);
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

function buildAuditRoutes() {
  const routes = ["/", "/overview"];
  const seen = new Set(routes);
  for (const entry of (curriculum.units || []).filter((unit) => unit.status === "available")) {
    const id = entry.id;
    const unitDir = path.join(root, "data", "units", id);
    const unit = JSON.parse(fs.readFileSync(path.join(unitDir, "unit.json"), "utf8"));
    const unitRoutes = [
      `/unit/${id}`,
      `/unit/${id}/text`,
      `/unit/${id}/words`,
      `/unit/${id}/comprehension`,
      `/unit/${id}/analysis`,
      `/unit/${id}/theme`,
      `/unit/${id}/memorisation`,
      `/unit/${id}/cross-text`,
      `/unit/${id}/progress`,
      `/unit/${id}/challenge`
    ];
    for (const route of unitRoutes) {
      if (!seen.has(route)) {
        seen.add(route);
        routes.push(route);
      }
    }
    for (const rel of unit.question_bank_files || []) {
      const bank = JSON.parse(fs.readFileSync(path.join(unitDir, rel), "utf8"));
      const suffix = BANK_ROUTE[bank.bank];
      if (!suffix || !(bank.questions || []).length) continue;
      const query = bank.bank === "cross-text" ? "?qi=0" : "?qi=0";
      const route = `/unit/${id}/${suffix}${query}`;
      if (!seen.has(route)) {
        seen.add(route);
        routes.push(route);
      }
    }
  }
  return routes;
}

async function exerciseState(page, route) {
  if (route.endsWith("/text")) {
    const tabs = page.locator(".reader-nav button");
    if (await tabs.count() > 1) {
      await tabs.nth(1).click().catch(() => {});
      await page.waitForTimeout(20);
    }
  }

  if (route.includes("/progress")) {
    const summary = page.locator(".evidence-details summary").first();
    if (await summary.count()) {
      await summary.click().catch(() => {});
      await page.waitForTimeout(20);
    }
  }

  if (route.includes("/quiz")) {
    const candidates = [
      '[data-role="option-main"]',
      '[data-role="option-main-multi"]',
      '.tf-btn-single[data-prefix="main"]',
      '.tf-btn[data-prefix="main"]',
      '[data-role="cloze-option"][data-prefix="main"]'
    ];
    for (const selector of candidates) {
      const item = page.locator(selector).first();
      if (await item.count()) {
        await item.click().catch(() => {});
        break;
      }
    }
    const submit = page.locator("#submit-btn").first();
    if (await submit.count() && await submit.isEnabled().catch(() => false)) {
      await submit.click().catch(() => {});
      await page.waitForTimeout(20);
    }
  }
}

async function auditProfile(browser, profile, routes) {
  const context = await browser.newContext({ viewport: profile.viewport });
  await context.addInitScript(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
  });
  const page = await context.newPage();
  await page.coverage.startCSSCoverage({ resetOnNavigation: false });
  let visited = 0;
  for (const route of routes) {
    await page.goto(`${baseURL}/#${route}`, { waitUntil: "domcontentloaded", timeout: 12000 });
    await page.locator("#app-main > *").first().waitFor({ state: "visible", timeout: 8000 });
    await page.locator("#app-main .loading-state").waitFor({ state: "detached", timeout: 8000 }).catch(() => {});
    const state = await page.evaluate(() => ({
      fatal: Boolean(document.querySelector(".launch-state.is-error")),
      text: document.getElementById("app-main")?.innerText?.trim() || ""
    }));
    if (state.fatal || state.text.length < 10) {
      throw new Error(`${profile.label} union audit route ${route} did not render usable content`);
    }
    await exerciseState(page, route);
    await page.waitForTimeout(15);
    visited += 1;
  }
  const coverage = await page.coverage.stopCSSCoverage();
  await context.close();
  return { label: profile.label, visited, coverage };
}

function addCoverageToUnion(union, coverage) {
  for (const entry of coverage) {
    const name = styleName(entry.url);
    if (!name) continue;
    const existing = union.get(name);
    if (!existing) {
      union.set(name, { text: entry.text, ranges: [...entry.ranges] });
      continue;
    }
    if (existing.text !== entry.text) {
      throw new Error(`CSS union audit saw inconsistent content for ${name}`);
    }
    existing.ranges.push(...entry.ranges);
  }
}

function complementRanges(totalLength, usedRanges) {
  const used = mergedRanges(usedRanges);
  const unused = [];
  let cursor = 0;
  for (const range of used) {
    if (range.start > cursor) unused.push({ start: cursor, end: range.start });
    cursor = Math.max(cursor, range.end);
  }
  if (cursor < totalLength) unused.push({ start: cursor, end: totalLength });
  return unused;
}

function snippet(text, start, end) {
  return text
    .slice(start, Math.min(end, start + 220))
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

const representativeRoutes = [
  { label: "home", hash: "#/", selector: ".map-grid", title: "讀懂經典", styles: ["style"] },
  { label: "unit", hash: "#/unit/yueyanglouji", selector: ".unit-hero", title: "《岳陽樓記》", styles: ["style"] },
  { label: "reader", hash: "#/unit/yueyanglouji/text", selector: ".reader-shell", title: "原文與誦讀", styles: ["style", "reader-style"] },
  { label: "study", hash: "#/unit/yueyanglouji/words", selector: ".study-page-shell.words-study", styles: ["style", "study-style"] },
  { label: "quiz", hash: "#/unit/yueyanglouji/words/quiz", selector: ".q-stem", styles: ["style", "questions-style"] },
  { label: "progress", hash: "#/unit/yueyanglouji/progress", selector: ".unit-progress-hero", styles: ["style", "progress-style"] }
];

const profiles = [
  { label: "desktop", viewport: { width: 1280, height: 800 } },
  { label: "mobile", viewport: { width: 390, height: 844 } }
];

await listen();
let browser;
try {
  browser = await chromium.launch({ headless: true });

  const representativeContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const representativeResults = [];
  for (const route of representativeRoutes) {
    const result = await measureRoute(representativeContext, route);
    representativeResults.push({ ...route, ...result });
  }
  for (const result of representativeResults) {
    const percent = result.total ? (result.used / result.total) * 100 : 0;
    const files = result.pieces.map((piece) => `${piece.name}:${piece.total}`).join(" + ");
    console.log(`CSS coverage ${result.label}: ${result.used}/${result.total} loaded bytes used (${percent.toFixed(1)}%); ${files}.`);
  }
  const home = representativeResults.find((result) => result.label === "home");
  if (home) {
    const avoided = sourceCssBytes - home.total;
    console.log(`CSS split audit: home loads ${home.total}/${sourceCssBytes} source CSS bytes and avoids ${avoided} bytes (${((avoided / sourceCssBytes) * 100).toFixed(1)}%) before route navigation.`);
    if (home.total >= sourceCssBytes) throw new Error("home CSS split did not reduce startup stylesheet bytes");
  }
  await representativeContext.close();

  const auditRoutes = buildAuditRoutes();
  const union = new Map();
  for (const profile of profiles) {
    const result = await auditProfile(browser, profile, auditRoutes);
    addCoverageToUnion(union, result.coverage);
    console.log(`CSS union profile ${result.label}: visited ${result.visited} direct routes/states.`);
  }

  const expectedAssets = ["style", "reader-style", "study-style", "progress-style", "questions-style"];
  for (const name of expectedAssets) {
    if (!union.has(name)) throw new Error(`CSS union audit never observed ${name}`);
  }

  let totalBytes = 0;
  let totalUsed = 0;
  for (const name of expectedAssets) {
    const item = union.get(name);
    const ranges = mergedRanges(item.ranges);
    const total = Buffer.byteLength(item.text, "utf8");
    const used = ranges.reduce((sum, range) => sum + Buffer.byteLength(item.text.slice(range.start, range.end), "utf8"), 0);
    const unused = total - used;
    totalBytes += total;
    totalUsed += used;
    console.log(`CSS union ${name}: ${used}/${total} bytes used across desktop+mobile (${((used / total) * 100).toFixed(1)}%); ${unused} bytes never hit in this audit.`);

    const candidates = complementRanges(item.text.length, ranges)
      .map((range) => ({ ...range, bytes: Buffer.byteLength(item.text.slice(range.start, range.end), "utf8") }))
      .filter((range) => range.bytes >= 256)
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, 5);
    for (const candidate of candidates) {
      console.log(`CSS unused candidate ${name}: ${candidate.bytes} bytes near ${JSON.stringify(snippet(item.text, candidate.start, candidate.end))}.`);
    }
  }

  console.log(`CSS union total: ${totalUsed}/${totalBytes} built CSS bytes hit (${((totalUsed / totalBytes) * 100).toFixed(1)}%); ${totalBytes - totalUsed} bytes not hit. Treat unhit ranges as cleanup candidates, not automatic deletions, because rare interaction states may be absent from coverage.`);
} finally {
  if (browser) await browser.close();
  await closeServer();
}

console.log("CSS coverage audit completed.");
