from pathlib import Path


def replace_once(text, old, new, label):
    if text.count(old) != 1:
        raise SystemExit(f"{label}: expected one occurrence, got {text.count(old)}")
    return text.replace(old, new, 1)


def remove_between(text, start_marker, end_marker, label):
    start = text.find(start_marker)
    end = text.find(end_marker, start + len(start_marker))
    if start < 0 or end < 0:
        raise SystemExit(f"{label}: markers not found")
    return text[:start] + text[end:]


analytics = '''/* ============================================================
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
'''
Path("js/progress-analytics.js").write_text(analytics)

progress_path = Path("js/progress.js")
progress = progress_path.read_text()
progress = remove_between(
    progress,
    "  function crossUnitWrongItems(unitInputs = [], ability = null) {",
    "  function overallAccuracy(unitId, allQuestions) {",
    "cross-unit wrong selector",
)
progress = remove_between(
    progress,
    "  function crossUnitOverview(unitInputs = []) {",
    "  return {\n",
    "cross-unit overview",
)
progress = replace_once(
    progress,
    "  function clearUnit(unitId) {\n",
    "  function evidenceTimestamp(unitId) {\n    const all = unitStore(unitId);\n    return unitEvidenceTimestamp(all[unitId]);\n  }\n\n  function clearUnit(unitId) {\n",
    "evidence wrapper insertion",
)
progress = replace_once(
    progress,
    "    recordLearningVisit, latestLearning, recommendNextStep,\n",
    "    recordLearningVisit, latestLearning, recommendNextStep, evidenceTimestamp,\n",
    "progress export evidence timestamp",
)
progress = replace_once(
    progress,
    "    clearUnit, abilityStats, wrongQuestionIds, everWrongQuestionIds, resolvedWrongQuestionIds, overallAccuracy,\n    crossUnitOverview, crossUnitWrongItems\n",
    "    clearUnit, abilityStats, wrongQuestionIds, everWrongQuestionIds, resolvedWrongQuestionIds, overallAccuracy\n",
    "progress export analytics removal",
)
progress_path.write_text(progress)

app_path = Path("js/app.js")
app = app_path.read_text()
app = replace_once(
    app,
    '    contentProgress: "js/content-renderer.js",\n',
    '    contentProgress: "js/content-renderer.js",\n    progressAnalytics: "js/progress-analytics.js",\n',
    "analytics UI module registration",
)
app = replace_once(
    app,
    '        loadUIModules(["contentProgress"])\n',
    '        loadUIModules(["contentProgress", "progressAnalytics"])\n',
    "overview analytics loading",
)
retry_start = app.find("  async function pageCrossUnitRetry(params) {")
retry_end = app.find("\n  async function withUnitBundle", retry_start)
if retry_start < 0 or retry_end < 0:
    raise SystemExit("cross-unit retry block not found")
retry_block = app[retry_start:retry_end]
retry_block = replace_once(
    retry_block,
    '        loadUIModules(["questions"])\n',
    '        loadUIModules(["questions", "progressAnalytics"])\n',
    "retry analytics loading",
)
app = app[:retry_start] + retry_block + app[retry_end:]
app_path.write_text(app)

build_path = Path("scripts/build-assets.mjs")
build = build_path.read_text()
build = replace_once(
    build,
    'const progress = fingerprint("progress", "js", "js/progress.js", read("js/progress.js"));\n',
    'const progress = fingerprint("progress", "js", "js/progress.js", read("js/progress.js"));\nconst progressAnalytics = fingerprint("progress-analytics", "js", "js/progress-analytics.js", read("js/progress-analytics.js"));\n',
    "analytics fingerprint",
)
build = replace_once(
    build,
    'const assets = { style, readerStyle, studyStyle, progressStyle, questionsStyle, progress, router, app, content, questions, memorisation };',
    'const assets = { style, readerStyle, studyStyle, progressStyle, questionsStyle, progress, progressAnalytics, router, app, content, questions, memorisation };',
    "analytics manifest asset",
)
build = replace_once(
    build,
    '''builtApp = replaceOnce(
  builtApp,
  'contentProgress: "js/content-renderer.js"',
  `contentProgress: { script: "${content.path}", style: "${progressStyle.path}" }`,
  "progress renderer fingerprint injection"
);
''',
    '''builtApp = replaceOnce(
  builtApp,
  'contentProgress: "js/content-renderer.js"',
  `contentProgress: { script: "${content.path}", style: "${progressStyle.path}" }`,
  "progress renderer fingerprint injection"
);
builtApp = replaceOnce(
  builtApp,
  'progressAnalytics: "js/progress-analytics.js"',
  `progressAnalytics: "${progressAnalytics.path}"`,
  "progress analytics fingerprint injection"
);
''',
    "analytics build injection",
)
build_path.write_text(build)

# Update behavioral validators to execute the lazy analytics extension after the eager progress core.
for validator_name in ["scripts/validate-cross-unit-overview.mjs", "scripts/validate-cross-unit-targeted-retry.mjs"]:
    p = Path(validator_name)
    text = p.read_text()
    text = replace_once(
        text,
        'const progressSource = fs.readFileSync("js/progress.js", "utf8");\n',
        'const progressSource = fs.readFileSync("js/progress.js", "utf8");\nconst analyticsSource = fs.readFileSync("js/progress-analytics.js", "utf8");\n',
        f"{validator_name} analytics source",
    )
    text = replace_once(
        text,
        'vm.runInContext(progressSource, context);\n',
        'vm.runInContext(progressSource, context);\nvm.runInContext(analyticsSource, context);\n',
        f"{validator_name} analytics execution",
    )
    p.write_text(text)

p = Path("scripts/validate-cross-unit-overview.mjs")
text = p.read_text()
text = replace_once(
    text,
    'check(appSource.includes(\'loadUnitBundle(entry.id, { allQuestionBanks: true })\'), "overview route must load full banks only on demand");\n',
    'check(appSource.includes(\'loadUnitBundle(entry.id, { allQuestionBanks: true })\'), "overview route must load full banks only on demand");\ncheck(appSource.includes(\'loadUIModules(["contentProgress", "progressAnalytics"])\'), "overview must lazy-load cross-unit analytics");\n',
    "overview lazy analytics assertion",
)
p.write_text(text)

p = Path("scripts/validate-cross-unit-targeted-retry.mjs")
text = p.read_text()
text = replace_once(
    text,
    'check(progressSource.includes("function crossUnitWrongItems"), "Progress must expose one shared cross-unit unresolved selector");\n',
    'check(analyticsSource.includes("function crossUnitWrongItems"), "lazy analytics must expose one shared cross-unit unresolved selector");\ncheck(appSource.includes(\'loadUIModules(["questions", "progressAnalytics"])\'), "targeted retry must lazy-load cross-unit analytics");\n',
    "targeted retry analytics assertion",
)
p.write_text(text)

p = Path("scripts/validate-loading.mjs")
text = p.read_text()
text = replace_once(
    text,
    'requireText("async function loadCrossUnitBundles()", "shared on-demand aggregate loader");\n',
    'requireText("async function loadCrossUnitBundles()", "shared on-demand aggregate loader");\nrequireText(\'loadUIModules(["contentProgress", "progressAnalytics"])\', "overview-only analytics loading");\nrequireText(\'loadUIModules(["questions", "progressAnalytics"])\', "targeted-retry analytics loading");\n',
    "loading analytics assertions",
)
p.write_text(text)

p = Path("scripts/validate-performance.mjs")
text = p.read_text()
text = replace_once(
    text,
    'for (const key of ["style", "readerStyle", "studyStyle", "progressStyle", "questionsStyle", "progress", "router", "app", "content", "questions", "memorisation"]) {',
    'for (const key of ["style", "readerStyle", "studyStyle", "progressStyle", "questionsStyle", "progress", "progressAnalytics", "router", "app", "content", "questions", "memorisation"]) {',
    "performance analytics manifest assertion",
)
text = replace_once(
    text,
    'for (const heavyKey of ["content", "questions", "memorisation"]) {',
    'for (const heavyKey of ["content", "questions", "memorisation", "progressAnalytics"]) {',
    "performance lazy analytics assertion",
)
text = replace_once(
    text,
    '  check(builtApp.includes(`contentProgress: { script: "${asset("content")?.path}", style: "${asset("progressStyle")?.path}" }`), "built app must pair progress routes with progress CSS");\n',
    '  check(builtApp.includes(`contentProgress: { script: "${asset("content")?.path}", style: "${asset("progressStyle")?.path}" }`), "built app must pair progress routes with progress CSS");\n  check(builtApp.includes(`progressAnalytics: "${asset("progressAnalytics")?.path}"`), "built app must point to fingerprinted lazy progress analytics");\n',
    "performance built analytics assertion",
)
text = replace_once(
    text,
    'const deferredFiles = ["content", "questions", "memorisation"].map(fileFromAsset).filter(Boolean);',
    'const deferredFiles = ["content", "questions", "memorisation", "progressAnalytics"].map(fileFromAsset).filter(Boolean);',
    "performance deferred analytics bytes",
)
text = text.replace("less eager JS than the former six-script bootstrap", "less eager JS than the combined eager + route-lazy runtime")
p.write_text(text)
