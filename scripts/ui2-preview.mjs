import { spawn } from "node:child_process";
import fs from "node:fs";
import { chromium } from "playwright";

const outDir = "tmp-ui-review";
fs.mkdirSync(outDir, { recursive: true });
const server = spawn("python3", ["-m", "http.server", "4173", "--bind", "127.0.0.1"], { stdio: "ignore" });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
await sleep(900);

let browser;
try {
  browser = await chromium.launch({ headless: true });

  async function capture(name, width, height, hash, selector = null) {
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:4173/${hash}`, { waitUntil: "networkidle", timeout: 15000 });
    if (selector) {
      await page.locator(selector).evaluate((el) => el.scrollIntoView({ block: "start" }));
      await page.evaluate(() => window.scrollBy(0, -105));
      await sleep(180);
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 1) throw new Error(`${name} horizontal overflow: ${overflow}px`);
    await page.screenshot({ path: `${outDir}/${name}.jpg`, type: "jpeg", quality: 62, fullPage: false });
    await context.close();
  }

  await capture("home-desktop-top", 1360, 900, "#/");
  await capture("unit-desktop-top", 1360, 900, "#/unit/yueyanglouji");
  await capture("unit-desktop-bento", 1360, 900, "#/unit/yueyanglouji", "#core-learning-title");
  await capture("home-mobile-top", 390, 844, "#/");
  await capture("unit-mobile-top", 390, 844, "#/unit/yueyanglouji");
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
}

console.log("Final UI 2.0 review frames captured without horizontal overflow.");
