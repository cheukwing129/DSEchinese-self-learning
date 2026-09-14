import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const root = process.cwd();
const out = path.join(root, "progress-ui2-review");
fs.mkdirSync(out, { recursive: true });
const type = (p) => ({ ".html":"text/html", ".css":"text/css", ".js":"text/javascript", ".json":"application/json", ".mp3":"audio/mpeg" }[path.extname(p)] || "application/octet-stream");
const server = http.createServer((req, res) => {
  let p = decodeURIComponent((req.url || "/").split("?")[0]);
  if (p === "/") p = "/index.html";
  if (p === "/favicon.ico") { res.writeHead(204); res.end(); return; }
  const f = path.join(root, p.replace(/^\/+/, ""));
  if (!f.startsWith(root) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { res.writeHead(404); res.end(); return; }
  const body = fs.readFileSync(f); res.writeHead(200, { "Content-Type": type(f), "Content-Length": body.length }); res.end(body);
});
await new Promise((resolve) => server.listen(4173, "127.0.0.1", resolve));
let browser;
try {
  browser = await chromium.launch({ headless:true });
  const context = await browser.newContext({ viewport:{ width:1280, height:900 } });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4173/#/unit/yueyanglouji/words/quiz", { waitUntil:"networkidle" });
  await page.locator(".q-stem").first().waitFor({ state:"visible", timeout:5000 });
  await page.locator("#submit-btn").click();
  await page.locator(".reveal-panel").waitFor({ state:"visible", timeout:3000 });

  await page.evaluate(() => { location.hash = "#/unit/yueyanglouji/progress"; });
  await page.locator(".unit-progress-hero").waitFor({ state:"visible", timeout:5000 });
  await page.screenshot({ path:path.join(out,"progress-desktop.jpg"), fullPage:true, type:"jpeg", quality:88 });

  await page.evaluate(() => { location.hash = "#/overview"; });
  await page.locator(".overview-hero").waitFor({ state:"visible", timeout:7000 });
  await page.screenshot({ path:path.join(out,"overview-desktop.jpg"), fullPage:true, type:"jpeg", quality:88 });

  await page.setViewportSize({ width:390, height:844 });
  await page.evaluate(() => { location.hash = "#/unit/yueyanglouji/progress"; });
  await page.locator(".unit-progress-hero").waitFor({ state:"visible", timeout:5000 });
  await page.screenshot({ path:path.join(out,"progress-mobile.jpg"), fullPage:true, type:"jpeg", quality:88 });

  await page.evaluate(() => { location.hash = "#/overview"; });
  await page.locator(".overview-hero").waitFor({ state:"visible", timeout:7000 });
  await page.screenshot({ path:path.join(out,"overview-mobile.jpg"), fullPage:true, type:"jpeg", quality:88 });

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  if (overflow > 1) throw new Error(`mobile overview overflow ${overflow}px`);
  await context.close();
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
