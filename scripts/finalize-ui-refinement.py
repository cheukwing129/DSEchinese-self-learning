from pathlib import Path

replacements = {
    'js/app.js': [
        ('<h1 id="home-title" class="home-title">', '<h1 id="home-title" class="page-title home-title">'),
    ],
    'js/content-renderer.js': [
        ('<h1 class="unit-title">', '<h1 class="page-title unit-title">'),
    ],
    'scripts/browser-smoke.mjs': [
        ('await waitForTitle(page, "十二篇指定文言經典");', 'await waitForTitle(page, "讀懂經典");'),
    ],
}

for file, pairs in replacements.items():
    path = Path(file)
    text = path.read_text(encoding='utf-8')
    for old, new in pairs:
        if old not in text:
            raise SystemExit(f'missing expected text in {file}: {old}')
        text = text.replace(old, new)
    path.write_text(text, encoding='utf-8')

print('UI compatibility patch applied.')
