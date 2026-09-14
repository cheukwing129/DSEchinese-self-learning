from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected 1 match, found {count}")
    return text.replace(old, new, 1)


# question-engine focus continuity and read-only submitted state.
path = Path("js/question-engine.js")
text = path.read_text(encoding="utf-8")

text = replace_once(
    text,
    '<div id="reveal-slot" aria-live="polite" aria-atomic="true"></div>',
    '<div id="reveal-slot" tabindex="-1" aria-live="polite" aria-atomic="true"></div>',
    "focusable reveal slot",
)

text = replace_once(
    text,
    '''          paint();
        });
      }
''',
    '''          paint();
          const reveal = document.getElementById("reveal-slot");
          if (reveal) reveal.focus();
        });
      }
''',
    "focus reveal after submit",
)

# Submitted text fields should no longer look editable after the recorded answer is fixed.
replacements = [
    (
        '<textarea class="answer-input" id="input-extract" placeholder="請摘錄原文句子…">${esc(state.selected || "")}</textarea>',
        '<textarea class="answer-input" id="input-extract" placeholder="請摘錄原文句子…" ${state.submitted ? "disabled" : ""}>${esc(state.selected || "")}</textarea>',
        "extract submitted state",
    ),
    (
        '<textarea class="answer-input" id="input-short" placeholder="請輸入答案（不設字數下限）…">${esc(state.selected || "")}</textarea>',
        '<textarea class="answer-input" id="input-short" placeholder="請輸入答案（不設字數下限）…" ${state.submitted ? "disabled" : ""}>${esc(state.selected || "")}</textarea>',
        "short answer submitted state",
    ),
    (
        '<textarea class="answer-input" id="input-long" placeholder="請輸入你的答案（不設字數下限，將以評分元素自評）…">${esc(state.selected || "")}</textarea>',
        '<textarea class="answer-input" id="input-long" placeholder="請輸入你的答案（不設字數下限，將以評分元素自評）…" ${state.submitted ? "disabled" : ""}>${esc(state.selected || "")}</textarea>',
        "long answer submitted state",
    ),
    (
        '<input type="text" class="answer-input" id="item-input-${i}" value="${esc(itemSelection(q, state, i))}" placeholder="請輸入答案…" />',
        '<input type="text" class="answer-input" id="item-input-${i}" value="${esc(itemSelection(q, state, i))}" placeholder="請輸入答案…" ${state.submitted ? "disabled" : ""} />',
        "item submitted state",
    ),
    (
        '<textarea class="answer-input" data-cloze-open="${prefix}" placeholder="請完成開放部分的說明…">${esc((state.selected && state.selected.openText) || "")}</textarea>',
        '<textarea class="answer-input" data-cloze-open="${prefix}" placeholder="請完成開放部分的說明…" ${state.submitted ? "disabled" : ""}>${esc((state.selected && state.selected.openText) || "")}</textarea>',
        "cloze open submitted state",
    ),
    (
        '<textarea class="answer-input" id="input-part2" placeholder="請摘錄原文句子…">${esc(sel || "")}</textarea>',
        '<textarea class="answer-input" id="input-part2" placeholder="請摘錄原文句子…" ${state.submitted ? "disabled" : ""}>${esc(sel || "")}</textarea>',
        "part2 extract submitted state",
    ),
    (
        '<textarea class="answer-input" id="input-part2" placeholder="請輸入答案…">${esc(sel || "")}</textarea>',
        '<textarea class="answer-input" id="input-part2" placeholder="請輸入答案…" ${state.submitted ? "disabled" : ""}>${esc(sel || "")}</textarea>',
        "part2 submitted state",
    ),
]
for old, new, label in replacements:
    text = replace_once(text, old, new, label)

# Preserve focus for true/false and matching toggle buttons after repaint.
text = replace_once(
    text,
    '''        next[el.dataset.stmt] = el.dataset.val;
        setSelectionForPrefix(q, state, prefix, next);
        repaint();
''',
    '''        const stmt = el.dataset.stmt;
        const val = el.dataset.val;
        next[stmt] = val;
        setSelectionForPrefix(q, state, prefix, next);
        repaint();
        restoreChoiceFocus(".tf-btn", (node) => node.dataset.prefix === prefix && node.dataset.stmt === stmt && node.dataset.val === val);
''',
    "true false focus restore",
)

text = replace_once(
    text,
    '''        setSelectionForPrefix(q, state, el.dataset.prefix || "main", el.dataset.val);
        repaint();
''',
    '''        const prefix = el.dataset.prefix || "main";
        const val = el.dataset.val;
        setSelectionForPrefix(q, state, prefix, val);
        repaint();
        restoreChoiceFocus(".tf-btn-single", (node) => node.dataset.prefix === prefix && node.dataset.val === val);
''',
    "single true false focus restore",
)

text = replace_once(
    text,
    '''        const ri = el.dataset.row;
        const arr = next[ri] || [];
        next[ri] = arr.includes(el.dataset.label) ? arr.filter((l) => l !== el.dataset.label) : [...arr, el.dataset.label];
        setSelectionForPrefix(q, state, prefix, next);
        repaint();
''',
    '''        const ri = el.dataset.row;
        const label = el.dataset.label;
        const arr = next[ri] || [];
        next[ri] = arr.includes(label) ? arr.filter((l) => l !== label) : [...arr, label];
        setSelectionForPrefix(q, state, prefix, next);
        repaint();
        restoreChoiceFocus(".match-multi-btn", (node) => node.dataset.prefix === prefix && node.dataset.row === ri && node.dataset.label === label);
''',
    "matching focus restore",
)

path.write_text(text, encoding="utf-8")


# content-renderer wording acknowledges keyboard interaction.
path = Path("js/content-renderer.js")
text = path.read_text(encoding="utf-8")
text = replace_once(
    text,
    '<p class="page-subtitle">《${esc(unit.title)}》· 點擊底線字詞查看注釋</p>',
    '<p class="page-subtitle">《${esc(unit.title)}》· 點擊字詞或用鍵盤選取以查看注釋</p>',
    "annotation interaction hint",
)
path.write_text(text, encoding="utf-8")


# memorisation focus continuity after dynamic rerenders.
path = Path("js/memorisation-engine.js")
text = path.read_text(encoding="utf-8")
text = replace_once(
    text,
    '<div class="reveal-panel ${st.result.correct === st.result.total ? "" : "is-incorrect"}" role="status" aria-live="polite" style="margin-top:14px;">',
    '<div id="cloze-result" class="reveal-panel ${st.result.correct === st.result.total ? "" : "is-incorrect"}" role="status" aria-live="polite" tabindex="-1" style="margin-top:14px;">',
    "cloze result focus target",
)
text = replace_once(
    text,
    '<div class="reveal-panel ${st.result ? "" : "is-incorrect"}" role="status" aria-live="polite" style="margin-top:14px;">',
    '<div id="reorder-result" class="reveal-panel ${st.result ? "" : "is-incorrect"}" role="status" aria-live="polite" tabindex="-1" style="margin-top:14px;">',
    "reorder result focus target",
)
text = replace_once(
    text,
    '''          Progress.recordMemorisationAttempt(unitId, group.id, "cloze", st.result);
          paint();
''',
    '''          Progress.recordMemorisationAttempt(unitId, group.id, "cloze", st.result);
          paint();
          const result = document.getElementById("cloze-result");
          if (result) result.focus();
''',
    "focus cloze result",
)
text = replace_once(
    text,
    '''            Progress.recordMemorisationAttempt(unitId, group.id, "reorder", { isCorrect: st.result });
            paint();
            return;
          }
          renderReorder(el);
''',
    '''            Progress.recordMemorisationAttempt(unitId, group.id, "reorder", { isCorrect: st.result });
            paint();
            const result = document.getElementById("reorder-result");
            if (result) result.focus();
            return;
          }
          renderReorder(el);
          const nextChip = document.querySelector("[data-chip]");
          if (nextChip) nextChip.focus();
''',
    "reorder focus continuity",
)
text = text.replace(
    '（依次點擊句子片段，排出正確次序）',
    '（依次選取句子片段，排出正確次序）',
)
path.write_text(text, encoding="utf-8")

print("Accessibility focus follow-up applied.")
