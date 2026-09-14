import fs from "node:fs";
import crypto from "node:crypto";
import { chromium } from "playwright";

const productionURL = String(process.env.PRODUCTION_URL || "").replace(/\/$/, "");
const errors = [];
const manifest = JSON.parse(fs.readFileSync("assets/build/asset-manifest.json", "utf8"));

function fail(message) {
  errors.push(message);
  console.error(`ERROR: ${message}`);
}

function check(condition, message) {
  if (!condition) fail(message);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pathname(url) {
  try { return new URL(url).pathname; } catch { return url; }
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

if (!/^https:\/\//i.test(productionURL)) {
  console.error("PRODUCTION_URL must be an https:// URL");
  process.exit(1);
}

const assetEntries = Object.entries(manifest.assets || {});
const appAsset = manifest.assets?.app?.path;
if (!appAsset || assetEntries.length < 7) {
  console.error("asset manifest is missing the expected runtime assets");
  process.exit(1);
}

async function waitForCurrentDeployment() {
  const deadline = Date.now() + 180000;
  let last = "no response";

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${productionURL}/`, { cache: "no-store", redirect: "follow" });
      const html = await response.text();
      last = `HTTP ${response.status}; current app reference ${html.includes(appAsset) ? "present" : "not present"}`;
      if (response.ok && html.includes(appAsset)) return;
    } catch (error) {
      last = error.message;
    }
    console.log(`Waiting for current Cloudflare deployment: ${last}`);
    await sleep(5000);
  }

  throw new Error(`production did not reach current asset manifest within 180s (${last})`);
}

async function verifyDeployedAssets() {
  for (const [name, asset] of assetEntries) {
    const response = await fetch(`${productionURL}${asset.path}`, { cache: "no-store", redirect: "follow" });
    check(response.ok, `${name} asset returned HTTP ${response.status}: ${asset.path}`);
    if (!response.ok) continue;

    const body = Buffer.from(await response.arrayBuffer());
    check(sha256(body) === asset.sha256, `${name} deployed bytes do not match current manifest SHA-256`);

    const cacheControl = response.headers.get("cache-control") || "";
    check(/max-age=31536000/i.test(cacheControl), `${name} is missing one-year browser cache: ${cacheControl || "<none>"}`);
    check(/immutable/i.test(cacheControl), `${name} is missing immutable cache directive: ${cacheControl || "<none>"}`);
  }

  const indexResponse = await fetch(`${productionURL}/index.html`, { cache: "no-store", redirect: "follow" });
  check(indexResponse.ok, `production index.html returned HTTP ${indexResponse.status}`);
  const indexCache = indexResponse.headers.get("cache-control") || "";
  check(/no-cache/i.test(indexCache), `index.html should remain revalidatable/no-cache, got: ${indexCache || "<none>"}`);

  const dataResponse = await fetch(`${productionURL}/data/curriculum.json`, { cache: "no-store", redirect: "follow" });
  check(dataResponse.ok, `production curriculum data returned HTTP ${dataResponse.status}`);
  const dataCache = dataResponse.headers.get("cache-control") || "";
  check(/no-cache/i.test(dataCache), `data JSON should remain revalidatable/no-cache, got: ${dataCache || "<none>"}`);
}

await waitForCurrentDeployment();
await verifyDeployedAssets();

let browser;
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  page.on("requestfailed", (req) => fail(`request failed: ${req.method()} ${req.url()} (${req.failure()?.errorText || "unknown"})`));
  page.on("pageerror", (err) => fail(`page runtime error: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") fail(`console error: ${msg.text()}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && pathname(response.url()) !== "/favicon.ico") {
      fail(`HTTP ${response.status()}: ${response.url()}`);
    }
  });

  await page.goto(`${productionURL}/#/`, { waitUntil: "networkidle", timeout: 20000 });
  await page.locator(".page-title", { hasText: "讀懂經典" }).waitFor({ state: "visible", timeout: 8000 });
  check(await page.locator(".map-card").count() === 16, "production home should render 16 curriculum cards");
  const homeOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(homeOverflow <= 1, `production mobile home has horizontal overflow of ${homeOverflow}px`);

  await page.evaluate(() => { window.location.hash = "#/unit/yueyanglouji/text"; });
  await page.locator(".page-title", { hasText: "原文與誦讀" }).waitFor({ state: "visible", timeout: 10000 });
  await page.locator("button.term").first().click();
  await page.locator('.annotation-popover[role="dialog"]').waitFor({ state: "visible", timeout: 4000 });
  await page.keyboard.press("Escape");

  await page.evaluate(() => { window.location.hash = "#/unit/yueyanglouji/words/quiz"; });
  await page.locator(".q-stem").first().waitFor({ state: "visible", timeout: 10000 });
  const quizOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(quizOverflow <= 1, `production mobile quiz has horizontal overflow of ${quizOverflow}px`);
  await page.locator("#submit-btn").click();
  await page.locator("#reveal-slot .reveal-panel").waitFor({ state: "visible", timeout: 4000 });

  await page.evaluate(() => { window.location.hash = "#/unit/yueyanglouji/memorisation"; });
  await page.locator(".page-title", { hasText: "背誦精華" }).waitFor({ state: "visible", timeout: 10000 });
  await page.locator('[data-tab="cloze"]').click();
  await page.locator("#cloze-check-btn").waitFor({ state: "visible", timeout: 4000 });

  await context.close();
} finally {
  if (browser) await browser.close();
}

if (errors.length) {
  console.error(`Production smoke failed with ${errors.length} error(s).`);
  process.exit(1);
}

console.log(`Production deployment smoke passed at ${productionURL}. Current hashed assets, cache headers, core routes and mobile layout are healthy.`);
