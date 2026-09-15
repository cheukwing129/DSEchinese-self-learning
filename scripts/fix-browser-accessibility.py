from pathlib import Path


def replace_once(path, old, new, label):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"{label} not found in {path}")
    p.write_text(text.replace(old, new, 1))


replace_once(
    "js/question-engine.js",
    '<span class="quiz-context-title">${esc(title)}</span>',
    '<h1 class="quiz-context-title">${esc(title)}</h1>',
    "quiz semantic title",
)

replace_once(
    "css/style.css",
    '''.quiz-context-title {
  color: var(--color-accent);
''',
    '''.quiz-context-title {
  margin: 0;
  color: var(--color-accent);
''',
    "quiz title style",
)

replace_once(
    "scripts/browser-accessibility.mjs",
    '''  const skipBox = await page.locator(".skip-link").boundingBox();
''',
    '''  await page.waitForTimeout(180);
  const skipBox = await page.locator(".skip-link").boundingBox();
''',
    "skip-link transition wait",
)
