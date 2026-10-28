/* 跨篇章原文搜尋：按原句位置配對既有注釋，不推斷未提供的字義。 */
const TextSearch = (() => {
  "use strict";
  const esc = (value) => App.escapeHTML(String(value == null ? "" : value));

  function positions(source, term) {
    if (!term) return [];
    const hits = [];
    let cursor = 0, start;
    while ((start = source.indexOf(term, cursor)) !== -1) {
      hits.push({ start, end: start + term.length });
      cursor = start + term.length;
    }
    return hits;
  }

  function highlight(source, term) {
    let html = "", cursor = 0;
    positions(source, term).forEach(({ start, end }) => {
      html += esc(source.slice(cursor, start)) + `<mark>${esc(source.slice(start, end))}</mark>`;
      cursor = end;
    });
    return html + esc(source.slice(cursor));
  }

  function findInText(text, query) {
    const term = query.trim();
    if (!term) return [];
    const notes = new Map([...(text.annotations || []).map((note) => [note.id, { ...note, origin: "篇章注釋" }]),
      ...(text.reader_annotations || []).map((note) => [note.id, { ...note, origin: "閱讀補註" }])]);
    return (text.paragraphs || []).flatMap((paragraph) => {
      const hits = positions(paragraph.text, term);
      if (!hits.length) return [];
      const locatedNotes = [...(paragraph.annotation_ids || []), ...(paragraph.reader_annotation_ids || [])]
        .map((id) => notes.get(id)).filter((note) => note && note.term)
        .map((note) => ({ note, range: positions(paragraph.text, note.term)[(note.occurrence || 1) - 1] }))
        .filter((item) => item.range);
      // 句號、問號、感嘆號和分號分句；保留逗號前後的語境及原有標點。
      const sentences = /[。！？；\n]/u.test(term)
        ? [{ 0: paragraph.text, index: 0 }]
        : [...paragraph.text.matchAll(/[^。！？；\n]+[。！？；\n]?[」』”’）】]*/gu)];
      return sentences.flatMap((sentence) => {
        const start = sentence.index, end = start + sentence[0].length;
        const sentenceHits = hits.filter((hit) => hit.start < end && hit.end > start);
        if (!sentenceHits.length) return [];
        const seen = new Set();
        const matchingNotes = locatedNotes.filter(({ range }) => sentenceHits.some((hit) =>
          range.start < hit.end && range.end > hit.start)).map(({ note }) => note)
          .filter((note) => {
            const key = `${note.term}\u0000${note.explanation}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
        return [{ paragraphId: paragraph.id,
          label: [paragraph.section, paragraph.label || `第${paragraph.id}段`].filter(Boolean).join(" · "),
          sentence: sentence[0], count: sentenceHits.length, notes: matchingNotes }];
      });
    });
  }

  function render(curriculum, query = {}, loadText) {
    const units = (curriculum.units || []).filter((unit) => unit.status === "available");
    const selected = new Set(query.units === undefined ? units.map((unit) => unit.id) : query.units.split(","));
    App.mount(`
      <div class="text-search-page" id="text-search-page">
        <header class="text-search-head">
          <p class="section-kicker">原文檢索 · 跨篇比較</p>
          <h1 class="page-title">跨篇章字詞搜尋</h1>
          <p>一次查看同一字詞在不同篇章的用法，對照原句與相關注釋。</p>
        </header>
        <form id="text-search-form" class="text-search-controls" role="search" aria-label="跨篇章原文搜尋">
          <label for="text-search-query">搜尋字詞</label>
          <div class="text-search-input-row">
            <input id="text-search-query" name="q" type="search" maxlength="80" autocomplete="off" enterkeyhint="search"
              placeholder="輸入字詞，例如：之、而、以、故" value="${esc((query.q || "").slice(0, 80))}" aria-describedby="text-search-help" />
            <button type="submit" class="btn btn-primary">搜尋</button>
          </div>
          <p class="text-search-help" id="text-search-help">按原文字形搜尋；結果顯示含該字詞的原句，並以篇章分類。</p>
          <div class="text-search-examples" aria-label="搜尋例子">試搜：${["之", "而", "以", "故"].map((term) =>
            `<button type="button" data-search-example="${term}">${term}</button>`).join("")}</div>
          <details class="text-search-scope-picker" ${window.matchMedia("(min-width: 640px)").matches ? "open" : ""}>
            <summary>搜尋範圍 <span id="text-search-scope-count"></span><small>選擇篇章</small></summary>
          <fieldset class="text-search-scope">
            <legend class="sr-only">選擇要搜尋的篇章</legend>
            <div class="text-search-scope-actions"><button type="button" data-select-scope="all">全選篇章</button>
              <button type="button" data-select-scope="none">清除選擇</button><span>可單選或同時勾選多篇</span></div>
            <div class="text-search-unit-grid">${units.map((unit) => `
              <label><input type="checkbox" name="unit" value="${esc(unit.id)}" ${selected.has(unit.id) ? "checked" : ""} />
                <span>${esc(unit.title)}</span></label>`).join("")}</div>
          </fieldset>
          </details>
        </form>
        <section class="text-search-results" aria-labelledby="text-search-results-title" aria-busy="false">
          <h2 id="text-search-results-title">搜尋結果</h2>
          <p id="text-search-status" role="status" aria-live="polite" aria-atomic="true"></p>
          <div id="text-search-results"></div>
        </section>
        <a class="home-text-link" href="#/">返回篇章目錄 <span aria-hidden="true">→</span></a>
      </div>`);
    const root = document.getElementById("text-search-page");
    const input = root.querySelector("#text-search-query");
    const form = root.querySelector("form");
    const boxes = [...root.querySelectorAll('input[name="unit"]')];
    const status = root.querySelector("#text-search-status");
    const result = root.querySelector("#text-search-results");
    const region = root.querySelector(".text-search-results");
    let revision = 0, timer, composing = false;

    async function search() {
      clearTimeout(timer);
      const request = ++revision;
      if (!root.isConnected) return;
      const term = input.value.trim();
      const chosen = units.filter((unit) => boxes.some((box) => box.value === unit.id && box.checked));
      root.querySelector("#text-search-scope-count").textContent = `（已選 ${chosen.length} / ${units.length} 篇）`;
      const params = new URLSearchParams();
      if (term) params.set("q", term);
      if (chosen.length !== units.length) params.set("units", chosen.map((unit) => unit.id).join(","));
      const suffix = params.toString();
      window.history.replaceState(null, "", `#/search${suffix ? "?" + suffix : ""}`);
      result.innerHTML = "";
      region.setAttribute("aria-busy", "false");
      if (!chosen.length) {
        status.textContent = "尚未選擇篇章，請至少勾選一篇範文。";
        return;
      }
      if (!term) {
        status.textContent = `已選 ${chosen.length} 篇範文，輸入字詞即可搜尋。`;
        return;
      }
      status.textContent = `正在搜尋 ${chosen.length} 篇範文…`;
      region.setAttribute("aria-busy", "true");
      const loaded = await Promise.allSettled(chosen.map((unit) => loadText(unit.id)));
      if (!root.isConnected || request !== revision) return;
      const failed = [], groups = [];
      loaded.forEach((item, index) => {
        if (item.status === "rejected") { failed.push(chosen[index]); return; }
        const rows = findInText(item.value, term);
        if (rows.length) groups.push({ unit: chosen[index], rows, count: rows.reduce((sum, row) => sum + row.count, 0) });
      });
      const count = groups.reduce((sum, group) => sum + group.count, 0);
      const sentences = groups.reduce((sum, group) => sum + group.rows.length, 0);
      status.textContent = failed.length === chosen.length
        ? "篇章未能載入，暫時無法完成搜尋。請重試。"
        : `${failed.length ? "部分結果：" : ""}「${term}」共 ${count} 次，${sentences} 組原句，分布於 ${groups.length} 篇；已搜尋 ${chosen.length - failed.length} / ${chosen.length} 篇。`;
      const failures = failed.length ? `<aside class="text-search-warning"><p>未能載入：${failed.map((unit) => `《${esc(unit.title)}》`).join("、")}。以下結果尚未涵蓋這些篇章。</p><button type="button" class="btn btn-secondary" data-search-retry>重試載入</button></aside>` : "";
      result.innerHTML = failures + (groups.length ? `
        <nav class="text-search-jump" aria-label="按篇章跳至搜尋結果">${groups.map(({ unit, count }) =>
          `<a href="#text-search-group-${esc(unit.id)}" data-result-jump="${esc(unit.id)}">${esc(unit.title)} <span>${count}</span></a>`).join("")}</nav>
        <p class="text-search-help">以下列出全部符合原句。注釋按原文位置配對；同一字詞在不同語境可有不同字義。</p>
        ${groups.map(({ unit, rows, count }) => `
          <section class="text-search-group" id="text-search-group-${esc(unit.id)}" aria-labelledby="text-search-title-${esc(unit.id)}">
            <header><div><h3 id="text-search-title-${esc(unit.id)}" tabindex="-1">《${esc(unit.title)}》</h3><p>${esc(unit.author || "")} · ${count} 次 · ${rows.length} 組原句</p></div>
              <a href="#/unit/${esc(unit.id)}/text">閱讀篇章</a></header>
            <ol>${rows.map((row) => `<li class="text-search-row">
              <div class="text-search-row-meta"><span>${esc(row.label)}${row.count > 1 ? ` · ${row.count} 次` : ""}</span>
                <a href="#/unit/${esc(unit.id)}/text?paragraph=${encodeURIComponent(row.paragraphId)}">查看原段 <span aria-hidden="true">↗</span></a></div>
              <p class="text-search-sentence">${highlight(row.sentence, term)}</p>
              ${row.notes.length ? `<dl class="text-search-notes">${row.notes.map((note) =>
                `<div><dt>${highlight(note.term, term)} <small>${esc(note.origin)}</small></dt><dd>${esc(note.explanation || "")}</dd></div>`).join("")}</dl>`
                : '<p class="text-search-unannotated">此處未有對應字詞注釋，請按原文語境判讀。</p>'}
            </li>`).join("")}</ol>
          </section>`).join("")}`
        : !failed.length ? '<p class="text-search-empty">所選篇章未找到這個字詞。可改用單字、檢查原文字形，或擴大搜尋範圍。</p>' : "");
      region.setAttribute("aria-busy", "false");
    }

    function schedule() {
      ++revision; // 立即使舊請求失效，避免在輸入防抖期間顯示舊結果。
      clearTimeout(timer);
      timer = setTimeout(search, 180);
    }
    input.addEventListener("compositionstart", () => { composing = true; ++revision; clearTimeout(timer); });
    input.addEventListener("compositionend", () => { composing = false; schedule(); });
    input.addEventListener("input", (event) => { if (!composing && !event.isComposing) schedule(); });
    form.addEventListener("submit", (event) => { event.preventDefault(); if (!composing) search(); });
    boxes.forEach((box) => box.addEventListener("change", search));
    root.querySelectorAll("[data-select-scope]").forEach((button) => button.addEventListener("click", () => {
      boxes.forEach((box) => { box.checked = button.dataset.selectScope === "all"; });
      search();
    }));
    root.querySelectorAll("[data-search-example]").forEach((button) => button.addEventListener("click", () => {
      input.value = button.dataset.searchExample;
      search();
    }));
    result.addEventListener("click", (event) => {
      if (event.target.closest("[data-search-retry]")) search();
      const link = event.target.closest("[data-result-jump]");
      if (link) {
        event.preventDefault();
        const heading = document.getElementById(`text-search-title-${link.dataset.resultJump}`);
        heading.focus({ preventScroll: true });
        heading.scrollIntoView({ block: "start" });
      }
    });
    search();
  }

  return { render, findInText, highlight };
})();
