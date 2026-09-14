from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 match, found {count}")
    return text.replace(old, new, 1)

# progress.js — aggregate objective-question evidence across units without inventing a mastery score.
path = Path("js/progress.js")
text = path.read_text()
text = replace_once(
    text,
    '''  function overallAccuracy(unitId, allQuestions) {
    const answers = getAllAnswers(unitId);
    let answered = 0, correct = 0;
    allQuestions.forEach((q) => {
      if (!isObjectiveQuestion(q)) return;
      const rec = answers[q.id];
      if (rec && rec.answered) {
        answered += 1;
        if (rec.isCorrect) correct += 1;
      }
    });
    return { answered, correct, rate: answered ? Math.round((correct / answered) * 100) : null };
  }

  return {''',
    '''  function overallAccuracy(unitId, allQuestions) {
    const answers = getAllAnswers(unitId);
    let answered = 0, correct = 0;
    allQuestions.forEach((q) => {
      if (!isObjectiveQuestion(q)) return;
      const rec = answers[q.id];
      if (rec && rec.answered) {
        answered += 1;
        if (rec.isCorrect) correct += 1;
      }
    });
    return { answered, correct, rate: answered ? Math.round((correct / answered) * 100) : null };
  }

  function crossUnitOverview(unitInputs = []) {
    const all = loadAll();
    const abilities = {};
    const units = [];
    let totalAnswered = 0;
    let totalCurrentWrong = 0;
    let totalEverWrong = 0;
    let totalResolvedWrong = 0;
    let engagedUnits = 0;

    (unitInputs || []).forEach((input) => {
      const unitId = input.unitId;
      const questions = input.questions || [];
      const raw = all[unitId] && typeof all[unitId] === "object" ? all[unitId] : {};
      const unit = ensureUnitShape(raw);
      const answers = unit.answers || {};
      const evidenceAt = unitEvidenceTimestamp(unit);
      let answered = 0;
      let currentWrong = 0;
      let everWrong = 0;
      let resolvedWrong = 0;
      let repeatedWrongQuestions = 0;
      let wrongAttempts = 0;

      questions.forEach((q) => {
        if (!isObjectiveQuestion(q)) return;
        const rec = answers[q.id];
        if (!rec || !rec.answered) return;
        answered += 1;
        const wrongCount = Number(rec.wrongAttempts) || (rec.isCorrect === false ? 1 : 0);
        const historicalWrong = rec.everWrong === true || wrongCount > 0 || rec.isCorrect === false;
        const unresolved = rec.isCorrect === false;
        const resolved = historicalWrong && rec.isCorrect === true;

        if (historicalWrong) everWrong += 1;
        if (unresolved) currentWrong += 1;
        if (resolved) resolvedWrong += 1;
        if (wrongCount >= 2) repeatedWrongQuestions += 1;
        wrongAttempts += wrongCount;

        if (historicalWrong) {
          const ability = q.ability || "其他";
          if (!abilities[ability]) {
            abilities[ability] = {
              ability,
              currentWrongQuestions: 0,
              everWrongQuestions: 0,
              resolvedWrongQuestions: 0,
              repeatedWrongQuestions: 0,
              wrongAttempts: 0,
              currentWrongUnits: new Set(),
              everWrongUnits: new Set()
            };
          }
          const stat = abilities[ability];
          stat.everWrongQuestions += 1;
          stat.wrongAttempts += wrongCount;
          stat.everWrongUnits.add(unitId);
          if (unresolved) {
            stat.currentWrongQuestions += 1;
            stat.currentWrongUnits.add(unitId);
          }
          if (resolved) stat.resolvedWrongQuestions += 1;
          if (wrongCount >= 2) stat.repeatedWrongQuestions += 1;
        }
      });

      if (evidenceAt > 0) engagedUnits += 1;
      totalAnswered += answered;
      totalCurrentWrong += currentWrong;
      totalEverWrong += everWrong;
      totalResolvedWrong += resolvedWrong;
      units.push({
        unitId,
        title: input.title || unitId,
        author: input.author || "",
        answered,
        currentWrong,
        everWrong,
        resolvedWrong,
        repeatedWrongQuestions,
        wrongAttempts,
        evidenceAt,
        hasEvidence: evidenceAt > 0 || answered > 0
      });
    });

    const abilityRows = Object.values(abilities).map((stat) => ({
      ability: stat.ability,
      currentWrongQuestions: stat.currentWrongQuestions,
      everWrongQuestions: stat.everWrongQuestions,
      resolvedWrongQuestions: stat.resolvedWrongQuestions,
      repeatedWrongQuestions: stat.repeatedWrongQuestions,
      wrongAttempts: stat.wrongAttempts,
      currentWrongUnits: stat.currentWrongUnits.size,
      everWrongUnits: stat.everWrongUnits.size
    })).sort((a, b) =>
      b.currentWrongQuestions - a.currentWrongQuestions ||
      b.wrongAttempts - a.wrongAttempts ||
      b.everWrongQuestions - a.everWrongQuestions ||
      a.ability.localeCompare(b.ability)
    );

    const priorityUnits = units.filter((u) => u.currentWrong > 0).sort((a, b) =>
      b.currentWrong - a.currentWrong ||
      b.repeatedWrongQuestions - a.repeatedWrongQuestions ||
      b.wrongAttempts - a.wrongAttempts ||
      b.evidenceAt - a.evidenceAt
    );

    return {
      engagedUnits,
      totalUnits: units.length,
      totalAnswered,
      totalCurrentWrong,
      totalEverWrong,
      totalResolvedWrong,
      abilities: abilityRows,
      priorityUnits,
      units
    };
  }

  return {''',
    'cross-unit overview aggregation'
)
text = replace_once(
    text,
    '''    clearUnit, abilityStats, wrongQuestionIds, everWrongQuestionIds, resolvedWrongQuestionIds, overallAccuracy
  };''',
    '''    clearUnit, abilityStats, wrongQuestionIds, everWrongQuestionIds, resolvedWrongQuestionIds, overallAccuracy,
    crossUnitOverview
  };''',
    'cross-unit overview export'
)
path.write_text(text)

# app.js — add a lightweight home entry and load all banks only on the explicit overview route.
path = Path("js/app.js")
text = path.read_text()
text = replace_once(
    text,
    '''    const cards = curriculum.units
      .map((u) => {''',
    '''    const overviewCard = `
      <div class="card" style="margin-bottom:24px;">
        <div class="section-title"><span class="seal">總</span>跨篇章學習總覽</div>
        <p style="margin:0 0 14px; color:var(--color-ink-soft); font-size:13px; line-height:1.7;">集中查看各篇待修正錯題、曾答錯後已修正的題目，以及錯題較集中的能力範疇。總覽只在你開啟時才載入各篇題庫。</p>
        <a class="btn btn-secondary" href="#/overview">查看跨篇章總覽 →</a>
      </div>`;

    const cards = curriculum.units
      .map((u) => {''',
    'home overview entry state'
)
text = replace_once(
    text,
    '''      ${continueCard}
      <div class="map-grid">${cards}</div>''',
    '''      ${continueCard}
      ${overviewCard}
      <div class="map-grid">${cards}</div>''',
    'home overview entry render'
)
text = replace_once(
    text,
    '''  async function withUnitBundle(unitId, options, onReady) {''',
    '''  async function pageOverview() {
    setCrumb("跨篇章學習總覽");
    renderLoading("跨篇章學習總覽");
    try {
      const curriculum = await loadCurriculum();
      const available = (curriculum.units || []).filter((u) => u.status === "available");
      const unitBundles = await Promise.all(available.map(async (entry) => ({
        entry,
        bundle: await loadUnitBundle(entry.id, { allQuestionBanks: true })
      })));
      ContentRenderer.renderCrossUnitOverview(curriculum, unitBundles);
    } catch (e) {
      renderFatalError(e.message);
    }
  }

  async function withUnitBundle(unitId, options, onReady) {''',
    'overview route loader'
)
text = replace_once(
    text,
    '''    Router.register("/", pageHome);
    Router.register("/unit/:unitId", pageUnitHome);''',
    '''    Router.register("/", pageHome);
    Router.register("/overview", pageOverview);
    Router.register("/unit/:unitId", pageUnitHome);''',
    'overview route registration'
)
path.write_text(text)

# content-renderer.js — render transparent cross-unit evidence rather than a synthetic mastery score.
path = Path("js/content-renderer.js")
text = path.read_text()
text = replace_once(
    text,
    '''  function renderUnitHome(bundle, unitId) {''',
    '''  function renderCrossUnitOverview(curriculum, unitBundles) {
    const inputs = (unitBundles || []).map(({ entry, bundle }) => ({
      unitId: entry.id,
      title: entry.title,
      author: entry.author,
      questions: bundle.allQuestions || []
    }));
    const overview = Progress.crossUnitOverview(inputs);
    const unitsWithEvidence = overview.units.filter((u) => u.hasEvidence || u.everWrong > 0);

    const priorityHTML = overview.priorityUnits.length
      ? overview.priorityUnits.slice(0, 5).map((u, index) => `
        <div class="card card-tight" style="margin-bottom:10px;">
          <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start; flex-wrap:wrap;">
            <div>
              <span class="tag">優先 ${index + 1}</span>
              <strong style="margin-left:6px;">《${esc(u.title)}》</strong>
              ${u.author ? `<span style="color:var(--color-ink-soft); font-size:13px;"> · ${esc(u.author)}</span>` : ""}
              <p style="margin:8px 0 0; color:var(--color-ink-soft); font-size:13px;">待修正 ${u.currentWrong} 題 · 曾答錯 ${u.everWrong} 題 · 累積答錯 ${u.wrongAttempts} 次${u.repeatedWrongQuestions ? ` · ${u.repeatedWrongQuestions} 題曾重複答錯` : ""}</p>
            </div>
            <a class="btn btn-primary" href="#/unit/${u.unitId}/progress/retry-wrong">重練待修正錯題 →</a>
          </div>
        </div>`).join("")
      : `<p class="empty-state" style="padding:20px;">目前沒有最後一次仍答錯的客觀題；如有歷史錯題，可在各篇「我的掌握」中查看已修正紀錄。</p>`;

    const abilityHTML = overview.abilities.length
      ? overview.abilities.slice(0, 10).map((a) => `
        <div style="padding:10px 0; border-bottom:1px solid var(--color-border);">
          <div style="display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap; font-size:14px;">
            <strong>${esc(a.ability)}</strong>
            <span style="color:var(--color-ink-soft);">待修正 ${a.currentWrongQuestions} 題 · 曾答錯 ${a.everWrongQuestions} 題 · 累積答錯 ${a.wrongAttempts} 次</span>
          </div>
          <p style="margin:5px 0 0; color:var(--color-ink-faint); font-size:12px;">涉及 ${a.everWrongUnits} 篇${a.currentWrongUnits ? `；其中 ${a.currentWrongUnits} 篇仍有待修正題目` : ""}${a.repeatedWrongQuestions ? `；${a.repeatedWrongQuestions} 題曾重複答錯` : ""}</p>
        </div>`).join("")
      : `<p class="empty-state" style="padding:20px;">尚未有可用的客觀題錯題紀錄。</p>`;

    const unitHTML = unitsWithEvidence.length
      ? unitsWithEvidence.sort((a, b) =>
          b.currentWrong - a.currentWrong ||
          b.everWrong - a.everWrong ||
          b.evidenceAt - a.evidenceAt
        ).map((u) => `
          <div class="card card-tight">
            <div style="display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap; align-items:flex-start;">
              <div>
                <strong>《${esc(u.title)}》</strong>
                ${u.author ? `<span style="color:var(--color-ink-soft); font-size:13px;"> · ${esc(u.author)}</span>` : ""}
                <p style="margin:8px 0 0; font-size:13px; color:var(--color-ink-soft);">已作答客觀題 ${u.answered} · 待修正 ${u.currentWrong} · 曾答錯 ${u.everWrong} · 已修正 ${u.resolvedWrong}</p>
              </div>
              <div class="btn-row" style="margin:0;">
                ${u.currentWrong ? `<a class="btn btn-primary" href="#/unit/${u.unitId}/progress/retry-wrong">重練錯題</a>` : ""}
                <a class="btn btn-secondary" href="#/unit/${u.unitId}/progress">查看掌握</a>
              </div>
            </div>
          </div>`).join("")
      : `<div class="card"><p class="empty-state" style="padding:20px;">這部裝置尚未有跨篇章學習紀錄。先選一篇開始學習及作答，之後這裡會整理真實紀錄。</p></div>`;

    App.mount(`
      <h1 class="page-title">跨篇章學習總覽</h1>
      <p class="page-subtitle">整合這部裝置上的客觀題作答紀錄；不產生虛假的總掌握百分比。</p>

      <div class="card">
        <div class="stat-grid">
          <div class="stat-card"><div class="stat-value">${overview.engagedUnits}/${overview.totalUnits}</div><div class="stat-label">有學習活動紀錄篇章</div></div>
          <div class="stat-card"><div class="stat-value">${overview.totalAnswered}</div><div class="stat-label">已作答客觀題</div></div>
          <div class="stat-card"><div class="stat-value">${overview.totalCurrentWrong}</div><div class="stat-label">目前待修正</div></div>
          <div class="stat-card"><div class="stat-value">${overview.totalResolvedWrong}</div><div class="stat-label">曾錯後已修正</div></div>
        </div>
        <p style="font-size:12px; color:var(--color-ink-soft); margin:12px 0 0;">「有學習活動」只表示這部裝置曾留下作答、背誦、自評或反思紀錄，不代表完成或掌握該篇。</p>
      </div>

      <div class="section-title"><span class="seal">先</span>建議優先重溫</div>
      <p style="font-size:13px; color:var(--color-ink-soft); margin:-4px 0 12px;">排序規則：待修正錯題數 → 重複答錯題數 → 累積答錯次數 → 最近學習活動。這是整理紀錄，不是能力評分。</p>
      ${priorityHTML}

      <div class="card" style="margin-top:24px;">
        <div class="section-title"><span class="seal">能</span>錯題集中能力範疇</div>
        <p style="font-size:13px; color:var(--color-ink-soft); margin:0 0 10px;">按目前待修正題數及歷史答錯次數排列。「累積答錯次數」可包含同一題多次答錯。</p>
        ${abilityHTML}
      </div>

      <div class="section-title" style="margin-top:28px;"><span class="seal">篇</span>各篇紀錄</div>
      <div class="module-grid">${unitHTML}</div>
      ${App.footerNav(null, null)}
    `);
  }

  function renderUnitHome(bundle, unitId) {''',
    'cross-unit overview renderer'
)
text = replace_once(
    text,
    '''  return {
    renderUnitHome, renderTextPage, renderWordsPage, renderComprehensionPage,
    renderAnalysisPage, renderThemePage, renderCrossTextPage, renderProgressPage
  };''',
    '''  return {
    renderCrossUnitOverview,
    renderUnitHome, renderTextPage, renderWordsPage, renderComprehensionPage,
    renderAnalysisPage, renderThemePage, renderCrossTextPage, renderProgressPage
  };''',
    'cross-unit overview renderer export'
)
path.write_text(text)

# loading validator — require aggregate banks only on the explicit overview route, not home.
path = Path("scripts/validate-loading.mjs")
text = path.read_text()
text = replace_once(
    text,
    '''requireText("allQuestionBanks: true", "full question-bank loading for aggregate views");''',
    '''requireText("allQuestionBanks: true", "full question-bank loading for aggregate views");
requireText('bundle: await loadUnitBundle(entry.id, { allQuestionBanks: true })', "on-demand cross-unit overview loading");
requireText('Router.register("/overview", pageOverview)', "dedicated cross-unit overview route");''',
    'overview lazy-loading contract'
)
path.write_text(text)
