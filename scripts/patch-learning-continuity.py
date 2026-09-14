from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 match, found {count}")
    return text.replace(old, new, 1)

# progress.js — persist navigation/activity without changing the existing storage key,
# derive a legacy-safe latest-learning record, and provide evidence-based next-step guidance.
path = Path("js/progress.js")
text = path.read_text()
text = replace_once(
    text,
    '    if (!unit.selfReview || typeof unit.selfReview !== "object") unit.selfReview = {};\n    return unit;',
    '''    if (!unit.selfReview || typeof unit.selfReview !== "object") unit.selfReview = {};
    if (!unit.navigation || typeof unit.navigation !== "object") {
      unit.navigation = { lastPath: null, lastAt: null };
    }
    if (!("lastPath" in unit.navigation)) unit.navigation.lastPath = null;
    if (!("lastAt" in unit.navigation)) unit.navigation.lastAt = null;
    if (!("lastActivityAt" in unit)) unit.lastActivityAt = null;
    return unit;''',
    'progress navigation shape'
)
text = replace_once(
    text,
    '''  function recordAnswer(unitId, questionId, record) {
    const all = unitStore(unitId);
    all[unitId].answers[questionId] = {
      ...(all[unitId].answers[questionId] || {}),
      ...record,
      timestamp: Date.now()
    };
    saveAll(all);
  }''',
    '''  function recordAnswer(unitId, questionId, record) {
    const all = unitStore(unitId);
    const now = Date.now();
    all[unitId].answers[questionId] = {
      ...(all[unitId].answers[questionId] || {}),
      ...record,
      timestamp: now
    };
    all[unitId].lastActivityAt = now;
    saveAll(all);
  }''',
    'answer activity timestamp'
)
text = replace_once(
    text,
    '''  function saveReflection(unitId, moduleId, text) {
    const all = unitStore(unitId);
    all[unitId].reflections[moduleId] = text;
    saveAll(all);
  }''',
    '''  function saveReflection(unitId, moduleId, text) {
    const all = unitStore(unitId);
    all[unitId].reflections[moduleId] = text;
    all[unitId].lastActivityAt = Date.now();
    saveAll(all);
  }''',
    'reflection activity timestamp'
)
text = replace_once(
    text,
    '    saveAll(all);\n  }\n\n  function markMemorisationCharactersViewed(unitId) {',
    '    all[unitId].lastActivityAt = now;\n    saveAll(all);\n  }\n\n  function markMemorisationCharactersViewed(unitId) {',
    'memorisation activity timestamp'
)
text = replace_once(
    text,
    '''  function markMemorisationCharactersViewed(unitId) {
    const all = unitStore(unitId);
    all[unitId].memorisation.charsViewedAt = Date.now();
    saveAll(all);
  }''',
    '''  function markMemorisationCharactersViewed(unitId) {
    const all = unitStore(unitId);
    const now = Date.now();
    all[unitId].memorisation.charsViewedAt = now;
    all[unitId].lastActivityAt = now;
    saveAll(all);
  }''',
    'character review activity timestamp'
)
text = replace_once(
    text,
    '''  function setSelfReviewItem(unitId, item, checked) {
    if (!item) return;
    const all = unitStore(unitId);
    if (checked) all[unitId].selfReview[item] = true;
    else delete all[unitId].selfReview[item];
    saveAll(all);
  }''',
    '''  function setSelfReviewItem(unitId, item, checked) {
    if (!item) return;
    const all = unitStore(unitId);
    if (checked) all[unitId].selfReview[item] = true;
    else delete all[unitId].selfReview[item];
    all[unitId].lastActivityAt = Date.now();
    saveAll(all);
  }''',
    'self review activity timestamp'
)
text = replace_once(
    text,
    '  function clearUnit(unitId) {',
    '''  function safeLearningPath(unitId, path) {
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

  function clearUnit(unitId) {''',
    'learning continuity helpers'
)
text = replace_once(
    text,
    '''    recordMemorisationAttempt, markMemorisationCharactersViewed, memorisationStats,
    setSelfReviewItem, getSelfReview,
    clearUnit, abilityStats, wrongQuestionIds, overallAccuracy''',
    '''    recordMemorisationAttempt, markMemorisationCharactersViewed, memorisationStats,
    setSelfReviewItem, getSelfReview,
    recordLearningVisit, latestLearning, recommendNextStep,
    clearUnit, abilityStats, wrongQuestionIds, overallAccuracy''',
    'progress exports'
)
path.write_text(text)

# app.js — show a global continue card and record successful learning-page visits.
path = Path("js/app.js")
text = path.read_text()
text = replace_once(
    text,
    '  // ---------- 路由頁面 ----------\n  async function pageHome() {',
    '''  function learningPathLabel(path) {
    if (!path) return "篇章學習";
    if (path.includes("/words/quiz")) return "字詞與虛詞題庫";
    if (path.includes("/comprehension/quiz")) return "內容理解題庫";
    if (path.includes("/analysis/quiz")) return "結構與手法題庫";
    if (path.includes("/theme/quiz")) return "主旨與思考題庫";
    if (path.includes("/cross-text/quiz")) return "跨篇比較題";
    if (path.endsWith("/text")) return "原文與誦讀";
    if (path.endsWith("/words")) return "字詞與句式";
    if (path.endsWith("/comprehension")) return "疏通文意";
    if (path.endsWith("/analysis")) return "結構與鑒賞";
    if (path.endsWith("/theme")) return "主旨與思考";
    if (path.endsWith("/memorisation")) return "背誦精華";
    if (path.endsWith("/challenge")) return "核心篇章挑戰";
    if (path.endsWith("/progress")) return "我的掌握";
    if (path.endsWith("/cross-text")) return "跨篇比較與進階題";
    return "篇章學習";
  }

  // ---------- 路由頁面 ----------
  async function pageHome() {''',
    'learning path label'
)
text = replace_once(
    text,
    '''    const cards = curriculum.units
      .map((u) => {''',
    '''    const recent = Progress.latestLearning(curriculum.units);
    const recentUnit = recent ? curriculum.units.find((u) => u.id === recent.unitId) : null;
    const continueCard = recent && recentUnit ? `
      <div class="card" style="margin-bottom:24px;">
        <div class="section-title"><span class="seal">續</span>繼續上次學習</div>
        <p style="margin:0 0 6px; font-weight:700;">《${escapeHTML(recentUnit.title)}》 · ${escapeHTML(learningPathLabel(recent.path))}</p>
        <p style="margin:0 0 14px; color:var(--color-ink-soft); font-size:13px;">根據這部裝置最近的學習位置或活動紀錄。</p>
        <a class="btn btn-primary" href="#${escapeHTML(recent.path)}">繼續學習 →</a>
      </div>` : "";

    const cards = curriculum.units
      .map((u) => {''',
    'home continue state'
)
text = replace_once(
    text,
    '''      <h1 class="page-title">十二篇指定文言經典 · 自學地圖</h1>
      <p class="page-subtitle">診斷弱項 → 微型學習 → 練習回饋 → 錯題修復 → 作品／進度累積</p>
      <div class="map-grid">${cards}</div>''',
    '''      <h1 class="page-title">十二篇指定文言經典 · 自學地圖</h1>
      <p class="page-subtitle">診斷弱項 → 微型學習 → 練習回饋 → 錯題修復 → 作品／進度累積</p>
      ${continueCard}
      <div class="map-grid">${cards}</div>''',
    'home continue card'
)
text = replace_once(
    text,
    '''    setCrumb(`《${bundle.unit.title}》`);
    onReady(bundle);''',
    '''    setCrumb(`《${bundle.unit.title}》`);
    const currentPath = Router.currentPath();
    if (currentPath !== `/unit/${unitId}`) Progress.recordLearningVisit(unitId, currentPath);
    onReady(bundle);''',
    'record learning visit'
)
path.write_text(text)

# content-renderer.js — show an evidence-based next-step card on each unit home.
path = Path("js/content-renderer.js")
text = path.read_text()
text = replace_once(
    text,
    '''    const background = bundle.background || {};
    const backgroundCards = [''',
    '''    const background = bundle.background || {};
    const nextStep = Progress.recommendNextStep(unitId);
    const backgroundCards = [''',
    'unit next step state'
)
text = replace_once(
    text,
    '''      ${backgroundCards ? `
        <div class="section-title"><span class="seal">知</span>作者與背景</div>
        <div class="module-grid" style="margin-bottom:24px;">${backgroundCards}</div>
      ` : ""}
      <div class="module-grid">${cards}</div>''',
    '''      <div class="card" style="margin-bottom:24px;">
        <div class="section-title"><span class="seal">步</span>建議下一步</div>
        <p style="margin:0 0 8px; font-weight:700;">${esc(nextStep.label)}</p>
        <p style="margin:0 0 8px; color:var(--color-ink-soft); line-height:1.7;">${esc(nextStep.reason)}</p>
        <p style="margin:0 0 14px; color:var(--color-ink-faint); font-size:12px;">建議只根據這部裝置的作答、背誦、自評與反思紀錄，不等同系統判定你已掌握前一階段。</p>
        <a class="btn btn-primary" href="#${esc(nextStep.path)}">${esc(nextStep.label)} →</a>
      </div>
      ${backgroundCards ? `
        <div class="section-title"><span class="seal">知</span>作者與背景</div>
        <div class="module-grid" style="margin-bottom:24px;">${backgroundCards}</div>
      ` : ""}
      <div class="module-grid">${cards}</div>''',
    'unit next step card'
)
path.write_text(text)

print('Learning continuity patch applied.')
