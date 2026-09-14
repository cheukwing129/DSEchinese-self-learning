import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function file(relativePath) {
  return path.join(root, relativePath);
}

function readJSON(relativePath) {
  return JSON.parse(fs.readFileSync(file(relativePath), "utf8"));
}

function writeJSON(relativePath, value) {
  fs.writeFileSync(file(relativePath), `${JSON.stringify(value, null, 2)}\n`);
}

function question(data, id) {
  const found = (data.questions || []).find((item) => item.id === id);
  if (!found) throw new Error(`Question ${id} not found`);
  return found;
}

function removeStaleNote(relativePath, ids) {
  const data = readJSON(relativePath);
  for (const id of ids) {
    const q = question(data, id);
    if (typeof q.note !== "string" || !/(暫未上線|尚未上線|原文未上線|待.{0,12}上線)/.test(q.note)) {
      throw new Error(`${relativePath} ${id} no longer has the expected stale availability note`);
    }
    delete q.note;
  }
  writeJSON(relativePath, data);
}

removeStaleNote("data/units/shide-xishan-yanyouji/question-banks/cross-text.json", ["cb-cross-001", "cb-cross-003", "cb-cross-004"]);
removeStaleNote("data/units/yuexia-duzhuo/question-banks/cross-text.json", ["cb-cross-001"]);
removeStaleNote("data/units/denglou/question-banks/structure-skill.json", ["cb-skill-004"]);
removeStaleNote("data/units/denglou/question-banks/cross-text.json", ["cb-cross-002"]);
removeStaleNote("data/units/shengshengman-qiuqing/question-banks/cross-text.json", ["cb-cross-001"]);

{
  const relativePath = "data/units/lianpo-linxiangru/question-banks/content.json";
  const data = readJSON(relativePath);
  const q9 = question(data, "lp-content-009");
  q9.statements[0].explanation = "「相如持其璧睨柱，欲以擊柱」寫藺相如手持和氏璧、斜視柱子，準備以璧擊柱來威懾秦王。他敢在強秦面前採取可能毀璧、危及自身的激烈行動，直接表現其勇氣，故陳述正確。";

  const q18 = question(data, "lp-content-018");
  q18.statements[0].explanation = "「度」有推測、估量之意；「相如度秦王雖齋，決負約不償城」直接交代藺相如心中判斷秦王即使齋戒仍必定背約、不會交城，呈現人物內心的思考活動，屬心理描寫，故陳述正確。";
  writeJSON(relativePath, data);
}

{
  const relativePath = "scripts/validate-content-correctness.mjs";
  let source = fs.readFileSync(file(relativePath), "utf8");
  const normalizeFunctionEnd = `    .trim();\n}\n`;
  if (!source.includes("function stripTrailingSourceCitation")) {
    const helper = `${normalizeFunctionEnd}\nfunction stripTrailingSourceCitation(value) {\n  return String(value ?? \"\").replace(/\\s*[（(]《[^》]+》(?:[（(][^）)]*[）)])?[）)]\\s*$/, \"\");\n}\n`;
    if (!source.includes(normalizeFunctionEnd)) throw new Error("Could not locate normalizeText helper boundary");
    source = source.replace(normalizeFunctionEnd, helper);
  }
  const before = "if (!normalizeText(scopedText).includes(normalizeText(q.quote))) {";
  const after = "if (!normalizeText(scopedText).includes(normalizeText(stripTrailingSourceCitation(q.quote)))) {";
  if (!source.includes(after)) {
    if (!source.includes(before)) throw new Error("Could not locate quote comparison");
    source = source.replace(before, after);
  }
  fs.writeFileSync(file(relativePath), source);
}

console.log("Applied targeted content-correctness fixes.");
