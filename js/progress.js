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
    if (!unit.selfReview || typeof unit.selfReview !== "object") unit.selfReview = {};
    if (!unit.navigation || typeof unit.navigation !== "object") {
      unit.navigation = { lastPath: null, lastAt: null };
    }
    if (!("lastPath" in unit.navigation)) unit.navigation.lastPath = null;
    if (!("lastAt" in unit.navigation)) unit.navigation.lastAt = null;
    if (!("lastActivityAt" in unit)) unit.lastActivityAt = null;
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
    all[unitId].lastActivityAt = Date.now();
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

    all[unitId].lastActivityAt = now;
    saveAll(all);
  }

  function markMemorisationCharactersViewed(unitId) {
    const all = unitStore(unitId);
    const now = Date.now();
    all[unitId].memorisation.charsViewedAt = now;
    all[unitId].lastActivityAt = now;
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

  function setSelfReviewItem(unitId, item, checked) {
    if (!item) return;
    const all = unitStore(unitId);
    if (checked) all[unitId].selfReview[item] = true;
    else delete all[unitId].selfReview[item];
    all[unitId].lastActivityAt = Date.now();
    saveAll(all);
  }

  function getSelfReview(unitId) {
    const all = unitStore(unitId);
    return { ...all[unitId].selfReview };
  }

  function safeLearningPath(unitId, path) {
    if (typeof path !== "string") return null;
    const base = `/unit/${unitId}`;
    if (!path.startsWith(base + "/")) return null;
    if (path === `${base}/challenge/run` || path === `${base}/challenge/result`) return `${base}/challenge`;
    return path;
  }

  function recordLearningVisit(unitId, path) {
    const safePath = safeLearningPath(unitId, path);
    if (!safePath) return;
    const all = unitStore(unitId);
    all[unitId].navigation.lastPath = safePath;
    all[unitId].navigation.lastAt = Date.now();
    saveAll(all);
  }

  function unitEvidenceTimestamp(unit) {
    let latest = Number(unit.lastActivityAt) || 0;
    Object.values(unit.answers || {}).forEach((rec) => {
      latest = Math.max(latest, Number(rec && rec.timestamp) || 0);
    });
    const memo = unit.memorisation || {};
    latest = Math.max(latest, Number(memo.charsViewedAt) || 0);
    Object.values(memo.groups || {}).forEach((group) => {
      latest = Math.max(
        latest,
        Number(group && group.cloze && group.cloze.lastAt) || 0,
        Number(group && group.reorder && group.reorder.lastAt) || 0
      );
    });
    return latest;
  }

  function latestLearning(curriculumUnits = []) {
    const allowed = new Set((curriculumUnits || []).filter((u) => u.status === "available").map((u) => u.id));
    const all = loadAll();
    let latest = null;
    Object.entries(all).forEach(([unitId, raw]) => {
      if (allowed.size && !allowed.has(unitId)) return;
      if (!raw || typeof raw !== "object") return;
      const unit = ensureUnitShape(raw);
      const navigationAt = Number(unit.navigation.lastAt) || 0;
      const evidenceAt = unitEvidenceTimestamp(unit);
      const at = Math.max(navigationAt, evidenceAt);
      if (!at || (latest && latest.at >= at)) return;
      const savedPath = safeLearningPath(unitId, unit.navigation.lastPath);
      latest = {
        unitId,
        path: savedPath || `/unit/${unitId}/progress`,
        at,
        source: savedPath && navigationAt >= evidenceAt ? "visit" : "evidence"
      };
    });
    return latest;
  }

  function recommendNextStep(unitId) {
    const all = unitStore(unitId);
    const unit = all[unitId];
    const answered = Object.values(unit.answers || {}).filter((rec) => rec && rec.answered).length;
    const wrong = Object.values(unit.answers || {}).filter((rec) => rec && rec.answered && rec.isCorrect === false).length;
    const memoPractised = Object.values((unit.memorisation && unit.memorisation.groups) || {}).some((group) =>
      !!((group.cloze && group.cloze.attempts) || (group.reorder && group.reorder.attempts))
    );
    const reflectionSaved = !!String((unit.reflections && unit.reflections.theme) || "").trim();
    const selfReviewed = Object.values(unit.selfReview || {}).some(Boolean);

    if (wrong > 0) {
      return {
        path: `/unit/${unitId}/progress`,
        label: "先修正錯題",
        reason: `目前有 ${wrong} 題客觀題留下錯誤紀錄；先到「我的掌握」重看錯題與補強方向。`
      };
    }
    if (!answered && !memoPractised && !reflectionSaved) {
      return {
        path: `/unit/${unitId}/text`,
        label: "由原文開始",
        reason: "目前未有作答、背誦或反思紀錄；先熟讀原文及注釋，再進入練習。"
      };
    }
    if (!memoPractised) {
      return {
        path: `/unit/${unitId}/memorisation`,
        label: "開始背誦練習",
        reason: `已有 ${answered} 題作答紀錄，但尚未留下背誦練習紀錄；可先做遮字或句子重組。`
      };
    }
    if (!reflectionSaved) {
      return {
        path: `/unit/${unitId}/theme`,
        label: "整理主旨與反思",
        reason: "已有背誦練習紀錄，但尚未儲存主旨反思；可把篇章內容連結到自己的理解。"
      };
    }
    if (!selfReviewed) {
      return {
        path: `/unit/${unitId}/progress`,
        label: "做一次自我檢核",
        reason: "已有作答、背誦及反思紀錄；可用篇章自評清單檢查仍想補強的範疇。"
      };
    }
    return {
      path: `/unit/${unitId}/challenge`,
      label: "進入核心篇章挑戰",
      reason: "已有多種學習紀錄及自我檢核，可用綜合題檢驗不同能力範疇。"
    };
  }

  function evidenceTimestamp(unitId) {
    const all = unitStore(unitId);
    return unitEvidenceTimestamp(all[unitId]);
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
    setSelfReviewItem, getSelfReview,
    recordLearningVisit, latestLearning, recommendNextStep, evidenceTimestamp,
    clearUnit, abilityStats, wrongQuestionIds, everWrongQuestionIds, resolvedWrongQuestionIds, overallAccuracy
  };
})();
