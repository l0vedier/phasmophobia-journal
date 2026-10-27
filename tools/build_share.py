# -*- coding: utf-8 -*-
"""打包可发给朋友的「恐鬼症笔记」免安装版本。

用法：python tools/build_share.py
输出（名称和版本号取自 version.py）：
  dist\\恐鬼症笔记 v1.0\\            免安装文件夹（连同资料一起发）
  dist\\恐鬼症笔记 v1.0-分享.zip     压缩包，解压后双击 exe 即可

不会把 extracted、.backup、tools、legacy、测试脚本和启动笔记.bat 打进去。
"""
from __future__ import annotations

import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
if str(BASE) not in sys.path:
    sys.path.insert(0, str(BASE))

from version import APP_NAME, APP_VERSION  # noqa: E402

DIST = BASE / "dist"
TARGET = DIST / APP_NAME
BUILD = BASE / "build"
GHOST_MD = Path(r"D:\game_timer\资料\恐鬼症_鬼魂数据_分鬼版.md")

README = f"""恐鬼症笔记 v{APP_VERSION} 使用说明

【怎么打开】
把整个「{APP_NAME}」文件夹解压到一起，双击 {APP_NAME}.exe。
不要只把 exe 单独拿出来，旁边的 _internal 和 资料 文件夹都要保留。
第一次打开如果 Windows 弹出蓝色提示，点「更多信息」→「仍要运行」。

【怎么用】
游戏中按 Ctrl+J 显示 / 隐藏笔记。
左键点证据：勾选 → 圈住 → 划除。
右键鬼名：查看这只鬼的详细资料（左页通用规则，右页鬼魂介绍）。
点右页的「← 返回鬼名」或按 Esc：回到鬼名列表。
鬼名页右下角「下一页：诅咒之物 →」：查看诅咒之物通用规则和 7 件物品，
点物品名字看介绍，左页下方「← 返回鬼魂名单」翻回来。
右上角内页的 ×：关闭笔记。
「重置」：清空当前勾选。

【改鬼魂资料】
用记事本打开 资料\\恐鬼症_鬼魂数据_分鬼版.md，改完保存，
重新打开笔记即可生效。只改文字内容，不要改动 ## 和 - **字段**：的格式。

【打不开 / 白屏】
需要 Microsoft Edge WebView2 Runtime。Windows 11 一般自带；
Windows 10 如果没有，装一下微软官方的 WebView2 Runtime 即可。

【设置和日志】
%APPDATA%\\PhasmophobiaJournal
"""


def _check_inputs() -> None:
    missing = []
    if not (BASE / "app" / "index.html").is_file():
        missing.append(str(BASE / "app" / "index.html"))
    if not (BASE / "app" / "assets" / "ghost.ico").is_file():
        missing.append(str(BASE / "app" / "assets" / "ghost.ico"))
    if not GHOST_MD.is_file():
        missing.append(str(GHOST_MD))
    if missing:
        raise SystemExit("打包所需文件不存在：\n  " + "\n  ".join(missing))


def _build() -> None:
    if BUILD.exists():
        shutil.rmtree(BUILD)

    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--noconfirm", "--clean", "--windowed",
        "--name", APP_NAME,
        "--icon", str(BASE / "app" / "assets" / "ghost.ico"),
        "--add-data", f"{BASE / 'app'};app",
        # 程序固定走 EdgeChromium（WinForms），用不到 Qt 后端；
        # 不排除的话本机装了 PyQt5，会白白多打 80 多 MB。
        "--exclude-module", "PyQt5",
        "--exclude-module", "PyQt6",
        "--exclude-module", "PySide2",
        "--exclude-module", "PySide6",
        "--specpath", str(BUILD),
        "--workpath", str(BUILD / "work"),
        "--distpath", str(DIST),
        str(BASE / "main.py"),
    ]
    print("开始打包：", " ".join(f'"{c}"' if " " in c else c for c in cmd))
    subprocess.run(cmd, cwd=BASE, check=True)


def _prepare_dist() -> None:
    exe = TARGET / f"{APP_NAME}.exe"
    if not exe.is_file():
        raise SystemExit(f"打包结束但没有找到 exe：{exe}")

    data_dir = TARGET / "资料"
    data_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(GHOST_MD, data_dir / GHOST_MD.name)

    (TARGET / "使用说明.txt").write_text(README, encoding="utf-8-sig")

    print(f"可执行文件：{exe}")
    print(f"鬼魂资料：  {data_dir / GHOST_MD.name}")


def _make_zip() -> Path:
    zip_path = DIST / f"{APP_NAME}-分享.zip"
    if zip_path.exists():
        zip_path.unlink()

    with zipfile.ZipFile(
        zip_path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9
    ) as zf:
        for path in sorted(TARGET.rglob("*")):
            arcname = Path(APP_NAME) / path.relative_to(TARGET)
            if path.is_dir():
                zf.writestr(str(arcname) + "/", "")
            else:
                zf.write(path, str(arcname))
    return zip_path


def _size_mb(path: Path) -> float:
    if path.is_file():
        return path.stat().st_size / (1024 * 1024)
    total = sum(p.stat().st_size for p in path.rglob("*") if p.is_file())
    return total / (1024 * 1024)


def main() -> int:
    _check_inputs()

    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

    _build()
    _prepare_dist()
    zip_path = _make_zip()

    print()
    print(f"文件夹：{TARGET}  ({_size_mb(TARGET):.1f} MB)")
    print(f"压缩包：{zip_path}  ({_size_mb(zip_path):.1f} MB)")
    print("发给朋友时发这个 zip 就行。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
