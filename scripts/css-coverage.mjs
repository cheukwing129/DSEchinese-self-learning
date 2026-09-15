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

function availableUnits() {
  return (curriculum.units || []).filter((unit) => unit.status === "available");
}

function buildAuditRoutes() {
  const routes = ["/", "/overview"];
  const seen = new Set(routes);
  for (const entry of availableUnits()) {
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
      const route = `/unit/${id}/${suffix}?qi=0`;
      if (!seen.has(route)) {
        seen.add(route);
        routes.push(route);
      }
    }
  }

  // Revisit evidence-heavy views only after quiz/memorisation interactions have
  // had a chance to persist real records. Query strings keep the audit routes
  // unique while still resolving to the same SPA handlers.
  for (const entry of availableUnits()) {
    routes.push(`/unit/${entry.id}/progress?coverage=after`);
  }
  routes.push("/overview?coverage=after");

  // Keep the real fatal route last so all lazy styles are already attached;
  // this exercises shared launch/error rules in core and lazy bundles.
  routes.push("/not-a-real-route");
  return routes;
}

async function exerciseQuizState(page) {
  const single = page.locator('[data-role="option-main"]').first();
  if (await single.count()) {
    await single.click().catch(() => {});
  } else {
    const multi = page.locator('[data-role="option-main-multi"]').first();
    if (await multi.count()) {
      await multi.click().catch(() => {});
    } else {
      const tfSingle = page.locator('.tf-btn-single[data-prefix="main"]').first();
      if (await tfSingle.count()) {
        await tfSingle.click().catch(() => {});
      } else {
        const tf = page.locator('.tf-btn[data-prefix="main"]');
        const tfCount = await tf.count();
        const seenStatements = new Set();
        for (let i = 0; i < tfCount; i += 1) {
          const button = tf.nth(i);
          const stmt = await button.getAttribute("data-stmt");
          if (seenStatements.has(stmt)) continue;
          seenStatements.add(stmt);
          await button.click().catch(() => {});
        }
      }
    }
  }

  const selects = page.locator('select[data-prefix="main"]');
  for (let i = 0; i < await selects.count(); i += 1) {
    await selects.nth(i).selectOption({ index: 1 }).catch(() => {});
  }

  const fillInputs = page.locator('[data-fillkey][data-prefix="main"]');
  for (let i = 0; i < await fillInputs.count(); i += 1) {
    await fillInputs.nth(i).fill(`coverage-${i + 1}`).catch(() => {});
  }

  for (const selector of ["#input-extract", "#input-short", "#input-long"]) {
    const input = page.locator(selector).first();
    if (await input.count()) await input.fill("coverage audit answer").catch(() => {});
  }

  const cloze = page.locator('[data-role="cloze-option"][data-prefix="main"]');
  const clozeCount = await cloze.count();
  const blankIds = new Set();
  for (let i = 0; i < clozeCount; i += 1) {
    const option = cloze.nth(i);
    const blank = await option.getAttribute("data-blank");
    if (!blank || blankIds.has(blank)) continue;
    blankIds.add(blank);
    await option.click().catch(() => {});
  }

  const submit = page.locator("#submit-btn").first();
  if (await submit.count() && await submit.isEnabled().catch(() => false)) {
    await submit.click().catch(() => {});
    await page.locator("#reveal-slot .reveal-panel").waitFor({ state: "visible", timeout: 1500 }).catch(() => {});
  }
}

async function exerciseMemorisationState(page) {
  const clozeTab = page.locator('[data-tab="cloze"]').first();
  if (await clozeTab.count()) {
    await clozeTab.click().catch(() => {});
    await page.locator(".blank-token").first().waitFor({ state: "visible", timeout: 1200 }).catch(() => {});
    const blank = page.locator(".blank-token").first();
    if (await blank.count()) await blank.fill("錯").catch(() => {});
    const check = page.locator("#cloze-check-btn").first();
    if (await check.count()) {
      await check.click().catch(() => {});
      await page.locator("#cloze-result").waitFor({ state: "visible", timeout: 1200 }).catch(() => {});
    }
  }

  const reorderTab = page.locator('[data-tab="reorder"]').first();
  if (await reorderTab.count()) {
    await reorderTab.click().catch(() => {});
    await page.locator(".reorder-list").first().waitFor({ state: "visible", timeout: 1200 }).catch(() => {});
    for (let guard = 0; guard < 40; guard += 1) {
      const chip = page.locator('[data-chip]').first();
      if (!(await chip.count())) break;
      await chip.click().catch(() => {});
      await page.waitForTimeout(5);
    }
    await page.locator("#reorder-result").waitFor({ state: "visible", timeout: 1200 }).catch(() => {});
  }
}

async function exerciseState(page, route) {
  if (route.endsWith("/text")) {
    const tabs = page.locator(".reader-nav button");
    if (await tabs.count() > 1) {
      await tabs.nth(1).click().catch(() => {});
      await page.waitForTimeout(20);
    }
    const term = page.locator("button.term").first();
    if (await term.count()) {
      await term.click().catch(() => {});
      await page.locator('.annotation-popover[role="dialog"]').waitFor({ state: "visible", timeout: 1200 }).catch(() => {});
      await page.waitForTimeout(20);
      await page.keyboard.press("Escape").catch(() => {});
    }
  }

  if (route.includes("/memorisation")) {
    await exerciseMemorisationState(page);
  }

  if (route.includes("/progress")) {
    const summary = page.locator(".evidence-details summary").first();
    if (await summary.count()) {
      await summary.click().catch(() => {});
      await page.waitForTimeout(20);
    }
  }

  if (route.includes("/quiz")) {
    await exerciseQuizState(page);
  }
}

async function auditProfile(browser, profile, routes) {
  const context = await browser.newContext({
    viewport: profile.viewport,
    reducedMotion: profile.reducedMotion || "no-preference"
  });
  await context.addInitScript(() => {
    try {
      // addInitScript runs before every SPA document navigation. Clear once per
      // profile, then preserve real quiz/memorisation records for later progress
      // routes so evidence-heavy states can participate in coverage.
      if (!sessionStorage.getItem("__css_union_initialised")) {
        localStorage.clear();
        sessionStorage.setItem("__css_union_initialised", "1");
      }
    } catch {}
  });
  const page = await context.newPage();
  await page.coverage.startCSSCoverage({ resetOnNavigation: false });
  let visited = 0;
  for (const route of routes) {
    await page.goto(`${baseURL}/#${route}`, { waitUntil: "domcontentloaded", timeout: 12000 });
    if (route === "/not-a-real-route") {
      await page.locator(".launch-state.is-error").waitFor({ state: "visible", timeout: 8000 });
      await page.waitForTimeout(25);
      visited += 1;
      continue;
    }

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

const reducedMotionRoutes = [
  "/",
  "/unit/yueyanglouji/text",
  "/unit/yueyanglouji/words",
  "/unit/yueyanglouji/memorisation",
  "/unit/yueyanglouji/words/quiz?qi=0",
  "/unit/yueyanglouji/progress?coverage=reduce",
  "/not-a-real-route"
];

const profiles = [
  { label: "desktop", viewport: { width: 1280, height: 800 } },
  { label: "mobile", viewport: { width: 390, height: 844 } },
  { label: "reduced-motion", viewport: { width: 390, height: 844 }, reducedMotion: "reduce", routes: reducedMotionRoutes }
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
    const result = await auditProfile(browser, profile, profile.routes || auditRoutes);
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
    console.log(`CSS union ${name}: ${used}/${total} bytes used across normal + rare states (${((used / total) * 100).toFixed(1)}%); ${unused} bytes never hit in this audit.`);

    const candidates = complementRanges(item.text.length, ranges)
      .map((range) => ({ ...range, bytes: Buffer.byteLength(item.text.slice(range.start, range.end), "utf8") }))
      .filter((range) => range.bytes >= 256)
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, 5);
    for (const candidate of candidates) {
      console.log(`CSS unused candidate ${name}: ${candidate.bytes} bytes near ${JSON.stringify(snippet(item.text, candidate.start, candidate.end))}.`);
    }
  }

  console.log(`CSS union total: ${totalUsed}/${totalBytes} built CSS bytes hit (${((totalUsed / totalBytes) * 100).toFixed(1)}%); ${totalBytes - totalUsed} bytes not hit after rare-state coverage. Remaining ranges are cleanup candidates only, not automatic deletions.`);
} finally {
  if (browser) await browser.close();
  await closeServer();
}

console.log("CSS coverage audit completed.");