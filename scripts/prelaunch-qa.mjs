import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";

const root = process.cwd();
const HOST = "127.0.0.1";
const PORT = 4174;
const baseURL = `http://${HOST}:${PORT}`;
const failures = [];
let currentCheck = "bootstrap";

const QUESTION_TYPES = [
  "single_choice",
  "multi_select",
  "true_false_unknown",
  "matching",
  "extract_sentence",
  "cloze_choice",
  "short_answer",
  "long_answer",
  "fill_table"
];

const BANK_ROUTE = {
  words: "words/quiz",
  content: "comprehension/quiz",
  "structure-skill": "analysis/quiz",
  theme: "theme/quiz",
  "cross-text": "cross-text/quiz/all"
};

const CORE_ROUTES = [
  ["", ".unit-hero", "unit home"],
  ["/text", ".reader-shell", "reader"],
  ["/words", ".words-study", "words"],
  ["/comprehension", ".comprehension-study", "comprehension"],
  ["/analysis", ".analysis-study", "analysis"],
  ["/theme", ".theme-study", "theme"],
  ["/memorisation", "#memo-body", "memorisation"],
  ["/cross-text", ".cross-text-banner", "cross-text landing"],
  ["/progress", ".unit-progress-hero", "unit progress"],
  ["/challenge", "#start-challenge-btn", "challenge setup"]
];

function readJSON(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function fail(message) {
  const full = `${currentCheck}: ${message}`;
  failures.push(full);
  console.error(`ERROR: ${full}`);
}

function check(condition, message) {
  if (!condition) fail(message);
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return ({
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".mp3": "audio/mpeg"
  })[ext] || "application/octet-stream";
}

function safeFilePath(urlPath) {
  let pathname;
  try {
    pathname = decodeURIComponent(urlPath.split("?")[0]);
  } catch {
    return null;
  }
  if (pathname === "/") pathname = "/index.html";
  if (pathname === "/favicon.ico") return "__favicon__";
  const relative = path.posix.normalize(pathname).replace(/^\/+/, "");
  if (!relative || relative.startsWith("..") || relative.includes("/../")) return null;
  const full = path.join(root, relative);
  if (!full.startsWith(root + path.sep) && full !== root) return null;
  return full;
}

const server = http.createServer((req, res) => {
  const filePath = safeFilePath(req.url || "/");
  if (filePath === "__favicon__") {
    res.writeHead(204);
    res.end();
    return;
  }
  if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }
  const body = fs.readFileSync(filePath);
  res.writeHead(200, {
    "Content-Type": contentType(filePath),
    "Content-Length": String(body.length)
  });
  res.end(body);
});

function listen() {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(PORT, HOST, resolve);
  });
}

function closeServer() {
  return new Promise((resolve) => server.close(resolve));
}

function buildCatalog() {
  const curriculum = readJSON("data/curriculum.json");
  const units = (curriculum.units || []).filter((entry) => entry.status === "available").map((entry) => {
    const unitDir = `data/units/${entry.id}`;
    const unit = readJSON(`${unitDir}/unit.json`);
    const banks = [];
    for (const bankRel of unit.question_bank_files || []) {
      const data = readJSON(`${unitDir}/${bankRel}`);
      banks.push({
        bank: data.bank,
        questions: data.questions || [],
        file: `${unitDir}/${bankRel}`
      });
    }
    return { entry, unit, banks };
  });

  const samples = new Map();
  const composites = { items: null, part2: null };
  const allQuestions = [];
  for (const record of units) {
    for (const bank of record.banks) {
      check(Boolean(BANK_ROUTE[bank.bank]), `${record.entry.id} uses unmapped bank '${bank.bank}'`);
      bank.questions.forEach((question, index) => {
        const item = { record, bank, question, index };
        allQuestions.push(item);
        if (!composites.items && Array.isArray(question.items) && question.items.length) composites.items = item;
        if (!composites.part2 && question.part2) composites.part2 = item;
      });
    }
  }

  for (const type of QUESTION_TYPES) {
    const simple = allQuestions.find(({ question }) => question.question_type === type && !(question.items || []).length && !question.part2);
    const any = allQuestions.find(({ question }) => question.question_type === type);
    samples.set(type, simple || any || null);
  }

  return { units, samples, composites, questionCount: allQuestions.length };
}

function attachDiagnostics(page) {
  page.on("pageerror", (error) => fail(`runtime error: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") fail(`console error: ${message.text()}`);
  });
  page.on("requestfailed", (request) => fail(`request failed: ${request.method()} ${request.url()} (${request.failure()?.errorText || "unknown"})`));
  page.on("response", (response) => {
    if (response.status() >= 400) fail(`HTTP ${response.status()}: ${response.url()}`);
  });
}

async function addCleanStorage(context) {
  await context.addInitScript(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
  });
}

async function visit(page, route, selector, label, { checkOverflow = true } = {}) {
  currentCheck = label;
  try {
    await page.goto(`${baseURL}/#${route}`, { waitUntil: "domcontentloaded", timeout: 12000 });
    await page.locator(selector).first().waitFor({ state: "visible", timeout: 8000 });
    await page.locator("#app-main .loading-state").waitFor({ state: "detached", timeout: 8000 }).catch(() => {});
  } catch (error) {
    fail(`route ${route} did not become ready (${error.message})`);
    return false;
  }

  const shellState = await page.evaluate(() => ({
    fatal: Boolean(document.querySelector(".launch-state.is-error")),
    mainText: document.getElementById("app-main")?.innerText?.trim() || "",
    overflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth)
  }));
  check(!shellState.fatal, `route ${route} rendered the fatal error state`);
  check(shellState.mainText.length > 10, `route ${route} rendered almost no visible content`);
  if (checkOverflow) check(shellState.overflow <= 2, `route ${route} has ${shellState.overflow}px horizontal overflow`);
  return true;
}

function sampleRoute(sample) {
  const { record, bank, question, index } = sample;
  const bankPath = BANK_ROUTE[bank.bank];
  if (bank.bank === "cross-text") {
    return `/unit/${record.entry.id}/${bankPath}?qid=${encodeURIComponent(question.id)}`;
  }
  return `/unit/${record.entry.id}/${bankPath}?qi=${index}`;
}

async function answerMain(page, question) {
  switch (question.question_type) {
    case "single_choice":
      await page.locator('[data-role="option-main"]').first().click();
      break;
    case "multi_select":
      await page.locator('[data-role="option-main-multi"]').first().click();
      break;
    case "true_false_unknown":
      if (Array.isArray(question.statements)) {
        for (let i = 0; i < question.statements.length; i += 1) {
          await page.locator(`.tf-btn[data-prefix="main"][data-stmt="${i}"]`).first().click();
        }
      } else {
        await page.locator('.tf-btn-single[data-prefix="main"]').first().click();
      }
      break;
    case "matching":
      if (Array.isArray(question.option_labels)) {
        for (let i = 0; i < (question.rows || []).length; i += 1) {
          await page.locator(`.match-multi-btn[data-prefix="main"][data-row="${i}"]`).first().click();
        }
      } else {
        const rows = question.rows || [];
        for (let i = 0; i < rows.length; i += 1) {
          await page.locator(`select[data-prefix="main"][data-match-row="${i}"]`).selectOption({ index: 1 });
        }
      }
      break;
    case "extract_sentence":
      await page.locator("#input-extract").fill("驗收摘錄答案");
      break;
    case "cloze_choice":
      for (const blank of question.blanks || []) {
        await page.locator('[data-role="cloze-option"][data-prefix="main"]').filter({ has: page.locator(".option-copy") }).evaluateAll((nodes, blankId) => {
          const node = nodes.find((item) => item.dataset.blank === blankId);
          if (node) node.click();
        }, blank.id);
      }
      break;
    case "short_answer":
      if (await page.locator("#input-short").count()) await page.locator("#input-short").fill("驗收短答答案");
      break;
    case "long_answer":
      if (await page.locator("#input-long").count()) await page.locator("#input-long").fill("驗收長答答案：提出觀點並以文本證據說明。");
      break;
    case "fill_table": {
      const inputs = page.locator('[data-fillkey][data-prefix="main"]');
      const count = await inputs.count();
      for (let i = 0; i < count; i += 1) await inputs.nth(i).fill(`驗收${i + 1}`);
      break;
    }
    default:
      throw new Error(`unsupported QA interaction type ${question.question_type}`);
  }

  const itemInputs = page.locator('[id^="item-input-"]');
  const itemCount = await itemInputs.count();
  for (let i = 0; i < itemCount; i += 1) await itemInputs.nth(i).fill(`驗收分項${i + 1}`);

  if (question.part2) {
    const textInput = page.locator("#input-part2");
    if (await textInput.count()) {
      await textInput.fill("驗收第二部分答案");
    } else if (await page.locator('[data-role="option-part2"]').count()) {
      await page.locator('[data-role="option-part2"]').first().click();
    } else if (await page.locator('[data-role="option-part2-multi"]').count()) {
      await page.locator('[data-role="option-part2-multi"]').first().click();
    } else if (await page.locator('.tf-btn[data-prefix="part2"]').count()) {
      const statements = question.part2.statements || [];
      for (let i = 0; i < statements.length; i += 1) {
        await page.locator(`.tf-btn[data-prefix="part2"][data-stmt="${i}"]`).first().click();
      }
    } else if (await page.locator('.tf-btn-single[data-prefix="part2"]').count()) {
      await page.locator('.tf-btn-single[data-prefix="part2"]').first().click();
    } else if (await page.locator('[data-role="cloze-option"][data-prefix="part2"]').count()) {
      for (const blank of question.part2.blanks || []) {
        await page.locator('[data-role="cloze-option"][data-prefix="part2"]').evaluateAll((nodes, blankId) => {
          const node = nodes.find((item) => item.dataset.blank === blankId);
          if (node) node.click();
        }, blank.id);
      }
    } else if (await page.locator('select[data-prefix="part2"]').count()) {
      const selects = page.locator('select[data-prefix="part2"]');
      for (let i = 0; i < await selects.count(); i += 1) await selects.nth(i).selectOption({ index: 1 });
    } else if (await page.locator('[data-fillkey][data-prefix="part2"]').count()) {
      const inputs = page.locator('[data-fillkey][data-prefix="part2"]');
      for (let i = 0; i < await inputs.count(); i += 1) await inputs.nth(i).fill(`驗收第二部分${i + 1}`);
    }
  }
}

async function verifyStoredRecord(page, unitId, questionId, predicate, label) {
  const record = await page.evaluate(({ unitId: id, questionId: qid }) => {
    try {
      const all = JSON.parse(localStorage.getItem("ccsl_progress_v1") || "{}");
      return all?.[id]?.answers?.[qid] || null;
    } catch {
      return null;
    }
  }, { unitId, questionId });
  check(Boolean(record && record.answered), `${label} did not persist an answered record`);
  if (record && predicate) check(predicate(record), `${label} persisted the wrong response shape`);
}

async function runQuestionTypeMatrix(page, samples) {
  for (const type of QUESTION_TYPES) {
    const sample = samples.get(type);
    currentCheck = `question type ${type}`;
    if (!sample) {
      fail(`no ${type} question exists in the live banks`);
      continue;
    }
    const route = sampleRoute(sample);
    const ready = await visit(page, route, ".quiz-shell .q-stem", `question type ${type}`);
    if (!ready) continue;
    try {
      await answerMain(page, sample.question);
      await page.locator("#submit-btn").click();
      await page.locator("#reveal-slot .reveal-panel").waitFor({ state: "visible", timeout: 5000 });
      check(await page.locator(".quiz-shell.is-submitted").count() === 1, `${type} did not enter submitted state`);
      await verifyStoredRecord(page, sample.record.entry.id, sample.question.id, null, type);
    } catch (error) {
      fail(`${type} interaction failed (${error.message})`);
    }
  }
}

async function runCompositeChecks(page, composites) {
  if (composites.items) {
    const { record, question } = composites.items;
    const ready = await visit(page, sampleRoute(composites.items), ".quiz-shell .q-stem", "composite items response");
    if (ready) {
      try {
        await answerMain(page, question);
        await page.locator("#submit-btn").click();
        await page.locator("#reveal-slot .reveal-panel").waitFor({ state: "visible", timeout: 5000 });
        await verifyStoredRecord(page, record.entry.id, question.id, (saved) => saved.selected && typeof saved.selected === "object" && saved.selected.items && Object.keys(saved.selected.items).length > 0, "composite items");
      } catch (error) {
        fail(`composite items interaction failed (${error.message})`);
      }
    }
  } else {
    currentCheck = "composite items response";
    fail("no items composite question exists in live banks");
  }

  if (composites.part2) {
    const { record, question } = composites.part2;
    const ready = await visit(page, sampleRoute(composites.part2), ".quiz-shell .q-stem", "composite part2 response");
    if (ready) {
      try {
        await answerMain(page, question);
        await page.locator("#submit-btn").click();
        await page.locator("#reveal-slot .reveal-panel").waitFor({ state: "visible", timeout: 5000 });
        await verifyStoredRecord(page, record.entry.id, question.id, (saved) => saved.selected && typeof saved.selected === "object" && Object.prototype.hasOwnProperty.call(saved.selected, "part2"), "composite part2");
      } catch (error) {
        fail(`composite part2 interaction failed (${error.message})`);
      }
    }
  } else {
    currentCheck = "composite part2 response";
    fail("no part2 composite question exists in live banks");
  }
}

async function runEmptyStateChecks(browser, representativeId) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await addCleanStorage(context);
  const page = await context.newPage();
  attachDiagnostics(page);

  await visit(page, `/unit/${representativeId}/challenge/run`, ".empty-state", "challenge run without setup");
  check((await page.locator("#app-main").innerText()).includes("尚未設定挑戰範圍"), "challenge run should explain that setup is required");

  await visit(page, `/unit/${representativeId}/challenge/result`, ".empty-state", "challenge result without setup");
  check((await page.locator("#app-main").innerText()).includes("找不到挑戰紀錄"), "challenge result should explain that no attempt exists");

  await visit(page, `/unit/${representativeId}/progress/retry-wrong`, ".page-title", "unit retry with no wrong answers");
  check((await page.locator("#app-main").innerText()).includes("目前沒有待修正錯題"), "fresh unit retry should show the clean empty state");

  await visit(page, "/overview/retry/all", ".page-title", "cross-unit retry with no wrong answers");
  check((await page.locator("#app-main").innerText()).includes("沒有待修正錯題"), "fresh cross-unit retry should show the clean empty state");

  await context.close();
}

async function runHistoryCheck(browser, representativeId) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await addCleanStorage(context);
  const page = await context.newPage();
  attachDiagnostics(page);
  currentCheck = "browser back/forward routing";
  await page.goto(`${baseURL}/#/unit/${representativeId}`, { waitUntil: "domcontentloaded", timeout: 12000 });
  await page.locator(".unit-hero").waitFor({ state: "visible", timeout: 8000 });
  await page.goto(`${baseURL}/#/unit/${representativeId}/text`, { waitUntil: "domcontentloaded", timeout: 12000 });
  await page.locator(".reader-shell").waitFor({ state: "visible", timeout: 8000 });
  await page.goBack({ waitUntil: "domcontentloaded", timeout: 12000 });
  await page.locator(".unit-hero").waitFor({ state: "visible", timeout: 8000 });
  check(page.url().endsWith(`#/unit/${representativeId}`), "browser Back should return to the unit home hash route");
  await page.goForward({ waitUntil: "domcontentloaded", timeout: 12000 });
  await page.locator(".reader-shell").waitFor({ state: "visible", timeout: 8000 });
  check(page.url().endsWith(`#/unit/${representativeId}/text`), "browser Forward should return to the reader hash route");
  await context.close();
}

async function runMobileMatrix(browser, unitIds) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await addCleanStorage(context);
  const page = await context.newPage();
  attachDiagnostics(page);
  const representativeRoutes = [
    ["", ".unit-hero", "home"],
    ["/text", ".reader-shell", "reader"],
    ["/words", ".words-study", "words"],
    ["/comprehension", ".comprehension-study", "comprehension"],
    ["/analysis", ".analysis-study", "analysis"],
    ["/theme", ".theme-study", "theme"],
    ["/memorisation", "#memo-body", "memorisation"],
    ["/words/quiz", ".quiz-shell", "quiz"],
    ["/progress", ".unit-progress-hero", "progress"],
    ["/challenge", "#start-challenge-btn", "challenge"]
  ];

  for (const unitId of unitIds) {
    for (const [suffix, selector, label] of representativeRoutes) {
      await visit(page, `/unit/${unitId}${suffix}`, selector, `mobile ${unitId} ${label}`);
    }
  }
  await visit(page, "/overview", ".overview-hero", "mobile cross-unit overview");
  await context.close();
}

await listen();
let browser;
try {
  currentCheck = "catalog";
  const { units, samples, composites, questionCount } = buildCatalog();
  check(units.length === 16, `expected 16 available curriculum units, found ${units.length}`);
  check(questionCount >= 700, `expected the full live question corpus, found only ${questionCount} questions`);
  for (const type of QUESTION_TYPES) check(Boolean(samples.get(type)), `question corpus is missing type ${type}`);

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await addCleanStorage(context);
  const page = await context.newPage();
  attachDiagnostics(page);

  let routeCount = 0;
  for (const record of units) {
    const unitId = record.entry.id;
    for (const [suffix, selector, label] of CORE_ROUTES) {
      await visit(page, `/unit/${unitId}${suffix}`, selector, `${unitId} ${label}`);
      routeCount += 1;
    }
    for (const bank of record.banks) {
      if (!BANK_ROUTE[bank.bank] || !bank.questions.length) continue;
      await visit(page, `/unit/${unitId}/${BANK_ROUTE[bank.bank]}`, ".quiz-shell .q-stem", `${unitId} ${bank.bank} quiz`);
      routeCount += 1;
    }
  }

  await visit(page, "/overview", ".overview-hero", "cross-unit overview");
  routeCount += 1;
  await runQuestionTypeMatrix(page, samples);
  await runCompositeChecks(page, composites);
  await context.close();

  const representativeIds = [
    units.find((item) => !item.entry.group)?.entry.id,
    units.find((item) => item.entry.group === "唐詩三首")?.entry.id,
    units.find((item) => item.entry.group === "詞三首")?.entry.id
  ].filter(Boolean);

  await runEmptyStateChecks(browser, representativeIds[0]);
  await runHistoryCheck(browser, representativeIds[0]);
  await runMobileMatrix(browser, representativeIds);

  if (failures.length) {
    console.error(`Pre-launch browser QA failed with ${failures.length} issue(s).`);
    process.exitCode = 1;
  } else {
    console.log(`Pre-launch browser QA passed: ${units.length} units, ${routeCount} direct route checks, ${QUESTION_TYPES.length} question types, composite responses, empty states, history navigation and prose/poetry/ci mobile matrices.`);
  }
} finally {
  if (browser) await browser.close();
  await closeServer();
}
