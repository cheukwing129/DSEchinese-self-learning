from pathlib import Path

path = Path("js/content-renderer.js")
text = path.read_text(encoding="utf-8")


def replace_once(source, old, new, label):
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected 1 match, found {count}")
    return source.replace(old, new, 1)

text = replace_once(
    text,
    '    const reflection = Progress.getReflection(unitId, "theme");\n',
    '    const reflection = Progress.getReflection(unitId, "theme");\n    const memoStats = Progress.memorisationStats(unitId, (bundle.memorisation && bundle.memorisation.sentence_groups) || []);\n',
    "memorisation stats",
)

ability_end = '''      })
      .join("");

    const wrongList = wrongQuestions.length'''

memo_rows = '''      })
      .join("");

    const memorisationRows = memoStats.groups
      .map((g) => {
        const clozeText = g.cloze && g.cloze.attempts
          ? `遮字最高 ${g.cloze.bestRate == null ? "—" : g.cloze.bestRate + "%"}（${g.cloze.attempts} 次）`
          : "遮字未練習";
        const reorderText = g.reorder && g.reorder.attempts
          ? (g.reorder.passed ? `重組曾排對（${g.reorder.attempts} 次嘗試）` : `重組尚未排對（${g.reorder.attempts} 次嘗試）`)
          : "重組未練習";
        return `
          <div style="padding:10px 0; border-bottom:1px solid var(--color-border);">
            <div style="display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap; font-size:14px;">
              <strong>${esc(g.title)}</strong>
              <span style="color:var(--color-ink-soft);">${clozeText} · ${reorderText}</span>
            </div>
            <div class="bar-track" style="margin-top:7px;"><div class="bar-fill" style="width:${g.cloze && g.cloze.bestRate != null ? g.cloze.bestRate : 0}%;"></div></div>
          </div>`;
      })
      .join("");

    const wrongList = wrongQuestions.length'''

text = replace_once(text, ability_end, memo_rows, "memorisation rows")

ability_card = '''      <div class="card">
        <div class="section-title"><span class="seal">分</span>能力分項</div>
        ${abilityRows || `<p class="empty-state">尚未有作答紀錄。</p>`}
      </div>

      <div class="section-title"><span class="seal">錯</span>錯題本</div>'''

memo_card = '''      <div class="card">
        <div class="section-title"><span class="seal">分</span>能力分項</div>
        ${abilityRows || `<p class="empty-state">尚未有作答紀錄。</p>`}
      </div>

      <div class="card">
        <div class="section-title"><span class="seal">背</span>背誦練習</div>
        <div class="stat-grid" style="margin-bottom:14px;">
          <div class="stat-card">
            <div class="stat-value">${memoStats.practisedGroups}/${memoStats.totalGroups}</div>
            <div class="stat-label">已練習句群</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${memoStats.clozePractisedGroups}</div>
            <div class="stat-label">做過遮字</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${memoStats.reorderPassedGroups}</div>
            <div class="stat-label">重組曾排對</div>
          </div>
        </div>
        ${memorisationRows || `<p class="empty-state">本篇尚未提供背誦句群。</p>`}
        <p style="font-size:13px; color:var(--color-ink-soft); margin:12px 0 0;">易錯字重溫：${memoStats.charsViewed ? "已開啟重溫" : "尚未重溫"}</p>
        <a class="btn btn-secondary" style="margin-top:12px;" href="#/unit/${unitId}/memorisation">前往背誦精華 →</a>
      </div>

      <div class="section-title"><span class="seal">錯</span>錯題本</div>'''

text = replace_once(text, ability_card, memo_card, "memorisation progress card")

text = replace_once(
    text,
    '      if (confirm("確定要清除《" + unit.title + "》的所有作答紀錄與反思嗎？此動作無法復原。")) {',
    '      if (confirm("確定要清除《" + unit.title + "》的所有作答、背誦練習與反思紀錄嗎？此動作無法復原。")) {',
    "clear confirmation",
)

path.write_text(text, encoding="utf-8")
print("Progress page memorisation patch applied.")
