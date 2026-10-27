# -*- coding: utf-8 -*-
"""把书页素材的左边缘修直。

游戏原图 Bookpages_696.png 的左边缘是一条直线，但从上到下向右偏了约 12px
（约 1.2°），右边缘却基本垂直，所以摊开书看起来只有左边是歪的。

这里只把这条边向左补齐到 x=TARGET_X，让它变成竖直线：
- 保留左上角的圆角（圆角结束前的行不动）
- 只扩展透明区域，不移动、不缩放书页内容
- 右边缘、上下边缘都不动

源图始终读 extracted/textures/Bookpages_696.png（只读），可反复重跑。
用法：python tools/fix_book_left_edge.py
"""
from pathlib import Path

import numpy as np
from PIL import Image

BASE = Path(__file__).resolve().parent.parent
SRC = BASE / "extracted" / "textures" / "Bookpages_696.png"
DST = BASE / "app" / "assets" / "book_spread.png"

TARGET_X = 2          # 最终左边缘所在的列
ALPHA_EDGE = 128      # 判定不透明边缘的 alpha 阈值


def main() -> None:
    image = Image.open(SRC).convert("RGBA")
    pixels = np.array(image)
    height, width = pixels.shape[:2]
    alpha = pixels[..., 3]

    edge = np.full(height, -1, dtype=int)
    for y in range(height):
        opaque = np.where(alpha[y] > ALPHA_EDGE)[0]
        if len(opaque):
            edge[y] = int(opaque[0])

    # 左上圆角结束、边缘第一次到达 TARGET_X 之后才算直线段
    straight_start = None
    for y in range(height):
        if edge[y] == TARGET_X:
            straight_start = y
            break
    if straight_start is None:
        raise RuntimeError("没找到左边缘的直线段，素材可能已经改过。")

    filled_rows = 0
    max_fill = 0
    for y in range(straight_start, height):
        left = edge[y]
        if left <= TARGET_X:
            continue
        # 以边缘为轴对称，把纸面纹理向左镜像补齐，避免出现一条纯色带
        for x in range(TARGET_X, left):
            src_x = min(left + (left - x), width - 1)
            pixels[y, x, :3] = pixels[y, src_x, :3]
            pixels[y, x, 3] = 255
        filled_rows += 1
        max_fill = max(max_fill, left - TARGET_X)

    Image.fromarray(pixels, "RGBA").save(DST)
    print(
        f"left edge straightened: rows={filled_rows}, "
        f"max_fill={max_fill}px, output={DST}"
    )


if __name__ == "__main__":
    main()
