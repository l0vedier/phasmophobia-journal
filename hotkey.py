# -*- coding: utf-8 -*-
"""全局 Ctrl+J：把笔记最小化 / 唤回；按前台进程切换窗口置顶。

只在三种情况下占用 Ctrl+J：
1. 恐鬼症在前台；
2. 笔记窗口在前台；
3. 笔记已经最小化（这样按 Ctrl+J 能把它叫回来）。

其他程序在前台时不注册，避免在浏览器、聊天框里把 Ctrl+J 吞掉。
置顶也按同一条件：游戏或笔记在前台才置顶，切到其他程序时恢复普通窗口，
笔记不会一直盖在浏览器、聊天框上面。

任务栏按钮：pywebview 的无边框窗口默认没有 WS_MINIMIZEBOX，点任务栏按钮
时 Windows 发出的最小化命令会被忽略。这里补上该样式位（不改变外观），
并保留"游戏置顶时第一次点击直接隐藏"的补刀逻辑。
"""
from __future__ import annotations

import ctypes
import logging
import os
import threading
import time
from ctypes import wintypes

log = logging.getLogger("hotkey")

MOD_CONTROL = 0x0002
MOD_NOREPEAT = 0x4000
WM_HOTKEY = 0x0312
HOTKEY_ID = 0xB10
PM_REMOVE = 0x0001
POLL_INTERVAL = 0.04
SW_MINIMIZE = 6
SW_SHOWNOACTIVATE = 4
SW_RESTORE = 9
SWP_NOSIZE = 0x0001
SWP_NOMOVE = 0x0002
SWP_NOACTIVATE = 0x0010
GA_ROOT = 2
PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
GAME_EXE = "phasmophobia.exe"
TASKBAR_CLASSES = ("shell_traywnd", "shell_secondarytraywnd")
GWL_STYLE = -16
WS_MINIMIZEBOX = 0x00020000


class WINDOWPLACEMENT(ctypes.Structure):
    _fields_ = [
        ("length", wintypes.UINT),
        ("flags", wintypes.UINT),
        ("showCmd", wintypes.UINT),
        ("ptMinPosition", wintypes.POINT),
        ("ptMaxPosition", wintypes.POINT),
        ("rcNormalPosition", wintypes.RECT),
    ]


user32 = ctypes.WinDLL("user32", use_last_error=True)
kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)

user32.RegisterHotKey.argtypes = (wintypes.HWND, ctypes.c_int, wintypes.UINT, wintypes.UINT)
user32.RegisterHotKey.restype = wintypes.BOOL
user32.UnregisterHotKey.argtypes = (wintypes.HWND, ctypes.c_int)
user32.UnregisterHotKey.restype = wintypes.BOOL
user32.PeekMessageW.argtypes = (
    ctypes.POINTER(wintypes.MSG),
    wintypes.HWND,
    wintypes.UINT,
    wintypes.UINT,
    wintypes.UINT,
)
user32.PeekMessageW.restype = wintypes.BOOL
user32.GetForegroundWindow.argtypes = ()
user32.GetForegroundWindow.restype = wintypes.HWND
user32.GetAncestor.argtypes = (wintypes.HWND, wintypes.UINT)
user32.GetAncestor.restype = wintypes.HWND
user32.GetWindowThreadProcessId.argtypes = (wintypes.HWND, ctypes.POINTER(wintypes.DWORD))
user32.GetWindowThreadProcessId.restype = wintypes.DWORD
user32.IsIconic.argtypes = (wintypes.HWND,)
user32.IsIconic.restype = wintypes.BOOL
user32.IsWindowVisible.argtypes = (wintypes.HWND,)
user32.IsWindowVisible.restype = wintypes.BOOL
user32.GetClassNameW.argtypes = (wintypes.HWND, wintypes.LPWSTR, ctypes.c_int)
user32.GetClassNameW.restype = ctypes.c_int
user32.GetWindowLongW.argtypes = (wintypes.HWND, ctypes.c_int)
user32.GetWindowLongW.restype = ctypes.c_long
user32.SetWindowLongW.argtypes = (wintypes.HWND, ctypes.c_int, ctypes.c_long)
user32.SetWindowLongW.restype = ctypes.c_long
user32.GetCursorPos.argtypes = (ctypes.POINTER(wintypes.POINT),)
user32.GetCursorPos.restype = wintypes.BOOL
user32.WindowFromPoint.argtypes = (wintypes.POINT,)
user32.WindowFromPoint.restype = wintypes.HWND
user32.ShowWindow.argtypes = (wintypes.HWND, ctypes.c_int)
user32.ShowWindow.restype = wintypes.BOOL
user32.SetForegroundWindow.argtypes = (wintypes.HWND,)
user32.SetForegroundWindow.restype = wintypes.BOOL
user32.SetWindowPos.argtypes = (
    wintypes.HWND,
    wintypes.HWND,
    ctypes.c_int,
    ctypes.c_int,
    ctypes.c_int,
    ctypes.c_int,
    wintypes.UINT,
)
user32.SetWindowPos.restype = wintypes.BOOL
user32.GetWindowPlacement.argtypes = (wintypes.HWND, ctypes.POINTER(WINDOWPLACEMENT))
user32.GetWindowPlacement.restype = wintypes.BOOL

kernel32.OpenProcess.argtypes = (wintypes.DWORD, wintypes.BOOL, wintypes.DWORD)
kernel32.OpenProcess.restype = wintypes.HANDLE
kernel32.QueryFullProcessImageNameW.argtypes = (
    wintypes.HANDLE,
    wintypes.DWORD,
    wintypes.LPWSTR,
    ctypes.POINTER(wintypes.DWORD),
)
kernel32.QueryFullProcessImageNameW.restype = wintypes.BOOL
kernel32.CloseHandle.argtypes = (wintypes.HANDLE,)
kernel32.CloseHandle.restype = wintypes.BOOL


def _class_name(hwnd: int) -> str:
    buf = ctypes.create_unicode_buffer(128)
    user32.GetClassNameW(wintypes.HWND(hwnd), buf, len(buf))
    return buf.value.lower()


def _process_name(pid: int) -> str | None:
    handle = kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, False, pid)
    if not handle:
        return None
    try:
        buf = ctypes.create_unicode_buffer(1024)
        size = wintypes.DWORD(len(buf))
        if not kernel32.QueryFullProcessImageNameW(handle, 0, buf, ctypes.byref(size)):
            return None
        return os.path.basename(buf.value).lower()
    finally:
        kernel32.CloseHandle(handle)


class HotkeyToggle(threading.Thread):
    """在后台线程里注册 Ctrl+J，并把最小化/恢复送回 UI 线程。"""

    def __init__(self, window, on_minimize=None, on_restore=None) -> None:
        super().__init__(name="journal-hotkey", daemon=True)
        self._window = window
        self._on_minimize = on_minimize
        self._on_restore = on_restore
        self._stop_event = threading.Event()
        self._registered = False
        self._retry_at = 0.0
        self._hwnd: int | None = None
        self._last_pid: int | None = None
        self._last_allowed = False
        self._topmost: bool | None = None
        self._saved_rect: tuple[int, int, int, int] | None = None
        self._last_hotkey_log = 0.0
        self._last_style_log = 0.0
        # 任务栏点击：窗口已经可见且处于"游戏/笔记在前台"的置顶状态时，
        # Windows 第一次点任务栏按钮只会激活窗口，不会最小化。这里自己补一刀。
        self._state_ready = False
        self._last_fg_self = False
        self._last_fg_taskbar = False
        self._last_fg_allowed = False
        self._last_iconic = False
        self._taskbar_seen_at = 0.0
        self._taskbar_prev_allowed = False
        # 任务栏 / Win+D 等外部最小化也记下矩形；它们不走我们的 minimize()
        try:
            window.events.minimized += self._on_minimized
            window.events.restored += self._on_restored
        except Exception:
            log.warning("could not bind minimize/restore events", exc_info=True)

    def stop(self) -> None:
        self._stop_event.set()

    def run(self) -> None:
        log.info("hotkey thread started")
        last_error_log = 0.0
        try:
            while not self._stop_event.is_set():
                try:
                    self._step()
                except Exception:
                    # 单次轮询失败不能杀死整个热键线程；同类错误 5 秒最多记一次。
                    now = time.monotonic()
                    if now - last_error_log >= 5.0:
                        last_error_log = now
                        log.exception("hotkey loop step failed; continuing")
                time.sleep(POLL_INTERVAL)
        finally:
            try:
                self._unregister()
            except Exception:
                log.exception("could not unregister the hotkey")
            log.info("hotkey thread stopped")

    # ---- 后台线程 ----
    def _step(self) -> None:
        hwnd = self._hwnd
        if not hwnd:
            try:
                hwnd = int(self._window.native.Handle.ToInt32())
            except Exception:
                return
            self._hwnd = hwnd

        # 无边框窗口默认没有 WS_MINIMIZEBOX，任务栏按钮的最小化命令会被忽略。
        # 每次轮询顺手补上；样式位被改回去时会自动恢复。
        self._ensure_minimize_box(hwnd)

        now = time.monotonic()
        iconic = bool(user32.IsIconic(hwnd))
        visible = bool(user32.IsWindowVisible(hwnd))
        fg_self, fg_taskbar, fg_allowed = self._foreground_snapshot(hwnd)
        entered = fg_self and not self._last_fg_self

        if not self._state_ready:
            self._last_iconic = iconic
            self._last_fg_self = fg_self
            self._last_fg_taskbar = fg_taskbar
            self._last_fg_allowed = fg_allowed
            self._state_ready = True
        elif (
            entered
            and visible
            and not iconic
            and not self._last_iconic
            # 点之前笔记已经是"游戏/笔记在前台"的置顶状态，才把这次点击当成隐藏；
            # 从浏览器等普通窗口点任务栏叫回笔记时，保持正常的"切到前台"行为。
            and (self._last_fg_allowed or self._taskbar_prev_allowed)
            # 光标还在任务栏上，或刚才扫到过任务栏；最小化状态下恢复则不补刀。
            and (
                fg_taskbar
                or now - self._taskbar_seen_at <= 0.8
                or self._cursor_over_taskbar()
            )
        ):
            self._ui(self._minimize_on_ui)

        # 最小化时始终占用 M，否则叫不回来；
        # 其余时候只在游戏/笔记自己是前台时占用。
        allowed = iconic or fg_allowed
        if allowed and not self._registered and now >= self._retry_at:
            if user32.RegisterHotKey(
                None, HOTKEY_ID, MOD_CONTROL | MOD_NOREPEAT, ord("J")
            ):
                self._registered = True
                log.info("Ctrl+J registered")
            else:
                # 别的程序可能已经占了全局 Ctrl+J；过两秒再试，不要每 40ms 刷一次
                self._retry_at = now + 2.0
                if now - self._last_hotkey_log >= 10.0:
                    self._last_hotkey_log = now
                    log.warning(
                        "RegisterHotKey failed (error=%s); will retry",
                        ctypes.get_last_error(),
                    )
        elif not allowed and self._registered:
            self._unregister()

        # 只有游戏或笔记自己是前台时才置顶；切到别的程序就恢复普通窗口。
        # 最小化期间不动，唤回时由 _apply_saved_placement 按当前前台决定。
        if not iconic:
            if fg_allowed != self._topmost:
                self._set_topmost(fg_allowed)

        # 记录前台历史，供下一次轮询判断"这次激活是不是任务栏点击"。
        if fg_taskbar:
            self._taskbar_seen_at = now
            if not self._last_fg_taskbar:
                self._taskbar_prev_allowed = self._last_fg_allowed
        elif not fg_self:
            # 切到了别的普通程序，之前那次"游戏在前台"的置顶状态就不算数了
            self._taskbar_seen_at = 0.0
            self._taskbar_prev_allowed = False

        self._last_fg_self = fg_self
        self._last_fg_taskbar = fg_taskbar
        self._last_fg_allowed = fg_allowed
        self._last_iconic = iconic

        # 只取本线程的 WM_HOTKEY，不要把线程队列里的其他消息一并吞掉。
        msg = wintypes.MSG()
        while user32.PeekMessageW(
            ctypes.byref(msg), None, WM_HOTKEY, WM_HOTKEY, PM_REMOVE
        ):
            if int(msg.wParam) == HOTKEY_ID:
                # 每次按键都要生效；不要做去抖，快速连按不能被吞掉。
                self._toggle()

    def _foreground_snapshot(self, hwnd: int) -> tuple[bool, bool, bool]:
        fg = user32.GetForegroundWindow()
        if not fg:
            return False, False, False
        root = user32.GetAncestor(fg, GA_ROOT) or fg
        fg_self = int(root) == int(hwnd)
        fg_taskbar = _class_name(root) in TASKBAR_CLASSES
        return fg_self, fg_taskbar, self._allowed_root(root)

    def _foreground_allowed(self) -> bool:
        hwnd = user32.GetForegroundWindow()
        if not hwnd:
            return False
        root = user32.GetAncestor(hwnd, GA_ROOT) or hwnd
        return self._allowed_root(root)

    def game_foreground(self) -> bool:
        """只认游戏在前台，用于恢复时决定要不要把笔记带到前台。

        最小化的一瞬间，前台窗口可能还挂在笔记自己身上；这时不能把它
        当成“游戏在前台”，否则恢复会不抢焦点，测试里的笔记会留在前台。
        """
        hwnd = user32.GetForegroundWindow()
        if not hwnd:
            return False
        root = user32.GetAncestor(hwnd, GA_ROOT) or hwnd
        pid = wintypes.DWORD()
        user32.GetWindowThreadProcessId(wintypes.HWND(root), ctypes.byref(pid))
        if not pid.value:
            return False
        return _process_name(pid.value) == GAME_EXE

    def _allowed_root(self, root) -> bool:
        pid = wintypes.DWORD()
        user32.GetWindowThreadProcessId(wintypes.HWND(root), ctypes.byref(pid))
        if not pid.value:
            return False
        if pid.value == self._last_pid:
            return self._last_allowed

        allowed = pid.value == os.getpid() or _process_name(pid.value) == GAME_EXE
        self._last_pid = pid.value
        self._last_allowed = allowed
        return allowed

    def _ensure_minimize_box(self, hwnd: int) -> None:
        try:
            style = user32.GetWindowLongW(wintypes.HWND(hwnd), GWL_STYLE) & 0xFFFFFFFF
            if not style & WS_MINIMIZEBOX:
                user32.SetWindowLongW(
                    wintypes.HWND(hwnd), GWL_STYLE, style | WS_MINIMIZEBOX
                )
        except Exception:
            now = time.monotonic()
            if now - self._last_style_log >= 10.0:
                self._last_style_log = now
                log.warning("could not add WS_MINIMIZEBOX", exc_info=True)

    def _cursor_over_taskbar(self) -> bool:
        pt = wintypes.POINT()
        if not user32.GetCursorPos(ctypes.byref(pt)):
            return False
        target = user32.WindowFromPoint(pt)
        if not target:
            return False
        root = user32.GetAncestor(target, GA_ROOT) or target
        return _class_name(root) in TASKBAR_CLASSES

    def _on_minimized(self, *_args) -> None:
        # event.set() 在线程里跑处理器，这里只读 Win32 状态，不碰 WinForms
        self._capture_placement()

    def _on_restored(self, *_args) -> None:
        # 外部（任务栏 / Win+D）恢复时，把尺寸、位置和窗口区域纠正回来
        self._ui(self._apply_saved_placement)

    def _capture_placement(self) -> None:
        hwnd = self._hwnd
        if not hwnd:
            return
        try:
            wp = WINDOWPLACEMENT()
            wp.length = ctypes.sizeof(wp)
            if not user32.GetWindowPlacement(wintypes.HWND(hwnd), ctypes.byref(wp)):
                return
            r = wp.rcNormalPosition
            w = int(r.right - r.left)
            h = int(r.bottom - r.top)
            if w > 200 and h > 200:
                self._saved_rect = (int(r.left), int(r.top), w, h)
        except Exception:
            log.warning("could not capture the window placement", exc_info=True)

    def _unregister(self) -> None:
        if self._registered:
            if not user32.UnregisterHotKey(None, HOTKEY_ID):
                log.warning(
                    "UnregisterHotKey failed (error=%s)", ctypes.get_last_error()
                )
            self._registered = False

    def _set_topmost(self, value: bool) -> None:
        def apply() -> None:
            try:
                self._window.native.TopMost = value
                self._topmost = value
            except Exception:
                log.exception("could not change the topmost state")

        self._ui(apply)

    # ---- UI 线程 ----
    def _ui(self, func) -> None:
        try:
            from System import Action

            form = self._window.native
            if form.InvokeRequired:
                form.Invoke(Action(func))
            else:
                func()
        except Exception:
            log.exception("could not marshal a UI action")

    def minimize(self) -> None:
        """给界面上的最小化按钮用。"""
        self._ui(self._minimize_on_ui)

    def _toggle(self) -> None:
        self._ui(self._toggle_on_ui)

    def _toggle_on_ui(self) -> None:
        if not self._hwnd:
            return
        iconic = bool(user32.IsIconic(self._hwnd))
        log.info("toggle (iconic=%s)", iconic)
        if iconic:
            self._restore_on_ui()
        else:
            self._minimize_on_ui()

    def _minimize_on_ui(self) -> None:
        hwnd = self._hwnd
        if not hwnd or user32.IsIconic(hwnd):
            return
        try:
            form = self._window.native
            # 透明窗口首次 resize 是裸 SetWindowPos，WinForms 的 RestoreBounds
            # 还停在创建时的小尺寸。这里自己记住最小化前的矩形，唤回时原样放回去。
            self._saved_rect = (
                int(form.Left),
                int(form.Top),
                int(form.Width),
                int(form.Height),
            )
        except Exception:
            self._saved_rect = None
        if self._on_minimize is not None:
            try:
                self._on_minimize()
            except Exception:
                log.exception("on_minimize callback failed")
        user32.ShowWindow(hwnd, SW_MINIMIZE)

    def _restore_on_ui(self) -> None:
        hwnd = self._hwnd
        if not hwnd:
            return
        if self._saved_rect is None:
            # 外部最小化时没经过 _minimize_on_ui，最小化状态下也能取到原矩形
            self._capture_placement()
        allowed = self.game_foreground()
        log.info("restore (game_foreground=%s)", allowed)
        if allowed:
            # 游戏在前台：恢复但不抢走游戏焦点
            user32.ShowWindow(hwnd, SW_SHOWNOACTIVATE)
        else:
            # 从浏览器/桌面唤回：把笔记带到前台。否则恢复后笔记没有焦点，
            # 热键会立刻注销，用户再按 Ctrl+J 就关不掉了。
            user32.ShowWindow(hwnd, SW_RESTORE)
            user32.SetForegroundWindow(hwnd)
        self._apply_saved_placement()

    def _apply_saved_placement(self) -> None:
        hwnd = self._hwnd
        if not hwnd:
            return
        rect = self._saved_rect
        self._saved_rect = None
        top = self._foreground_allowed()
        # 只有游戏/笔记在前台才置顶，否则按普通窗口放回来
        # （从普通程序唤回时，_restore_on_ui 已经先把笔记带到前台）
        insert_after = wintypes.HWND(-1 if top else -2)  # HWND_TOPMOST / HWND_NOTOPMOST
        if rect:
            user32.SetWindowPos(
                hwnd,
                insert_after,
                rect[0],
                rect[1],
                rect[2],
                rect[3],
                SWP_NOACTIVATE,
            )
        else:
            user32.SetWindowPos(
                hwnd,
                insert_after,
                0,
                0,
                0,
                0,
                SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
            )
        self._topmost = top
        if self._on_restore is not None:
            try:
                self._on_restore()
            except Exception:
                log.exception("on_restore callback failed")
