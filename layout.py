# -*- coding: utf-8 -*-
"""界面与窗口区域共用的几何常量。

改 COVER_RADIUS 时必须同步 app/styles.css 里 .book 的 border-radius；
改 BOOK_ASPECT 时必须同步 .book 的 aspect-ratio 和无头测试的期望值。
"""
from __future__ import annotations

# 窗口：创建尺寸、最小尺寸、屏幕边距
BASE_W, BASE_H = 1120, 895
MIN_W, MIN_H = 880, 700
SCREEN_MARGIN = 12

# 摊开的书页素材
BOOK_W, BOOK_H = 895, 715
BOOK_ASPECT = BOOK_W / BOOK_H
WINDOW_ASPECT = BASE_W / BASE_H

# 书壳圆角：CSS 是百分比，Python 用同一比例
COVER_RADIUS = 0.0115
