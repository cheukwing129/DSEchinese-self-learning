import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const errors = [];

function requireText(text, label) {
  if (!app.includes(text)) errors.push(`js/app.js: missing ${label}`);
}

function forbidText(text, label) {
  if (app.includes(text)) errors.push(`js/app.js: ${label}`);
}

requireText("function loadJSONCached(path)", "shared JSON request cache");
requireText("async function loadUnitBundle(unitId, options = {})", "option-based unit bundle loader");
requireText('{ resources: ["text"] }', "text-only route loading");
requireText('{ resources: ["structure"] }', "structure-only route loading");
requireText('{ resources: ["appreciation"] }', "appreciation-only route loading");
requireText('{ resources: ["memorisation"] }', "memorisation-only route loading");
requireText('{ banks: [bankName] }', "single-bank quiz loading");
requireText('{ banks: ["cross-text"] }', "cross-text-only bank loading");
requireText("allQuestionBanks: true", "full question-bank loading for aggregate views");
forbidText('fetchJSON(`${base}/background.json`)', "eager resource preload has returned");
forbidText('fetchJSON(`${base}/rubrics.json`)', "eager resource preload has returned");
forbidText("const [text, background, appreciation, structure, memorisation, rubrics]", "eager full bundle destructuring has returned");

const curriculum = JSON.parse(fs.readFileSync(path.join(root, "data/curriculum.json"), "utf8"));
for (const entry of curriculum.units || []) {
  const unitDir = path.join(root, "data/units", entry.id);
  const unitFile = path.join(unitDir, "unit.json");
  const unit = JSON.parse(fs.readFileSync(unitFile, "utf8"));
  const seen = new Set();
  for (const rel of unit.question_bank_files || []) {
    const stem = path.basename(rel, ".json");
    const bankFile = path.join(unitDir, rel);
    const bank = JSON.parse(fs.readFileSync(bankFile, "utf8"));
    if (bank.bank !== stem) {
      errors.push(`${path.relative(root, bankFile)}: bank '${bank.bank}' must match filename '${stem}' for lazy loading`);
    }
    if (seen.has(stem)) errors.push(`${path.relative(root, unitFile)}: duplicate question-bank filename stem '${stem}'`);
    seen.add(stem);
  }
}

if (errors.length) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exit(1);
}

console.log("Lazy-loading contract validated across all curriculum units.");
