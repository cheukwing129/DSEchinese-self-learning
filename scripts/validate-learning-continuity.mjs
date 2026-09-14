import fs from "node:fs";
import vm from "node:vm";

const progressSource = fs.readFileSync("js/progress.js", "utf8");
const appSource = fs.readFileSync("js/app.js", "utf8");
const contentSource = fs.readFileSync("js/content-renderer.js", "utf8");
const errors = [];

function check(condition, message) {
  if (!condition) errors.push(message);
}

check(progressSource.includes('const STORAGE_KEY = "ccsl_progress_v1"'), "progress storage key must remain ccsl_progress_v1");
check(appSource.includes("繼續上次學習"), "home must expose continue-learning UI");
check(appSource.includes("Progress.recordLearningVisit(unitId, currentPath)"), "successful unit routes must record learning visits");
check(contentSource.includes("建議下一步"), "unit home must expose next-step guidance");
check(contentSource.includes("不等同系統判定你已掌握前一階段"), "next-step UI must disclaim mastery inference");

const store = new Map();
const localStorage = {
  getItem(key) { return store.has(key) ? store.get(key) : null; },
  setItem(key, value) { store.set(key, String(value)); },
  removeItem(key) { store.delete(key); },
  clear() { store.clear(); }
};
const context = vm.createContext({ console, localStorage, Date, Math, Object, Array, String, Number, Set });
vm.runInContext(progressSource, context);
const Progress = vm.runInContext("Progress", context);

const units = [{ id: "u1", status: "available" }, { id: "u2", status: "available" }];

let next = Progress.recommendNextStep("u1");
check(next.path === "/unit/u1/text", "new unit should recommend starting from the text");

Progress.recordLearningVisit("u1", "/unit/u1/theme");
let recent = Progress.latestLearning(units);
check(recent && recent.unitId === "u1" && recent.path === "/unit/u1/theme", "latest visit should be resumable");

Progress.recordLearningVisit("u1", "/unit/u1/challenge/run");
recent = Progress.latestLearning(units);
check(recent && recent.path === "/unit/u1/challenge", "ephemeral challenge run must normalize to challenge setup");

Progress.recordAnswer("u1", "q1", { answered: true, isCorrect: false, selected: "A" });
next = Progress.recommendNextStep("u1");
check(next.path === "/unit/u1/progress", "wrong answers should prioritize remediation");

Progress.clearUnit("u1");
Progress.recordAnswer("u1", "q1", { answered: true, isCorrect: true, selected: "A" });
next = Progress.recommendNextStep("u1");
check(next.path === "/unit/u1/memorisation", "answered work without memorisation should recommend memorisation");

Progress.recordMemorisationAttempt("u1", "g1", "cloze", { total: 2, correct: 2 });
next = Progress.recommendNextStep("u1");
check(next.path === "/unit/u1/theme", "memorisation without reflection should recommend theme/reflection");

Progress.saveReflection("u1", "theme", "我的反思");
next = Progress.recommendNextStep("u1");
check(next.path === "/unit/u1/progress", "reflection without self-review should recommend self-review");

Progress.setSelfReviewItem("u1", "我能掌握重點", true);
next = Progress.recommendNextStep("u1");
check(next.path === "/unit/u1/challenge", "broad evidence plus self-review should recommend challenge");

// Legacy records do not have navigation/lastActivityAt; existing answer timestamps must still surface a useful resume target.
localStorage.clear();
localStorage.setItem("ccsl_progress_v1", JSON.stringify({
  u2: {
    answers: { oldq: { answered: true, isCorrect: true, timestamp: 123456789 } },
    reflections: {},
    memorisation: { groups: {}, charsViewedAt: null },
    selfReview: {}
  }
}));
recent = Progress.latestLearning(units);
check(recent && recent.unitId === "u2" && recent.path === "/unit/u2/progress", "legacy evidence should fall back to the unit progress page");

if (errors.length) {
  errors.forEach((error) => console.error(`ERROR: ${error}`));
  process.exit(1);
}

console.log("Learning continuity behavior validated, including legacy fallback and honest recommendations.");
