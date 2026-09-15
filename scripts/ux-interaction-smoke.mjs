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

async function waitForQuizEnhancement(page, expectedLabel = null) {
  await page.waitForFunction((label) => {
    const next = document.getElementById("next-btn");
    const confirm = document.getElementById("confirm-next-btn");
    if (!next || !confirm || !next.hidden) return false;
    return label == null || confirm.textContent.trim() === label;
  }, expectedLabel, { timeout: 5000 });
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
  await waitForQuizEnhancement(page, "我已看完答案，下一題");
  check(await page.locator("#next-btn").isHidden(), "submitted quiz should hide the duplicate bottom next button");
  check((await page.locator("#confirm-next-btn").textContent())?.trim() === "我已看完答案，下一題", "non-final submitted question should keep the review-first next label");
  await page.locator("#confirm-next-btn").click();
  await page.waitForFunction(() => document.querySelector(".quiz-progress-label")?.textContent?.includes("第 2 題"));

  // The final ordinary quiz question must finish the set instead of offering a dead next action.
  await page.goto(`${baseURL}/#/unit/yueyanglouji/words/quiz?qi=999`, { waitUntil: "domcontentloaded", timeout: 10000 });
  await waitForQuiz(page);
  await page.locator("#submit-btn").click();
  await page.locator("#confirm-next-btn").waitFor({ state: "visible", timeout: 5000 });
  await waitForQuizEnhancement(page, "完成這組練習");
  await page.waitForFunction(() => document.querySelector(".question-action-hint")?.textContent?.includes("完成這組練習"), null, { timeout: 5000 });
  check(await page.locator("#next-btn").isHidden(), "final submitted quiz should hide the duplicate bottom next button");
  check((await page.locator("#confirm-next-btn").textContent())?.trim() === "完成這組練習", "final ordinary quiz should use a completion label");
  check((await page.locator(".question-action-hint").textContent())?.includes("完成這組練習"), "final ordinary quiz hint should explain completion");
  await page.locator("#confirm-next-btn").click();
  await page.waitForURL((url) => url.hash === "#/unit/yueyanglouji", { timeout: 5000 });

  // Open answers should turn scoring elements into a persistent, non-scored self-review checklist.
  await page.goto(`${baseURL}/#/unit/denglou/theme/quiz?qi=0`, { waitUntil: "domcontentloaded", timeout: 10000 });
  await waitForQuiz(page);
  await page.locator("#input-long").fill("兩人都關心天下與國事，但表達方式並不完全相同。");
  await page.locator("#submit-btn").click();
  await page.locator(".open-self-review-summary").waitFor({ state: "visible", timeout: 5000 });
  const reviewCheckboxes = page.locator(".open-self-review-checkbox");
  check(await reviewCheckboxes.count() === 4, "open-answer scoring elements should become four self-review checkboxes");
  check((await page.locator("[data-open-review-count]").textContent())?.includes("0/4"), "open-answer self review should start at 0/4 checked");
  check((await page.locator(".open-self-review-summary").innerText()).includes("不是系統分數"), "open-answer self review should state that it is not a system score");

  await reviewCheckboxes.first().check();
  await page.waitForFunction(() => document.querySelector("[data-open-review-count]")?.textContent?.includes("1/4"));
  await page.locator('[data-open-review-decision="retry"]').click();
  await page.waitForFunction(() => document.querySelector("[data-open-review-status]")?.textContent?.includes("稍後重做"));

  const retryReview = await page.evaluate(() => {
    const all = JSON.parse(localStorage.getItem("ccsl_progress_v1") || "{}");
    const reviews = Object.values(all.denglou?.openQuestionReviews || {});
    return reviews[0] || null;
  });
  check(!!retryReview, "open-answer self review should persist inside the existing progress store");
  check(retryReview?.decision === "retry", "open-answer self review should persist the retry decision");
  check(Object.keys(retryReview?.checked || {}).length === 1, "open-answer self review should persist checked scoring elements");

  await page.reload({ waitUntil: "domcontentloaded", timeout: 10000 });
  await page.locator(".quiz-shell.is-submitted").waitFor({ state: "visible", timeout: 5000 });
  await page.locator(".open-self-review-summary").waitFor({ state: "visible", timeout: 5000 });
  check(await page.locator(".open-self-review-checkbox").first().isChecked(), "open-answer checklist state should survive reload");
  check(await page.locator('[data-open-review-decision="retry"]').getAttribute("aria-pressed") === "true", "open-answer retry decision should survive reload");

  await page.locator('[data-open-review-decision="mastered"]').click();
  await page.waitForFunction(() => document.querySelector("[data-open-review-status]")?.textContent?.includes("我已掌握"));
  const masteredDecision = await page.evaluate(() => {
    const all = JSON.parse(localStorage.getItem("ccsl_progress_v1") || "{}");
    return Object.values(all.denglou?.openQuestionReviews || {})[0]?.decision || null;
  });
  check(masteredDecision === "mastered", "open-answer self review should update the persisted learning decision");

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
    await page.waitForFunction(() => {
      const undo = document.getElementById("reorder-undo-btn");
      return !!undo && !undo.disabled;
    });
    check(!(await page.locator("#reorder-undo-btn").isDisabled()), "reorder undo should enable after one placement");

    await page.locator("#reorder-pool [data-chip]").first().click();
    await page.waitForFunction(() => document.querySelectorAll("#reorder-slots .reorder-chip.is-placed").length === 2);
    await page.waitForFunction(() => {
      const undo = document.getElementById("reorder-undo-btn");
      return !!undo && !undo.disabled;
    });
    await page.locator("#reorder-undo-btn").click();
    await page.waitForFunction(() => document.querySelectorAll("#reorder-slots .reorder-chip.is-placed").length === 1);
    check(await page.locator("#reorder-pool [data-chip]").count() >= 1, "undo should return only the latest placement to the pool");
  }
} finally {
  if (browser) await browser.close();
  await closeServer();
}

if (failures.length) process.exit(1);
console.log("RC UX interaction smoke passed: quiz navigation, open-answer self review persistence and reorder undo are healthy.");
