from pathlib import Path
import struct, zlib, binascii

W, H = 1200, 630
BG = (23, 73, 64)
PAPER = (247, 242, 233)
INK = (23, 34, 31)
MUTED = (102, 126, 117)
RUST = (184, 89, 64)
JADE = (111, 164, 145)

pixels = bytearray(BG * (W * H))

def set_px(x, y, c):
    if 0 <= x < W and 0 <= y < H:
        i = (y * W + x) * 3
        pixels[i:i+3] = bytes(c)

def rect(x0, y0, x1, y1, c):
    x0, y0, x1, y1 = max(0,x0), max(0,y0), min(W,x1), min(H,y1)
    row = bytes(c) * max(0, x1-x0)
    for y in range(y0, y1):
        i = (y * W + x0) * 3
        pixels[i:i+len(row)] = row

def circle(cx, cy, r, c):
    rr = r*r
    for y in range(cy-r, cy+r+1):
        dy = y-cy
        span = int(max(0, rr-dy*dy) ** 0.5)
        rect(cx-span, y, cx+span+1, y+1, c)

FONT = {
'W':['10001','10001','10001','10101','10101','11011','10001'],
'E':['11111','10000','10000','11110','10000','10000','11111'],
'N':['10001','11001','11001','10101','10011','10011','10001'],
'M':['10001','11011','10101','10101','10001','10001','10001'],
'A':['01110','10001','10001','11111','10001','10001','10001'],
'I':['11111','00100','00100','00100','00100','00100','11111'],
'D':['11110','10001','10001','10001','10001','10001','11110'],
'S':['01111','10000','10000','01110','00001','00001','11110'],
'C':['01111','10000','10000','10000','10000','10000','01111'],
'L':['10000','10000','10000','10000','10000','10000','11111'],
'F':['11111','10000','10000','11110','10000','10000','10000'],
'T':['11111','00100','00100','00100','00100','00100','00100'],
'U':['10001','10001','10001','10001','10001','10001','01110'],
'Y':['10001','10001','01010','00100','00100','00100','00100'],
'R':['11110','10001','10001','11110','10100','10010','10001'],
'V':['10001','10001','10001','10001','01010','01010','00100'],
'K':['10001','10010','10100','11000','10100','10010','10001'],
'G':['01111','10000','10000','10111','10001','10001','01110'],
' ':['00000']*7,
'/':['00001','00010','00100','01000','10000','00000','00000'],
'.':['00000','00000','00000','00000','00000','00100','00100'],
}

def text(s, x, y, scale, color, spacing=2):
    cursor = x
    for ch in s:
        glyph = FONT.get(ch, FONT[' '])
        for gy, row in enumerate(glyph):
            for gx, bit in enumerate(row):
                if bit == '1': rect(cursor+gx*scale, y+gy*scale, cursor+(gx+1)*scale, y+(gy+1)*scale, color)
        cursor += (5+spacing)*scale
    return cursor

# editorial card
rect(86, 78, 1114, 552, PAPER)
rect(86, 78, 98, 552, RUST)
# quiet grid
for x in range(150, 1080, 56): rect(x, 118, x+1, 514, (232, 232, 222))
for y in range(118, 515, 56): rect(150, y, 1080, y+1, (232, 232, 222))
# brand seal and accent
rect(154, 135, 252, 233, BG)
circle(236, 151, 8, RUST)
text('W', 174, 158, 10, PAPER, 1)
# main type
text('WENMAI', 154, 286, 15, INK, 1)
text('DSE CLASSICS / SELF STUDY', 158, 420, 5, MUTED, 1)
# decorative line
rect(158, 472, 560, 478, JADE)
rect(560, 472, 664, 478, RUST)

raw = bytearray()
stride = W*3
for y in range(H):
    raw.append(0)
    raw.extend(pixels[y*stride:(y+1)*stride])

def chunk(kind, data):
    return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', binascii.crc32(kind+data) & 0xffffffff)

png = b'\x89PNG\r\n\x1a\n'
png += chunk(b'IHDR', struct.pack('>IIBBBBB', W, H, 8, 2, 0, 0, 0))
png += chunk(b'IDAT', zlib.compress(bytes(raw), 9))
png += chunk(b'IEND', b'')
out = Path('assets/brand/wenmai-share.png')
out.parent.mkdir(parents=True, exist_ok=True)
out.write_bytes(png)
print(f'Generated {out} ({len(png)} bytes)')
