from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    if text.count(old) != 1:
        raise SystemExit(f"Expected exactly one match in {path}: {old[:80]!r}")
    p.write_text(text.replace(old, new, 1), encoding="utf-8")


replace_once(
    "js/app.js",
    '<h1 id="home-title" class="page-title home-title">讀懂經典，<span>把每一步都變成自己的能力。</span></h1>',
    '<h1 id="home-title" class="page-title home-title">讀懂經典，<span>把每一步，<br />變成自己的能力。</span></h1>'
)

replace_once(
    "css/style.css",
    '''  .home-hero-visual { padding: 19px; border-radius: 24px; }\n  .hero-path-step { min-height: 92px; padding: 12px; }\n  .hero-path-step strong { font-size: 23px; }\n  .hero-visual-head strong { font-size: 17px; }''',
    '''  .home-hero-visual { padding: 17px; border-radius: 24px; }\n  .hero-path-step { min-height: 78px; padding: 10px; }\n  .hero-path-step strong { font-size: 22px; }\n  .hero-path-step small { font-size: 10px; }\n  .hero-visual-head { margin-bottom: 15px; }\n  .hero-visual-head strong { font-size: 17px; }\n  .hero-visual-note { display: none; }'''
)

print("Applied UI 2.0 visual polish")
