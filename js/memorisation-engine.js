/* ============================================================
   memorisation-engine.js — 背誦精華：句群背誦／遮字／重組／易錯字
   ============================================================ */

const MemorisationEngine = (() => {
  const esc = App.escapeHTML;

  function render(bundle, unitId) {
    const { memorisation, unit } = bundle;
    let activeTab = "groups";
    let activeGroupId = memorisation.sentence_groups[0].id;
    let clozeState = {};   // groupId -> { blanks: [{idx,char}], revealed }
    let reorderState = {}; // groupId -> { chips: [], slots: [], done }

    function paint() {
      App.mount(`
        <h1 class="page-title">背誦精華</h1>
        <p class="page-subtitle">句群背誦 · 遮字練習 · 句序重組 · 易錯字重溫</p>
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
      if (activeTab === "groups") {
        el.innerHTML = memorisation.sentence_groups
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
        el.innerHTML = `<div class="module-grid">${memorisation.error_prone_characters
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
      return `
        <div class="para-nav">
          ${memorisation.sentence_groups
            .map((g) => `<button data-group="${g.id}" class="${activeGroupId === g.id ? "is-active" : ""}">${esc(g.title)}</button>`)
            .join("")}
        </div>`;
    }

    // ---------- 遮字練習 ----------
    function buildCloze(group) {
      if (clozeState[group.id]) return clozeState[group.id];
      const chars = [...group.text];
      const blanks = [];
      chars.forEach((ch, i) => {
        if (/[\u4e00-\u9fff]/.test(ch) && Math.random() < 0.25) blanks.push(i);
      });
      clozeState[group.id] = { blanks, revealed: false, inputs: {} };
      return clozeState[group.id];
    }

    function renderCloze(el) {
      const group = memorisation.sentence_groups.find((g) => g.id === activeGroupId);
      const st = buildCloze(group);
      const chars = [...group.text];
      const rendered = chars
        .map((ch, i) => {
          if (!st.blanks.includes(i)) return esc(ch);
          if (st.revealed) return `<span style="color:var(--color-accent); font-weight:700;">${esc(ch)}</span>`;
          return `<input type="text" maxlength="1" data-blank-idx="${i}" class="blank-token" style="width:1.4em; border:none; border-bottom:2px solid var(--color-accent); text-align:center; font-family:var(--font-display); font-size:19px;" value="${esc(st.inputs[i] || "")}" />`;
        })
        .join("");
      el.innerHTML = `
        ${groupSelector()}
        <div class="card">
          <p style="font-size:12px; color:var(--color-ink-soft); margin:0 0 10px;">第${group.paragraph}段 · ${esc(group.title)}（填入被遮蓋的字）</p>
          <p class="text-passage" style="font-size:19px; line-height:2.4;">${rendered}</p>
          <div class="btn-row">
            <button class="btn btn-primary" id="cloze-check-btn">對照答案</button>
            <button class="btn btn-secondary" id="cloze-retry-btn">重新出題</button>
          </div>
        </div>
      `;
      bindGroupSelector(renderBody);
      document.querySelectorAll("[data-blank-idx]").forEach((inp) => {
        inp.addEventListener("input", () => {
          st.inputs[inp.dataset.blankIdx] = inp.value;
        });
      });
      document.getElementById("cloze-check-btn").addEventListener("click", () => {
        st.revealed = true;
        renderCloze(el);
      });
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
      reorderState[group.id] = { segments, chips: shuffled, placed: [] };
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
      const group = memorisation.sentence_groups.find((g) => g.id === activeGroupId);
      const st = buildReorder(group);
      const remaining = st.chips.filter((c) => !st.placed.includes(c.id));
      el.innerHTML = `
        ${groupSelector()}
        <div class="card">
          <p style="font-size:12px; color:var(--color-ink-soft); margin:0 0 10px;">第${group.paragraph}段 · ${esc(group.title)}（依次點擊句子片段，排出正確次序）</p>
          <div class="reorder-slots" id="reorder-slots">
            ${st.placed.map((id) => `<span class="reorder-chip is-placed">${esc(st.chips.find((c) => c.id === id).text)}</span>`).join("")}
          </div>
          <div class="reorder-list" id="reorder-pool">
            ${remaining.map((c) => `<span class="reorder-chip" data-chip="${c.id}">${esc(c.text)}</span>`).join("")}
          </div>
          <div class="btn-row">
            <button class="btn btn-secondary" id="reorder-reset-btn">重新排列</button>
          </div>
          <div id="reorder-result"></div>
        </div>
      `;
      bindGroupSelector(renderBody);
      document.querySelectorAll("[data-chip]").forEach((chip) => {
        chip.addEventListener("click", () => {
          st.placed.push(parseInt(chip.dataset.chip, 10));
          renderReorder(el);
          if (st.placed.length === st.chips.length) {
            const orderedText = st.placed.map((id) => st.chips.find((c) => c.id === id).text).join("");
            const isRight = orderedText === group.text;
            document.getElementById("reorder-result").innerHTML = `
              <div class="reveal-panel ${isRight ? "" : "is-incorrect"}" style="margin-top:14px;">
                <div class="reveal-row"><b>${isRight ? "✓ 排序正確！" : "✗ 排序與原文不符"}</b></div>
                ${!isRight ? `<div class="reveal-explanation">原文：${esc(group.text)}</div>` : ""}
              </div>`;
          }
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
