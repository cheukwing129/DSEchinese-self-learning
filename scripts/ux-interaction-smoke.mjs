import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";

const root = process.cwd();
const HOST = "127.0.0.1";
const PORT = 4176;
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

async function waitForQuiz(page) {
  await page.locator(".quiz-shell").waitFor({ state: "visible", timeout: 5000 });
  await page.locator("#submit-btn").waitFor({ state: "visible", timeout: 5000 });
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

  // Submitted questions should have one clear forward action.
  await page.goto(`${baseURL}/#/unit/yueyanglouji/words/quiz?qi=0`, { waitUntil: "domcontentloaded", timeout: 10000 });
  await waitForQuiz(page);
  await page.locator("#submit-btn").click();
  await page.locator("#confirm-next-btn").waitFor({ state: "visible", timeout: 5000 });
  check(await page.locator("#next-btn").isHidden(), "submitted quiz should hide the duplicate bottom next button");
  check((await page.locator("#confirm-next-btn").textContent())?.trim() === "我已看完答案，下一題", "non-final submitted question should keep the review-first next label");
  await page.locator("#confirm-next-btn").click();
  await page.waitForFunction(() => document.querySelector(".quiz-progress-label")?.textContent?.includes("第 2 題"));

  // The final ordinary quiz question must finish the set instead of offering a dead next action.
  await page.goto(`${baseURL}/#/unit/yueyanglouji/words/quiz?qi=999`, { waitUntil: "domcontentloaded", timeout: 10000 });
  await waitForQuiz(page);
  await page.locator("#submit-btn").click();
  await page.locator("#confirm-next-btn").waitFor({ state: "visible", timeout: 5000 });
  check(await page.locator("#next-btn").isHidden(), "final submitted quiz should hide the duplicate bottom next button");
  check((await page.locator("#confirm-next-btn").textContent())?.trim() === "完成這組練習", "final ordinary quiz should use a completion label");
  check((await page.locator(".question-action-hint").textContent())?.includes("完成這組練習"), "final ordinary quiz hint should explain completion");
  await page.locator("#confirm-next-btn").click();
  await page.waitForURL((url) => url.hash === "#/unit/yueyanglouji", { timeout: 5000 });

  // Reorder practice should support one-step undo without clearing the whole attempt.
  await page.goto(`${baseURL}/#/unit/yueyanglouji/memorisation`, { waitUntil: "domcontentloaded", timeout: 10000 });
  await page.locator('[data-tab="reorder"]').waitFor({ state: "visible", timeout: 5000 });
  await page.locator('[data-tab="reorder"]').click();
  await page.locator("#reorder-reset-btn").waitFor({ state: "visible", timeout: 5000 });
  await page.locator("#reorder-undo-btn").waitFor({ state: "attached", timeout: 5000 });
  check(await page.locator("#reorder-undo-btn").isDisabled(), "reorder undo should start disabled before any placement");
  const chipCount = await page.locator("#reorder-pool [data-chip]").count();
  check(chipCount >= 2, "test sentence group should expose at least two reorder chips");
  if (chipCount >= 2) {
    await page.locator("#reorder-pool [data-chip]").first().click();
    await page.waitForFunction(() => document.querySelectorAll("#reorder-slots .reorder-chip.is-placed").length === 1);
    await page.locator("#reorder-undo-btn").waitFor({ state: "attached", timeout: 5000 });
    check(!(await page.locator("#reorder-undo-btn").isDisabled()), "reorder undo should enable after one placement");

    await page.locator("#reorder-pool [data-chip]").first().click();
    await page.waitForFunction(() => document.querySelectorAll("#reorder-slots .reorder-chip.is-placed").length === 2);
    await page.locator("#reorder-undo-btn").waitFor({ state: "attached", timeout: 5000 });
    await page.locator("#reorder-undo-btn").click();
    await page.waitForFunction(() => document.querySelectorAll("#reorder-slots .reorder-chip.is-placed").length === 1);
    check(await page.locator("#reorder-pool [data-chip]").count() >= 1, "undo should return only the latest placement to the pool");
  }
} finally {
  if (browser) await browser.close();
  await closeServer();
}

if (failures.length) process.exit(1);
console.log("RC UX interaction smoke passed: review-first quiz navigation, final-set completion and reorder undo are healthy.");
