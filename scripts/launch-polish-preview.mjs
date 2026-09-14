import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";

const root = process.cwd();
const host = "127.0.0.1";
const port = 4182;
const base = `http://${host}:${port}`;
function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return ({ ".html":"text/html; charset=utf-8", ".css":"text/css; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".json":"application/json; charset=utf-8", ".svg":"image/svg+xml", ".png":"image/png", ".mp3":"audio/mpeg" })[ext] || "application/octet-stream";
}
const server = http.createServer((req, res) => {
  let pathname = decodeURIComponent((req.url || "/").split("?")[0]);
  if (pathname === "/") pathname = "/index.html";
  if (pathname === "/favicon.ico") { res.writeHead(204); res.end(); return; }
  const rel = path.posix.normalize(pathname).replace(/^\/+/, "");
  const file = path.join(root, rel);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end("Not found"); return; }
  const body = fs.readFileSync(file);
  res.writeHead(200, { "Content-Type": contentType(file), "Content-Length": String(body.length) });
  res.end(body);
});
await new Promise((resolve, reject) => { server.once("error", reject); server.listen(port, host, resolve); });
const browser = await chromium.launch({ headless: true });
try {
  fs.mkdirSync("tmp-launch-polish-review", { recursive: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', (err) => console.error('PAGE ERROR:', err.message));
  page.on('console', (msg) => { if (msg.type() === 'error') console.error('CONSOLE ERROR:', msg.text()); });

  await page.goto(`${base}/#/`, { waitUntil: "networkidle", timeout: 15000 });
  try {
    await page.locator('.home-hero').waitFor({ state: 'visible', timeout: 7000 });
  } catch (err) {
    console.error('MAIN TEXT:', (await page.locator('#app-main').innerText()).slice(0, 1200));
    throw err;
  }
  await page.screenshot({ path: 'tmp-launch-polish-review/home-desktop.jpg', type: 'jpeg', quality: 88, fullPage: false });
  await page.evaluate(() => App.renderFatalError('示範：暫時未能載入這一頁的資料。'));
  await page.screenshot({ path: 'tmp-launch-polish-review/error-desktop.jpg', type: 'jpeg', quality: 88, fullPage: false });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/#/`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.locator('.home-hero').waitFor({ state: 'visible', timeout: 7000 });
  const headerOverflow = await page.evaluate(() => document.querySelector('.header-inner').scrollWidth - document.querySelector('.header-inner').clientWidth);
  if (headerOverflow > 1) throw new Error(`mobile header overflow ${headerOverflow}px`);
  await page.screenshot({ path: 'tmp-launch-polish-review/home-mobile.jpg', type: 'jpeg', quality: 88, fullPage: false });
  await page.evaluate(() => { window.location.hash = '#/not-a-real-route'; });
  await page.locator('.launch-state.is-not-found').waitFor({ state: 'visible', timeout: 3000 });
  await page.screenshot({ path: 'tmp-launch-polish-review/not-found-mobile.jpg', type: 'jpeg', quality: 88, fullPage: false });
  await context.close();
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
