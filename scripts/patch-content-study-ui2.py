from pathlib import Path

ROOT = Path('.')
renderer_path = ROOT / 'js/content-renderer.js'
css_path = ROOT / 'css/style.css'
browser_path = ROOT / 'scripts/browser-smoke.mjs'
production_path = ROOT / 'scripts/production-smoke.mjs'

renderer = renderer_path.read_text(encoding='utf-8')
css = css_path.read_text(encoding='utf-8')
browser = browser_path.read_text(encoding='utf-8')
production = production_path.read_text(encoding='utf-8')


def replace_section(text, start_marker, end_marker, replacement):
    start = text.index(start_marker)
    end = text.index(end_marker, start)
    return text[:start] + replacement.rstrip() + '\n\n' + text[end:]

words_section = r'''  // ---------- 2. 字詞與句式 ----------
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
  }'''

comprehension_section = r'''  // ---------- 3. 疏通文意 ----------
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
  }'''

analysis_section = r'''  // ---------- 4. 結構與鑒賞 ----------
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
  }'''

theme_section = r'''  // ---------- 5. 主旨與思考 ----------
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
  }'''

renderer = replace_section(renderer, '  // ---------- 2. 字詞與句式 ----------', '  // ---------- 3. 疏通文意 ----------', words_section)
renderer = replace_section(renderer, '  // ---------- 3. 疏通文意 ----------', '  // ---------- 4. 結構與鑒賞 ----------', comprehension_section)
renderer = replace_section(renderer, '  // ---------- 4. 結構與鑒賞 ----------', '  // ---------- 5. 主旨與思考 ----------', analysis_section)
renderer = replace_section(renderer, '  // ---------- 5. 主旨與思考 ----------', '  // ---------- 跨篇比較與進階題 ----------', theme_section)
renderer_path.write_text(renderer, encoding='utf-8')

css_block = r'''

/* ===== Content Study UI 2.0: words / comprehension / analysis / theme ===== */
.study-page-shell {
  --study-accent: var(--color-accent);
  --study-soft: rgba(226, 239, 234, .72);
  --study-glow: rgba(82, 145, 125, .13);
  width: min(100%, 1080px);
  margin: 0 auto;
}
.words-study { --study-accent: #1B6257; --study-soft: rgba(223, 240, 234, .76); --study-glow: rgba(76, 151, 126, .15); }
.comprehension-study { --study-accent: #8A5544; --study-soft: rgba(246, 232, 225, .80); --study-glow: rgba(183, 95, 71, .14); }
.analysis-study { --study-accent: #3E5B72; --study-soft: rgba(228, 236, 242, .82); --study-glow: rgba(77, 115, 145, .14); }
.theme-study { --study-accent: #6B5144; --study-soft: rgba(242, 232, 222, .82); --study-glow: rgba(155, 108, 75, .13); }

.study-hero {
  position: relative;
  overflow: hidden;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(230px, .34fr);
  gap: clamp(28px, 5vw, 62px);
  align-items: stretch;
  margin: 2px 0 52px;
  padding: clamp(30px, 4.8vw, 54px);
  border: 1px solid rgba(33, 58, 51, .11);
  border-radius: 30px;
  background:
    radial-gradient(circle at 92% 5%, var(--study-glow), transparent 35%),
    linear-gradient(145deg, rgba(255,255,255,.91), rgba(245,246,242,.82));
  box-shadow: 0 24px 64px rgba(31, 48, 43, .075), inset 0 1px 0 rgba(255,255,255,.82);
}
.study-hero::before {
  content: "";
  position: absolute;
  left: 0;
  top: 30px;
  bottom: 30px;
  width: 3px;
  border-radius: 999px;
  background: var(--study-accent);
  opacity: .72;
}
.study-hero-copy { position: relative; z-index: 1; align-self: center; }
.study-kicker {
  margin: 0 0 12px;
  color: var(--study-accent);
  font-size: 10px;
  font-weight: 900;
  letter-spacing: .15em;
}
.study-title {
  max-width: 760px;
  margin: 0 0 16px;
  font-size: clamp(42px, 5vw, 62px);
  font-weight: 560;
  line-height: 1.06;
  letter-spacing: -.045em;
}
.study-lead {
  max-width: 720px;
  margin: 0;
  color: var(--color-ink-soft);
  font-size: 15px;
  line-height: 1.9;
}
.study-meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin-top: 22px;
}
.study-meta-row span {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 5px 10px;
  border: 1px solid rgba(33, 58, 51, .09);
  border-radius: 999px;
  background: rgba(255,255,255,.55);
  color: #5C6864;
  font-size: 10px;
  font-weight: 750;
}
.study-hero-action { margin-top: 26px; }
.study-hero-side {
  position: relative;
  overflow: hidden;
  min-height: 220px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: flex-end;
  padding: 18px;
  border: 1px solid rgba(33, 58, 51, .08);
  border-radius: 24px;
  background: linear-gradient(155deg, rgba(255,255,255,.58), var(--study-soft));
}
.study-hero-side::after {
  content: "";
  position: absolute;
  width: 150px;
  height: 150px;
  border: 1px solid rgba(33,58,51,.08);
  border-radius: 50%;
  right: -44px;
  top: -40px;
}
.study-hero-mark {
  position: relative;
  z-index: 1;
  color: var(--study-accent);
  font-family: var(--font-display);
  font-size: 88px;
  font-weight: 520;
  line-height: 1;
  opacity: .91;
}
.study-hero-stats {
  position: relative;
  z-index: 1;
  width: 100%;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 2px 9px;
  align-items: baseline;
}
.study-hero-stats strong {
  color: var(--study-accent);
  font-family: var(--font-display);
  font-size: 27px;
  font-weight: 600;
}
.study-hero-stats small { color: var(--color-ink-soft); font-size: 10px; font-weight: 700; }
.study-hero-stats i { grid-column: 1 / -1; height: 1px; margin: 7px 0; background: rgba(33,58,51,.10); }
.study-hero-stats.single { grid-template-columns: auto 1fr; }

.study-section { margin-bottom: 58px; }
.study-section-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 22px;
}
.study-section-heading.compact { align-items: flex-start; }
.study-section-heading h2 {
  margin: 4px 0 7px;
  font-family: var(--font-display);
  font-size: clamp(25px, 3vw, 34px);
  font-weight: 590;
  letter-spacing: -.025em;
}
.study-section-heading p:not(.section-kicker) {
  max-width: 720px;
  margin: 0;
  color: var(--color-ink-soft);
  font-size: 13px;
  line-height: 1.75;
}
.study-chip {
  display: inline-flex;
  align-items: center;
  min-height: 27px;
  padding: 5px 9px;
  border-radius: 999px;
  background: var(--study-soft);
  color: var(--study-accent);
  font-size: 10px;
  font-weight: 850;
}
.study-next-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 28px;
  margin-top: 8px;
  padding: 28px 30px;
  border: 1px solid rgba(33,58,51,.10);
  border-radius: 24px;
  background: linear-gradient(145deg, rgba(255,255,255,.76), var(--study-soft));
  box-shadow: var(--shadow-card);
}
.study-next-panel h2 { margin: 5px 0 7px; font-family: var(--font-display); font-size: 24px; font-weight: 600; }
.study-next-panel p:not(.section-kicker) { max-width: 720px; margin: 0; color: var(--color-ink-soft); font-size: 13px; line-height: 1.7; }
.study-next-panel .btn { flex: none; }

/* Words */
.word-search-shell {
  width: min(100%, 330px);
  min-height: 44px;
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 8px 12px;
  border: 1px solid rgba(33,58,51,.13);
  border-radius: 14px;
  background: rgba(255,255,255,.78);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.65);
}
.word-search-shell span { color: var(--study-accent); font-size: 19px; line-height: 1; }
.word-search-shell input {
  min-width: 0;
  width: 100%;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--color-ink);
  font-family: var(--font-body);
  font-size: 13px;
}
.word-search-shell:focus-within { border-color: rgba(27,98,87,.34); box-shadow: 0 0 0 3px rgba(27,98,87,.08); }
.word-filter-status { margin: -7px 0 14px; color: var(--color-ink-faint); font-size: 11px; }
.word-study-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 13px; }
.word-study-card {
  min-height: 180px;
  padding: 21px 22px;
  border: 1px solid rgba(33,58,51,.10);
  border-radius: 20px;
  background: rgba(252,252,250,.88);
  box-shadow: 0 8px 24px rgba(31,48,43,.04);
  transition: transform .16s ease, border-color .16s ease, box-shadow .16s ease;
}
.word-study-card:hover { transform: translateY(-2px); border-color: rgba(27,98,87,.22); box-shadow: 0 15px 32px rgba(31,48,43,.075); }
.word-study-card[hidden] { display: none !important; }
.word-card-topline { min-height: 27px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.word-card-index { color: var(--color-ink-faint); font-family: var(--font-data); font-size: 10px; font-weight: 800; letter-spacing: .08em; }
.word-reading-chips { display: flex; gap: 5px; flex-wrap: wrap; justify-content: flex-end; }
.word-reading-chips span { padding: 4px 7px; border-radius: 999px; background: var(--study-soft); color: var(--study-accent); font-size: 9px; font-weight: 800; }
.word-study-card h2 { margin: 15px 0 8px; color: var(--color-ink); font-family: var(--font-display); font-size: 25px; font-weight: 620; }
.word-study-card p { margin: 0; color: var(--color-ink-soft); font-size: 13px; line-height: 1.78; }

/* Comprehension */
.comprehension-sequence { width: min(100%, 900px); margin: 0 auto; }
.comprehension-step { display: grid; grid-template-columns: 58px minmax(0, 1fr); align-items: stretch; }
.comprehension-rail { position: relative; display: flex; flex-direction: column; align-items: center; }
.comprehension-rail span {
  position: relative;
  z-index: 1;
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(138,85,68,.18);
  border-radius: 50%;
  background: #F7F4EF;
  color: var(--study-accent);
  font-family: var(--font-data);
  font-size: 10px;
  font-weight: 850;
}
.comprehension-rail i { width: 1px; flex: 1; min-height: 34px; background: linear-gradient(var(--study-accent), rgba(138,85,68,.08)); opacity: .35; }
.comprehension-card {
  margin-bottom: 18px;
  padding: 24px 27px;
  border: 1px solid rgba(33,58,51,.10);
  border-radius: 22px;
  background: rgba(252,252,250,.88);
  box-shadow: var(--shadow-card);
}
.comprehension-card header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
.comprehension-card header small { color: var(--color-ink-faint); font-size: 10px; }
.comprehension-text {
  margin: 0;
  color: var(--color-ink);
  font-family: var(--font-display);
  font-size: 19px;
  line-height: 2;
  letter-spacing: .015em;
}
.comprehension-summary {
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr);
  gap: 14px;
  align-items: start;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid rgba(33,58,51,.09);
}
.comprehension-summary span { color: var(--study-accent); font-size: 10px; font-weight: 850; letter-spacing: .05em; }
.comprehension-summary p { margin: 0; color: var(--color-ink-soft); font-size: 13px; line-height: 1.72; }

/* Analysis */
.analysis-flow { width: min(100%, 850px); margin: 0 auto; }
.analysis-flow-node { position: relative; display: grid; grid-template-columns: 60px minmax(0, 1fr); gap: 16px; padding-bottom: 16px; }
.analysis-flow-node:not(:last-child)::after { content: ""; position: absolute; left: 29px; top: 45px; bottom: -3px; width: 1px; background: linear-gradient(var(--study-accent), rgba(62,91,114,.05)); opacity: .32; }
.analysis-flow-number {
  position: relative;
  z-index: 1;
  width: 58px;
  height: 42px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(62,91,114,.16);
  border-radius: 14px;
  background: #F7F7F4;
  color: var(--study-accent);
  font-family: var(--font-data);
  font-size: 10px;
  font-weight: 850;
}
.analysis-flow-copy { padding: 17px 20px; border: 1px solid rgba(33,58,51,.09); border-radius: 18px; background: rgba(252,252,250,.86); }
.analysis-flow-copy > p { margin: 0 0 4px; color: var(--study-accent); font-size: 9px; font-weight: 850; letter-spacing: .08em; }
.analysis-flow-copy h3 { margin: 0 0 6px; font-family: var(--font-display); font-size: 19px; font-weight: 620; }
.analysis-flow-copy span { color: var(--color-ink-soft); font-size: 13px; line-height: 1.7; }
.analysis-compare-stack { display: grid; gap: 14px; }
.analysis-compare-card { padding: 22px; border: 1px solid rgba(33,58,51,.10); border-radius: 22px; background: rgba(252,252,250,.88); box-shadow: var(--shadow-card); }
.analysis-compare-card > header { display: flex; align-items: baseline; gap: 10px; margin-bottom: 14px; }
.analysis-compare-card > header span { color: var(--color-ink-faint); font-family: var(--font-data); font-size: 9px; font-weight: 850; }
.analysis-compare-card > header h3 { margin: 0; font-family: var(--font-display); font-size: 19px; font-weight: 620; }
.analysis-compare-grid { display: grid; grid-template-columns: minmax(0, 1fr) 38px minmax(0, 1fr); align-items: stretch; }
.analysis-side { position: relative; padding: 18px; border-radius: 16px; background: var(--study-soft); }
.analysis-side.is-right { background: rgba(226,239,234,.68); }
.analysis-side small { position: absolute; top: 12px; right: 13px; color: var(--color-ink-faint); font-size: 9px; font-weight: 900; }
.analysis-side strong { display: block; padding-right: 22px; color: var(--color-ink); font-size: 14px; }
.analysis-side p { margin: 8px 0 0; color: var(--color-ink-soft); font-size: 12px; line-height: 1.65; }
.analysis-side em { display: inline-block; margin-top: 10px; color: var(--study-accent); font-size: 11px; font-style: normal; font-weight: 800; }
.analysis-versus { display: grid; place-items: center; color: var(--color-ink-faint); font-family: var(--font-display); font-size: 21px; }
.technique-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.technique-card { min-height: 180px; padding: 20px; border: 1px solid rgba(33,58,51,.10); border-radius: 20px; background: rgba(252,252,250,.88); }
.technique-card > span { color: var(--study-accent); font-family: var(--font-data); font-size: 9px; font-weight: 850; }
.technique-card h3 { margin: 12px 0 8px; font-family: var(--font-display); font-size: 20px; font-weight: 620; }
.technique-card p { margin: 0; color: var(--color-ink-soft); font-size: 12px; line-height: 1.72; }

/* Theme */
.theme-core-grid { display: grid; grid-template-columns: minmax(0, 1.12fr) minmax(300px, .88fr); gap: 14px; margin-bottom: 58px; }
.theme-core-panel {
  position: relative;
  overflow: hidden;
  min-height: 330px;
  padding: clamp(28px, 4vw, 42px);
  border-radius: 26px;
  background: linear-gradient(145deg, #16483F, #0D3832);
  color: #FFFDF8;
  box-shadow: 0 22px 54px rgba(13,56,50,.18), inset 0 1px 0 rgba(255,255,255,.10);
}
.theme-core-panel .section-kicker { color: #DDB9A9; }
.theme-core-panel h2 { position: relative; z-index: 1; margin: 8px 0 18px; font-family: var(--font-display); font-size: 31px; font-weight: 580; }
.theme-core-panel > p:not(.section-kicker) { position: relative; z-index: 1; max-width: 650px; margin: 0; color: rgba(255,255,255,.84); font-family: var(--font-display); font-size: 19px; line-height: 1.95; }
.theme-core-mark { position: absolute; right: -8px; bottom: -36px; color: rgba(255,255,255,.06); font-family: var(--font-display); font-size: 190px; line-height: 1; }
.theme-insight-stack { display: grid; gap: 12px; }
.theme-insight-card { position: relative; padding: 20px 21px; border: 1px solid rgba(33,58,51,.10); border-radius: 20px; background: rgba(252,252,250,.88); box-shadow: var(--shadow-card); }
.theme-insight-card > span { color: var(--study-accent); font-family: var(--font-data); font-size: 9px; font-weight: 850; }
.theme-insight-card h3 { margin: 9px 0 6px; font-family: var(--font-display); font-size: 18px; font-weight: 620; }
.theme-insight-card p { margin: 0; color: var(--color-ink-soft); font-size: 12px; line-height: 1.7; }
.theme-evidence-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.theme-evidence-card { padding: 21px 22px; border: 1px solid rgba(33,58,51,.10); border-radius: 20px; background: rgba(252,252,250,.88); }
.theme-evidence-card header { display: flex; gap: 10px; align-items: baseline; margin-bottom: 12px; }
.theme-evidence-card header span { color: var(--study-accent); font-family: var(--font-data); font-size: 9px; font-weight: 850; }
.theme-evidence-card h3 { margin: 0; font-family: var(--font-display); font-size: 17px; font-weight: 620; }
.theme-evidence-card ul { margin: 0; padding-left: 18px; color: var(--color-ink-soft); font-size: 12px; line-height: 1.75; }
.theme-evidence-card li + li { margin-top: 7px; }
.theme-evidence-card > p { margin: 0; color: var(--color-ink-soft); font-size: 12px; }
.reflection-panel {
  display: grid;
  grid-template-columns: minmax(240px, .7fr) minmax(0, 1.3fr);
  gap: clamp(24px, 4vw, 48px);
  margin: 0 0 54px;
  padding: clamp(26px, 4vw, 40px);
  border: 1px solid rgba(33,58,51,.10);
  border-radius: 26px;
  background: linear-gradient(145deg, rgba(255,255,255,.82), rgba(242,232,222,.62));
  box-shadow: var(--shadow-card);
}
.reflection-intro h2 { margin: 6px 0 10px; font-family: var(--font-display); font-size: 27px; font-weight: 600; }
.reflection-intro > p:not(.section-kicker) { margin: 0; color: var(--color-ink-soft); font-size: 13px; line-height: 1.75; }
.reflection-intro small { display: block; margin-top: 14px; color: var(--color-ink-faint); font-size: 10px; }
.reflection-editor label { display: block; margin-bottom: 8px; color: var(--color-ink); font-size: 11px; font-weight: 850; }
.reflection-editor textarea.answer-input { min-height: 180px; border-radius: 17px; background: rgba(255,255,255,.78); line-height: 1.75; }
.reflection-actions { display: flex; align-items: center; gap: 12px; margin-top: 12px; }
#reflection-saved-hint { color: var(--color-jade); font-size: 11px; font-weight: 800; opacity: 0; transform: translateY(3px); transition: opacity .16s ease, transform .16s ease; }
#reflection-saved-hint.is-visible { opacity: 1; transform: translateY(0); }

@media (max-width: 820px) {
  .study-hero { grid-template-columns: 1fr; }
  .study-hero-side { min-height: 128px; flex-direction: row; align-items: flex-end; }
  .study-hero-mark { font-size: 72px; }
  .study-hero-stats { max-width: 280px; }
  .study-section-heading { align-items: flex-start; flex-direction: column; }
  .word-search-shell { width: 100%; }
  .technique-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .theme-core-grid { grid-template-columns: 1fr; }
  .theme-core-panel { min-height: 280px; }
  .reflection-panel { grid-template-columns: 1fr; }
}

@media (max-width: 600px) {
  .study-hero { margin-top: 0; margin-bottom: 40px; padding: 25px 22px; border-radius: 24px; }
  .study-hero::before { top: 24px; bottom: 24px; }
  .study-title { font-size: 41px; }
  .study-lead { font-size: 13px; line-height: 1.78; }
  .study-meta-row { margin-top: 18px; }
  .study-hero-action { width: 100%; margin-top: 22px; }
  .study-hero-side { min-height: 108px; padding: 14px; border-radius: 19px; }
  .study-hero-mark { font-size: 58px; }
  .study-hero-stats { max-width: 220px; }
  .study-hero-stats strong { font-size: 22px; }
  .study-section { margin-bottom: 45px; }
  .study-section-heading { margin-bottom: 17px; }
  .study-section-heading h2 { font-size: 27px; }
  .study-next-panel { align-items: flex-start; flex-direction: column; gap: 18px; padding: 22px; border-radius: 20px; }
  .study-next-panel h2 { font-size: 22px; }
  .study-next-panel .btn { width: 100%; }
  .word-study-grid { grid-template-columns: 1fr; }
  .word-study-card { min-height: 0; padding: 19px; }
  .word-study-card h2 { font-size: 23px; }
  .comprehension-step { grid-template-columns: 38px minmax(0, 1fr); }
  .comprehension-rail span { width: 30px; height: 30px; }
  .comprehension-rail i { min-height: 28px; }
  .comprehension-card { padding: 20px 18px; border-radius: 18px; }
  .comprehension-card header { align-items: flex-start; flex-direction: column; gap: 7px; }
  .comprehension-text { font-size: 17px; line-height: 1.95; }
  .comprehension-summary { grid-template-columns: 1fr; gap: 6px; }
  .analysis-flow-node { grid-template-columns: 43px minmax(0, 1fr); gap: 10px; }
  .analysis-flow-node:not(:last-child)::after { left: 21px; }
  .analysis-flow-number { width: 42px; height: 38px; border-radius: 12px; }
  .analysis-flow-copy { padding: 16px; }
  .analysis-compare-card { padding: 18px; }
  .analysis-compare-grid { grid-template-columns: 1fr; gap: 8px; }
  .analysis-versus { height: 22px; }
  .technique-grid { grid-template-columns: 1fr; }
  .technique-card { min-height: 0; }
  .theme-core-panel { min-height: 0; padding: 25px 23px 52px; border-radius: 22px; }
  .theme-core-panel h2 { font-size: 27px; }
  .theme-core-panel > p:not(.section-kicker) { font-size: 17px; line-height: 1.86; }
  .theme-core-mark { font-size: 130px; }
  .theme-evidence-grid { grid-template-columns: 1fr; }
  .reflection-panel { padding: 22px; border-radius: 21px; }
  .reflection-intro h2 { font-size: 25px; }
}

@media (prefers-reduced-motion: reduce) {
  .word-study-card,
  #reflection-saved-hint { transition: none !important; }
}
'''

if '/* ===== Content Study UI 2.0:' not in css:
    css += css_block
css_path.write_text(css, encoding='utf-8')

browser_needle = '''  await page.evaluate(() => { window.location.hash = "#/unit/yueyanglouji/words/quiz"; });\n  await page.locator(".q-stem").first().waitFor({ state: "visible", timeout: 5000 });'''
browser_insert = r'''  await page.evaluate(() => { window.location.hash = "#/unit/yueyanglouji/words"; });
  await waitForTitle(page, "字詞與句式");
  check(await page.locator(".study-page-shell.words-study").count() === 1, "words route should render the shared study workspace");
  check(await page.locator("[data-word-card]").count() > 10, "words route should render the annotation bank as study cards");
  await page.locator("#word-filter").fill("謫守");
  check(await page.locator("[data-word-card]:visible").count() >= 1, "word search should filter the visible annotation cards");
  await page.locator("#word-filter").fill("");

  await page.evaluate(() => { window.location.hash = "#/unit/yueyanglouji/comprehension"; });
  await waitForTitle(page, "疏通文意");
  check(await page.locator(".comprehension-sequence").count() === 1, "comprehension route should render the sequence workspace");
  check(await page.locator(".comprehension-step").count() === 5, "Yueyang comprehension should render five understanding steps");

  await page.evaluate(() => { window.location.hash = "#/unit/yueyanglouji/analysis"; });
  await waitForTitle(page, "結構與鑒賞");
  check(await page.locator(".analysis-flow-node").count() >= 5, "analysis route should render the structural flow");
  check(await page.locator(".analysis-compare-card").count() >= 1, "analysis route should render comparison evidence when available");

  await page.evaluate(() => { window.location.hash = "#/unit/yueyanglouji/theme"; });
  await waitForTitle(page, "主旨與思考");
  check(await page.locator(".theme-core-panel").count() === 1, "theme route should render the core-idea panel");
  check(await page.locator("#theme-reflection").count() === 1, "theme route should preserve the personal reflection editor");

  await page.evaluate(() => { window.location.hash = "#/unit/yueyanglouji/words/quiz"; });
  await page.locator(".q-stem").first().waitFor({ state: "visible", timeout: 5000 });'''
if browser_needle not in browser:
    raise SystemExit('browser desktop insertion point not found')
browser = browser.replace(browser_needle, browser_insert, 1)

mobile_needle = '''  await page.evaluate(() => { window.location.hash = "#/unit/yueyanglouji/words/quiz"; });\n  await page.locator(".q-stem").first().waitFor({ state: "visible", timeout: 5000 });\n  const quizOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);'''
mobile_insert = r'''  const contentStudyRoutes = [
    ["#/unit/yueyanglouji/words", ".words-study", "words"],
    ["#/unit/yueyanglouji/comprehension", ".comprehension-study", "comprehension"],
    ["#/unit/yueyanglouji/analysis", ".analysis-study", "analysis"],
    ["#/unit/yueyanglouji/theme", ".theme-study", "theme"]
  ];
  for (const [route, selector, label] of contentStudyRoutes) {
    await page.evaluate((hash) => { window.location.hash = hash; }, route);
    await page.locator(selector).waitFor({ state: "visible", timeout: 5000 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(overflow <= 1, `mobile ${label} study page has horizontal overflow of ${overflow}px`);
  }
  await page.evaluate(() => { window.location.hash = "#/unit/yueyanglouji/words/quiz"; });
  await page.locator(".q-stem").first().waitFor({ state: "visible", timeout: 5000 });
  const quizOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);'''
if mobile_needle not in browser:
    raise SystemExit('browser mobile insertion point not found')
browser = browser.replace(mobile_needle, mobile_insert, 1)
browser = browser.replace('Browser smoke routes passed: home → unit → text annotation → quiz submit → memorisation cloze; mobile overflow checks passed.', 'Browser smoke routes passed: home → unit → reader → four content-study pages → quiz submit → progress → memorisation; mobile overflow checks passed.')
browser_path.write_text(browser, encoding='utf-8')

production_needle = '''  await page.evaluate(() => { window.location.hash = "#/unit/yueyanglouji/words/quiz"; });\n  await page.locator(".q-stem").first().waitFor({ state: "visible", timeout: 10000 });'''
production_insert = r'''  await page.evaluate(() => { window.location.hash = "#/unit/yueyanglouji/words"; });
  await page.locator(".study-page-shell.words-study").waitFor({ state: "visible", timeout: 10000 });
  const wordsOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(wordsOverflow <= 1, `production mobile words study page has horizontal overflow of ${wordsOverflow}px`);

  await page.evaluate(() => { window.location.hash = "#/unit/yueyanglouji/words/quiz"; });
  await page.locator(".q-stem").first().waitFor({ state: "visible", timeout: 10000 });'''
if production_needle not in production:
    raise SystemExit('production insertion point not found')
production = production.replace(production_needle, production_insert, 1)
production_path.write_text(production, encoding='utf-8')

print('Content Study UI 2.0 patch applied.')
