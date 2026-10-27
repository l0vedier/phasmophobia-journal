# -*- coding: utf-8 -*-
"""鬼魂资料解析 / JS API / 兜底数据的一致性测试。

用法：python tools/test_ghost_info.py
只读 D:\\game_timer\\资料\\恐鬼症_鬼魂数据_分鬼版.md，不写源文件。
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
if str(BASE) not in sys.path:
    sys.path.insert(0, str(BASE))

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

from ghost_info import GHOST_MD, load_ghost_info  # noqa: E402
from main import Api  # noqa: E402

failures = 0


def check(name: str, ok: bool, extra: str = "") -> None:
    global failures
    if ok:
        print(f"  PASS  {name}")
    else:
        failures += 1
        print(f"  FAIL  {name}" + (f"  -> {extra}" if extra else ""))


def main() -> int:
    data = load_ghost_info()
    check("source markdown exists", GHOST_MD.exists(), str(GHOST_MD))
    check("markdown parses", bool(data.get("ok")), str(data.get("error")))

    ghosts = data.get("ghosts") or []
    by_name = {g["name"]: g for g in ghosts}
    check("30 ghost sections", len(ghosts) == 30, str(len(ghosts)))
    check("13 common rules", len(data.get("common") or []) == 13, str(len(data.get("common") or [])))
    check("244 fields in total", sum(len(g["fields"]) for g in ghosts) == 244,
          str(sum(len(g["fields"]) for g in ghosts)))

    cursed = data.get("cursed") or []
    cursed_by_name = {c["name"]: c for c in cursed}
    check("7 cursed items", len(cursed) == 7, str(len(cursed)))
    check("10 cursed common rules", len(data.get("cursed_common") or []) == 10,
          str(len(data.get("cursed_common") or [])))
    check("45 cursed fields in total", sum(len(c["fields"]) for c in cursed) == 45,
          str(sum(len(c["fields"]) for c in cursed)))

    expected_cursed = ["八音盒", "通灵板", "巫毒娃娃", "闹鬼魔镜", "召唤阵", "塔罗牌", "猴爪"]
    check("all 7 cursed names parse", all(n in cursed_by_name for n in expected_cursed),
          str([n for n in expected_cursed if n not in cursed_by_name]))

    ouija = cursed_by_name.get("通灵板") or {}
    ouija_fields = {f["label"]: len(f.get("sub") or []) for f in ouija.get("fields", [])}
    check("Ouija question and phrase sublists parse",
          ouija_fields.get("问题与代价") == 13 and
          ouija_fields.get("常用问法（语音/文本）") == 12 and
          ouija_fields.get("碎裂 → 诅咒猎杀") == 4,
          str(ouija_fields))

    tarot = cursed_by_name.get("塔罗牌") or {}
    tarot_sub = sum(len(f.get("sub") or []) for f in tarot.get("fields", []))
    monkey = cursed_by_name.get("猴爪") or {}
    monkey_sub = sum(len(f.get("sub") or []) for f in monkey.get("fields", []))
    check("Tarot cards and Monkey Paw wishes parse",
          tarot_sub == 10 and monkey_sub == 10,
          f"tarot={tarot_sub} monkey={monkey_sub}")

    journal = [
        "阿斯旺", "界灵", "加鲁", "巨灵", "魔洛伊", "奥班博", "幻影", "亡魂", "刹耶", "魅影",
        "女妖", "恶魔", "御灵", "盲灵", "鬼婴", "赤鬼", "捣蛋鬼", "暗影", "拟魂", "妖怪",
        "达彦", "雾影", "寒魔", "梦魇", "幻妖", "怨灵", "雷兽", "魂魄", "孪魂", "幽灵",
    ]
    aliases = {"捣蛋鬼": "骚灵", "雷兽": "雷魂"}
    missing = [n for n in journal if (aliases.get(n, n)) not in by_name]
    check("all 30 journal names resolve", not missing, str(missing))

    expected = {
        "达彦": ("Dayan", "特殊加速"),
        "界灵": ("Deildegast", "技能·互动降速"),
        "骚灵": ("Poltergeist", "技能·成片抛掷"),
        "雷魂": ("Raiju", "特殊加速"),
        "加鲁": ("Gallu", "技能·升怒"),
    }
    for name, (english, field) in expected.items():
        g = by_name.get(name) or {}
        labels = [f["label"] for f in g.get("fields", [])]
        check(f"{name} keeps heading and fields",
              g.get("english") == english and field in labels,
              f"{g.get('english')} {labels}")

    check("骚灵 keeps its alias", (by_name.get("骚灵") or {}).get("alias") == "又名捣蛋鬼",
          str((by_name.get("骚灵") or {}).get("alias")))
    check("界灵 keeps its alias", (by_name.get("界灵") or {}).get("alias") == "繁体：扰物灵",
          str((by_name.get("界灵") or {}).get("alias")))

    every_has = all(
        len(g["fields"]) >= 3
        and any(f["label"] == "证据" and f["text"] for f in g["fields"])
        for g in ghosts
    )
    check("every ghost has evidence and fields", every_has)

    mimic = by_name.get("拟魂") or {}
    mimic_ev = next((f["text"] for f in mimic.get("fields", []) if f["label"] == "证据"), "")
    check("Mimic evidence keeps the fake orb note", "灵球" in mimic_ev and "证据" in mimic_ev,
          mimic_ev[:60])

    api_data = Api().get_ghost_info()
    check("Api.get_ghost_info() works", bool(api_data.get("ok")) and len(api_data.get("ghosts") or []) == 30,
          str(api_data.get("error")))

    fallback_path = BASE / "app" / "ghost_info.js"
    fallback_ok = False
    fallback_note = "missing"
    if fallback_path.exists():
        try:
            raw = fallback_path.read_text(encoding="utf-8")
            payload = raw.split("window.GHOST_INFO_FALLBACK = ", 1)[1].strip().rstrip(";")
            fallback = json.loads(payload)
            fallback_ok = fallback == data
            fallback_note = "out of sync"
        except Exception as exc:
            fallback_note = f"{type(exc).__name__}: {exc}"
    check("app/ghost_info.js is in sync", fallback_ok, fallback_note)

    print(f"\n{'ALL PASS' if failures == 0 else str(failures) + ' FAILURE(S)'}")
    return 0 if failures == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
