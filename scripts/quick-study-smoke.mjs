import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";

const root = process.cwd();
const HOST = "127.0.0.1";
const PORT = 4180;
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

async function waitForPlan(page, mode, unitId = null) {
  await page.waitForFunction(({ mode, unitId }) => {
    const panel = document.querySelector("[data-quick-study-panel]");
    return panel?.dataset.quickStudyMode === mode && (!unitId || panel.dataset.quickStudyUnit === unitId);
  }, { mode, unitId }, { timeout: 5000 });
}

async function totalMinutes(page) {
  return page.locator("[data-quick-study-step]").evaluateAll((nodes) =>
    nodes.reduce((sum, node) => sum + Number(node.dataset.minutes || 0), 0)
  );
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
  await waitForPlan(page, "new");
  check(await page.locator("[data-quick-study-step]").count() === 3, "fresh quick-study plan should contain exactly three steps");
  check(await totalMinutes(page) === 10, "fresh quick-study plan should total 10 suggested minutes");
  const freshMinutes = await page.locator("[data-quick-study-step]").evaluateAll((nodes) => nodes.map((node) => Number(node.dataset.minutes)));
  check(JSON.stringify(freshMinutes) === JSON.stringify([4, 4, 2]), "fresh learner plan should use a 4+4+2 read/practise/memorise rhythm");
  check(await page.locator("[data-today-review-panel]").count() === 0, "fresh learners should not receive review tasks without review evidence");

  const returningUnit = await page.locator('a.map-card[href^="#/unit/"]').nth(1).evaluate((card) => {
    const match = (card.getAttribute("href") || "").match(/^#\/unit\/([^/?]+)/);
    return match ? decodeURIComponent(match[1]) : "";
  });
  check(!!returningUnit, "quick-study regression needs a second available curriculum unit");

  const now = Date.now();
  await page.evaluate(({ returningUnit, now }) => {
    localStorage.setItem("ccsl_progress_v1", JSON.stringify({
      [returningUnit]: {
        answers: {
          q1: {
            answered: true,
            isCorrect: true,
            timestamp: now,
            lastCorrectAt: now,
            attemptCount: 1,
            correctAttempts: 1
          }
        },
        navigation: {
          lastPath: `/unit/${returningUnit}/comprehension`,
          lastAt: now
        },
        lastActivityAt: now
      }
    }));
  }, { returningUnit, now });

  await page.reload({ waitUntil: "domcontentloaded", timeout: 10000 });
  await waitForPlan(page, "guided", returningUnit);
  check(await page.locator("[data-today-review-panel]").count() === 0, "recent clean learning should stay in the guided quick-study flow instead of being treated as due review");
  check(await totalMinutes(page) === 10, "guided returning-student plan should total 10 suggested minutes");

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(overflow <= 1, `quick-study plan should not create mobile horizontal overflow (overflow=${overflow}px)`);
  check((await page.locator("[data-quick-study-panel]").textContent())?.includes("不會自動倒數"), "quick-study copy must state that suggested time is not an automatic timer");
} finally {
  if (browser) await browser.close();
  await closeServer();
}

if (failures.length) process.exit(1);
console.log("Quick-study smoke passed: fresh and recent-clean learners keep the 10-minute plan; due-review evidence is covered separately by today-review regression.");
