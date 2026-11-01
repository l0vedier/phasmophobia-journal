# -*- coding: utf-8 -*-
"""恐鬼症证据笔记（桌面置顶小窗）。

界面素材由 tools/gen_assets.py 程序化生成（不依赖游戏文件），随程序放在
app/assets 下；字体是 SIL OFL 1.1 的龙藏体，许可证见同目录的 OFL.txt。
配置保存在 %APPDATA%\\PhasmophobiaJournal\\config.json，
运行日志在同目录的 journal.log。
"""
from __future__ import annotations

import ctypes
import json
import logging
import os
import sys
import threading
import traceback
from ctypes import wintypes
from pathlib import Path

BASE = Path(__file__).resolve().parent
if str(BASE) not in sys.path:
    sys.path.insert(0, str(BASE))

import applog  # noqa: E402
from version import APP_NAME  # noqa: E402

LOG_PATH = applog.setup()
log = logging.getLogger("journal")

WINDOW_TITLE = APP_NAME

# 界面全是 2D 文字和 CSS 动画，用核显绰绰有余：让独显留给游戏，也更省电。
# 走 WebView2 的 Chromium 启动参数，只作用于本程序的 WebView2 实例，
# 不改系统「图形设置」，也不影响其他软件；保留调用方已经设好的参数（如调试端口）。
# 排查显卡问题时可以设 PHASMO_LOW_POWER_GPU=0 临时改回独显。
_GPU_ARGS = "--force_low_power_gpu"
_existing_args = os.environ.get("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS", "").strip()
if os.environ.get("PHASMO_LOW_POWER_GPU", "1") != "0" and _GPU_ARGS not in _existing_args:
    os.environ["WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS"] = (
        f"{_existing_args} {_GPU_ARGS}".strip()
    )


def _fatal(message: str, title: str = f"{APP_NAME} - 启动失败") -> None:
    """pythonw 没有控制台，启动失败时只能靠弹窗和日志。"""
    try:
        ctypes.windll.user32.MessageBoxW(0, message, title, 0x10)
    except Exception:
        try:
            print(message, file=sys.stderr)
        except Exception:
            pass


# 重依赖和本项目的模块都放在保护块里：任何一个导入失败，
# pythonw 下原本会完全静默，现在会写日志并弹窗。
try:
    import webview
    from ghost_info import load_ghost_info  # noqa: E402
    from hotkey import HotkeyToggle  # noqa: E402
    from layout import (  # noqa: E402
        BASE_W,
        BASE_H,
        MIN_W,
        MIN_H,
        SCREEN_MARGIN,
        BOOK_ASPECT,
        WINDOW_ASPECT,
        COVER_RADIUS,
    )
except Exception:
    _detail = traceback.format_exc()
    log.critical("startup imports failed\n%s", _detail)
    _fatal(
        "启动所需的组件加载失败：\n\n"
        + (_detail.strip().splitlines()[-1] if _detail.strip() else "未知错误")
        + f"\n\n完整信息见日志：\n{LOG_PATH}"
    )
    raise SystemExit(1)

APP_DIR = BASE / "app"
INDEX = APP_DIR / "index.html"
ICON = APP_DIR / "assets" / "ghost.ico"

CONFIG_DIR = applog.CONFIG_DIR
CONFIG_PATH = CONFIG_DIR / "config.json"

# --------------------------------------------------------------- 启动自检
# v1.4：pythonw 和打包后的 exe 都没有控制台，一旦启动失败，用户只看得到
# 「双击没反应」。所以在真正建窗口之前，先把最常见的几类原因逐个查一遍，
# 用中文弹窗说清楚该怎么办；这里查不出来的，交给文件末尾的通用异常兜底。
_WEBVIEW2_CLIENT = "{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"
_WEBVIEW2_URL = "https://developer.microsoft.com/zh-cn/microsoft-edge/webview2/"


def _ask(message: str, title: str = f"{APP_NAME} - 启动失败") -> bool:
    """是 / 否 弹窗，返回 True 表示用户点了「是」。"""
    try:
        return ctypes.windll.user32.MessageBoxW(0, message, title, 0x04 | 0x30) == 6
    except Exception:
        return False


def _webview2_version() -> str | None:
    """已安装的 WebView2 运行时版本；没装返回 None。"""
    try:
        import winreg
    except Exception:
        return None
    locations = (
        (
            winreg.HKEY_LOCAL_MACHINE,
            rf"SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{_WEBVIEW2_CLIENT}",
        ),
        (
            winreg.HKEY_LOCAL_MACHINE,
            rf"SOFTWARE\Microsoft\EdgeUpdate\Clients\{_WEBVIEW2_CLIENT}",
        ),
        (
            winreg.HKEY_CURRENT_USER,
            rf"Software\Microsoft\EdgeUpdate\Clients\{_WEBVIEW2_CLIENT}",
        ),
    )
    for root, path in locations:
        try:
            with winreg.OpenKey(root, path) as key:
                value, _ = winreg.QueryValueEx(key, "pv")
        except OSError:
            continue
        text = str(value or "").strip()
        if text and text != "0.0.0.0":
            return text
    return None


def _in_temp_dir() -> bool:
    """exe 是不是被解压到临时目录了 —— 等于在压缩包里直接双击运行。"""
    try:
        exe = Path(sys.executable).resolve()
        temp = os.environ.get("TEMP") or os.environ.get("TMP") or ""
        if not temp:
            return False
        exe.relative_to(Path(temp).resolve())
        return True
    except (ValueError, OSError):
        return False


def _ghost_data_missing() -> Path | None:
    """找不到鬼魂数据文件时返回它应该在的位置。"""
    try:
        from ghost_info import default_ghost_md

        path = Path(default_ghost_md())
    except Exception:
        return None
    return None if path.is_file() else path


def preflight() -> None:
    log.info(
        "preflight: frozen=%s exe=%s", getattr(sys, "frozen", False), sys.executable
    )

    if _in_temp_dir():
        log.error("preflight: running from temp dir")
        _fatal(
            "看起来你是在压缩包里直接双击运行的 —— 程序被临时解压到了临时目录，"
            "旁边的文件都找不到，所以打不开。\n\n"
            "请这样做：\n"
            "1. 右键下载到的 zip → 「全部解压」\n"
            "2. 进解压出来的文件夹\n"
            f"3. 双击里面的 {APP_NAME}.exe\n\n"
            "（不要双击压缩包里的 exe，也不要只把 exe 单独拖出来）"
        )
        raise SystemExit(1)

    if not INDEX.is_file():
        log.error("preflight: index.html missing: %s", INDEX)
        _fatal(
            "程序文件不完整：找不到界面文件。\n\n"
            f"{INDEX}\n\n"
            "请把下载到的 zip 整个解压后再运行，"
            "exe 和 _internal 文件夹、资料文件夹必须放在一起，不能只拿 exe。"
        )
        raise SystemExit(1)

    runtime = _webview2_version()
    log.info("preflight: webview2 runtime = %s", runtime or "未安装")
    if runtime is None:
        if _ask(
            "缺少 Microsoft Edge WebView2 运行时，程序没法显示界面。\n\n"
            "这是微软的浏览器内核组件（免费），装上就能用。\n\n"
            "点「是」打开官方下载页，下载后双击安装，再重新打开本程序。\n"
            "点「否」退出。"
        ):
            try:
                import webbrowser

                webbrowser.open(_WEBVIEW2_URL)
            except Exception:
                log.exception("could not open the WebView2 download page")
        raise SystemExit(1)

    missing = _ghost_data_missing()
    if missing is not None:
        log.error("preflight: ghost data missing: %s", missing)
        _fatal(
            "找不到鬼魂数据文件，程序没法显示鬼名列表。\n\n"
            f"应该在：{missing}\n\n"
            "请确认压缩包里的「资料」文件夹和 exe 放在同一层，"
            "然后把整个文件夹重新解压一次。"
        )
        raise SystemExit(1)


def _log_thread_exception(args) -> None:
    log.error(
        "uncaught exception in thread %s",
        getattr(args.thread, "name", "?"),
        exc_info=(args.exc_type, args.exc_value, args.exc_traceback),
    )


threading.excepthook = _log_thread_exception


def screen_size() -> tuple[int, int]:
    try:
        screen = webview.screens[0]
        return int(screen.width), int(screen.height)
    except Exception:
        log.warning("screen size lookup failed; using the fallback size", exc_info=True)
        return 1707, 1067


def load_config() -> dict:
    try:
        with open(CONFIG_PATH, "r", encoding="utf-8") as fh:
            data = json.load(fh)
        return data if isinstance(data, dict) else {}
    except FileNotFoundError:
        return {}
    except Exception:
        log.warning("could not read config %s", CONFIG_PATH, exc_info=True)
        return {}


def save_config(data: dict) -> None:
    try:
        CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        tmp = CONFIG_PATH.with_name(CONFIG_PATH.name + ".tmp")
        with open(tmp, "w", encoding="utf-8") as fh:
            json.dump(data, fh, ensure_ascii=False, indent=2)
        os.replace(tmp, CONFIG_PATH)
    except Exception:
        log.warning("could not save config %s", CONFIG_PATH, exc_info=True)


def _int(value, fallback: int) -> int:
    try:
        return int(value)
    except Exception:
        return fallback


def max_window_size() -> tuple[int, int]:
    """程序的最大窗口：在屏幕边距内，保持书页默认比例，尽量顶满。"""
    sw, sh = screen_size()
    max_w = sw - SCREEN_MARGIN * 2
    max_h = sh - SCREEN_MARGIN * 2
    if max_w / max_h > WINDOW_ASPECT:
        h = max_h
        w = int(round(h * WINDOW_ASPECT))
    else:
        w = max_w
        h = int(round(w / WINDOW_ASPECT))
    return max(MIN_W, w), max(MIN_H, h)


def initial_position(w: int, h: int, cfg: dict) -> tuple[int, int]:
    sw, sh = screen_size()
    x = _int(cfg.get("x"), -1)
    y = _int(cfg.get("y"), -1)
    visible = (
        x >= -w + 88
        and x <= sw - 88
        and y >= 0
        and y <= sh - 56
    )
    if not visible:
        x = (sw - w) // 2
        y = (sh - h) // 2
    return x, y


# ---- 单实例 ----
# 测试可以用 --allow-multi 绕过，避免真实窗口测试和日常使用的笔记互相抢 Ctrl+J。
_SINGLE_INSTANCE = "--allow-multi" not in sys.argv
_instance_mutex = None


def _activate_existing_window() -> bool:
    try:
        user32 = ctypes.WinDLL("user32", use_last_error=True)
        user32.FindWindowW.argtypes = (wintypes.LPCWSTR, wintypes.LPCWSTR)
        user32.FindWindowW.restype = wintypes.HWND
        user32.ShowWindow.argtypes = (wintypes.HWND, ctypes.c_int)
        user32.ShowWindow.restype = wintypes.BOOL
        user32.SetForegroundWindow.argtypes = (wintypes.HWND,)
        user32.SetForegroundWindow.restype = wintypes.BOOL

        hwnd = user32.FindWindowW(None, WINDOW_TITLE)
        if not hwnd:
            log.warning("existing instance owns the mutex but its window was not found")
            return False
        user32.ShowWindow(hwnd, 9)  # SW_RESTORE
        user32.SetForegroundWindow(hwnd)
        log.info("existing instance activated (hwnd=%s)", hwnd)
        return True
    except Exception:
        log.exception("could not activate the existing instance")
        return False


def claim_single_instance() -> bool:
    """返回 False 时说明已有实例，当前进程应该直接退出。"""
    global _instance_mutex
    if not _SINGLE_INSTANCE:
        return True
    try:
        kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
        kernel32.CreateMutexW.argtypes = (ctypes.c_void_p, wintypes.BOOL, wintypes.LPCWSTR)
        kernel32.CreateMutexW.restype = wintypes.HANDLE
        _instance_mutex = kernel32.CreateMutexW(
            None, False, "Local\\PhasmophobiaJournal"
        )
        if not _instance_mutex:
            log.warning(
                "CreateMutexW failed (error=%s); continuing without the single-instance guard",
                ctypes.get_last_error(),
            )
            return True
        if ctypes.get_last_error() == 183:  # ERROR_ALREADY_EXISTS
            log.info("another instance is already running; activating it")
            _activate_existing_window()
            return False
        return True
    except Exception:
        log.exception("single-instance check failed; continuing anyway")
        return True


class Api:
    def __init__(self) -> None:
        self._window: webview.Window | None = None
        self._window_toggle: HotkeyToggle | None = None

    # ---- 配置 ----
    def _snapshot(self, x=None, y=None, w=None, h=None) -> dict:
        win = self._window
        if win is None:
            return {}
        try:
            return {
                "x": int(win.x if x is None else x),
                "y": int(win.y if y is None else y),
                "width": int(win.width if w is None else w),
                "height": int(win.height if h is None else h),
            }
        except Exception:
            log.warning("could not read the window rectangle", exc_info=True)
            return {}

    def _save(self, **kwargs) -> None:
        data = self._snapshot(**kwargs)
        if data:
            save_config(data)

    # ---- 暴露给 JS ----
    def close(self) -> None:
        log.info("close requested")
        self._save()
        if self._window is not None:
            self._window.destroy()

    def minimize(self) -> None:
        # 走自己的最小化，才能记住唤回时要恢复的矩形
        log.info("minimize requested")
        if self._window_toggle is not None:
            self._window_toggle.minimize()
        elif self._window is not None:
            self._window.minimize()

    def get_ghost_info(self) -> dict:
        """右页详情用：现读用户维护的 Markdown，不改源文件。"""
        return load_ghost_info()


_BACKCOLOR_DONE = False


def apply_book_region(window: webview.Window) -> None:
    """把窗口可见/可点击区域裁成圆角皮面书壳。

    HTML 里 .book 是一整块皮面：宽 min(94vw, 91vh * 895/715)，居中，
    border-radius 1.15%。Window 区域用同一个矩形和同样的圆角比例裁；
    书壳外（窗口四边留白、四角圆角外）保持透明且点击穿透。

    窗体底色用皮革边缘的深棕色。圆角处 CSS 抗锯齿会透出一点窗体底色，
    用奶油色会在书壳外缘形成亮边；深棕和皮革边缘融为一体。
    """
    try:
        from System import Action

        form = window.native

        def _apply() -> None:
            global _BACKCOLOR_DONE
            try:
                if not _BACKCOLOR_DONE:
                    try:
                        from System.Drawing import Color

                        form.BackColor = Color.FromArgb(46, 26, 14)
                        _BACKCOLOR_DONE = True
                    except Exception:
                        log.warning("could not set the form background color", exc_info=True)

                cw = int(form.ClientSize.Width)
                ch = int(form.ClientSize.Height)
                if cw <= 0 or ch <= 0:
                    return

                bw = int(round(min(cw * 0.94, ch * 0.91 * BOOK_ASPECT)))
                bh = int(round(bw / BOOK_ASPECT))
                left = (cw - bw) // 2
                top = (ch - bh) // 2

                gdi32 = ctypes.WinDLL("gdi32", use_last_error=True)
                gdi32.CreateRoundRectRgn.argtypes = (
                    ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int,
                    ctypes.c_int, ctypes.c_int,
                )
                gdi32.CreateRoundRectRgn.restype = wintypes.HRGN
                gdi32.CreateRectRgn.argtypes = (
                    ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int
                )
                gdi32.CreateRectRgn.restype = wintypes.HRGN
                gdi32.DeleteObject.argtypes = (wintypes.HANDLE,)
                gdi32.DeleteObject.restype = wintypes.BOOL
                user32 = ctypes.WinDLL("user32", use_last_error=True)
                user32.SetWindowRgn.argtypes = (wintypes.HWND, wintypes.HRGN, wintypes.BOOL)
                user32.SetWindowRgn.restype = ctypes.c_int

                # CSS 的百分比圆角：水平半径按宽度、垂直半径按高度算。
                # CreateRoundRectRgn 最后两个参数是椭圆直径，所以要乘 2。
                rx = max(1, int(round(bw * COVER_RADIUS)))
                ry = max(1, int(round(bh * COVER_RADIUS)))
                rgn = gdi32.CreateRoundRectRgn(
                    left, top, left + bw, top + bh, rx * 2, ry * 2
                )
                if not rgn:
                    log.warning("CreateRoundRectRgn failed; using a rectangle region")
                    rgn = gdi32.CreateRectRgn(left, top, left + bw, top + bh)
                if not rgn:
                    log.warning("could not create any window region")
                    return
                hwnd = int(form.Handle.ToInt32())
                if not user32.SetWindowRgn(hwnd, rgn, True):
                    log.warning(
                        "SetWindowRgn failed (error=%s)", ctypes.get_last_error()
                    )
                    gdi32.DeleteObject(rgn)
            except Exception:
                log.exception("could not apply the book-shaped window region")

        if form.InvokeRequired:
            form.Invoke(Action(_apply))
        else:
            _apply()
    except Exception:
        log.exception("apply_book_region could not reach the WinForms form")


def main() -> None:
    if not claim_single_instance():
        return

    preflight()

    cfg = load_config()
    w, h = max_window_size()
    x, y = initial_position(w, h, cfg)
    log.info(
        "starting journal: window=%sx%s at %s,%s screen=%sx%s",
        w, h, x, y, *screen_size(),
    )

    api = Api()
    window = webview.create_window(
        WINDOW_TITLE,
        url=INDEX.as_uri(),
        width=w,
        height=h,
        x=x,
        y=y,
        js_api=api,
        min_size=(MIN_W, MIN_H),
        frameless=True,
        easy_drag=False,
        on_top=True,
        resizable=False,
        shadow=False,
        transparent=True,
        background_color="#14100c",
        text_select=False,
        zoomable=False,
    )
    if window is None:
        raise RuntimeError("窗口创建失败。")

    api._window = window
    hotkey: HotkeyToggle | None = None

    # create_window 的宽高按外框算，无边框窗口仍会少掉一圈边框；
    # 显示后再 resize 一次，让实际内容区达到计算出的最大尺寸。
    # 尺寸定下来后再裁窗口区域，并启动全局 Ctrl+J 键。
    def _after_restore() -> None:
        # 游戏在前台时不能走 window.resize()：pywebview 用
        # SetWindowPos(..., SWP_SHOWWINDOW) 实现，会把笔记重新激活、抢走游戏焦点。
        # 矩形已经在 _apply_saved_placement 里用 SWP_NOACTIVATE 原样放回，
        # 这里只需要按新尺寸重裁窗口区域。
        if hotkey is not None and hotkey.game_foreground():
            log.info("skip resize after restore: game keeps focus")
            apply_book_region(window)
            return
        try:
            window.resize(w, h)
        except Exception:
            log.exception("resize after restore failed")
        apply_book_region(window)

    def _fit_window(*_args) -> None:
        nonlocal hotkey
        try:
            window.resize(w, h)
        except Exception:
            log.exception("initial resize failed")
        apply_book_region(window)
        if hotkey is None:
            try:
                hotkey = HotkeyToggle(
                    window,
                    on_minimize=api._save,
                    on_restore=_after_restore,
                )
                api._window_toggle = hotkey
                hotkey.start()
            except Exception:
                # 最小化按钮仍可通过 api._window_toggle 工作；
                # 只是全局 Ctrl+J 不可用，错误已经进日志。
                log.exception("could not start the global hotkey thread")

    window.events.shown += _fit_window

    icon = str(ICON) if ICON.exists() else None
    try:
        webview.start(gui="edgechromium", icon=icon)
    finally:
        if hotkey is not None:
            try:
                hotkey.stop()
                if hotkey.is_alive():
                    hotkey.join(timeout=1.0)
            except Exception:
                log.exception("could not stop the global hotkey thread")
        log.info("journal stopped")


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception:
        _detail = traceback.format_exc()
        log.critical("fatal error\n%s", _detail)
        _lines = _detail.strip().splitlines()
        _fatal(
            "程序启动时发生错误，没能打开。\n\n"
            f"错误：{_lines[-1] if _lines else '未知错误'}\n\n"
            f"完整日志：\n{LOG_PATH}\n\n"
            "如果反复出现，把这个日志文件发给作者就行。"
        )
