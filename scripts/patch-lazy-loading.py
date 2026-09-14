from pathlib import Path

path = Path('js/app.js')
text = path.read_text()

old = '''  const cache = { curriculum: null, units: {} }; // units[unitId] = bundle

  // ---------- 資料載入 ----------
  async function fetchJSON(path) {
'''
new = '''  const cache = { curriculum: null, json: {} };

  // ---------- 資料載入 ----------
  async function fetchJSON(path) {
'''
assert old in text, 'cache block not found'
text = text.replace(old, new, 1)

old = '''  async function loadCurriculum() {
    if (cache.curriculum) return cache.curriculum;
    cache.curriculum = await fetchJSON("data/curriculum.json");
    return cache.curriculum;
  }

  async function loadUnitBundle(unitId) {
    if (cache.units[unitId]) return cache.units[unitId];
    const base = `data/units/${unitId}`;
    const unit = await fetchJSON(`${base}/unit.json`);

    const [text, background, appreciation, structure, memorisation, rubrics] = await Promise.all([
      fetchJSON(`${base}/text.json`),
      fetchJSON(`${base}/background.json`),
      fetchJSON(`${base}/appreciation.json`),
      fetchJSON(`${base}/structure.json`),
      fetchJSON(`${base}/memorisation.json`),
      fetchJSON(`${base}/rubrics.json`)
    ]);

    const bankFiles = unit.question_bank_files || [];
    const bankResults = await Promise.all(bankFiles.map((f) => fetchJSON(`${base}/${f}`)));
    const banks = {};
    let allQuestions = [];
    bankResults.forEach((b) => {
      banks[b.bank] = b.questions;
      allQuestions = allQuestions.concat(b.questions);
    });

    const bundle = { unit, text, background, appreciation, structure, memorisation, rubrics, banks, allQuestions };
    cache.units[unitId] = bundle;
    return bundle;
  }
'''
new = '''  function loadJSONCached(path) {
    if (!cache.json[path]) {
      cache.json[path] = fetchJSON(path).catch((err) => {
        delete cache.json[path];
        throw err;
      });
    }
    return cache.json[path];
  }

  async function loadCurriculum() {
    if (cache.curriculum) return cache.curriculum;
    cache.curriculum = await loadJSONCached("data/curriculum.json");
    return cache.curriculum;
  }

  function unitBase(unitId) {
    return `data/units/${unitId}`;
  }

  function bankFileName(path) {
    const leaf = path.split("/").pop() || "";
    return leaf.replace(/\\.json$/i, "");
  }

  async function loadUnitMeta(unitId) {
    return loadJSONCached(`${unitBase(unitId)}/unit.json`);
  }

  async function loadUnitResource(unitId, resource) {
    return loadJSONCached(`${unitBase(unitId)}/${resource}.json`);
  }

  async function loadQuestionBank(unitId, unit, bankName) {
    const file = (unit.question_bank_files || []).find((f) => bankFileName(f) === bankName);
    if (!file) throw new Error(`篇章「${unit.title || unitId}」沒有題庫「${bankName}」。`);
    return loadJSONCached(`${unitBase(unitId)}/${file}`);
  }

  async function loadUnitBundle(unitId, options = {}) {
    const unit = await loadUnitMeta(unitId);
    const resources = [...new Set(options.resources || [])];
    const requestedBanks = [...new Set(options.banks || [])];
    const bankNames = options.allQuestionBanks
      ? (unit.question_bank_files || []).map(bankFileName)
      : requestedBanks;

    const bundle = { unit, banks: {} };

    await Promise.all(resources.map(async (resource) => {
      bundle[resource] = await loadUnitResource(unitId, resource);
    }));

    if (bankNames.length) {
      const results = await Promise.all(bankNames.map((name) => loadQuestionBank(unitId, unit, name)));
      results.forEach((bank, index) => {
        const name = bank.bank || bankNames[index];
        bundle.banks[name] = bank.questions || [];
      });
    }

    if (options.allQuestionBanks) {
      bundle.allQuestions = Object.values(bundle.banks).flat();
    }

    return bundle;
  }
'''
assert old in text, 'old load bundle block not found'
text = text.replace(old, new, 1)

old = '''  async function withUnitBundle(unitId, onReady) {
    renderLoading("篇章資料");
    let bundle;
    try {
      bundle = await loadUnitBundle(unitId);
    } catch (e) {
      renderFatalError(e.message);
      return;
    }
    setCrumb(`《${bundle.unit.title}》`);
    onReady(bundle);
  }
'''
new = '''  async function withUnitBundle(unitId, options, onReady) {
    if (typeof options === "function") {
      onReady = options;
      options = {};
    }
    renderLoading("篇章資料");
    let bundle;
    try {
      bundle = await loadUnitBundle(unitId, options || {});
    } catch (e) {
      renderFatalError(e.message);
      return;
    }
    setCrumb(`《${bundle.unit.title}》`);
    onReady(bundle);
  }
'''
assert old in text, 'withUnitBundle block not found'
text = text.replace(old, new, 1)

repls = {
'''    await withUnitBundle(params.unitId, (bundle) => {
      ContentRenderer.renderTextPage(bundle, params.unitId);
''': '''    await withUnitBundle(params.unitId, { resources: ["text"] }, (bundle) => {
      ContentRenderer.renderTextPage(bundle, params.unitId);
''',
'''    await withUnitBundle(params.unitId, (bundle) => {
      ContentRenderer.renderWordsPage(bundle, params.unitId);
''': '''    await withUnitBundle(params.unitId, { resources: ["text"] }, (bundle) => {
      ContentRenderer.renderWordsPage(bundle, params.unitId);
''',
'''    await withUnitBundle(params.unitId, (bundle) => {
      ContentRenderer.renderComprehensionPage(bundle, params.unitId);
''': '''    await withUnitBundle(params.unitId, { resources: ["text"] }, (bundle) => {
      ContentRenderer.renderComprehensionPage(bundle, params.unitId);
''',
'''    await withUnitBundle(params.unitId, (bundle) => {
      ContentRenderer.renderAnalysisPage(bundle, params.unitId);
''': '''    await withUnitBundle(params.unitId, { resources: ["structure"] }, (bundle) => {
      ContentRenderer.renderAnalysisPage(bundle, params.unitId);
''',
'''    await withUnitBundle(params.unitId, (bundle) => {
      ContentRenderer.renderThemePage(bundle, params.unitId);
''': '''    await withUnitBundle(params.unitId, { resources: ["appreciation"] }, (bundle) => {
      ContentRenderer.renderThemePage(bundle, params.unitId);
''',
'''    await withUnitBundle(params.unitId, (bundle) => {
      MemorisationEngine.render(bundle, params.unitId);
''': '''    await withUnitBundle(params.unitId, { resources: ["memorisation"] }, (bundle) => {
      MemorisationEngine.render(bundle, params.unitId);
''',
'''    await withUnitBundle(params.unitId, (bundle) => {
      ContentRenderer.renderProgressPage(bundle, params.unitId);
''': '''    await withUnitBundle(params.unitId, { resources: ["memorisation"], allQuestionBanks: true }, (bundle) => {
      ContentRenderer.renderProgressPage(bundle, params.unitId);
''',
'''    await withUnitBundle(params.unitId, (bundle) => {
      const questions = bundle.banks[bankName] || [];
''': '''    await withUnitBundle(params.unitId, { banks: [bankName] }, (bundle) => {
      const questions = bundle.banks[bankName] || [];
''',
'''    await withUnitBundle(params.unitId, (bundle) => {
      const all = bundle.banks["cross-text"] || [];
''': '''    await withUnitBundle(params.unitId, { banks: ["cross-text"] }, (bundle) => {
      const all = bundle.banks["cross-text"] || [];
''',
'''    await withUnitBundle(params.unitId, (bundle) => {
      QuestionEngine.renderChallengeSetup(bundle, params.unitId);
''': '''    await withUnitBundle(params.unitId, { allQuestionBanks: true }, (bundle) => {
      QuestionEngine.renderChallengeSetup(bundle, params.unitId);
''',
'''    await withUnitBundle(params.unitId, (bundle) => {
      QuestionEngine.renderChallengeRun(bundle, params.unitId);
''': '''    await withUnitBundle(params.unitId, { allQuestionBanks: true }, (bundle) => {
      QuestionEngine.renderChallengeRun(bundle, params.unitId);
''',
'''    await withUnitBundle(params.unitId, (bundle) => {
      QuestionEngine.renderChallengeResult(bundle, params.unitId);
''': '''    await withUnitBundle(params.unitId, { allQuestionBanks: true }, (bundle) => {
      QuestionEngine.renderChallengeResult(bundle, params.unitId);
'''
}
for old, new in repls.items():
    assert old in text, f'route block not found: {old[:60]!r}'
    text = text.replace(old, new, 1)

path.write_text(text)
