from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 match, found {count}")
    return text.replace(old, new, 1)

# progress.js — preserve mistake history while current wrong state follows the latest objective attempt.
path = Path("js/progress.js")
text = path.read_text()
old = '''  function recordAnswer(unitId, questionId, record) {
    const all = unitStore(unitId);
    const now = Date.now();
    all[unitId].answers[questionId] = {
      ...(all[unitId].answers[questionId] || {}),
      ...record,
      timestamp: now
    };
    all[unitId].lastActivityAt = now;
    saveAll(all);
  }'''
new = '''  function recordAnswer(unitId, questionId, record) {
    const all = unitStore(unitId);
    const now = Date.now();
    const previous = all[unitId].answers[questionId] || {};
    const previousAttempts = Number(previous.attemptCount) || (previous.answered ? 1 : 0);
    const previousWrongAttempts = Number(previous.wrongAttempts) || (previous.isCorrect === false ? 1 : 0);
    const previousCorrectAttempts = Number(previous.correctAttempts) || (previous.isCorrect === true ? 1 : 0);
    const isWrong = record && record.answered && record.isCorrect === false;
    const isCorrect = record && record.answered && record.isCorrect === true;
    const previousWrongAt = previous.lastWrongAt || (previous.isCorrect === false ? previous.timestamp : null) || null;
    const previousCorrectAt = previous.lastCorrectAt || (previous.isCorrect === true ? previous.timestamp : null) || null;

    all[unitId].answers[questionId] = {
      ...previous,
      ...record,
      timestamp: now,
      attemptCount: previousAttempts + (record && record.answered ? 1 : 0),
      wrongAttempts: previousWrongAttempts + (isWrong ? 1 : 0),
      correctAttempts: previousCorrectAttempts + (isCorrect ? 1 : 0),
      everWrong: previous.everWrong === true || previousWrongAttempts > 0 || previous.isCorrect === false || isWrong,
      firstWrongAt: previous.firstWrongAt || previousWrongAt || (isWrong ? now : null),
      lastWrongAt: isWrong ? now : previousWrongAt,
      lastCorrectAt: isCorrect ? now : previousCorrectAt
    };
    all[unitId].lastActivityAt = now;
    saveAll(all);
  }'''
text = replace_once(text, old, new, 'record answer history')

old = '''  function wrongQuestionIds(unitId, allQuestions) {
    const answers = getAllAnswers(unitId);
    return allQuestions
      .filter((q) => {
        const rec = answers[q.id];
        return rec && rec.answered && rec.isCorrect === false;
      })
      .map((q) => q.id);
  }

  function overallAccuracy(unitId, allQuestions) {'''
new = '''  function wrongQuestionIds(unitId, allQuestions) {
    const answers = getAllAnswers(unitId);
    return allQuestions
      .filter((q) => {
        if (!isObjectiveQuestion(q)) return false;
        const rec = answers[q.id];
        return rec && rec.answered && rec.isCorrect === false;
      })
      .map((q) => q.id);
  }

  function everWrongQuestionIds(unitId, allQuestions) {
    const answers = getAllAnswers(unitId);
    return allQuestions
      .filter((q) => {
        if (!isObjectiveQuestion(q)) return false;
        const rec = answers[q.id];
        return !!(rec && (rec.everWrong === true || Number(rec.wrongAttempts) > 0 || rec.isCorrect === false));
      })
      .map((q) => q.id);
  }

  function resolvedWrongQuestionIds(unitId, allQuestions) {
    const answers = getAllAnswers(unitId);
    const everWrong = new Set(everWrongQuestionIds(unitId, allQuestions));
    return allQuestions
      .filter((q) => everWrong.has(q.id) && answers[q.id] && answers[q.id].isCorrect === true)
      .map((q) => q.id);
  }

  function overallAccuracy(unitId, allQuestions) {'''
text = replace_once(text, old, new, 'wrong history helpers')
text = replace_once(
    text,
    '    clearUnit, abilityStats, wrongQuestionIds, overallAccuracy',
    '    clearUnit, abilityStats, wrongQuestionIds, everWrongQuestionIds, resolvedWrongQuestionIds, overallAccuracy',
    'wrong history exports'
)
path.write_text(text)

# question-engine.js — fresh, snapshot-based retry session using only unresolved objective mistakes.
path = Path("js/question-engine.js")
text = path.read_text()
insert_before = '  // ---------- 核心篇章挑戰 attempt ----------'
retry_code = '''  // ---------- 待修正錯題重練 ----------
  function renderWrongRetry(bundle, unitId) {
    const retryIds = Progress.wrongQuestionIds(unitId, bundle.allQuestions);
    const questions = bundle.allQuestions.filter((q) => retryIds.includes(q.id) && OBJECTIVE_TYPES.includes(q.question_type));

    if (!questions.length) {
      App.mount(`
        <h1 class="page-title">錯題重練</h1>
        <div class="card">
          <div class="section-title"><span class="seal">清</span>目前沒有待修正錯題</div>
          <p style="margin:0; color:var(--color-ink-soft);">曾經答錯的歷史仍會保留；這裡只重練「最後一次仍答錯」的客觀題。</p>
        </div>
        <a class="btn btn-primary" href="#/unit/${unitId}/progress">返回我的掌握 →</a>
        ${App.footerNav(unitId, bundle.unit.title)}
      `);
      return;
    }

    let idx = 0;
    const initialCount = questions.length;

    function renderCompletion() {
      const remainingIds = Progress.wrongQuestionIds(unitId, bundle.allQuestions);
      const remainingFromRound = retryIds.filter((id) => remainingIds.includes(id)).length;
      const resolved = initialCount - remainingFromRound;
      App.mount(`
        <h1 class="page-title">本輪錯題重練完成</h1>
        <div class="card">
          <div class="stat-grid">
            <div class="stat-card"><div class="stat-value">${initialCount}</div><div class="stat-label">本輪題數</div></div>
            <div class="stat-card"><div class="stat-value">${resolved}</div><div class="stat-label">本輪已修正</div></div>
            <div class="stat-card"><div class="stat-value">${remainingIds.length}</div><div class="stat-label">目前仍待修正</div></div>
          </div>
          <p style="font-size:13px; color:var(--color-ink-soft); margin:12px 0 0;">答對只會把題目移出「待修正」清單；曾答錯次數與歷史仍保留。</p>
        </div>
        <div class="btn-row">
          ${remainingIds.length ? `<a class="btn btn-primary" href="#/unit/${unitId}/progress/retry-wrong">再練仍錯題 →</a>` : ""}
          <a class="btn btn-secondary" href="#/unit/${unitId}/progress">返回我的掌握</a>
        </div>
        ${App.footerNav(unitId, bundle.unit.title)}
      `);
    }

    function renderAt(i) {
      idx = i;
      const q = questions[idx];
      renderQuestionShell({
        unitId, bundle, question: q, title: "錯題重練",
        indexLabel: `第 ${idx + 1} 題，共 ${questions.length} 題`,
        onPrev: idx > 0 ? () => renderAt(idx - 1) : null,
        onNext: idx < questions.length - 1 ? () => renderAt(idx + 1) : null,
        backHref: `#/unit/${unitId}/progress`,
        showRemediation: true,
        loadRecord: () => null,
        saveRecord: (questionId, record) => Progress.recordAnswer(unitId, questionId, record),
        onAfterConfirm: () => {
          if (idx < questions.length - 1) renderAt(idx + 1);
          else renderCompletion();
        }
      });
    }

    renderAt(0);
  }

'''
text = replace_once(text, insert_before, retry_code + insert_before, 'wrong retry renderer')
text = replace_once(
    text,
    '  return { renderQuizSequence, renderChallengeSetup, renderChallengeRun, renderChallengeResult };',
    '  return { renderQuizSequence, renderWrongRetry, renderChallengeSetup, renderChallengeRun, renderChallengeResult };',
    'wrong retry export'
)
path.write_text(text)

# app.js — route and label. It intentionally loads all banks because wrong IDs may span every bank.
path = Path("js/app.js")
text = path.read_text()
text = replace_once(
    text,
    '    if (path.endsWith("/progress")) return "我的掌握";',
    '    if (path.endsWith("/progress/retry-wrong")) return "錯題重練";\n    if (path.endsWith("/progress")) return "我的掌握";',
    'retry path label'
)
text = replace_once(
    text,
    '''  async function pageProgress(params) {
    await withUnitBundle(params.unitId, { resources: ["memorisation", "rubrics"], allQuestionBanks: true }, (bundle) => {
      ContentRenderer.renderProgressPage(bundle, params.unitId);
    });
  }

  // quiz pages''',
    '''  async function pageProgress(params) {
    await withUnitBundle(params.unitId, { resources: ["memorisation", "rubrics"], allQuestionBanks: true }, (bundle) => {
      ContentRenderer.renderProgressPage(bundle, params.unitId);
    });
  }

  async function pageWrongRetry(params) {
    await withUnitBundle(params.unitId, { resources: ["rubrics"], allQuestionBanks: true }, (bundle) => {
      QuestionEngine.renderWrongRetry(bundle, params.unitId);
    });
  }

  // quiz pages''',
    'wrong retry route handler'
)
text = replace_once(
    text,
    '    Router.register("/unit/:unitId/progress", pageProgress);',
    '    Router.register("/unit/:unitId/progress", pageProgress);\n    Router.register("/unit/:unitId/progress/retry-wrong", pageWrongRetry);',
    'wrong retry route registration'
)
path.write_text(text)

# content-renderer.js — distinguish unresolved vs historical mistakes and add one-click retry.
path = Path("js/content-renderer.js")
text = path.read_text()
text = replace_once(
    text,
    '''    const wrongIds = Progress.wrongQuestionIds(unitId, allQuestions);
    const wrongQuestions = allQuestions.filter((q) => wrongIds.includes(q.id));''',
    '''    const wrongIds = Progress.wrongQuestionIds(unitId, allQuestions);
    const everWrongIds = Progress.everWrongQuestionIds(unitId, allQuestions);
    const resolvedWrongIds = Progress.resolvedWrongQuestionIds(unitId, allQuestions);
    const wrongQuestions = allQuestions.filter((q) => wrongIds.includes(q.id));''',
    'wrong history stats state'
)
text = replace_once(
    text,
    '<div class="stat-label">錯題數</div>',
    '<div class="stat-label">待修正錯題</div>',
    'wrong stat label'
)
text = replace_once(
    text,
    '''      <div class="section-title"><span class="seal">錯</span>錯題本</div>
      <div class="module-grid">${wrongList}</div>''',
    '''      <div class="section-title"><span class="seal">錯</span>待修正錯題</div>
      <div class="card card-tight" style="margin-bottom:12px;">
        <div style="display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap; align-items:center;">
          <div>
            <strong>曾答錯 ${everWrongIds.length} 題 · 已修正 ${resolvedWrongIds.length} 題</strong>
            <p style="margin:5px 0 0; font-size:13px; color:var(--color-ink-soft);">待修正只看最後一次客觀題答案；答對後會移出清單，但錯誤歷史不會刪除。</p>
          </div>
          ${wrongQuestions.length ? `<a class="btn btn-primary" href="#/unit/${unitId}/progress/retry-wrong">一鍵重練 ${wrongQuestions.length} 題 →</a>` : ""}
        </div>
      </div>
      <div class="module-grid">${wrongList}</div>''',
    'wrong retry card'
)
path.write_text(text)

print('Wrong-answer retry patch applied.')
