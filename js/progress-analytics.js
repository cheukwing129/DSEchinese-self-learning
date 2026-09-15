/* ============================================================
   progress-analytics.js — 跨篇章總覽與跨單元錯題排序
   只在總覽／跨篇重練路由載入，避免增加首頁啟動成本。
   ============================================================ */

(() => {
  const OBJECTIVE_TYPES = ["single_choice", "multi_select", "true_false_unknown", "matching", "extract_sentence", "cloze_choice"];
  const isObjectiveQuestion = (q) => OBJECTIVE_TYPES.includes(q.question_type);

  function crossUnitWrongItems(unitInputs = [], ability = null) {
    const targetAbility = ability && ability !== "all" ? ability : null;
    const items = [];

    (unitInputs || []).forEach((input, unitIndex) => {
      const unitId = input.unitId;
      const answers = Progress.getAllAnswers(unitId);
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

  function crossUnitOverview(unitInputs = []) {
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
      const answers = Progress.getAllAnswers(unitId);
      const evidenceAt = Progress.evidenceTimestamp(unitId);
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

  Object.assign(Progress, { crossUnitOverview, crossUnitWrongItems });
})();
