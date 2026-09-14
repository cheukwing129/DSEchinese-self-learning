import fs from "node:fs";

function lines(...items) {
  return items.join("\n");
}

function replaceOnce(text, from, to, label) {
  const count = text.split(from).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one match, found ${count}`);
  return text.replace(from, to);
}

function patchFile(file, patcher) {
  const original = fs.readFileSync(file, "utf8");
  const next = patcher(original);
  if (next === original) throw new Error(`${file}: patch made no changes`);
  fs.writeFileSync(file, next, "utf8");
}

patchFile("js/question-engine.js", (input) => {
  let text = input;

  const difficultyLine = '  const difficultyLabel = { basic: "基礎", intermediate: "進階", advanced: "挑戰" };';
  const diagnosticsHelpers = lines(
    difficultyLine,
    "",
    "  // ---------- 補強診斷 ----------",
    "  // 沒有人工標註 error_tags/remediation 時，只根據題目已知的能力分類、",
    "  // knowledge point 與段落位置提供補強方向，不推斷學生的心理／認知錯因。",
    "  function diagnosticTags(q, aggregate = false) {",
    '    if (Array.isArray(q.error_tags) && q.error_tags.length) return q.error_tags;',
    '    const ability = q.ability || "其他";',
    '    if (aggregate || !q.knowledge_point || q.knowledge_point === ability) return [ability];',
    '    return [ability, q.knowledge_point];',
    "  }",
    "",
    "  function paragraphHint(q) {",
    "    if (Array.isArray(q.paragraph_ref) && q.paragraph_ref.length) {",
    '      return "重讀第" + q.paragraph_ref.join("、") + "段，";',
    "    }",
    '    if (q.paragraph_ref !== null && q.paragraph_ref !== undefined && q.paragraph_ref !== "") {',
    '      return "重讀第" + q.paragraph_ref + "段，";',
    "    }",
    '    return "重讀題目相關原文，";',
    "  }",
    "",
    "  function defaultRemediation(q) {",
    "    if (q.remediation) return q.remediation;",
    '    const ability = q.ability || "";',
    '    if (ability.includes("字詞")) {',
    '      return "先回到「字詞與句式」，確認題目中的詞義、虛詞用法及語境，再重做同類題。";',
    "    }",
    '    if (ability.includes("內容理解")) {',
    '      return "先回到「疏通文意」，" + paragraphHint(q) + "用自己的話概括內容，再回來作答。";',
    "    }",
    '    if (ability.includes("結構") || ability.includes("手法") || ability.includes("鑒賞")) {',
    '      return "先回到「結構與鑒賞」，找出文本證據，再按「手法／結構 → 內容 → 作用」三步重答。";',
    "    }",
    '    if (ability.includes("主旨") || ability.includes("思考")) {',
    '      return "先回到「主旨與思考」，用一句話寫出篇章中心思想，再把題目引文與主旨連結。";',
    "    }",
    '    if (ability.includes("跨篇")) {',
    '      return "先分別列出兩篇的核心觀點／手法和文本證據，再比較相同與不同之處。";',
    "    }",
    '    if (ability.includes("情境")) {',
    '      return "先抽取原文可遷移的原則，再逐項對照情境條件，避免只憑直覺作答。";',
    "    }",
    '    return "重讀解析與題目相關內容，先指出自己需要補強的知識點，再重做同類題。";',
    "  }"
  );
  text = replaceOnce(text, difficultyLine, diagnosticsHelpers, "insert diagnostics helpers");

  text = replaceOnce(
    text,
    '      <p class="page-subtitle">整合各分類題目，隨機抽題，並附錯因標籤與補救建議</p>',
    '      <p class="page-subtitle">整合各分類題目，隨機抽題，並提供需補強範疇與補救建議</p>',
    "challenge subtitle"
  );

  text = replaceOnce(
    text,
    lines(
      '          if (rec.isCorrect === false && q.error_tags) {',
      '            q.error_tags.forEach((tag) => (errorTagCounts[tag] = (errorTagCounts[tag] || 0) + 1));',
      '          }'
    ),
    lines(
      '          if (rec.isCorrect === false) {',
      '            diagnosticTags(q, true).forEach((tag) => (errorTagCounts[tag] = (errorTagCounts[tag] || 0) + 1));',
      '          }'
    ),
    "challenge aggregate diagnostics"
  );

  text = replaceOnce(
    text,
    ': `<p style="color:var(--color-ink-soft); font-size:14px;">本次挑戰沒有可統計的錯因標籤。</p>`;',
    ': `<p style="color:var(--color-ink-soft); font-size:14px;">本次已作答的客觀題沒有需要補強的範疇。</p>`;',
    "empty diagnostics text"
  );

  text = replaceOnce(
    text,
    lines(
      '        <div class="section-title"><span class="seal">因</span>錯因分布與補救建議</div>',
      '        ${tagList}'
    ),
    lines(
      '        <div class="section-title"><span class="seal">補</span>需補強範疇與補救建議</div>',
      '        <p style="font-size:12px; color:var(--color-ink-soft); margin:0 0 10px;">以下按錯題所屬能力分類統計，不推斷你的心理或認知錯因。</p>',
      '        ${tagList}'
    ),
    "challenge diagnostics heading"
  );

  text = replaceOnce(
    text,
    lines(
      '    if (showRemediation && isObjective && state.isCorrect === false) {',
      '      html += `<div class="reveal-row" style="margin-top:12px;">',
      '        ${q.error_tags ? `<span class="reveal-label">可能錯因</span><div>${q.error_tags.map((t) => `<span class="tag" style="margin-right:4px;">${esc(t)}</span>`).join("")}</div>` : ""}',
      '        ${q.remediation ? `<div class="reveal-explanation" style="margin-top:6px;">💡 ${esc(q.remediation)}</div>` : ""}',
      '      </div>`;',
      '    }'
    ),
    lines(
      '    if (showRemediation && isObjective && state.isCorrect === false) {',
      '      const tags = diagnosticTags(q);',
      '      const remediation = defaultRemediation(q);',
      '      html += `<div class="reveal-row" style="margin-top:12px;">',
      '        <span class="reveal-label">需補強範疇</span>',
      '        <div>${tags.map((t) => `<span class="tag" style="margin-right:4px;">${esc(t)}</span>`).join("")}</div>',
      '        <div class="reveal-explanation" style="margin-top:6px;">💡 ${esc(remediation)}</div>',
      '      </div>`;',
      '    }'
    ),
    "per-question remediation"
  );

  return text;
});

patchFile("js/content-renderer.js", (input) => replaceOnce(
  input,
  '      challenge: "整合各分類抽題，附錯因與補救",',
  '      challenge: "整合各分類抽題，標示需補強範疇與補救",',
  "challenge module description"
));

patchFile("README.md", (input) => {
  let text = input;
  const oldBlock = lines(
    '3. 題目物件的 `question_type` **必須**使用以下 6 種已驗證支援的類型，不可自創新類型：',
    '   `single_choice`、`short_answer`、`fill_table`、`extract_sentence`、`true_false_unknown`、`long_answer`',
    '   （多選題或需逐項作答的題目，統一用 `short_answer` 搭配 `items` 陣列呈現，不要自創 `matching`／`fill_in_blank`／`pos_meaning` 等類型，否則題目引擎會報「未支援的題型」錯誤。）',
    '4. 不需要改動任何 HTML/CSS/JS——全部頁面模板、題庫引擎、進度系統均為共用'
  );
  const newBlock = lines(
    '3. 題目物件的 `question_type` **必須**使用以下 9 種已驗證支援的類型，不可自創新類型：',
    '   `single_choice`、`multi_select`、`true_false_unknown`、`matching`、`extract_sentence`、`cloze_choice`、`short_answer`、`long_answer`、`fill_table`。',
    '   複合題可在主題目加 `items`，或以 `part2` 加入延伸題；`part2.type`／`part2.question_type` 亦必須使用以上支援類型。',
    '4. 修改 `data/` 或題目引擎後，GitHub Actions 的 **Validate content** 必須通過；它會檢查 JSON、題目 ID、題型結構、引用與必要檔案。',
    '5. 一般新增／修改篇章不需要改動 HTML/CSS/JS——全部頁面模板、題庫引擎、進度系統均為共用'
  );
  text = replaceOnce(text, oldBlock, newBlock, "README supported question types");
  text = text.replaceAll("錯因分布", "需補強範疇分布");
  return text;
});

console.log("Diagnostics and documentation patch applied.");
