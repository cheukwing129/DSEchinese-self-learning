import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const curriculum = JSON.parse(fs.readFileSync(path.join(root, "data/curriculum.json"), "utf8"));
const errors = [];

function validBackgroundSection(value) {
  if (typeof value === "string") return value.trim().length > 0;
  return !!(value && typeof value === "object" && typeof value.content === "string" && value.content.trim());
}

for (const entry of curriculum.units || []) {
  const base = path.join(root, "data/units", entry.id);
  const backgroundPath = path.join(base, "background.json");
  const rubricsPath = path.join(base, "rubrics.json");
  const background = JSON.parse(fs.readFileSync(backgroundPath, "utf8"));
  const rubrics = JSON.parse(fs.readFileSync(rubricsPath, "utf8"));

  if (!validBackgroundSection(background.author_intro) && !validBackgroundSection(background.writing_background)) {
    errors.push(`${entry.id}: background.json has no usable author_intro or writing_background`);
  }

  const checklist = Array.isArray(rubrics.self_review_checklist)
    ? rubrics.self_review_checklist
    : rubrics.self_check_prompts;
  if (!Array.isArray(checklist) || !checklist.length || checklist.some((item) => typeof item !== "string" || !item.trim())) {
    errors.push(`${entry.id}: rubrics.json needs a non-empty self-review checklist`);
  }

  if (Array.isArray(rubrics.common_scoring_elements)) {
    if (!rubrics.common_scoring_elements.length) errors.push(`${entry.id}: common_scoring_elements is empty`);
  } else if (Array.isArray(rubrics.long_answer_scoring_elements)) {
    for (const [index, group] of rubrics.long_answer_scoring_elements.entries()) {
      if (!group || typeof group.question_type !== "string" || !Array.isArray(group.elements) || !group.elements.length) {
        errors.push(`${entry.id}: long_answer_scoring_elements[${index}] is incomplete`);
      }
    }
  } else {
    errors.push(`${entry.id}: rubrics.json has no supported scoring-element schema`);
  }
}

const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const renderer = fs.readFileSync(path.join(root, "js/content-renderer.js"), "utf8");
const engine = fs.readFileSync(path.join(root, "js/question-engine.js"), "utf8");
const progress = fs.readFileSync(path.join(root, "js/progress.js"), "utf8");

const guards = [
  [app.includes('{ resources: ["background"], uiModules: ["content"] }'), "unit home must request background.json with lazy content UI"],
  [app.includes('resources: ["rubrics"]'), "question routes must request rubrics.json"],
  [renderer.includes("backgroundCardHTML"), "background renderer is missing"],
  [renderer.includes("不計入正確率，也不會被系統當成已掌握"), "self-review honesty label is missing"],
  [engine.includes("篇章通用自評框架（非本題精確評分）"), "rubric fallback honesty label is missing"],
  [progress.includes("setSelfReviewItem"), "self-review persistence is missing"]
];
for (const [ok, message] of guards) if (!ok) errors.push(message);

if (errors.length) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exit(1);
}

console.log(`Learning-support data and integration validated across ${(curriculum.units || []).length} curriculum units.`);
