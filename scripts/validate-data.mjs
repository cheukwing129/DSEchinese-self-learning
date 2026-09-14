import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DATA = path.join(ROOT, "data");
const UNITS_DIR = path.join(DATA, "units");
const SUPPORTED_TYPES = new Set([
  "single_choice",
  "multi_select",
  "true_false_unknown",
  "matching",
  "extract_sentence",
  "cloze_choice",
  "short_answer",
  "long_answer",
  "fill_table"
]);

const errors = [];
const warnings = [];
let jsonCount = 0;
let questionCount = 0;

function rel(file) {
  return path.relative(ROOT, file).replaceAll(path.sep, "/");
}

function fail(message) {
  errors.push(message);
}

function warn(message) {
  warnings.push(message);
}

function readJSON(file) {
  let raw;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch (error) {
    fail(`${rel(file)}: cannot read file (${error.message})`);
    return null;
  }
  try {
    jsonCount += 1;
    return JSON.parse(raw);
  } catch (error) {
    fail(`${rel(file)}: invalid JSON (${error.message})`);
    return null;
  }
}

function walkJSON(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkJSON(full);
    else if (entry.isFile() && entry.name.endsWith(".json")) readJSON(full);
  }
}

function requireArray(value, location, label) {
  if (!Array.isArray(value)) {
    fail(`${location}: ${label} must be an array`);
    return [];
  }
  return value;
}

function validateOptions(q, location) {
  const options = requireArray(q.options, location, "options");
  const keys = new Set();
  for (const option of options) {
    if (!option || typeof option !== "object") {
      fail(`${location}: each option must be an object`);
      continue;
    }
    if (!option.key) fail(`${location}: option is missing key`);
    if (option.text == null) fail(`${location}: option ${option.key || "?"} is missing text`);
    if (option.key) {
      if (keys.has(option.key)) fail(`${location}: duplicate option key ${option.key}`);
      keys.add(option.key);
    }
  }
  return keys;
}

function validateQuestionShape(q, location) {
  if (!q || typeof q !== "object") {
    fail(`${location}: question must be an object`);
    return;
  }
  if (!q.id) fail(`${location}: missing id`);
  if (!q.stem) fail(`${location}: missing stem`);
  if (!q.question_type) {
    fail(`${location}: missing question_type`);
    return;
  }
  if (!SUPPORTED_TYPES.has(q.question_type)) {
    fail(`${location}: unsupported question_type '${q.question_type}'`);
    return;
  }

  switch (q.question_type) {
    case "single_choice": {
      const keys = validateOptions(q, location);
      if (q.answer == null) fail(`${location}: single_choice missing answer`);
      else if (keys.size && !keys.has(q.answer)) fail(`${location}: answer '${q.answer}' is not an option key`);
      break;
    }
    case "multi_select": {
      const keys = validateOptions(q, location);
      const answers = requireArray(q.answer, location, "answer");
      for (const answer of answers) {
        if (keys.size && !keys.has(answer)) fail(`${location}: answer '${answer}' is not an option key`);
      }
      break;
    }
    case "true_false_unknown": {
      if (Array.isArray(q.statements)) {
        q.statements.forEach((statement, i) => {
          if (!statement?.text) fail(`${location}: statements[${i}] missing text`);
          if (!["true", "false", "unknown"].includes(statement?.answer)) {
            fail(`${location}: statements[${i}] has invalid answer '${statement?.answer}'`);
          }
        });
      } else if (!["true", "false", "unknown"].includes(q.answer)) {
        fail(`${location}: true_false_unknown must have statements or answer=true/false/unknown`);
      }
      break;
    }
    case "matching": {
      const rows = requireArray(q.rows, location, "rows");
      if (q.option_labels) {
        requireArray(q.option_labels, location, "option_labels");
        rows.forEach((row, i) => {
          if (!row?.text) fail(`${location}: rows[${i}] missing text`);
          requireArray(row?.answers, location, `rows[${i}].answers`);
        });
      } else {
        validateOptions(q, location);
        rows.forEach((row, i) => {
          if (!row?.text) fail(`${location}: rows[${i}] missing text`);
          if (row?.answer == null) fail(`${location}: rows[${i}] missing answer`);
        });
      }
      break;
    }
    case "extract_sentence":
      if (!q.answer_text) fail(`${location}: extract_sentence missing answer_text`);
      break;
    case "cloze_choice": {
      const blanks = requireArray(q.blanks, location, "blanks");
      blanks.forEach((blank, i) => {
        if (!blank?.id) fail(`${location}: blanks[${i}] missing id`);
        const keys = validateOptions(blank || {}, `${location}.blanks[${i}]`);
        if (blank?.answer == null) fail(`${location}: blanks[${i}] missing answer`);
        else if (keys.size && !keys.has(blank.answer)) fail(`${location}: blanks[${i}] answer '${blank.answer}' is not an option key`);
      });
      break;
    }
    case "fill_table":
      if (!q.table || !Array.isArray(q.table.columns) || !Array.isArray(q.table.rows)) {
        fail(`${location}: fill_table requires table.columns and table.rows arrays`);
      }
      break;
    case "short_answer":
    case "long_answer":
      break;
  }

  if (q.items != null) {
    const items = requireArray(q.items, location, "items");
    items.forEach((item, i) => {
      if (!item?.text) fail(`${location}: items[${i}] missing text`);
    });
  }

  if (q.part2) {
    const type = q.part2.question_type || q.part2.type || "long_answer";
    if (!SUPPORTED_TYPES.has(type)) fail(`${location}: part2 uses unsupported type '${type}'`);
    if (!q.part2.stem) fail(`${location}: part2 missing stem`);
    validateQuestionShape({ ...q.part2, id: `${q.id || "?"}:part2`, question_type: type, stem: q.part2.stem || "(missing)" }, `${location}.part2`);
  }
}

// First pass: every JSON file must parse, including staging reference data.
walkJSON(DATA);

const curriculumFile = path.join(DATA, "curriculum.json");
const curriculum = readJSON(curriculumFile);
const curriculumUnits = requireArray(curriculum?.units, "data/curriculum.json", "units");
const curriculumIds = new Set();

for (const entry of curriculumUnits) {
  if (!entry?.id) {
    fail("data/curriculum.json: unit entry missing id");
    continue;
  }
  if (curriculumIds.has(entry.id)) fail(`data/curriculum.json: duplicate unit id '${entry.id}'`);
  curriculumIds.add(entry.id);

  const unitDir = path.join(UNITS_DIR, entry.id);
  if (!fs.existsSync(unitDir)) {
    fail(`data/curriculum.json: unit '${entry.id}' has no data/units/${entry.id} directory`);
    continue;
  }

  const unitFile = path.join(unitDir, "unit.json");
  const unit = readJSON(unitFile);
  if (!unit) continue;
  if (unit.id !== entry.id) fail(`${rel(unitFile)}: id '${unit.id}' does not match folder '${entry.id}'`);

  const requiredContentFiles = [
    "text.json",
    "background.json",
    "appreciation.json",
    "structure.json",
    "memorisation.json",
    "rubrics.json"
  ];
  for (const filename of requiredContentFiles) {
    if (!fs.existsSync(path.join(unitDir, filename))) fail(`${rel(unitFile)}: missing ${filename}`);
  }

  if (unit.audio_file && !fs.existsSync(path.join(ROOT, unit.audio_file))) {
    fail(`${rel(unitFile)}: audio_file does not exist: ${unit.audio_file}`);
  }

  const textFile = path.join(unitDir, "text.json");
  const text = fs.existsSync(textFile) ? readJSON(textFile) : null;
  if (text) {
    const paragraphs = requireArray(text.paragraphs, rel(textFile), "paragraphs");
    const annotations = requireArray(text.annotations, rel(textFile), "annotations");
    const annotationIds = new Set();
    annotations.forEach((annotation, i) => {
      if (!annotation?.id) fail(`${rel(textFile)}: annotations[${i}] missing id`);
      else if (annotationIds.has(annotation.id)) fail(`${rel(textFile)}: duplicate annotation id '${annotation.id}'`);
      else annotationIds.add(annotation.id);
    });
    paragraphs.forEach((paragraph, i) => {
      if (paragraph?.id == null) fail(`${rel(textFile)}: paragraphs[${i}] missing id`);
      if (paragraph?.text == null) fail(`${rel(textFile)}: paragraphs[${i}] missing text`);
      for (const annotationId of paragraph?.annotation_ids || []) {
        if (!annotationIds.has(annotationId)) {
          fail(`${rel(textFile)}: paragraphs[${i}] references unknown annotation '${annotationId}'`);
        }
      }
    });
  }

  const appreciationFile = path.join(unitDir, "appreciation.json");
  const appreciation = fs.existsSync(appreciationFile) ? readJSON(appreciationFile) : null;
  if (appreciation && !appreciation.theme_summary && !appreciation.overview) {
    warn(`${rel(appreciationFile)}: no theme_summary or overview; theme page will show fallback text`);
  }

  const bankFiles = requireArray(unit.question_bank_files, rel(unitFile), "question_bank_files");
  const seenQuestionIds = new Set();
  for (const bankRel of bankFiles) {
    const bankFile = path.join(unitDir, bankRel);
    if (!fs.existsSync(bankFile)) {
      fail(`${rel(unitFile)}: question bank file does not exist: ${bankRel}`);
      continue;
    }
    const bank = readJSON(bankFile);
    if (!bank) continue;
    if (bank.unit && bank.unit !== entry.id) fail(`${rel(bankFile)}: bank.unit '${bank.unit}' does not match '${entry.id}'`);
    const questions = requireArray(bank.questions, rel(bankFile), "questions");
    questions.forEach((q, index) => {
      questionCount += 1;
      const location = `${rel(bankFile)} questions[${index}]${q?.id ? ` (${q.id})` : ""}`;
      if (q?.unit && q.unit !== entry.id) fail(`${location}: unit '${q.unit}' does not match '${entry.id}'`);
      if (q?.id) {
        if (seenQuestionIds.has(q.id)) fail(`${location}: duplicate question id within unit`);
        seenQuestionIds.add(q.id);
      }
      validateQuestionShape(q, location);
    });
  }
}

if (fs.existsSync(UNITS_DIR)) {
  for (const entry of fs.readdirSync(UNITS_DIR, { withFileTypes: true })) {
    if (entry.isDirectory() && !curriculumIds.has(entry.name)) {
      warn(`data/units/${entry.name}: directory is not listed in curriculum.json`);
    }
  }
}

for (const message of warnings) console.warn(`WARNING: ${message}`);
for (const message of errors) console.error(`ERROR: ${message}`);

console.log(`Validated ${jsonCount} JSON reads and ${questionCount} questions across ${curriculumIds.size} curriculum units.`);
console.log(`${warnings.length} warning(s), ${errors.length} error(s).`);

if (errors.length) process.exit(1);
