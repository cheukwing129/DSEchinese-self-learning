/* ============================================================
   progress.js — 學生進度、作答紀錄、錯題本（localStorage）
   全部資料只存在使用者自己的瀏覽器，不會上傳到任何伺服器。
   ============================================================ */

const Progress = (() => {
  const STORAGE_KEY = "ccsl_progress_v1"; // Chinese Classics Self Learning

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

  function unitStore(unitId) {
    const all = loadAll();
    if (!all[unitId]) {
      all[unitId] = {
        answers: {},       // questionId -> { answered, isCorrect, selected, textAnswer, timestamp }
        reflections: {},   // moduleId -> text
        memorisationSeen: {}
      };
    }
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

  function clearUnit(unitId) {
    const all = loadAll();
    delete all[unitId];
    saveAll(all);
  }

  // 統計：依 ability 分項正確率（只計算客觀題，且只計已作答）
  function abilityStats(unitId, allQuestions) {
    const answers = getAllAnswers(unitId);
    const stats = {};
    allQuestions.forEach((q) => {
      const isObjective = ["single_choice", "multi_select", "true_false_unknown", "matching", "extract_sentence"].includes(q.question_type);
      if (!isObjective) return;
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
      const isObjective = ["single_choice", "multi_select", "true_false_unknown", "matching", "extract_sentence"].includes(q.question_type);
      if (!isObjective) return;
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
    clearUnit, abilityStats, wrongQuestionIds, overallAccuracy
  };
})();
