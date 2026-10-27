# -*- coding: utf-8 -*-
"""针对性测试：任务栏按钮能隐藏笔记（活动窗口 / 游戏前台置顶两种状态），
以及游戏前台时 Ctrl+J 的隐藏 / 唤回。

用法：python tools/test_taskbar_hide.py
测试会自己启动一个笔记实例（带 --allow-multi，绕过单实例保护）、一个假
"phasmophobia.exe" 游戏窗口，以及一个普通 Tk 窗口。只覆盖任务栏和热键相关
行为，不重跑其他测试；运行前仍会检查没有别的笔记实例，避免抢 Ctrl+J。

注意：测试会短暂移动鼠标到任务栏按钮上，结束后恢复原位置。
"""
from __future__ import annotations

import ctypes
import os
import shutil
import subprocess
import sys
import tempfile
import time
import tkinter as tk
from ctypes import wintypes
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
WM_CLOSE = 0x0010
SW_RESTORE = 9
GA_ROOT = 2
GWL_STYLE = -16
WS_MINIMIZEBOX = 0x00020000
CREATE_NO_WINDOW = 0x08000000

try:
    ctypes.windll.shcore.SetProcessDpiAwareness(2)
except Exception:
    pass

user32 = ctypes.WinDLL("user32", use_last_error=True)
kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)

user32.EnumWindows.argtypes = (
    ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM),
    wintypes.LPARAM,
)
user32.GetWindowThreadProcessId.argtypes = (wintypes.HWND, ctypes.POINTER(wintypes.DWORD))
user32.GetWindowThreadProcessId.restype = wintypes.DWORD
user32.IsWindowVisible.argtypes = (wintypes.HWND,)
user32.IsWindowVisible.restype = wintypes.BOOL
user32.IsIconic.argtypes = (wintypes.HWND,)
user32.IsIconic.restype = wintypes.BOOL
user32.GetWindowRect.argtypes = (wintypes.HWND, ctypes.POINTER(wintypes.RECT))
user32.GetWindowRect.restype = wintypes.BOOL
user32.GetWindowLongW.argtypes = (wintypes.HWND, ctypes.c_int)
user32.GetWindowLongW.restype = ctypes.c_long
user32.GetForegroundWindow.restype = wintypes.HWND
user32.GetWindowTextW.argtypes = (wintypes.HWND, wintypes.LPWSTR, ctypes.c_int)
user32.GetWindowTextW.restype = ctypes.c_int
user32.GetAncestor.argtypes = (wintypes.HWND, wintypes.UINT)
user32.GetAncestor.restype = wintypes.HWND
user32.SetCursorPos.argtypes = (ctypes.c_int, ctypes.c_int)
user32.SetCursorPos.restype = wintypes.BOOL
user32.GetCursorPos.argtypes = (ctypes.POINTER(wintypes.POINT),)
user32.GetCursorPos.restype = wintypes.BOOL
user32.AttachThreadInput.argtypes = (wintypes.DWORD, wintypes.DWORD, wintypes.BOOL)
user32.AttachThreadInput.restype = wintypes.BOOL
user32.SetForegroundWindow.argtypes = (wintypes.HWND,)
user32.SetForegroundWindow.restype = wintypes.BOOL
user32.ShowWindow.argtypes = (wintypes.HWND, ctypes.c_int)
user32.ShowWindow.restype = wintypes.BOOL
user32.PostMessageW.argtypes = (wintypes.HWND, wintypes.UINT, wintypes.WPARAM, wintypes.LPARAM)
user32.PostMessageW.restype = wintypes.BOOL
kernel32.GetCurrentThreadId.restype = wintypes.DWORD

failures = 0


def check(name: str, ok: bool, extra: str = "") -> None:
    global failures
    if ok:
        print(f"  PASS  {name}")
    else:
        failures += 1
        print(f"  FAIL  {name}" + (f"  -> {extra}" if extra else ""))


def root_of(hwnd) -> int:
    return int(user32.GetAncestor(hwnd, GA_ROOT) or hwnd)


def foreground_root() -> int:
    return root_of(user32.GetForegroundWindow())


def is_topmost(hwnd) -> bool:
    return bool(user32.GetWindowLongW(wintypes.HWND(hwnd), -20) & 0x8)


def rect_of(hwnd):
    r = wintypes.RECT()
    user32.GetWindowRect(wintypes.HWND(hwnd), ctypes.byref(r))
    return r.left, r.top, r.right, r.bottom


def window_title(hwnd) -> str:
    buf = ctypes.create_unicode_buffer(512)
    user32.GetWindowTextW(wintypes.HWND(hwnd), buf, len(buf))
    return buf.value


def enum_windows():
    found: list[int] = []

    @ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
    def cb(hwnd, _lparam):
        found.append(int(hwnd))
        return True

    user32.EnumWindows(cb, 0)
    return found


def find_window(pid: int, title_contains: str) -> int | None:
    for hwnd in enum_windows():
        p = wintypes.DWORD()
        user32.GetWindowThreadProcessId(wintypes.HWND(hwnd), ctypes.byref(p))
        if p.value != pid or not user32.IsWindowVisible(wintypes.HWND(hwnd)):
            continue
        r = rect_of(hwnd)
        if r[2] - r[0] <= 200:
            continue
        if title_contains in window_title(hwnd):
            return hwnd
    return None


def wait_until(fn, timeout=2.0, step=0.05, pump=None):
    end = time.time() + timeout
    while time.time() < end:
        if pump is not None:
            pump()
        if fn():
            return True
        time.sleep(step)
    if pump is not None:
        pump()
    return fn()


def activate_window(hwnd) -> bool:
    """把测试进程自己的 Tk 窗口拉到前台（不依赖鼠标位置）。"""
    fg = user32.GetForegroundWindow()
    fg_tid = user32.GetWindowThreadProcessId(fg, None)
    cur_tid = kernel32.GetCurrentThreadId()
    attached = user32.AttachThreadInput(cur_tid, fg_tid, True)
    try:
        user32.ShowWindow(wintypes.HWND(hwnd), SW_RESTORE)
        user32.SetForegroundWindow(wintypes.HWND(hwnd))
    finally:
        if attached:
            user32.AttachThreadInput(cur_tid, fg_tid, False)
    return foreground_root() == int(hwnd)


def send_hotkey() -> None:
    user32.keybd_event(0x11, 0, 0, 0)  # Ctrl down
    time.sleep(0.03)
    user32.keybd_event(0x4A, 0, 0, 0)  # J down
    time.sleep(0.04)
    user32.keybd_event(0x4A, 0, 2, 0)  # J up
    user32.keybd_event(0x11, 0, 2, 0)  # Ctrl up


TASKBAR_PS = r"""
param([string]$Match = "", [switch]$Click)
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName Accessibility
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class TB {
  [DllImport("oleacc.dll")] public static extern int AccessibleObjectFromWindow(IntPtr hwnd, uint dwId, ref Guid riid, [MarshalAs(UnmanagedType.Interface)] out object ppvObject);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern IntPtr FindWindow(string cls, string title);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern IntPtr FindWindowEx(IntPtr parent, IntPtr after, string cls, string title);
  public static IntPtr F(IntPtr p, string cls) { return FindWindowEx(p, IntPtr.Zero, cls, null); }
}
"@
$lists = @()
foreach ($cls in @("Shell_TrayWnd", "Shell_SecondaryTrayWnd")) {
  $tray = [TB]::FindWindow($cls, $null)
  if ($tray -eq [IntPtr]::Zero) { continue }
  $list = [TB]::F([TB]::F([TB]::F($tray, "ReBarWindow32"), "MSTaskSwWClass"), "MSTaskListWClass")
  if ($list -ne [IntPtr]::Zero) { $lists += $list }
}
$iid = [Guid]"618736E0-3C3D-11CF-810C-00AA00389B71"
$pick = -1
$fallback = -1
$l = 0; $t = 0; $w = 0; $h = 0
foreach ($list in $lists) {
  $obj = $null
  [void][TB]::AccessibleObjectFromWindow($list, [uint32]4294967292, [ref]$iid, [ref]$obj)
  if ($null -eq $obj) { continue }
  for ($i = 0; $i -lt $obj.accChildCount; $i++) {
    $n = $obj.accName($i)
    if ($Match -ne "" -and $n.Contains($Match)) {
      if ($fallback -lt 0) { $fallback = $i }
      $ll = 0; $tt = 0; $ww = 0; $hh = 0
      try { $obj.accLocation([ref]$ll, [ref]$tt, [ref]$ww, [ref]$hh, $i) } catch {}
      if ($ww -gt 0 -and $hh -gt 0) {
        $pick = $i; $l = $ll; $t = $tt; $w = $ww; $h = $hh
        break
      }
    }
  }
  if ($pick -ge 0) { break }
}
if ($pick -lt 0) { $pick = $fallback }
if ($pick -lt 0) { Write-Output "notfound"; exit 1 }
if ($Click) {
  $obj.accDoDefaultAction($pick)
  Write-Output ("clicked|" + $pick + "|" + $l + "|" + $t + "|" + $w + "|" + $h)
} else {
  Write-Output ("rect|" + $pick + "|" + $l + "|" + $t + "|" + $w + "|" + $h)
}
"""


class Taskbar:
    def __init__(self, path: Path) -> None:
        self.path = path

    def _run(self, match: str, click: bool) -> str:
        args = [
            "powershell", "-NoProfile", "-ExecutionPolicy", "Bypass",
            "-File", str(self.path), "-Match", match,
        ]
        if click:
            args.append("-Click")
        try:
            r = subprocess.run(
                args, capture_output=True, text=True, encoding="utf-8",
                errors="replace", creationflags=CREATE_NO_WINDOW, timeout=20,
            )
            return (r.stdout or "").strip()
        except Exception:
            return ""

    def rect(self, match: str):
        out = self._run(match, False)
        parts = out.split("|")
        if len(parts) != 6 or parts[0] != "rect":
            return None
        return tuple(int(x) for x in parts[2:])

    def click(self, match: str) -> bool:
        out = self._run(match, True)
        return out.startswith("clicked|")


def make_fake_game(tmp: Path):
    """复制一份 pythonw.exe 并改名成 phasmophobia.exe，让它显示 Tk 窗口。"""
    exe_dir = Path(sys.executable).parent
    pyw = exe_dir / "pythonw.exe"
    if not pyw.exists():
        pyw = Path(sys.executable)
    target = tmp / "phasmophobia.exe"
    shutil.copy2(pyw, target)
    for name in (
        f"python{sys.version_info.major}{sys.version_info.minor}.dll",
        "python3.dll", "vcruntime140.dll", "vcruntime140_1.dll",
    ):
        src = exe_dir / name
        if src.exists():
            shutil.copy2(src, tmp / name)
    title = f"Fake Phasmophobia {os.getpid()}"
    (tmp / "fake_game.py").write_text(
        "import tkinter as tk\n"
        "root = tk.Tk()\n"
        f"root.title({title!r})\n"
        'root.geometry("420x260+60+60")\n'
        'root.configure(bg="#202020")\n'
        "root.mainloop()\n",
        encoding="utf-8",
    )
    env = os.environ.copy()
    env["PYTHONHOME"] = str(exe_dir)
    tcl = exe_dir / "tcl"
    env["TCL_LIBRARY"] = str(tcl / "tcl8.6")
    env["TK_LIBRARY"] = str(tcl / "tk8.6")
    proc = subprocess.Popen(
        [str(target), str(tmp / "fake_game.py")],
        env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        creationflags=CREATE_NO_WINDOW,
    )
    return proc, title


def main() -> int:
    existing = [
        h for h in enum_windows()
        if window_title(h).startswith("恐鬼症笔记")
        and user32.IsWindowVisible(wintypes.HWND(h))
        and rect_of(h)[2] - rect_of(h)[0] > 200
    ]
    if existing:
        check("no other journal instance is running", False,
              f"close it first (found hwnd={existing})")
        return 1

    tmp = Path(tempfile.mkdtemp(prefix="journal-taskbar-"))
    app = None
    game = None
    tk_other = None
    orig_cursor = wintypes.POINT()
    user32.GetCursorPos(ctypes.byref(orig_cursor))
    try:
        print("[1] start the journal, fake game and a normal Tk window")
        pythonw = Path(sys.executable).with_name("pythonw.exe")
        if not pythonw.exists():
            pythonw = Path(sys.executable)
        app = subprocess.Popen(
            [str(pythonw), "main.py", "--allow-multi"], cwd=str(BASE),
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            creationflags=CREATE_NO_WINDOW,
        )
        hwnd = None
        for _ in range(120):
            hwnd = find_window(app.pid, "恐鬼症笔记")
            if hwnd:
                break
            time.sleep(0.15)
        if not hwnd:
            check("journal window appears", False)
            return 1
        print(f"  info  pid={app.pid} hwnd={hwnd}")
        check("journal window has WS_MINIMIZEBOX",
              wait_until(
                  lambda: bool(
                      user32.GetWindowLongW(wintypes.HWND(hwnd), GWL_STYLE)
                      & WS_MINIMIZEBOX
                  ),
                  2.0,
              ))

        game, game_title = make_fake_game(tmp)
        game_hwnd = None
        for _ in range(80):
            game_hwnd = find_window(game.pid, game_title)
            if game_hwnd:
                break
            time.sleep(0.1)
        if not game_hwnd:
            check("fake game window appears", False)
            return 1
        print(f"  info  fake game pid={game.pid} hwnd={game_hwnd}")

        other_title = f"Journal Test Other {os.getpid()}"
        tk_other = tk.Tk()
        tk_other.title(other_title)
        tk_other.geometry("240x140+40+40")
        tk_other.configure(bg="#202020")
        tk_other.update()
        other_hwnd = find_window(os.getpid(), other_title)
        if not other_hwnd:
            check("Tk other window appears", False)
            return 1
        print(f"  info  other hwnd={other_hwnd}")

        time.sleep(2.0)
        taskbar = Taskbar(tmp / "taskbar_action.ps1")
        taskbar.path.write_text(TASKBAR_PS, encoding="ascii")

        button = None
        for _ in range(30):
            button = taskbar.rect("恐鬼症笔记")
            if button:
                break
            time.sleep(0.1)
        check("journal taskbar button is available", button is not None, str(button))
        if not button:
            return 1
        bx, by, bw, bh = button
        button_center = (bx + bw // 2, by + bh // 2)
        print(f"  info  taskbar button rect={button}")
        check("fake game taskbar button is available",
              taskbar.rect(game_title) is not None)

        print("[2] clicking the taskbar button from a normal app brings it forward")
        check("activate the normal Tk window", activate_window(other_hwnd),
              f"fg={foreground_root()}")
        tk_other.update()
        check("journal is not topmost while a normal app is focused",
              wait_until(lambda: not is_topmost(hwnd), 1.5, pump=tk_other.update))
        user32.SetCursorPos(*button_center)
        time.sleep(0.1)
        check("taskbar click is delivered", taskbar.click("恐鬼症笔记"))
        came_forward = wait_until(lambda: foreground_root() == hwnd, 2.0, pump=tk_other.update)
        check("a normal app's taskbar click brings the journal forward", came_forward,
              f"fg={foreground_root()} iconic={bool(user32.IsIconic(hwnd))}")
        time.sleep(0.5)
        check("bring-forward click does not hide the journal",
              not user32.IsIconic(hwnd))

        print("[2b] clicking the active journal's taskbar button hides it")
        check("journal is foreground after the bring-forward click",
              foreground_root() == hwnd, f"fg={foreground_root()}")
        check("active taskbar click is delivered", taskbar.click("恐鬼症笔记"))
        check("taskbar click on the active journal hides it",
              wait_until(lambda: bool(user32.IsIconic(hwnd)), 1.5,
                         pump=tk_other.update))
        check("minimized journal is restored before the next case",
              taskbar.click("恐鬼症笔记")
              and wait_until(lambda: not user32.IsIconic(hwnd), 2.0,
                             pump=tk_other.update))

        print("[3] first taskbar click hides the topmost journal above the game")
        check("activate the fake game", taskbar.click(game_title))
        game_front = wait_until(
            lambda: foreground_root() == game_hwnd and is_topmost(hwnd),
            2.0, pump=tk_other.update,
        )
        check("game foreground keeps the journal topmost and visible",
              game_front and not user32.IsIconic(hwnd),
              f"fg={foreground_root()} top={is_topmost(hwnd)}")

        print("[3b] Ctrl+J hides and restores above the game")
        send_hotkey()
        check("Ctrl+J hides the topmost journal above the game",
              wait_until(lambda: bool(user32.IsIconic(hwnd)), 1.5,
                         pump=tk_other.update))
        time.sleep(0.45)
        send_hotkey()
        restored_game = wait_until(lambda: not user32.IsIconic(hwnd), 2.0,
                                   pump=tk_other.update)
        time.sleep(0.2)
        check("Ctrl+J restores without stealing the game's focus",
              restored_game and foreground_root() == game_hwnd,
              f"fg={foreground_root()}")

        print("[3c] rapid Ctrl+J presses are not swallowed")
        time.sleep(0.5)
        send_hotkey()
        time.sleep(0.10)
        send_hotkey()
        time.sleep(0.8)
        check("two rapid Ctrl+J presses both take effect (hidden then shown)",
              not user32.IsIconic(hwnd) and foreground_root() == game_hwnd,
              f"iconic={bool(user32.IsIconic(hwnd))} fg={foreground_root()}")

        before_hide = rect_of(hwnd)
        user32.SetCursorPos(*button_center)
        time.sleep(0.1)
        check("hide taskbar click is delivered", taskbar.click("恐鬼症笔记"))
        hidden = wait_until(lambda: bool(user32.IsIconic(hwnd)), 1.5, pump=tk_other.update)
        check("first taskbar click hides the journal", hidden)
        time.sleep(0.3)
        check("hiding does not steal the game's focus",
              foreground_root() == game_hwnd, f"fg={foreground_root()}")

        print("[4] clicking again restores it and does not bounce back")
        check("restore taskbar click is delivered", taskbar.click("恐鬼症笔记"))
        restored = wait_until(lambda: not user32.IsIconic(hwnd), 2.0, pump=tk_other.update)
        check("taskbar click restores a minimized journal", restored)
        time.sleep(0.8)
        tk_other.update()
        check("restored journal stays visible", not user32.IsIconic(hwnd))
        after = rect_of(hwnd)
        check("restore keeps the previous rect",
              all(abs(after[i] - before_hide[i]) <= 2 for i in range(4)),
              f"before={before_hide} after={after}")

        return 0 if failures == 0 else 1
    finally:
        user32.SetCursorPos(orig_cursor.x, orig_cursor.y)
        if tk_other is not None:
            try:
                tk_other.destroy()
            except Exception:
                pass
        if game is not None:
            try:
                game.terminate()
                game.wait(timeout=5)
            except Exception:
                pass
        if app is not None:
            hwnd = find_window(app.pid, "恐鬼症笔记")
            if hwnd:
                user32.PostMessageW(wintypes.HWND(hwnd), WM_CLOSE, 0, 0)
            try:
                app.wait(timeout=8)
            except Exception:
                try:
                    app.terminate()
                except Exception:
                    pass
        try:
            shutil.rmtree(tmp)
        except Exception:
            pass
        print(f"\n{'ALL PASS' if failures == 0 else str(failures) + ' FAILURE(S)'}")


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except SystemExit:
        raise
    except Exception as exc:
        print("TEST ERROR:", exc)
        raise SystemExit(1)
