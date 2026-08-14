/* ============================================================
   content-renderer.js — 篇章首頁及各內容模組頁面（非題目頁）
   ============================================================ */

const ContentRenderer = (() => {
  const esc = App.escapeHTML;

  function moduleHref(unitId, moduleId) {
    return `#/unit/${unitId}/${moduleId === "progress" ? "progress" : moduleId}`;
  }

  function renderUnitHome(bundle, unitId) {
    const u = bundle.unit;
    const moduleDescs = {
      text: "全文分段、點字看注釋、朗讀提示",
      words: "實詞／虛詞／通假／古今義",
      comprehension: "白話理解、段意、內容理解練習",
      analysis: "結構圖、景情配對、手法賞析",
      theme: "主旨解說、生活反思、開放題",
      memorisation: "句群背誦、遮字、重組",
      challenge: "整合各分類抽題，附錯因與補救",
      progress: "能力分項、錯題、背誦重溫、反思"
    };
    const cards = u.modules
      .map((m) => `
        <a class="card module-card card-tappable" href="${moduleHref(unitId, m.id)}">
          <div class="module-icon">${App.moduleIconGlyph(m.icon)}</div>
          <div>
            <p class="module-name">${esc(m.title)}</p>
            <p class="module-desc">${esc(moduleDescs[m.id] || "")}</p>
          </div>
        </a>
      `)
      .join("");

    App.mount(`
      <h1 class="page-title">《${esc(u.title)}》</h1>
      <p class="page-subtitle">${esc(u.author)} · ${esc(u.dynasty)} · ${esc(u.genre)}</p>
      <div class="module-grid">${cards}</div>

      <div class="section-title" style="margin-top:32px;">
        <span class="seal">跨</span>跨篇比較與進階題
      </div>
      <div class="cross-text-banner">
        選做：如尚未學習相關篇章，可先略過；學習後再回來挑戰。
      </div>
      <a class="btn btn-secondary" href="#/unit/${unitId}/cross-text">前往跨篇比較與進階題 →</a>

      ${App.footerNav(null, null).replace('<div class="footer-nav">', '<div class="footer-nav" style="margin-top:40px;">')}
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

    let activeIndex = 0;

    function paraNavHTML() {
      return `
        <div class="para-nav">
          ${text.paragraphs
            .map((p, i) => `<button data-idx="${i}" class="${i === activeIndex ? "is-active" : ""}">第${p.id}段</button>`)
            .join("")}
        </div>
      `;
    }

    function passageHTML(p) {
      let html = p.text;
      // 依 annotation term 在文中出現位置，包上可點擊 span（term 較長者優先，避免子字串誤包）
      const terms = p.annotation_ids
        .map((id) => annoMap[id])
        .filter(Boolean)
        .sort((a, b) => b.term.length - a.term.length);
      terms.forEach((a) => {
        const termEsc = esc(a.term);
        if (!html.includes(a.term)) return;
        html = html.split(a.term).join(`<span class="term" data-anno="${a.id}">${termEsc}</span>`);
      });
      return html;
    }

    function renderBody() {
      const p = text.paragraphs[activeIndex];
      App.mount(`
        <h1 class="page-title">原文與誦讀</h1>
        <p class="page-subtitle">《${esc(unit.title)}》· 點擊底線字詞查看注釋</p>
        ${audioPlayerHTML(unit)}
        <div class="card">
          ${paraNavHTML()}
          <p class="text-passage">${passageHTML(p)}</p>
          <div class="para-summary"><strong>段意：</strong>${esc(p.summary)}</div>
        </div>
        <div class="card">
          <p style="color:var(--color-ink-soft); font-size:14px; margin:0;">
            意群停頓提示尚未提供，將於日後版本補充。
          </p>
        </div>
        ${App.footerNav(unitId, unit.title)}
      `);
      bindEvents();
    }

    function bindEvents() {
      document.querySelectorAll(".para-nav button").forEach((btn) => {
        btn.addEventListener("click", () => {
          activeIndex = parseInt(btn.dataset.idx, 10);
          renderBody();
        });
      });
      document.querySelectorAll(".term").forEach((span) => {
        span.addEventListener("click", (e) => showAnnotationPopover(e, annoMap[span.dataset.anno]));
      });
    }

    renderBody();
  }

  function showAnnotationPopover(evt, anno) {
    if (!anno) return;
    document.querySelectorAll(".annotation-popover, .annotation-backdrop").forEach((el) => el.remove());
    const backdrop = document.createElement("div");
    backdrop.className = "annotation-backdrop";
    const pop = document.createElement("div");
    pop.className = "annotation-popover";
    const reading = [anno.jyutping ? `粵：${anno.jyutping}` : "", anno.putonghua ? `普：${anno.putonghua}` : ""]
      .filter(Boolean).join("　");
    pop.innerHTML = `
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
    backdrop.addEventListener("click", () => {
      pop.remove();
      backdrop.remove();
    });
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
          <div class="section-title"><span class="seal">${p.id}</span>第${p.id}段</div>
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
    const flow = structure.nodes
      .map(
        (n, i) => `
        <div class="card card-tight" style="display:flex; gap:12px; align-items:flex-start;">
          <div class="module-icon">${i + 1}</div>
          <div>
            <p style="font-weight:700; margin:0 0 4px;">${esc(n.label)}<span style="font-weight:400; color:var(--color-ink-faint); font-size:12px;"> ・第${n.paragraph}段</span></p>
            <p style="margin:0; font-size:14px; color:var(--color-ink-soft);">${esc(n.description)}</p>
          </div>
        </div>`
      )
      .join(`<div style="text-align:center; color:var(--color-ink-faint); margin: -4px 0;">↓</div>`);

    const contrastCards = structure.contrast_pairs
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

    const techniqueCards = structure.techniques
      .map((t) => `<div class="card card-tight"><strong>${esc(t.name)}</strong><p style="margin:6px 0 0; font-size:13px; color:var(--color-ink-soft);">${esc(t.example)}</p></div>`)
      .join("");

    App.mount(`
      <h1 class="page-title">結構與鑒賞</h1>
      <p class="page-subtitle">修樓 → 景 → 情 → 理 結構圖</p>
      <div style="margin-bottom:24px;">${flow}</div>

      <div class="section-title"><span class="seal">對</span>對比配對</div>
      ${contrastCards}

      <div class="section-title" style="margin-top:24px;"><span class="seal">法</span>動靜、感官、對偶、駢散、煉字</div>
      <div class="module-grid">${techniqueCards}</div>

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
      <p class="page-subtitle">不以物喜，不以己悲 · 先天下之憂而憂，後天下之樂而樂</p>
      <div class="card">
        <p style="margin:0; line-height:1.9;">${esc(appreciation.theme_summary)}</p>
      </div>

      <div class="card">
        <div class="section-title"><span class="seal">思</span>生活情境與個人反思</div>
        <p style="font-size:14px; color:var(--color-ink-soft);">試想想：在你的生活或學習中，有沒有試過因外在環境或一時得失而影響心情？范仲淹「不以物喜，不以己悲」的態度，對你有甚麼啟發？（此欄只儲存在你自己的裝置上）</p>
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
    const { unit, allQuestions, rubrics } = bundle;
    const overall = Progress.overallAccuracy(unitId, allQuestions);
    const abilities = Progress.abilityStats(unitId, allQuestions);
    const wrongIds = Progress.wrongQuestionIds(unitId, allQuestions);
    const wrongQuestions = allQuestions.filter((q) => wrongIds.includes(q.id));
    const reflection = Progress.getReflection(unitId, "theme");

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
            <div class="stat-label">錯題數</div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="section-title"><span class="seal">分</span>能力分項</div>
        ${abilityRows || `<p class="empty-state">尚未有作答紀錄。</p>`}
      </div>

      <div class="section-title"><span class="seal">錯</span>錯題本</div>
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

    document.getElementById("clear-progress-btn").addEventListener("click", () => {
      if (confirm("確定要清除《" + unit.title + "》的所有作答紀錄與反思嗎？此動作無法復原。")) {
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
      return `#/unit/${unitId}/cross-text/quiz/${q.cross_text_target || "all"}?qi=${idx}`;
    }
    const map = { words: "words", content: "comprehension", "structure-skill": "analysis", theme: "theme" };
    const seg = map[bankName] || bankName;
    return `#/unit/${unitId}/${seg}/quiz?qi=${idx >= 0 ? idx : 0}`;
  }

  return {
    renderUnitHome, renderTextPage, renderWordsPage, renderComprehensionPage,
    renderAnalysisPage, renderThemePage, renderCrossTextPage, renderProgressPage
  };
})();
