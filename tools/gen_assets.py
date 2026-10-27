# -*- coding: utf-8 -*-
"""程序化生成四张自制素材，用来替换原来从游戏里提取的贴图。

原图是 Kinetic Games 的素材，不能随开源仓库分发；这里全部用噪声和几何
形状算出来，几何尺寸和色调对齐原图，所以 CSS 里的 mask、书脊阴影、圆角
位置都不用改。

生成物：
    book_spread.png    895×715 RGBA，摊开的书页（同时当 alpha 遮罩用）
    parchment_tile.png 512×512，可无缝平铺的纸纤维
    leather.png        1024×1024，皮面书壳的纹理
    ghost.ico          16/32/48/64/128/256 多尺寸图标

用法：
    python tools/gen_assets.py [输出目录]    # 默认 app/assets
"""

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

W, H = 895, 715          # 与原 book_spread.png 完全一致
SPINE = 0.508            # 书脊位置，和 .spine-shade 的 46.5% + 9% 对齐
SEED = 20261027

PAPER = np.array([255.5, 253.0, 209.0], np.float32)  # 奶油纸色（原图实测均值 + 后续乘算的补偿）
PAPER_EDGE = np.array([232.0, 216.0, 164.0], np.float32)  # 边缘做旧的暖褐


# ---------- 噪声工具 ----------
def noise(h, w, cell, rng):
    """平滑噪声，0..1。cell 越小越细。

    走「全分辨率白噪声 + 高斯模糊」，不要拿小网格放大——放大会出现
    明显的方块接缝（第一版就踩了这个坑）。
    """
    base = rng.random((h, w)).astype(np.float32)
    img = Image.fromarray((base * 255).astype(np.uint8))
    img = img.filter(ImageFilter.GaussianBlur(max(0.6, cell * 0.55)))
    arr = np.asarray(img, np.float32) / 255.0
    lo, hi = float(arr.min()), float(arr.max())
    return ((arr - lo) / max(1e-6, hi - lo)).astype(np.float32)


def seamless(h, w, freqs, rng):
    """整数频率正弦叠加，天然可无缝平铺。freqs = [(fx, fy, 振幅), ...]"""
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    out = np.zeros((h, w), np.float32)
    for fx, fy, amp in freqs:
        ph = rng.random() * 2 * np.pi
        out += amp * np.sin(2 * np.pi * (fx * xx / w + fy * yy / h) + ph)
    return out


def smoothstep(t):
    t = np.clip(t, 0.0, 1.0)
    return t * t * (3 - 2 * t)


# ---------- 书页 ----------
def wavy_mask(w, h, radius=13, amp=1.9, seed=SEED):
    """圆角矩形 + 直边上轻微起伏的撕纸边，4 倍超采样做抗锯齿。"""
    rng = np.random.default_rng(seed)
    s = 4
    pw, ph = w * s, h * s
    inset = 2 * s
    r = radius * s

    def wave(n, f1, f2):
        t = np.linspace(0, 1, n, endpoint=False)
        p1, p2 = rng.random() * 6.283, rng.random() * 6.283
        return (np.sin(2 * np.pi * f1 * t + p1) * 0.55
                + np.sin(2 * np.pi * f2 * t + p2) * 0.45) * amp * s

    pts = []
    n = 90
    # 上边：左 -> 右
    xs = np.linspace(inset + r, pw - inset - r, n)
    top_w = wave(n, 3.1, 7.7)
    pts += [(float(x), inset + float(o)) for x, o in zip(xs, top_w)]
    # 右上圆角
    for a in np.linspace(-90, 0, 14):
        pts.append((pw - inset - r + r * np.cos(np.radians(a)),
                    inset + r + r * np.sin(np.radians(a))))
    # 右边：上 -> 下
    ys = np.linspace(inset + r, ph - inset - r, n)
    right_w = wave(n, 2.6, 6.3)
    pts += [(pw - inset + float(o), float(y)) for y, o in zip(ys, right_w)]
    # 右下圆角
    for a in np.linspace(0, 90, 14):
        pts.append((pw - inset - r + r * np.cos(np.radians(a)),
                    ph - inset - r + r * np.sin(np.radians(a))))
    # 下边：右 -> 左
    xs = np.linspace(pw - inset - r, inset + r, n)
    bot_w = wave(n, 4.4, 9.1)
    pts += [(float(x), ph - inset + float(o)) for x, o in zip(xs, bot_w)]
    # 左下圆角
    for a in np.linspace(90, 180, 14):
        pts.append((inset + r + r * np.cos(np.radians(a)),
                    ph - inset - r + r * np.sin(np.radians(a))))
    # 左边：下 -> 上
    ys = np.linspace(ph - inset - r, inset + r, n)
    left_w = wave(n, 3.6, 8.2)
    pts += [(inset + float(o), float(y)) for y, o in zip(ys, left_w)]
    # 左上圆角
    for a in np.linspace(180, 270, 14):
        pts.append((inset + r + r * np.cos(np.radians(a)),
                    inset + r + r * np.sin(np.radians(a))))

    m = Image.new("L", (pw, ph), 0)
    ImageDraw.Draw(m).polygon(pts, fill=255)
    m = m.resize((w, h), Image.LANCZOS)
    return np.asarray(m, np.float32) / 255.0


def make_book_spread():
    rng = np.random.default_rng(SEED)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)

    # 纸底色 + 大块斑驳 + 细纤维
    low = noise(H, W, 150, rng)
    mid = noise(H, W, 46, rng)
    block = noise(H, W, 90, rng)
    fine = noise(H, W, 2.2, rng)
    shade = (1.0 + (low - 0.5) * 0.055 + (mid - 0.5) * 0.038
             + (block - 0.5) * 0.032)
    rgb = PAPER[None, None, :] * shade[..., None]
    # 细纤维感：加减法叠一层浅噪点，纸面才不至于像纯色块
    rgb = rgb + (fine - 0.5)[..., None] * 5.5
    # 整体亮度对齐原图（实测差 1.9%），少这一点肉眼看就是「有点发灰」
    rgb = np.clip(rgb * 1.019, 0, 255)

    # 边缘做旧：从纸边往里 60px 渐深，四角更重
    d_edge = np.minimum.reduce([xx, W - 1 - xx, yy, H - 1 - yy])
    age = smoothstep(1 - d_edge / 78.0) * 0.52
    for cx, cy in ((0, 0), (W - 1, 0), (0, H - 1), (W - 1, H - 1)):
        dr = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
        age += smoothstep(1 - dr / 140.0) * 0.24
    age = np.clip(age, 0, 0.72)[..., None]
    rgb = rgb * (1 - age) + PAPER_EDGE[None, None, :] * age

    # 书脊：中缝一道暗槽 + 右缘一条受光棱
    dx = xx - SPINE * W
    crease = -0.26 * np.exp(-((dx + 3.5) / 8.0) ** 2) \
             + 0.055 * np.exp(-((dx - 13.0) / 9.0) ** 2)
    # 只在中缝附近生效，页面上沿/下沿不出现整条竖线
    crease *= smoothstep(np.minimum(yy, H - 1 - yy) / 26.0)
    rgb = rgb * (1 + crease[..., None])
    rgb = np.clip(rgb, 0, 255)

    # 右页淡格线（原图右页就是方格纸）
    grid = np.zeros((H, W), np.float32)
    step = 15.6
    gx = (xx > SPINE * W + 26) & (xx < W - 12)
    gy = (yy > 10) & (yy < H - 12)
    vline = (np.mod(xx - SPINE * W - 26, step) < 1.1) & gx & gy
    hline = (np.mod(yy - 10, step) < 1.1) & gx & gy
    grid[vline | hline] = 1.0
    grid = np.asarray(
        Image.fromarray((grid * 255).astype(np.uint8), "L").filter(
            ImageFilter.GaussianBlur(0.7)), np.float32) / 255.0
    # 格线深浅不一：老纸上的印刷线本来就有浓有淡
    grid *= np.clip(0.45 + 1.1 * noise(H, W, 170, rng), 0.0, 1.25)
    rgb = rgb * (1 - grid[..., None] * np.array([0.040, 0.044, 0.052]))

    # 几块很淡的水渍 + 少量墨点
    stains = np.zeros((H, W), np.float32)
    for _ in range(12):
        cx, cy = rng.uniform(0, W), rng.uniform(0, H)
        rx, ry = rng.uniform(35, 95), rng.uniform(30, 80)
        stains += np.exp(-(((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2)) \
            * rng.uniform(0.03, 0.07)
    rgb = rgb * (1 - np.clip(stains, 0, 0.10)[..., None] * np.array([1.0, .95, .78]))

    img = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8), "RGB")
    d = ImageDraw.Draw(img)
    for _ in range(20):
        x, y = rng.uniform(6, W - 6), rng.uniform(6, H - 6)
        # 墨点只在边缘附近，中间保持干净
        if min(x, W - x, y, H - y) > 70:
            continue
        r = rng.uniform(0.4, 1.1)
        v = int(rng.uniform(170, 210))
        d.ellipse([x - r, y - r, x + r, y + r], fill=(v, int(v * .90), int(v * .66)))

    alpha = (wavy_mask(W, H) * 255).astype(np.uint8)
    out = img.convert("RGBA")
    out.putalpha(Image.fromarray(alpha, "L"))
    return out


# ---------- 纸纹 ----------
def make_parchment_tile(size=512):
    rng = np.random.default_rng(SEED + 1)
    freqs = []
    for _ in range(10):
        freqs.append((rng.integers(2, 7), rng.integers(2, 7), rng.uniform(.5, 1.0)))
    for _ in range(14):
        freqs.append((rng.integers(9, 25), rng.integers(9, 25), rng.uniform(.2, .5)))
    for _ in range(18):
        freqs.append((rng.integers(55, 95), rng.integers(55, 95), rng.uniform(.08, .22)))
    f = seamless(size, size, freqs, rng)
    f = (f - f.min()) / (f.max() - f.min())

    base = np.array([242.8, 237.7, 218.3], np.float32)
    rgb = base[None, None, :] * (0.958 + 0.048 * f[..., None])
    # 再叠一层细颗粒，同样用整数频率保证无缝
    g = seamless(size, size, [
        (rng.integers(120, 240), rng.integers(120, 240), 1.0)
        for _ in range(6)], rng)
    rgb = rgb * (1 + 0.008 * g[..., None])
    return Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8), "RGB")


# ---------- 皮革 ----------
def worley(h, w, cell, rng):
    """细胞噪声：返回最近点距离 d1、以及到第二近点的差 d2-d1（越接近 0 越靠边界）。"""
    gh, gw = h // cell + 2, w // cell + 2
    px = (np.arange(gw)[None, :] + 0.5 + rng.uniform(-.42, .42, (gh, gw))) * cell
    py = (np.arange(gh)[:, None] + 0.5 + rng.uniform(-.42, .42, (gh, gw))) * cell

    yy, xx = np.mgrid[0:h, 0:w]
    yy = yy.astype(np.float32)
    xx = xx.astype(np.float32)
    gy = np.clip((yy // cell).astype(np.int32), 0, gh - 1)
    gx = np.clip((xx // cell).astype(np.int32), 0, gw - 1)

    d1 = np.full((h, w), 1e9, np.float32)
    d2 = np.full((h, w), 1e9, np.float32)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            iy = np.clip(gy + dy, 0, gh - 1)
            ix = np.clip(gx + dx, 0, gw - 1)
            d = np.sqrt((xx - px[iy, ix]) ** 2 + (yy - py[iy, ix]) ** 2)
            d2 = np.minimum(d2, np.maximum(d1, d))
            d1 = np.minimum(d1, d)
    return d1, d2 - d1


def make_leather(size=1024):
    rng = np.random.default_rng(SEED + 2)
    d1, edge = worley(size, size, 15, rng)     # 粒面的「鹅卵石」细胞

    # 每颗细胞中间亮、沟槽暗，这是皮革粒面最像的地方
    dome = np.clip(d1 / (15.0 * 0.78), 0, 1)
    v = 1.06 - 0.30 * dome ** 0.8
    # 细胞边界压一条深沟
    v -= (1.0 - smoothstep(edge / 2.6)) * 0.10

    big = noise(size, size, 210, rng)      # 大块深浅（像被磨过）
    mid = noise(size, size, 30, rng)
    micro = noise(size, size, 1.4, rng)    # 细颗粒
    v += (big - 0.5) * 0.10 + (mid - 0.5) * 0.09 + (micro - 0.5) * 0.07

    base = np.array([104.0, 66.0, 44.0], np.float32)
    rgb = base[None, None, :] * v[..., None]
    rgb[..., 2] *= 0.92
    return Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8), "RGB")


# ---------- 图标 ----------
def make_icon(size=1024):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    k = size / 1024.0

    # 深棕圆角底
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(232 * k),
                        fill=(64, 39, 26, 255))
    # 底的中上部提亮一点，避免整块死黑
    glow = Image.new("L", (size, size), 0)
    ImageDraw.Draw(glow).ellipse([-size * .3, -size * .62, size * 1.3, size * .78],
                                 fill=90)
    glow = glow.filter(ImageFilter.GaussianBlur(size * .05))
    img.paste(Image.new("RGBA", (size, size), (120, 78, 50, 22)), (0, 0), glow)

    ghost = (243, 232, 202, 255)
    cx, cy, rx, ry = 512 * k, 430 * k, 238 * k, 218 * k

    pts = []
    # 头部上半圈
    for a in np.linspace(180, 360, 40):
        pts.append((cx + rx * np.cos(np.radians(a)),
                    cy + ry * np.sin(np.radians(a))))
    # 右侧直落
    pts.append((cx + rx, 690 * k))
    # 三个波浪裙摆
    for t in np.linspace(1, 0, 61):
        x = cx - rx + 2 * rx * t
        y = (690 + 46 * np.sin(np.pi * 3 * t + np.pi)) * k
        pts.append((x, y))
    # 左侧升回
    pts.append((cx - rx, 690 * k))
    d.polygon(pts, fill=ghost)

    # 眼睛
    for ex in (cx - 78 * k, cx + 78 * k):
        d.ellipse([ex - 46 * k, 400 * k - 60 * k, ex + 46 * k, 400 * k + 60 * k],
                  fill=(64, 39, 26, 255))
    # 小嘴
    d.arc([cx - 40 * k, 508 * k, cx + 40 * k, 580 * k], 20, 160,
          fill=(64, 39, 26, 255), width=int(22 * k))

    return img


# ---------- 输出 ----------
def main():
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else \
        Path(__file__).resolve().parent.parent / "app" / "assets"
    out.mkdir(parents=True, exist_ok=True)

    make_book_spread().save(out / "book_spread.png", optimize=True)
    make_parchment_tile().save(out / "parchment_tile.png", optimize=True)
    make_leather().save(out / "leather.png", optimize=True)

    icon = make_icon()
    icon.resize((256, 256), Image.LANCZOS).save(
        out / "ghost.ico",
        sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])

    for name in ("book_spread.png", "parchment_tile.png", "leather.png", "ghost.ico"):
        p = out / name
        print(f"{name:20s} {p.stat().st_size / 1024:8.1f} KB")


if __name__ == "__main__":
    main()
