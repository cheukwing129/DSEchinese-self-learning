/* ============================================================
   question-engine.js — 統一題目渲染與作答互動邏輯
   規則：
   - 作答後不自動跳題，須顯示所選答案／正確答案／解析
   - 按「我已看完答案，下一題」才前進
   - 可不作答先看下一題；可返回已作答題目查看
   - 開放題不設字數下限，不做精確自動評分
   ============================================================ */

const QuestionEngine = (() => {
  const esc = App.escapeHTML;
  const OBJECTIVE_TYPES = ["single_choice", "multi_select", "true_false_unknown", "matching", "extract_sentence"];

  const difficultyLabel = { basic: "基礎", intermediate: "進階", advanced: "挑戰" };

  // ---------- 對外入口：一般題庫序列 ----------
  function renderQuizSequence({ bundle, unitId, questions, title, basePath, startIndex, listKind }) {
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

  // ---------- 對外入口：核心篇章挑戰 ----------
  function renderChallengeSetup(bundle, unitId) {
    const { unit, allQuestions } = bundle;
    const abilities = [...new Set(allQuestions.map((q) => q.ability))];
    const abilityCheckboxes = abilities
      .map(
        (a, i) => `
        <label class="option-item" style="cursor:pointer;">
          <input type="checkbox" class="challenge-ability" value="${esc(a)}" checked style="width:18px; height:18px;" />
          ${esc(a)}
        </label>`
      )
      .join("");

    App.mount(`
      <h1 class="page-title">核心篇章挑戰</h1>
      <p class="page-subtitle">整合各分類題目，隨機抽題，並附錯因標籤與補救建議</p>
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
      sessionStorage.setItem(`ccsl_challenge_${unitId}`, JSON.stringify(shuffled.map((q) => q.id)));
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

  function getChallengeQuestions(bundle, unitId) {
    const raw = sessionStorage.getItem(`ccsl_challenge_${unitId}`);
    if (!raw) return null;
    const ids = JSON.parse(raw);
    const byId = {};
    bundle.allQuestions.forEach((q) => (byId[q.id] = q));
    return ids.map((id) => byId[id]).filter(Boolean);
  }

  function renderChallengeRun(bundle, unitId) {
    const questions = getChallengeQuestions(bundle, unitId);
    if (!questions || !questions.length) {
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
    if (!questions || !questions.length) {
      App.mount(`
        <div class="empty-state">
          <p>找不到挑戰紀錄，請重新開始一次挑戰。</p>
          <a class="btn btn-primary" href="#/unit/${unitId}/challenge">前往設定 →</a>
        </div>
        ${App.footerNav(unitId, bundle.unit.title)}
      `);
      return;
    }
    const answers = Progress.getAllAnswers(unitId);
    let answeredCount = 0, correctCount = 0, objectiveCount = 0;
    const errorTagCounts = {};
    questions.forEach((q) => {
      const rec = answers[q.id];
      const isObjective = OBJECTIVE_TYPES.includes(q.question_type);
      if (isObjective) objectiveCount += 1;
      if (rec && rec.answered) {
        answeredCount += 1;
        if (isObjective && rec.isCorrect) correctCount += 1;
        if (isObjective && rec.isCorrect === false && q.error_tags) {
          q.error_tags.forEach((tag) => (errorTagCounts[tag] = (errorTagCounts[tag] || 0) + 1));
        }
      }
    });
    const rate = objectiveCount ? Math.round((correctCount / Math.max(answeredCount, 1)) * 100) : null;

    const tagList = Object.keys(errorTagCounts).length
      ? `<ul class="scoring-elements">${Object.entries(errorTagCounts).map(([tag, n]) => `<li>${esc(tag)}（${n} 次）</li>`).join("")}</ul>`
      : `<p style="color:var(--color-ink-soft); font-size:14px;">本次挑戰沒有明顯的錯因集中出現。</p>`;

    App.mount(`
      <h1 class="page-title">挑戰結果</h1>
      <div class="card">
        <div class="stat-grid">
          <div class="stat-card"><div class="stat-value">${questions.length}</div><div class="stat-label">挑戰題數</div></div>
          <div class="stat-card"><div class="stat-value">${answeredCount}</div><div class="stat-label">已作答</div></div>
          <div class="stat-card"><div class="stat-value">${rate == null ? "—" : rate + "%"}</div><div class="stat-label">客觀題正確率</div></div>
        </div>
      </div>
      <div class="card">
        <div class="section-title"><span class="seal">因</span>錯因分布與補救建議</div>
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
  function renderQuestionShell({ unitId, bundle, question, title, indexLabel, onPrev, onNext, backHref, onAfterConfirm, showRemediation, extraNav }) {
    const savedRecord = Progress.getAnswer(unitId, question.id);
    const state = {
      submitted: !!(savedRecord && savedRecord.answered),
      selected: savedRecord ? savedRecord.selected : initSelection(question),
      isCorrect: savedRecord ? savedRecord.isCorrect : null
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
          Progress.recordAnswer(unitId, question.id, {
            answered: true, selected: state.selected, isCorrect: result.isCorrect
          });
          paint();
        });
      }

      if (onPrev) document.getElementById("prev-btn").addEventListener("click", onPrev);
      if (onNext) document.getElementById("next-btn").addEventListener("click", onNext);
    }

    paint();
  }

  function initSelection(q) {
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

  // ---------- 各題型：作答內容渲染 ----------
  function renderQuestionBody(q, state) {
    let html = `<p class="q-stem">${esc(q.stem)}</p>`;
    if (q.quote) html += `<div class="q-quote">${esc(q.quote)}</div>`;
    if (q.context_quotes) {
      html += q.context_quotes.map((c) => `<div class="q-quote"><strong>${esc(c.label)}：</strong>${esc(c.text)}</div>`).join("");
    }

    switch (q.question_type) {
      case "single_choice":
        html += renderSingleChoice(q, state, "sc");
        break;
      case "multi_select":
        html += `<p style="font-size:12px; color:var(--color-ink-soft); margin:-8px 0 10px;">（答案可選多於一個）</p>`;
        html += renderMultiSelect(q, state);
        break;
      case "true_false_unknown":
        html += renderTrueFalse(q, state);
        break;
      case "extract_sentence":
        html += `<textarea class="answer-input" id="input-extract" placeholder="請摘錄原文句子…">${esc(state.selected || "")}</textarea>`;
        break;
      case "short_answer":
        html += `<textarea class="answer-input" id="input-short" placeholder="請輸入答案（不設字數下限）…">${esc(state.selected || "")}</textarea>`;
        break;
      case "long_answer":
        html += `<textarea class="answer-input" id="input-long" placeholder="請輸入你的答案（不設字數下限，將以評分元素自評）…">${esc(state.selected || "")}</textarea>`;
        break;
      case "fill_table":
        html += renderFillTable(q, state);
        break;
      case "matching":
        html += renderMatching(q, state);
        break;
      case "cloze_choice":
        html += renderClozeChoice(q, state);
        break;
      default:
        html += `<p class="error-banner">未支援的題型：${esc(q.question_type)}</p>`;
    }

    if (q.items) {
      html += `<div style="margin-top:12px;">` + q.items.map((it, i) => `
        <div class="card card-tight" style="margin-bottom:8px;">
          <p style="margin:0 0 6px; font-size:14px;">${esc(it.text)}　→　粗體字：<strong>${esc(it.target)}</strong></p>
          <input type="text" class="answer-input" id="item-input-${i}" value="${esc(state.selected && state.selected[`item_${i}`] || "")}" placeholder="請解釋此字詞…" />
        </div>`).join("") + `</div>`;
    }

    if (q.part2) {
      html += `
        <div class="card card-tight" style="margin-top:16px; background:#FBFAF7;">
          <p class="q-stem" style="font-size:15px;">${esc(q.part2.stem)}</p>
          <textarea class="answer-input" id="input-part2" placeholder="請輸入答案…">${esc(state.selected && state.selected.part2 || "")}</textarea>
        </div>`;
    }

    return html;
  }

  function renderSingleChoice(q, state, prefix) {
    return `<div class="option-list">${q.options
      .map(
        (o) => `
        <div class="option-item ${state.selected === o.key ? "is-selected" : ""}" data-key="${o.key}" data-role="option-${prefix}">
          <span class="option-key">${o.key}</span><span>${esc(o.text)}</span>
        </div>`
      )
      .join("")}</div>`;
  }

  function renderMultiSelect(q, state) {
    const sel = Array.isArray(state.selected) ? state.selected : [];
    return `<div class="option-list">${q.options
      .map(
        (o) => `
        <div class="option-item ${sel.includes(o.key) ? "is-selected" : ""}" data-key="${o.key}" data-role="option-ms">
          <span class="option-key">${sel.includes(o.key) ? "✓" : o.key}</span><span>${esc(o.text)}</span>
        </div>`
      )
      .join("")}</div>`;
  }

  function renderTrueFalse(q, state) {
    if (q.statements) {
      return q.statements
        .map((s, i) => {
          const cur = state.selected ? state.selected[i] : null;
          return `
          <div class="card card-tight" style="margin-bottom:10px;">
            <p style="margin:0 0 8px; font-size:14px;">${i + 1}. ${esc(s.text)}</p>
            <div style="display:flex; gap:8px;">
              ${["true", "false", "unknown"].map((v) => `
                <button class="btn btn-secondary tf-btn ${cur === v ? "is-selected" : ""}" data-stmt="${i}" data-val="${v}" style="${cur === v ? "border-color:var(--color-accent); background:var(--color-accent-soft);" : ""}">
                  ${v === "true" ? "正確" : v === "false" ? "錯誤" : "無從判斷"}
                </button>`).join("")}
            </div>
          </div>`;
        })
        .join("");
    }
    const cur = state.selected;
    return `<div style="display:flex; gap:8px;">
      ${["true", "false", "unknown"].map((v) => `
        <button class="btn btn-secondary tf-btn-single ${cur === v ? "is-selected" : ""}" data-val="${v}" style="${cur === v ? "border-color:var(--color-accent); background:var(--color-accent-soft);" : ""}">
          ${v === "true" ? "正確" : v === "false" ? "錯誤" : "無從判斷"}
        </button>`).join("")}
    </div>`;
  }

  function renderFillTable(q, state) {
    const cols = q.table.columns;
    const rows = q.table.rows; // rows: [{ cells: [val, val, ...] }], null/undefined = 待填
    let html = `<table class="fill-table"><thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>`;
    rows.forEach((row, ri) => {
      html += "<tr>";
      row.cells.forEach((val, ci) => {
        if (val === null || val === undefined) {
          const key = `r${ri}c${ci}`;
          const savedVal = state.selected && state.selected[key] ? state.selected[key] : "";
          html += `<td class="blank-cell"><textarea data-fillkey="${key}" placeholder="請填寫…">${esc(savedVal)}</textarea></td>`;
        } else {
          html += `<td>${esc(val)}</td>`;
        }
      });
      html += "</tr>";
    });
    html += "</tbody></table>";
    return html;
  }

  function renderMatching(q, state) {
    if (q.option_labels) {
      // 多選配對（每列可選多個標籤）
      return q.rows
        .map((row, ri) => {
          const sel = (state.selected && state.selected[ri]) || [];
          return `
          <div class="card card-tight" style="margin-bottom:10px;">
            <p style="margin:0 0 8px; font-size:14px; font-family:var(--font-display);">${esc(row.text)}</p>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              ${q.option_labels.map((label) => `
                <button class="btn btn-secondary match-multi-btn ${sel.includes(label) ? "is-selected" : ""}" data-row="${ri}" data-label="${esc(label)}" style="${sel.includes(label) ? "border-color:var(--color-accent); background:var(--color-accent-soft);" : ""}">${esc(label)}</button>
              `).join("")}
            </div>
          </div>`;
        })
        .join("");
    }
    // 單選配對（下拉選單）
    return q.rows
      .map((row, ri) => {
        const cur = (state.selected && state.selected[ri]) || "";
        return `
        <div class="card card-tight" style="margin-bottom:10px; display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
          <p style="margin:0; font-size:14px; flex:1;">${esc(row.text)}</p>
          <select data-match-row="${ri}" class="answer-input" style="max-width:160px;">
            <option value="">請選擇</option>
            ${q.options.map((o) => `<option value="${esc(o.key)}" ${cur === o.key ? "selected" : ""}>${esc(o.key)}. ${esc(o.text)}</option>`).join("")}
          </select>
        </div>`;
      })
      .join("");
  }

  function renderClozeChoice(q, state) {
    let html = `<p style="font-size:14px; color:var(--color-ink-soft); margin-bottom:12px;">${esc(q.cloze_template)}</p>`;
    q.blanks.forEach((b) => {
      const cur = (state.selected && state.selected[b.id]) || "";
      html += `
        <div class="card card-tight" style="margin-bottom:10px;">
          <p style="margin:0 0 8px; font-size:13px; font-weight:700;">${esc(b.id)}</p>
          <div class="option-list">
            ${b.options.map((o) => `
              <div class="option-item ${cur === o.key ? "is-selected" : ""}" data-blank="${b.id}" data-key="${o.key}" data-role="cloze-option">
                <span class="option-key">${o.key}</span><span>${esc(o.text)}</span>
              </div>`).join("")}
          </div>
        </div>`;
    });
    html += `<textarea class="answer-input" id="input-cloze-open" placeholder="請完成開放部分的說明…">${esc((state.selected && state.selected.openText) || "")}</textarea>`;
    return html;
  }

  // ---------- 事件綁定 ----------
  function bindBodyEvents(q, state, repaint) {
    document.querySelectorAll('[data-role="option-sc"]').forEach((el) => {
      el.addEventListener("click", () => {
        if (state.submitted) return;
        state.selected = el.dataset.key;
        repaint();
      });
    });
    document.querySelectorAll('[data-role="option-ms"]').forEach((el) => {
      el.addEventListener("click", () => {
        if (state.submitted) return;
        const key = el.dataset.key;
        const arr = Array.isArray(state.selected) ? state.selected : [];
        state.selected = arr.includes(key) ? arr.filter((k) => k !== key) : [...arr, key];
        repaint();
      });
    });
    document.querySelectorAll('[data-role="cloze-option"]').forEach((el) => {
      el.addEventListener("click", () => {
        if (state.submitted) return;
        state.selected = state.selected || {};
        state.selected[el.dataset.blank] = el.dataset.key;
        repaint();
      });
    });
    document.querySelectorAll(".tf-btn").forEach((el) => {
      el.addEventListener("click", () => {
        if (state.submitted) return;
        state.selected = state.selected || {};
        state.selected[el.dataset.stmt] = el.dataset.val;
        repaint();
      });
    });
    document.querySelectorAll(".tf-btn-single").forEach((el) => {
      el.addEventListener("click", () => {
        if (state.submitted) return;
        state.selected = el.dataset.val;
        repaint();
      });
    });
    document.querySelectorAll(".match-multi-btn").forEach((el) => {
      el.addEventListener("click", () => {
        if (state.submitted) return;
        const ri = el.dataset.row;
        state.selected = state.selected || {};
        const arr = state.selected[ri] || [];
        state.selected[ri] = arr.includes(el.dataset.label) ? arr.filter((l) => l !== el.dataset.label) : [...arr, el.dataset.label];
        repaint();
      });
    });
    document.querySelectorAll("[data-match-row]").forEach((el) => {
      el.addEventListener("change", () => {
        state.selected = state.selected || {};
        state.selected[el.dataset.matchRow] = el.value;
      });
    });
    document.querySelectorAll("[data-fillkey]").forEach((el) => {
      el.addEventListener("input", () => {
        state.selected = state.selected || {};
        state.selected[el.dataset.fillkey] = el.value;
      });
    });
    ["input-extract", "input-short", "input-long", "input-cloze-open", "input-part2"].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("input", () => {
        if (id === "input-cloze-open") {
          state.selected = state.selected || {};
          state.selected.openText = el.value;
        } else if (id === "input-part2") {
          state.selected = state.selected || {};
          state.selected.part2 = el.value;
        } else {
          state.selected = el.value;
        }
      });
    });
    (q.items || []).forEach((it, i) => {
      const el = document.getElementById(`item-input-${i}`);
      if (!el) return;
      el.addEventListener("input", () => {
        state.selected = state.selected || {};
        state.selected[`item_${i}`] = el.value;
      });
    });
  }

  // ---------- 批改（僅客觀題型可自動判斷對錯） ----------
  function gradeQuestion(q, selected) {
    switch (q.question_type) {
      case "single_choice":
        return { isCorrect: selected === q.answer };
      case "multi_select": {
        const a = [...(q.answer || [])].sort();
        const s = [...(Array.isArray(selected) ? selected : [])].sort();
        return { isCorrect: a.length === s.length && a.every((v, i) => v === s[i]) };
      }
      case "true_false_unknown": {
        if (q.statements) {
          const all = q.statements.every((s, i) => selected && selected[i] === s.answer);
          return { isCorrect: all };
        }
        return { isCorrect: selected === q.answer };
      }
      case "matching": {
        if (q.option_labels) {
          const ok = q.rows.every((row, ri) => {
            const sel = (selected && selected[ri]) || [];
            const ans = row.answers || [];
            return sel.length === ans.length && ans.every((a) => sel.includes(a));
          });
          return { isCorrect: ok };
        }
        const ok = q.rows.every((row, ri) => selected && selected[ri] === row.answer);
        return { isCorrect: ok };
      }
      case "extract_sentence": {
        const norm = (s) => (s || "").replace(/[，。！？；：、\s]/g, "");
        const isCorrect = norm(selected) === norm(q.answer_text);
        return { isCorrect };
      }
      default:
        return { isCorrect: null }; // 開放題不自動評分
    }
  }

  // ---------- 顯示解析 ----------
  function renderReveal(q, state, showRemediation) {
    const isObjective = OBJECTIVE_TYPES.includes(q.question_type);
    let panelClass = "reveal-panel";
    if (isObjective && state.isCorrect === true) panelClass += "";
    if (isObjective && state.isCorrect === false) panelClass += " is-incorrect";

    let html = `<div class="${panelClass}">`;

    if (isObjective) {
      html += `<div class="reveal-row"><b>${state.isCorrect ? "✓ 答對了" : state.isCorrect === false ? "✗ 答錯了" : "已提交"}</b></div>`;
    } else {
      html += `<div class="reveal-row"><b>已提交，以下為參考答案／評分元素（不設精確自動評分）</b></div>`;
    }

    switch (q.question_type) {
      case "single_choice":
        html += reveaLine("你的答案", state.selected ? `${state.selected}. ${optionText(q, state.selected)}` : "（未作答）");
        html += reveaLine("正確答案", `${q.answer}. ${optionText(q, q.answer)}`);
        break;
      case "multi_select":
        html += reveaLine("你的答案", (state.selected || []).join("、") || "（未作答）");
        html += reveaLine("正確答案", (q.answer || []).join("、"));
        break;
      case "true_false_unknown":
        if (q.statements) {
          q.statements.forEach((s, i) => {
            const label = { true: "正確", false: "錯誤", unknown: "無從判斷" };
            html += reveaLine(`陳述 ${i + 1}`, `你的答案：${label[(state.selected || {})[i]] || "（未作答）"}　／　正確答案：${label[s.answer]}`);
            if (s.explanation) html += `<div class="reveal-explanation">${esc(s.explanation)}</div>`;
          });
        } else {
          const label = { true: "正確", false: "錯誤", unknown: "無從判斷" };
          html += reveaLine("你的答案", label[state.selected] || "（未作答）");
          html += reveaLine("正確答案", label[q.answer]);
        }
        break;
      case "extract_sentence":
        html += reveaLine("你的答案", state.selected || "（未作答）");
        html += reveaLine("參考答案", q.answer_text);
        break;
      case "matching":
        if (q.option_labels) {
          q.rows.forEach((row, ri) => {
            html += reveaLine(row.text, `你的答案：${((state.selected || {})[ri] || []).join("、") || "（未作答）"}　／　正確答案：${row.answers.join("、")}`);
          });
        } else {
          q.rows.forEach((row, ri) => {
            const sel = (state.selected || {})[ri];
            html += reveaLine(row.text, `你的答案：${sel || "（未作答）"}　／　正確答案：${row.answer}`);
          });
        }
        break;
      case "short_answer":
      case "long_answer":
        html += reveaLine("你的答案", state.selected || "（未作答）");
        break;
      case "fill_table":
        html += `<div class="reveal-row"><span class="reveal-label">你的填寫</span>` +
          Object.entries(state.selected || {}).map(([k, v]) => `${esc(k)}：${esc(v)}`).join("；") + `</div>`;
        break;
      case "cloze_choice":
        q.blanks.forEach((b) => {
          const sel = (state.selected || {})[b.id];
          html += reveaLine(b.id, `你的答案：${sel || "（未作答）"}　／　正確答案：${b.answer}`);
        });
        if (state.selected && state.selected.openText) html += reveaLine("你的開放作答", state.selected.openText);
        break;
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
    if (q.rhetorical_device) {
      html += reveaLine("修辭手法", q.rhetorical_device);
    }
    if (q.part2) {
      html += `<div class="reveal-row" style="margin-top:14px; padding-top:10px; border-top:1px dashed var(--color-border);"><span class="reveal-label">延伸問題：${esc(q.part2.stem)}</span>`;
      html += `<div class="reveal-explanation">你的答案：${esc((state.selected && state.selected.part2) || "（未作答）")}</div>`;
      if (q.part2.scoring_elements) {
        html += `<ul class="scoring-elements">${q.part2.scoring_elements.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>`;
      }
      html += `</div>`;
    }
    if (q.note) {
      html += `<div class="reveal-row" style="margin-top:10px; color:var(--color-ink-soft); font-size:13px;">${esc(q.note)}</div>`;
    }

    if (showRemediation && isObjective && state.isCorrect === false) {
      html += `<div class="reveal-row" style="margin-top:12px;">
        ${q.error_tags ? `<span class="reveal-label">可能錯因</span><div>${q.error_tags.map((t) => `<span class="tag" style="margin-right:4px;">${esc(t)}</span>`).join("")}</div>` : ""}
        ${q.remediation ? `<div class="reveal-explanation" style="margin-top:6px;">💡 ${esc(q.remediation)}</div>` : ""}
      </div>`;
    }

    if (q.source) html += `<div class="reveal-row" style="margin-top:10px; font-size:12px; color:var(--color-ink-faint);">來源：${esc(q.source)}</div>`;

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
