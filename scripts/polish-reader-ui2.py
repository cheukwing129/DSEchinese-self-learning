from pathlib import Path
p = Path('css/style.css')
s = p.read_text()
needle = '.annotation-close:hover { background: rgba(255,255,255,.13); color: #fff; }\n'
replacement = needle + '.annotation-popover:focus { outline: none; }\n'
if '.annotation-popover:focus { outline: none; }' not in s:
    if needle not in s:
        raise SystemExit('annotation close rule not found')
    s = s.replace(needle, replacement, 1)
p.write_text(s)
print('Reader annotation focus polish applied')
