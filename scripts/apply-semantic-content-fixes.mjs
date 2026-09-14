import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const resolve = (relativePath) => path.join(root, relativePath);
const readJSON = (relativePath) => JSON.parse(fs.readFileSync(resolve(relativePath), "utf8"));
const writeJSON = (relativePath, value) => fs.writeFileSync(resolve(relativePath), `${JSON.stringify(value, null, 2)}\n`);

function question(data, id) {
  const found = (data.questions || []).find((item) => item.id === id);
  if (!found) throw new Error(`Question ${id} not found`);
  return found;
}

{
  const relativePath = "data/units/lianpo-linxiangru/question-banks/content.json";
  const data = readJSON(relativePath);

  const q1 = question(data, "lp-content-001");
  q1.statements[0].answer = "unknown";
  q1.statements[0].explanation = "引文只交代廉頗是趙國良將、後拜上卿，以及藺相如是趙人、為宦者令繆賢的舍人，並沒有說明兩人的家庭出身，因此不能判斷二人是否都出身於官宦之家，故屬無從判斷。";

  const q8 = question(data, "lp-content-008");
  q8.stem = "在《史記‧廉頗藺相如列傳》（節錄）「完璧歸趙」一事中，原文寫藺相如「視秦王無意償趙城」。以下哪個情況是在這個判斷之前出現、並直接促使他作出判斷的？";
  q8.options = [
    { "key": "A", "text": "秦王得到和氏璧後大喜，傳給美人及左右觀看，卻沒有交付城池的行動" },
    { "key": "B", "text": "秦王齋戒五日，並設九賓之禮" },
    { "key": "C", "text": "秦王讓藺相如指出和氏璧的瑕疵" },
    { "key": "D", "text": "秦王決定厚待藺相如，讓他返回趙國" }
  ];
  q8.answer = "A";
  q8.note = "原文先寫秦王得璧後「大喜，傳以示美人及左右，左右皆呼萬歲」，緊接着便寫「相如視秦王無意償趙城」。B、C、D均屬相如此一判斷之後的情節。";

  writeJSON(relativePath, data);
}

{
  const relativePath = "data/units/yueyanglouji/question-banks/structure-skill.json";
  const data = readJSON(relativePath);
  const q9 = question(data, "yyl-skill-009");
  const row = q9.rows.find((item) => item.text === "浮光躍金，靜影沉璧。");
  if (!row) throw new Error("yyl-skill-009 target row not found");
  row.answers = ["動態描寫", "靜態描寫"];
  q9.note = "「浮光躍金」以「躍」寫水面浮光閃動，屬動態描寫；「靜影沉璧」寫月影靜靜映在水中，屬靜態描寫，因此此句兼有動、靜兩種描寫。";
  writeJSON(relativePath, data);
}

{
  const relativePath = "data/units/denglou/question-banks/structure-skill.json";
  const data = readJSON(relativePath);

  const q2 = question(data, "cb-skill-002");
  q2.stem = "以下哪一句與「北極朝廷終不改。」（杜甫《登樓》）運用了相同的借喻手法？";
  q2.options = [
    { "key": "A", "text": "居廟堂之高、處江湖之遠。（《岳陽樓記》）" },
    { "key": "B", "text": "君子無終食之間違仁。（《論仁論孝論君子》）" },
    { "key": "C", "text": "以地事秦，猶抱薪救火。（《六國論》）" },
    { "key": "D", "text": "今兩虎共鬥，其勢不俱生。（《廉頗藺相如列傳》（節錄））" }
  ];
  q2.answer = "D";
  q2.explanation = "「北極朝廷終不改」以北極星借喻朝廷的穩固；④「今兩虎共鬥」以「兩虎」直接借喻廉頗、藺相如兩位重臣，兩者同屬借喻。①以「廟堂／江湖」借代朝廷與民間，②「終食之間」強調極短時間，③有「猶」字，是明喻而非借喻。";

  const q4 = question(data, "cb-skill-004");
  q4.scoring_elements[1] = "甲句效果：「錦江」對「玉壘」、「春色」對「浮雲」、「來」對「變」、「天地」對「古今」，詞性、句式相對，形成整齊有力的節奏；同時把眼前廣闊春景與古今時局變化相聯，拓展時空層次，寄寓作者對國事變幻的感慨（2分）";

  writeJSON(relativePath, data);
}

{
  const relativePath = "scripts/validate-content-correctness.mjs";
  let source = fs.readFileSync(resolve(relativePath), "utf8");
  const marker = `      if (q.question_type === "multi_select") {\n`;
  const rule = `      if (q.question_type === "single_choice" && typeof q.note === "string" && /(答案|正確答案).{0,12}(可能|可以|可).{0,8}(不止|多於|超過)一個|答案可能不止一個/.test(q.note)) {\n        fail(\`${'${location}'}: single_choice note admits that more than one answer may be valid; rewrite the item or use multi_select\`);\n      }\n\n`;
  if (!source.includes("single_choice note admits that more than one answer may be valid")) {
    if (!source.includes(marker)) throw new Error("Could not find single-choice insertion point");
    source = source.replace(marker, rule + marker);
  }
  fs.writeFileSync(resolve(relativePath), source);
}

console.log("Applied targeted semantic content fixes.");
