import { spawn } from "node:child_process";
import fs from "node:fs";
import { chromium } from "playwright";

const outDir = "tmp-ui-preview";
fs.mkdirSync(outDir, { recursive: true });
const server = spawn("python3", ["-m", "http.server", "4173", "--bind", "127.0.0.1"], { stdio: "ignore" });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
await sleep(900);

let browser;
try {
  browser = await chromium.launch({ headless: true });

  for (const spec of [
    { name: "home-desktop", width: 1440, height: 1050, hash: "#/" },
    { name: "unit-desktop", width: 1440, height: 1100, hash: "#/unit/yueyanglouji" },
    { name: "home-mobile", width: 390, height: 844, hash: "#/" },
    { name: "unit-mobile", width: 390, height: 844, hash: "#/unit/yueyanglouji" }
  ]) {
    const context = await browser.newContext({ viewport: { width: spec.width, height: spec.height } });
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:4173/${spec.hash}`, { waitUntil: "networkidle", timeout: 15000 });
    await page.screenshot({ path: `${outDir}/${spec.name}.png`, fullPage: true });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 1) throw new Error(`${spec.name} horizontal overflow: ${overflow}px`);
    await context.close();
  }
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
}

console.log("UI 2.0 previews captured without horizontal overflow.");
