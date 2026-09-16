import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const root = process.cwd();
const HOST = "127.0.0.1";
const PORT = 4179;
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
    "Content-Length": String(body.length)
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

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wenmai-transfer-"));
const validImportPath = path.join(tempDir, "valid.json");
const invalidImportPath = path.join(tempDir, "invalid.json");
fs.writeFileSync(validImportPath, JSON.stringify({
  format: "wenmai-learning-records",
  version: 1,
  exportedAt: "2026-09-16T00:00:00.000Z",
  progress: {
    denglou: {
      openQuestionReviews: { r1: { decision: "retry", updatedAt: 500 } },
      navigation: { lastPath: "/unit/denglou/theme/quiz?qi=0", lastAt: 500 },
      lastActivityAt: 500
    }
  }
}, null, 2));
fs.writeFileSync(invalidImportPath, JSON.stringify({
  format: "not-wenmai",
  version: 1,
  progress: { denglou: {} }
}));

await listen();
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  page.on("pageerror", (err) => check(false, `page runtime error: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") check(false, `console error: ${msg.text()}`);
  });
  page.on("requestfailed", (req) => check(false, `request failed: ${req.method()} ${req.url()}`));

  await page.goto(`${baseURL}/#/`, { waitUntil: "domcontentloaded", timeout: 10000 });
  await page.evaluate(() => {
    localStorage.setItem("ccsl_progress_v1", JSON.stringify({
      yueyanglouji: {
        answers: { q1: { answered: true, isCorrect: false, timestamp: 300 } },
        navigation: { lastPath: "/unit/yueyanglouji/words/quiz?qi=0", lastAt: 300 },
        lastActivityAt: 300
      }
    }));
  });

  await page.goto(`${baseURL}/#/overview`, { waitUntil: "domcontentloaded", timeout: 15000 });
  const panel = page.locator("[data-progress-transfer-panel]");
  await panel.waitFor({ state: "visible", timeout: 12000 });
  check(await page.locator("#progress-export-btn").isEnabled(), "export should be enabled when this device has learning records");
  check((await panel.textContent())?.includes("備份與轉移學習紀錄"), "overview should expose a clear learning-record transfer panel");
  check((await panel.textContent())?.includes("將取代"), "import UI should explain replacement before the student chooses a file");

  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 5000 }),
    page.locator("#progress-export-btn").click()
  ]);
  const downloadPath = await download.path();
  check(!!downloadPath, "export should create a downloadable JSON file");
  if (downloadPath) {
    const payload = JSON.parse(fs.readFileSync(downloadPath, "utf8"));
    check(payload.format === "wenmai-learning-records", "export must use the versioned Wenmai backup format");
    check(payload.version === 1, "export backup version must be 1");
    check(!!payload.exportedAt, "export should include an exportedAt timestamp");
    check(payload.progress?.yueyanglouji?.answers?.q1?.isCorrect === false, "export must preserve real progress records");
    check(!Object.hasOwn(payload, "readerPreferences"), "learning-record export should not pretend display preferences are learning progress");
  }
  check(download.suggestedFilename().startsWith("wenmai-learning-records-"), "export filename should be recognisable to students");

  await page.locator("#progress-import-input").setInputFiles(invalidImportPath);
  await page.locator("[data-progress-transfer-status]").waitFor({ state: "visible", timeout: 3000 });
  check((await page.locator("[data-progress-transfer-status]").textContent())?.includes("不是有效的文脈學習紀錄備份"), "invalid backup formats should be rejected with a clear message");
  let stored = await page.evaluate(() => JSON.parse(localStorage.getItem("ccsl_progress_v1") || "{}"));
  check(!!stored.yueyanglouji && !stored.denglou, "invalid imports must leave existing progress untouched");

  page.once("dialog", async (dialog) => {
    check(dialog.type() === "confirm", "replacing existing progress should require explicit confirmation");
    check(dialog.message().includes("取代這部裝置現有的學習紀錄"), "replacement warning should name the consequence clearly");
    await dialog.dismiss();
  });
  await page.locator("#progress-import-input").setInputFiles(validImportPath);
  await page.waitForFunction(() => document.querySelector("[data-progress-transfer-status]")?.textContent?.includes("已取消匯入"), null, { timeout: 3000 });
  stored = await page.evaluate(() => JSON.parse(localStorage.getItem("ccsl_progress_v1") || "{}"));
  check(!!stored.yueyanglouji && !stored.denglou, "cancelling replacement must preserve current records");

  page.once("dialog", async (dialog) => {
    await dialog.accept();
  });
  const reloadPromise = page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 10000 });
  await page.locator("#progress-import-input").setInputFiles(validImportPath);
  await reloadPromise;
  await page.locator("[data-progress-transfer-panel]").waitFor({ state: "visible", timeout: 12000 });
  stored = await page.evaluate(() => JSON.parse(localStorage.getItem("ccsl_progress_v1") || "{}"));
  check(!stored.yueyanglouji && stored.denglou?.openQuestionReviews?.r1?.decision === "retry", "accepted import should replace existing records with the validated backup");
  check((await page.locator("[data-progress-transfer-status]").textContent())?.includes("匯入完成"), "successful import should survive reload with a visible completion notice");

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(overflow <= 1, `transfer panel should not create mobile horizontal overflow (delta ${overflow}px)`);
} finally {
  if (browser) await browser.close();
  await closeServer();
  fs.rmSync(tempDir, { recursive: true, force: true });
}

if (failures.length) process.exit(1);
console.log("Progress transfer smoke passed: export, validation, explicit replacement confirmation, import persistence and mobile layout are safe.");
