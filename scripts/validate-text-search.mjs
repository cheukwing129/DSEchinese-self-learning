import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const context = vm.createContext({ App: { escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
} } });
vm.runInContext(fs.readFileSync("js/text-search.js", "utf8"), context);
const search = vm.runInContext("TextSearch", context);
const fixture = {
  paragraphs: [{ id: 1, text: "其人之言；行之有故。聞之而喜。", annotation_ids: ["possessive", "object"], reader_annotation_ids: ["third", "compound", "duplicate"] }],
  annotations: [{ id: "possessive", term: "之", occurrence: 1, explanation: "的" },
    { id: "object", term: "之", occurrence: 2, explanation: "這件事" }],
  reader_annotations: [{ id: "third", term: "之", occurrence: 3, explanation: "這句話" },
    { id: "compound", term: "有故", explanation: "有原因" },
    { id: "duplicate", term: "之", occurrence: 1, explanation: "的" }]
};
const rows = search.findInText(fixture, "之");
assert.equal(rows.length, 3);
assert.equal(rows[0].notes.length, 1, "duplicate notes are shown once");
assert.equal(rows[0].notes[0].explanation, "的");
assert.equal(rows[1].notes[0].explanation, "這件事", "a repeated character must keep its own gloss");
assert.equal(rows[2].notes[0].explanation, "這句話", "later sentences must not inherit the first gloss");
assert.equal(search.findInText(fixture, "故")[0].notes[0].term, "有故", "a character inside a compound may show its contextual note");
assert.equal(search.findInText(fixture, "其")[0].notes.length, 0, "unannotated words must not receive an unrelated gloss");
assert.equal(search.findInText(fixture, " ").length, 0);
assert.equal(search.findInText(fixture, "不存在").length, 0);
const crossing = search.findInText(fixture, "言；行");
assert.equal(crossing.length, 1, "a phrase spanning punctuation must be shown once");
assert.equal(crossing[0].count, 1);
assert(crossing[0].sentence.includes("言；行"));
assert.equal(search.highlight('<img src=x>之&之', '之'), '&lt;img src=x&gt;<mark>之</mark>&amp;<mark>之</mark>');
assert.equal(search.highlight('a.*b.*', '.*'), 'a<mark>.*</mark>b<mark>.*</mark>', "search must use literal text, not a regex");

const units = JSON.parse(fs.readFileSync("data/curriculum.json", "utf8")).units.filter((unit) => unit.status === "available");
let checked = 0;
for (const unit of units) {
  const text = JSON.parse(fs.readFileSync(`data/units/${unit.id}/text.json`, "utf8"));
  for (const term of ["之", "而", "以", "故", "天下", "君子", "「"]) {
    const expected = text.paragraphs.reduce((sum, p) => sum + p.text.split(term).length - 1, 0);
    const results = search.findInText(text, term);
    assert.equal(results.reduce((sum, row) => sum + row.count, 0), expected, `${unit.id}: every occurrence of ${term} must be included`);
    for (const row of results) {
      const paragraph = text.paragraphs.find((p) => p.id === row.paragraphId);
      assert(paragraph.text.includes(row.sentence), "results must quote existing source text verbatim");
      assert(row.sentence.includes(term));
      for (const note of row.notes) assert(paragraph.text.includes(note.term));
    }
    checked++;
  }
}
// The same paragraph contains 故 as a noun and conjunction: verify real content.
const lianpo = JSON.parse(fs.readFileSync("data/units/lianpo-linxiangru/text.json", "utf8"));
const actual = search.findInText(lianpo, "故");
assert(actual.find((row) => row.sentence.includes("一璧之故逆"))?.notes.some((note) => note.explanation.includes("原因、緣故")));
assert(actual.find((row) => row.sentence.includes("故臣復取璧"))?.notes.some((note) => note.explanation === "因此。"));
console.log(`Text search passed: occurrence-specific glosses, literal matching, escaping and ${checked} complete-corpus comparisons across ${units.length} works.`);
