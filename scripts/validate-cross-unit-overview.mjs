import fs from "node:fs";
import vm from "node:vm";

const progressSource = fs.readFileSync("js/progress.js", "utf8");
const appSource = fs.readFileSync("js/app.js", "utf8");
const contentSource = fs.readFileSync("js/content-renderer.js", "utf8");
const errors = [];

function check(condition, message) {
  if (!condition) errors.push(message);
}

check(appSource.includes('href="#/overview"'), "home must expose the cross-unit overview entry");
check(appSource.includes('Router.register("/overview", pageOverview)'), "overview must have a dedicated route");
check(appSource.includes('loadUnitBundle(entry.id, { allQuestionBanks: true })'), "overview route must load full banks only on demand");
check(contentSource.includes("不產生虛假的總掌握百分比"), "overview must reject synthetic total mastery percentages");
check(contentSource.includes("排序規則：待修正錯題數"), "priority ordering must be explained to the student");

const store = new Map();
let now = 1000;
class FakeDate extends Date {
  static now() { return now++; }
}
const localStorage = {
  getItem(key) { return store.has(key) ? store.get(key) : null; },
  setItem(key, value) { store.set(key, String(value)); },
  removeItem(key) { store.delete(key); },
  clear() { store.clear(); }
};
const context = vm.createContext({ console, localStorage, Date: FakeDate, Math, Object, Array, String, Number, Set });
vm.runInContext(progressSource, context);
const Progress = vm.runInContext("Progress", context);

const q1 = { id: "u1-q1", question_type: "single_choice", ability: "內容理解" };
const q2 = { id: "u1-q2", question_type: "single_choice", ability: "字詞理解" };
const qOpen = { id: "u1-open", question_type: "long_answer", ability: "內容理解" };
const q3 = { id: "u2-q1", question_type: "true_false_unknown", ability: "內容理解" };
const q4 = { id: "u2-q2", question_type: "single_choice", ability: "結構與手法" };

Progress.recordAnswer("u1", q1.id, { answered: true, isCorrect: false, selected: "A" });
Progress.recordAnswer("u1", q1.id, { answered: true, isCorrect: false, selected: "B" });
Progress.recordAnswer("u1", q2.id, { answered: true, isCorrect: false, selected: "A" });
Progress.recordAnswer("u1", q2.id, { answered: true, isCorrect: true, selected: "B" });
Progress.recordAnswer("u1", qOpen.id, { answered: true, isCorrect: false, selected: "essay" });
Progress.recordAnswer("u2", q3.id, { answered: true, isCorrect: false, selected: "true" });
Progress.recordAnswer("u2", q4.id, { answered: true, isCorrect: true, selected: "A" });

const overview = Progress.crossUnitOverview([
  { unitId: "u1", title: "篇一", author: "甲", questions: [q1, q2, qOpen] },
  { unitId: "u2", title: "篇二", author: "乙", questions: [q3, q4] }
]);

check(overview.engagedUnits === 2, "both units with real activity should count as engaged");
check(overview.totalAnswered === 4, "only answered objective questions should count in cross-unit totals");
check(overview.totalCurrentWrong === 2, "two objective questions should remain unresolved");
check(overview.totalEverWrong === 3, "three objective questions should retain wrong-answer history");
check(overview.totalResolvedWrong === 1, "one previously wrong objective question should be resolved");
check(overview.priorityUnits.length === 2 && overview.priorityUnits[0].unitId === "u1", "repeated/historical wrong evidence should break a current-wrong tie transparently");

const comprehension = overview.abilities.find((row) => row.ability === "內容理解");
check(!!comprehension, "content-comprehension ability must appear in aggregate wrong evidence");
check(comprehension.currentWrongQuestions === 2, "content comprehension should have two current wrong questions");
check(comprehension.everWrongQuestions === 2, "open-response records must not inflate objective wrong-question history");
check(comprehension.wrongAttempts === 3, "repeated wrong attempts must aggregate across units");
check(comprehension.everWrongUnits === 2, "ability evidence should report the number of affected units");
check(comprehension.repeatedWrongQuestions === 1, "one objective question should be marked as repeatedly wrong");

const vocabulary = overview.abilities.find((row) => row.ability === "字詞理解");
check(vocabulary && vocabulary.currentWrongQuestions === 0 && vocabulary.resolvedWrongQuestions === 1, "resolved wrong history must remain visible without staying unresolved");

if (errors.length) {
  errors.forEach((error) => console.error(`ERROR: ${error}`));
  process.exit(1);
}

console.log("Cross-unit overview behavior validated with transparent priority, repeated-error aggregation, resolved history and open-response isolation.");
