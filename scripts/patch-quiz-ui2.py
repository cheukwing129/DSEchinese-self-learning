from pathlib import Path

root = Path('.')
qpath = root / 'js/question-engine.js'
csspath = root / 'css/style.css'
q = qpath.read_text(encoding='utf-8')
css = csspath.read_text(encoding='utf-8')


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, found {count}')
    return text.replace(old, new, 1)

q = replace_once(
    q,
    '  const difficultyLabel = { basic: "基礎", intermediate: "進階", advanced: "挑戰" };\n',
    '  const difficultyLabel = { basic: "基礎", intermediate: "進階", advanced: "挑戰" };\n'
    '  const questionTypeLabel = {\n'
    '    single_choice: "單選", multi_select: "多選", true_false_unknown: "判斷", matching: "配對",\n'
    '    extract_sentence: "摘錄", cloze_choice: "選詞填充", short_answer: "短答", long_answer: "長答", fill_table: "填表"\n'
    '  };\n',
    'question type labels'
)

old_shell = '''      App.mount(`
        <p class="quiz-progress-label">${esc(title)} · ${esc(indexLabel)}</p>
        <div class="card">
          <div class="q-meta-row">
            <span class="tag">${esc(question.ability)}</span>
            ${question.knowledge_point ? `<span class="tag">${esc(question.knowledge_point)}</span>` : ""}
            <span class="tag">${esc(difficultyLabel[question.difficulty] || question.difficulty)}</span>
            ${question.score ? `<span class="tag tag-score">${question.score} 分</span>` : ""}
            ${question.is_cross_text ? `<span class="tag">跨篇</span>` : ""}
          </div>
          ${renderQuestionBody(question, state)}
          <div id="reveal-slot" tabindex="-1" aria-live="polite" aria-atomic="true"></div>
          <div class="btn-row" id="action-row"></div>
        </div>
        <div class="quiz-nav-bar">
          <div class="quiz-nav-inner">
            <div class="quiz-nav-group">
              <button class="btn btn-secondary" id="prev-btn" ${onPrev ? "" : "disabled"}>← 上一題</button>
              <button class="btn btn-secondary" id="next-btn" ${onNext ? "" : "disabled"}>下一題 →</button>
            </div>
            <div class="quiz-nav-group">
              ${extraNav || ""}
              <a class="btn btn-ghost" href="${backHref}">${backLabel ? esc(backLabel) : `返回《${esc(bundle.unit.title)}》`}</a>
              <a class="btn btn-ghost" href="#/">返回首頁</a>
            </div>
          </div>
        </div>
      `);'''

new_shell = '''      const isObjective = OBJECTIVE_TYPES.includes(question.question_type);
      const outcomeClass = state.submitted && isObjective
        ? (state.isCorrect === true ? "is-correct" : state.isCorrect === false ? "is-incorrect" : "")
        : "";
      const outcomeBadge = state.submitted && isObjective
        ? `<span class="quiz-result-badge ${state.isCorrect ? "is-correct" : "is-incorrect"}">${state.isCorrect ? "✓ 答對" : "× 待修正"}</span>`
        : `<span class="question-type-pill">${esc(questionTypeLabel[question.question_type] || question.question_type)}</span>`;

      App.mount(`
        <section class="quiz-shell ${state.submitted ? "is-submitted" : ""}" aria-label="${esc(title)}">
          <header class="quiz-context-bar">
            <div class="quiz-context-copy">
              <span class="quiz-context-title">${esc(title)}</span>
              <span class="quiz-progress-label">${esc(indexLabel)}</span>
            </div>
            <a class="quiz-context-back" href="${backHref}">${backLabel ? esc(backLabel) : `返回《${esc(bundle.unit.title)}》`}</a>
          </header>

          <article class="question-surface ${outcomeClass}">
            <div class="question-surface-head">
              <div class="q-meta-row">
                <span class="tag">${esc(question.ability)}</span>
                ${question.knowledge_point ? `<span class="tag">${esc(question.knowledge_point)}</span>` : ""}
                <span class="tag">${esc(difficultyLabel[question.difficulty] || question.difficulty)}</span>
                ${question.score ? `<span class="tag tag-score">${question.score} 分</span>` : ""}
                ${question.is_cross_text ? `<span class="tag">跨篇</span>` : ""}
              </div>
              ${outcomeBadge}
            </div>
            <div class="question-body">${renderQuestionBody(question, state)}</div>
            <div id="reveal-slot" tabindex="-1" aria-live="polite" aria-atomic="true"></div>
            <div class="question-action-zone">
              <p class="question-action-hint">${state.submitted ? "先對照答案與解析，再前往下一題。" : "完成作答後提交；提交後會保留答案與解析。"}</p>
              <div class="btn-row" id="action-row"></div>
            </div>
          </article>

          <div class="quiz-nav-bar">
            <div class="quiz-nav-inner">
              <div class="quiz-nav-group quiz-nav-paging">
                <button class="btn btn-secondary" id="prev-btn" ${onPrev ? "" : "disabled"}>← 上一題</button>
                <button class="btn btn-secondary" id="next-btn" ${onNext ? "" : "disabled"}>下一題 →</button>
              </div>
              <div class="quiz-nav-group quiz-nav-exits">
                ${extraNav || ""}
                <a class="btn btn-ghost" href="${backHref}">${backLabel ? esc(backLabel) : `返回《${esc(bundle.unit.title)}》`}</a>
                <a class="btn btn-ghost" href="#/">首頁</a>
              </div>
            </div>
          </div>
        </section>
      `);'''
q = replace_once(q, old_shell, new_shell, 'question shell')

old_single = '''  function renderSingleChoice(q, state, prefix) {
    return `<div class="option-list" role="radiogroup" aria-label="單選題選項">${(q.options || []).map((o) => `
      <button type="button" role="radio" aria-checked="${state.selected === o.key}" class="option-item ${state.selected === o.key ? "is-selected" : ""}" data-key="${esc(o.key)}" data-role="option-${prefix}" ${state.submitted ? "disabled" : ""}>
        <span class="option-key" aria-hidden="true">${esc(o.key)}</span><span>${esc(o.text)}</span>
      </button>`).join("")}</div>`;
  }'''
new_single = '''  function renderSingleChoice(q, state, prefix) {
    return `<div class="option-list" role="radiogroup" aria-label="單選題選項">${(q.options || []).map((o) => {
      const selected = state.selected === o.key;
      const resultClass = state.submitted
        ? (o.key === q.answer ? "is-correct" : selected ? "is-wrong" : "is-locked")
        : selected ? "is-selected" : "";
      return `
      <button type="button" role="radio" aria-checked="${selected}" class="option-item ${resultClass}" data-key="${esc(o.key)}" data-role="option-${prefix}" ${state.submitted ? "disabled" : ""}>
        <span class="option-key" aria-hidden="true">${esc(o.key)}</span><span class="option-copy">${esc(o.text)}</span>
        ${state.submitted && o.key === q.answer ? `<span class="option-result-mark" aria-hidden="true">✓</span>` : state.submitted && selected ? `<span class="option-result-mark" aria-hidden="true">×</span>` : ""}
      </button>`;
    }).join("")}</div>`;
  }'''
q = replace_once(q, old_single, new_single, 'single choice states')

old_multi = '''  function renderMultiSelect(q, state, prefix) {
    const sel = Array.isArray(state.selected) ? state.selected : [];
    return `<div class="option-list" aria-label="多選題選項">${(q.options || []).map((o) => `
      <button type="button" aria-pressed="${sel.includes(o.key)}" class="option-item ${sel.includes(o.key) ? "is-selected" : ""}" data-key="${esc(o.key)}" data-role="option-${prefix}-multi" ${state.submitted ? "disabled" : ""}>
        <span class="option-key" aria-hidden="true">${sel.includes(o.key) ? "✓" : esc(o.key)}</span><span>${esc(o.text)}</span>
      </button>`).join("")}</div>`;
  }'''
new_multi = '''  function renderMultiSelect(q, state, prefix) {
    const sel = Array.isArray(state.selected) ? state.selected : [];
    const answers = new Set(q.answer || []);
    return `<div class="option-list" aria-label="多選題選項">${(q.options || []).map((o) => {
      const selected = sel.includes(o.key);
      const resultClass = state.submitted
        ? (answers.has(o.key) ? "is-correct" : selected ? "is-wrong" : "is-locked")
        : selected ? "is-selected" : "";
      return `
      <button type="button" aria-pressed="${selected}" class="option-item ${resultClass}" data-key="${esc(o.key)}" data-role="option-${prefix}-multi" ${state.submitted ? "disabled" : ""}>
        <span class="option-key" aria-hidden="true">${selected && !state.submitted ? "✓" : esc(o.key)}</span><span class="option-copy">${esc(o.text)}</span>
        ${state.submitted && answers.has(o.key) ? `<span class="option-result-mark" aria-hidden="true">✓</span>` : state.submitted && selected ? `<span class="option-result-mark" aria-hidden="true">×</span>` : ""}
      </button>`;
    }).join("")}</div>`;
  }'''
q = replace_once(q, old_multi, new_multi, 'multi select states')

old_reveal = '''    let html = `<div class="${panelClass}">`;
    if (isObjective) {
      html += `<div class="reveal-row"><b>${state.isCorrect ? "✓ 答對了" : state.isCorrect === false ? "✗ 答錯了" : "已提交"}</b></div>`;
    } else {
      html += `<div class="reveal-row"><b>已提交，以下為參考答案／評分元素（不設精確自動評分）</b></div>`;
    }

    html += renderCoreReveal(q, main);'''
new_reveal = '''    const revealTitle = isObjective
      ? (state.isCorrect ? "答對了，確認你的判斷" : "這題需要再看一次")
      : "參考答案與自評要點";
    const revealNote = isObjective
      ? (state.isCorrect ? "保留文本證據，再看看解析是否與你的理由一致。" : "先對照正確答案與解析，再決定需要補強哪一部分。")
      : "開放題不作精確自動評分；請按參考答案與評分元素自行核對。";
    let html = `<section class="${panelClass}"><div class="reveal-summary">
      <span class="reveal-status-icon" aria-hidden="true">${isObjective ? (state.isCorrect ? "✓" : "×") : "閱"}</span>
      <div><span class="reveal-summary-kicker">ANSWER REVIEW</span><strong>${revealTitle}</strong><p>${revealNote}</p></div>
    </div><div class="reveal-content">`;

    html += renderCoreReveal(q, main);'''
q = replace_once(q, old_reveal, new_reveal, 'reveal summary')

q = replace_once(
    q,
    '''    if (q.source) html += `<div class="reveal-row" style="margin-top:10px; font-size:12px; color:var(--color-ink-faint);">來源：${esc(q.source)}</div>`;
    html += `</div>`;
    return html;''',
    '''    if (q.source) html += `<div class="reveal-row" style="margin-top:10px; font-size:12px; color:var(--color-ink-faint);">來源：${esc(q.source)}</div>`;
    html += `</div></section>`;
    return html;''',
    'reveal closing'
)

qpath.write_text(q, encoding='utf-8')

quiz_css = r'''

/* ===== Quiz UI 2.0: focused answering workspace ===== */
.quiz-shell {
  width: min(100%, 920px);
  margin: 4px auto 0;
}
.quiz-context-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin: 0 0 14px;
  padding: 0 4px;
}
.quiz-context-copy { display: flex; align-items: baseline; gap: 9px; min-width: 0; }
.quiz-context-title {
  color: var(--color-accent);
  font-size: 12px;
  font-weight: 850;
  letter-spacing: .02em;
}
.quiz-progress-label {
  margin: 0;
  color: var(--color-ink-faint);
  font-family: var(--font-data);
  font-size: 11px;
  font-weight: 700;
}
.quiz-context-back {
  flex: none;
  color: var(--color-ink-soft);
  font-size: 11px;
  font-weight: 750;
}
.quiz-context-back:hover { color: var(--color-accent); }

.question-surface {
  position: relative;
  overflow: hidden;
  padding: clamp(24px, 4vw, 42px);
  border: 1px solid rgba(23,73,64,.11);
  border-radius: 30px;
  background:
    radial-gradient(circle at 96% 0%, rgba(111,171,151,.10), transparent 27%),
    rgba(252,252,250,.91);
  box-shadow: 0 24px 60px rgba(31,48,43,.085), inset 0 1px 0 rgba(255,255,255,.82);
}
.question-surface::before {
  content: "";
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 4px;
  background: linear-gradient(180deg, var(--color-accent), rgba(23,73,64,.18));
  opacity: .72;
}
.question-surface.is-correct::before { background: #31866D; opacity: 1; }
.question-surface.is-incorrect::before { background: var(--color-reader-orange); opacity: 1; }
.question-surface-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 26px;
}
.question-surface .q-meta-row { margin: 0; gap: 7px; }
.question-surface .tag {
  padding: 5px 9px;
  border: 1px solid rgba(23,73,64,.08);
  border-radius: 999px;
  background: rgba(226,239,234,.72);
  color: #2B665B;
  font-size: 10px;
  letter-spacing: 0;
}
.question-surface .tag-score {
  background: rgba(244,229,223,.82);
  color: #9A513E;
}
.question-type-pill,
.quiz-result-badge {
  flex: none;
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 5px 10px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 850;
  letter-spacing: .04em;
}
.question-type-pill { background: rgba(23,73,64,.055); color: var(--color-ink-soft); }
.quiz-result-badge.is-correct { background: #E2F2EB; color: #246B58; }
.quiz-result-badge.is-incorrect { background: #F7E7E2; color: #A55340; }

.question-body { max-width: 780px; }
.question-surface .q-stem {
  margin: 0 0 22px;
  color: var(--color-ink);
  font-family: var(--font-display);
  font-size: clamp(21px, 2.3vw, 28px);
  font-weight: 620;
  line-height: 1.55;
  letter-spacing: -.025em;
}
.question-surface .q-quote {
  margin: 0 0 24px;
  padding: 17px 20px;
  border: 1px solid rgba(23,73,64,.09);
  border-left: 3px solid rgba(23,73,64,.46);
  border-radius: 0 16px 16px 0;
  background: rgba(226,239,234,.42);
  color: #344440;
  font-size: 16px;
  line-height: 1.95;
}
.question-surface .option-list { gap: 10px; }
.question-surface .option-item {
  position: relative;
  min-height: 58px;
  padding: 13px 48px 13px 14px;
  border: 1px solid rgba(23,73,64,.12);
  border-radius: 17px;
  background: rgba(255,255,255,.66);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.75);
  color: var(--color-ink);
  line-height: 1.55;
  transition: transform .15s ease, border-color .15s ease, background .15s ease, box-shadow .15s ease;
}
.question-surface .option-item:hover:not(:disabled) {
  transform: translateY(-2px);
  border-color: rgba(23,73,64,.30);
  background: rgba(255,255,255,.96);
  box-shadow: 0 10px 24px rgba(31,48,43,.07);
}
.question-surface .option-key {
  width: 31px;
  height: 31px;
  border: 1px solid rgba(23,73,64,.17);
  background: rgba(244,243,239,.72);
  color: #53625E;
  font-size: 11px;
  font-weight: 850;
}
.question-surface .option-copy { flex: 1; min-width: 0; }
.question-surface .option-item.is-selected {
  border-color: rgba(23,73,64,.55);
  background: #E9F2EE;
  box-shadow: 0 8px 20px rgba(23,73,64,.055);
}
.question-surface .option-item.is-selected .option-key {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: #fff;
}
.question-surface .option-item.is-correct {
  border-color: rgba(49,134,109,.48);
  background: #E8F4EF;
}
.question-surface .option-item.is-correct .option-key {
  background: #31866D;
  border-color: #31866D;
  color: #fff;
}
.question-surface .option-item.is-wrong {
  border-color: rgba(183,95,71,.48);
  background: #F8E9E4;
}
.question-surface .option-item.is-wrong .option-key {
  background: #B75F47;
  border-color: #B75F47;
  color: #fff;
}
.question-surface .option-item.is-locked:not(.is-correct):not(.is-wrong) { opacity: .58; }
.option-result-mark {
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  display: grid;
  place-items: center;
  width: 25px;
  height: 25px;
  border-radius: 50%;
  background: rgba(255,255,255,.72);
  font-size: 14px;
  font-weight: 900;
}
.question-surface .option-item.is-correct .option-result-mark { color: #27705D; }
.question-surface .option-item.is-wrong .option-result-mark { color: #A65340; }

.question-surface textarea.answer-input,
.question-surface input.answer-input,
.question-surface select.answer-input {
  border-color: rgba(23,73,64,.14);
  border-radius: 16px;
  background: rgba(255,255,255,.72);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.72);
}
.question-surface textarea.answer-input { min-height: 150px; padding: 16px; line-height: 1.72; }
.question-surface textarea.answer-input:focus,
.question-surface input.answer-input:focus,
.question-surface select.answer-input:focus {
  outline: 3px solid rgba(23,73,64,.15);
  outline-offset: 1px;
  border-color: rgba(23,73,64,.45);
}

.question-action-zone {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-top: 26px;
  padding-top: 19px;
  border-top: 1px solid rgba(23,73,64,.09);
}
.question-action-hint {
  max-width: 430px;
  margin: 0;
  color: var(--color-ink-faint);
  font-size: 11px;
  line-height: 1.55;
}
.question-action-zone .btn-row { margin: 0; flex: none; }
.question-action-zone .btn-primary { min-width: 158px; }

/* Answer review becomes a second surface, not a tinted paragraph box. */
.question-surface .reveal-panel {
  margin: 30px 0 0;
  padding: 0;
  overflow: hidden;
  border: 1px solid rgba(49,134,109,.20);
  border-radius: 22px;
  background: rgba(246,251,248,.86);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.75);
}
.question-surface .reveal-panel.is-incorrect {
  border-color: rgba(183,95,71,.21);
  background: rgba(252,247,245,.90);
}
.reveal-summary {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 20px 21px;
  border-bottom: 1px solid rgba(23,73,64,.08);
  background: rgba(49,134,109,.055);
}
.reveal-panel.is-incorrect .reveal-summary { background: rgba(183,95,71,.055); }
.reveal-status-icon {
  flex: none;
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 13px;
  background: #31866D;
  color: #fff;
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 800;
}
.reveal-panel.is-incorrect .reveal-status-icon { background: #B75F47; }
.reveal-summary > div { min-width: 0; }
.reveal-summary-kicker {
  display: block;
  margin-bottom: 3px;
  color: var(--color-ink-faint);
  font-family: var(--font-data);
  font-size: 8px;
  font-weight: 850;
  letter-spacing: .14em;
}
.reveal-summary strong {
  display: block;
  color: var(--color-ink);
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 680;
}
.reveal-summary p { margin: 4px 0 0; color: var(--color-ink-soft); font-size: 12px; line-height: 1.65; }
.reveal-content { padding: 20px 21px 21px; }
.reveal-content .reveal-row {
  margin: 0;
  padding: 13px 0;
  border-bottom: 1px solid rgba(23,73,64,.07);
  font-size: 13px;
  line-height: 1.7;
}
.reveal-content .reveal-row:first-child { padding-top: 0; }
.reveal-content .reveal-row:last-child { border-bottom: 0; padding-bottom: 0; }
.reveal-content .reveal-label {
  margin-bottom: 5px;
  color: var(--color-reader-orange);
  font-size: 9px;
  font-weight: 850;
  letter-spacing: .08em;
}
.reveal-content .reveal-explanation { color: #394844; font-size: 13px; line-height: 1.85; }
.reveal-content .scoring-elements { font-size: 13px; line-height: 1.85; }

.quiz-nav-bar {
  margin: 16px -10px 0;
  padding: 10px;
  border: 0;
  border-radius: 17px 17px 0 0;
  background: rgba(248,248,245,.82);
  box-shadow: 0 -8px 28px rgba(31,48,43,.045);
  backdrop-filter: blur(18px) saturate(135%);
  -webkit-backdrop-filter: blur(18px) saturate(135%);
}
.quiz-nav-inner { max-width: 920px; }
.quiz-nav-bar .btn { min-height: 38px; padding: 8px 13px; border-radius: 11px; font-size: 11px; }
.quiz-nav-bar .btn-secondary { border-color: rgba(23,34,31,.17); background: rgba(255,255,255,.62); }
.quiz-nav-bar .btn:disabled { opacity: .38; cursor: default; }

@media (max-width: 640px) {
  .quiz-shell { margin-top: 0; }
  .quiz-context-bar { align-items: flex-start; gap: 10px; margin-bottom: 10px; }
  .quiz-context-copy { display: grid; gap: 2px; }
  .quiz-context-back { padding-top: 1px; }
  .question-surface { padding: 22px 18px 18px; border-radius: 24px; }
  .question-surface-head { margin-bottom: 20px; }
  .question-surface .q-meta-row { gap: 5px; }
  .question-surface .tag { padding: 4px 7px; font-size: 9px; }
  .question-surface .q-stem { font-size: 22px; line-height: 1.58; }
  .question-surface .option-item { min-height: 56px; padding: 12px 43px 12px 12px; border-radius: 15px; font-size: 14px; }
  .question-action-zone {
    position: sticky;
    z-index: 35;
    bottom: 8px;
    display: block;
    margin: 25px -10px -8px;
    padding: 10px;
    border: 1px solid rgba(23,73,64,.10);
    border-radius: 17px;
    background: rgba(250,250,247,.92);
    box-shadow: 0 14px 40px rgba(31,48,43,.14);
    backdrop-filter: blur(18px) saturate(135%);
    -webkit-backdrop-filter: blur(18px) saturate(135%);
  }
  .question-action-hint { display: none; }
  .question-action-zone .btn-row,
  .question-action-zone .btn-primary { width: 100%; }
  .question-action-zone .btn-primary { min-height: 47px; }
  .question-surface .reveal-panel { margin-top: 24px; border-radius: 18px; }
  .reveal-summary { padding: 17px; }
  .reveal-content { padding: 17px; }
  .quiz-nav-bar { position: static; margin: 12px 0 0; padding: 8px 0 0; background: transparent; box-shadow: none; backdrop-filter: none; }
  .quiz-nav-inner { display: grid; gap: 7px; }
  .quiz-nav-paging { display: grid; grid-template-columns: 1fr 1fr; width: 100%; }
  .quiz-nav-paging .btn { width: 100%; }
  .quiz-nav-exits { justify-content: center; }
}

@media (prefers-reduced-motion: reduce) {
  .question-surface .option-item,
  .quiz-context-back { transition: none !important; }
}
'''

if '/* ===== Quiz UI 2.0: focused answering workspace ===== */' in css:
    raise SystemExit('quiz ui block already present')
csspath.write_text(css.rstrip() + quiz_css + '\n', encoding='utf-8')
print('Quiz UI 2.0 patch applied.')
