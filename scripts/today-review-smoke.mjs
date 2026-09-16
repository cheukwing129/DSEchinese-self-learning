import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";

const root = process.cwd();
const HOST = "127.0.0.1";
const PORT = 4183;
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

async function waitForTodayReview(page) {
  await page.waitForFunction(() => document.querySelector("[data-today-review-panel]")?.dataset.quickStudyMode === "today-review", null, { timeout: 5000 });
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
  await page.waitForSelector("a.map-card[href^='#/unit/']");
  const units = await page.locator("a.map-card[href^='#/unit/']").evaluateAll((cards) => cards.slice(0, 4).map((card) => ({
    id: decodeURIComponent((card.getAttribute("href") || "").match(/^#\/unit\/([^/?]+)/)?.[1] || ""),
    title: card.querySelector(".map-title")?.textContent?.trim() || ""
  })));
  check(units.length === 4 && units.every((unit) => unit.id), "today-review smoke needs four available curriculum units");

  const now = Date.now();
  const [wrongUnit, openUnit, memoUnit, staleUnit] = units;
  await page.evaluate(({ now, wrongUnit, openUnit, memoUnit, staleUnit }) => {
    const day = 24 * 60 * 60 * 1000;
    localStorage.setItem("ccsl_progress_v1", JSON.stringify({
      [wrongUnit.id]: {
        answers: {
          q1: { answered: true, isCorrect: false, wrongAttempts: 2, lastWrongAt: now - day, timestamp: now - day },
          q2: { answered: true, isCorrect: false, wrongAttempts: 1, lastWrongAt: now - 2 * day, timestamp: now - 2 * day }
        },
        navigation: { lastPath: `/unit/${wrongUnit.id}/comprehension/quiz?qi=0`, lastAt: now - day },
        lastActivityAt: now - day
      },
      [openUnit.id]: {
        openQuestionReviews: {
          r1: { decision: "retry", updatedAt: now - 4 * day },
          r2: { decision: "retry", updatedAt: now - 5 * day }
        },
        navigation: { lastPath: `/unit/${openUnit.id}/theme/quiz?qi=1`, lastAt: now - 4 * day },
        lastActivityAt: now - 4 * day
      },
      [memoUnit.id]: {
        memorisation: {
          groups: {
            g1: { cloze: { attempts: 2, lastRate: 60, lastAt: now - 6 * day } },
            g2: { reorder: { attempts: 1, lastCorrect: false, lastAt: now - 7 * day } }
          }
        },
        navigation: { lastPath: `/unit/${memoUnit.id}/memorisation`, lastAt: now - 6 * day },
        lastActivityAt: now - 6 * day
      },
      [staleUnit.id]: {
        answers: { q1: { answered: true, isCorrect: true, timestamp: now - 10 * day, lastCorrectAt: now - 10 * day } },
        navigation: { lastPath: `/unit/${staleUnit.id}/text`, lastAt: now - 10 * day },
        lastActivityAt: now - 10 * day
      }
    }));
  }, { now, wrongUnit, openUnit, memoUnit, staleUnit });

  await page.reload({ waitUntil: "domcontentloaded", timeout: 10000 });
  await waitForTodayReview(page);
  check(await page.locator("[data-today-review-item]").count() === 3, "today review must show at most three items");
  const kinds = await page.locator("[data-today-review-item]").evaluateAll((nodes) => nodes.map((node) => node.dataset.reviewKind));
  check(JSON.stringify(kinds) === JSON.stringify(["wrong", "open-retry", "memorisation"]), "unresolved wrong answers, open retries and weak memorisation must outrank a stale-only review");
  check((await page.locator('[data-today-review-item="1"]').getAttribute("href")) === `#/unit/${wrongUnit.id}/progress/retry-wrong`, "top objective-error item must link directly to wrong-answer retry");
  check((await page.locator('[data-today-review-item="1"]').textContent())?.includes("2 題"), "objective-error card should surface the unresolved count");
  check((await page.locator('[data-today-review-item="2"]').getAttribute("href")) === `#/unit/${openUnit.id}/theme/quiz?qi=1`, "open-answer retry should use the safe recent learning path");
  check((await page.locator('[data-today-review-item="3"]').textContent())?.includes("2 組"), "memorisation card should surface the weak-group count");

  await page.evaluate(({ now, wrongUnit, openUnit, memoUnit, staleUnit }) => {
    const day = 24 * 60 * 60 * 1000;
    localStorage.setItem("ccsl_progress_v1", JSON.stringify({
      [wrongUnit.id]: {
        answers: { q1: { answered: true, isCorrect: true, timestamp: now, lastCorrectAt: now, everWrong: true, wrongAttempts: 2 } },
        navigation: { lastPath: `/unit/${wrongUnit.id}/comprehension`, lastAt: now },
        lastActivityAt: now
      },
      [openUnit.id]: {
        openQuestionReviews: { r1: { decision: "retry", updatedAt: now - 4 * day } },
        navigation: { lastPath: `/unit/${openUnit.id}/theme/quiz?qi=1`, lastAt: now - 4 * day },
        lastActivityAt: now - 4 * day
      },
      [memoUnit.id]: {
        memorisation: { groups: { g1: { cloze: { attempts: 2, lastRate: 70, lastAt: now - 6 * day } } } },
        navigation: { lastPath: `/unit/${memoUnit.id}/memorisation`, lastAt: now - 6 * day },
        lastActivityAt: now - 6 * day
      },
      [staleUnit.id]: {
        answers: { q1: { answered: true, isCorrect: true, timestamp: now - 10 * day, lastCorrectAt: now - 10 * day } },
        navigation: { lastPath: `/unit/${staleUnit.id}/text`, lastAt: now - 10 * day },
        lastActivityAt: now - 10 * day
      }
    }));
  }, { now, wrongUnit, openUnit, memoUnit, staleUnit });
  await page.reload({ waitUntil: "domcontentloaded", timeout: 10000 });
  await waitForTodayReview(page);
  const afterKinds = await page.locator("[data-today-review-item]").evaluateAll((nodes) => nodes.map((node) => node.dataset.reviewKind));
  check(JSON.stringify(afterKinds) === JSON.stringify(["open-retry", "memorisation", "stale"]), "once an objective error is corrected, the next unresolved weaknesses and oldest clean review should move up");
  check((await page.locator('[data-today-review-item="3"]').getAttribute("href")) === `#/unit/${staleUnit.id}/text`, "stale-only review should preserve a safe recent learning path");

  await page.evaluate(() => localStorage.removeItem("ccsl_progress_v1"));
  await page.reload({ waitUntil: "domcontentloaded", timeout: 10000 });
  await page.waitForSelector("[data-quick-study-panel]");
  check(await page.locator("[data-today-review-panel]").count() === 0, "fresh learners should keep the existing 10-minute starter plan instead of receiving fake review tasks");
  check((await page.locator("[data-quick-study-panel]").textContent())?.includes("10 分鐘快速溫習"), "fresh learner fallback should remain the existing quick-study experience");

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(overflow <= 1, `today-review panel should not create mobile horizontal overflow (overflow=${overflow}px)`);
} finally {
  if (browser) await browser.close();
  await closeServer();
}

if (failures.length) process.exit(1);
console.log("Today-review smoke passed: unresolved evidence is prioritised, stale review only fills spare slots, fresh learners keep onboarding, and mobile layout remains stable.");
