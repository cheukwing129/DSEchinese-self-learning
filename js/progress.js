/* ============================================================
   progress.js — 學生進度、作答紀錄、錯題本、背誦練習（localStorage）
   全部資料只存在使用者自己的瀏覽器，不會上傳到任何伺服器。
   ============================================================ */

const Progress = (() => {
  const STORAGE_KEY = "ccsl_progress_v1"; // Chinese Classics Self Learning
  const OBJECTIVE_TYPES = ["single_choice", "multi_select", "true_false_unknown", "matching", "extract_sentence", "cloze_choice"];

  function loadAll() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      return JSON.parse(raw);
    } catch (e) {
      console.error("Progress: 讀取 localStorage 失敗", e);
      return {};
    }
  }

  function saveAll(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      console.error("Progress: 寫入 localStorage 失敗", e);
      return false;
    }
  }

  function ensureUnitShape(unit) {
    if (!unit.answers || typeof unit.answers !== "object") unit.answers = {};
    if (!unit.reflections || typeof unit.reflections !== "object") unit.reflections = {};
    if (!unit.memorisation || typeof unit.memorisation !== "object") {
      unit.memorisation = { groups: {}, charsViewedAt: null };
    }
    if (!unit.memorisation.groups || typeof unit.memorisation.groups !== "object") {
      unit.memorisation.groups = {};
    }
    if (!("charsViewedAt" in unit.memorisation)) unit.memorisation.charsViewedAt = null;
    return unit;
  }

  function unitStore(unitId) {
    const all = loadAll();
    if (!all[unitId] || typeof all[unitId] !== "object") all[unitId] = {};
    ensureUnitShape(all[unitId]);
    return all;
  }

  function recordAnswer(unitId, questionId, record) {
    const all = unitStore(unitId);
    all[unitId].answers[questionId] = {
      ...(all[unitId].answers[questionId] || {}),
      ...record,
      timestamp: Date.now()
    };
    saveAll(all);
  }

  function getAnswer(unitId, questionId) {
    const all = unitStore(unitId);
    return all[unitId].answers[questionId] || null;
  }

  function getAllAnswers(unitId) {
    const all = unitStore(unitId);
    return all[unitId].answers;
  }

  function saveReflection(unitId, moduleId, text) {
    const all = unitStore(unitId);
    all[unitId].reflections[moduleId] = text;
    saveAll(all);
  }

  function getReflection(unitId, moduleId) {
    const all = unitStore(unitId);
    return all[unitId].reflections[moduleId] || "";
  }

  function recordMemorisationAttempt(unitId, groupId, mode, result = {}) {
    if (!groupId || !["cloze", "reorder"].includes(mode)) return;
    const all = unitStore(unitId);
    const groups = all[unitId].memorisation.groups;
    if (!groups[groupId] || typeof groups[groupId] !== "object") groups[groupId] = {};
    const group = groups[groupId];
    const now = Date.now();

    if (mode === "cloze") {
      const previous = group.cloze || {};
      const total = Math.max(0, Number(result.total) || 0);
      const correct = Math.min(total, Math.max(0, Number(result.correct) || 0));
      const rate = total ? Math.round((correct / total) * 100) : null;
      group.cloze = {
        attempts: (previous.attempts || 0) + 1,
        lastCorrect: correct,
        lastTotal: total,
        lastRate: rate,
        bestRate: rate == null ? (previous.bestRate ?? null) : Math.max(previous.bestRate ?? 0, rate),
        lastAt: now
      };
    } else {
      const previous = group.reorder || {};
      const isCorrect = result.isCorrect === true;
      group.reorder = {
        attempts: (previous.attempts || 0) + 1,
        successes: (previous.successes || 0) + (isCorrect ? 1 : 0),
        lastCorrect: isCorrect,
        passed: previous.passed === true || isCorrect,
        lastAt: now
      };
    }

    saveAll(all);
  }

  function markMemorisationCharactersViewed(unitId) {
    const all = unitStore(unitId);
    all[unitId].memorisation.charsViewedAt = Date.now();
    saveAll(all);
  }

  function memorisationStats(unitId, sentenceGroups = []) {
    const all = unitStore(unitId);
    const memo = all[unitId].memorisation;
    const groups = sentenceGroups.map((g) => {
      const saved = memo.groups[g.id] || {};
      const cloze = saved.cloze || null;
      const reorder = saved.reorder || null;
      return {
        id: g.id,
        title: g.title || g.id,
        paragraph: g.paragraph,
        cloze,
        reorder,
        practised: !!((cloze && cloze.attempts) || (reorder && reorder.attempts)),
        bothPractised: !!(cloze && cloze.attempts && reorder && reorder.attempts)
      };
    });

    return {
      totalGroups: groups.length,
      practisedGroups: groups.filter((g) => g.practised).length,
      bothPractisedGroups: groups.filter((g) => g.bothPractised).length,
      clozePractisedGroups: groups.filter((g) => g.cloze && g.cloze.attempts).length,
      reorderPractisedGroups: groups.filter((g) => g.reorder && g.reorder.attempts).length,
      reorderPassedGroups: groups.filter((g) => g.reorder && g.reorder.passed).length,
      charsViewed: !!memo.charsViewedAt,
      charsViewedAt: memo.charsViewedAt || null,
      groups
    };
  }

  function clearUnit(unitId) {
    const all = loadAll();
    delete all[unitId];
    saveAll(all);
  }

  function isObjectiveQuestion(q) {
    return OBJECTIVE_TYPES.includes(q.question_type);
  }

  // 統計：依 ability 分項正確率（只計算可自動批改的客觀題，且只計已作答）
  function abilityStats(unitId, allQuestions) {
    const answers = getAllAnswers(unitId);
    const stats = {};
    allQuestions.forEach((q) => {
      if (!isObjectiveQuestion(q)) return;
      const ability = q.ability || "其他";
      if (!stats[ability]) stats[ability] = { answered: 0, correct: 0, total: 0 };
      stats[ability].total += 1;
      const rec = answers[q.id];
      if (rec && rec.answered) {
        stats[ability].answered += 1;
        if (rec.isCorrect) stats[ability].correct += 1;
      }
    });
    return stats;
  }

  function wrongQuestionIds(unitId, allQuestions) {
    const answers = getAllAnswers(unitId);
    return allQuestions
      .filter((q) => {
        const rec = answers[q.id];
        return rec && rec.answered && rec.isCorrect === false;
      })
      .map((q) => q.id);
  }

  function overallAccuracy(unitId, allQuestions) {
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

  return {
    recordAnswer, getAnswer, getAllAnswers,
    saveReflection, getReflection,
    recordMemorisationAttempt, markMemorisationCharactersViewed, memorisationStats,
    clearUnit, abilityStats, wrongQuestionIds, overallAccuracy
  };
})();
