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

  const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const desktopPage = await desktop.newPage();
  desktopPage.on('pageerror', (err) => console.error('DESKTOP PAGE ERROR:', err.message));
  desktopPage.on('console', (msg) => { if (msg.type() === 'error') console.error('DESKTOP CONSOLE ERROR:', msg.text()); });
  await desktopPage.goto(`${base}/#/`, { waitUntil: "networkidle", timeout: 15000 });
  await desktopPage.locator('.home-hero').waitFor({ state: 'visible', timeout: 7000 });
  await desktopPage.screenshot({ path: 'tmp-launch-polish-review/home-desktop.jpg', type: 'jpeg', quality: 88, fullPage: false });
  await desktopPage.evaluate(() => App.renderFatalError('示範：暫時未能載入這一頁的資料。'));
  await desktopPage.locator('.launch-state.is-error').waitFor({ state: 'visible', timeout: 3000 });
  await desktopPage.screenshot({ path: 'tmp-launch-polish-review/error-desktop.jpg', type: 'jpeg', quality: 88, fullPage: false });
  await desktop.close();

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const mobilePage = await mobile.newPage();
  mobilePage.on('pageerror', (err) => console.error('MOBILE PAGE ERROR:', err.message));
  mobilePage.on('console', (msg) => { if (msg.type() === 'error') console.error('MOBILE CONSOLE ERROR:', msg.text()); });
  await mobilePage.goto(`${base}/#/`, { waitUntil: 'networkidle', timeout: 15000 });
  await mobilePage.locator('.home-hero').waitFor({ state: 'visible', timeout: 7000 });
  const headerOverflow = await mobilePage.evaluate(() => document.querySelector('.header-inner').scrollWidth - document.querySelector('.header-inner').clientWidth);
  if (headerOverflow > 1) throw new Error(`mobile header overflow ${headerOverflow}px`);
  await mobilePage.screenshot({ path: 'tmp-launch-polish-review/home-mobile.jpg', type: 'jpeg', quality: 88, fullPage: false });
  await mobilePage.evaluate(() => { window.location.hash = '#/not-a-real-route'; });
  await mobilePage.locator('.launch-state.is-not-found').waitFor({ state: 'visible', timeout: 3000 });
  await mobilePage.screenshot({ path: 'tmp-launch-polish-review/not-found-mobile.jpg', type: 'jpeg', quality: 88, fullPage: false });
  await mobile.close();
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
