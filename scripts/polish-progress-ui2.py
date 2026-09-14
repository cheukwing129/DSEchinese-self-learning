from pathlib import Path

content_path = Path('js/content-renderer.js')
css_path = Path('css/style.css')
content = content_path.read_text(encoding='utf-8')
css = css_path.read_text(encoding='utf-8')

old = '''          <div class="mini-evidence-strip"><span><strong>${memoStats.clozePractisedGroups}</strong>做過遮字</span><span><strong>${memoStats.reorderPassedGroups}</strong>重組曾排對</span></div>
          <div class="memorisation-evidence-list">${memorisationRows || `<div class="progress-empty-card compact"><span>○</span><div><strong>本篇尚未提供背誦句群</strong></div></div>`}</div>
          <p class="progress-method-note">易錯字重溫：${memoStats.charsViewed ? "已開啟重溫" : "尚未重溫"}</p>'''
new = '''          <div class="mini-evidence-strip"><span><strong>${memoStats.clozePractisedGroups}</strong>做過遮字</span><span><strong>${memoStats.reorderPassedGroups}</strong>重組曾排對</span></div>
          ${memorisationRows ? `<details class="evidence-details">
            <summary><span>查看 ${memoStats.totalGroups} 個句群練習明細</span><small>${memoStats.practisedGroups}/${memoStats.totalGroups} 已練習</small></summary>
            <div class="memorisation-evidence-list">${memorisationRows}</div>
          </details>` : `<div class="progress-empty-card compact"><span>○</span><div><strong>本篇尚未提供背誦句群</strong></div></div>`}
          <p class="progress-method-note" style="margin-top:12px;">易錯字重溫：${memoStats.charsViewed ? "已開啟重溫" : "尚未重溫"}</p>'''
if content.count(old) != 1:
    raise SystemExit(f'expected one memorisation detail block, found {content.count(old)}')
content = content.replace(old, new, 1)

marker = '/* Progress UI 2.0 detail disclosure */'
if marker not in css:
    css += '''\n\n/* Progress UI 2.0 detail disclosure */
.evidence-details {
  overflow: hidden;
  margin-top: 10px;
  border: 1px solid rgba(23,73,64,.09);
  border-radius: 14px;
  background: rgba(255,255,255,.48);
}
.evidence-details summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 13px;
  cursor: pointer;
  list-style: none;
  color: var(--color-ink);
  font-size: 10px;
  font-weight: 800;
}
.evidence-details summary::-webkit-details-marker { display: none; }
.evidence-details summary::after {
  content: "+";
  flex: none;
  color: var(--color-accent);
  font-size: 16px;
  font-weight: 500;
  line-height: 1;
}
.evidence-details[open] summary::after { content: "−"; }
.evidence-details summary small {
  margin-left: auto;
  color: var(--color-ink-faint);
  font-size: 9px;
  font-weight: 650;
}
.evidence-details .memorisation-evidence-list {
  padding: 0 13px 4px;
  border-top: 1px solid rgba(23,73,64,.07);
}
'''

content_path.write_text(content, encoding='utf-8')
css_path.write_text(css, encoding='utf-8')
