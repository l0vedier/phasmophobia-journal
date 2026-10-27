# -*- coding: utf-8 -*-
"""把鬼魂资料 Markdown 的解析结果写成 app/ghost_info.js。

用法：python tools/gen_ghost_info.py

正式运行时会通过 Api.get_ghost_info() 现读 Markdown，这个生成文件只是
无头测试（没有 pywebview API）时的兜底。改完 Markdown 后建议重跑一次，
让兜底数据保持同步。
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
if str(BASE) not in sys.path:
    sys.path.insert(0, str(BASE))

from ghost_info import load_ghost_info  # noqa: E402

OUT = BASE / "app" / "ghost_info.js"


def main() -> int:
    data = load_ghost_info()
    if not data.get("ok"):
        print(f"FAILED: {data.get('source')}: {data.get('error')}")
        return 1

    body = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    OUT.write_text(
        "/* 自动生成，勿手改：python tools/gen_ghost_info.py */\n"
        "window.GHOST_INFO_FALLBACK = " + body + ";\n",
        encoding="utf-8",
    )
    n_fields = sum(len(g["fields"]) for g in data["ghosts"])
    n_cursed_fields = sum(len(c["fields"]) for c in data["cursed"])
    print(
        f"wrote {OUT} ({OUT.stat().st_size} bytes): "
        f"{len(data['ghosts'])} ghosts, {n_fields} fields, "
        f"{len(data['common'])} common rules; "
        f"{len(data['cursed'])} cursed items, {n_cursed_fields} fields, "
        f"{len(data['cursed_common'])} cursed rules"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
