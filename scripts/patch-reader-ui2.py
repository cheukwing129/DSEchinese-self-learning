from pathlib import Path
import re

root = Path('.')
content_path = root / 'js/content-renderer.js'
css_path = root / 'css/style.css'
browser_path = root / 'scripts/browser-smoke.mjs'
production_path = root / 'scripts/production-smoke.mjs'

content = content_path.read_text()
css = css_path.read_text()
browser = browser_path.read_text()
production = production_path.read_text()

new_reader = r'''  // ---------- 1. 原文與誦讀 ----------
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
'''

pattern = re.compile(r'  // ---------- 1\. 原文與誦讀 ----------\n  function renderTextPage\(bundle, unitId\) \{.*?\n  // ---------- 2\. 字詞與句式 ----------', re.S)
match = pattern.search(content)
if not match:
    raise SystemExit('reader block not found')
content = content[:match.start()] + new_reader + '\n  // ---------- 2. 字詞與句式 ----------' + content[match.end():]

reader_css = r'''

/* ===== Reader UI 2.0: modern Chinese text workspace ===== */
.reader-shell {
  width: min(100%, 1080px);
  margin: 0 auto;
}
.reader-hero {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(280px, .7fr);
  gap: clamp(32px, 6vw, 72px);
  align-items: end;
  padding: 28px 4px 42px;
}
.reader-hero::before {
  content: "";
  position: absolute;
  z-index: -1;
  right: 8%;
  top: 5px;
  width: 250px;
  height: 190px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(111,171,151,.13), transparent 68%);
  filter: blur(10px);
  pointer-events: none;
}
.reader-page-title {
  margin: 8px 0 4px;
  color: var(--color-ink-soft);
  font-family: var(--font-body);
  font-size: 13px;
  font-weight: 800;
  letter-spacing: .08em;
}
.reader-work-title {
  margin: 0;
  color: var(--color-ink);
  font-family: var(--font-display);
  font-size: clamp(42px, 5.3vw, 68px);
  font-weight: 560;
  line-height: 1.08;
  letter-spacing: -.045em;
}
.reader-work-author {
  margin: 9px 0 0;
  color: var(--color-reader-orange);
  font-size: 13px;
  font-weight: 750;
  letter-spacing: .04em;
}
.reader-intro {
  max-width: 650px;
  margin: 18px 0 0;
  color: var(--color-ink-soft);
  font-size: 14px;
  line-height: 1.85;
}
.reader-hero-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  overflow: hidden;
  border: 1px solid rgba(23,73,64,.10);
  border-radius: 20px;
  background: rgba(252,252,250,.68);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.7);
}
.reader-hero-stats div {
  min-width: 0;
  padding: 17px 12px;
  text-align: center;
}
.reader-hero-stats div + div { border-left: 1px solid rgba(23,73,64,.08); }
.reader-hero-stats strong {
  display: block;
  color: var(--color-accent);
  font-family: var(--font-display);
  font-size: 24px;
  font-weight: 650;
  line-height: 1;
}
.reader-hero-stats span {
  display: block;
  margin-top: 7px;
  color: var(--color-ink-faint);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: .04em;
}
.reader-layout {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: clamp(22px, 4vw, 42px);
  align-items: start;
}
.reader-sidebar,
.reader-paper { min-width: 0; }
.reader-sidebar-sticky {
  position: sticky;
  top: 92px;
}
.reader-sidebar-heading {
  margin-bottom: 13px;
  padding: 0 3px;
}
.reader-sidebar-heading strong {
  display: block;
  margin-top: 5px;
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 650;
}
.reader-nav {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.reader-nav button {
  width: 100%;
  min-height: 48px;
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid transparent;
  border-radius: 13px;
  background: transparent;
  color: var(--color-ink-soft);
  cursor: pointer;
  text-align: left;
  font-family: var(--font-body);
  transition: background .16s ease, border-color .16s ease, color .16s ease, transform .16s ease;
}
.reader-nav button:hover {
  background: rgba(255,255,255,.58);
  color: var(--color-accent);
  transform: translateX(2px);
}
.reader-nav button.is-active {
  border-color: rgba(23,73,64,.10);
  background: rgba(226,239,234,.82);
  color: var(--color-accent);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.72);
}
.reader-nav-index {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 10px;
  background: rgba(23,73,64,.05);
  color: var(--color-ink-faint);
  font-family: var(--font-data);
  font-size: 9px;
  font-weight: 850;
}
.reader-nav button.is-active .reader-nav-index {
  background: var(--color-accent);
  color: #fff;
}
.reader-nav-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 760;
}
.reader-legend {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  margin-top: 16px;
  padding: 12px;
  border-top: 1px solid rgba(23,73,64,.09);
  color: var(--color-ink-faint);
}
.reader-legend > span {
  flex: none;
  width: 25px;
  height: 25px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  background: rgba(183,95,71,.10);
  color: var(--color-reader-orange);
  font-family: var(--font-display);
  font-size: 12px;
}
.reader-legend p {
  margin: 0;
  font-size: 10px;
  line-height: 1.65;
}
.reader-audio-wrap { margin-top: 12px; }
.reader-audio-wrap .card {
  margin: 0 !important;
  padding: 12px;
  border-radius: 14px;
  background: rgba(252,252,250,.58);
  box-shadow: none;
}
.reader-audio-wrap audio { height: 32px; }

.reader-paper {
  position: relative;
  overflow: hidden;
  padding: clamp(28px, 5vw, 58px);
  border: 1px solid rgba(23,73,64,.10);
  border-radius: 30px;
  background:
    linear-gradient(90deg, rgba(23,73,64,.025) 1px, transparent 1px) 0 0 / 56px 56px,
    linear-gradient(rgba(23,73,64,.018) 1px, transparent 1px) 0 0 / 56px 56px,
    rgba(253,252,248,.94);
  box-shadow: 0 28px 70px rgba(31,48,43,.085), inset 0 1px 0 rgba(255,255,255,.82);
}
.reader-paper::after {
  content: "";
  position: absolute;
  right: -90px;
  top: -100px;
  width: 220px;
  height: 220px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(111,171,151,.11), transparent 68%);
  pointer-events: none;
}
.reader-paper-head {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  padding-bottom: 22px;
  border-bottom: 1px solid rgba(23,73,64,.09);
}
.reader-step {
  margin: 0 0 7px;
  color: var(--color-reader-orange);
  font-family: var(--font-data);
  font-size: 9px;
  font-weight: 850;
  letter-spacing: .12em;
}
.reader-section-title {
  margin: 0;
  color: var(--color-ink);
  font-family: var(--font-display);
  font-size: clamp(25px, 3vw, 34px);
  font-weight: 620;
  line-height: 1.2;
}
.reader-section-title:focus { outline: none; }
.reader-paper-mark {
  flex: none;
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(183,95,71,.18);
  border-radius: 13px;
  background: rgba(244,229,223,.62);
  color: var(--color-reader-orange);
  font-family: var(--font-display);
  font-size: 18px;
}
.reader-passage { position: relative; z-index: 1; }
.reader-paragraph-block { padding: 30px 0 4px; }
.reader-paragraph-block + .reader-paragraph-block {
  margin-top: 24px;
  border-top: 1px solid rgba(23,73,64,.08);
}
.reader-paragraph-meta {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 12px;
  color: var(--color-ink-faint);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: .05em;
}
.reader-paper .text-passage {
  margin: 0;
  color: #202C28;
  font-family: var(--font-display);
  font-size: clamp(22px, 2.25vw, 28px);
  font-weight: 480;
  line-height: 2.2;
  letter-spacing: .025em;
  text-wrap: pretty;
}
.reader-paper .term {
  appearance: none;
  display: inline;
  margin: 0;
  padding: 0 .035em .04em;
  border: 0;
  border-bottom: 1.5px dotted rgba(183,95,71,.58);
  border-radius: 3px;
  background: linear-gradient(180deg, transparent 66%, rgba(244,229,223,.72) 66%);
  color: inherit;
  cursor: pointer;
  font: inherit;
  line-height: inherit;
  transition: color .14s ease, background .14s ease, border-color .14s ease;
}
.reader-paper .term:hover,
.reader-paper .term:focus-visible {
  border-color: var(--color-reader-orange);
  background: linear-gradient(180deg, transparent 52%, rgba(238,207,194,.72) 52%);
  color: #833E2F;
}
.reader-paper .para-summary {
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr);
  gap: 13px;
  margin: 22px 0 0;
  padding: 15px 16px;
  border: 0;
  border-left: 2px solid rgba(23,73,64,.20);
  border-radius: 0 12px 12px 0;
  background: rgba(226,239,234,.42);
  color: var(--color-ink-soft);
  font-family: var(--font-body);
}
.para-summary-label {
  padding-top: 2px;
  color: var(--color-accent);
  font-size: 10px;
  font-weight: 850;
  letter-spacing: .04em;
}
.reader-paper .para-summary p {
  margin: 0;
  font-size: 12px;
  line-height: 1.8;
}
.reader-section-nav {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 14px;
  margin-top: 34px;
  padding-top: 20px;
  border-top: 1px solid rgba(23,73,64,.09);
}
.reader-step-button {
  min-height: 42px;
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  padding: 8px 0;
  border: 0;
  background: transparent;
  color: var(--color-ink-soft);
  cursor: pointer;
  font-family: var(--font-body);
  font-size: 11px;
  font-weight: 800;
}
.reader-step-button.is-next { justify-content: flex-end; color: var(--color-accent); }
.reader-step-button:hover:not(:disabled) { color: var(--color-reader-orange); }
.reader-step-button:disabled { opacity: .28; cursor: default; }
#reader-section-count {
  color: var(--color-ink-faint);
  font-family: var(--font-data);
  font-size: 10px;
}
.reader-study-note {
  display: flex;
  gap: 13px;
  align-items: flex-start;
  max-width: 760px;
  margin: 24px 0 0 auto;
  padding: 16px 18px;
  border: 1px solid rgba(23,73,64,.08);
  border-radius: 16px;
  background: rgba(252,252,250,.56);
  color: var(--color-ink-soft);
}
.reader-note-mark {
  flex: none;
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border-radius: 10px;
  background: rgba(23,73,64,.07);
  color: var(--color-accent);
  font-family: var(--font-display);
  font-size: 13px;
}
.reader-study-note strong { color: var(--color-ink); font-size: 12px; }
.reader-study-note p { margin: 3px 0 0; font-size: 11px; line-height: 1.75; }

.annotation-backdrop {
  position: fixed;
  inset: 0;
  z-index: 199;
  background: rgba(17,30,26,.11);
  backdrop-filter: blur(1px);
  -webkit-backdrop-filter: blur(1px);
}
.annotation-popover {
  position: fixed;
  z-index: 200;
  width: min(360px, calc(100vw - 24px));
  max-width: 360px;
  padding: 22px;
  border: 1px solid rgba(255,255,255,.10);
  border-radius: 20px;
  background:
    radial-gradient(circle at 100% 0%, rgba(115,177,156,.18), transparent 35%),
    #153F38;
  color: #F8F5EE;
  box-shadow: 0 24px 70px rgba(16,34,29,.28), inset 0 1px 0 rgba(255,255,255,.08);
  font-family: var(--font-body);
  font-size: 13px;
  line-height: 1.75;
}
.annotation-kicker {
  margin-bottom: 7px;
  color: #A8D0C2;
  font-family: var(--font-data);
  font-size: 9px;
  font-weight: 850;
  letter-spacing: .12em;
  text-transform: uppercase;
}
.annotation-popover .term-name {
  margin: 0 34px 8px 0;
  color: #FFF9EC;
  font-family: var(--font-display);
  font-size: 25px;
  font-weight: 650;
  line-height: 1.2;
}
.annotation-popover .reading {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin: 0 0 12px;
  opacity: 1;
}
.annotation-popover .reading span {
  padding: 4px 7px;
  border: 1px solid rgba(255,255,255,.10);
  border-radius: 999px;
  background: rgba(255,255,255,.06);
  color: #C9DED7;
  font-size: 10px;
  line-height: 1.2;
}
.annotation-explanation { color: rgba(255,255,255,.86); }
.annotation-close {
  position: absolute;
  right: 12px;
  top: 12px;
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 10px;
  background: rgba(255,255,255,.07);
  color: rgba(255,255,255,.72);
  cursor: pointer;
  font-size: 20px;
  line-height: 1;
}
.annotation-close:hover { background: rgba(255,255,255,.13); color: #fff; }

@media (max-width: 780px) {
  .reader-hero { grid-template-columns: 1fr; gap: 22px; padding-top: 16px; }
  .reader-hero-stats { max-width: 460px; }
  .reader-layout { grid-template-columns: 1fr; gap: 14px; }
  .reader-sidebar-sticky { position: static; }
  .reader-sidebar-heading { display: none; }
  .reader-nav {
    flex-direction: row;
    max-width: 100%;
    overflow-x: auto;
    overscroll-behavior-inline: contain;
    scrollbar-width: none;
    padding: 2px 0 6px;
  }
  .reader-nav::-webkit-scrollbar { display: none; }
  .reader-nav button {
    flex: 0 0 auto;
    width: auto;
    min-width: 118px;
    grid-template-columns: 28px auto;
    min-height: 44px;
    padding: 6px 9px;
  }
  .reader-nav-index { width: 27px; height: 27px; border-radius: 9px; }
  .reader-legend { display: none; }
  .reader-audio-wrap { margin: 4px 0 0; }
}

@media (max-width: 560px) {
  .reader-hero { padding: 10px 0 25px; }
  .reader-work-title { font-size: 42px; line-height: 1.1; }
  .reader-intro { margin-top: 14px; font-size: 13px; line-height: 1.75; }
  .reader-hero-stats div { padding: 14px 8px; }
  .reader-hero-stats strong { font-size: 21px; }
  .reader-hero-stats span { font-size: 8px; }
  .reader-paper { padding: 24px 19px; border-radius: 24px; }
  .reader-paper-head { padding-bottom: 18px; }
  .reader-paper-mark { width: 37px; height: 37px; border-radius: 12px; }
  .reader-paragraph-block { padding-top: 24px; }
  .reader-paragraph-meta { margin-bottom: 9px; }
  .reader-paper .text-passage { font-size: 21px; line-height: 2.15; letter-spacing: .015em; }
  .reader-paper .para-summary { grid-template-columns: 1fr; gap: 5px; margin-top: 18px; padding: 13px 14px; }
  .reader-section-nav { margin-top: 28px; }
  .reader-study-note { margin-top: 16px; padding: 14px; }
  .annotation-backdrop { background: rgba(17,30,26,.24); backdrop-filter: blur(3px); }
  .annotation-popover {
    width: auto;
    max-width: none;
    padding: 21px 20px 24px;
    border-radius: 22px;
    box-shadow: 0 18px 55px rgba(16,34,29,.32);
  }
}

@media (prefers-reduced-motion: reduce) {
  .reader-nav button,
  .reader-paper .term,
  .reader-step-button { transition: none !important; }
}
'''

if '/* ===== Reader UI 2.0:' not in css:
    css += reader_css

browser_old = '''  await page.evaluate(() => { window.location.hash = "#/unit/yueyanglouji/text"; });
  await waitForTitle(page, "原文與誦讀");
  const term = page.locator("button.term").first();'''
browser_new = '''  await page.evaluate(() => { window.location.hash = "#/unit/yueyanglouji/text"; });
  await waitForTitle(page, "原文與誦讀");
  check(await page.locator(".reader-shell").count() === 1, "text route should render the dedicated reader workspace");
  check(await page.locator(".reader-paper").count() === 1, "reader should expose a focused reading paper surface");
  const readerTabs = page.locator(".reader-nav [role=\\"tab\\"]");
  check(await readerTabs.count() === 5, "Yueyang reader should expose five paragraph navigation tabs");
  const firstReaderLabel = await page.locator("#reader-section-title").textContent();
  await page.locator("#reader-next-btn").click();
  const secondReaderLabel = await page.locator("#reader-section-title").textContent();
  check(firstReaderLabel !== secondReaderLabel, "reader next control should advance the visible section");
  await readerTabs.first().click();
  const term = page.locator("button.term").first();'''
if browser_old not in browser:
    raise SystemExit('browser reader smoke block not found')
browser = browser.replace(browser_old, browser_new)

browser_mobile_old = '''  const homeOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(homeOverflow <= 1, `mobile home has horizontal overflow of ${homeOverflow}px`);
  await page.evaluate(() => { window.location.hash = "#/unit/yueyanglouji/words/quiz"; });'''
browser_mobile_new = '''  const homeOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(homeOverflow <= 1, `mobile home has horizontal overflow of ${homeOverflow}px`);
  await page.evaluate(() => { window.location.hash = "#/unit/yueyanglouji/text"; });
  await page.locator(".reader-shell").waitFor({ state: "visible", timeout: 5000 });
  const readerOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(readerOverflow <= 1, `mobile reader has horizontal overflow of ${readerOverflow}px`);
  await page.evaluate(() => { window.location.hash = "#/unit/yueyanglouji/words/quiz"; });'''
if browser_mobile_old not in browser:
    raise SystemExit('browser mobile block not found')
browser = browser.replace(browser_mobile_old, browser_mobile_new)

production_old = '''  await page.evaluate(() => { window.location.hash = "#/unit/yueyanglouji/text"; });
  await page.locator(".page-title", { hasText: "原文與誦讀" }).waitFor({ state: "visible", timeout: 10000 });
  await page.locator("button.term").first().click();'''
production_new = '''  await page.evaluate(() => { window.location.hash = "#/unit/yueyanglouji/text"; });
  await page.locator(".page-title", { hasText: "原文與誦讀" }).waitFor({ state: "visible", timeout: 10000 });
  await page.locator(".reader-shell").waitFor({ state: "visible", timeout: 4000 });
  const readerOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(readerOverflow <= 1, `production mobile reader has horizontal overflow of ${readerOverflow}px`);
  await page.locator("button.term").first().click();'''
if production_old not in production:
    raise SystemExit('production reader block not found')
production = production.replace(production_old, production_new)

content_path.write_text(content)
css_path.write_text(css)
browser_path.write_text(browser)
production_path.write_text(production)
print('Reader UI 2.0 patch applied')
