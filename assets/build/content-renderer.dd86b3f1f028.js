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
    const lead = overview.priorityUnits[0] || null;
    const leadHref = lead ? `#/unit/${lead.unitId}/progress/retry-wrong` : "#/";
    const leadLabel = lead ? `重練《${esc(lead.title)}》待修正錯題` : (overview.engagedUnits ? "回到篇章繼續學習" : "選一篇開始學習");
    const leadTitle = lead
      ? `先處理《${esc(lead.title)}》的 ${lead.currentWrong} 題待修正`
      : (overview.engagedUnits ? "目前沒有待修正的客觀題" : "從第一篇真實學習紀錄開始");
    const leadReason = lead
      ? `這篇目前留下 ${lead.currentWrong} 題待修正；曾答錯 ${lead.everWrong} 題，累積答錯 ${lead.wrongAttempts} 次。`
      : (overview.engagedUnits ? "你已有學習紀錄，但目前沒有最後一次仍答錯的客觀題。可回到篇章繼續作答、背誦或反思。" : "總覽只整理這部裝置真正留下的作答、背誦、自評與反思紀錄；開始學習後才會逐步出現。 ");

    const priorityHTML = overview.priorityUnits.length
      ? overview.priorityUnits.slice(0, 5).map((u, index) => `
        <article class="priority-card ${index === 0 ? "is-primary" : ""}">
          <div class="priority-rank" aria-hidden="true">${String(index + 1).padStart(2, "0")}</div>
          <div class="priority-copy">
            <div class="priority-heading">
              <div>
                <span class="priority-kicker">${index === 0 ? "現在先做" : "接著處理"}</span>
                <h3>《${esc(u.title)}》${u.author ? `<small>${esc(u.author)}</small>` : ""}</h3>
              </div>
              <span class="priority-count">${u.currentWrong}<small>待修正</small></span>
            </div>
            <p>曾答錯 ${u.everWrong} 題 · 累積答錯 ${u.wrongAttempts} 次${u.repeatedWrongQuestions ? ` · ${u.repeatedWrongQuestions} 題曾重複答錯` : ""}</p>
          </div>
          <a class="btn ${index === 0 ? "btn-primary" : "btn-secondary"}" href="#/unit/${u.unitId}/progress/retry-wrong">重練待修正錯題 →</a>
        </article>`).join("")
      : `<div class="progress-empty-card"><span aria-hidden="true">✓</span><div><strong>目前沒有待修正錯題</strong><p>如有歷史錯題，仍可在各篇「我的掌握」查看已修正紀錄。</p></div></div>`;

    const abilityHTML = overview.abilities.length
      ? overview.abilities.slice(0, 10).map((a, index) => `
        <article class="ability-evidence-row">
          <div class="ability-rank">${String(index + 1).padStart(2, "0")}</div>
          <div class="ability-evidence-copy">
            <strong>${esc(a.ability)}</strong>
            <p>待修正 ${a.currentWrongQuestions} 題 · 曾答錯 ${a.everWrongQuestions} 題 · 累積答錯 ${a.wrongAttempts} 次</p>
            <small>涉及 ${a.everWrongUnits} 篇${a.currentWrongUnits ? `；其中 ${a.currentWrongUnits} 篇仍有待修正題目` : ""}${a.repeatedWrongQuestions ? `；${a.repeatedWrongQuestions} 題曾重複答錯` : ""}</small>
          </div>
          ${a.currentWrongQuestions ? `<a class="btn btn-secondary" href="#/overview/retry/${encodeURIComponent(a.ability)}">重練此能力 →</a>` : `<span class="evidence-resolved">已無待修正</span>`}
        </article>`).join("")
      : `<div class="progress-empty-card compact"><span aria-hidden="true">○</span><div><strong>尚未有客觀題錯題紀錄</strong><p>作答後，這裡才會按真實錯題證據整理能力範疇。</p></div></div>`;

    const unitHTML = unitsWithEvidence.length
      ? unitsWithEvidence.sort((a, b) =>
          b.currentWrong - a.currentWrong ||
          b.everWrong - a.everWrong ||
          b.evidenceAt - a.evidenceAt
        ).map((u) => `
          <article class="unit-evidence-card">
            <div class="unit-evidence-head">
              <div><h3>《${esc(u.title)}》</h3>${u.author ? `<p>${esc(u.author)}</p>` : ""}</div>
              <span class="unit-evidence-status ${u.currentWrong ? "needs-work" : "is-clear"}">${u.currentWrong ? `${u.currentWrong} 題待修正` : "目前已修正"}</span>
            </div>
            <div class="unit-evidence-metrics">
              <span><strong>${u.answered}</strong>已作答客觀題</span>
              <span><strong>${u.everWrong}</strong>曾答錯</span>
              <span><strong>${u.resolvedWrong}</strong>曾錯後已修正</span>
            </div>
            <div class="unit-evidence-actions">
              ${u.currentWrong ? `<a class="btn btn-primary" href="#/unit/${u.unitId}/progress/retry-wrong">重練錯題</a>` : ""}
              <a class="btn btn-secondary" href="#/unit/${u.unitId}/progress">查看掌握</a>
            </div>
          </article>`).join("")
      : `<div class="progress-empty-card wide"><span aria-hidden="true">文</span><div><strong>這部裝置尚未有跨篇章紀錄</strong><p>先選一篇開始學習及作答，之後這裡才會整理真實紀錄。</p></div></div>`;

    App.mount(`
      <header class="progress-hero overview-hero">
        <div class="progress-hero-copy">
          <p class="section-kicker">跨篇章學習總覽</p>
          <h1 class="page-title">${leadTitle}</h1>
          <p class="progress-hero-reason">${leadReason}</p>
          <p class="progress-honesty-note">整合這部裝置上的真實紀錄；不產生虛假的總掌握百分比。</p>
        </div>
        <div class="progress-hero-action">
          <span class="progress-action-label">NEXT</span>
          <a class="btn btn-primary" href="${leadHref}">${leadLabel} <span aria-hidden="true">→</span></a>
        </div>
      </header>

      <section class="evidence-strip" aria-label="跨篇章紀錄摘要">
        <div><span>${overview.engagedUnits}/${overview.totalUnits}</span><small>有學習活動篇章</small></div>
        <div><span>${overview.totalAnswered}</span><small>已作答客觀題</small></div>
        <div class="${overview.totalCurrentWrong ? "needs-attention" : ""}"><span>${overview.totalCurrentWrong}</span><small>目前待修正</small></div>
        <div><span>${overview.totalResolvedWrong}</span><small>曾錯後已修正</small></div>
      </section>
      <p class="evidence-footnote">「有學習活動」只表示曾留下作答、背誦、自評或反思紀錄，不代表完成或掌握該篇。</p>

      <section class="progress-section" aria-labelledby="priority-title">
        <div class="progress-section-heading">
          <div><p class="section-kicker">優先次序</p><h2 id="priority-title">現在最值得處理的篇章</h2></div>
          ${overview.totalCurrentWrong ? `<a class="btn btn-secondary" href="#/overview/retry/all">重練全部待修正</a>` : ""}
        </div>
        <p class="progress-method-note">排序規則：待修正錯題數 → 重複答錯題數 → 累積答錯次數 → 最近學習活動。這是整理紀錄，不是能力評分。</p>
        <div class="priority-stack">${priorityHTML}</div>
      </section>

      <section class="progress-section progress-split-section" aria-labelledby="ability-title">
        <div class="progress-section-heading">
          <div><p class="section-kicker">錯題證據</p><h2 id="ability-title">錯題集中在哪些能力</h2></div>
        </div>
        <p class="progress-method-note">按目前待修正題數及歷史答錯次數排列；同一題多次答錯會保留為歷史證據。</p>
        <div class="ability-evidence-list">${abilityHTML}</div>
      </section>

      <section class="progress-section" aria-labelledby="units-title">
        <div class="progress-section-heading">
          <div><p class="section-kicker">篇章紀錄</p><h2 id="units-title">逐篇查看真實學習證據</h2></div>
        </div>
        <div class="unit-evidence-grid">${unitHTML}</div>
      </section>
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
      <a class="module-card module-card-${m.id} ${m.id === "text" ? "module-card-featured" : ""} card-tappable" href="${moduleHref(unitId, m.id)}">
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
        <div class="unit-hero-copy">
          <div class="unit-meta-row">
            <p class="unit-kicker">${esc(u.dynasty)} · ${esc(u.genre)}</p>
            <span class="unit-mode-pill">篇章學習</span>
          </div>
          <h1 class="page-title unit-title">《${esc(u.title)}》</h1>
          <p class="unit-author">${esc(u.author)}</p>
          <div class="unit-flow-mini" aria-label="建議學習方向">
            <span>讀原文</span><i aria-hidden="true">→</i><span>疏文意</span><i aria-hidden="true">→</i><span>看賞析</span><i aria-hidden="true">→</i><span>做練習</span>
          </div>
        </div>
        <div class="unit-hero-art" aria-hidden="true">
          <span class="unit-art-orbit orbit-one"></span>
          <span class="unit-art-orbit orbit-two"></span>
          <div class="unit-monogram">${esc((u.title || "篇").slice(0, 1))}</div>
          <span class="unit-art-caption">讀 · 解 · 析 · 練</span>
        </div>
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
    const totalAnnotations = text.annotations.length;

    function navHTML() {
      return `
        <div class="reader-nav" role="tablist" aria-label="原文段落導航">
          ${groups.map((g, i) => `
            <button type="button" role="tab" id="reader-tab-${i}" aria-controls="reader-passage" aria-selected="${i === activeIndex ? "true" : "false"}" data-idx="${i}" class="${i === activeIndex ? "is-active" : ""}">
              <span class="reader-nav-index">${String(i + 1).padStart(2, "0")}</span>
              <span class="reader-nav-label">${esc(g.label)}</span>
            </button>`).join("")}
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
      return paragraphs.map((p, index) => {
        const annotationCount = (p.annotation_ids || []).filter((id) => annoMap[id]).length;
        const label = paragraphLabel(p);
        return `
          <article class="reader-paragraph-block" data-paragraph-id="${esc(p.id)}">
            <div class="reader-paragraph-meta">
              <span>${esc(label)}</span>
              ${annotationCount ? `<span>${annotationCount} 個注釋字詞</span>` : `<span>純讀原文</span>`}
            </div>
            <p class="text-passage">${paragraphHTML(p)}</p>
            <div class="para-summary">
              <span class="para-summary-label">${paragraphs.length > 1 ? `${esc(label)} · 段意` : "段意"}</span>
              <p>${esc(p.summary)}</p>
            </div>
          </article>
        `;
      }).join("");
    }

    function renderShell() {
      const dynastyGenre = [unit.dynasty, unit.genre].filter(Boolean).map(esc).join(" · ");
      App.mount(`
        <div class="reader-shell">
          <header class="reader-hero">
            <div class="reader-hero-copy">
              <p class="section-kicker">原文閱讀${dynastyGenre ? ` · ${dynastyGenre}` : ""}</p>
              <h1 class="page-title reader-page-title">原文與誦讀</h1>
              <p class="reader-work-title">《${esc(unit.title)}》</p>
              <p class="reader-work-author">${esc(unit.author || "")}</p>
              <p class="reader-intro">先把注意力留給原文。需要時再點開注釋，讀完一節後才看段意，讓理解建立在自己的閱讀上。</p>
            </div>
            <div class="reader-hero-stats" aria-label="閱讀資料摘要">
              <div><strong>${groups.length}</strong><span>閱讀節點</span></div>
              <div><strong>${text.paragraphs.length}</strong><span>原文段落</span></div>
              <div><strong>${totalAnnotations}</strong><span>注釋條目</span></div>
            </div>
          </header>

          <div class="reader-layout">
            <aside class="reader-sidebar" aria-label="閱讀工具">
              <div class="reader-sidebar-sticky">
                <div class="reader-sidebar-heading">
                  <p class="section-kicker">Reading map</p>
                  <strong>段落導航</strong>
                </div>
                <div id="text-nav-slot"></div>
                <div class="reader-legend"><span aria-hidden="true">文</span><p>有細底線的字詞可點擊或用鍵盤選取，查看注釋。</p></div>
                ${unit.audio_file ? `<div class="reader-audio-wrap">${audioPlayerHTML(unit)}</div>` : ""}
              </div>
            </aside>

            <main class="reader-paper" aria-label="《${esc(unit.title)}》原文閱讀區">
              <div class="reader-paper-head">
                <div>
                  <p class="reader-step" id="reader-step"></p>
                  <h2 class="reader-section-title" id="reader-section-title" tabindex="-1"></h2>
                </div>
                <span class="reader-paper-mark" aria-hidden="true">讀</span>
              </div>
              <div id="reader-passage" class="reader-passage" role="tabpanel" aria-live="polite"></div>
              <nav class="reader-section-nav" aria-label="前後段落">
                <button type="button" class="reader-step-button" id="reader-prev-btn"><span aria-hidden="true">←</span> 上一節</button>
                <span id="reader-section-count" aria-hidden="true"></span>
                <button type="button" class="reader-step-button is-next" id="reader-next-btn">下一節 <span aria-hidden="true">→</span></button>
              </nav>
            </main>
          </div>

          <aside class="reader-study-note">
            <span class="reader-note-mark" aria-hidden="true">讀</span>
            <div><strong>閱讀順序</strong><p>原文 → 必要時看注釋 → 完成一節 → 再核對段意。段意是理解輔助，不代表唯一可接受的概括方式。</p></div>
          </aside>
        </div>
        ${App.footerNav(unitId, unit.title)}
      `);
      updateContent();
    }

    function setActive(nextIndex, { focusHeading = false } = {}) {
      const bounded = Math.max(0, Math.min(groups.length - 1, nextIndex));
      if (bounded === activeIndex && !focusHeading) return;
      activeIndex = bounded;
      updateContent();
      if (focusHeading) {
        const heading = document.getElementById("reader-section-title");
        if (heading) heading.focus({ preventScroll: true });
      }
    }

    function updateContent() {
      const group = groups[activeIndex];
      const navSlot = document.getElementById("text-nav-slot");
      const passage = document.getElementById("reader-passage");
      navSlot.innerHTML = navHTML();
      passage.innerHTML = passageHTML(group.paragraphs);
      passage.setAttribute("aria-labelledby", `reader-tab-${activeIndex}`);
      document.getElementById("reader-step").textContent = `READING ${String(activeIndex + 1).padStart(2, "0")} / ${String(groups.length).padStart(2, "0")}`;
      document.getElementById("reader-section-title").textContent = group.label;
      document.getElementById("reader-section-count").textContent = `${activeIndex + 1} / ${groups.length}`;

      const prev = document.getElementById("reader-prev-btn");
      const next = document.getElementById("reader-next-btn");
      prev.disabled = activeIndex === 0;
      next.disabled = activeIndex === groups.length - 1;
      prev.onclick = () => setActive(activeIndex - 1, { focusHeading: true });
      next.onclick = () => setActive(activeIndex + 1, { focusHeading: true });

      document.querySelectorAll(".reader-nav button").forEach((btn) => {
        btn.addEventListener("click", () => setActive(parseInt(btn.dataset.idx, 10)));
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
    const readings = [
      anno.jyutping ? `<span>粵 ${App.escapeHTML(anno.jyutping)}</span>` : "",
      anno.putonghua ? `<span>普 ${App.escapeHTML(anno.putonghua)}</span>` : ""
    ].filter(Boolean).join("");
    pop.innerHTML = `
      <button type="button" class="annotation-close" aria-label="關閉注釋">×</button>
      <div class="annotation-kicker">字詞注釋</div>
      <div class="term-name">${App.escapeHTML(anno.term)}</div>
      ${readings ? `<div class="reading">${readings}</div>` : ""}
      <div class="annotation-explanation">${App.escapeHTML(anno.explanation)}</div>
    `;
    document.body.appendChild(backdrop);
    document.body.appendChild(pop);

    const rect = evt.target.getBoundingClientRect();
    const isMobile = window.matchMedia("(max-width: 600px)").matches;
    if (isMobile) {
      pop.style.left = "12px";
      pop.style.right = "12px";
      pop.style.bottom = "12px";
      pop.style.top = "auto";
    } else {
      const popRect = pop.getBoundingClientRect();
      let top = rect.bottom + 10;
      if (top + popRect.height > window.innerHeight - 12) top = Math.max(12, rect.top - popRect.height - 10);
      let left = rect.left;
      if (left + popRect.width > window.innerWidth - 12) left = window.innerWidth - popRect.width - 12;
      pop.style.top = `${Math.max(12, top)}px`;
      pop.style.left = `${Math.max(12, left)}px`;
    }

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
    const annotations = Array.isArray(text.annotations) ? text.annotations : [];
    const pronunciationCount = annotations.filter((a) => a.jyutping || a.putonghua).length;
    const cards = annotations
      .map((a, index) => {
        const readings = [
          a.jyutping ? `<span>粵 ${esc(a.jyutping)}</span>` : "",
          a.putonghua ? `<span>普 ${esc(a.putonghua)}</span>` : ""
        ].filter(Boolean).join("");
        const searchText = [a.term, a.explanation, a.jyutping, a.putonghua].filter(Boolean).join(" ").toLowerCase();
        return `
          <article class="word-study-card" data-word-card data-search="${esc(searchText)}">
            <div class="word-card-topline">
              <span class="word-card-index">${String(index + 1).padStart(2, "0")}</span>
              ${readings ? `<div class="word-reading-chips">${readings}</div>` : ""}
            </div>
            <h2>${esc(a.term)}</h2>
            <p>${esc(a.explanation)}</p>
          </article>`;
      })
      .join("");

    App.mount(`
      <div class="study-page-shell words-study">
        <section class="study-hero" aria-labelledby="study-page-title">
          <div class="study-hero-copy">
            <p class="study-kicker">VOCABULARY · 字詞庫</p>
            <h1 class="page-title study-title" id="study-page-title">字詞與句式</h1>
            <p class="study-lead">把注釋整理成可快速掃讀、搜尋的字詞庫。先理解詞義與語境，再用題目檢查是否真的能辨認和運用。</p>
            <div class="study-meta-row">
              <span>《${esc(unit.title)}》</span>
              ${unit.author ? `<span>${esc(unit.author)}</span>` : ""}
              ${unit.dynasty ? `<span>${esc(unit.dynasty)}</span>` : ""}
            </div>
            <a class="btn btn-primary study-hero-action" href="#/unit/${unitId}/words/quiz">開始字詞與虛詞題庫 <span aria-hidden="true">→</span></a>
          </div>
          <div class="study-hero-side" aria-hidden="true">
            <span class="study-hero-mark">字</span>
            <div class="study-hero-stats">
              <strong>${annotations.length}</strong><small>個核心注釋</small>
              <i></i>
              <strong>${pronunciationCount}</strong><small>項附讀音</small>
            </div>
          </div>
        </section>

        <section class="study-section" aria-labelledby="word-bank-title">
          <div class="study-section-heading">
            <div>
              <p class="section-kicker">快速查閱</p>
              <h2 id="word-bank-title">核心字詞</h2>
              <p>輸入字詞、解釋或讀音即可即時篩選；搜尋只影響目前畫面，不會改動學習紀錄。</p>
            </div>
            <label class="word-search-shell" for="word-filter">
              <span aria-hidden="true">⌕</span>
              <input id="word-filter" type="search" autocomplete="off" placeholder="搜尋字詞或解釋…" />
            </label>
          </div>
          <p class="word-filter-status" id="word-filter-status" aria-live="polite">顯示全部 ${annotations.length} 個字詞</p>
          <div class="word-study-grid" id="word-study-grid">
            ${cards || `<div class="progress-empty-card"><span aria-hidden="true">字</span><div><strong>本篇暫未提供字詞資料</strong><p>可先閱讀原文或進入其他學習模組。</p></div></div>`}
          </div>
        </section>

        <aside class="study-next-panel">
          <div><p class="section-kicker">下一步</p><h2>看懂不等於記得住</h2><p>完成查閱後，用客觀題檢查字義、虛詞與語境辨識；作答紀錄才會進入「我的掌握」。</p></div>
          <a class="btn btn-primary" href="#/unit/${unitId}/words/quiz">開始練習 →</a>
        </aside>
      </div>
      ${App.footerNav(unitId, unit.title)}
    `);

    const filter = document.getElementById("word-filter");
    const status = document.getElementById("word-filter-status");
    if (filter && status) {
      filter.addEventListener("input", () => {
        const query = filter.value.trim().toLowerCase();
        let visible = 0;
        document.querySelectorAll("[data-word-card]").forEach((card) => {
          const match = !query || String(card.dataset.search || "").includes(query);
          card.hidden = !match;
          if (match) visible += 1;
        });
        status.textContent = query ? `找到 ${visible} 個符合項目` : `顯示全部 ${annotations.length} 個字詞`;
      });
    }
  }

  // ---------- 3. 疏通文意 ----------
  function renderComprehensionPage(bundle, unitId) {
    const { text, unit } = bundle;
    const paragraphs = Array.isArray(text.paragraphs) ? text.paragraphs : [];
    const sequence = paragraphs
      .map((p, index) => `
        <article class="comprehension-step">
          <div class="comprehension-rail" aria-hidden="true">
            <span>${String(index + 1).padStart(2, "0")}</span>
            ${index < paragraphs.length - 1 ? `<i></i>` : ""}
          </div>
          <div class="comprehension-card">
            <header>
              <span class="study-chip">${esc(paragraphLabel(p))}</span>
              <small>原文 → 概括 → 再核對細節</small>
            </header>
            <p class="comprehension-text">${esc(p.text)}</p>
            <div class="comprehension-summary">
              <span>理解重點</span>
              <p>${esc(p.summary)}</p>
            </div>
          </div>
        </article>`)
      .join("");

    App.mount(`
      <div class="study-page-shell comprehension-study">
        <section class="study-hero" aria-labelledby="study-page-title">
          <div class="study-hero-copy">
            <p class="study-kicker">COMPREHENSION · 文意脈絡</p>
            <h1 class="page-title study-title" id="study-page-title">疏通文意</h1>
            <p class="study-lead">逐段拆開原文，先看每段在「說甚麼」，再把段落重新連成完整脈絡。段意是理解支架，不是唯一標準答案。</p>
            <div class="study-meta-row">
              <span>《${esc(unit.title)}》</span>
              ${unit.author ? `<span>${esc(unit.author)}</span>` : ""}
              <span>${paragraphs.length} 個理解節點</span>
            </div>
            <a class="btn btn-primary study-hero-action" href="#/unit/${unitId}/comprehension/quiz">開始內容理解題庫 <span aria-hidden="true">→</span></a>
          </div>
          <div class="study-hero-side" aria-hidden="true">
            <span class="study-hero-mark">解</span>
            <div class="study-hero-stats single">
              <strong>${paragraphs.length}</strong><small>段／聯／片</small>
            </div>
          </div>
        </section>

        <section class="study-section" aria-labelledby="comprehension-sequence-title">
          <div class="study-section-heading compact">
            <div>
              <p class="section-kicker">逐段理解</p>
              <h2 id="comprehension-sequence-title">把全文拆成可理解的節點</h2>
              <p>先閱讀原文，再看下方概括；若你能用自己的話重新說一次，才算真正疏通。</p>
            </div>
          </div>
          <div class="comprehension-sequence">
            ${sequence || `<div class="progress-empty-card"><span aria-hidden="true">解</span><div><strong>本篇暫未提供逐段資料</strong><p>可先回到原文閱讀頁。</p></div></div>`}
          </div>
        </section>

        <aside class="study-next-panel">
          <div><p class="section-kicker">檢查理解</p><h2>不要只認得段意</h2><p>題目會重新換一種問法，檢查你能否從原文提取、判斷和整合內容，而不是只記住這些概括。</p></div>
          <a class="btn btn-primary" href="#/unit/${unitId}/comprehension/quiz">開始理解題 →</a>
        </aside>
      </div>
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
      .map((n, index) => `
        <article class="analysis-flow-node">
          <div class="analysis-flow-number" aria-hidden="true">${String(index + 1).padStart(2, "0")}</div>
          <div class="analysis-flow-copy">
            <p>${n.paragraph != null ? `第 ${esc(n.paragraph)} 段` : "結構節點"}</p>
            <h3>${esc(n.label)}</h3>
            <span>${esc(n.description)}</span>
          </div>
        </article>`)
      .join("");

    const contrastCards = contrasts
      .map((c, index) => {
        const leftText = c.left.keywords ? c.left.keywords.join(" · ") : c.left.trait;
        const rightText = c.right.keywords ? c.right.keywords.join(" · ") : c.right.trait;
        return `
          <article class="analysis-compare-card">
            <header><span>${String(index + 1).padStart(2, "0")}</span><h3>${esc(c.label)}</h3></header>
            <div class="analysis-compare-grid">
              <div class="analysis-side is-left">
                <small>A</small><strong>${esc(c.left.title)}</strong><p>${esc(leftText || "")}</p>
                ${c.left.emotion ? `<em>${esc(c.left.emotion)}</em>` : ""}
              </div>
              <div class="analysis-versus" aria-hidden="true">×</div>
              <div class="analysis-side is-right">
                <small>B</small><strong>${esc(c.right.title)}</strong><p>${esc(rightText || "")}</p>
                ${c.right.emotion ? `<em>${esc(c.right.emotion)}</em>` : ""}
              </div>
            </div>
          </article>`;
      })
      .join("");

    const techniqueCards = techniques
      .map((t, index) => `
        <article class="technique-card">
          <span>${String(index + 1).padStart(2, "0")}</span>
          <h3>${esc(t.name)}</h3>
          <p>${esc(t.example)}</p>
        </article>`)
      .join("");

    App.mount(`
      <div class="study-page-shell analysis-study">
        <section class="study-hero" aria-labelledby="study-page-title">
          <div class="study-hero-copy">
            <p class="study-kicker">ANALYSIS · 結構與手法</p>
            <h1 class="page-title study-title" id="study-page-title">結構與鑒賞</h1>
            <p class="study-lead">先看文章怎樣推進，再看哪些對比、照應和寫作手法令意思成立。鑒賞不是背術語，而是說清楚「手法如何產生效果」。</p>
            <div class="study-meta-row">
              <span>《${esc(unit.title)}》</span>
              <span>${nodes.length} 個結構節點</span>
              <span>${techniques.length} 種手法</span>
            </div>
            <a class="btn btn-primary study-hero-action" href="#/unit/${unitId}/analysis/quiz">開始結構與手法題庫 <span aria-hidden="true">→</span></a>
          </div>
          <div class="study-hero-side" aria-hidden="true">
            <span class="study-hero-mark">構</span>
            <div class="study-hero-stats">
              <strong>${contrasts.length}</strong><small>組對比／照應</small>
              <i></i>
              <strong>${techniques.length}</strong><small>項寫作手法</small>
            </div>
          </div>
        </section>

        <section class="study-section" aria-labelledby="analysis-flow-title">
          <div class="study-section-heading compact">
            <div><p class="section-kicker">篇章骨架</p><h2 id="analysis-flow-title">文章如何一步一步推進</h2><p>先掌握順序和轉折，再回頭理解每一段的功能。</p></div>
          </div>
          <div class="analysis-flow">${flow || `<div class="progress-empty-card"><span aria-hidden="true">構</span><div><strong>本篇暫未提供結構圖</strong><p>可先從原文與疏通文意開始。</p></div></div>`}</div>
        </section>

        ${contrastCards ? `
          <section class="study-section" aria-labelledby="analysis-contrast-title">
            <div class="study-section-heading compact"><div><p class="section-kicker">關係閱讀</p><h2 id="analysis-contrast-title">對比與照應</h2><p>把兩端放在一起看，會更清楚作者如何製造差異、呼應與轉折。</p></div></div>
            <div class="analysis-compare-stack">${contrastCards}</div>
          </section>` : ""}

        ${techniqueCards ? `
          <section class="study-section" aria-labelledby="analysis-technique-title">
            <div class="study-section-heading compact"><div><p class="section-kicker">表達效果</p><h2 id="analysis-technique-title">寫作手法與語言特色</h2><p>回答手法題時，要把「名稱、文本例子、作用」連起來。</p></div></div>
            <div class="technique-grid">${techniqueCards}</div>
          </section>` : ""}

        <aside class="study-next-panel">
          <div><p class="section-kicker">由看懂到說明</p><h2>下一步：用題目重組你的分析</h2><p>練習會要求你辨認結構、比較兩端，以及解釋手法效果，而不是照抄這一頁的說法。</p></div>
          <a class="btn btn-primary" href="#/unit/${unitId}/analysis/quiz">開始分析題 →</a>
        </aside>
      </div>
      ${App.footerNav(unitId, unit.title)}
    `);
  }

  // ---------- 5. 主旨與思考 ----------
  function renderThemePage(bundle, unitId) {
    const { appreciation, unit } = bundle;
    const savedReflection = Progress.getReflection(unitId, "theme");
    const summary = appreciation.theme_summary || appreciation.overview || "";
    const keyThemes = appreciation.key_themes || [];
    const evidenceSections = appreciation.by_paragraph || appreciation.paragraph_appreciation || [];

    const themeCards = keyThemes.map((theme, index) => {
      const text = String(theme || "");
      const divider = text.indexOf("：");
      const title = divider > 0 && divider < 28 ? text.slice(0, divider) : `主題 ${String(index + 1).padStart(2, "0")}`;
      const body = divider > 0 && divider < 28 ? text.slice(divider + 1) : text;
      return `
        <article class="theme-insight-card">
          <span>${String(index + 1).padStart(2, "0")}</span>
          <h3>${esc(title)}</h3>
          <p>${esc(body)}</p>
        </article>`;
    }).join("");

    const evidenceHTML = evidenceSections.map((item, index) => {
      const paragraphNo = item.paragraph != null ? item.paragraph : item.paragraph_id;
      const label = item.focus || (paragraphNo != null ? `第${paragraphNo}段` : `文本證據 ${index + 1}`);
      const points = Array.isArray(item.points) ? item.points : [];
      return `
        <article class="theme-evidence-card">
          <header><span>${String(index + 1).padStart(2, "0")}</span><h3>${esc(label)}</h3></header>
          ${points.length ? `<ul>${points.map((point) => `<li>${esc(point)}</li>`).join("")}</ul>` : `<p>本節暫未提供細項分析。</p>`}
        </article>`;
    }).join("");

    App.mount(`
      <div class="study-page-shell theme-study">
        <section class="study-hero" aria-labelledby="study-page-title">
          <div class="study-hero-copy">
            <p class="study-kicker">THEME · 主旨與價值</p>
            <h1 class="page-title study-title" id="study-page-title">主旨與思考</h1>
            <p class="study-lead">主旨不是一句要背下來的標準答案，而是把人物、情感、選擇與全文證據連成一個可解釋的觀點。</p>
            <div class="study-meta-row">
              <span>《${esc(unit.title)}》</span>
              ${unit.author ? `<span>${esc(unit.author)}</span>` : ""}
              <span>${Math.max(keyThemes.length, 1)} 個核心觀點</span>
            </div>
            <a class="btn btn-primary study-hero-action" href="#/unit/${unitId}/theme/quiz">開始主旨與思考題庫 <span aria-hidden="true">→</span></a>
          </div>
          <div class="study-hero-side" aria-hidden="true">
            <span class="study-hero-mark">旨</span>
            <div class="study-hero-stats single"><strong>${evidenceSections.length}</strong><small>組文本證據</small></div>
          </div>
        </section>

        <section class="theme-core-grid" aria-labelledby="theme-core-title">
          <article class="theme-core-panel">
            <p class="section-kicker">CORE IDEA</p>
            <h2 id="theme-core-title">核心主旨</h2>
            <p>${summary ? esc(summary) : "本篇主旨資料尚待補充。"}</p>
            <span class="theme-core-mark" aria-hidden="true">旨</span>
          </article>
          <div class="theme-insight-stack">
            ${themeCards || `<article class="theme-insight-card"><span>01</span><h3>先從全文建立觀點</h3><p>閱讀核心主旨後，回到原文尋找支持它的語句、人物選擇或情感轉折。</p></article>`}
          </div>
        </section>

        ${evidenceHTML ? `
          <section class="study-section" aria-labelledby="theme-evidence-title">
            <div class="study-section-heading compact"><div><p class="section-kicker">回到文本</p><h2 id="theme-evidence-title">主旨如何由原文一步一步建立</h2><p>以下整理用來協助你找證據；真正作答時仍要按題目要求選取、組織與解釋。</p></div></div>
            <div class="theme-evidence-grid">${evidenceHTML}</div>
          </section>` : ""}

        <section class="reflection-panel" aria-labelledby="reflection-title">
          <div class="reflection-intro">
            <p class="section-kicker">PERSONAL RESPONSE</p>
            <h2 id="reflection-title">把主旨帶回自己的經驗</h2>
            <p>哪一個觀點、情感或人物選擇最令你有感？結合《${esc(unit.title)}》內容，再連繫自己的生活或學習經驗。這是個人反思，<strong>不會被當作客觀題正確率或掌握度。</strong></p>
            <small>內容只儲存在這部裝置。</small>
          </div>
          <div class="reflection-editor">
            <label for="theme-reflection">我的反思</label>
            <textarea id="theme-reflection" class="answer-input" placeholder="在此寫下你的想法…">${esc(savedReflection)}</textarea>
            <div class="reflection-actions">
              <button class="btn btn-primary" id="save-reflection-btn">儲存反思</button>
              <span id="reflection-saved-hint" role="status" aria-live="polite">已儲存 ✓</span>
            </div>
          </div>
        </section>

        <aside class="study-next-panel">
          <div><p class="section-kicker">檢查觀點</p><h2>用題目測試：你能否以文本支持主旨？</h2><p>題庫包含客觀題與開放題；開放題會提供評分參考，不會假裝自動判定唯一答案。</p></div>
          <a class="btn btn-primary" href="#/unit/${unitId}/theme/quiz">開始主旨題 →</a>
        </aside>
      </div>
      ${App.footerNav(unitId, unit.title)}
    `);

    const saveButton = document.getElementById("save-reflection-btn");
    if (saveButton) {
      saveButton.addEventListener("click", () => {
        const val = document.getElementById("theme-reflection").value;
        Progress.saveReflection(unitId, "theme", val);
        const hint = document.getElementById("reflection-saved-hint");
        hint.classList.add("is-visible");
        setTimeout(() => hint.classList.remove("is-visible"), 2000);
      });
    }
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
    const nextStep = Progress.recommendNextStep(unitId);
    const primaryHref = wrongQuestions.length ? `#/unit/${unitId}/progress/retry-wrong` : `#${nextStep.path}`;
    const primaryLabel = wrongQuestions.length ? `先重練 ${wrongQuestions.length} 題` : nextStep.label;
    const priorityTitle = wrongQuestions.length
      ? `先把 ${wrongQuestions.length} 題待修正清掉`
      : (overall.answered ? "沒有待修正錯題，繼續建立學習證據" : "從第一組真實作答開始");
    const priorityReason = wrongQuestions.length
      ? `這些客觀題最後一次仍答錯；曾答錯紀錄會保留，即使之後答對也不會被抹去。`
      : nextStep.reason;

    const abilityRows = Object.keys(abilities)
      .map((ab) => {
        const s = abilities[ab];
        const pct = s.answered ? Math.round((s.correct / s.answered) * 100) : null;
        return `
          <article class="ability-progress-row">
            <div class="ability-progress-head">
              <div><strong>${esc(ab)}</strong><small>${s.answered}/${s.total} 題已有作答紀錄</small></div>
              <span>${pct == null ? "尚未作答" : `${s.correct}/${s.answered} 答對`}</span>
            </div>
            <div class="evidence-meter" aria-label="${esc(ab)} 已作答客觀題正確率 ${pct == null ? "尚無資料" : pct + "%"}"><span style="width:${pct == null ? 0 : pct}%;"></span></div>
          </article>`;
      })
      .join("");

    const memorisationRows = memoStats.groups
      .map((g) => {
        const clozeText = g.cloze && g.cloze.attempts
          ? `遮字最高 ${g.cloze.bestRate == null ? "—" : g.cloze.bestRate + "%"} · ${g.cloze.attempts} 次`
          : "遮字未練習";
        const reorderText = g.reorder && g.reorder.attempts
          ? (g.reorder.passed ? `重組曾排對 · ${g.reorder.attempts} 次嘗試` : `重組尚未排對 · ${g.reorder.attempts} 次嘗試`)
          : "重組未練習";
        return `
          <article class="memorisation-evidence-row">
            <div><strong>${esc(g.title)}</strong><p>${clozeText}</p></div>
            <span class="memo-status ${g.reorder && g.reorder.passed ? "is-clear" : ""}">${reorderText}</span>
          </article>`;
      })
      .join("");

    const selfReviewList = selfReviewItems
      .map((item) => `
        <label class="review-check ${savedSelfReview[item] ? "is-checked" : ""}">
          <input type="checkbox" class="self-review-check" data-review-key="${esc(item)}" ${savedSelfReview[item] ? "checked" : ""} />
          <span class="review-check-box" aria-hidden="true">${savedSelfReview[item] ? "✓" : ""}</span>
          <span>${esc(item)}</span>
        </label>`)
      .join("");

    const wrongList = wrongQuestions.length
      ? wrongQuestions.map((q, index) => {
          const bankName = bankNameForQuestion(bundle, q);
          const idx = (bundle.banks[bankName] || []).findIndex((x) => x.id === q.id);
          const link = quizLinkFor(unitId, bankName, idx, q);
          return `
            <a class="wrong-evidence-card" href="${link}">
              <span class="wrong-evidence-index">${String(index + 1).padStart(2, "0")}</span>
              <div><span class="tag">${esc(q.ability)}</span><p>${esc(q.stem.slice(0, 72))}${q.stem.length > 72 ? "…" : ""}</p></div>
              <span class="wrong-evidence-arrow" aria-hidden="true">→</span>
            </a>`;
        }).join("")
      : `<div class="progress-empty-card"><span aria-hidden="true">✓</span><div><strong>目前沒有待修正錯題</strong><p>曾答錯的歷史仍會保留；新的錯題只會按最後一次客觀題答案進入這裡。</p></div></div>`;

    App.mount(`
      <header class="progress-hero unit-progress-hero">
        <div class="progress-hero-copy">
          <p class="section-kicker">《${esc(unit.title)}》· 我的掌握</p>
          <h1 class="page-title">${priorityTitle}</h1>
          <p class="progress-hero-reason">${priorityReason}</p>
          <p class="progress-honesty-note">這頁只整理此裝置留下的作答、背誦、自評與反思紀錄；自評不計入正確率，也不代表系統判定已掌握。</p>
        </div>
        <div class="progress-hero-action">
          <span class="progress-action-label">NEXT</span>
          <a class="btn btn-primary" href="${primaryHref}">${esc(primaryLabel)} <span aria-hidden="true">→</span></a>
        </div>
      </header>

      <section class="evidence-strip" aria-label="本篇學習紀錄摘要">
        <div><span>${overall.rate == null ? "—" : overall.rate + "%"}</span><small>已作答客觀題正確率</small></div>
        <div><span>${overall.answered}</span><small>已作答客觀題</small></div>
        <div class="${wrongQuestions.length ? "needs-attention" : ""}"><span>${wrongQuestions.length}</span><small>目前待修正</small></div>
        <div><span>${resolvedWrongIds.length}</span><small>曾錯後已修正</small></div>
        <div><span>${memoStats.practisedGroups}/${memoStats.totalGroups}</span><small>已練習背誦句群</small></div>
      </section>
      <p class="evidence-footnote">正確率只計已作答、可自動批改的客觀題；未作答題及開放題不會被當作錯題。</p>

      <section class="progress-section" aria-labelledby="wrong-title">
        <div class="progress-section-heading">
          <div><p class="section-kicker">優先處理</p><h2 id="wrong-title">待修正錯題</h2></div>
          ${wrongQuestions.length ? `<a class="btn btn-primary" href="#/unit/${unitId}/progress/retry-wrong">一鍵重練 ${wrongQuestions.length} 題 →</a>` : ""}
        </div>
        <p class="progress-method-note">曾答錯 ${everWrongIds.length} 題 · 曾錯後已修正 ${resolvedWrongIds.length} 題。待修正只看最後一次客觀題答案，錯誤歷史不會刪除；即使之後答對，歷史仍保留。</p>
        <div class="wrong-evidence-list">${wrongList}</div>
      </section>

      <section class="progress-section progress-two-column" aria-label="能力與背誦紀錄">
        <div class="progress-panel">
          <div class="progress-panel-heading"><div><p class="section-kicker">作答證據</p><h2>能力分項</h2></div></div>
          <p class="progress-method-note">只顯示已作答客觀題的答對／作答紀錄，不把比例解讀為整體能力掌握程度。</p>
          <div class="ability-progress-list">${abilityRows || `<div class="progress-empty-card compact"><span>○</span><div><strong>尚未有作答紀錄</strong><p>完成題目後才會出現能力分項。</p></div></div>`}</div>
        </div>
        <div class="progress-panel">
          <div class="progress-panel-heading"><div><p class="section-kicker">背誦證據</p><h2>背誦練習</h2></div><a class="text-link" href="#/unit/${unitId}/memorisation">前往背誦精華 →</a></div>
          <div class="mini-evidence-strip"><span><strong>${memoStats.clozePractisedGroups}</strong>做過遮字</span><span><strong>${memoStats.reorderPassedGroups}</strong>重組曾排對</span></div>
          ${memorisationRows ? `<details class="evidence-details">
            <summary><span>查看 ${memoStats.totalGroups} 個句群練習明細</span><small>${memoStats.practisedGroups}/${memoStats.totalGroups} 已練習</small></summary>
            <div class="memorisation-evidence-list">${memorisationRows}</div>
          </details>` : `<div class="progress-empty-card compact"><span>○</span><div><strong>本篇尚未提供背誦句群</strong></div></div>`}
          <p class="progress-method-note" style="margin-top:12px;">易錯字重溫：${memoStats.charsViewed ? "已開啟重溫" : "尚未重溫"}</p>
        </div>
      </section>

      ${selfReviewList ? `
      <section class="progress-section" aria-labelledby="review-title">
        <div class="progress-section-heading"><div><p class="section-kicker">自我判斷</p><h2 id="review-title">自我檢核</h2></div></div>
        <p class="progress-method-note">這是你自己的學習檢核，只表示「我認為自己能做到」，不計入正確率，也不會被系統當成已掌握。</p>
        <div class="review-check-grid">${selfReviewList}</div>
      </section>` : ""}

      ${reflection ? `
      <section class="reflection-evidence-card">
        <div><p class="section-kicker">我的反思</p><h2>留下來的想法</h2></div>
        <p>${esc(reflection)}</p>
      </section>` : ""}

      <div class="progress-danger-zone">
        <div><strong>本篇裝置紀錄</strong><p>清除會移除作答、背誦、自評與反思，而且無法復原。</p></div>
        <button class="btn btn-ghost" id="clear-progress-btn">清除本篇進度</button>
      </div>

      ${App.footerNav(unitId, unit.title)}
    `);

    document.querySelectorAll(".self-review-check").forEach((box) => {
      box.addEventListener("change", () => {
        Progress.setSelfReviewItem(unitId, box.dataset.reviewKey, box.checked);
        const label = box.closest(".review-check");
        if (label) {
          label.classList.toggle("is-checked", box.checked);
          const mark = label.querySelector(".review-check-box");
          if (mark) mark.textContent = box.checked ? "✓" : "";
        }
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
