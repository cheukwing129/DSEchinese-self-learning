from pathlib import Path

renderer_path = Path('js/content-renderer.js')
browser_path = Path('scripts/browser-smoke.mjs')
css_path = Path('css/style.css')

renderer = renderer_path.read_text(encoding='utf-8')
browser = browser_path.read_text(encoding='utf-8')
css = css_path.read_text(encoding='utf-8')

renderer = renderer.replace(
'''          <article class="word-study-card" data-word-card data-search="${esc(searchText)}">''',
'''          <article class="word-study-card" data-word-card data-word-index="${index}" data-search="${esc(searchText)}">''',
1)

renderer = renderer.replace(
'''          <p class="word-filter-status" id="word-filter-status" aria-live="polite">顯示全部 ${annotations.length} 個字詞</p>
          <div class="word-study-grid" id="word-study-grid">
            ${cards || `<div class="progress-empty-card"><span aria-hidden="true">字</span><div><strong>本篇暫未提供字詞資料</strong><p>可先閱讀原文或進入其他學習模組。</p></div></div>`}
          </div>
        </section>''',
'''          <p class="word-filter-status" id="word-filter-status" aria-live="polite"></p>
          <div class="word-study-grid" id="word-study-grid">
            ${cards || `<div class="progress-empty-card"><span aria-hidden="true">字</span><div><strong>本篇暫未提供字詞資料</strong><p>可先閱讀原文或進入其他學習模組。</p></div></div>`}
          </div>
          ${annotations.length > 12 ? `<div class="word-grid-footer"><button type="button" class="btn btn-secondary" id="word-expand-btn">查看全部 ${annotations.length} 個字詞</button><small>搜尋時會自動涵蓋全部字詞。</small></div>` : ""}
        </section>''',
1)

old_logic = '''    const filter = document.getElementById("word-filter");
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
    }'''
new_logic = '''    const filter = document.getElementById("word-filter");
    const status = document.getElementById("word-filter-status");
    const expandButton = document.getElementById("word-expand-btn");
    let expanded = annotations.length <= 12;
    const applyWordFilter = () => {
      if (!filter || !status) return;
      const query = filter.value.trim().toLowerCase();
      const searching = Boolean(query);
      let visible = 0;
      document.querySelectorAll("[data-word-card]").forEach((card, index) => {
        const match = !query || String(card.dataset.search || "").includes(query);
        const show = match && (searching || expanded || index < 12);
        card.hidden = !show;
        if (show) visible += 1;
      });
      status.textContent = searching
        ? `找到 ${visible} 個符合項目（搜尋範圍：全部 ${annotations.length} 個字詞）`
        : expanded
          ? `顯示全部 ${annotations.length} 個字詞`
          : `先顯示 12 / ${annotations.length} 個字詞`;
      if (expandButton) {
        expandButton.hidden = searching;
        expandButton.textContent = expanded ? "收起至首 12 個" : `查看全部 ${annotations.length} 個字詞`;
      }
    };
    if (filter && status) {
      filter.addEventListener("input", applyWordFilter);
      if (expandButton) {
        expandButton.addEventListener("click", () => {
          expanded = !expanded;
          applyWordFilter();
          if (!expanded) document.getElementById("word-bank-title")?.scrollIntoView({ block: "start" });
        });
      }
      applyWordFilter();
    }'''
if old_logic not in renderer:
    raise SystemExit('word filter logic not found')
renderer = renderer.replace(old_logic, new_logic, 1)
renderer_path.write_text(renderer, encoding='utf-8')

css_needle = '''.word-study-card p { margin: 0; color: var(--color-ink-soft); font-size: 13px; line-height: 1.78; }
'''
css_insert = '''.word-study-card p { margin: 0; color: var(--color-ink-soft); font-size: 13px; line-height: 1.78; }
.word-grid-footer { display: flex; align-items: center; justify-content: center; gap: 12px; margin-top: 20px; }
.word-grid-footer small { color: var(--color-ink-faint); font-size: 10px; }
.word-grid-footer .btn[hidden] { display: none; }
'''
if css_needle not in css:
    raise SystemExit('word CSS insertion point not found')
css = css.replace(css_needle, css_insert, 1)
css = css.replace('''  .word-study-card h2 { font-size: 23px; }
''', '''  .word-study-card h2 { font-size: 23px; }
  .word-grid-footer { align-items: stretch; flex-direction: column; text-align: center; }
''', 1)
css_path.write_text(css, encoding='utf-8')

browser_old = '''  check(await page.locator("[data-word-card]").count() > 10, "words route should render the annotation bank as study cards");
  await page.locator("#word-filter").fill("謫守");'''
browser_new = '''  check(await page.locator("[data-word-card]").count() > 10, "words route should render the annotation bank as study cards");
  check(await page.locator("[data-word-card]:visible").count() === 12, "large word banks should initially show a focused set of twelve cards");
  await page.locator("#word-expand-btn").click();
  check(await page.locator("[data-word-card]:visible").count() > 12, "word bank expand control should reveal the remaining cards");
  await page.locator("#word-expand-btn").click();
  await page.locator("#word-filter").fill("謫守");'''
if browser_old not in browser:
    raise SystemExit('browser words check not found')
browser = browser.replace(browser_old, browser_new, 1)
browser_path.write_text(browser, encoding='utf-8')

print('Content Study UI word-bank polish applied.')
