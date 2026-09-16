import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";

const root = process.cwd();
const HOST = "127.0.0.1";
const PORT = 4178;
const baseURL = `http://${HOST}:${PORT}`;
const failures = [];

function check(condition, message) {
  if (!condition) {
    failures.push(message);
    console.error(`ERROR: ${message}`);
  }
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
  try { pathname = decodeURIComponent(urlPath.split("?")[0]); } catch { return null; }
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
  if (filePath === "__favicon__") { res.writeHead(204); res.end(); return; }
  if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }
  const body = fs.readFileSync(filePath);
  res.writeHead(200, { "Content-Type": contentType(filePath), "Content-Length": String(body.length) });
  res.end(body);
});

const listen = () => new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(PORT, HOST, resolve);
});
const closeServer = () => new Promise((resolve) => server.close(resolve));

await listen();
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  page.on("pageerror", (err) => check(false, `page runtime error: ${err.message}`));
  page.on("console", (msg) => { if (msg.type() === "error") check(false, `console error: ${msg.text()}`); });
  page.on("requestfailed", (req) => check(false, `request failed: ${req.method()} ${req.url()}`));

  await page.goto(`${baseURL}/#/unit/yueyanglouji/text`, { waitUntil: "domcontentloaded", timeout: 10000 });
  await page.locator(".reader-shell").waitFor({ state: "visible", timeout: 5000 });
  await page.locator(".reader-comfort-panel").waitFor({ state: "visible", timeout: 5000 });

  const baseline = await page.locator(".text-passage").first().evaluate((el) => {
    const style = getComputedStyle(el);
    return { fontSize: parseFloat(style.fontSize), lineHeight: parseFloat(style.lineHeight) };
  });

  await page.locator('[data-reader-preference="font"][data-reader-value="large"]').click();
  await page.locator('[data-reader-preference="line"][data-reader-value="relaxed"]').click();
  await page.waitForFunction(() => document.querySelector(".reader-shell")?.dataset.readerFont === "large" && document.querySelector(".reader-shell")?.dataset.readerLine === "relaxed");

  const enlarged = await page.locator(".text-passage").first().evaluate((el) => {
    const style = getComputedStyle(el);
    return { fontSize: parseFloat(style.fontSize), lineHeight: parseFloat(style.lineHeight) };
  });
  check(enlarged.fontSize > baseline.fontSize, `large reader font should exceed baseline (${enlarged.fontSize} <= ${baseline.fontSize})`);
  check(enlarged.lineHeight > baseline.lineHeight, `relaxed line height should exceed baseline (${enlarged.lineHeight} <= ${baseline.lineHeight})`);

  await page.locator("#reader-focus-toggle").click();
  await page.waitForFunction(() => document.querySelector(".reader-shell")?.dataset.readerFocus === "true");
  check(await page.locator(".reader-sidebar").isHidden(), "focus mode should hide reader sidebar");
  check(await page.locator(".reader-hero").isHidden(), "focus mode should hide reader hero");
  check(await page.locator("#reader-focus-exit").isVisible(), "focus mode should expose an exit control inside the paper");
  check(await page.locator(".reader-section-nav").isVisible(), "focus mode should keep previous/next section navigation");
  check(await page.locator(".term").count() > 0, "focus mode should keep annotation terms available");

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("wenmai_reader_preferences_v1") || "{}"));
  check(saved.font === "large", "reader font preference should persist separately in local storage");
  check(saved.line === "relaxed", "reader line-height preference should persist separately in local storage");
  check(saved.focus === true, "reader focus preference should persist separately in local storage");

  await page.reload({ waitUntil: "domcontentloaded", timeout: 10000 });
  await page.locator(".reader-shell").waitFor({ state: "visible", timeout: 5000 });
  await page.waitForFunction(() => document.querySelector(".reader-shell")?.dataset.readerFocus === "true");
  check(await page.locator("#reader-focus-exit").isVisible(), "focus mode should survive reload with a visible exit control");
  const restored = await page.locator(".text-passage").first().evaluate((el) => {
    const style = getComputedStyle(el);
    return { fontSize: parseFloat(style.fontSize), lineHeight: parseFloat(style.lineHeight) };
  });
  check(restored.fontSize === enlarged.fontSize, "reader font size should survive reload");
  check(restored.lineHeight === enlarged.lineHeight, "reader line height should survive reload");

  const next = page.locator("#reader-next-btn");
  if (!(await next.isDisabled())) {
    await next.click();
    await page.waitForTimeout(50);
    const afterNavigation = await page.locator(".text-passage").first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    check(afterNavigation === enlarged.fontSize, "reader preference should remain applied after changing section");
  }

  await page.locator("#reader-focus-exit").click();
  await page.waitForFunction(() => document.querySelector(".reader-shell")?.dataset.readerFocus === "false");
  await page.locator(".reader-comfort-panel").waitFor({ state: "visible", timeout: 5000 });
  check(await page.locator(".reader-sidebar").isVisible(), "exiting focus mode should restore reader tools");

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(overflow <= 1, `reader comfort controls should not create mobile horizontal overflow (${overflow}px)`);
} finally {
  if (browser) await browser.close();
  await closeServer();
}

if (failures.length) process.exit(1);
console.log("Reader comfort smoke passed: font size, line spacing, focus mode and persistence are healthy.");
