import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";

const root = process.cwd();
const out = path.join(root, "reader-ui2-review");
fs.mkdirSync(out, { recursive: true });
const port = 4174;
const host = "127.0.0.1";

function type(file) {
  return ({ ".html":"text/html; charset=utf-8", ".css":"text/css; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".json":"application/json; charset=utf-8", ".mp3":"audio/mpeg" })[path.extname(file)] || "application/octet-stream";
}
const server = http.createServer((req, res) => {
  let pathname = decodeURIComponent((req.url || "/").split("?")[0]);
  if (pathname === "/") pathname = "/index.html";
  if (pathname === "/favicon.ico") { res.writeHead(204); res.end(); return; }
  const file = path.join(root, path.posix.normalize(pathname).replace(/^\/+/, ""));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end("Not found"); return; }
  const body = fs.readFileSync(file);
  res.writeHead(200, { "Content-Type": type(file), "Content-Length": String(body.length) });
  res.end(body);
});
await new Promise((resolve, reject) => { server.once("error", reject); server.listen(port, host, resolve); });

let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  await page.goto(`http://${host}:${port}/#/unit/yueyanglouji/text`, { waitUntil: "networkidle" });
  await page.locator(".reader-shell").waitFor({ state: "visible" });
  await page.screenshot({ path: path.join(out, "reader-desktop.jpg"), fullPage: true, quality: 88, type: "jpeg" });
  await page.locator("button.term").first().click();
  await page.locator(".annotation-popover").waitFor({ state: "visible" });
  await page.screenshot({ path: path.join(out, "annotation-desktop.jpg"), fullPage: false, quality: 90, type: "jpeg" });
  await page.keyboard.press("Escape");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`http://${host}:${port}/#/unit/yueyanglouji/text`, { waitUntil: "networkidle" });
  await page.locator(".reader-shell").waitFor({ state: "visible" });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 1) throw new Error(`mobile reader overflow ${overflow}px`);
  await page.screenshot({ path: path.join(out, "reader-mobile.jpg"), fullPage: true, quality: 88, type: "jpeg" });
  await page.locator("button.term").first().click();
  await page.locator(".annotation-popover").waitFor({ state: "visible" });
  await page.screenshot({ path: path.join(out, "annotation-mobile.jpg"), fullPage: false, quality: 90, type: "jpeg" });

  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`http://${host}:${port}/#/unit/denglou/text`, { waitUntil: "networkidle" });
  await page.locator(".reader-shell").waitFor({ state: "visible" });
  if (await page.locator(".reader-nav [role=tab]").count() !== 4) throw new Error("poem reader should expose four labelled couplets");
  await page.screenshot({ path: path.join(out, "reader-poem-desktop.jpg"), fullPage: true, quality: 88, type: "jpeg" });
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
console.log("Reader UI review frames captured.");
