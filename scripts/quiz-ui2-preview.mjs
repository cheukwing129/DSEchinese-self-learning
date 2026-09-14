import { spawn } from "node:child_process";
import fs from "node:fs";
import { chromium } from "playwright";

const outDir = "tmp-quiz-ui2-review";
fs.mkdirSync(outDir, { recursive: true });
const server = spawn("python3", ["-m", "http.server", "4173", "--bind", "127.0.0.1"], { stdio: "ignore" });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
await sleep(900);

let browser;
async function openQuiz(width, height) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4173/#/unit/yueyanglouji/words/quiz", { waitUntil: "networkidle", timeout: 15000 });
  await page.locator(".question-surface .q-stem").waitFor({ state: "visible", timeout: 5000 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 1) throw new Error(`quiz overflow at ${width}px: ${overflow}px`);
  return { context, page };
}

async function submitWrong(page) {
  const options = page.locator('[data-role="option-main"]');
  const count = await options.count();
  if (count < 2) {
    await page.locator("#submit-btn").click();
    return;
  }
  await options.nth(0).click();
  await page.locator("#submit-btn").click();
  await page.locator(".reveal-panel").waitFor({ state: "visible", timeout: 3000 });
  if (await page.locator(".question-surface.is-incorrect").count()) return;
  throw new Error("FIRST_OPTION_CORRECT");
}

try {
  browser = await chromium.launch({ headless: true });

  {
    const { context, page } = await openQuiz(1360, 900);
    await page.screenshot({ path: `${outDir}/quiz-desktop-before.jpg`, type: "jpeg", quality: 68, fullPage: false });
    await context.close();
  }

  let wrongCaptured = false;
  for (const optionIndex of [0, 1]) {
    const { context, page } = await openQuiz(1360, 900);
    const options = page.locator('[data-role="option-main"]');
    if (await options.count()) {
      await options.nth(optionIndex).click();
      await page.locator("#submit-btn").click();
      await page.locator(".reveal-panel").waitFor({ state: "visible", timeout: 3000 });
      if (await page.locator(".question-surface.is-incorrect").count()) {
        await page.locator(".reveal-panel").scrollIntoViewIfNeeded();
        await sleep(120);
        await page.screenshot({ path: `${outDir}/quiz-desktop-wrong.jpg`, type: "jpeg", quality: 68, fullPage: false });
        wrongCaptured = true;
        await context.close();
        break;
      }
    }
    await context.close();
  }
  if (!wrongCaptured) throw new Error("Could not capture a wrong single-choice state from first two options");

  {
    const { context, page } = await openQuiz(390, 844);
    await page.screenshot({ path: `${outDir}/quiz-mobile-before.jpg`, type: "jpeg", quality: 68, fullPage: false });
    const action = page.locator(".question-action-zone");
    const pos = await action.evaluate((el) => getComputedStyle(el).position);
    if (pos !== "sticky") throw new Error(`mobile question action should be sticky, got ${pos}`);
    await context.close();
  }

  for (const optionIndex of [0, 1]) {
    const { context, page } = await openQuiz(390, 844);
    const options = page.locator('[data-role="option-main"]');
    await options.nth(optionIndex).click();
    await page.locator("#submit-btn").click();
    await page.locator(".reveal-panel").waitFor({ state: "visible", timeout: 3000 });
    if (await page.locator(".question-surface.is-incorrect").count()) {
      await page.locator(".reveal-summary").scrollIntoViewIfNeeded();
      await sleep(120);
      await page.screenshot({ path: `${outDir}/quiz-mobile-wrong.jpg`, type: "jpeg", quality: 68, fullPage: false });
      await context.close();
      break;
    }
    await context.close();
  }
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
}

console.log("Quiz UI 2.0 review frames captured.");
