import fs from "node:fs";

function load(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function save(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function findQuestion(data, id) {
  const q = data.questions.find((item) => item.id === id);
  if (!q) throw new Error(`Question not found: ${id}`);
  return q;
}

// 《勸學》：part2 本來已明確列出 A-D，但資料只留 answer_text。
{
  const file = "data/units/quanxue/question-banks/content.json";
  const data = load(file);
  const q = findQuestion(data, "qx-content-007");
  q.part2.options = [
    { key: "A", text: "設問" },
    { key: "B", text: "反問" },
    { key: "C", text: "比喻" },
    { key: "D", text: "開門見山" }
  ];
  q.part2.answer = "D";
  delete q.part2.answer_text;
  save(file, data);
}

// 《廉頗藺相如列傳》：把文字式「正確——解析」拆成客觀答案 + explanation。
{
  const file = "data/units/lianpo-linxiangru/question-banks/content.json";
  const data = load(file);
  const q = findQuestion(data, "lp-content-003");
  const original = q.part2.answer_text || "";
  q.part2.answer = "true";
  q.part2.explanation = original.replace(/^正確[—－:\-\s]*/, "");
  delete q.part2.answer_text;
  save(file, data);
}

// 《六國論》：題目要求解釋三項錯誤，資料沒有表格結構，實際應為長問答。
{
  const file = "data/units/liuguolun/question-banks/content.json";
  const data = load(file);
  const q = findQuestion(data, "lg-content-002");
  q.question_type = "long_answer";
  save(file, data);
}

console.log("Known question schema migrations applied.");
