from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 match, found {count}")
    return text.replace(old, new, 1)

# progress.js — one shared selector for unresolved objective questions across units.
path = Path("js/progress.js")
text = path.read_text()
marker = '''  function overallAccuracy(unitId, allQuestions) {'''
insert = '''  function crossUnitWrongItems(unitInputs = [], ability = null) {
    const all = loadAll();
    const targetAbility = ability && ability !== "all" ? ability : null;
    const items = [];

    (unitInputs || []).forEach((input, unitIndex) => {
      const unitId = input.unitId;
      const raw = all[unitId] && typeof all[unitId] === "object" ? all[unitId] : {};
      const unit = ensureUnitShape(raw);
      const answers = unit.answers || {};
      (input.questions || []).forEach((q, questionIndex) => {
        if (!isObjectiveQuestion(q)) return;
        if (targetAbility && q.ability !== targetAbility) return;
        const rec = answers[q.id];
        if (!rec || !rec.answered || rec.isCorrect !== false) return;
        items.push({
          unitId,
          title: input.title || unitId,
          author: input.author || "",
          question: q,
          wrongAttempts: Number(rec.wrongAttempts) || 1,
          lastWrongAt: Number(rec.lastWrongAt || rec.timestamp) || 0,
          unitIndex,
          questionIndex
        });
      });
    });

    return items.sort((a, b) =>
      b.wrongAttempts - a.wrongAttempts ||
      b.lastWrongAt - a.lastWrongAt ||
      a.unitIndex - b.unitIndex ||
      a.questionIndex - b.questionIndex
    );
  }

'''
text = replace_once(text, marker, insert + marker, "cross-unit wrong selector")
text = replace_once(
    text,
    '''    crossUnitOverview
  };''',
    '''    crossUnitOverview, crossUnitWrongItems
  };''',
    "cross-unit wrong selector export"
)
path.write_text(text)

# question-engine.js — render one fresh cross-unit retry sequence while saving back to each source unit.
path = Path("js/question-engine.js")
text = path.read_text()
text = replace_once(
    text,
    '''  function renderQuestionShell({ unitId, bundle, question, title, indexLabel, onPrev, onNext, backHref, onAfterConfirm, showRemediation, extraNav, loadRecord, saveRecord }) {''',
    '''  function renderQuestionShell({ unitId, bundle, question, title, indexLabel, onPrev, onNext, backHref, backLabel, onAfterConfirm, showRemediation, extraNav, loadRecord, saveRecord }) {''',
    "question shell back label parameter"
)
text = replace_once(
    text,
    '''              <a class="btn btn-ghost" href="${backHref}">返回《${esc(bundle.unit.title)}》</a>''',
    '''              <a class="btn btn-ghost" href="${backHref}">${backLabel ? esc(backLabel) : `返回《${esc(bundle.unit.title)}》`}</a>''',
    "question shell back label render"
)
marker = '''  // ---------- 核心篇章挑戰 attempt ----------'''
insert = '''  // ---------- 跨篇章針對性錯題重練 ----------
  function renderCrossUnitWrongRetry(unitBundles, ability = null) {
    const inputs = (unitBundles || []).map(({ entry, bundle }) => ({
      unitId: entry.id,
      title: entry.title,
      author: entry.author,
      questions: bundle.allQuestions || []
    }));
    const retryItems = Progress.crossUnitWrongItems(inputs, ability);
    const targetLabel = ability || "全部能力";

    if (!retryItems.length) {
      App.mount(`
        <h1 class="page-title">跨篇章錯題重練</h1>
        <div class="card">
          <div class="section-title"><span class="seal">清</span>${esc(targetLabel)}目前沒有待修正錯題</div>
          <p style="margin:0; color:var(--color-ink-soft);">這裡只納入最後一次仍答錯、且可自動批改的客觀題；歷史錯題仍保留在各篇「我的掌握」。</p>
        </div>
        <a class="btn btn-primary" href="#/overview">返回跨篇章總覽 →</a>
        ${App.footerNav(null, null)}
      `);
      return;
    }

    let idx = 0;
    const initialKeys = new Set(retryItems.map((item) => `${item.unitId}::${item.question.id}`));
    const initialCount = retryItems.length;

    function currentRemaining() {
      return Progress.crossUnitWrongItems(inputs, ability);
    }

    function renderCompletion() {
      const remaining = currentRemaining();
      const remainingFromRound = remaining.filter((item) => initialKeys.has(`${item.unitId}::${item.question.id}`)).length;
      const resolved = initialCount - remainingFromRound;
      App.mount(`
        <h1 class="page-title">跨篇章重練完成</h1>
        <p class="page-subtitle">${esc(targetLabel)} · 本輪結果</p>
        <div class="card">
          <div class="stat-grid">
            <div class="stat-card"><div class="stat-value">${initialCount}</div><div class="stat-label">本輪題數</div></div>
            <div class="stat-card"><div class="stat-value">${resolved}</div><div class="stat-label">本輪已修正</div></div>
            <div class="stat-card"><div class="stat-value">${remaining.length}</div><div class="stat-label">此範圍仍待修正</div></div>
          </div>
          <p style="font-size:13px; color:var(--color-ink-soft); margin:12px 0 0;">答對只會移出目前待修正清單；曾答錯次數及歷史仍保留在原篇章紀錄。</p>
        </div>
        <div class="btn-row">
          ${remaining.length ? `<a class="btn btn-primary" href="#/overview/retry/${encodeURIComponent(ability || "all")}">再練仍錯題 →</a>` : ""}
          <a class="btn btn-secondary" href="#/overview">返回跨篇章總覽</a>
        </div>
        ${App.footerNav(null, null)}
      `);
    }

    function renderAt(i) {
      idx = i;
      const item = retryItems[idx];
      const source = (unitBundles || []).find(({ entry }) => entry.id === item.unitId);
      if (!source) {
        if (idx < retryItems.length - 1) renderAt(idx + 1);
        else renderCompletion();
        return;
      }
      const q = item.question;
      renderQuestionShell({
        unitId: item.unitId,
        bundle: source.bundle,
        question: q,
        title: `跨篇章錯題重練 · ${targetLabel}`,
        indexLabel: `《${source.entry.title}》 · 第 ${idx + 1} 題，共 ${retryItems.length} 題`,
        onPrev: idx > 0 ? () => renderAt(idx - 1) : null,
        onNext: idx < retryItems.length - 1 ? () => renderAt(idx + 1) : null,
        backHref: "#/overview",
        backLabel: "返回跨篇章總覽",
        showRemediation: true,
        loadRecord: () => null,
        saveRecord: (questionId, record) => Progress.recordAnswer(item.unitId, questionId, record),
        onAfterConfirm: () => {
          if (idx < retryItems.length - 1) renderAt(idx + 1);
          else renderCompletion();
        }
      });
    }

    renderAt(0);
  }

'''
text = replace_once(text, marker, insert + marker, "cross-unit retry renderer")
text = replace_once(
    text,
    '''  return { renderQuizSequence, renderWrongRetry, renderChallengeSetup, renderChallengeRun, renderChallengeResult };''',
    '''  return { renderQuizSequence, renderWrongRetry, renderCrossUnitWrongRetry, renderChallengeSetup, renderChallengeRun, renderChallengeResult };''',
    "cross-unit retry renderer export"
)
path.write_text(text)

# app.js — reuse the aggregate bundle loader for overview and targeted retry routes.
path = Path("js/app.js")
text = path.read_text()
old = '''  async function pageOverview() {
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
'''
new = '''  async function loadCrossUnitBundles() {
    const curriculum = await loadCurriculum();
    const available = (curriculum.units || []).filter((u) => u.status === "available");
    const unitBundles = await Promise.all(available.map(async (entry) => ({
      entry,
      bundle: await loadUnitBundle(entry.id, { allQuestionBanks: true })
    })));
    return { curriculum, unitBundles };
  }

  async function pageOverview() {
    setCrumb("跨篇章學習總覽");
    renderLoading("跨篇章學習總覽");
    try {
      const { curriculum, unitBundles } = await loadCrossUnitBundles();
      ContentRenderer.renderCrossUnitOverview(curriculum, unitBundles);
    } catch (e) {
      renderFatalError(e.message);
    }
  }

  async function pageCrossUnitRetry(params) {
    const ability = params.ability === "all" ? null : params.ability;
    setCrumb(ability ? `${ability} · 跨篇章重練` : "跨篇章錯題重練");
    renderLoading("跨篇章錯題重練");
    try {
      const { unitBundles } = await loadCrossUnitBundles();
      QuestionEngine.renderCrossUnitWrongRetry(unitBundles, ability);
    } catch (e) {
      renderFatalError(e.message);
    }
  }
'''
text = replace_once(text, old, new, "shared cross-unit loader and retry page")
text = replace_once(
    text,
    '''    Router.register("/overview", pageOverview);
    Router.register("/unit/:unitId", pageUnitHome);''',
    '''    Router.register("/overview", pageOverview);
    Router.register("/overview/retry/:ability", pageCrossUnitRetry);
    Router.register("/unit/:unitId", pageUnitHome);''',
    "cross-unit retry route"
)
path.write_text(text)

# content-renderer.js — add all-errors and per-ability retry actions to the overview.
path = Path("js/content-renderer.js")
text = path.read_text()
old = '''    const abilityHTML = overview.abilities.length
      ? overview.abilities.slice(0, 10).map((a) => `
        <div style="padding:10px 0; border-bottom:1px solid var(--color-border);">
          <div style="display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap; font-size:14px;">
            <strong>${esc(a.ability)}</strong>
            <span style="color:var(--color-ink-soft);">待修正 ${a.currentWrongQuestions} 題 · 曾答錯 ${a.everWrongQuestions} 題 · 累積答錯 ${a.wrongAttempts} 次</span>
          </div>
          <p style="margin:5px 0 0; color:var(--color-ink-faint); font-size:12px;">涉及 ${a.everWrongUnits} 篇${a.currentWrongUnits ? `；其中 ${a.currentWrongUnits} 篇仍有待修正題目` : ""}${a.repeatedWrongQuestions ? `；${a.repeatedWrongQuestions} 題曾重複答錯` : ""}</p>
        </div>`).join("")
      : `<p class="empty-state" style="padding:20px;">尚未有可用的客觀題錯題紀錄。</p>`;
'''
new = '''    const abilityHTML = overview.abilities.length
      ? overview.abilities.slice(0, 10).map((a) => `
        <div style="padding:10px 0; border-bottom:1px solid var(--color-border);">
          <div style="display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap; align-items:flex-start;">
            <div>
              <strong>${esc(a.ability)}</strong>
              <p style="margin:5px 0 0; color:var(--color-ink-soft); font-size:13px;">待修正 ${a.currentWrongQuestions} 題 · 曾答錯 ${a.everWrongQuestions} 題 · 累積答錯 ${a.wrongAttempts} 次</p>
              <p style="margin:5px 0 0; color:var(--color-ink-faint); font-size:12px;">涉及 ${a.everWrongUnits} 篇${a.currentWrongUnits ? `；其中 ${a.currentWrongUnits} 篇仍有待修正題目` : ""}${a.repeatedWrongQuestions ? `；${a.repeatedWrongQuestions} 題曾重複答錯` : ""}</p>
            </div>
            ${a.currentWrongQuestions ? `<a class="btn btn-secondary" href="#/overview/retry/${encodeURIComponent(a.ability)}">重練此能力 →</a>` : ""}
          </div>
        </div>`).join("")
      : `<p class="empty-state" style="padding:20px;">尚未有可用的客觀題錯題紀錄。</p>`;
'''
text = replace_once(text, old, new, "ability retry actions")
old = '''        <p style="font-size:12px; color:var(--color-ink-soft); margin:12px 0 0;">「有學習活動」只表示這部裝置曾留下作答、背誦、自評或反思紀錄，不代表完成或掌握該篇。</p>
      </div>
'''
new = '''        <p style="font-size:12px; color:var(--color-ink-soft); margin:12px 0 0;">「有學習活動」只表示這部裝置曾留下作答、背誦、自評或反思紀錄，不代表完成或掌握該篇。</p>
        ${overview.totalCurrentWrong ? `<a class="btn btn-primary" style="margin-top:14px;" href="#/overview/retry/all">重練全部待修正 →</a>` : ""}
      </div>
'''
text = replace_once(text, old, new, "all wrong retry action")
path.write_text(text)

# validate-loading.mjs — targeted retry stays an explicit aggregate route, never a home preload.
path = Path("scripts/validate-loading.mjs")
text = path.read_text()
text = replace_once(
    text,
    '''requireText('Router.register("/overview", pageOverview)', "dedicated cross-unit overview route");''',
    '''requireText('Router.register("/overview", pageOverview)', "dedicated cross-unit overview route");
requireText('Router.register("/overview/retry/:ability", pageCrossUnitRetry)', "dedicated cross-unit targeted retry route");
requireText("async function loadCrossUnitBundles()", "shared on-demand aggregate loader");''',
    "loading guards for targeted retry"
)
path.write_text(text)
