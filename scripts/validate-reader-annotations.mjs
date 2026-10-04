import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const source = fs.readFileSync(path.join(root, "js/content-renderer.js"), "utf8");
const start = source.indexOf("    function paragraphHTML(p) {");
const end = source.indexOf("    function passageHTML(", start);
assert(start > 0 && end > start, "Reader rendering function must exist");
const esc = (v) => String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;")
  .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
let additions = 0, sentences = 0, paragraphs = 0;
for (const unitId of fs.readdirSync(path.join(root, "data/units"))) {
  const file = path.join(root, "data/units", unitId, "text.json");
  if (!fs.existsSync(file)) continue;
  const text = JSON.parse(fs.readFileSync(file, "utf8"));
  assert(text.reader_annotations?.length > 0, `${unitId}: additions required`);
  assert.match(text.reader_annotation_source.url, /^https:\/\/www\.edb\.gov\.hk\//);
  const all = [...text.annotations, ...text.reader_annotations];
  const annoMap = Object.fromEntries(all.map((a) => [a.id, a]));
  assert.equal(Object.keys(annoMap).length, all.length, `${unitId}: unique IDs`);
  const paragraphTerms = (p) => [...p.annotation_ids, ...p.reader_annotation_ids].map((id) => annoMap[id]);
  // Exercise the actual rendering function, not a duplicate matching implementation.
  const render = new Function("esc", "paragraphTerms", "annoMap",
    source.slice(start, end) + "\nreturn paragraphHTML;")(esc, paragraphTerms, annoMap);
  const used = new Set();
  for (const p of text.paragraphs) {
    paragraphs++;
    assert(p.reader_annotation_ids.length > 0, `${unitId}/${p.id}: additions required`);
    const keys = new Set();
    for (const id of p.reader_annotation_ids) {
      const a = annoMap[id];
      assert(a, `${unitId}/${p.id}: unknown ${id}`);
      assert(!used.has(id), `${id}: reader additions belong to one paragraph`);
      used.add(id);
      assert(["word", "sentence"].includes(a.kind));
      assert.equal(a.source, "supplement");
      assert(a.explanation.trim().length > 0);
      assert(Number.isInteger(a.occurrence) && a.occurrence > 0);
      const key = `${a.term}:${a.occurrence}:${a.kind}`;
      assert(!keys.has(key), `${unitId}/${p.id}: duplicate ${key}`);
      keys.add(key);
      let pos = -1;
      for (let n = 0; n < a.occurrence; n++) {
        pos = p.text.indexOf(a.term, pos < 0 ? 0 : pos + a.term.length);
        assert(pos >= 0, `${unitId}/${p.id}: missing ${key}`);
      }
      additions++;
      if (a.kind === "sentence") sentences++;
    }
    const result = render(p);
    assert.equal(result.html.replace(/<[^>]+>/g, ""), esc(p.text), `${unitId}/${p.id}: original preserved`);
    let depth = 0;
    for (const m of result.html.matchAll(/<\/?button\b[^>]*>/g)) {
      depth += m[0].startsWith("</") ? -1 : 1;
      assert(depth >= 0 && depth <= 1, "No nested or unbalanced buttons");
    }
    assert.equal(depth, 0);
    const renderedIds = [...(result.html + result.notes).matchAll(/data-anno="([^"]+)"/g)].map((m) => m[1]);
    const available = renderedIds.map((id) => annoMap[id]);
    for (const a of paragraphTerms(p)) {
      assert(available.some((b) => b.term === a.term && b.explanation === a.explanation),
        `${unitId}/${p.id}: inaccessible gloss ${a.id} (${a.term})`);
    }
  }
  assert.equal(used.size, text.reader_annotations.length, `${unitId}: no unused reader additions`);
}
assert.equal(paragraphs > 70, true);
// Both longer and shorter EDB ranges must outrank supplemental ranges.
for (const [originalTerm, extraTerm] of [["竊計欲亡走燕", "計"], ["計", "竊計欲亡走燕"], ["計", "計"]]) {
  const map = {
    edb: { id: "edb", term: originalTerm, explanation: "原有詞解" },
    extra: { id: "extra", term: extraTerm, explanation: "補充詞解", kind: "word", source: "supplement" }
  };
  const render = new Function("esc", "paragraphTerms", "annoMap",
    source.slice(start, end) + "\nreturn paragraphHTML;")(esc, () => [map.extra, map.edb], map);
  const result = render({ text: "竊計欲亡走燕" });
  assert(result.html.includes('data-anno="edb"'), "EDB explanation wins regardless of range length or input order");
  assert(!result.html.includes('data-anno="extra"'), "Overlapping supplement is not substituted for EDB");
  assert(result.notes.includes('data-anno="extra"'), "Supplement remains accessible below");
}
console.log(`Reader annotation validation passed: ${additions} additions (${sentences} sentence notes), ${paragraphs} paragraphs; text preserved and every gloss accessible.`);
