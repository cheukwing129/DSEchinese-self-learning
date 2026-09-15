import fs from "node:fs";
import vm from "node:vm";

const progressSource = fs.readFileSync("js/progress.js", "utf8");
const analyticsSource = fs.readFileSync("js/progress-analytics.js", "utf8");
const appSource = fs.readFileSync("js/app.js", "utf8");
const contentSource = fs.readFileSync("js/content-renderer.js", "utf8");
const questionSource = fs.readFileSync("js/question-engine.js", "utf8");
const errors = [];

function check(condition, message) {
  if (!condition) errors.push(message);
}

check(progressSource.includes('const STORAGE_KEY = "ccsl_progress_v1"'), "progress storage key must remain ccsl_progress_v1");
check(analyticsSource.includes("function crossUnitWrongItems"), "lazy analytics must expose one shared cross-unit unresolved selector");
check(appSource.includes('loadUIModules(["questions", "progressAnalytics"])'), "targeted retry must lazy-load cross-unit analytics");
check(appSource.includes('Router.register("/overview/retry/:ability", pageCrossUnitRetry)'), "app must register targeted retry route");
check(appSource.includes("async function loadCrossUnitBundles()"), "overview and retry must share the on-demand aggregate loader");
check(contentSource.includes("重練全部待修正"), "overview must expose an all-errors retry action");
check(contentSource.includes("重練此能力"), "overview must expose per-ability retry actions");
check(questionSource.includes("function renderCrossUnitWrongRetry"), "question engine must render cross-unit retry sequences");
check(questionSource.includes("backLabel: \"返回跨篇章總覽\""), "cross-unit retry must return to the overview rather than mislabel a unit link");
check(questionSource.includes("loadRecord: () => null"), "retry questions must start fresh instead of restoring the old wrong answer");
check(questionSource.includes("Progress.recordAnswer(item.unitId, questionId, record)"), "retry results must save back to the source unit");

const store = new Map();
const localStorage = {
  getItem(key) { return store.has(key) ? store.get(key) : null; },
  setItem(key, value) { store.set(key, String(value)); },
  removeItem(key) { store.delete(key); },
  clear() { store.clear(); }
};
const context = vm.createContext({ console, localStorage, Date, Math, Object, Array, String, Number, Set });
vm.runInContext(progressSource, context);
vm.runInContext(analyticsSource, context);
const Progress = vm.runInContext("Progress", context);

const inputs = [
  {
    unitId: "u1",
    title: "甲篇",
    author: "甲",
    questions: [
      { id: "u1-content", question_type: "single_choice", ability: "內容理解" },
      { id: "u1-open", question_type: "long_answer", ability: "內容理解" }
    ]
  },
  {
    unitId: "u2",
    title: "乙篇",
    author: "乙",
    questions: [
      { id: "u2-content", question_type: "true_false_unknown", ability: "內容理解" },
      { id: "u2-words", question_type: "cloze_choice", ability: "字詞理解" }
    ]
  }
];

// u1 content is repeatedly wrong; the open question is deliberately marked wrong but must never enter automatic retry.
Progress.recordAnswer("u1", "u1-content", { answered: true, isCorrect: false, selected: "A" });
Progress.recordAnswer("u1", "u1-content", { answered: true, isCorrect: false, selected: "B" });
Progress.recordAnswer("u1", "u1-open", { answered: true, isCorrect: false, selected: "長答" });
Progress.recordAnswer("u2", "u2-content", { answered: true, isCorrect: false, selected: "false" });
Progress.recordAnswer("u2", "u2-words", { answered: true, isCorrect: false, selected: {} });

let items = Progress.crossUnitWrongItems(inputs);
check(items.length === 3, "all-target retry must contain exactly the three unresolved objective questions");
check(items[0]?.unitId === "u1" && items[0]?.question.id === "u1-content", "repeatedly wrong questions should be prioritised first");
check(!items.some((item) => item.question.id === "u1-open"), "open/long-answer questions must never enter automatic targeted retry");

let contentItems = Progress.crossUnitWrongItems(inputs, "內容理解");
check(contentItems.length === 2, "ability-targeted retry must include unresolved questions from both units");
check(contentItems.every((item) => item.question.ability === "內容理解"), "ability-targeted retry must not leak other abilities");

let wordItems = Progress.crossUnitWrongItems(inputs, "字詞理解");
check(wordItems.length === 1 && wordItems[0].question.id === "u2-words", "another ability must form its own targeted set");

// Correcting one repeated mistake must remove it from current retry while preserving its historical wrong evidence.
Progress.recordAnswer("u1", "u1-content", { answered: true, isCorrect: true, selected: "C" });
contentItems = Progress.crossUnitWrongItems(inputs, "內容理解");
check(contentItems.length === 1 && contentItems[0].question.id === "u2-content", "a corrected item must leave the current targeted retry set immediately");
const u1Record = Progress.getAnswer("u1", "u1-content");
check(u1Record.everWrong === true && u1Record.wrongAttempts === 2 && u1Record.correctAttempts === 1, "correcting a question must preserve wrong history and attempt counts");

let overview = Progress.crossUnitOverview(inputs);
check(overview.totalCurrentWrong === 2, "overview current-wrong count must stay aligned with retry after one correction");
check(overview.totalResolvedWrong === 1, "overview must count the corrected historical mistake as resolved");

Progress.recordAnswer("u2", "u2-content", { answered: true, isCorrect: true, selected: "true" });
contentItems = Progress.crossUnitWrongItems(inputs, "內容理解");
check(contentItems.length === 0, "an ability retry set must become empty once all of its unresolved questions are corrected");
items = Progress.crossUnitWrongItems(inputs);
check(items.length === 1 && items[0].question.id === "u2-words", "all-target retry must retain only still-unresolved questions");

if (errors.length) {
  errors.forEach((error) => console.error(`ERROR: ${error}`));
  process.exit(1);
}

console.log("Cross-unit targeted retry validated across ability filters, repeated mistakes, corrections, history preservation and open-question isolation.");
