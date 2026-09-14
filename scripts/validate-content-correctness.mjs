import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DATA = path.join(ROOT, "data");
const UNITS = path.join(DATA, "units");

const errors = [];
const warnings = [];
const counts = {
  questions: 0,
  crossTextTargets: 0,
  paragraphRefs: 0,
  extracts: 0,
  matching: 0,
  trueFalseUnknown: 0,
  cloze: 0,
  openAnswers: 0
};

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
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[\s\u3000，。！？；：、,.!?;:「」『』“”‘’（）()《》〈〉【】\[\]…—－·‧．]/g, "")
    .trim();
}

function duplicateValues(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    const normalized = normalizeText(value);
    if (!normalized) continue;
    if (seen.has(normalized)) duplicates.add(String(value));
    seen.add(normalized);
  }
  return [...duplicates];
}

function refs(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function hasSpecificScoring(q) {
  if (Array.isArray(q.answer_elements) && q.answer_elements.length) return true;
  if (Array.isArray(q.scoring_elements) && q.scoring_elements.length) return true;
  if (Array.isArray(q.items) && q.items.some((item) => item && (item.answer != null || item.scoring_elements || item.answer_elements))) return true;
  if (typeof q.follow_up_open_answer === "string" && q.follow_up_open_answer.trim()) return true;
  if (typeof q.model_answer === "string" && q.model_answer.trim()) return true;
  if (typeof q.answer_text === "string" && q.answer_text.trim()) return true;
  if (q.table?.rows?.some((row) => Array.isArray(row?.cells) && row.cells.some((cell, index) => index > 0 && cell != null && String(cell).trim()))) return true;
  return false;
}

const curriculum = readJSON(path.join(DATA, "curriculum.json"));
const entries = (curriculum.units || []).filter((entry) => entry?.status === "available");
const availableIds = new Set(entries.map((entry) => entry.id));

for (const entry of entries) {
  const unitDir = path.join(UNITS, entry.id);
  const unitFile = path.join(unitDir, "unit.json");
  const unit = readJSON(unitFile);
  const textFile = path.join(unitDir, "text.json");
  const text = readJSON(textFile);
  const paragraphs = Array.isArray(text.paragraphs) ? text.paragraphs : [];
  const paragraphMap = new Map(paragraphs.map((paragraph) => [String(paragraph.id), String(paragraph.text ?? "")]));
  const wholeText = paragraphs.map((paragraph) => paragraph.text ?? "").join("\n");
  const declaredTargets = new Set((unit.cross_text_targets || []).map((target) => target?.id).filter(Boolean));

  for (const target of unit.cross_text_targets || []) {
    if (!target?.id) continue;
    if (target.id === entry.id) fail(`${rel(unitFile)}: cross_text_targets must not point back to the same unit '${entry.id}'`);
    if (!availableIds.has(target.id)) {
      warn(`${rel(unitFile)}: cross-text target '${target.id}' is not an available curriculum unit; questions using it should explain that the comparison text is unavailable`);
    }
  }

  for (const bankRel of unit.question_bank_files || []) {
    const bankFile = path.join(unitDir, bankRel);
    const bank = readJSON(bankFile);
    for (const [index, q] of (bank.questions || []).entries()) {
      counts.questions += 1;
      const location = `${rel(bankFile)} questions[${index}]${q?.id ? ` (${q.id})` : ""}`;

      const paragraphRefs = refs(q.paragraph_ref);
      for (const paragraphRef of paragraphRefs) {
        counts.paragraphRefs += 1;
        if (!paragraphMap.has(String(paragraphRef))) {
          fail(`${location}: paragraph_ref '${paragraphRef}' does not exist in ${rel(textFile)}`);
        }
      }

      const target = q.cross_text_target;
      if (target) {
        counts.crossTextTargets += 1;
        if (target === entry.id) fail(`${location}: cross_text_target points to its own unit '${entry.id}'`);
        if (!declaredTargets.has(target)) {
          fail(`${location}: cross_text_target '${target}' is not listed in ${rel(unitFile)} cross_text_targets`);
        }
        const staleUnavailableNote = typeof q.note === "string" && /(原文)?暫未上線|尚未上線|原文未上線|待.{0,12}上線/.test(q.note);
        if (availableIds.has(target) && staleUnavailableNote) {
          fail(`${location}: note says comparison text '${target}' is not online, but that unit is currently available`);
        }
        if (!availableIds.has(target) && !q.note) {
          warn(`${location}: comparison target '${target}' is unavailable but the question has no explanatory note`);
        }
      }

      if (bank.bank === "cross-text") {
        if (q.is_cross_text !== true) fail(`${location}: question in cross-text bank must set is_cross_text=true`);
        if (!target) fail(`${location}: question in cross-text bank is missing cross_text_target`);
      }

      if (q.is_cross_text === false && target) {
        fail(`${location}: has cross_text_target '${target}' but is_cross_text=false`);
      }

      if (Array.isArray(q.options)) {
        const duplicateOptionText = duplicateValues(q.options.map((option) => option?.text));
        if (duplicateOptionText.length) {
          fail(`${location}: duplicate option text after punctuation/space normalization: ${duplicateOptionText.join(" | ")}`);
        }
      }

      if (q.question_type === "multi_select") {
        if (!Array.isArray(q.answer) || q.answer.length === 0) fail(`${location}: multi_select must have at least one correct answer`);
        if (Array.isArray(q.answer) && new Set(q.answer).size !== q.answer.length) fail(`${location}: multi_select answer contains duplicate keys`);
      }

      if (q.question_type === "matching") {
        counts.matching += 1;
        if (Array.isArray(q.option_labels)) {
          const labelSet = new Set(q.option_labels);
          const duplicateLabels = duplicateValues(q.option_labels);
          if (duplicateLabels.length) fail(`${location}: duplicate option_labels: ${duplicateLabels.join(" | ")}`);
          for (const [rowIndex, row] of (q.rows || []).entries()) {
            if (!Array.isArray(row?.answers) || row.answers.length === 0) {
              fail(`${location}: rows[${rowIndex}] must have at least one answer`);
              continue;
            }
            if (new Set(row.answers).size !== row.answers.length) fail(`${location}: rows[${rowIndex}] answers contain duplicates`);
            for (const answer of row.answers) {
              if (!labelSet.has(answer)) fail(`${location}: rows[${rowIndex}] answer '${answer}' is not in option_labels`);
            }
          }
        } else {
          const keySet = new Set((q.options || []).map((option) => option?.key));
          for (const [rowIndex, row] of (q.rows || []).entries()) {
            if (!keySet.has(row?.answer)) fail(`${location}: rows[${rowIndex}] answer '${row?.answer}' is not an option key`);
          }
        }
      }

      if (q.question_type === "true_false_unknown") {
        counts.trueFalseUnknown += 1;
        if (Array.isArray(q.statements)) {
          const duplicateStatements = duplicateValues(q.statements.map((statement) => statement?.text));
          if (duplicateStatements.length) fail(`${location}: duplicate statements: ${duplicateStatements.join(" | ")}`);
          for (const [statementIndex, statement] of q.statements.entries()) {
            if (typeof statement?.explanation !== "string" || !statement.explanation.trim()) {
              fail(`${location}: statements[${statementIndex}] is missing an explanation for its ${statement?.answer || "?"} answer`);
            }
          }
        } else if (typeof q.explanation !== "string" || !q.explanation.trim()) {
          warn(`${location}: single true/false/unknown item has no explanation`);
        }
      }

      if (q.question_type === "cloze_choice") {
        counts.cloze += 1;
        const blankIds = (q.blanks || []).map((blank) => blank?.id).filter(Boolean);
        if (new Set(blankIds).size !== blankIds.length) fail(`${location}: cloze blank ids are not unique`);
        for (const [blankIndex, blank] of (q.blanks || []).entries()) {
          const duplicateOptionText = duplicateValues((blank?.options || []).map((option) => option?.text));
          if (duplicateOptionText.length) fail(`${location}: blanks[${blankIndex}] has duplicate option text: ${duplicateOptionText.join(" | ")}`);
        }
      }

      if (q.question_type === "extract_sentence") {
        counts.extracts += 1;
        const answer = normalizeText(q.answer_text);
        const scopedText = paragraphRefs.length
          ? paragraphRefs.map((paragraphRef) => paragraphMap.get(String(paragraphRef)) || "").join("\n")
          : wholeText;
        if (answer && !normalizeText(scopedText).includes(answer)) {
          fail(`${location}: answer_text is not found in the referenced source text`);
        }
      }

      if (typeof q.quote === "string" && q.quote.trim() && q.is_cross_text !== true) {
        const scopedText = paragraphRefs.length
          ? paragraphRefs.map((paragraphRef) => paragraphMap.get(String(paragraphRef)) || "").join("\n")
          : wholeText;
        if (!normalizeText(scopedText).includes(normalizeText(q.quote))) {
          fail(`${location}: quote is not found in the referenced source text`);
        }
      }

      if (["short_answer", "long_answer", "fill_table"].includes(q.question_type)) {
        counts.openAnswers += 1;
        if (!hasSpecificScoring(q)) {
          warn(`${location}: open-response question has no question-specific answer/scoring guidance`);
        }
      }
    }
  }
}

for (const message of warnings) console.warn(`WARNING: ${message}`);
for (const message of errors) console.error(`ERROR: ${message}`);

console.log(
  `Content correctness scan: ${counts.questions} questions; ${counts.crossTextTargets} explicit cross-text targets; ` +
  `${counts.paragraphRefs} paragraph references; ${counts.extracts} extract-sentence items; ${counts.matching} matching; ` +
  `${counts.trueFalseUnknown} true/false/unknown; ${counts.cloze} cloze-choice; ${counts.openAnswers} open-response items.`
);
console.log(`${warnings.length} warning(s), ${errors.length} error(s).`);

if (errors.length) process.exit(1);
