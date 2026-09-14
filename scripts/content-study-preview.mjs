// Final visual review after word-bank polish.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";

const root = process.cwd();
const host = "127.0.0.1";
const port = 4177;
const base = `http://${host}:${port}`;

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return ({
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".mp3": "audio/mpeg"
  })[ext] || "application/octet-stream";
}

const server = http.createServer((req, res) => {
  let pathname = decodeURIComponent((req.url || "/").split("?")[0]);
  if (pathname === "/") pathname = "/index.html";
  if (pathname === "/favicon.ico") { res.writeHead(204); res.end(); return; }
  const rel = path.posix.normalize(pathname).replace(/^\/+/, "");
  const file = path.join(root, rel);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404); res.end("Not found"); return;
  }
  const body = fs.readFileSync(file);
  res.writeHead(200, { "Content-Type": contentType(file), "Content-Length": String(body.length) });
  res.end(body);
});

await new Promise((resolve, reject) => { server.once("error", reject); server.listen(port, host, resolve); });
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const routes = [
    ["words", "#/unit/yueyanglouji/words", ".words-study"],
    ["comprehension", "#/unit/yueyanglouji/comprehension", ".comprehension-study"],
    ["analysis", "#/unit/yueyanglouji/analysis", ".analysis-study"],
    ["theme", "#/unit/yueyanglouji/theme", ".theme-study"]
  ];
  fs.mkdirSync("tmp-content-study-review", { recursive: true });

  for (const [name, route, selector] of routes) {
    await page.goto(`${base}/${route}`, { waitUntil: "networkidle", timeout: 15000 });
    await page.locator(selector).waitFor({ state: "visible", timeout: 5000 });
    await page.screenshot({ path: `tmp-content-study-review/${name}-desktop.jpg`, type: "jpeg", quality: 86, fullPage: true });
  }

  await page.setViewportSize({ width: 390, height: 844 });
  for (const [name, route, selector] of routes) {
    await page.goto(`${base}/${route}`, { waitUntil: "networkidle", timeout: 15000 });
    await page.locator(selector).waitFor({ state: "visible", timeout: 5000 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 1) throw new Error(`${name} mobile overflow: ${overflow}px`);
    await page.screenshot({ path: `tmp-content-study-review/${name}-mobile.jpg`, type: "jpeg", quality: 86, fullPage: true });
  }
  await context.close();
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
