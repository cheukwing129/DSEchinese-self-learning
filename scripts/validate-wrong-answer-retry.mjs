import fs from "node:fs";
import vm from "node:vm";

const progressSource = fs.readFileSync("js/progress.js", "utf8");
const questionSource = fs.readFileSync("js/question-engine.js", "utf8");
const appSource = fs.readFileSync("js/app.js", "utf8");
const contentSource = fs.readFileSync("js/content-renderer.js", "utf8");
const errors = [];

function check(condition, message) {
  if (!condition) errors.push(message);
}

check(progressSource.includes('const STORAGE_KEY = "ccsl_progress_v1"'), "progress storage key must remain ccsl_progress_v1");
check(progressSource.includes("function everWrongQuestionIds"), "progress must preserve historical wrong-question IDs");
check(progressSource.includes("function resolvedWrongQuestionIds"), "progress must expose resolved historical mistakes");
check(questionSource.includes("function renderWrongRetry"), "question engine must expose dedicated wrong-answer retry mode");
check(questionSource.includes("loadRecord: () => null"), "retry mode must start each question fresh instead of reusing the saved wrong answer");
check(questionSource.includes("showRemediation: true"), "retry mode should retain remediation guidance after repeated mistakes");
check(appSource.includes('Router.register("/unit/:unitId/progress/retry-wrong", pageWrongRetry)'), "retry route must be registered");
check(appSource.includes('resources: ["rubrics"], allQuestionBanks: true'), "retry route must load rubric support plus all banks needed to resolve wrong IDs");
check(contentSource.includes("一鍵重練"), "progress UI must expose one-click retry");
check(contentSource.includes("錯誤歷史不會刪除"), "progress UI must explain that history is preserved");

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

const questions = [
  { id: "q1", question_type: "single_choice", ability: "內容理解" },
  { id: "q2", question_type: "long_answer", ability: "主旨" },
  { id: "q3", question_type: "true_false_unknown", ability: "內容理解" }
];

Progress.recordAnswer("u1", "q1", { answered: true, selected: "A", isCorrect: false });
check(JSON.stringify(Progress.wrongQuestionIds("u1", questions)) === JSON.stringify(["q1"]), "first wrong answer should enter unresolved list");
check(JSON.stringify(Progress.everWrongQuestionIds("u1", questions)) === JSON.stringify(["q1"]), "first wrong answer should enter historical list");
check(Progress.resolvedWrongQuestionIds("u1", questions).length === 0, "unresolved mistake must not count as resolved");

Progress.recordAnswer("u1", "q1", { answered: true, selected: "B", isCorrect: false });
let rec = Progress.getAnswer("u1", "q1");
check(rec.attemptCount === 2, "attempt count should increment on repeated attempts");
check(rec.wrongAttempts === 2, "wrong-attempt count should retain repeated mistakes");
check(rec.everWrong === true && !!rec.firstWrongAt && !!rec.lastWrongAt, "wrong history timestamps should be retained");

Progress.recordAnswer("u1", "q1", { answered: true, selected: "C", isCorrect: true });
rec = Progress.getAnswer("u1", "q1");
check(Progress.wrongQuestionIds("u1", questions).length === 0, "a correct retry should clear the unresolved state");
check(JSON.stringify(Progress.everWrongQuestionIds("u1", questions)) === JSON.stringify(["q1"]), "a correct retry must not erase historical mistake membership");
check(JSON.stringify(Progress.resolvedWrongQuestionIds("u1", questions)) === JSON.stringify(["q1"]), "a corrected historical mistake should be counted as resolved");
check(rec.attemptCount === 3 && rec.wrongAttempts === 2 && rec.correctAttempts === 1, "history counters should survive correction");
check(!!rec.lastCorrectAt && !!rec.lastWrongAt, "both correct and wrong timestamps should remain available");

// Non-objective responses must never be treated as retryable wrong answers even if malformed legacy data says false.
Progress.recordAnswer("u1", "q2", { answered: true, selected: "text", isCorrect: false });
check(!Progress.wrongQuestionIds("u1", questions).includes("q2"), "long answers must not enter objective retry loop");
check(!Progress.everWrongQuestionIds("u1", questions).includes("q2"), "long answers must not pollute objective mistake history");

// A later mistake reopens the current unresolved state while preserving prior history.
Progress.recordAnswer("u1", "q1", { answered: true, selected: "A", isCorrect: false });
check(Progress.wrongQuestionIds("u1", questions).includes("q1"), "a later wrong attempt should reopen unresolved status");
check(!Progress.resolvedWrongQuestionIds("u1", questions).includes("q1"), "currently wrong question must not remain in resolved list");

// Legacy wrong records have no counters/history flags. They should still be recognized and upgraded on the next attempt.
localStorage.clear();
localStorage.setItem("ccsl_progress_v1", JSON.stringify({
  legacy: {
    answers: { q3: { answered: true, selected: "true", isCorrect: false, timestamp: 123456789 } },
    reflections: {}, memorisation: { groups: {}, charsViewedAt: null }, selfReview: {}
  }
}));
check(Progress.wrongQuestionIds("legacy", questions).includes("q3"), "legacy current wrong answer should be unresolved");
check(Progress.everWrongQuestionIds("legacy", questions).includes("q3"), "legacy current wrong answer should count as historical mistake");
Progress.recordAnswer("legacy", "q3", { answered: true, selected: "false", isCorrect: true });
rec = Progress.getAnswer("legacy", "q3");
check(!Progress.wrongQuestionIds("legacy", questions).includes("q3"), "legacy mistake should clear after a correct retry");
check(Progress.everWrongQuestionIds("legacy", questions).includes("q3"), "legacy mistake history should survive correction");
check(Progress.resolvedWrongQuestionIds("legacy", questions).includes("q3"), "corrected legacy mistake should become resolved");
check(rec.wrongAttempts === 1 && rec.correctAttempts === 1 && rec.attemptCount === 2, "legacy record should upgrade counters without losing its original wrong attempt");

if (errors.length) {
  errors.forEach((error) => console.error(`ERROR: ${error}`));
  process.exit(1);
}

console.log("Wrong-answer retry behavior validated, including preserved history, resolution, reopening and legacy upgrade.");
