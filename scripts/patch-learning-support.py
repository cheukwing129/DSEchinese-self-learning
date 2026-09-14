from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 match, found {count}")
    return text.replace(old, new, 1)

# app.js: request background/rubrics only on routes that use them.
path = Path("js/app.js")
text = path.read_text()
repls = [
    ('await withUnitBundle(params.unitId, (bundle) => {\n      ContentRenderer.renderUnitHome', 'await withUnitBundle(params.unitId, { resources: ["background"] }, (bundle) => {\n      ContentRenderer.renderUnitHome', 'unit home background'),
    ('{ resources: ["memorisation"], allQuestionBanks: true }', '{ resources: ["memorisation", "rubrics"], allQuestionBanks: true }', 'progress rubrics'),
    ('{ banks: [bankName] }', '{ resources: ["rubrics"], banks: [bankName] }', 'quiz rubrics'),
    ('{ banks: ["cross-text"] }', '{ resources: ["rubrics"], banks: ["cross-text"] }', 'cross text rubrics'),
]
for old, new, label in repls:
    text = replace_once(text, old, new, label)
text = text.replace('{ allQuestionBanks: true }, (bundle) => {\n      QuestionEngine.renderChallenge', '{ resources: ["rubrics"], allQuestionBanks: true }, (bundle) => {\n      QuestionEngine.renderChallenge')
if text.count('resources: ["rubrics"], allQuestionBanks: true') != 3:
    raise SystemExit('challenge rubrics: expected 3 challenge routes')
path.write_text(text)

# progress.js: persist explicit self-review checks separately from mastery statistics.
path = Path("js/progress.js")
text = path.read_text()
text = replace_once(
    text,
    '    if (!("charsViewedAt" in unit.memorisation)) unit.memorisation.charsViewedAt = null;\n    return unit;',
    '    if (!("charsViewedAt" in unit.memorisation)) unit.memorisation.charsViewedAt = null;\n    if (!unit.selfReview || typeof unit.selfReview !== "object") unit.selfReview = {};\n    return unit;',
    'self review shape'
)
text = replace_once(
    text,
    '  function clearUnit(unitId) {',
    '''  function setSelfReviewItem(unitId, item, checked) {
    if (!item) return;
    const all = unitStore(unitId);
    if (checked) all[unitId].selfReview[item] = true;
    else delete all[unitId].selfReview[item];
    saveAll(all);
  }

  function getSelfReview(unitId) {
    const all = unitStore(unitId);
    return { ...all[unitId].selfReview };
  }

  function clearUnit(unitId) {''',
    'self review methods'
)
text = replace_once(
    text,
    '    recordMemorisationAttempt, markMemorisationCharactersViewed, memorisationStats,\n    clearUnit, abilityStats, wrongQuestionIds, overallAccuracy',
    '    recordMemorisationAttempt, markMemorisationCharactersViewed, memorisationStats,\n    setSelfReviewItem, getSelfReview,\n    clearUnit, abilityStats, wrongQuestionIds, overallAccuracy',
    'self review exports'
)
path.write_text(text)

# content-renderer.js: expose background data and saved self-review checklist.
path = Path("js/content-renderer.js")
text = path.read_text()
needle = '''  function renderUnitHome(bundle, unitId) {
    const u = bundle.unit;'''
replacement = '''  function backgroundCardHTML(value, fallbackTitle) {
    if (!value) return "";
    const title = typeof value === "object" ? (value.title || fallbackTitle) : fallbackTitle;
    const content = typeof value === "object" ? value.content : value;
    if (!content) return "";
    return `<details class="card card-tight">
      <summary style="cursor:pointer; font-weight:700;">${esc(title)}</summary>
      <p style="margin:12px 0 0; line-height:1.9; color:var(--color-ink-soft);">${esc(content)}</p>
    </details>`;
  }

  function rubricChecklist(rubrics) {
    if (!rubrics || typeof rubrics !== "object") return [];
    if (Array.isArray(rubrics.self_review_checklist)) return rubrics.self_review_checklist;
    if (Array.isArray(rubrics.self_check_prompts)) return rubrics.self_check_prompts;
    return [];
  }

  function renderUnitHome(bundle, unitId) {
    const u = bundle.unit;'''
text = replace_once(text, needle, replacement, 'background helpers')
text = replace_once(
    text,
    '    const moduleDescs = {',
    '''    const background = bundle.background || {};
    const backgroundCards = [
      backgroundCardHTML(background.author_intro, "作者簡介"),
      backgroundCardHTML(background.writing_background, "寫作背景")
    ].filter(Boolean).join("");
    const moduleDescs = {''',
    'background cards'
)
text = replace_once(
    text,
    '      <p class="page-subtitle">${esc(u.author)} · ${esc(u.dynasty)} · ${esc(u.genre)}</p>\n      <div class="module-grid">${cards}</div>',
    '''      <p class="page-subtitle">${esc(u.author)} · ${esc(u.dynasty)} · ${esc(u.genre)}</p>
      ${backgroundCards ? `
        <div class="section-title"><span class="seal">知</span>作者與背景</div>
        <div class="module-grid" style="margin-bottom:24px;">${backgroundCards}</div>
      ` : ""}
      <div class="module-grid">${cards}</div>''',
    'unit home background ui'
)
text = replace_once(
    text,
    '    const reflection = Progress.getReflection(unitId, "theme");\n    const memoStats = Progress.memorisationStats(unitId, (bundle.memorisation && bundle.memorisation.sentence_groups) || []);',
    '''    const reflection = Progress.getReflection(unitId, "theme");
    const memoStats = Progress.memorisationStats(unitId, (bundle.memorisation && bundle.memorisation.sentence_groups) || []);
    const selfReviewItems = rubricChecklist(bundle.rubrics);
    const savedSelfReview = Progress.getSelfReview(unitId);''',
    'progress rubric state'
)
text = replace_once(
    text,
    '    const wrongList = wrongQuestions.length',
    '''    const selfReviewList = selfReviewItems
      .map((item) => `
        <label class="option-item" style="cursor:pointer; align-items:flex-start;">
          <input type="checkbox" class="self-review-check" data-review-key="${esc(item)}" ${savedSelfReview[item] ? "checked" : ""} style="width:18px; height:18px; margin-top:2px; flex-shrink:0;" />
          <span>${esc(item)}</span>
        </label>`)
      .join("");

    const wrongList = wrongQuestions.length''',
    'self review list'
)
text = replace_once(
    text,
    '''      <div class="card">
        <div class="section-title"><span class="seal">背</span>背誦練習</div>''',
    '''      ${selfReviewList ? `
      <div class="card">
        <div class="section-title"><span class="seal">檢</span>自我檢核</div>
        <p style="font-size:13px; color:var(--color-ink-soft); margin:0 0 12px;">這是你自己的學習檢核紀錄，只表示「我認為自己能做到」，不計入正確率，也不會被系統當成已掌握。</p>
        <div class="option-list">${selfReviewList}</div>
      </div>` : ""}

      <div class="card">
        <div class="section-title"><span class="seal">背</span>背誦練習</div>''',
    'self review card'
)
text = replace_once(
    text,
    '    document.getElementById("clear-progress-btn").addEventListener("click", () => {',
    '''    document.querySelectorAll(".self-review-check").forEach((box) => {
      box.addEventListener("change", () => {
        Progress.setSelfReviewItem(unitId, box.dataset.reviewKey, box.checked);
      });
    });

    document.getElementById("clear-progress-btn").addEventListener("click", () => {''',
    'self review events'
)
text = replace_once(
    text,
    '確定要清除《" + unit.title + "》的所有作答、背誦練習與反思紀錄嗎？',
    '確定要清除《" + unit.title + "》的所有作答、背誦練習、自評檢核與反思紀錄嗎？',
    'clear wording'
)
path.write_text(text)

# question-engine.js: use unit rubrics only as an honest fallback when a long answer lacks its own scoring points.
path = Path("js/question-engine.js")
text = path.read_text()
text = replace_once(
    text,
    '  // ---------- selection helpers ----------',
    '''  function rubricFallbackElements(q, rubrics) {
    if (!rubrics || typeof rubrics !== "object") return [];
    if (Array.isArray(rubrics.common_scoring_elements) && rubrics.common_scoring_elements.length) {
      return rubrics.common_scoring_elements.map((item) => {
        if (typeof item === "string") return item;
        const label = item.label || "";
        const description = item.description || "";
        return [label, description].filter(Boolean).join("：");
      }).filter(Boolean);
    }

    const groups = Array.isArray(rubrics.long_answer_scoring_elements) ? rubrics.long_answer_scoring_elements : [];
    if (!groups.length) return [];
    const context = `${q.ability || ""} ${q.knowledge_point || ""} ${q.stem || ""}`;
    const candidates = [
      ["結構", ["結構"]],
      ["手法", ["手法", "賞析", "鑒賞", "修辭"]],
      ["主旨", ["主旨", "寓意", "思想", "情感"]],
      ["比較", ["比較", "跨篇", "異同"]],
      ["開放", ["開放", "見解", "情境", "思考"]]
    ];
    const matchedKind = candidates.find(([, keywords]) => keywords.some((keyword) => context.includes(keyword)));
    if (!matchedKind) return [];
    const group = groups.find((item) => String(item.question_type || "").includes(matchedKind[0]));
    return group && Array.isArray(group.elements) ? group.elements : [];
  }

  // ---------- selection helpers ----------''',
    'rubric fallback helper'
)
text = replace_once(
    text,
    'revealSlot.innerHTML = renderReveal(question, state, showRemediation);',
    'revealSlot.innerHTML = renderReveal(question, state, showRemediation, bundle.rubrics);',
    'pass rubrics to reveal'
)
text = replace_once(
    text,
    '  function renderReveal(q, state, showRemediation) {',
    '  function renderReveal(q, state, showRemediation, rubrics) {',
    'renderReveal signature'
)
text = replace_once(
    text,
    '''    if (q.scoring_elements) {
      html += `<div class="reveal-row" style="margin-top:10px;"><span class="reveal-label">評分元素</span><ul class="scoring-elements">${q.scoring_elements.map((e) => `<li>${esc(e)}</li>`).join("")}</ul></div>`;
    }
    if (q.follow_up_open_answer) {''',
    '''    if (q.scoring_elements) {
      html += `<div class="reveal-row" style="margin-top:10px;"><span class="reveal-label">評分元素</span><ul class="scoring-elements">${q.scoring_elements.map((e) => `<li>${esc(e)}</li>`).join("")}</ul></div>`;
    }
    if (!isObjective && !q.answer_elements && !q.scoring_elements) {
      const fallbackElements = rubricFallbackElements(q, rubrics);
      if (fallbackElements.length) {
        html += `<div class="reveal-row" style="margin-top:10px;"><span class="reveal-label">篇章通用自評框架（非本題精確評分）</span><ul class="scoring-elements">${fallbackElements.map((e) => `<li>${esc(e)}</li>`).join("")}</ul></div>`;
      }
    }
    if (q.follow_up_open_answer) {''',
    'main rubric fallback'
)
text = replace_once(
    text,
    '    if (q.part2) html += renderPart2Reveal(q, state);',
    '    if (q.part2) html += renderPart2Reveal(q, state, rubrics);',
    'part2 rubrics call'
)
text = replace_once(
    text,
    '  function renderPart2Reveal(q, state) {',
    '  function renderPart2Reveal(q, state, rubrics) {',
    'part2 signature'
)
text = replace_once(
    text,
    '''    if (part.scoring_elements) html += `<ul class="scoring-elements">${part.scoring_elements.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>`;
    if (part.explanation)''',
    '''    if (part.scoring_elements) html += `<ul class="scoring-elements">${part.scoring_elements.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>`;
    if (!OBJECTIVE_TYPES.includes(type) && !part.answer_elements && !part.scoring_elements) {
      const fallbackElements = rubricFallbackElements({ ...part, question_type: type, ability: q.ability, knowledge_point: q.knowledge_point }, rubrics);
      if (fallbackElements.length) html += `<div class="reveal-explanation" style="margin-top:8px;"><strong>篇章通用自評框架（非本題精確評分）</strong></div><ul class="scoring-elements">${fallbackElements.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>`;
    }
    if (part.explanation)''',
    'part2 rubric fallback'
)
path.write_text(text)

print('Learning support patch applied.')
