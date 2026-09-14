/* ============================================================
   question-engine.js — 統一題目渲染與作答互動邏輯
   規則：
   - 作答後不自動跳題，須顯示所選答案／正確答案／解析
   - 按「我已看完答案，下一題」才前進
   - 可不作答先看下一題；可返回已作答題目查看
   - 開放題不設字數下限，不做精確自動評分
   - 複合題（items / part2）使用結構化 selection，避免不同輸入互相覆蓋
   - 核心篇章挑戰使用獨立 attempt，不讀取舊的永久作答作為本次答案
   ============================================================ */

const QuestionEngine = (() => {
  const esc = App.escapeHTML;
  const OBJECTIVE_TYPES = ["single_choice", "multi_select", "true_false_unknown", "matching", "extract_sentence", "cloze_choice"];
  const difficultyLabel = { basic: "基礎", intermediate: "進階", advanced: "挑戰" };

  // ---------- 補強診斷 ----------
  // 沒有人工標註 error_tags/remediation 時，只根據題目已知的能力分類、
  // knowledge point 與段落位置提供補強方向，不推斷學生的心理／認知錯因。
  function diagnosticTags(q, aggregate = false) {
    if (Array.isArray(q.error_tags) && q.error_tags.length) return q.error_tags;
    const ability = q.ability || "其他";
    if (aggregate || !q.knowledge_point || q.knowledge_point === ability) return [ability];
    return [ability, q.knowledge_point];
  }

  function paragraphHint(q) {
    if (Array.isArray(q.paragraph_ref) && q.paragraph_ref.length) {
      return "重讀第" + q.paragraph_ref.join("、") + "段，";
    }
    if (q.paragraph_ref !== null && q.paragraph_ref !== undefined && q.paragraph_ref !== "") {
      return "重讀第" + q.paragraph_ref + "段，";
    }
    return "重讀題目相關原文，";
  }

  function defaultRemediation(q) {
    if (q.remediation) return q.remediation;
    const ability = q.ability || "";
    if (ability.includes("字詞")) {
      return "先回到「字詞與句式」，確認題目中的詞義、虛詞用法及語境，再重做同類題。";
    }
    if (ability.includes("內容理解")) {
      return "先回到「疏通文意」，" + paragraphHint(q) + "用自己的話概括內容，再回來作答。";
    }
    if (ability.includes("結構") || ability.includes("手法") || ability.includes("鑒賞")) {
      return "先回到「結構與鑒賞」，找出文本證據，再按「手法／結構 → 內容 → 作用」三步重答。";
    }
    if (ability.includes("主旨") || ability.includes("思考")) {
      return "先回到「主旨與思考」，用一句話寫出篇章中心思想，再把題目引文與主旨連結。";
    }
    if (ability.includes("跨篇")) {
      return "先分別列出兩篇的核心觀點／手法和文本證據，再比較相同與不同之處。";
    }
    if (ability.includes("情境")) {
      return "先抽取原文可遷移的原則，再逐項對照情境條件，避免只憑直覺作答。";
    }
    return "重讀解析與題目相關內容，先指出自己需要補強的知識點，再重做同類題。";
  }

  // ---------- selection helpers ----------
  function isCompositeQuestion(q) {
    return !!((q.items && q.items.length) || q.part2);
  }

  function coreInitialSelection(q) {
    switch (q.question_type) {
      case "multi_select": return [];
      case "matching": return {};
      case "true_false_unknown": return q.statements ? {} : null;
      case "cloze_choice": return {};
      case "fill_table": return {};
      case "short_answer":
      case "long_answer":
      case "extract_sentence": return "";
      default: return null;
    }
  }

  function partInitialSelection(part) {
    if (!part) return null;
    const type = part.question_type || part.type || "long_answer";
    switch (type) {
      case "multi_select": return [];
      case "matching": return {};
      case "true_false_unknown": return part.statements ? {} : null;
      case "cloze_choice": return {};
      case "fill_table": return {};
      case "short_answer":
      case "long_answer":
      case "extract_sentence": return "";
      default: return "";
    }
  }

  function initSelection(q) {
    const main = coreInitialSelection(q);
    if (!isCompositeQuestion(q)) return main;
    return {
      main,
      items: {},
      part2: q.part2 ? partInitialSelection(q.part2) : null
    };
  }

  function normalizeSelection(q, raw) {
    if (!isCompositeQuestion(q)) {
      return raw === undefined ? coreInitialSelection(q) : raw;
    }

    const fallback = initSelection(q);
    if (raw == null) return fallback;

    if (typeof raw === "object" && !Array.isArray(raw) && ("main" in raw || "items" in raw || "part2" in raw)) {
      return {
        main: raw.main === undefined ? fallback.main : raw.main,
        items: raw.items && typeof raw.items === "object" ? raw.items : {},
        part2: raw.part2 === undefined ? fallback.part2 : raw.part2
      };
    }

    // 相容舊版：items 曾直接寫成 item_0 / item_1；part2 曾直接寫在 selected.part2。
    if (typeof raw === "object" && !Array.isArray(raw)) {
      const items = {};
      (q.items || []).forEach((_, i) => {
        if (raw[`item_${i}`] !== undefined) items[i] = raw[`item_${i}`];
      });
      return {
        main: fallback.main,
        items,
        part2: raw.part2 === undefined ? fallback.part2 : raw.part2
      };
    }

    // 相容舊版：只有主題答案時，保留在 main。
    return { ...fallback, main: raw };
  }

  function mainSelection(q, state) {
    return isCompositeQuestion(q) ? state.selected.main : state.selected;
  }

  function setMainSelection(q, state, value) {
    if (isCompositeQuestion(q)) state.selected.main = value;
    else state.selected = value;
  }

  function itemSelection(q, state, index) {
    if (!isCompositeQuestion(q)) return "";
    return (state.selected.items || {})[index] || "";
  }

  function setItemSelection(q, state, index, value) {
    if (!isCompositeQuestion(q)) return;
    state.selected.items = state.selected.items || {};
    state.selected.items[index] = value;
  }

  function part2Selection(q, state) {
    return isCompositeQuestion(q) ? state.selected.part2 : null;
  }

  function setPart2Selection(q, state, value) {
    if (!isCompositeQuestion(q)) return;
    state.selected.part2 = value;
  }

  // ---------- 對外入口：一般題庫序列 ----------
  function renderQuizSequence({ bundle, unitId, questions, title, basePath, startIndex }) {
    let idx = Math.min(Math.max(startIndex || 0, 0), questions.length - 1);

    function renderAt(i) {
      idx = i;
      const q = questions[idx];
      renderQuestionShell({
        unitId, bundle, question: q, title,
        indexLabel: `第 ${idx + 1} 題，共 ${questions.length} 題`,
        onPrev: idx > 0 ? () => renderAt(idx - 1) : null,
        onNext: idx < questions.length - 1 ? () => renderAt(idx + 1) : null,
        backHref: `${basePath}`,
        onAfterConfirm: () => {
          if (idx < questions.length - 1) renderAt(idx + 1);
        }
      });
    }
    renderAt(idx);
  }

  // ---------- 核心篇章挑戰 attempt ----------
  function challengeKey(unitId) {
    return `ccsl_challenge_${unitId}`;
  }

  function newChallengeAttempt(unitId, questions) {
    const attempt = {
      version: 2,
      startedAt: Date.now(),
      ids: questions.map((q) => q.id),
      answers: {}
    };
    sessionStorage.setItem(challengeKey(unitId), JSON.stringify(attempt));
    return attempt;
  }

  function getChallengeAttempt(unitId) {
    const raw = sessionStorage.getItem(challengeKey(unitId));
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // 相容舊 session 格式，但不沿用永久 Progress 作為本次答案。
        return { version: 2, startedAt: Date.now(), ids: parsed, answers: {} };
      }
      if (!parsed || !Array.isArray(parsed.ids)) return null;
      if (!parsed.answers || typeof parsed.answers !== "object") parsed.answers = {};
      return parsed;
    } catch (e) {
      console.error("QuestionEngine: 無法讀取挑戰紀錄", e);
      return null;
    }
  }

  function saveChallengeAttempt(unitId, attempt) {
    sessionStorage.setItem(challengeKey(unitId), JSON.stringify(attempt));
  }

  function getChallengeQuestions(bundle, unitId) {
    const attempt = getChallengeAttempt(unitId);
    if (!attempt) return null;
    const byId = {};
    bundle.allQuestions.forEach((q) => (byId[q.id] = q));
    return attempt.ids.map((id) => byId[id]).filter(Boolean);
  }

  function renderChallengeSetup(bundle, unitId) {
    const { unit, allQuestions } = bundle;
    const abilities = [...new Set(allQuestions.map((q) => q.ability))];
    const abilityCheckboxes = abilities
      .map((a) => `
        <label class="option-item" style="cursor:pointer;">
          <input type="checkbox" class="challenge-ability" value="${esc(a)}" checked style="width:18px; height:18px;" />
          ${esc(a)}
        </label>`)
      .join("");

    App.mount(`
      <h1 class="page-title">核心篇章挑戰</h1>
      <p class="page-subtitle">整合各分類題目，隨機抽題，並提供需補強範疇與補救建議</p>
      <div class="card">
        <div class="section-title"><span class="seal">範</span>選擇範圍</div>
        <div class="option-list">${abilityCheckboxes}</div>
      </div>
      <div class="card">
        <div class="section-title"><span class="seal">量</span>題數</div>
        <input type="number" id="challenge-count" class="answer-input" value="10" min="1" max="${allQuestions.length}" style="max-width:120px;" />
        <p style="font-size:12px; color:var(--color-ink-soft); margin-top:6px;">目前範圍最多可抽 <span id="max-count-hint">${allQuestions.length}</span> 題</p>
      </div>
      <button class="btn btn-primary btn-block" id="start-challenge-btn">開始挑戰 →</button>
      ${App.footerNav(unitId, unit.title)}
    `);

    function updateMaxHint() {
      const selected = [...document.querySelectorAll(".challenge-ability:checked")].map((c) => c.value);
      const pool = allQuestions.filter((q) => selected.includes(q.ability));
      document.getElementById("max-count-hint").textContent = pool.length;
      const countInput = document.getElementById("challenge-count");
      countInput.max = pool.length || 1;
    }
    document.querySelectorAll(".challenge-ability").forEach((c) => c.addEventListener("change", updateMaxHint));

    document.getElementById("start-challenge-btn").addEventListener("click", () => {
      const selected = [...document.querySelectorAll(".challenge-ability:checked")].map((c) => c.value);
      const pool = allQuestions.filter((q) => selected.includes(q.ability));
      if (!pool.length) {
        alertInline("請至少選擇一個範圍。");
        return;
      }
      const count = Math.min(parseInt(document.getElementById("challenge-count").value, 10) || 10, pool.length);
      const shuffled = shuffle([...pool]).slice(0, count);
      newChallengeAttempt(unitId, shuffled);
      Router.navigate(`/unit/${unitId}/challenge/run`);
    });
  }

  function alertInline(msg) {
    let el = document.getElementById("inline-alert");
    if (!el) {
      el = document.createElement("div");
      el.id = "inline-alert";
      el.className = "error-banner";
      el.style.marginBottom = "16px";
      document.getElementById("app-main").prepend(el);
    }
    el.textContent = msg;
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function renderChallengeRun(bundle, unitId) {
    const questions = getChallengeQuestions(bundle, unitId);
    const attempt = getChallengeAttempt(unitId);
    if (!questions || !questions.length || !attempt) {
      App.mount(`
        <div class="empty-state">
          <p>尚未設定挑戰範圍，請先返回設定頁面。</p>
          <a class="btn btn-primary" href="#/unit/${unitId}/challenge">前往設定 →</a>
        </div>
        ${App.footerNav(unitId, bundle.unit.title)}
      `);
      return;
    }

    let idx = 0;
    function renderAt(i) {
      idx = i;
      const q = questions[idx];
      renderQuestionShell({
        unitId, bundle, question: q, title: "核心篇章挑戰",
        indexLabel: `第 ${idx + 1} 題，共 ${questions.length} 題`,
        onPrev: idx > 0 ? () => renderAt(idx - 1) : null,
        onNext: idx < questions.length - 1 ? () => renderAt(idx + 1) : null,
        backHref: `#/unit/${unitId}`,
        showRemediation: true,
        loadRecord: (questionId) => (getChallengeAttempt(unitId)?.answers || {})[questionId] || null,
        saveRecord: (questionId, record) => {
          const latest = getChallengeAttempt(unitId);
          if (latest) {
            latest.answers[questionId] = { ...record, timestamp: Date.now() };
            saveChallengeAttempt(unitId, latest);
          }
          // 同時更新長期掌握，但不再用長期掌握作為本次 challenge 的答案來源。
          Progress.recordAnswer(unitId, questionId, record);
        },
        onAfterConfirm: () => {
          if (idx < questions.length - 1) renderAt(idx + 1);
          else Router.navigate(`/unit/${unitId}/challenge/result`);
        },
        extraNav: idx === questions.length - 1
          ? `<button class="btn btn-primary" id="finish-challenge-btn">完成挑戰，查看結果 →</button>`
          : ""
      });
      const finishBtn = document.getElementById("finish-challenge-btn");
      if (finishBtn) finishBtn.addEventListener("click", () => Router.navigate(`/unit/${unitId}/challenge/result`));
    }
    renderAt(idx);
  }

  function renderChallengeResult(bundle, unitId) {
    const questions = getChallengeQuestions(bundle, unitId);
    const attempt = getChallengeAttempt(unitId);
    if (!questions || !questions.length || !attempt) {
      App.mount(`
        <div class="empty-state">
          <p>找不到挑戰紀錄，請重新開始一次挑戰。</p>
          <a class="btn btn-primary" href="#/unit/${unitId}/challenge">前往設定 →</a>
        </div>
        ${App.footerNav(unitId, bundle.unit.title)}
      `);
      return;
    }

    const answers = attempt.answers || {};
    let answeredCount = 0, answeredObjectiveCount = 0, correctCount = 0, objectiveCount = 0;
    const errorTagCounts = {};
    questions.forEach((q) => {
      const rec = answers[q.id];
      const isObjective = OBJECTIVE_TYPES.includes(q.question_type);
      if (isObjective) objectiveCount += 1;
      if (rec && rec.answered) {
        answeredCount += 1;
        if (isObjective) {
          answeredObjectiveCount += 1;
          if (rec.isCorrect) correctCount += 1;
          if (rec.isCorrect === false) {
            diagnosticTags(q, true).forEach((tag) => (errorTagCounts[tag] = (errorTagCounts[tag] || 0) + 1));
          }
        }
      }
    });
    const rate = answeredObjectiveCount ? Math.round((correctCount / answeredObjectiveCount) * 100) : null;

    const tagList = Object.keys(errorTagCounts).length
      ? `<ul class="scoring-elements">${Object.entries(errorTagCounts).map(([tag, n]) => `<li>${esc(tag)}（${n} 次）</li>`).join("")}</ul>`
      : `<p style="color:var(--color-ink-soft); font-size:14px;">本次已作答的客觀題沒有需要補強的範疇。</p>`;

    App.mount(`
      <h1 class="page-title">挑戰結果</h1>
      <div class="card">
        <div class="stat-grid">
          <div class="stat-card"><div class="stat-value">${questions.length}</div><div class="stat-label">挑戰題數</div></div>
          <div class="stat-card"><div class="stat-value">${answeredCount}</div><div class="stat-label">已作答</div></div>
          <div class="stat-card"><div class="stat-value">${rate == null ? "—" : rate + "%"}</div><div class="stat-label">客觀題正確率</div></div>
        </div>
        ${objectiveCount && answeredObjectiveCount < objectiveCount ? `<p style="font-size:12px; color:var(--color-ink-soft); margin:10px 0 0;">已作答客觀題 ${answeredObjectiveCount}/${objectiveCount}</p>` : ""}
      </div>
      <div class="card">
        <div class="section-title"><span class="seal">補</span>需補強範疇與補救建議</div>
        <p style="font-size:12px; color:var(--color-ink-soft); margin:0 0 10px;">以下按錯題所屬能力分類統計，不推斷你的心理或認知錯因。</p>
        ${tagList}
      </div>
      <div class="btn-row">
        <a class="btn btn-secondary" href="#/unit/${unitId}/progress">查看我的掌握 →</a>
        <a class="btn btn-primary" href="#/unit/${unitId}/challenge">再次挑戰</a>
      </div>
      ${App.footerNav(unitId, bundle.unit.title)}
    `);
  }

  // ---------- 通用題目外殼 ----------
  function renderQuestionShell({ unitId, bundle, question, title, indexLabel, onPrev, onNext, backHref, onAfterConfirm, showRemediation, extraNav, loadRecord, saveRecord }) {
    const recordLoader = loadRecord || ((questionId) => Progress.getAnswer(unitId, questionId));
    const recordWriter = saveRecord || ((questionId, record) => Progress.recordAnswer(unitId, questionId, record));
    const savedRecord = recordLoader(question.id);
    const state = {
      submitted: !!(savedRecord && savedRecord.answered),
      selected: normalizeSelection(question, savedRecord ? savedRecord.selected : undefined),
      isCorrect: savedRecord ? savedRecord.isCorrect : null,
      part2IsCorrect: savedRecord ? savedRecord.part2IsCorrect : null
    };

    function paint() {
      App.mount(`
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
          <div id="reveal-slot"></div>
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
              <a class="btn btn-ghost" href="${backHref}">返回《${esc(bundle.unit.title)}》</a>
              <a class="btn btn-ghost" href="#/">返回首頁</a>
            </div>
          </div>
        </div>
      `);

      bindBodyEvents(question, state, paint);

      const actionRow = document.getElementById("action-row");
      const revealSlot = document.getElementById("reveal-slot");

      if (state.submitted) {
        revealSlot.innerHTML = renderReveal(question, state, showRemediation);
        actionRow.innerHTML = `<button class="btn btn-primary" id="confirm-next-btn">我已看完答案，下一題</button>`;
        document.getElementById("confirm-next-btn").addEventListener("click", () => {
          if (onAfterConfirm) onAfterConfirm();
        });
      } else {
        actionRow.innerHTML = `<button class="btn btn-primary" id="submit-btn">提交答案</button>`;
        document.getElementById("submit-btn").addEventListener("click", () => {
          const result = gradeQuestion(question, state.selected);
          state.submitted = true;
          state.isCorrect = result.isCorrect;
          state.part2IsCorrect = result.part2IsCorrect;
          recordWriter(question.id, {
            answered: true,
            selected: state.selected,
            isCorrect: result.isCorrect,
            part2IsCorrect: result.part2IsCorrect
          });
          paint();
        });
      }

      if (onPrev) document.getElementById("prev-btn").addEventListener("click", onPrev);
      if (onNext) document.getElementById("next-btn").addEventListener("click", onNext);
    }

    paint();
  }

  // ---------- 各題型：作答內容渲染 ----------
  function renderQuestionBody(q, state) {
    let html = `<p class="q-stem">${esc(q.stem)}</p>`;
    if (q.quote) html += `<div class="q-quote">${esc(q.quote)}</div>`;
    if (q.context_quotes) {
      html += q.context_quotes.map((c) => `<div class="q-quote"><strong>${esc(c.label)}：</strong>${esc(c.text)}</div>`).join("");
    }

    const coreState = { ...state, selected: mainSelection(q, state) };
    html += renderByType(q, coreState, "main");

    if (q.items && q.items.length) {
      html += `<div style="margin-top:12px;">` + q.items.map((it, i) => `
        <div class="card card-tight" style="margin-bottom:8px;">
          <p style="margin:0 0 6px; font-size:14px;">${esc(it.text || `第 ${i + 1} 項`)}${it.target ? `　→　<strong>${esc(it.target)}</strong>` : ""}</p>
          <input type="text" class="answer-input" id="item-input-${i}" value="${esc(itemSelection(q, state, i))}" placeholder="請輸入答案…" />
        </div>`).join("") + `</div>`;
    }

    if (q.part2) {
      html += `
        <div class="card card-tight" style="margin-top:16px; background:#FBFAF7;">
          <p class="q-stem" style="font-size:15px;">${esc(q.part2.stem)}</p>
          ${q.part2.score ? `<p style="font-size:12px; color:var(--color-ink-soft); margin:-6px 0 10px;">${esc(q.part2.score)} 分</p>` : ""}
          ${renderPart2Input(q, state)}
        </div>`;
    }

    return html;
  }

  function renderByType(q, state, prefix) {
    switch (q.question_type) {
      case "single_choice": return renderSingleChoice(q, state, prefix);
      case "multi_select": return `<p style="font-size:12px; color:var(--color-ink-soft); margin:-8px 0 10px;">（答案可選多於一個）</p>${renderMultiSelect(q, state, prefix)}`;
      case "true_false_unknown": return renderTrueFalse(q, state, prefix);
      case "extract_sentence": return `<textarea class="answer-input" id="input-extract" placeholder="請摘錄原文句子…">${esc(state.selected || "")}</textarea>`;
      case "short_answer":
        return q.items && q.items.length ? "" : `<textarea class="answer-input" id="input-short" placeholder="請輸入答案（不設字數下限）…">${esc(state.selected || "")}</textarea>`;
      case "long_answer":
        return q.items && q.items.length ? "" : `<textarea class="answer-input" id="input-long" placeholder="請輸入你的答案（不設字數下限，將以評分元素自評）…">${esc(state.selected || "")}</textarea>`;
      case "fill_table": return renderFillTable(q, state, prefix);
      case "matching": return renderMatching(q, state, prefix);
      case "cloze_choice": return renderClozeChoice(q, state, prefix);
      default: return `<p class="error-banner">未支援的題型：${esc(q.question_type)}</p>`;
    }
  }

  function renderSingleChoice(q, state, prefix) {
    return `<div class="option-list">${(q.options || []).map((o) => `
      <div class="option-item ${state.selected === o.key ? "is-selected" : ""}" data-key="${esc(o.key)}" data-role="option-${prefix}">
        <span class="option-key">${esc(o.key)}</span><span>${esc(o.text)}</span>
      </div>`).join("")}</div>`;
  }

  function renderMultiSelect(q, state, prefix) {
    const sel = Array.isArray(state.selected) ? state.selected : [];
    return `<div class="option-list">${(q.options || []).map((o) => `
      <div class="option-item ${sel.includes(o.key) ? "is-selected" : ""}" data-key="${esc(o.key)}" data-role="option-${prefix}-multi">
        <span class="option-key">${sel.includes(o.key) ? "✓" : esc(o.key)}</span><span>${esc(o.text)}</span>
      </div>`).join("")}</div>`;
  }

  function renderTrueFalse(q, state, prefix) {
    if (q.statements) {
      return q.statements.map((s, i) => {
        const cur = state.selected ? state.selected[i] : null;
        return `
          <div class="card card-tight" style="margin-bottom:10px;">
            <p style="margin:0 0 8px; font-size:14px;">${i + 1}. ${esc(s.text)}</p>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              ${["true", "false", "unknown"].map((v) => `
                <button class="btn btn-secondary tf-btn ${cur === v ? "is-selected" : ""}" data-prefix="${prefix}" data-stmt="${i}" data-val="${v}" style="${cur === v ? "border-color:var(--color-accent); background:var(--color-accent-soft);" : ""}">
                  ${tfLabel(v)}
                </button>`).join("")}
            </div>
          </div>`;
      }).join("");
    }
    const cur = state.selected;
    return `<div style="display:flex; gap:8px; flex-wrap:wrap;">
      ${["true", "false", "unknown"].map((v) => `
        <button class="btn btn-secondary tf-btn-single ${cur === v ? "is-selected" : ""}" data-prefix="${prefix}" data-val="${v}" style="${cur === v ? "border-color:var(--color-accent); background:var(--color-accent-soft);" : ""}">
          ${tfLabel(v)}
        </button>`).join("")}
    </div>`;
  }

  function tfLabel(value) {
    if (value === "true") return "正確";
    if (value === "false") return "錯誤";
    if (value === "unknown") return "無從判斷";
    return "";
  }

  function renderFillTable(q, state, prefix) {
    const cols = (q.table && q.table.columns) || [];
    const rows = (q.table && q.table.rows) || [];
    let html = `<table class="fill-table"><thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>`;
    rows.forEach((row, ri) => {
      html += "<tr>";
      row.cells.forEach((val, ci) => {
        if (val === null || val === undefined) {
          const key = `r${ri}c${ci}`;
          const savedVal = state.selected && state.selected[key] ? state.selected[key] : "";
          html += `<td class="blank-cell"><textarea data-fillkey="${key}" data-prefix="${prefix}" placeholder="請填寫…">${esc(savedVal)}</textarea></td>`;
        } else {
          html += `<td>${esc(val)}</td>`;
        }
      });
      html += "</tr>";
    });
    html += "</tbody></table>";
    return html;
  }

  function renderMatching(q, state, prefix) {
    if (q.option_labels) {
      return (q.rows || []).map((row, ri) => {
        const sel = (state.selected && state.selected[ri]) || [];
        return `
          <div class="card card-tight" style="margin-bottom:10px;">
            <p style="margin:0 0 8px; font-size:14px; font-family:var(--font-display);">${esc(row.text)}</p>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              ${q.option_labels.map((label) => `
                <button class="btn btn-secondary match-multi-btn ${sel.includes(label) ? "is-selected" : ""}" data-prefix="${prefix}" data-row="${ri}" data-label="${esc(label)}" style="${sel.includes(label) ? "border-color:var(--color-accent); background:var(--color-accent-soft);" : ""}">${esc(label)}</button>`).join("")}
            </div>
          </div>`;
      }).join("");
    }
    return (q.rows || []).map((row, ri) => {
      const cur = (state.selected && state.selected[ri]) || "";
      return `
        <div class="card card-tight" style="margin-bottom:10px; display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
          <p style="margin:0; font-size:14px; flex:1;">${esc(row.text)}</p>
          <select data-match-row="${ri}" data-prefix="${prefix}" class="answer-input" style="max-width:160px;">
            <option value="">請選擇</option>
            ${(q.options || []).map((o) => `<option value="${esc(o.key)}" ${cur === o.key ? "selected" : ""}>${esc(o.key)}. ${esc(o.text)}</option>`).join("")}
          </select>
        </div>`;
    }).join("");
  }

  function renderClozeChoice(q, state, prefix) {
    let html = `<p style="font-size:14px; color:var(--color-ink-soft); margin-bottom:12px;">${esc(q.cloze_template || "")}</p>`;
    (q.blanks || []).forEach((b) => {
      const cur = (state.selected && state.selected[b.id]) || "";
      html += `
        <div class="card card-tight" style="margin-bottom:10px;">
          <p style="margin:0 0 8px; font-size:13px; font-weight:700;">${esc(b.id)}</p>
          <div class="option-list">
            ${(b.options || []).map((o) => `
              <div class="option-item ${cur === o.key ? "is-selected" : ""}" data-prefix="${prefix}" data-blank="${esc(b.id)}" data-key="${esc(o.key)}" data-role="cloze-option">
                <span class="option-key">${esc(o.key)}</span><span>${esc(o.text)}</span>
              </div>`).join("")}
          </div>
        </div>`;
    });
    if (q.open_prompt || q.open_answer_elements || q.follow_up_open_answer) {
      html += `<textarea class="answer-input" data-cloze-open="${prefix}" placeholder="請完成開放部分的說明…">${esc((state.selected && state.selected.openText) || "")}</textarea>`;
    }
    return html;
  }

  function renderPart2Input(q, state) {
    const part = q.part2;
    const type = part.question_type || part.type || "long_answer";
    const sel = part2Selection(q, state);
    const pseudo = { ...part, question_type: type };
    const pseudoState = { ...state, selected: sel };
    if (["single_choice", "multi_select", "true_false_unknown", "matching", "cloze_choice", "fill_table"].includes(type)) {
      return renderByType(pseudo, pseudoState, "part2");
    }
    if (type === "extract_sentence") {
      return `<textarea class="answer-input" id="input-part2" placeholder="請摘錄原文句子…">${esc(sel || "")}</textarea>`;
    }
    return `<textarea class="answer-input" id="input-part2" placeholder="請輸入答案…">${esc(sel || "")}</textarea>`;
  }

  // ---------- 事件綁定 ----------
  function selectionForPrefix(q, state, prefix) {
    return prefix === "part2" ? part2Selection(q, state) : mainSelection(q, state);
  }

  function setSelectionForPrefix(q, state, prefix, value) {
    if (prefix === "part2") setPart2Selection(q, state, value);
    else setMainSelection(q, state, value);
  }

  function bindBodyEvents(q, state, repaint) {
    document.querySelectorAll('[data-role="option-main"]').forEach((el) => {
      el.addEventListener("click", () => {
        if (state.submitted) return;
        setMainSelection(q, state, el.dataset.key);
        repaint();
      });
    });
    document.querySelectorAll('[data-role="option-part2"]').forEach((el) => {
      el.addEventListener("click", () => {
        if (state.submitted) return;
        setPart2Selection(q, state, el.dataset.key);
        repaint();
      });
    });
    document.querySelectorAll('[data-role="option-main-multi"], [data-role="option-part2-multi"]').forEach((el) => {
      el.addEventListener("click", () => {
        if (state.submitted) return;
        const prefix = el.dataset.role.includes("part2") ? "part2" : "main";
        const current = selectionForPrefix(q, state, prefix);
        const arr = Array.isArray(current) ? current : [];
        const key = el.dataset.key;
        setSelectionForPrefix(q, state, prefix, arr.includes(key) ? arr.filter((k) => k !== key) : [...arr, key]);
        repaint();
      });
    });
    document.querySelectorAll('[data-role="cloze-option"]').forEach((el) => {
      el.addEventListener("click", () => {
        if (state.submitted) return;
        const prefix = el.dataset.prefix || "main";
        const current = selectionForPrefix(q, state, prefix);
        const next = current && typeof current === "object" && !Array.isArray(current) ? { ...current } : {};
        next[el.dataset.blank] = el.dataset.key;
        setSelectionForPrefix(q, state, prefix, next);
        repaint();
      });
    });
    document.querySelectorAll(".tf-btn").forEach((el) => {
      el.addEventListener("click", () => {
        if (state.submitted) return;
        const prefix = el.dataset.prefix || "main";
        const current = selectionForPrefix(q, state, prefix);
        const next = current && typeof current === "object" && !Array.isArray(current) ? { ...current } : {};
        next[el.dataset.stmt] = el.dataset.val;
        setSelectionForPrefix(q, state, prefix, next);
        repaint();
      });
    });
    document.querySelectorAll(".tf-btn-single").forEach((el) => {
      el.addEventListener("click", () => {
        if (state.submitted) return;
        setSelectionForPrefix(q, state, el.dataset.prefix || "main", el.dataset.val);
        repaint();
      });
    });
    document.querySelectorAll(".match-multi-btn").forEach((el) => {
      el.addEventListener("click", () => {
        if (state.submitted) return;
        const prefix = el.dataset.prefix || "main";
        const current = selectionForPrefix(q, state, prefix);
        const next = current && typeof current === "object" && !Array.isArray(current) ? { ...current } : {};
        const ri = el.dataset.row;
        const arr = next[ri] || [];
        next[ri] = arr.includes(el.dataset.label) ? arr.filter((l) => l !== el.dataset.label) : [...arr, el.dataset.label];
        setSelectionForPrefix(q, state, prefix, next);
        repaint();
      });
    });
    document.querySelectorAll("[data-match-row]").forEach((el) => {
      el.addEventListener("change", () => {
        const prefix = el.dataset.prefix || "main";
        const current = selectionForPrefix(q, state, prefix);
        const next = current && typeof current === "object" && !Array.isArray(current) ? { ...current } : {};
        next[el.dataset.matchRow] = el.value;
        setSelectionForPrefix(q, state, prefix, next);
      });
    });
    document.querySelectorAll("[data-fillkey]").forEach((el) => {
      el.addEventListener("input", () => {
        const prefix = el.dataset.prefix || "main";
        const current = selectionForPrefix(q, state, prefix);
        const next = current && typeof current === "object" && !Array.isArray(current) ? { ...current } : {};
        next[el.dataset.fillkey] = el.value;
        setSelectionForPrefix(q, state, prefix, next);
      });
    });

    ["input-extract", "input-short", "input-long"].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("input", () => setMainSelection(q, state, el.value));
    });
    const part2Input = document.getElementById("input-part2");
    if (part2Input) part2Input.addEventListener("input", () => setPart2Selection(q, state, part2Input.value));

    document.querySelectorAll("[data-cloze-open]").forEach((el) => {
      el.addEventListener("input", () => {
        const prefix = el.dataset.clozeOpen || "main";
        const current = selectionForPrefix(q, state, prefix);
        const next = current && typeof current === "object" && !Array.isArray(current) ? { ...current } : {};
        next.openText = el.value;
        setSelectionForPrefix(q, state, prefix, next);
      });
    });

    (q.items || []).forEach((_, i) => {
      const el = document.getElementById(`item-input-${i}`);
      if (!el) return;
      el.addEventListener("input", () => setItemSelection(q, state, i, el.value));
    });
  }

  // ---------- 批改 ----------
  function gradeByType(q, selected) {
    switch (q.question_type) {
      case "single_choice":
        return selected === q.answer;
      case "multi_select": {
        const a = [...(q.answer || [])].sort();
        const s = [...(Array.isArray(selected) ? selected : [])].sort();
        return a.length === s.length && a.every((v, i) => v === s[i]);
      }
      case "true_false_unknown": {
        if (q.statements) return q.statements.every((s, i) => selected && selected[i] === s.answer);
        return selected === q.answer;
      }
      case "matching": {
        if (q.option_labels) {
          return (q.rows || []).every((row, ri) => {
            const sel = (selected && selected[ri]) || [];
            const ans = row.answers || [];
            return sel.length === ans.length && ans.every((a) => sel.includes(a));
          });
        }
        return (q.rows || []).every((row, ri) => selected && selected[ri] === row.answer);
      }
      case "extract_sentence": {
        const norm = (s) => (s || "").replace(/[，。！？；：、\s]/g, "");
        return norm(selected) === norm(q.answer_text);
      }
      case "cloze_choice":
        return (q.blanks || []).every((b) => selected && selected[b.id] === b.answer);
      default:
        return null;
    }
  }

  function gradeQuestion(q, selected) {
    const main = isCompositeQuestion(q) ? selected.main : selected;
    const isCorrect = gradeByType(q, main);
    let part2IsCorrect = null;
    if (q.part2) {
      const partType = q.part2.question_type || q.part2.type || "long_answer";
      if (OBJECTIVE_TYPES.includes(partType)) {
        part2IsCorrect = gradeByType({ ...q.part2, question_type: partType }, selected.part2);
      }
    }
    return { isCorrect, part2IsCorrect };
  }

  // ---------- 顯示解析 ----------
  function renderReveal(q, state, showRemediation) {
    const isObjective = OBJECTIVE_TYPES.includes(q.question_type);
    const main = mainSelection(q, state);
    let panelClass = "reveal-panel";
    if (isObjective && state.isCorrect === false) panelClass += " is-incorrect";

    let html = `<div class="${panelClass}">`;
    if (isObjective) {
      html += `<div class="reveal-row"><b>${state.isCorrect ? "✓ 答對了" : state.isCorrect === false ? "✗ 答錯了" : "已提交"}</b></div>`;
    } else {
      html += `<div class="reveal-row"><b>已提交，以下為參考答案／評分元素（不設精確自動評分）</b></div>`;
    }

    html += renderCoreReveal(q, main);

    if (q.items && q.items.length) {
      html += `<div class="reveal-row" style="margin-top:10px;"><span class="reveal-label">逐項對照</span><div>`;
      q.items.forEach((it, i) => {
        const student = itemSelection(q, state, i) || "（未作答）";
        html += `<div class="reveal-explanation" style="margin-top:6px;"><strong>${esc(it.text || `第 ${i + 1} 項`)}</strong><br>你的答案：${esc(student)}${it.answer !== undefined ? `<br>參考答案：${esc(it.answer)}` : ""}</div>`;
      });
      html += `</div></div>`;
    }

    if (q.explanation) {
      html += `<div class="reveal-row" style="margin-top:10px;"><span class="reveal-label">解析</span><div class="reveal-explanation">${esc(q.explanation)}</div></div>`;
    }
    if (q.answer_elements) {
      html += `<div class="reveal-row" style="margin-top:10px;"><span class="reveal-label">評分元素／參考要點</span><ul class="scoring-elements">${q.answer_elements.map((e) => `<li>${esc(e)}</li>`).join("")}</ul></div>`;
    }
    if (q.scoring_elements) {
      html += `<div class="reveal-row" style="margin-top:10px;"><span class="reveal-label">評分元素</span><ul class="scoring-elements">${q.scoring_elements.map((e) => `<li>${esc(e)}</li>`).join("")}</ul></div>`;
    }
    if (q.follow_up_open_answer) {
      html += `<div class="reveal-row" style="margin-top:10px;"><span class="reveal-label">延伸問題參考答案</span><div class="reveal-explanation">${esc(q.follow_up_open_answer)}</div></div>`;
    }
    if (q.open_answer_elements) {
      html += `<div class="reveal-row" style="margin-top:10px;"><span class="reveal-label">開放部分參考要點</span><ul class="scoring-elements">${q.open_answer_elements.map((e) => `<li>${esc(e)}</li>`).join("")}</ul></div>`;
    }
    if (q.rhetorical_device) html += reveaLine("修辭手法", q.rhetorical_device);
    if (q.part2) html += renderPart2Reveal(q, state);
    if (q.note) html += `<div class="reveal-row" style="margin-top:10px; color:var(--color-ink-soft); font-size:13px;">${esc(q.note)}</div>`;

    if (showRemediation && isObjective && state.isCorrect === false) {
      const tags = diagnosticTags(q);
      const remediation = defaultRemediation(q);
      html += `<div class="reveal-row" style="margin-top:12px;">
        <span class="reveal-label">需補強範疇</span>
        <div>${tags.map((t) => `<span class="tag" style="margin-right:4px;">${esc(t)}</span>`).join("")}</div>
        <div class="reveal-explanation" style="margin-top:6px;">💡 ${esc(remediation)}</div>
      </div>`;
    }

    if (q.source) html += `<div class="reveal-row" style="margin-top:10px; font-size:12px; color:var(--color-ink-faint);">來源：${esc(q.source)}</div>`;
    html += `</div>`;
    return html;
  }

  function renderCoreReveal(q, selected) {
    switch (q.question_type) {
      case "single_choice":
        return reveaLine("你的答案", selected ? `${selected}. ${optionText(q, selected)}` : "（未作答）") +
          reveaLine("正確答案", `${q.answer}. ${optionText(q, q.answer)}`);
      case "multi_select":
        return reveaLine("你的答案", (selected || []).join("、") || "（未作答）") +
          reveaLine("正確答案", (q.answer || []).join("、"));
      case "true_false_unknown": {
        let html = "";
        if (q.statements) {
          q.statements.forEach((s, i) => {
            html += reveaLine(`陳述 ${i + 1}`, `你的答案：${tfLabel((selected || {})[i]) || "（未作答）"}　／　正確答案：${tfLabel(s.answer)}`);
            if (s.explanation) html += `<div class="reveal-explanation">${esc(s.explanation)}</div>`;
          });
        } else {
          html += reveaLine("你的答案", selected ? tfLabel(selected) : "（未作答）");
          html += reveaLine("正確答案", tfLabel(q.answer));
        }
        return html;
      }
      case "extract_sentence":
        return reveaLine("你的答案", selected || "（未作答）") + reveaLine("參考答案", q.answer_text || "");
      case "matching": {
        let html = "";
        if (q.option_labels) {
          (q.rows || []).forEach((row, ri) => {
            html += reveaLine(row.text, `你的答案：${((selected || {})[ri] || []).join("、") || "（未作答）"}　／　正確答案：${(row.answers || []).join("、")}`);
          });
        } else {
          (q.rows || []).forEach((row, ri) => {
            html += reveaLine(row.text, `你的答案：${(selected || {})[ri] || "（未作答）"}　／　正確答案：${row.answer}`);
          });
        }
        return html;
      }
      case "short_answer":
      case "long_answer":
        return q.items && q.items.length ? "" : reveaLine("你的答案", selected || "（未作答）");
      case "fill_table":
        return `<div class="reveal-row"><span class="reveal-label">你的填寫</span>${Object.entries(selected || {}).map(([k, v]) => `${esc(k)}：${esc(v)}`).join("；") || "（未作答）"}</div>`;
      case "cloze_choice": {
        let html = "";
        (q.blanks || []).forEach((b) => {
          const sel = (selected || {})[b.id];
          html += reveaLine(b.id, `你的答案：${sel || "（未作答）"}　／　正確答案：${b.answer}`);
        });
        if (selected && selected.openText) html += reveaLine("你的開放作答", selected.openText);
        return html;
      }
      default: return "";
    }
  }

  function renderPart2Reveal(q, state) {
    const part = q.part2;
    const type = part.question_type || part.type || "long_answer";
    const selected = part2Selection(q, state);
    const pseudo = { ...part, question_type: type };
    let html = `<div class="reveal-row" style="margin-top:14px; padding-top:10px; border-top:1px dashed var(--color-border);"><span class="reveal-label">延伸問題：${esc(part.stem)}</span>`;
    if (OBJECTIVE_TYPES.includes(type) && state.part2IsCorrect !== null && state.part2IsCorrect !== undefined) {
      html += `<div class="reveal-explanation"><strong>${state.part2IsCorrect ? "✓ 延伸題答對" : "✗ 延伸題答錯"}</strong></div>`;
    }
    html += `<div style="margin-top:6px;">${renderCoreReveal(pseudo, selected)}</div>`;
    if (part.answer_text && type !== "extract_sentence") html += `<div class="reveal-explanation">參考答案：${esc(part.answer_text)}</div>`;
    if (part.answer_elements) html += `<ul class="scoring-elements">${part.answer_elements.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>`;
    if (part.scoring_elements) html += `<ul class="scoring-elements">${part.scoring_elements.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>`;
    if (part.explanation) html += `<div class="reveal-explanation">${esc(part.explanation)}</div>`;
    html += `</div>`;
    return html;
  }

  function reveaLine(label, value) {
    return `<div class="reveal-row"><span class="reveal-label">${esc(label)}</span>${esc(value)}</div>`;
  }

  function optionText(q, key) {
    const found = (q.options || []).find((o) => o.key === key);
    return found ? found.text : "";
  }

  return { renderQuizSequence, renderChallengeSetup, renderChallengeRun, renderChallengeResult };
})();
