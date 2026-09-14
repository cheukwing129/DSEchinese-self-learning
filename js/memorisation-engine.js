/* ============================================================
   memorisation-engine.js — 背誦精華：句群背誦／遮字／重組／易錯字
   ============================================================ */

const MemorisationEngine = (() => {
  const esc = App.escapeHTML;

  function render(bundle, unitId) {
    const { memorisation, unit } = bundle;
    const groups = memorisation.sentence_groups || [];
    let activeTab = "groups";
    let activeGroupId = groups.length ? groups[0].id : null;
    let clozeState = {};   // groupId -> { blanks, revealed, inputs, result }
    let reorderState = {}; // groupId -> { chips, placed, result }
    let charsMarkedThisSession = false;

    function progressSummaryHTML() {
      const stats = Progress.memorisationStats(unitId, groups);
      return `
        <div class="card card-tight" style="margin-bottom:16px;">
          <div style="display:flex; justify-content:space-between; gap:12px; align-items:center; flex-wrap:wrap;">
            <div>
              <strong>背誦練習紀錄</strong>
              <p style="margin:4px 0 0; font-size:13px; color:var(--color-ink-soft);">
                已練習 ${stats.practisedGroups}/${stats.totalGroups} 個句群 · 雙項都練習 ${stats.bothPractisedGroups}/${stats.totalGroups}
              </p>
            </div>
            <a class="btn btn-ghost" href="#/unit/${unitId}/progress">查看我的掌握 →</a>
          </div>
        </div>`;
    }

    function paint() {
      App.mount(`
        <h1 class="page-title">背誦精華</h1>
        <p class="page-subtitle">句群背誦 · 遮字練習 · 句序重組 · 易錯字重溫</p>
        ${progressSummaryHTML()}
        <div class="para-nav">
          <button data-tab="groups" class="${activeTab === "groups" ? "is-active" : ""}">句群背誦</button>
          <button data-tab="cloze" class="${activeTab === "cloze" ? "is-active" : ""}">遮字練習</button>
          <button data-tab="reorder" class="${activeTab === "reorder" ? "is-active" : ""}">句序重組</button>
          <button data-tab="chars" class="${activeTab === "chars" ? "is-active" : ""}">易錯字重溫</button>
        </div>
        <div id="memo-body"></div>
        ${App.footerNav(unitId, unit.title)}
      `);
      document.querySelectorAll("[data-tab]").forEach((btn) =>
        btn.addEventListener("click", () => {
          activeTab = btn.dataset.tab;
          paint();
        })
      );
      renderBody();
    }

    function renderBody() {
      const el = document.getElementById("memo-body");
      if (!groups.length) {
        el.innerHTML = `<p class="empty-state">本篇尚未提供背誦句群。</p>`;
        return;
      }

      if (activeTab === "groups") {
        el.innerHTML = groups
          .map(
            (g) => `
          <div class="card">
            <p style="font-size:12px; color:var(--color-ink-soft); margin:0 0 6px;">第${g.paragraph}段 · ${esc(g.title)}</p>
            <p class="text-passage" style="font-size:17px;">${esc(g.text)}</p>
          </div>`
          )
          .join("");
      } else if (activeTab === "cloze") {
        renderCloze(el);
      } else if (activeTab === "reorder") {
        renderReorder(el);
      } else if (activeTab === "chars") {
        if (!charsMarkedThisSession) {
          Progress.markMemorisationCharactersViewed(unitId);
          charsMarkedThisSession = true;
        }
        el.innerHTML = `<div class="module-grid">${(memorisation.error_prone_characters || [])
          .map(
            (c) => `
          <div class="card card-tight">
            <p style="margin:0; font-size:20px; font-family:var(--font-display); color:var(--color-accent); font-weight:700;">${esc(c.char)}</p>
            <p style="margin:6px 0 2px; font-size:13px; color:var(--color-ink-soft);">${esc(c.context)}</p>
            <p style="margin:0; font-size:13px;">${esc(c.note)}</p>
          </div>`
          )
          .join("")}</div>`;
      }
    }

    function groupSelector() {
      const stats = Progress.memorisationStats(unitId, groups);
      const byId = Object.fromEntries(stats.groups.map((g) => [g.id, g]));
      return `
        <div class="para-nav">
          ${groups
            .map((g) => {
              const s = byId[g.id];
              const practised = s && s.practised ? " · 已練" : "";
              return `<button data-group="${g.id}" class="${activeGroupId === g.id ? "is-active" : ""}">${esc(g.title)}${practised}</button>`;
            })
            .join("")}
        </div>`;
    }

    // ---------- 遮字練習 ----------
    function buildCloze(group) {
      if (clozeState[group.id]) return clozeState[group.id];
      const chars = [...group.text];
      const eligible = [];
      const blanks = [];
      chars.forEach((ch, i) => {
        if (!/[\u4e00-\u9fff]/.test(ch)) return;
        eligible.push(i);
        if (Math.random() < 0.25) blanks.push(i);
      });
      if (!blanks.length && eligible.length) {
        blanks.push(eligible[Math.floor(Math.random() * eligible.length)]);
      }
      clozeState[group.id] = { blanks, revealed: false, inputs: {}, result: null };
      return clozeState[group.id];
    }

    function renderCloze(el) {
      const group = groups.find((g) => g.id === activeGroupId) || groups[0];
      activeGroupId = group.id;
      const st = buildCloze(group);
      const chars = [...group.text];
      const rendered = chars
        .map((ch, i) => {
          if (!st.blanks.includes(i)) return esc(ch);
          if (st.revealed) return `<span style="color:var(--color-accent); font-weight:700;">${esc(ch)}</span>`;
          return `<input type="text" maxlength="1" data-blank-idx="${i}" aria-label="第 ${st.blanks.indexOf(i) + 1} 個被遮蓋的字" class="blank-token" style="width:1.4em; border:none; border-bottom:2px solid var(--color-accent); text-align:center; font-family:var(--font-display); font-size:19px;" value="${esc(st.inputs[i] || "")}" />`;
        })
        .join("");
      const resultHTML = st.result
        ? `<div id="cloze-result" class="reveal-panel ${st.result.correct === st.result.total ? "" : "is-incorrect"}" role="status" aria-live="polite" tabindex="-1" style="margin-top:14px;">
            <div class="reveal-row"><b>${st.result.correct === st.result.total ? "✓ 全部填對" : `本次填對 ${st.result.correct}/${st.result.total} 字`}</b></div>
            <div class="reveal-explanation">本次紀錄已儲存；「我的掌握」會保留此句群的遮字最高正確率。</div>
          </div>`
        : "";

      el.innerHTML = `
        ${groupSelector()}
        <div class="card">
          <p style="font-size:12px; color:var(--color-ink-soft); margin:0 0 10px;">第${group.paragraph}段 · ${esc(group.title)}（填入被遮蓋的字）</p>
          <p class="text-passage" style="font-size:19px; line-height:2.4;">${rendered}</p>
          <div class="btn-row">
            <button class="btn btn-primary" id="cloze-check-btn" ${st.revealed ? "disabled" : ""}>${st.revealed ? "已對照答案" : "對照答案"}</button>
            <button class="btn btn-secondary" id="cloze-retry-btn">重新出題</button>
          </div>
          ${resultHTML}
        </div>
      `;
      bindGroupSelector(renderBody);
      document.querySelectorAll("[data-blank-idx]").forEach((inp) => {
        inp.addEventListener("input", () => {
          st.inputs[inp.dataset.blankIdx] = inp.value;
        });
      });
      const checkBtn = document.getElementById("cloze-check-btn");
      if (checkBtn && !st.revealed) {
        checkBtn.addEventListener("click", () => {
          const correct = st.blanks.filter((i) => (st.inputs[i] || "").trim() === chars[i]).length;
          st.result = { correct, total: st.blanks.length };
          st.revealed = true;
          Progress.recordMemorisationAttempt(unitId, group.id, "cloze", st.result);
          paint();
          const result = document.getElementById("cloze-result");
          if (result) result.focus();
        });
      }
      document.getElementById("cloze-retry-btn").addEventListener("click", () => {
        delete clozeState[group.id];
        renderCloze(el);
      });
    }

    // ---------- 句序重組 ----------
    function segmentText(text) {
      return text.split(/(?<=[，。；！])/).filter((s) => s.trim());
    }

    function buildReorder(group) {
      if (reorderState[group.id]) return reorderState[group.id];
      const segments = segmentText(group.text);
      const shuffled = shuffle(segments.map((s, i) => ({ id: i, text: s })));
      reorderState[group.id] = { segments, chips: shuffled, placed: [], result: null };
      return reorderState[group.id];
    }

    function shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    }

    function renderReorder(el) {
      const group = groups.find((g) => g.id === activeGroupId) || groups[0];
      activeGroupId = group.id;
      const st = buildReorder(group);
      const remaining = st.chips.filter((c) => !st.placed.includes(c.id));
      const resultHTML = st.result === null
        ? ""
        : `<div id="reorder-result" class="reveal-panel ${st.result ? "" : "is-incorrect"}" role="status" aria-live="polite" tabindex="-1" style="margin-top:14px;">
            <div class="reveal-row"><b>${st.result ? "✓ 排序正確！" : "✗ 排序與原文不符"}</b></div>
            ${!st.result ? `<div class="reveal-explanation">原文：${esc(group.text)}</div>` : ""}
            <div class="reveal-explanation">本次紀錄已儲存；答錯可按「重新排列」再試。</div>
          </div>`;

      el.innerHTML = `
        ${groupSelector()}
        <div class="card">
          <p style="font-size:12px; color:var(--color-ink-soft); margin:0 0 10px;">第${group.paragraph}段 · ${esc(group.title)}（依次選取句子片段，排出正確次序）</p>
          <div class="reorder-slots" id="reorder-slots">
            ${st.placed.map((id) => `<span class="reorder-chip is-placed">${esc(st.chips.find((c) => c.id === id).text)}</span>`).join("")}
          </div>
          <div class="reorder-list" id="reorder-pool">
            ${remaining.map((c) => `<button type="button" class="reorder-chip" data-chip="${c.id}" aria-label="加入排序：${esc(c.text)}">${esc(c.text)}</button>`).join("")}
          </div>
          <div class="btn-row">
            <button class="btn btn-secondary" id="reorder-reset-btn">重新排列</button>
          </div>
          ${resultHTML}
        </div>
      `;
      bindGroupSelector(renderBody);
      document.querySelectorAll("[data-chip]").forEach((chip) => {
        chip.addEventListener("click", () => {
          st.placed.push(parseInt(chip.dataset.chip, 10));
          if (st.placed.length === st.chips.length) {
            const orderedText = st.placed.map((id) => st.chips.find((c) => c.id === id).text).join("");
            st.result = orderedText === group.text;
            Progress.recordMemorisationAttempt(unitId, group.id, "reorder", { isCorrect: st.result });
            paint();
            const result = document.getElementById("reorder-result");
            if (result) result.focus();
            return;
          }
          renderReorder(el);
          const nextChip = document.querySelector("[data-chip]");
          if (nextChip) nextChip.focus();
        });
      });
      document.getElementById("reorder-reset-btn").addEventListener("click", () => {
        delete reorderState[group.id];
        renderReorder(el);
      });
    }

    function bindGroupSelector(afterFn) {
      document.querySelectorAll("[data-group]").forEach((btn) => {
        btn.addEventListener("click", () => {
          activeGroupId = btn.dataset.group;
          afterFn();
        });
      });
    }

    paint();
  }

  return { render };
})();
