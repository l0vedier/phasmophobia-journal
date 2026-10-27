# -*- coding: utf-8 -*-
"""读取并解析用户维护的鬼魂资料 Markdown（只读，不改源文件）。

数据源：优先找程序旁边的 资料\\恐鬼症_鬼魂数据_分鬼版.md
（打包后朋友可以直接改这一份），找不到再退回开发机的
D:\\game_timer\\资料\\恐鬼症_鬼魂数据_分鬼版.md。
界面通过 Api.get_ghost_info() 在启动/首次打开详情页时取一次；
另外 tools/gen_ghost_info.py 会把同一份解析结果写成 app/ghost_info.js，
作为没有 pywebview API 时（无头测试）的兜底。

Markdown 结构约定（由用户维护，不要在本文件里改数据）：
  ## 阿斯旺 Aswang
  - **证据**：……
  - **猎杀阈值**：……
每只鬼的字段名和顺序都按文件原样保留。

同一份文件末尾可以接顶层 `#` 分节（如 `# 诅咒之物`），
鬼魂解析到该处停止；诅咒之物用 `###` 子标题，不会被当成鬼魂。
诅咒之物分节里的 `### 通用规则` 是左页规则，其余 `###` 是物品；
物品字段既支持 `- **标签**：内容`，也支持缩进子项（如塔罗牌、猴爪愿望）。
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

GHOST_MD_NAME = "恐鬼症_鬼魂数据_分鬼版.md"
GHOST_MD = Path(r"D:\game_timer\资料") / GHOST_MD_NAME


def default_ghost_md() -> Path:
    """程序旁边有资料就用它；没有再用开发机上的原文件。

    打包成 exe 后，模块在 _internal 里，但资料放在 exe 同级，
    方便朋友直接编辑，所以先看 sys.executable 所在目录。
    """
    candidates = (
        Path(sys.executable).resolve().parent / "资料" / GHOST_MD_NAME,
        Path(__file__).resolve().parent / "资料" / GHOST_MD_NAME,
    )
    for candidate in candidates:
        if candidate.is_file():
            return candidate
    return GHOST_MD

_HEADING = re.compile(r"^##\s+(.+?)\s*$")
_CURSED_HEADING = re.compile(r"^###\s+(.+?)\s*$")
_BULLET = re.compile(r"^-\s+\*\*(.+?)\*\*\s*[：:]\s*(.*)$")
_CURSED_FIELD = re.compile(r"^\*\*(.+?)\*\*(.*?)[：:]\s*(.*)$")
_NESTED_BULLET = re.compile(r"^(\s+)-\s+(.*)$")


def _split_heading(heading: str) -> tuple[str, str, str]:
    """把 `骚灵 Poltergeist（又名捣蛋鬼）` 拆成 名字 / 英文 / 括号别名。"""
    parts = heading.split(None, 1)
    name = parts[0].strip()
    rest = parts[1].strip() if len(parts) > 1 else ""
    alias = ""
    m = re.search(r"（(.+?)）", rest)
    if m:
        alias = m.group(1).strip()
    english = rest.split("（", 1)[0].strip()
    return name, english, alias


def parse_ghost_md(text: str) -> tuple[list[str], list[dict]]:
    """返回（通用规则列表, 每只鬼的 {name, english, alias, fields} 列表）。"""
    common: list[str] = []
    ghosts: list[dict] = []

    current: dict | None = None
    in_common = False

    for raw in text.splitlines():
        line = raw.rstrip()

        # 顶层 `#` 是鬼魂资料之后的另一个分节（如诅咒之物）。
        # 这里只结束鬼魂解析，不把该行当成鬼魂标题。
        if line.startswith("# "):
            current = None
            in_common = False
            continue

        heading = _HEADING.match(line)
        if heading:
            title = heading.group(1).strip()
            current = None
            in_common = title.startswith("通用规则")
            if not in_common:
                name, english, alias = _split_heading(title)
                current = {
                    "name": name,
                    "english": english,
                    "alias": alias,
                    "fields": [],
                }
                ghosts.append(current)
            continue

        if in_common:
            if line.startswith("- "):
                common.append(line[2:].strip())
            continue

        if current is None or not line.startswith("- "):
            continue

        m = _BULLET.match(line)
        if m:
            current["fields"].append({
                "label": m.group(1).strip(),
                "text": m.group(2).strip(),
            })
        else:
            current["fields"].append({
                "label": "",
                "text": line[2:].strip(),
            })

    return common, ghosts


def parse_cursed_md(text: str) -> tuple[list[str], list[dict]]:
    """返回（诅咒之物通用规则, 每件物品的 {name, english, alias, fields}）。

    只解析顶层 `# 诅咒之物` 分节；`### 通用规则` 收进 common，
    其余 `###` 各是一件物品。字段下的缩进 `-` 子项放进 field["sub"]，
    用来保留通灵板问题表、塔罗牌列表和猴爪愿望表。
    """
    common: list[str] = []
    items: list[dict] = []

    in_cursed = False
    in_common = False
    current: dict | None = None
    current_field: dict | None = None

    for raw in text.splitlines():
        line = raw.rstrip()

        if line.startswith("# "):
            in_cursed = line[2:].strip().startswith("诅咒之物")
            in_common = False
            current = None
            current_field = None
            continue

        if not in_cursed:
            continue

        heading = _CURSED_HEADING.match(line)
        if heading:
            title = heading.group(1).strip()
            current_field = None
            if title.startswith("通用规则"):
                in_common = True
                current = None
                continue

            in_common = False
            name, english, alias = _split_heading(title)
            current = {
                "name": name,
                "english": english,
                "alias": alias,
                "fields": [],
            }
            items.append(current)
            continue

        if in_common:
            if line.startswith("- "):
                common.append(line[2:].strip())
            continue

        if current is None:
            continue

        nested = _NESTED_BULLET.match(line)
        if nested:
            body = nested.group(2).strip()
            sub = _CURSED_FIELD.match(body)
            if sub:
                item = {
                    "label": (sub.group(1) + sub.group(2)).strip(),
                    "text": sub.group(3).strip(),
                }
            else:
                item = {"label": "", "text": body}
            if current_field is None:
                current_field = {"label": "", "text": "", "sub": []}
                current["fields"].append(current_field)
            current_field["sub"].append(item)
            continue

        if line.startswith("- "):
            body = line[2:].strip()
            field = _CURSED_FIELD.match(body)
            if field:
                current_field = {
                    "label": (field.group(1) + field.group(2)).strip(),
                    "text": field.group(3).strip(),
                    "sub": [],
                }
            else:
                current_field = {"label": "", "text": body, "sub": []}
            current["fields"].append(current_field)

    return common, items


def load_ghost_info(path: str | Path | None = None) -> dict:
    """读取资料文件；失败时返回 ok=False，不抛异常（界面会显示错误）。"""
    src = Path(path) if path is not None else default_ghost_md()
    try:
        text = src.read_text(encoding="utf-8-sig")
        common, ghosts = parse_ghost_md(text)
        cursed_common, cursed = parse_cursed_md(text)
        if not ghosts:
            raise ValueError("资料里没有解析到任何鬼魂章节")
        return {
            "ok": True,
            "source": str(src),
            "common": common,
            "ghosts": ghosts,
            "cursed_common": cursed_common,
            "cursed": cursed,
        }
    except Exception as exc:
        return {
            "ok": False,
            "source": str(src),
            "error": f"{type(exc).__name__}: {exc}",
            "common": [],
            "ghosts": [],
            "cursed_common": [],
            "cursed": [],
        }
