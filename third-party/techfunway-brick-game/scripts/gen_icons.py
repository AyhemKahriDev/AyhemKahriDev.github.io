#!/usr/bin/env python3
"""生成方块游戏机应用图标（纯标准库，无 PIL 依赖）。"""
import struct, zlib, os

def rounded_rect_mask(w, h, x0, y0, x1, y1, r):
    """返回判断函数：点是否在圆角矩形内"""
    def inside(x, y):
        if x < x0 or x > x1 or y < y0 or y > y1:
            return False
        cx = min(max(x, x0 + r), x1 - r)
        cy = min(max(y, y0 + r), y1 - r)
        return (x - cx) ** 2 + (y - cy) ** 2 <= r * r or (x0 + r <= x <= x1 - r) or (y0 + r <= y <= y1 - r)
    # 简化：用四角圆 + 中间矩形
    def inside2(x, y):
        if not (x0 <= x <= x1 and y0 <= y <= y1):
            return False
        corners = [(x0 + r, y0 + r, -1, -1), (x1 - r, y0 + r, 1, -1),
                   (x0 + r, y1 - r, -1, 1), (x1 - r, y1 - r, 1, 1)]
        for cx, cy, sx, sy in corners:
            in_corner_x = (x < x0 + r) if sx < 0 else (x > x1 - r)
            in_corner_y = (y < y0 + r) if sy < 0 else (y > y1 - r)
            if in_corner_x and in_corner_y:
                if (x - cx) ** 2 + (y - cy) ** 2 > r * r:
                    return False
        return True
    return inside2

def lerp(c1, c2, t):
    return tuple(round(a + (b - a) * t) for a, b in zip(c1, c2))

def hexc(s):
    return tuple(int(s[i:i + 2], 16) for i in (1, 3, 5))

def make_icon(size, path):
    S = size
    px = [[(0, 0, 0, 0)] * S for _ in range(S)]
    bg = hexc('#12102b') + (255,)
    # 背景圆角方块（留 2% 边距透明）
    m = S * 0.02
    bg_mask = rounded_rect_mask(S, S, m, m, S - 1 - m, S - 1 - m, S * 0.22)
    for y in range(S):
        for x in range(S):
            if bg_mask(x, y):
                # 轻微纵向渐变
                t = y / S * 0.25
                c = lerp(hexc('#1b1740'), hexc('#0d0b20'), t) + (255,)
                px[y][x] = c
    # 4 个彩色方块
    colors = ['#00e5ff', '#ff2d78', '#ffd60a', '#30ff8e']
    margin = S * 0.17
    gap = S * 0.09
    bw = (S - 2 * margin - gap) / 2
    positions = [(margin, margin), (margin + bw + gap, margin),
                 (margin, margin + bw + gap), (margin + bw + gap, margin + bw + gap)]
    br = bw * 0.18
    for (bx0, by0), col in zip(positions, colors):
        base = hexc(col)
        mask = rounded_rect_mask(S, S, bx0, by0, bx0 + bw, by0 + bw, br)
        for y in range(S):
            for x in range(S):
                if mask(x, y):
                    # 高光/阴影斜面
                    tx = (x - bx0) / bw
                    ty = (y - by0) / bw
                    light = (1 - tx) * 0.22 + (1 - ty) * 0.22
                    shade = tx * 0.18 + ty * 0.18
                    if light > shade:
                        c = lerp(base, (255, 255, 255), min(0.5, light - shade))
                    else:
                        c = lerp(base, (0, 0, 0), min(0.5, shade - light))
                    px[y][x] = c + (255,)
    # 写 PNG（RGBA）
    raw = b''.join(b'\x00' + b''.join(struct.pack('4B', *p) for p in row) for row in px)
    def chunk(typ, data):
        c = struct.pack('>I', len(data)) + typ + data
        return c + struct.pack('>I', zlib.crc32(typ + data) & 0xffffffff)
    ihdr = struct.pack('>IIBBBBB', S, S, 8, 6, 0, 0, 0)
    content = (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr)
               + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'wb') as f:
        f.write(content)
    print(f'wrote {path} ({S}x{S})')

root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'fnpack'))
make_icon(256, os.path.join(root, 'ICON_256.PNG'))
make_icon(64, os.path.join(root, 'ICON.PNG'))
make_icon(256, os.path.join(root, 'app', 'ui', 'images', 'icon_256.png'))
make_icon(64, os.path.join(root, 'app', 'ui', 'images', 'icon_64.png'))
