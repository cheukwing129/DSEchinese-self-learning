from pathlib import Path
import re

root = Path('.')
content_path = root / 'js/content-renderer.js'
css_path = root / 'css/style.css'
smoke_path = root / 'scripts/browser-smoke.mjs'
content = content_path.read_text(encoding='utf-8')
css = css_path.read_text(encoding='utf-8')
smoke = smoke_path.read_text(encoding='utf-8')


def replace_function(text, start_name, next_name, replacement):
    pattern = rf'  function {re.escape(start_name)}\b.*?(?=\n  function {re.escape(next_name)}\b)'
    new_text, count = re.subn(pattern, replacement.rstrip() + '\n', text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f'{start_name}: expected 1 function block, found {count}')
    return new_text

cross_unit = r'''  function renderCrossUnitOverview(curriculum, unitBundles) {
    const inputs = (unitBundles || []).map(({ entry, bundle }) => ({
      unitId: entry.id,
      title: entry.title,
      author: entry.author,
      questions: bundle.allQuestions || []
    }));
    const overview = Progress.crossUnitOverview(inputs);
    const unitsWithEvidence = overview.units.filter((u) => u.hasEvidence || u.everWrong > 0);
    const lead = overview.priorityUnits[0] || null;
    const leadHref = lead ? `#/unit/${lead.unitId}/progress/retry-wrong` : "#/";
    const leadLabel = lead ? `重練《${esc(lead.title)}》待修正錯題` : (overview.engagedUnits ? "回到篇章繼續學習" : "選一篇開始學習");
    const leadTitle = lead
      ? `先處理《${esc(lead.title)}》的 ${lead.currentWrong} 題待修正`
      : (overview.engagedUnits ? "目前沒有待修正的客觀題" : "從第一篇真實學習紀錄開始");
    const leadReason = lead
      ? `這篇目前留下 ${lead.currentWrong} 題待修正；曾答錯 ${lead.everWrong} 題，累積答錯 ${lead.wrongAttempts} 次。`
      : (overview.engagedUnits ? "你已有學習紀錄，但目前沒有最後一次仍答錯的客觀題。可回到篇章繼續作答、背誦或反思。" : "總覽只整理這部裝置真正留下的作答、背誦、自評與反思紀錄；開始學習後才會逐步出現。 ");

    const priorityHTML = overview.priorityUnits.length
      ? overview.priorityUnits.slice(0, 5).map((u, index) => `
        <article class="priority-card ${index === 0 ? "is-primary" : ""}">
          <div class="priority-rank" aria-hidden="true">${String(index + 1).padStart(2, "0")}</div>
          <div class="priority-copy">
            <div class="priority-heading">
              <div>
                <span class="priority-kicker">${index === 0 ? "現在先做" : "接著處理"}</span>
                <h3>《${esc(u.title)}》${u.author ? `<small>${esc(u.author)}</small>` : ""}</h3>
              </div>
              <span class="priority-count">${u.currentWrong}<small>待修正</small></span>
            </div>
            <p>曾答錯 ${u.everWrong} 題 · 累積答錯 ${u.wrongAttempts} 次${u.repeatedWrongQuestions ? ` · ${u.repeatedWrongQuestions} 題曾重複答錯` : ""}</p>
          </div>
          <a class="btn ${index === 0 ? "btn-primary" : "btn-secondary"}" href="#/unit/${u.unitId}/progress/retry-wrong">重練待修正錯題 →</a>
        </article>`).join("")
      : `<div class="progress-empty-card"><span aria-hidden="true">✓</span><div><strong>目前沒有待修正錯題</strong><p>如有歷史錯題，仍可在各篇「我的掌握」查看已修正紀錄。</p></div></div>`;

    const abilityHTML = overview.abilities.length
      ? overview.abilities.slice(0, 10).map((a, index) => `
        <article class="ability-evidence-row">
          <div class="ability-rank">${String(index + 1).padStart(2, "0")}</div>
          <div class="ability-evidence-copy">
            <strong>${esc(a.ability)}</strong>
            <p>待修正 ${a.currentWrongQuestions} 題 · 曾答錯 ${a.everWrongQuestions} 題 · 累積答錯 ${a.wrongAttempts} 次</p>
            <small>涉及 ${a.everWrongUnits} 篇${a.currentWrongUnits ? `；其中 ${a.currentWrongUnits} 篇仍有待修正題目` : ""}${a.repeatedWrongQuestions ? `；${a.repeatedWrongQuestions} 題曾重複答錯` : ""}</small>
          </div>
          ${a.currentWrongQuestions ? `<a class="btn btn-secondary" href="#/overview/retry/${encodeURIComponent(a.ability)}">重練此能力 →</a>` : `<span class="evidence-resolved">已無待修正</span>`}
        </article>`).join("")
      : `<div class="progress-empty-card compact"><span aria-hidden="true">○</span><div><strong>尚未有客觀題錯題紀錄</strong><p>作答後，這裡才會按真實錯題證據整理能力範疇。</p></div></div>`;

    const unitHTML = unitsWithEvidence.length
      ? unitsWithEvidence.sort((a, b) =>
          b.currentWrong - a.currentWrong ||
          b.everWrong - a.everWrong ||
          b.evidenceAt - a.evidenceAt
        ).map((u) => `
          <article class="unit-evidence-card">
            <div class="unit-evidence-head">
              <div><h3>《${esc(u.title)}》</h3>${u.author ? `<p>${esc(u.author)}</p>` : ""}</div>
              <span class="unit-evidence-status ${u.currentWrong ? "needs-work" : "is-clear"}">${u.currentWrong ? `${u.currentWrong} 題待修正` : "目前已修正"}</span>
            </div>
            <div class="unit-evidence-metrics">
              <span><strong>${u.answered}</strong>已作答客觀題</span>
              <span><strong>${u.everWrong}</strong>曾答錯</span>
              <span><strong>${u.resolvedWrong}</strong>曾錯後已修正</span>
            </div>
            <div class="unit-evidence-actions">
              ${u.currentWrong ? `<a class="btn btn-primary" href="#/unit/${u.unitId}/progress/retry-wrong">重練錯題</a>` : ""}
              <a class="btn btn-secondary" href="#/unit/${u.unitId}/progress">查看掌握</a>
            </div>
          </article>`).join("")
      : `<div class="progress-empty-card wide"><span aria-hidden="true">文</span><div><strong>這部裝置尚未有跨篇章紀錄</strong><p>先選一篇開始學習及作答，之後這裡才會整理真實紀錄。</p></div></div>`;

    App.mount(`
      <header class="progress-hero overview-hero">
        <div class="progress-hero-copy">
          <p class="section-kicker">跨篇章學習總覽</p>
          <h1 class="page-title">${leadTitle}</h1>
          <p class="progress-hero-reason">${leadReason}</p>
          <p class="progress-honesty-note">整合這部裝置上的真實紀錄；不產生虛假的總掌握百分比。</p>
        </div>
        <div class="progress-hero-action">
          <span class="progress-action-label">NEXT</span>
          <a class="btn btn-primary" href="${leadHref}">${leadLabel} <span aria-hidden="true">→</span></a>
        </div>
      </header>

      <section class="evidence-strip" aria-label="跨篇章紀錄摘要">
        <div><span>${overview.engagedUnits}/${overview.totalUnits}</span><small>有學習活動篇章</small></div>
        <div><span>${overview.totalAnswered}</span><small>已作答客觀題</small></div>
        <div class="${overview.totalCurrentWrong ? "needs-attention" : ""}"><span>${overview.totalCurrentWrong}</span><small>目前待修正</small></div>
        <div><span>${overview.totalResolvedWrong}</span><small>曾錯後已修正</small></div>
      </section>
      <p class="evidence-footnote">「有學習活動」只表示曾留下作答、背誦、自評或反思紀錄，不代表完成或掌握該篇。</p>

      <section class="progress-section" aria-labelledby="priority-title">
        <div class="progress-section-heading">
          <div><p class="section-kicker">優先次序</p><h2 id="priority-title">現在最值得處理的篇章</h2></div>
          ${overview.totalCurrentWrong ? `<a class="btn btn-secondary" href="#/overview/retry/all">重練全部待修正</a>` : ""}
        </div>
        <p class="progress-method-note">排序規則：待修正錯題數 → 重複答錯題數 → 累積答錯次數 → 最近學習活動。這是整理紀錄，不是能力評分。</p>
        <div class="priority-stack">${priorityHTML}</div>
      </section>

      <section class="progress-section progress-split-section" aria-labelledby="ability-title">
        <div class="progress-section-heading">
          <div><p class="section-kicker">錯題證據</p><h2 id="ability-title">錯題集中在哪些能力</h2></div>
        </div>
        <p class="progress-method-note">按目前待修正題數及歷史答錯次數排列；同一題多次答錯會保留為歷史證據。</p>
        <div class="ability-evidence-list">${abilityHTML}</div>
      </section>

      <section class="progress-section" aria-labelledby="units-title">
        <div class="progress-section-heading">
          <div><p class="section-kicker">篇章紀錄</p><h2 id="units-title">逐篇查看真實學習證據</h2></div>
        </div>
        <div class="unit-evidence-grid">${unitHTML}</div>
      </section>
      ${App.footerNav(null, null)}
    `);
  }
'''

progress_page = r'''  function renderProgressPage(bundle, unitId) {
    const { unit, allQuestions } = bundle;
    const overall = Progress.overallAccuracy(unitId, allQuestions);
    const abilities = Progress.abilityStats(unitId, allQuestions);
    const wrongIds = Progress.wrongQuestionIds(unitId, allQuestions);
    const everWrongIds = Progress.everWrongQuestionIds(unitId, allQuestions);
    const resolvedWrongIds = Progress.resolvedWrongQuestionIds(unitId, allQuestions);
    const wrongQuestions = allQuestions.filter((q) => wrongIds.includes(q.id));
    const reflection = Progress.getReflection(unitId, "theme");
    const memoStats = Progress.memorisationStats(unitId, (bundle.memorisation && bundle.memorisation.sentence_groups) || []);
    const selfReviewItems = rubricChecklist(bundle.rubrics);
    const savedSelfReview = Progress.getSelfReview(unitId);
    const nextStep = Progress.recommendNextStep(unitId);
    const primaryHref = wrongQuestions.length ? `#/unit/${unitId}/progress/retry-wrong` : `#${nextStep.path}`;
    const primaryLabel = wrongQuestions.length ? `先重練 ${wrongQuestions.length} 題` : nextStep.label;
    const priorityTitle = wrongQuestions.length
      ? `先把 ${wrongQuestions.length} 題待修正清掉`
      : (overall.answered ? "沒有待修正錯題，繼續建立學習證據" : "從第一組真實作答開始");
    const priorityReason = wrongQuestions.length
      ? `這些客觀題最後一次仍答錯；曾答錯紀錄會保留，即使之後答對也不會被抹去。`
      : nextStep.reason;

    const abilityRows = Object.keys(abilities)
      .map((ab) => {
        const s = abilities[ab];
        const pct = s.answered ? Math.round((s.correct / s.answered) * 100) : null;
        return `
          <article class="ability-progress-row">
            <div class="ability-progress-head">
              <div><strong>${esc(ab)}</strong><small>${s.answered}/${s.total} 題已有作答紀錄</small></div>
              <span>${pct == null ? "尚未作答" : `${s.correct}/${s.answered} 答對`}</span>
            </div>
            <div class="evidence-meter" aria-label="${esc(ab)} 已作答客觀題正確率 ${pct == null ? "尚無資料" : pct + "%"}"><span style="width:${pct == null ? 0 : pct}%;"></span></div>
          </article>`;
      })
      .join("");

    const memorisationRows = memoStats.groups
      .map((g) => {
        const clozeText = g.cloze && g.cloze.attempts
          ? `遮字最高 ${g.cloze.bestRate == null ? "—" : g.cloze.bestRate + "%"} · ${g.cloze.attempts} 次`
          : "遮字未練習";
        const reorderText = g.reorder && g.reorder.attempts
          ? (g.reorder.passed ? `重組曾排對 · ${g.reorder.attempts} 次嘗試` : `重組尚未排對 · ${g.reorder.attempts} 次嘗試`)
          : "重組未練習";
        return `
          <article class="memorisation-evidence-row">
            <div><strong>${esc(g.title)}</strong><p>${clozeText}</p></div>
            <span class="memo-status ${g.reorder && g.reorder.passed ? "is-clear" : ""}">${reorderText}</span>
          </article>`;
      })
      .join("");

    const selfReviewList = selfReviewItems
      .map((item) => `
        <label class="review-check ${savedSelfReview[item] ? "is-checked" : ""}">
          <input type="checkbox" class="self-review-check" data-review-key="${esc(item)}" ${savedSelfReview[item] ? "checked" : ""} />
          <span class="review-check-box" aria-hidden="true">${savedSelfReview[item] ? "✓" : ""}</span>
          <span>${esc(item)}</span>
        </label>`)
      .join("");

    const wrongList = wrongQuestions.length
      ? wrongQuestions.map((q, index) => {
          const bankName = bankNameForQuestion(bundle, q);
          const idx = (bundle.banks[bankName] || []).findIndex((x) => x.id === q.id);
          const link = quizLinkFor(unitId, bankName, idx, q);
          return `
            <a class="wrong-evidence-card" href="${link}">
              <span class="wrong-evidence-index">${String(index + 1).padStart(2, "0")}</span>
              <div><span class="tag">${esc(q.ability)}</span><p>${esc(q.stem.slice(0, 72))}${q.stem.length > 72 ? "…" : ""}</p></div>
              <span class="wrong-evidence-arrow" aria-hidden="true">→</span>
            </a>`;
        }).join("")
      : `<div class="progress-empty-card"><span aria-hidden="true">✓</span><div><strong>目前沒有待修正錯題</strong><p>曾答錯的歷史仍會保留；新的錯題只會按最後一次客觀題答案進入這裡。</p></div></div>`;

    App.mount(`
      <header class="progress-hero unit-progress-hero">
        <div class="progress-hero-copy">
          <p class="section-kicker">《${esc(unit.title)}》· 我的掌握</p>
          <h1 class="page-title">${priorityTitle}</h1>
          <p class="progress-hero-reason">${priorityReason}</p>
          <p class="progress-honesty-note">這頁只整理此裝置留下的作答、背誦、自評與反思紀錄；自評不計入正確率，也不代表系統判定已掌握。</p>
        </div>
        <div class="progress-hero-action">
          <span class="progress-action-label">NEXT</span>
          <a class="btn btn-primary" href="${primaryHref}">${esc(primaryLabel)} <span aria-hidden="true">→</span></a>
        </div>
      </header>

      <section class="evidence-strip" aria-label="本篇學習紀錄摘要">
        <div><span>${overall.rate == null ? "—" : overall.rate + "%"}</span><small>已作答客觀題正確率</small></div>
        <div><span>${overall.answered}</span><small>已作答客觀題</small></div>
        <div class="${wrongQuestions.length ? "needs-attention" : ""}"><span>${wrongQuestions.length}</span><small>目前待修正</small></div>
        <div><span>${resolvedWrongIds.length}</span><small>曾錯後已修正</small></div>
        <div><span>${memoStats.practisedGroups}/${memoStats.totalGroups}</span><small>已練習背誦句群</small></div>
      </section>
      <p class="evidence-footnote">正確率只計已作答、可自動批改的客觀題；未作答題及開放題不會被當作錯題。</p>

      <section class="progress-section" aria-labelledby="wrong-title">
        <div class="progress-section-heading">
          <div><p class="section-kicker">優先處理</p><h2 id="wrong-title">待修正錯題</h2></div>
          ${wrongQuestions.length ? `<a class="btn btn-primary" href="#/unit/${unitId}/progress/retry-wrong">一鍵重練 ${wrongQuestions.length} 題 →</a>` : ""}
        </div>
        <p class="progress-method-note">曾答錯 ${everWrongIds.length} 題 · 曾錯後已修正 ${resolvedWrongIds.length} 題。待修正只看最後一次客觀題答案，錯誤歷史不會因答對而刪除。</p>
        <div class="wrong-evidence-list">${wrongList}</div>
      </section>

      <section class="progress-section progress-two-column" aria-label="能力與背誦紀錄">
        <div class="progress-panel">
          <div class="progress-panel-heading"><div><p class="section-kicker">作答證據</p><h2>能力分項</h2></div></div>
          <p class="progress-method-note">只顯示已作答客觀題的答對／作答紀錄，不把比例解讀為整體能力掌握程度。</p>
          <div class="ability-progress-list">${abilityRows || `<div class="progress-empty-card compact"><span>○</span><div><strong>尚未有作答紀錄</strong><p>完成題目後才會出現能力分項。</p></div></div>`}</div>
        </div>
        <div class="progress-panel">
          <div class="progress-panel-heading"><div><p class="section-kicker">背誦證據</p><h2>背誦練習</h2></div><a class="text-link" href="#/unit/${unitId}/memorisation">前往背誦精華 →</a></div>
          <div class="mini-evidence-strip"><span><strong>${memoStats.clozePractisedGroups}</strong>做過遮字</span><span><strong>${memoStats.reorderPassedGroups}</strong>重組曾排對</span></div>
          <div class="memorisation-evidence-list">${memorisationRows || `<div class="progress-empty-card compact"><span>○</span><div><strong>本篇尚未提供背誦句群</strong></div></div>`}</div>
          <p class="progress-method-note">易錯字重溫：${memoStats.charsViewed ? "已開啟重溫" : "尚未重溫"}</p>
        </div>
      </section>

      ${selfReviewList ? `
      <section class="progress-section" aria-labelledby="review-title">
        <div class="progress-section-heading"><div><p class="section-kicker">自我判斷</p><h2 id="review-title">自我檢核</h2></div></div>
        <p class="progress-method-note">這是你自己的學習檢核，只表示「我認為自己能做到」，不計入正確率，也不會被系統當成已掌握。</p>
        <div class="review-check-grid">${selfReviewList}</div>
      </section>` : ""}

      ${reflection ? `
      <section class="reflection-evidence-card">
        <div><p class="section-kicker">我的反思</p><h2>留下來的想法</h2></div>
        <p>${esc(reflection)}</p>
      </section>` : ""}

      <div class="progress-danger-zone">
        <div><strong>本篇裝置紀錄</strong><p>清除會移除作答、背誦、自評與反思，而且無法復原。</p></div>
        <button class="btn btn-ghost" id="clear-progress-btn">清除本篇進度</button>
      </div>

      ${App.footerNav(unitId, unit.title)}
    `);

    document.querySelectorAll(".self-review-check").forEach((box) => {
      box.addEventListener("change", () => {
        Progress.setSelfReviewItem(unitId, box.dataset.reviewKey, box.checked);
        const label = box.closest(".review-check");
        if (label) {
          label.classList.toggle("is-checked", box.checked);
          const mark = label.querySelector(".review-check-box");
          if (mark) mark.textContent = box.checked ? "✓" : "";
        }
      });
    });

    document.getElementById("clear-progress-btn").addEventListener("click", () => {
      if (confirm("確定要清除《" + unit.title + "》的所有作答、背誦練習、自評檢核與反思紀錄嗎？此動作無法復原。")) {
        Progress.clearUnit(unitId);
        renderProgressPage(bundle, unitId);
      }
    });
  }
'''

content = replace_function(content, 'renderCrossUnitOverview', 'renderUnitHome', cross_unit)
content = replace_function(content, 'renderProgressPage', 'bankNameForQuestion', progress_page)

marker = '/* ===== Progress UI 2.0: learning decisions before dashboards ===== */'
if marker not in css:
    css += r'''

/* ===== Progress UI 2.0: learning decisions before dashboards ===== */
.progress-hero {
  position: relative;
  overflow: hidden;
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(220px, .55fr);
  gap: clamp(24px, 5vw, 64px);
  align-items: end;
  margin: 6px 0 18px;
  padding: clamp(28px, 5vw, 52px);
  border: 1px solid rgba(23,73,64,.12);
  border-radius: 32px;
  background:
    radial-gradient(circle at 92% 15%, rgba(111,171,151,.20), transparent 27%),
    linear-gradient(135deg, rgba(255,255,255,.95), rgba(239,244,240,.92));
  box-shadow: 0 24px 60px rgba(31,48,43,.08), inset 0 1px 0 rgba(255,255,255,.9);
}
.progress-hero::after {
  content: "";
  position: absolute;
  right: -70px;
  bottom: -100px;
  width: 250px;
  height: 250px;
  border: 1px solid rgba(23,73,64,.10);
  border-radius: 50%;
  box-shadow: 0 0 0 34px rgba(23,73,64,.035), 0 0 0 68px rgba(23,73,64,.02);
  pointer-events: none;
}
.progress-hero-copy, .progress-hero-action { position: relative; z-index: 1; }
.progress-hero .page-title {
  max-width: 720px;
  margin: 6px 0 14px;
  font-size: clamp(32px, 5vw, 54px);
  line-height: 1.08;
  letter-spacing: -.055em;
}
.progress-hero-reason {
  max-width: 700px;
  margin: 0;
  color: var(--color-ink-soft);
  font-size: 15px;
  line-height: 1.85;
}
.progress-honesty-note {
  max-width: 720px;
  margin: 15px 0 0;
  color: var(--color-ink-faint);
  font-size: 11px;
  line-height: 1.7;
}
.progress-hero-action {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 9px;
}
.progress-action-label {
  font-family: var(--font-data);
  font-size: 10px;
  font-weight: 850;
  letter-spacing: .14em;
  color: var(--color-ink-faint);
}
.progress-hero-action .btn { min-height: 48px; padding-inline: 20px; }

.evidence-strip {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  overflow: hidden;
  border: 1px solid rgba(23,73,64,.10);
  border-radius: 20px;
  background: rgba(255,255,255,.68);
  box-shadow: 0 10px 28px rgba(31,48,43,.045);
}
.evidence-strip > div {
  min-width: 0;
  padding: 17px 18px 16px;
  border-right: 1px solid rgba(23,73,64,.08);
}
.evidence-strip > div:last-child { border-right: 0; }
.evidence-strip span {
  display: block;
  color: var(--color-accent);
  font-family: var(--font-display);
  font-size: 24px;
  font-weight: 700;
  line-height: 1;
}
.evidence-strip small {
  display: block;
  margin-top: 8px;
  color: var(--color-ink-soft);
  font-size: 10px;
  font-weight: 750;
  line-height: 1.35;
}
.evidence-strip .needs-attention span { color: var(--color-reader-orange); }
.evidence-footnote, .progress-method-note {
  color: var(--color-ink-faint);
  font-size: 11px;
  line-height: 1.7;
}
.evidence-footnote { margin: 8px 4px 0; }
.progress-method-note { margin: -2px 0 14px; }

.progress-section { margin-top: 42px; }
.progress-section-heading, .progress-panel-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 13px;
}
.progress-section-heading h2, .progress-panel-heading h2, .reflection-evidence-card h2 {
  margin: 3px 0 0;
  font-family: var(--font-display);
  font-size: clamp(22px, 3vw, 30px);
  letter-spacing: -.04em;
}
.progress-section-heading .section-kicker,
.progress-panel-heading .section-kicker,
.reflection-evidence-card .section-kicker { margin: 0; }

.priority-stack { display: grid; gap: 10px; }
.priority-card {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr) auto;
  gap: 16px;
  align-items: center;
  padding: 18px 20px;
  border: 1px solid rgba(23,73,64,.10);
  border-radius: 20px;
  background: rgba(255,255,255,.72);
  transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease;
}
.priority-card:hover { transform: translateY(-2px); border-color: rgba(23,73,64,.22); box-shadow: 0 16px 36px rgba(31,48,43,.07); }
.priority-card.is-primary {
  padding-block: 22px;
  border-color: rgba(23,73,64,.18);
  background: linear-gradient(135deg, rgba(23,73,64,.98), rgba(13,56,50,.96));
  color: #fff;
}
.priority-rank {
  color: var(--color-ink-faint);
  font-family: var(--font-data);
  font-size: 13px;
  font-weight: 850;
}
.priority-card.is-primary .priority-rank { color: rgba(255,255,255,.5); }
.priority-heading { display: flex; justify-content: space-between; gap: 15px; align-items: flex-start; }
.priority-kicker { display: block; margin-bottom: 4px; color: var(--color-ink-faint); font-size: 9px; font-weight: 850; letter-spacing: .09em; }
.priority-card.is-primary .priority-kicker { color: rgba(255,255,255,.56); }
.priority-heading h3 { margin: 0; font-family: var(--font-display); font-size: 19px; }
.priority-heading h3 small { margin-left: 7px; color: var(--color-ink-soft); font-family: var(--font-body); font-size: 11px; font-weight: 600; }
.priority-card.is-primary h3 small { color: rgba(255,255,255,.6); }
.priority-copy > p { margin: 7px 0 0; color: var(--color-ink-soft); font-size: 11px; line-height: 1.55; }
.priority-card.is-primary .priority-copy > p { color: rgba(255,255,255,.68); }
.priority-count { min-width: 50px; color: var(--color-reader-orange); font-family: var(--font-display); font-size: 22px; font-weight: 750; text-align: right; }
.priority-count small { display: block; color: var(--color-ink-faint); font-family: var(--font-body); font-size: 8px; font-weight: 750; }
.priority-card.is-primary .priority-count small { color: rgba(255,255,255,.52); }
.priority-card.is-primary .btn-primary { background: #fff; color: var(--color-accent-strong); }

.progress-empty-card {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  padding: 22px;
  border: 1px dashed rgba(23,73,64,.18);
  border-radius: 18px;
  background: rgba(255,255,255,.5);
}
.progress-empty-card > span { color: var(--color-accent); font-family: var(--font-display); font-size: 24px; line-height: 1; }
.progress-empty-card strong { font-size: 13px; }
.progress-empty-card p { margin: 4px 0 0; color: var(--color-ink-soft); font-size: 11px; line-height: 1.55; }
.progress-empty-card.compact { padding: 16px; }
.progress-empty-card.wide { grid-column: 1 / -1; }

.ability-evidence-list { overflow: hidden; border: 1px solid rgba(23,73,64,.10); border-radius: 20px; background: rgba(255,255,255,.66); }
.ability-evidence-row {
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr) auto;
  gap: 13px;
  align-items: center;
  padding: 16px 18px;
  border-bottom: 1px solid rgba(23,73,64,.075);
}
.ability-evidence-row:last-child { border-bottom: 0; }
.ability-rank { color: var(--color-ink-faint); font-family: var(--font-data); font-size: 10px; font-weight: 850; }
.ability-evidence-copy strong { font-size: 13px; }
.ability-evidence-copy p { margin: 4px 0 0; color: var(--color-ink-soft); font-size: 11px; }
.ability-evidence-copy small { display: block; margin-top: 3px; color: var(--color-ink-faint); font-size: 10px; }
.evidence-resolved { color: var(--color-jade); font-size: 10px; font-weight: 800; }

.unit-evidence-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.unit-evidence-card {
  padding: 20px;
  border: 1px solid rgba(23,73,64,.10);
  border-radius: 20px;
  background: rgba(255,255,255,.68);
}
.unit-evidence-head { display: flex; justify-content: space-between; gap: 15px; align-items: flex-start; }
.unit-evidence-head h3 { margin: 0; font-family: var(--font-display); font-size: 17px; }
.unit-evidence-head p { margin: 3px 0 0; color: var(--color-ink-faint); font-size: 10px; }
.unit-evidence-status { padding: 5px 8px; border-radius: 999px; background: var(--color-jade-soft); color: var(--color-jade); font-size: 9px; font-weight: 800; }
.unit-evidence-status.needs-work { background: rgba(184,89,64,.10); color: var(--color-reader-orange); }
.unit-evidence-metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 7px; margin-top: 18px; }
.unit-evidence-metrics span { color: var(--color-ink-faint); font-size: 9px; line-height: 1.35; }
.unit-evidence-metrics strong { display: block; margin-bottom: 3px; color: var(--color-ink); font-family: var(--font-display); font-size: 18px; }
.unit-evidence-actions { display: flex; gap: 7px; flex-wrap: wrap; margin-top: 17px; }
.unit-evidence-actions .btn { padding: 8px 13px; font-size: 11px; }

.wrong-evidence-list { display: grid; gap: 8px; }
.wrong-evidence-card {
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr) 24px;
  gap: 12px;
  align-items: center;
  padding: 15px 18px;
  border: 1px solid rgba(23,73,64,.10);
  border-radius: 18px;
  background: rgba(255,255,255,.7);
  transition: transform .16s ease, border-color .16s ease, box-shadow .16s ease;
}
.wrong-evidence-card:hover { transform: translateY(-1px); border-color: rgba(23,73,64,.24); box-shadow: 0 12px 26px rgba(31,48,43,.055); }
.wrong-evidence-index { color: var(--color-ink-faint); font-family: var(--font-data); font-size: 10px; font-weight: 850; }
.wrong-evidence-card p { margin: 7px 0 0; color: var(--color-ink); font-size: 12px; line-height: 1.55; }
.wrong-evidence-arrow { color: var(--color-accent); font-size: 16px; }

.progress-two-column { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; align-items: start; }
.progress-panel {
  min-width: 0;
  padding: 22px;
  border: 1px solid rgba(23,73,64,.10);
  border-radius: 22px;
  background: rgba(255,255,255,.67);
}
.progress-panel-heading { align-items: flex-start; margin-bottom: 8px; }
.progress-panel-heading h2 { font-size: 23px; }
.text-link { color: var(--color-accent); font-size: 10px; font-weight: 800; }
.ability-progress-list { display: grid; gap: 14px; margin-top: 16px; }
.ability-progress-row { padding-bottom: 13px; border-bottom: 1px solid rgba(23,73,64,.075); }
.ability-progress-row:last-child { padding-bottom: 0; border-bottom: 0; }
.ability-progress-head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
.ability-progress-head strong { display: block; font-size: 12px; }
.ability-progress-head small, .ability-progress-head > span { color: var(--color-ink-faint); font-size: 9px; }
.ability-progress-head small { display: block; margin-top: 3px; }
.evidence-meter { overflow: hidden; height: 5px; margin-top: 8px; border-radius: 999px; background: rgba(23,73,64,.08); }
.evidence-meter span { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--color-accent), #72A894); }

.mini-evidence-strip { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; margin: 14px 0; }
.mini-evidence-strip span { padding: 10px 11px; border-radius: 13px; background: rgba(23,73,64,.055); color: var(--color-ink-soft); font-size: 9px; }
.mini-evidence-strip strong { display: block; margin-bottom: 3px; color: var(--color-accent); font-family: var(--font-display); font-size: 18px; }
.memorisation-evidence-list { display: grid; gap: 0; }
.memorisation-evidence-row { display: flex; justify-content: space-between; gap: 14px; padding: 12px 0; border-bottom: 1px solid rgba(23,73,64,.075); }
.memorisation-evidence-row:last-child { border-bottom: 0; }
.memorisation-evidence-row strong { font-size: 11px; }
.memorisation-evidence-row p { margin: 3px 0 0; color: var(--color-ink-faint); font-size: 9px; }
.memo-status { align-self: center; color: var(--color-reader-orange); font-size: 9px; text-align: right; }
.memo-status.is-clear { color: var(--color-jade); }

.review-check-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.review-check { display: flex; gap: 10px; align-items: flex-start; padding: 13px 14px; border: 1px solid rgba(23,73,64,.10); border-radius: 15px; background: rgba(255,255,255,.58); cursor: pointer; color: var(--color-ink-soft); font-size: 11px; line-height: 1.55; }
.review-check input { position: absolute; opacity: 0; pointer-events: none; }
.review-check-box { display: grid; place-items: center; flex: 0 0 20px; width: 20px; height: 20px; margin-top: 1px; border: 1px solid rgba(23,73,64,.18); border-radius: 7px; background: #fff; color: #fff; font-size: 10px; }
.review-check.is-checked { border-color: rgba(23,73,64,.22); background: rgba(23,73,64,.055); color: var(--color-ink); }
.review-check.is-checked .review-check-box { border-color: var(--color-accent); background: var(--color-accent); }

.reflection-evidence-card { margin-top: 36px; padding: 24px; border-left: 3px solid var(--color-reader-orange); border-radius: 0 18px 18px 0; background: rgba(255,255,255,.55); }
.reflection-evidence-card h2 { font-size: 22px; }
.reflection-evidence-card > p { margin: 14px 0 0; white-space: pre-wrap; color: var(--color-ink-soft); font-family: var(--font-display); font-size: 14px; line-height: 1.85; }

.progress-danger-zone { display: flex; justify-content: space-between; gap: 18px; align-items: center; margin-top: 40px; padding-top: 18px; border-top: 1px solid rgba(23,73,64,.10); }
.progress-danger-zone strong { font-size: 11px; }
.progress-danger-zone p { margin: 4px 0 0; color: var(--color-ink-faint); font-size: 9px; }
.progress-danger-zone .btn { color: var(--color-error); font-size: 10px; }

@media (max-width: 760px) {
  .progress-hero { grid-template-columns: 1fr; gap: 24px; padding: 26px 22px; border-radius: 24px; }
  .progress-hero .page-title { font-size: clamp(30px, 9vw, 42px); }
  .progress-hero-action { align-items: stretch; }
  .progress-hero-action .btn { width: 100%; }
  .evidence-strip { grid-template-columns: repeat(2, 1fr); }
  .evidence-strip > div { border-bottom: 1px solid rgba(23,73,64,.08); }
  .evidence-strip > div:nth-child(2n) { border-right: 0; }
  .evidence-strip > div:last-child { border-bottom: 0; }
  .progress-section { margin-top: 34px; }
  .progress-section-heading { align-items: flex-start; flex-direction: column; }
  .progress-section-heading .btn { width: 100%; }
  .priority-card { grid-template-columns: 30px minmax(0, 1fr); padding: 17px; }
  .priority-card > .btn { grid-column: 1 / -1; width: 100%; }
  .priority-heading { gap: 8px; }
  .priority-heading h3 { font-size: 17px; }
  .ability-evidence-row { grid-template-columns: 26px minmax(0, 1fr); padding: 14px; }
  .ability-evidence-row > .btn, .ability-evidence-row > .evidence-resolved { grid-column: 2; justify-self: start; }
  .unit-evidence-grid, .progress-two-column, .review-check-grid { grid-template-columns: 1fr; }
  .unit-evidence-metrics { gap: 5px; }
  .wrong-evidence-card { grid-template-columns: 28px minmax(0, 1fr) 18px; padding: 14px; }
  .progress-panel { padding: 18px; }
  .memorisation-evidence-row { flex-direction: column; gap: 4px; }
  .memo-status { align-self: flex-start; text-align: left; }
  .progress-danger-zone { align-items: flex-start; flex-direction: column; }
}

@media (prefers-reduced-motion: reduce) {
  .priority-card, .wrong-evidence-card { transition: none !important; }
}
'''

old_smoke = '''  const savedProgress = await page.evaluate(() => localStorage.getItem("ccsl_progress_v1"));
  check(!!savedProgress, "submitting a real browser quiz answer should persist local progress");

  await page.evaluate(() => { window.location.hash = "#/unit/yueyanglouji/memorisation"; });'''
new_smoke = '''  const savedProgress = await page.evaluate(() => localStorage.getItem("ccsl_progress_v1"));
  check(!!savedProgress, "submitting a real browser quiz answer should persist local progress");

  await page.evaluate(() => { window.location.hash = "#/unit/yueyanglouji/progress"; });
  await waitForTitle(page, "待修正");
  check(await page.locator(".unit-progress-hero").count() === 1, "unit progress should render the learning-decision hero");
  check(await page.locator(".evidence-strip").count() === 1, "unit progress should render an evidence summary strip");

  await page.evaluate(() => { window.location.hash = "#/overview"; });
  await page.locator(".overview-hero").waitFor({ state: "visible", timeout: 5000 });
  check(await page.locator(".priority-stack").count() === 1, "cross-unit overview should render priority learning actions");

  await page.evaluate(() => { window.location.hash = "#/unit/yueyanglouji/memorisation"; });'''
if old_smoke not in smoke:
    raise SystemExit('browser smoke insertion anchor missing')
smoke = smoke.replace(old_smoke, new_smoke, 1)

old_mobile = '''  const quizOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(quizOverflow <= 1, `mobile quiz has horizontal overflow of ${quizOverflow}px`);

  console.log(`Browser smoke metrics:'''
new_mobile = '''  const quizOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(quizOverflow <= 1, `mobile quiz has horizontal overflow of ${quizOverflow}px`);
  await page.evaluate(() => { window.location.hash = "#/unit/yueyanglouji/progress"; });
  await page.locator(".unit-progress-hero").waitFor({ state: "visible", timeout: 5000 });
  const progressOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(progressOverflow <= 1, `mobile unit progress has horizontal overflow of ${progressOverflow}px`);
  await page.evaluate(() => { window.location.hash = "#/overview"; });
  await page.locator(".overview-hero").waitFor({ state: "visible", timeout: 5000 });
  const overviewOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(overviewOverflow <= 1, `mobile cross-unit overview has horizontal overflow of ${overviewOverflow}px`);

  console.log(`Browser smoke metrics:'''
if old_mobile not in smoke:
    raise SystemExit('mobile smoke insertion anchor missing')
smoke = smoke.replace(old_mobile, new_mobile, 1)

content_path.write_text(content, encoding='utf-8')
css_path.write_text(css, encoding='utf-8')
smoke_path.write_text(smoke, encoding='utf-8')
