from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected 1 match, found {count}")
    return text.replace(old, new, 1)


# app.js: semantic anchor handles home navigation without a click-only listener.
path = Path("js/app.js")
text = path.read_text(encoding="utf-8")
text = replace_once(
    text,
    '    document.getElementById("brand-home-link").addEventListener("click", () => Router.navigate("/"));\n',
    '',
    "remove brand click listener",
)
path.write_text(text, encoding="utf-8")


# question-engine.js: native buttons, states and live feedback.
path = Path("js/question-engine.js")
text = path.read_text(encoding="utf-8")

text = replace_once(
    text,
    '      el.className = "error-banner";\n      el.style.marginBottom = "16px";\n',
    '      el.className = "error-banner";\n      el.setAttribute("role", "alert");\n      el.setAttribute("aria-live", "assertive");\n      el.style.marginBottom = "16px";\n',
    "inline alert semantics",
)

text = replace_once(
    text,
    '          <div id="reveal-slot"></div>\n',
    '          <div id="reveal-slot" aria-live="polite" aria-atomic="true"></div>\n',
    "answer reveal live region",
)

old = '''  function renderSingleChoice(q, state, prefix) {
    return `<div class="option-list">${(q.options || []).map((o) => `
      <div class="option-item ${state.selected === o.key ? "is-selected" : ""}" data-key="${esc(o.key)}" data-role="option-${prefix}">
        <span class="option-key">${esc(o.key)}</span><span>${esc(o.text)}</span>
      </div>`).join("")}</div>`;
  }

  function renderMultiSelect(q, state, prefix) {
    const sel = Array.isArray(state.selected) ? state.selected : [];
    return `<div class="option-list">${(q.options || []).map((o) => `
      <div class="option-item ${sel.includes(o.key) ? "is-selected" : ""}" data-key="${esc(o.key)}" data-role="option-${prefix}-multi">
        <span class="option-key">${sel.includes(o.key) ? "✓" : esc(o.key)}</span><span>${esc(o.text)}</span>
      </div>`).join("")}</div>`;
  }
'''
new = '''  function renderSingleChoice(q, state, prefix) {
    return `<div class="option-list" role="radiogroup" aria-label="單選題選項">${(q.options || []).map((o) => `
      <button type="button" role="radio" aria-checked="${state.selected === o.key}" class="option-item ${state.selected === o.key ? "is-selected" : ""}" data-key="${esc(o.key)}" data-role="option-${prefix}" ${state.submitted ? "disabled" : ""}>
        <span class="option-key" aria-hidden="true">${esc(o.key)}</span><span>${esc(o.text)}</span>
      </button>`).join("")}</div>`;
  }

  function renderMultiSelect(q, state, prefix) {
    const sel = Array.isArray(state.selected) ? state.selected : [];
    return `<div class="option-list" aria-label="多選題選項">${(q.options || []).map((o) => `
      <button type="button" aria-pressed="${sel.includes(o.key)}" class="option-item ${sel.includes(o.key) ? "is-selected" : ""}" data-key="${esc(o.key)}" data-role="option-${prefix}-multi" ${state.submitted ? "disabled" : ""}>
        <span class="option-key" aria-hidden="true">${sel.includes(o.key) ? "✓" : esc(o.key)}</span><span>${esc(o.text)}</span>
      </button>`).join("")}</div>`;
  }
'''
text = replace_once(text, old, new, "semantic choice buttons")

text = text.replace(
    '<button class="btn btn-secondary tf-btn ${cur === v ? "is-selected" : ""}" data-prefix="${prefix}" data-stmt="${i}" data-val="${v}" style="${cur === v ? "border-color:var(--color-accent); background:var(--color-accent-soft);" : ""}">',
    '<button type="button" aria-pressed="${cur === v}" class="btn btn-secondary tf-btn ${cur === v ? "is-selected" : ""}" data-prefix="${prefix}" data-stmt="${i}" data-val="${v}" ${state.submitted ? "disabled" : ""} style="${cur === v ? "border-color:var(--color-accent); background:var(--color-accent-soft);" : ""}">',
)
text = text.replace(
    '<button class="btn btn-secondary tf-btn-single ${cur === v ? "is-selected" : ""}" data-prefix="${prefix}" data-val="${v}" style="${cur === v ? "border-color:var(--color-accent); background:var(--color-accent-soft);" : ""}">',
    '<button type="button" aria-pressed="${cur === v}" class="btn btn-secondary tf-btn-single ${cur === v ? "is-selected" : ""}" data-prefix="${prefix}" data-val="${v}" ${state.submitted ? "disabled" : ""} style="${cur === v ? "border-color:var(--color-accent); background:var(--color-accent-soft);" : ""}">',
)

text = replace_once(
    text,
    '<textarea data-fillkey="${key}" data-prefix="${prefix}" placeholder="請填寫…">${esc(savedVal)}</textarea>',
    '<textarea data-fillkey="${key}" data-prefix="${prefix}" aria-label="${esc(cols[ci] || `第 ${ci + 1} 欄`)}" placeholder="請填寫…" ${state.submitted ? "disabled" : ""}>${esc(savedVal)}</textarea>',
    "fill table labels",
)

text = replace_once(
    text,
    '<button class="btn btn-secondary match-multi-btn ${sel.includes(label) ? "is-selected" : ""}" data-prefix="${prefix}" data-row="${ri}" data-label="${esc(label)}" style="${sel.includes(label) ? "border-color:var(--color-accent); background:var(--color-accent-soft);" : ""}">${esc(label)}</button>',
    '<button type="button" aria-pressed="${sel.includes(label)}" class="btn btn-secondary match-multi-btn ${sel.includes(label) ? "is-selected" : ""}" data-prefix="${prefix}" data-row="${ri}" data-label="${esc(label)}" ${state.submitted ? "disabled" : ""} style="${sel.includes(label) ? "border-color:var(--color-accent); background:var(--color-accent-soft);" : ""}">${esc(label)}</button>',
    "matching toggle semantics",
)

text = replace_once(
    text,
    '<select data-match-row="${ri}" data-prefix="${prefix}" class="answer-input" style="max-width:160px;">',
    '<select data-match-row="${ri}" data-prefix="${prefix}" class="answer-input" aria-label="${esc(row.text)}" ${state.submitted ? "disabled" : ""} style="max-width:160px;">',
    "matching select labels",
)

old = '''          <div class="option-list">
            ${(b.options || []).map((o) => `
              <div class="option-item ${cur === o.key ? "is-selected" : ""}" data-prefix="${prefix}" data-blank="${esc(b.id)}" data-key="${esc(o.key)}" data-role="cloze-option">
                <span class="option-key">${esc(o.key)}</span><span>${esc(o.text)}</span>
              </div>`).join("")}
          </div>'''
new = '''          <div class="option-list" role="radiogroup" aria-label="${esc(b.id)} 選項">
            ${(b.options || []).map((o) => `
              <button type="button" role="radio" aria-checked="${cur === o.key}" class="option-item ${cur === o.key ? "is-selected" : ""}" data-prefix="${prefix}" data-blank="${esc(b.id)}" data-key="${esc(o.key)}" data-role="cloze-option" ${state.submitted ? "disabled" : ""}>
                <span class="option-key" aria-hidden="true">${esc(o.key)}</span><span>${esc(o.text)}</span>
              </button>`).join("")}
          </div>'''
text = replace_once(text, old, new, "cloze choice buttons")

# Restore keyboard focus after a choice repaints the question shell.
anchor = '''  function bindBodyEvents(q, state, repaint) {
'''
helper = '''  function restoreChoiceFocus(selector, predicate) {
    const target = [...document.querySelectorAll(selector)].find(predicate);
    if (target) target.focus();
  }

  function bindBodyEvents(q, state, repaint) {
'''
text = replace_once(text, anchor, helper, "focus restore helper")

text = replace_once(
    text,
    '''        setMainSelection(q, state, el.dataset.key);
        repaint();
''',
    '''        const key = el.dataset.key;
        setMainSelection(q, state, key);
        repaint();
        restoreChoiceFocus('[data-role="option-main"]', (node) => node.dataset.key === key);
''',
    "main option focus restore",
)
text = replace_once(
    text,
    '''        setPart2Selection(q, state, el.dataset.key);
        repaint();
''',
    '''        const key = el.dataset.key;
        setPart2Selection(q, state, key);
        repaint();
        restoreChoiceFocus('[data-role="option-part2"]', (node) => node.dataset.key === key);
''',
    "part2 option focus restore",
)
text = replace_once(
    text,
    '''        setSelectionForPrefix(q, state, prefix, arr.includes(key) ? arr.filter((k) => k !== key) : [...arr, key]);
        repaint();
''',
    '''        setSelectionForPrefix(q, state, prefix, arr.includes(key) ? arr.filter((k) => k !== key) : [...arr, key]);
        repaint();
        const role = prefix === "part2" ? "option-part2-multi" : "option-main-multi";
        restoreChoiceFocus(`[data-role="${role}"]`, (node) => node.dataset.key === key);
''',
    "multi option focus restore",
)
text = replace_once(
    text,
    '''        next[el.dataset.blank] = el.dataset.key;
        setSelectionForPrefix(q, state, prefix, next);
        repaint();
''',
    '''        const blank = el.dataset.blank;
        const key = el.dataset.key;
        next[blank] = key;
        setSelectionForPrefix(q, state, prefix, next);
        repaint();
        restoreChoiceFocus('[data-role="cloze-option"]', (node) => node.dataset.blank === blank && node.dataset.key === key);
''',
    "cloze focus restore",
)

path.write_text(text, encoding="utf-8")


# content-renderer.js: annotation terms become real buttons and popover is dismissible.
path = Path("js/content-renderer.js")
text = path.read_text(encoding="utf-8")
text = text.replace(
    '// 依 annotation term 在原文中「第 occurrence 次」出現的位置，包上可點擊 span。',
    '// 依 annotation term 在原文中「第 occurrence 次」出現的位置，包上可鍵盤操作的 button。',
)
text = replace_once(
    text,
    '        html += `<span class="term" data-anno="${m.anno.id}">${esc(p.text.slice(m.start, m.end))}</span>`;',
    '        html += `<button type="button" class="term" data-anno="${m.anno.id}" aria-haspopup="dialog" aria-label="查看「${esc(m.anno.term)}」注釋">${esc(p.text.slice(m.start, m.end))}</button>`;',
    "annotation term buttons",
)
text = text.replace(
    '      document.querySelectorAll(".term").forEach((span) => {\n        span.addEventListener("click", (e) => showAnnotationPopover(e, annoMap[span.dataset.anno]));\n      });',
    '      document.querySelectorAll(".term").forEach((button) => {\n        button.addEventListener("click", (e) => showAnnotationPopover(e, annoMap[button.dataset.anno]));\n      });',
)
text = replace_once(
    text,
    '    pop.className = "annotation-popover";\n',
    '    pop.className = "annotation-popover";\n    pop.setAttribute("role", "dialog");\n    pop.setAttribute("aria-label", `「${anno.term}」注釋`);\n    pop.tabIndex = -1;\n',
    "annotation dialog semantics",
)
text = replace_once(
    text,
    '''    pop.innerHTML = `
      <div class="term-name">${App.escapeHTML(anno.term)}</div>
      ${reading ? `<div class="reading">${App.escapeHTML(reading)}</div>` : ""}
      <div>${App.escapeHTML(anno.explanation)}</div>
    `;
''',
    '''    pop.innerHTML = `
      <button type="button" class="annotation-close" aria-label="關閉注釋">×</button>
      <div class="term-name">${App.escapeHTML(anno.term)}</div>
      ${reading ? `<div class="reading">${App.escapeHTML(reading)}</div>` : ""}
      <div>${App.escapeHTML(anno.explanation)}</div>
    `;
''',
    "annotation close button",
)
old = '''    backdrop.addEventListener("click", () => {
      pop.remove();
      backdrop.remove();
    });
'''
new = '''    const closePopover = () => {
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
'''
text = replace_once(text, old, new, "annotation dismiss behavior")
path.write_text(text, encoding="utf-8")


# memorisation-engine.js: reorder chips become buttons and practice results announce themselves.
path = Path("js/memorisation-engine.js")
text = path.read_text(encoding="utf-8")
text = text.replace(
    '<div class="reveal-panel ${st.result.correct === st.result.total ? "" : "is-incorrect"}" style="margin-top:14px;">',
    '<div class="reveal-panel ${st.result.correct === st.result.total ? "" : "is-incorrect"}" role="status" aria-live="polite" style="margin-top:14px;">',
)
text = text.replace(
    '<div class="reveal-panel ${st.result ? "" : "is-incorrect"}" style="margin-top:14px;">',
    '<div class="reveal-panel ${st.result ? "" : "is-incorrect"}" role="status" aria-live="polite" style="margin-top:14px;">',
)
text = replace_once(
    text,
    'return `<input type="text" maxlength="1" data-blank-idx="${i}" class="blank-token" style="width:1.4em; border:none; border-bottom:2px solid var(--color-accent); text-align:center; font-family:var(--font-display); font-size:19px;" value="${esc(st.inputs[i] || "")}" />`;',
    'return `<input type="text" maxlength="1" data-blank-idx="${i}" aria-label="第 ${st.blanks.indexOf(i) + 1} 個被遮蓋的字" class="blank-token" style="width:1.4em; border:none; border-bottom:2px solid var(--color-accent); text-align:center; font-family:var(--font-display); font-size:19px;" value="${esc(st.inputs[i] || "")}" />`;',
    "cloze input labels",
)
text = replace_once(
    text,
    '${remaining.map((c) => `<span class="reorder-chip" data-chip="${c.id}">${esc(c.text)}</span>`).join("")}',
    '${remaining.map((c) => `<button type="button" class="reorder-chip" data-chip="${c.id}" aria-label="加入排序：${esc(c.text)}">${esc(c.text)}</button>`).join("")}',
    "reorder chip buttons",
)
path.write_text(text, encoding="utf-8")


# style.css: visible focus, semantic button resets, larger tap targets.
path = Path("css/style.css")
text = path.read_text(encoding="utf-8")
append = r'''

/* ---------- Accessibility / keyboard interaction ---------- */
:where(a, button, input, textarea, select, [tabindex]):focus-visible {
  outline: 3px solid var(--color-accent);
  outline-offset: 3px;
}

button.option-item {
  width: 100%;
  min-height: 44px;
  text-align: left;
  font: inherit;
  color: inherit;
}

button.option-item:disabled {
  cursor: default;
  opacity: 1;
}

.text-passage button.term {
  appearance: none;
  display: inline;
  margin: 0;
  border: 0;
  font: inherit;
  line-height: inherit;
  letter-spacing: inherit;
}

.annotation-popover { position: fixed; }
.annotation-close {
  position: absolute;
  top: 6px;
  right: 8px;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #fff;
  cursor: pointer;
  font-size: 22px;
  line-height: 1;
}
.annotation-close:hover { background: rgba(255,255,255,0.12); }

.reorder-chip[data-chip] {
  min-height: 44px;
  font: inherit;
  color: inherit;
  cursor: pointer;
}

.para-nav button,
.tf-btn,
.tf-btn-single,
.match-multi-btn {
  min-height: 44px;
}

@media (pointer: coarse) {
  .btn { min-height: 44px; }
}
'''
if "/* ---------- Accessibility / keyboard interaction ---------- */" not in text:
    text += append
path.write_text(text, encoding="utf-8")

print("Accessibility patch applied.")
