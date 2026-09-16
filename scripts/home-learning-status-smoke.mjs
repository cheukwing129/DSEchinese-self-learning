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

function unitCard(page, unitId) {
  return page.locator(`a.map-card[href="#/unit/${unitId}"]`);
}

async function waitForStatus(page, unitId, status) {
  await page.waitForFunction(({ unitId, status }) => {
    const badge = document.querySelector(`a.map-card[href="#/unit/${unitId}"] .badge`);
    return badge?.dataset.learningStatus === status;
  }, { unitId, status }, { timeout: 5000 });
}

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
  await page.locator(".map-card").first().waitFor({ state: "visible", timeout: 5000 });
  check(await page.locator(".map-card").count() === 16, "home should still render all 16 curriculum cards");
  await waitForStatus(page, "lunyu-renxiaojunzi", "not-started");
  check((await unitCard(page, "lunyu-renxiaojunzi").locator(".badge").textContent())?.trim() === "未開始", "fresh units should say 未開始 instead of generic 可學習");

  await page.evaluate(() => {
    localStorage.setItem("ccsl_progress_v1", JSON.stringify({
      yueyanglouji: {
        answers: { q1: { answered: true, isCorrect: false, timestamp: 100 } },
        navigation: { lastPath: "/unit/yueyanglouji/words/quiz?qi=0", lastAt: 100 },
        lastActivityAt: 100
      },
      denglou: {
        openQuestionReviews: { review1: { decision: "retry", updatedAt: 200 } },
        navigation: { lastPath: "/unit/denglou/theme/quiz?qi=0", lastAt: 180 },
        lastActivityAt: 200
      },
      shishuo: {
        answers: { q1: { answered: true, isCorrect: true, timestamp: 250 } },
        navigation: { lastPath: "/unit/shishuo/comprehension", lastAt: 250 },
        lastActivityAt: 250
      },
      chushibiao: {
        reflections: { theme: "已整理主旨" },
        navigation: { lastPath: "/unit/chushibiao/theme", lastAt: 300 },
        lastActivityAt: 300
      }
    }));
  });
  await page.reload({ waitUntil: "domcontentloaded", timeout: 10000 });

  await waitForStatus(page, "yueyanglouji", "objective-wrong");
  await waitForStatus(page, "denglou", "open-retry");
  await waitForStatus(page, "shishuo", "started");
  await waitForStatus(page, "chushibiao", "recent");
  await waitForStatus(page, "lunyu-renxiaojunzi", "not-started");

  check((await unitCard(page, "yueyanglouji").locator(".badge").textContent())?.trim() === "待修正 ×1", "objective wrong answers should surface as 待修正 on the home card");
  check((await unitCard(page, "denglou").locator(".badge").textContent())?.trim() === "開放題待重做 ×1", "open-answer retry decisions should surface on the home card");
  check((await unitCard(page, "chushibiao").locator(".badge").textContent())?.trim() === "最近學習", "most recently active unit should say 最近學習");
  check((await unitCard(page, "shishuo").locator(".badge").textContent())?.trim() === "已開始", "older learning evidence should say 已開始");
  check((await unitCard(page, "lunyu-renxiaojunzi").locator(".badge").textContent())?.trim() === "未開始", "untouched units should remain 未開始");

  check(await unitCard(page, "yueyanglouji").locator(".badge").evaluate((el) => el.classList.contains("badge-soon")), "objective remediation badge should use the attention treatment");
  check(await unitCard(page, "denglou").locator(".badge").evaluate((el) => el.classList.contains("badge-soon")), "open-answer retry badge should use the attention treatment");

  const statusTexts = await page.locator("a.map-card .badge").allTextContents();
  check(statusTexts.every((text) => !text.includes("%")), "home learning states must not invent completion percentages");
} finally {
  if (browser) await browser.close();
  await closeServer();
}

if (failures.length) process.exit(1);
console.log("Home learning status smoke passed: honest per-unit states render without fake completion percentages.");
