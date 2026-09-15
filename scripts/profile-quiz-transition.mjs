import { spawn } from "node:child_process";
import { chromium } from "playwright";

const HOST = "127.0.0.1";
const PORT = 4179;
const baseURL = `http://${HOST}:${PORT}`;
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", HOST], { stdio: "ignore" });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitServer() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const response = await fetch(baseURL);
      if (response.ok) return;
    } catch {}
    await sleep(100);
  }
  throw new Error("static server did not start");
}

async function configure(context, page) {
  const session = await context.newCDPSession(page);
  await session.send("Network.enable");
  await session.send("Network.setCacheDisabled", { cacheDisabled: true });
  await session.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1000 * 1000) / 8,
    uploadThroughput: (0.75 * 1000 * 1000) / 8,
    connectionType: "cellular3g"
  });
  await session.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  return session;
}

async function installProbe(page) {
  await page.evaluate(() => {
    window.__quizTransitionProfile = { mountMs: 0, eventToMutationMs: null, start: null };
    if (!window.__profileOriginalMount) {
      window.__profileOriginalMount = App.mount;
      App.mount = function profiledMount(html) {
        const started = performance.now();
        const result = window.__profileOriginalMount(html);
        window.__quizTransitionProfile.mountMs += performance.now() - started;
        return result;
      };
    }
    const previousStem = document.querySelector(".q-stem")?.textContent?.trim() || "";
    const handler = (event) => {
      if (!event.target.closest?.("#confirm-next-btn")) return;
      document.removeEventListener("click", handler, true);
      window.__quizTransitionProfile.start = performance.now();
      const observer = new MutationObserver(() => {
        const currentStem = document.querySelector(".q-stem")?.textContent?.trim() || "";
        if (currentStem && currentStem !== previousStem) {
          window.__quizTransitionProfile.eventToMutationMs = performance.now() - window.__quizTransitionProfile.start;
          observer.disconnect();
        }
      });
      observer.observe(document.getElementById("app-main"), { childList: true, subtree: true });
    };
    document.addEventListener("click", handler, true);
  });
}

async function clickNext(page, label) {
  const before = await page.evaluate(() => ({
    scrollY: window.scrollY,
    buttonTop: document.getElementById("confirm-next-btn")?.getBoundingClientRect().top ?? null
  }));
  await installProbe(page);
  const oldStem = await page.locator(".q-stem").first().innerText();
  const started = Date.now();
  await page.locator("#confirm-next-btn").click();
  await page.waitForFunction((previous) => {
    const current = document.querySelector(".q-stem")?.textContent?.trim() || "";
    return current && current !== previous.trim();
  }, oldStem);
  const wallMs = Date.now() - started;
  await page.waitForTimeout(50);
  const after = await page.evaluate(() => ({
    ...window.__quizTransitionProfile,
    scrollY: window.scrollY,
    stemTop: document.querySelector(".q-stem")?.getBoundingClientRect().top ?? null,
    viewportHeight: window.innerHeight
  }));
  console.log(`${label}: wall ${wallMs}ms; event→mutation ${Math.round(after.eventToMutationMs ?? -1)}ms; App.mount ${Math.round(after.mountMs)}ms; scroll ${Math.round(before.scrollY)}→${Math.round(after.scrollY)}; buttonTop ${Math.round(before.buttonTop ?? -1)}; newStemTop ${Math.round(after.stemTop ?? -1)} / viewport ${after.viewportHeight}`);
}

let browser;
try {
  await waitServer();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const session = await configure(context, page);

  await page.goto(`${baseURL}/#/unit/yueyanglouji/words/quiz?qi=0`, { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.locator(".quiz-shell .q-stem").waitFor({ state: "visible", timeout: 12000 });
  await page.locator('[data-role="option-main"]').first().click();
  await page.locator("#submit-btn").click();
  await page.locator("#confirm-next-btn").waitFor({ state: "visible", timeout: 4000 });

  await clickNext(page, "immediate-after-submit");

  // Submit the second question without waiting for a selection; the engine still
  // exposes the answer review, which is sufficient to reproduce the transition.
  await page.locator("#submit-btn").click();
  await page.locator("#confirm-next-btn").waitFor({ state: "visible", timeout: 4000 });
  await page.waitForTimeout(650);
  await clickNext(page, "after-scroll-settles");

  await session.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  await context.close();
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
}
