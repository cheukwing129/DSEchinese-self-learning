from pathlib import Path

path = Path('css/style.css')
text = path.read_text(encoding='utf-8')
old = '  #app-main { padding-left: 16px; padding-right: 16px; }\n  .home-title { font-size: 38px; }'
new = '  #app-main { padding-left: 16px; padding-right: 16px; }\n  .quiz-nav-bar { margin-left: -16px; margin-right: -16px; }\n  .home-title { font-size: 38px; }'
if old not in text:
    raise SystemExit('mobile insertion point not found')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
print('Mobile quiz overflow fix applied.')
