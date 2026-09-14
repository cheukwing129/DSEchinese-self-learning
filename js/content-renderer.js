/* ============================================================
   content-renderer.js — 篇章首頁及各內容模組頁面（非題目頁）
   ============================================================ */

const ContentRenderer = (() => {
  const esc = App.escapeHTML;

  function moduleHref(unitId, moduleId) {
    return `#/unit/${unitId}/${moduleId === "progress" ? "progress" : moduleId}`;
  }

  function paragraphLabel(p) {
    return p.label || `第${p.id}段`;
  }

  function themeSummaryHTML(appreciation) {
    const summary = appreciation.theme_summary || appreciation.overview || "";
    const keyThemes = appreciation.key_themes || [];
    let html = summary ? `<p style="margin:0; line-height:1.9;">${esc(summary)}</p>` : "";
    if (keyThemes.length) {
      html += `<ul class="scoring-elements" style="margin-top:${summary ? "12px" : "0"};">${keyThemes.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>`;
    }
    return html || `<p style="margin:0; color:var(--color-ink-soft);">本篇主旨資料尚待補充。</p>`;
  }

  function backgroundCardHTML(value, fallbackTitle) {
    if (!value) return "";
    const title = typeof value === "object" ? (value.title || fallbackTitle) : fallbackTitle;
    const content = typeof value === "object" ? value.content : value;
    if (!content) return "";
    return `<details class="card card-tight">
      <summary style="cursor:pointer; font-weight:700;">${esc(title)}</summary>
      <p style="margin:12px 0 0; line-height:1.9; color:var(--color-ink-soft);">${esc(content)}</p>
    </details>`;
  }

  function rubricChecklist(rubrics) {
    if (!rubrics || typeof rubrics !== "object") return [];
    if (Array.isArray(rubrics.self_review_checklist)) return rubrics.self_review_checklist;
    if (Array.isArray(rubrics.self_check_prompts)) return rubrics.self_check_prompts;
    return [];
  }

  function renderCrossUnitOverview(curriculum, unitBundles) {
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
        ${overview.totalCurrentWrong ? `<a class="btn btn-primary" style="margin-top:14px;" href="#/overview/retry/all">重練全部待修正 →</a>` : ""}
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

  function renderUnitHome(bundle, unitId) {
    const u = bundle.unit;
    const background = bundle.background || {};
    const nextStep = Progress.recommendNextStep(unitId);
    const backgroundCards = [
      backgroundCardHTML(background.author_intro, "作者簡介"),
      backgroundCardHTML(background.writing_background, "寫作背景")
    ].filter(Boolean).join("");
    const moduleDescs = {
      text: "全文分段、點字看注釋、朗讀提示",
      words: "實詞／虛詞／通假／古今義",
      comprehension: "白話理解、段意、內容理解練習",
      analysis: "結構圖、景情配對、手法賞析",
      theme: "主旨解說、生活反思、開放題",
      memorisation: "句群背誦、遮字、重組",
      challenge: "整合各分類抽題，標示需補強範疇與補救",
      progress: "能力分項、錯題、背誦重溫、反思"
    };
    const coreIds = new Set(["text", "words", "comprehension", "analysis", "theme"]);
    const moduleCard = (m, index) => `
      <a class="module-card card-tappable" href="${moduleHref(unitId, m.id)}">
        <span class="module-order">${String(index + 1).padStart(2, "0")}</span>
        <div class="module-icon" aria-hidden="true">${App.moduleIconGlyph(m.icon)}</div>
        <div class="module-copy">
          <p class="module-name">${esc(m.title)}</p>
          <p class="module-desc">${esc(moduleDescs[m.id] || "")}</p>
        </div>
        <span class="module-arrow" aria-hidden="true">→</span>
      </a>`;
    const coreModules = u.modules.filter((m) => coreIds.has(m.id));
    const practiceModules = u.modules.filter((m) => !coreIds.has(m.id));
    const coreCards = coreModules.map((m, index) => moduleCard(m, index)).join("");
    const practiceCards = practiceModules.map((m, index) => moduleCard(m, coreModules.length + index)).join("");

    App.mount(`
      <header class="unit-hero">
        <p class="unit-kicker">${esc(u.dynasty)} · ${esc(u.genre)}</p>
        <h1 class="unit-title">《${esc(u.title)}》</h1>
        <p class="unit-author">${esc(u.author)}</p>
      </header>

      <section class="next-step-panel" aria-labelledby="next-step-title">
        <div class="next-step-copy">
          <p class="section-kicker">建議下一步</p>
          <h2 id="next-step-title">${esc(nextStep.label)}</h2>
          <p class="next-step-reason">${esc(nextStep.reason)}</p>
          <p class="next-step-note">建議只根據這部裝置的作答、背誦、自評與反思紀錄，不等同系統判定你已掌握前一階段。</p>
        </div>
        <a class="btn btn-primary next-step-button" href="#${esc(nextStep.path)}">${esc(nextStep.label)} <span aria-hidden="true">→</span></a>
      </section>

      <section class="unit-section" aria-labelledby="core-learning-title">
        <div class="unit-section-heading">
          <div>
            <p class="section-kicker">核心學習</p>
            <h2 id="core-learning-title">先讀懂，再看深一層</h2>
          </div>
          <p>原文、字詞、文意、結構與主旨依次展開；不必一次完成所有模組。</p>
        </div>
        <div class="module-grid module-grid-core">${coreCards}</div>
      </section>

      ${practiceCards ? `
        <section class="unit-section" aria-labelledby="practice-title">
          <div class="unit-section-heading compact">
            <div>
              <p class="section-kicker">鞏固與挑戰</p>
              <h2 id="practice-title">把理解變成可用的能力</h2>
            </div>
          </div>
          <div class="module-grid module-grid-practice">${practiceCards}</div>
        </section>
      ` : ""}

      ${backgroundCards ? `
        <section class="unit-section unit-background-section" aria-labelledby="background-title">
          <div class="unit-section-heading compact">
            <div>
              <p class="section-kicker">延伸閱讀</p>
              <h2 id="background-title">作者與背景</h2>
            </div>
          </div>
          <div class="background-grid">${backgroundCards}</div>
        </section>
      ` : ""}

      <section class="cross-text-panel" aria-labelledby="cross-text-title">
        <div>
          <p class="section-kicker">選做 · 進階</p>
          <h2 id="cross-text-title">跨篇比較與進階題</h2>
          <p>如尚未學習相關篇章，可先略過；完成更多篇章後再回來比較會更有價值。</p>
        </div>
        <a class="home-text-link" href="#/unit/${unitId}/cross-text">前往跨篇比較 <span aria-hidden="true">→</span></a>
      </section>

      ${App.footerNav(null, null).replace('<div class="footer-nav">', '<div class="footer-nav unit-footer-nav">')}
    `);
  }

  function audioPlayerHTML(unit) {
    if (!unit.audio_file) return "";
    return `
      <div class="card card-tight" style="margin-bottom:16px;">
        <p style="font-size:13px; color:var(--color-ink-soft); margin:0 0 8px;">🔊 全文誦讀</p>
        <audio controls style="width:100%;" preload="none">
          <source src="${esc(unit.audio_file)}" type="audio/mpeg" />
          你的瀏覽器不支援音訊播放，請直接開啟：<a href="${esc(unit.audio_file)}">${esc(unit.audio_file)}</a>
        </audio>
      </div>
    `;
  }

  // ---------- 1. 原文與誦讀 ----------
  function renderTextPage(bundle, unitId) {
    const { text, unit } = bundle;
    const annoMap = {};
    text.annotations.forEach((a) => (annoMap[a.id] = a));

    // 若段落有 section 欄位（如論仁/論孝/論君子），按 section 分組導覽；
    // 否則逐段／逐聯／逐片導覽，優先使用資料中的 label。
    const hasSections = text.paragraphs.some((p) => p.section);
    let groups;
    if (hasSections) {
      const order = [];
      const map = {};
      text.paragraphs.forEach((p) => {
        if (!map[p.section]) {
          map[p.section] = [];
          order.push(p.section);
        }
        map[p.section].push(p);
      });
      groups = order.map((label) => ({ label, paragraphs: map[label] }));
    } else {
      groups = text.paragraphs.map((p) => ({ label: paragraphLabel(p), paragraphs: [p] }));
    }

    let activeIndex = 0;

    function navHTML() {
      return `
        <div class="para-nav">
          ${groups
            .map((g, i) => `<button data-idx="${i}" class="${i === activeIndex ? "is-active" : ""}">${esc(g.label)}</button>`)
            .join("")}
        </div>
      `;
    }

    // 依 annotation term 在原文中「第 occurrence 次」出現的位置，包上可鍵盤操作的 button。
    // 用位置區間而非逐次字串取代，避免重複字詞互相干擾，亦避免長詞被短詞截斷。
    function paragraphHTML(p) {
      const terms = p.annotation_ids.map((id) => annoMap[id]).filter(Boolean);
      const matches = [];
      terms.forEach((a) => {
        const occurrence = a.occurrence || 1;
        let idx = -1, count = 0, searchFrom = 0;
        while (count < occurrence) {
          idx = p.text.indexOf(a.term, searchFrom);
          if (idx === -1) break;
          count++;
          searchFrom = idx + a.term.length;
        }
        if (idx !== -1 && count === occurrence) {
          matches.push({ start: idx, end: idx + a.term.length, anno: a });
        }
      });
      const claimed = [];
      matches
        .slice()
        .sort((x, y) => (y.end - y.start) - (x.end - x.start))
        .forEach((m) => {
          const overlap = claimed.some((c) => !(m.end <= c.start || m.start >= c.end));
          if (!overlap) claimed.push(m);
        });
      claimed.sort((x, y) => x.start - y.start);

      let html = "";
      let cursor = 0;
      claimed.forEach((m) => {
        html += esc(p.text.slice(cursor, m.start));
        html += `<button type="button" class="term" data-anno="${m.anno.id}" aria-haspopup="dialog" aria-label="查看「${esc(m.anno.term)}」注釋">${esc(p.text.slice(m.start, m.end))}</button>`;
        cursor = m.end;
      });
      html += esc(p.text.slice(cursor));
      return html;
    }

    function passageHTML(paragraphs) {
      return paragraphs
        .map(
          (p) => `
        <p class="text-passage">${paragraphHTML(p)}</p>
        <div class="para-summary"><strong>${paragraphs.length > 1 ? "" : "段意："}</strong>${esc(p.summary)}</div>
      `
        )
        .join(paragraphs.length > 1 ? '<div style="height:16px;"></div>' : "");
    }

    function renderShell() {
      App.mount(`
        <h1 class="page-title">原文與誦讀</h1>
        <p class="page-subtitle">《${esc(unit.title)}》· 點擊字詞或用鍵盤選取以查看注釋</p>
        ${audioPlayerHTML(unit)}
        <div class="card">
          <div id="text-nav-slot"></div>
          <div id="text-passage-slot"></div>
        </div>
        <div class="card">
          <p style="color:var(--color-ink-soft); font-size:14px; margin:0;">
            意群停頓提示尚未提供，將於日後版本補充。
          </p>
        </div>
        ${App.footerNav(unitId, unit.title)}
      `);
      updateContent();
    }

    function updateContent() {
      document.getElementById("text-nav-slot").innerHTML = navHTML();
      document.getElementById("text-passage-slot").innerHTML = passageHTML(groups[activeIndex].paragraphs);
      document.querySelectorAll(".para-nav button").forEach((btn) => {
        btn.addEventListener("click", () => {
          activeIndex = parseInt(btn.dataset.idx, 10);
          updateContent();
        });
      });
      document.querySelectorAll(".term").forEach((button) => {
        button.addEventListener("click", (e) => showAnnotationPopover(e, annoMap[button.dataset.anno]));
      });
    }

    renderShell();
  }

  function showAnnotationPopover(evt, anno) {
    if (!anno) return;
    document.querySelectorAll(".annotation-popover, .annotation-backdrop").forEach((el) => el.remove());
    const backdrop = document.createElement("div");
    backdrop.className = "annotation-backdrop";
    const pop = document.createElement("div");
    pop.className = "annotation-popover";
    pop.setAttribute("role", "dialog");
    pop.setAttribute("aria-label", `「${anno.term}」注釋`);
    pop.tabIndex = -1;
    const reading = [anno.jyutping ? `粵：${anno.jyutping}` : "", anno.putonghua ? `普：${anno.putonghua}` : ""]
      .filter(Boolean).join("　");
    pop.innerHTML = `
      <button type="button" class="annotation-close" aria-label="關閉注釋">×</button>
      <div class="term-name">${App.escapeHTML(anno.term)}</div>
      ${reading ? `<div class="reading">${App.escapeHTML(reading)}</div>` : ""}
      <div>${App.escapeHTML(anno.explanation)}</div>
    `;
    document.body.appendChild(backdrop);
    document.body.appendChild(pop);
    const rect = evt.target.getBoundingClientRect();
    const top = Math.min(rect.bottom + 8, window.innerHeight - 120);
    let left = rect.left;
    if (left + 300 > window.innerWidth) left = window.innerWidth - 310;
    pop.style.top = `${top}px`;
    pop.style.left = `${Math.max(10, left)}px`;
    const closePopover = () => {
      pop.remove();
      backdrop.remove();
      if (evt.target && typeof evt.target.focus === "function") evt.target.focus();
    };
    backdrop.addEventListener("click", closePopover);
    pop.querySelector(".annotation-close").addEventListener("click", closePopover);
    pop.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closePopover();
    });
    pop.focus();
  }

  // ---------- 2. 字詞與句式 ----------
  function renderWordsPage(bundle, unitId) {
    const { text, unit } = bundle;
    const cards = text.annotations
      .map(
        (a) => `
        <div class="card card-tight">
          <p style="font-family:var(--font-display); font-weight:700; font-size:16px; margin:0 0 4px;">${esc(a.term)}</p>
          <p style="margin:0; font-size:14px; color:var(--color-ink-soft);">${esc(a.explanation)}</p>
        </div>`
      )
      .join("");

    App.mount(`
      <h1 class="page-title">字詞與句式</h1>
      <p class="page-subtitle">教育局核心注釋整理（實詞／虛詞／通假／古今義）</p>
      <a class="btn btn-primary" href="#/unit/${unitId}/words/quiz">開始字詞與虛詞題庫 →</a>
      <div style="height:20px;"></div>
      <div class="module-grid">${cards}</div>
      ${App.footerNav(unitId, unit.title)}
    `);
  }

  // ---------- 3. 疏通文意 ----------
  function renderComprehensionPage(bundle, unitId) {
    const { text, unit } = bundle;
    const cards = text.paragraphs
      .map(
        (p) => `
        <div class="card">
          <div class="section-title"><span class="seal">${esc(p.id)}</span>${esc(paragraphLabel(p))}</div>
          <p class="text-passage" style="font-size:16px;">${esc(p.text)}</p>
          <div class="para-summary"><strong>段意：</strong>${esc(p.summary)}</div>
        </div>`
      )
      .join("");

    App.mount(`
      <h1 class="page-title">疏通文意</h1>
      <p class="page-subtitle">逐段原文、段意與內容理解</p>
      <a class="btn btn-primary" href="#/unit/${unitId}/comprehension/quiz">開始內容理解題庫 →</a>
      <div style="height:20px;"></div>
      ${cards}
      ${App.footerNav(unitId, unit.title)}
    `);
  }

  // ---------- 4. 結構與鑒賞 ----------
  function renderAnalysisPage(bundle, unitId) {
    const { structure, unit } = bundle;
    const nodes = structure.nodes || [];
    const contrasts = structure.contrast_pairs || [];
    const techniques = structure.techniques || [];
    const flow = nodes
      .map(
        (n, i) => `
        <div class="card card-tight" style="display:flex; gap:12px; align-items:flex-start;">
          <div class="module-icon">${i + 1}</div>
          <div>
            <p style="font-weight:700; margin:0 0 4px;">${esc(n.label)}${n.paragraph != null ? `<span style="font-weight:400; color:var(--color-ink-faint); font-size:12px;"> ・第${esc(n.paragraph)}段</span>` : ""}</p>
            <p style="margin:0; font-size:14px; color:var(--color-ink-soft);">${esc(n.description)}</p>
          </div>
        </div>`
      )
      .join(`<div style="text-align:center; color:var(--color-ink-faint); margin: -4px 0;">↓</div>`);

    const contrastCards = contrasts
      .map(
        (c) => `
        <div class="card">
          <p class="section-title" style="font-size:16px;">${esc(c.label)}</p>
          <div style="display:flex; gap:16px; flex-wrap:wrap;">
            <div style="flex:1; min-width:180px; background:var(--color-dusk-soft); border-radius:12px; padding:12px;">
              <strong>${esc(c.left.title)}</strong>
              <p style="font-size:13px; margin:6px 0 0;">${esc(c.left.keywords ? c.left.keywords.join("、") : c.left.trait)}</p>
              ${c.left.emotion ? `<p style="font-size:13px; margin:4px 0 0; color:var(--color-accent);">→ ${esc(c.left.emotion)}</p>` : ""}
            </div>
            <div style="flex:1; min-width:180px; background:var(--color-jade-soft); border-radius:12px; padding:12px;">
              <strong>${esc(c.right.title)}</strong>
              <p style="font-size:13px; margin:6px 0 0;">${esc(c.right.keywords ? c.right.keywords.join("、") : c.right.trait)}</p>
              ${c.right.emotion ? `<p style="font-size:13px; margin:4px 0 0; color:var(--color-jade);">→ ${esc(c.right.emotion)}</p>` : ""}
            </div>
          </div>
        </div>`
      )
      .join("");

    const techniqueCards = techniques
      .map((t) => `<div class="card card-tight"><strong>${esc(t.name)}</strong><p style="margin:6px 0 0; font-size:13px; color:var(--color-ink-soft);">${esc(t.example)}</p></div>`)
      .join("");

    App.mount(`
      <h1 class="page-title">結構與鑒賞</h1>
      <p class="page-subtitle">《${esc(unit.title)}》篇章結構、對比與寫作手法</p>
      <div style="margin-bottom:24px;">${flow || `<p class="empty-state">本篇暫未提供結構圖。</p>`}</div>

      ${contrastCards ? `<div class="section-title"><span class="seal">對</span>對比與照應</div>${contrastCards}` : ""}

      ${techniqueCards ? `<div class="section-title" style="margin-top:24px;"><span class="seal">法</span>寫作手法與語言特色</div><div class="module-grid">${techniqueCards}</div>` : ""}

      <a class="btn btn-primary" style="margin-top:20px;" href="#/unit/${unitId}/analysis/quiz">開始結構與手法題庫 →</a>
      ${App.footerNav(unitId, unit.title)}
    `);
  }

  // ---------- 5. 主旨與思考 ----------
  function renderThemePage(bundle, unitId) {
    const { appreciation, unit } = bundle;
    const savedReflection = Progress.getReflection(unitId, "theme");

    App.mount(`
      <h1 class="page-title">主旨與思考</h1>
      <p class="page-subtitle">《${esc(unit.title)}》主旨、情感與價值思考</p>
      <div class="card">
        ${themeSummaryHTML(appreciation)}
      </div>

      <div class="card">
        <div class="section-title"><span class="seal">思</span>生活情境與個人反思</div>
        <p style="font-size:14px; color:var(--color-ink-soft);">閱讀以上主旨後，哪一個觀點、情感或人物選擇最令你有感？試結合《${esc(unit.title)}》的內容，聯繫自己的生活或學習經驗寫下反思。（此欄只儲存在你自己的裝置上）</p>
        <textarea id="theme-reflection" class="answer-input" placeholder="在此輸入你的想法…">${esc(savedReflection)}</textarea>
        <div class="btn-row">
          <button class="btn btn-primary" id="save-reflection-btn">儲存反思</button>
          <span id="reflection-saved-hint" style="font-size:13px; color:var(--color-jade); align-self:center; display:none;">已儲存 ✓</span>
        </div>
      </div>

      <a class="btn btn-primary" href="#/unit/${unitId}/theme/quiz">開始主旨與思考題庫（含開放題）→</a>
      <div style="height:16px;"></div>
      ${App.footerNav(unitId, unit.title)}
    `);

    document.getElementById("save-reflection-btn").addEventListener("click", () => {
      const val = document.getElementById("theme-reflection").value;
      Progress.saveReflection(unitId, "theme", val);
      const hint = document.getElementById("reflection-saved-hint");
      hint.style.display = "inline";
      setTimeout(() => (hint.style.display = "none"), 2000);
    });
  }

  // ---------- 跨篇比較與進階題 ----------
  function renderCrossTextPage(bundle, unitId) {
    const { unit } = bundle;
    const targets = unit.cross_text_targets || [];
    const cards = targets
      .map(
        (t) => `
        <a class="card module-card card-tappable" href="#/unit/${unitId}/cross-text/quiz/${t.id}">
          <div class="module-icon">跨</div>
          <div>
            <p class="module-name">${esc(t.title)}</p>
            <p class="module-desc">${esc(t.author)}</p>
          </div>
        </a>`
      )
      .join("");

    App.mount(`
      <h1 class="page-title">跨篇比較與進階題</h1>
      <div class="cross-text-banner">選做：如尚未學習相關篇章，可先略過；學習後再回來挑戰。</div>
      <div class="module-grid">${cards}</div>
      <a class="btn btn-secondary" style="margin-top:16px;" href="#/unit/${unitId}/cross-text/quiz/all">挑戰全部跨篇題目 →</a>
      ${App.footerNav(unitId, unit.title)}
    `);
  }

  // ---------- 我的掌握 ----------
  function renderProgressPage(bundle, unitId) {
    const { unit, allQuestions } = bundle;
    const overall = Progress.overallAccuracy(unitId, allQuestions);
    const abilities = Progress.abilityStats(unitId, allQuestions);
    const wrongIds = Progress.wrongQuestionIds(unitId, allQuestions);
    const everWrongIds = Progress.everWrongQuestionIds(unitId, allQuestions);
    const resolvedWrongIds = Progress.resolvedWrongQuestionIds(unitId, allQuestions);
    const wrongQuestions = allQuestions.filter((q) => wrongIds.includes(q.id));
    const reflection = Progress.getReflection(unitId, "theme");
    const memoStats = Progress.memorisationStats(unitId, (bundle.memorisation && bundle.memorisation.sentence_groups) || []);
    const selfReviewItems = rubricChecklist(bundle.rubrics);
    const savedSelfReview = Progress.getSelfReview(unitId);

    const abilityRows = Object.keys(abilities)
      .map((ab) => {
        const s = abilities[ab];
        const pct = s.answered ? Math.round((s.correct / s.answered) * 100) : 0;
        return `
          <div style="margin-bottom:14px;">
            <div style="display:flex; justify-content:space-between; font-size:14px;">
              <span>${esc(ab)}</span>
              <span style="color:var(--color-ink-soft);">${s.answered}/${s.total} 已作答 · ${s.answered ? pct + "%" : "—"}</span>
            </div>
            <div class="bar-track"><div class="bar-fill" style="width:${s.answered ? pct : 0}%;"></div></div>
          </div>`;
      })
      .join("");

    const memorisationRows = memoStats.groups
      .map((g) => {
        const clozeText = g.cloze && g.cloze.attempts
          ? `遮字最高 ${g.cloze.bestRate == null ? "—" : g.cloze.bestRate + "%"}（${g.cloze.attempts} 次）`
          : "遮字未練習";
        const reorderText = g.reorder && g.reorder.attempts
          ? (g.reorder.passed ? `重組曾排對（${g.reorder.attempts} 次嘗試）` : `重組尚未排對（${g.reorder.attempts} 次嘗試）`)
          : "重組未練習";
        return `
          <div style="padding:10px 0; border-bottom:1px solid var(--color-border);">
            <div style="display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap; font-size:14px;">
              <strong>${esc(g.title)}</strong>
              <span style="color:var(--color-ink-soft);">${clozeText} · ${reorderText}</span>
            </div>
            <div class="bar-track" style="margin-top:7px;"><div class="bar-fill" style="width:${g.cloze && g.cloze.bestRate != null ? g.cloze.bestRate : 0}%;"></div></div>
          </div>`;
      })
      .join("");

    const selfReviewList = selfReviewItems
      .map((item) => `
        <label class="option-item" style="cursor:pointer; align-items:flex-start;">
          <input type="checkbox" class="self-review-check" data-review-key="${esc(item)}" ${savedSelfReview[item] ? "checked" : ""} style="width:18px; height:18px; margin-top:2px; flex-shrink:0;" />
          <span>${esc(item)}</span>
        </label>`)
      .join("");

    const wrongList = wrongQuestions.length
      ? wrongQuestions
          .map((q) => {
            const bankName = bankNameForQuestion(bundle, q);
            const idx = (bundle.banks[bankName] || []).findIndex((x) => x.id === q.id);
            const link = quizLinkFor(unitId, bankName, idx, q);
            return `
            <a class="card card-tight card-tappable" href="${link}" style="display:block;">
              <span class="tag">${esc(q.ability)}</span>
              <p style="margin:8px 0 0; font-size:14px;">${esc(q.stem.slice(0, 60))}${q.stem.length > 60 ? "…" : ""}</p>
            </a>`;
          })
          .join("")
      : `<p class="empty-state" style="padding:20px;">暫無錯題，繼續保持！</p>`;

    App.mount(`
      <h1 class="page-title">我的掌握</h1>
      <p class="page-subtitle">《${esc(unit.title)}》學習進度（只儲存在此裝置的瀏覽器）</p>

      <div class="card">
        <div class="stat-grid">
          <div class="stat-card">
            <div class="stat-value">${overall.rate == null ? "—" : overall.rate + "%"}</div>
            <div class="stat-label">整體正確率</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${overall.answered}</div>
            <div class="stat-label">已作答客觀題</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${wrongQuestions.length}</div>
            <div class="stat-label">待修正錯題</div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="section-title"><span class="seal">分</span>能力分項</div>
        ${abilityRows || `<p class="empty-state">尚未有作答紀錄。</p>`}
      </div>

      ${selfReviewList ? `
      <div class="card">
        <div class="section-title"><span class="seal">檢</span>自我檢核</div>
        <p style="font-size:13px; color:var(--color-ink-soft); margin:0 0 12px;">這是你自己的學習檢核紀錄，只表示「我認為自己能做到」，不計入正確率，也不會被系統當成已掌握。</p>
        <div class="option-list">${selfReviewList}</div>
      </div>` : ""}

      <div class="card">
        <div class="section-title"><span class="seal">背</span>背誦練習</div>
        <div class="stat-grid" style="margin-bottom:14px;">
          <div class="stat-card">
            <div class="stat-value">${memoStats.practisedGroups}/${memoStats.totalGroups}</div>
            <div class="stat-label">已練習句群</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${memoStats.clozePractisedGroups}</div>
            <div class="stat-label">做過遮字</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${memoStats.reorderPassedGroups}</div>
            <div class="stat-label">重組曾排對</div>
          </div>
        </div>
        ${memorisationRows || `<p class="empty-state">本篇尚未提供背誦句群。</p>`}
        <p style="font-size:13px; color:var(--color-ink-soft); margin:12px 0 0;">易錯字重溫：${memoStats.charsViewed ? "已開啟重溫" : "尚未重溫"}</p>
        <a class="btn btn-secondary" style="margin-top:12px;" href="#/unit/${unitId}/memorisation">前往背誦精華 →</a>
      </div>

      <div class="section-title"><span class="seal">錯</span>待修正錯題</div>
      <div class="card card-tight" style="margin-bottom:12px;">
        <div style="display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap; align-items:center;">
          <div>
            <strong>曾答錯 ${everWrongIds.length} 題 · 已修正 ${resolvedWrongIds.length} 題</strong>
            <p style="margin:5px 0 0; font-size:13px; color:var(--color-ink-soft);">待修正只看最後一次客觀題答案；答對後會移出清單，但錯誤歷史不會刪除。</p>
          </div>
          ${wrongQuestions.length ? `<a class="btn btn-primary" href="#/unit/${unitId}/progress/retry-wrong">一鍵重練 ${wrongQuestions.length} 題 →</a>` : ""}
        </div>
      </div>
      <div class="module-grid">${wrongList}</div>

      ${reflection ? `
      <div class="card" style="margin-top:16px;">
        <div class="section-title"><span class="seal">思</span>我的反思</div>
        <p style="font-size:14px; white-space:pre-wrap;">${esc(reflection)}</p>
      </div>` : ""}

      <div class="btn-row">
        <button class="btn btn-ghost" id="clear-progress-btn">清除本篇進度</button>
      </div>

      ${App.footerNav(unitId, unit.title)}
    `);

    document.querySelectorAll(".self-review-check").forEach((box) => {
      box.addEventListener("change", () => {
        Progress.setSelfReviewItem(unitId, box.dataset.reviewKey, box.checked);
      });
    });

    document.getElementById("clear-progress-btn").addEventListener("click", () => {
      if (confirm("確定要清除《" + unit.title + "》的所有作答、背誦練習、自評檢核與反思紀錄嗎？此動作無法復原。")) {
        Progress.clearUnit(unitId);
        renderProgressPage(bundle, unitId);
      }
    });
  }

  function bankNameForQuestion(bundle, q) {
    return Object.keys(bundle.banks).find((name) => bundle.banks[name].some((x) => x.id === q.id));
  }

  function quizLinkFor(unitId, bankName, idx, q) {
    if (bankName === "cross-text") {
      return `#/unit/${unitId}/cross-text/quiz/${q.cross_text_target || "all"}?qid=${encodeURIComponent(q.id)}`;
    }
    const map = { words: "words", content: "comprehension", "structure-skill": "analysis", theme: "theme" };
    const seg = map[bankName] || bankName;
    return `#/unit/${unitId}/${seg}/quiz?qi=${idx >= 0 ? idx : 0}`;
  }

  return {
    renderCrossUnitOverview,
    renderUnitHome, renderTextPage, renderWordsPage, renderComprehensionPage,
    renderAnalysisPage, renderThemePage, renderCrossTextPage, renderProgressPage
  };
})();
