# -*- coding: utf-8 -*-
"""真实窗口测试：透明、书页外点击穿透、顶部拖动、Ctrl+J 最小化/唤回。

用法：python tools/test_window_features.py
测试会自己启动一个笔记实例（带 --allow-multi，绕过单实例保护），结束后关闭它。

注意：为了验证书页外是真透明，测试会在窗口左右两侧各垫一小块纯色
（320x400，不是全屏），采样完立即销毁。
"""
from __future__ import annotations

import ctypes
import subprocess
import sys
import time
import tkinter as tk
from ctypes import wintypes
from pathlib import Path

from PIL import ImageGrab

BASE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE))
from layout import BOOK_ASPECT, COVER_RADIUS  # noqa: E402

ASPECT = BOOK_ASPECT
WM_CLOSE = 0x0010
STRIP_HEX = "#00ff00"
STRIP_RGB = (0, 255, 0)
STRIP_W, STRIP_H = 320, 400

try:
    ctypes.windll.shcore.SetProcessDpiAwareness(2)
except Exception:
    pass

user32 = ctypes.WinDLL("user32", use_last_error=True)
user32.GetWindowRect.argtypes = (wintypes.HWND, ctypes.POINTER(wintypes.RECT))
user32.GetWindowRect.restype = wintypes.BOOL
user32.GetClientRect.argtypes = (wintypes.HWND, ctypes.POINTER(wintypes.RECT))
user32.GetClientRect.restype = wintypes.BOOL
user32.ClientToScreen.argtypes = (wintypes.HWND, ctypes.POINTER(wintypes.POINT))
user32.ClientToScreen.restype = wintypes.BOOL
user32.GetWindowThreadProcessId.argtypes = (wintypes.HWND, ctypes.POINTER(wintypes.DWORD))
user32.GetWindowThreadProcessId.restype = wintypes.DWORD
user32.WindowFromPoint.argtypes = (wintypes.POINT,)
user32.WindowFromPoint.restype = wintypes.HWND
user32.GetAncestor.argtypes = (wintypes.HWND, wintypes.UINT)
user32.GetAncestor.restype = wintypes.HWND
user32.IsIconic.argtypes = (wintypes.HWND,)
user32.IsIconic.restype = wintypes.BOOL
user32.ShowWindow.argtypes = (wintypes.HWND, ctypes.c_int)
user32.ShowWindow.restype = wintypes.BOOL
user32.SetWindowPos.argtypes = (
    wintypes.HWND, wintypes.HWND, ctypes.c_int, ctypes.c_int,
    ctypes.c_int, ctypes.c_int, wintypes.UINT,
)
user32.SetWindowPos.restype = wintypes.BOOL
user32.PostMessageW.argtypes = (wintypes.HWND, wintypes.UINT, wintypes.WPARAM, wintypes.LPARAM)
user32.PostMessageW.restype = wintypes.BOOL
user32.SetCursorPos.argtypes = (ctypes.c_int, ctypes.c_int)
user32.SetCursorPos.restype = wintypes.BOOL
user32.GetCursorPos.argtypes = (ctypes.POINTER(wintypes.POINT),)
user32.GetCursorPos.restype = wintypes.BOOL
user32.mouse_event.argtypes = (wintypes.DWORD, wintypes.DWORD, wintypes.DWORD,
                               wintypes.DWORD, ctypes.c_size_t)
user32.keybd_event.argtypes = (wintypes.BYTE, wintypes.BYTE, wintypes.DWORD, ctypes.c_size_t)
user32.GetWindowLongW.argtypes = (wintypes.HWND, ctypes.c_int)
user32.GetWindowLongW.restype = ctypes.c_long

gdi32 = ctypes.WinDLL("gdi32", use_last_error=True)
gdi32.CreateRectRgn.argtypes = (ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int)
gdi32.CreateRectRgn.restype = wintypes.HRGN
gdi32.PtInRegion.argtypes = (wintypes.HRGN, ctypes.c_int, ctypes.c_int)
gdi32.PtInRegion.restype = wintypes.BOOL
gdi32.DeleteObject.argtypes = (wintypes.HANDLE,)
gdi32.DeleteObject.restype = wintypes.BOOL
user32.GetWindowRgn.argtypes = (wintypes.HWND, wintypes.HRGN)
user32.GetWindowRgn.restype = ctypes.c_int

failures = 0


def check(name: str, ok: bool, extra: str = "") -> None:
    global failures
    if ok:
        print(f"  PASS  {name}")
    else:
        failures += 1
        print(f"  FAIL  {name}" + (f"  -> {extra}" if extra else ""))


def root_of(hwnd) -> int:
    return int(user32.GetAncestor(hwnd, 2) or hwnd)


def find_window(pid: int) -> int | None:
    found: list[int] = []

    @ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
    def cb(hwnd, _lparam):
        if not user32.IsWindowVisible(hwnd):
            return True
        p = wintypes.DWORD()
        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(p))
        if p.value != pid:
            return True
        r = wintypes.RECT()
        user32.GetWindowRect(hwnd, ctypes.byref(r))
        if r.right - r.left > 200 and r.bottom - r.top > 200:
            found.append(int(hwnd))
            return False
        return True

    user32.EnumWindows(cb, 0)
    return found[0] if found else None


def rect_of(hwnd):
    r = wintypes.RECT()
    user32.GetWindowRect(hwnd, ctypes.byref(r))
    return r.left, r.top, r.right, r.bottom


def client_origin(hwnd):
    p = wintypes.POINT(0, 0)
    user32.ClientToScreen(hwnd, ctypes.byref(p))
    c = wintypes.RECT()
    user32.GetClientRect(hwnd, ctypes.byref(c))
    return p.x, p.y, c.right, c.bottom


def book_rect(hwnd):
    ox, oy, cw, ch = client_origin(hwnd)
    bw = min(cw * 0.94, ch * 0.91 * ASPECT)
    bh = bw / ASPECT
    left = ox + (cw - bw) / 2
    top = oy + (ch - bh) / 2
    return left, top, bw, bh


def sample(shot, x, y):
    return shot.getpixel((int(x), int(y)))[:3]


def region_contains(hwnd, x, y) -> bool:
    """屏幕坐标点是否在窗口的 SetWindowRgn 区域里。"""
    wl, wt, _wr, _wb = rect_of(hwnd)
    rgn = gdi32.CreateRectRgn(0, 0, 0, 0)
    if not rgn:
        return False
    try:
        if user32.GetWindowRgn(hwnd, rgn) <= 0:
            return False
        return bool(gdi32.PtInRegion(rgn, int(x - wl), int(y - wt)))
    finally:
        gdi32.DeleteObject(rgn)


def raise_over_strips(hwnd) -> None:
    """笔记和垫色块都置顶时，把笔记再抬到垫色块上面（不激活窗口）。"""
    user32.SetWindowPos(hwnd, wintypes.HWND(-1), 0, 0, 0, 0, 0x0002 | 0x0001 | 0x0010)


def hit_at(hwnd, x, y) -> bool:
    h = user32.WindowFromPoint(wintypes.POINT(int(x), int(y)))
    return bool(h) and root_of(h) == hwnd


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


def send_hotkey():
    user32.keybd_event(0x11, 0, 0, 0)  # Ctrl down
    time.sleep(0.03)
    user32.keybd_event(0x4A, 0, 0, 0)  # J down
    time.sleep(0.04)
    user32.keybd_event(0x4A, 0, 2, 0)  # J up
    user32.keybd_event(0x11, 0, 2, 0)  # Ctrl up


def click(hwnd, x, y):
    user32.SetCursorPos(int(x), int(y))
    time.sleep(0.1)
    user32.mouse_event(0x0002, 0, 0, 0, 0)
    time.sleep(0.06)
    user32.mouse_event(0x0004, 0, 0, 0, 0)
    time.sleep(0.4)


def drag(hwnd, x, y, dx, dy):
    before = rect_of(hwnd)
    user32.SetCursorPos(int(x), int(y))
    time.sleep(0.1)
    user32.mouse_event(0x0002, 0, 0, 0, 0)
    time.sleep(0.08)
    steps = 10
    for i in range(1, steps + 1):
        user32.SetCursorPos(int(x + dx * i / steps), int(y + dy * i / steps))
        time.sleep(0.02)
    user32.mouse_event(0x0004, 0, 0, 0, 0)
    time.sleep(0.35)
    return before, rect_of(hwnd)


class Backdrop:
    """只在采样点附近垫两块纯色小方块，避免全屏变色。"""

    def __init__(self) -> None:
        self.root = tk.Tk()
        self.root.withdraw()
        self.strips: list[tk.Toplevel] = []

    def place(self, wl, wt, wr, wb) -> None:
        mid = (wt + wb) // 2
        specs = [
            (max(0, wl - STRIP_W + 80), mid - STRIP_H // 2),
            (wr - 80, mid - STRIP_H // 2),
        ]
        for x, y in specs:
            strip = tk.Toplevel(self.root)
            strip.overrideredirect(True)
            strip.attributes("-topmost", True)
            strip.geometry(f"{STRIP_W}x{STRIP_H}+{x}+{y}")
            strip.configure(bg=STRIP_HEX)
            self.strips.append(strip)
        self.pump()

    def pump(self) -> None:
        try:
            self.root.update()
        except Exception:
            pass

    def destroy(self) -> None:
        try:
            self.root.destroy()
        except Exception:
            pass


def main() -> int:
    pythonw = Path(sys.executable).with_name("pythonw.exe")
    if not pythonw.exists():
        pythonw = Path(sys.executable)

    print("[1] start the journal")
    proc = subprocess.Popen(
        [str(pythonw), "main.py", "--allow-multi"],
        cwd=str(BASE),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    hwnd = None
    for _ in range(120):
        hwnd = find_window(proc.pid)
        if hwnd:
            break
        time.sleep(0.15)
    if not hwnd:
        print("  FAIL  journal window did not appear")
        proc.terminate()
        return 1
    print(f"  info  pid={proc.pid} hwnd={hwnd}")
    time.sleep(2.2)
    wl, wt, wr, wb = rect_of(hwnd)
    print(f"  info  window rect=({wl},{wt},{wr},{wb}) size={wr-wl}x{wb-wt}")

    print("[2] transparency + click-through")
    bg = Backdrop()
    bg.place(wl, wt, wr, wb)
    raise_over_strips(hwnd)
    time.sleep(0.3)
    bg.pump()
    shot = ImageGrab.grab()
    bl, bt, bw, bh = book_rect(hwnd)
    bx, by = bl + bw / 2, bt + bh / 2
    left_pt = (wl + 20, (wt + wb) // 2)
    right_pt = (wr - 20, (wt + wb) // 2)
    check("outside left is transparent", sample(shot, *left_pt) == STRIP_RGB, str(sample(shot, *left_pt)))
    check("outside right is transparent", sample(shot, *right_pt) == STRIP_RGB, str(sample(shot, *right_pt)))
    center_color = sample(shot, bx, by)
    check("book center is opaque paper", center_color != STRIP_RGB and sum(center_color) > 250, str(center_color))
    check("outside clicks hit the backdrop", not hit_at(hwnd, *left_pt) and not hit_at(hwnd, *right_pt))
    check("book clicks hit the journal", hit_at(hwnd, bx, by))
    rx, ry = bw * COVER_RADIUS, bh * COVER_RADIUS
    check("rounded cover corners are cut from the click region",
          not region_contains(hwnd, bl + 2, bt + 2)
          and not region_contains(hwnd, bl + bw - 3, bt + bh - 3))
    check("region keeps the cover's straight edges",
          region_contains(hwnd, bl + 2, bt + bh / 2)
          and region_contains(hwnd, bl + rx + 4, bt + ry + 4))

    print("[2b] topmost follows the foreground window")
    def is_topmost(h) -> bool:
        return bool(user32.GetWindowLongW(wintypes.HWND(h), -20) & 0x8)

    click(hwnd, bx, by)
    check("journal is topmost while focused",
          wait_until(lambda: is_topmost(hwnd), 1.5, pump=bg.pump))
    other = tk.Toplevel(bg.root)
    other.geometry("240x140+40+40")
    other.configure(bg="#202020")
    other.attributes("-topmost", False)
    bg.pump()
    ox, oy = other.winfo_rootx(), other.winfo_rooty()
    ow, oh = other.winfo_width(), other.winfo_height()
    click(hwnd, ox + ow // 2, oy + oh // 2)
    check("journal drops topmost when another app is focused",
          wait_until(lambda: not is_topmost(hwnd), 1.5, pump=bg.pump))
    click(hwnd, bx, by)
    check("journal becomes topmost again when refocused",
          wait_until(lambda: is_topmost(hwnd), 1.5, pump=bg.pump))
    other.destroy()
    bg.pump()

    print("[3] drag the book's top edge")
    cursor = wintypes.POINT()
    user32.GetCursorPos(ctypes.byref(cursor))
    drag_x, drag_y = bl + bw / 2, bt + 30
    # 第一次按下可能只用于激活窗口，先点一下把焦点拿过来
    if root_of(user32.GetForegroundWindow()) != hwnd:
        click(hwnd, drag_x, drag_y)
    check("journal is foreground before dragging",
          root_of(user32.GetForegroundWindow()) == hwnd,
          f"fg={user32.GetForegroundWindow()}")
    before, after = drag(hwnd, drag_x, drag_y, 60, 36)
    moved = (after[0] - before[0], after[1] - before[1])
    check("window follows the drag", abs(moved[0] - 60) <= 4 and abs(moved[1] - 36) <= 4,
          f"moved={moved}")
    # put it back without activating
    user32.SetWindowPos(hwnd, wintypes.HWND(-1), before[0], before[1],
                        before[2] - before[0], before[3] - before[1], 0x0010)
    time.sleep(0.2)
    user32.SetCursorPos(cursor.x, cursor.y)
    bg.pump()

    print("[4] Ctrl+J: minimize then restore")
    bl, bt, bw, bh = book_rect(hwnd)
    click(hwnd, bl + bw / 2, bt + 24)
    check("journal is foreground before pressing Ctrl+J",
          root_of(user32.GetForegroundWindow()) == hwnd,
          f"fg={user32.GetForegroundWindow()}")

    pre = rect_of(hwnd)
    send_hotkey()
    minimized = wait_until(lambda: bool(user32.IsIconic(hwnd)), 2.0, pump=bg.pump)
    check("Ctrl+J minimizes the journal", minimized)

    time.sleep(0.3)
    send_hotkey()
    restored = wait_until(lambda: not user32.IsIconic(hwnd), 2.5, pump=bg.pump)
    check("Ctrl+J restores the journal", restored)
    time.sleep(0.5)
    bg.pump()
    post = rect_of(hwnd)
    check("restore keeps the exact size and position",
          all(abs(post[i] - pre[i]) <= 2 for i in range(4)),
          f"pre={pre} post={post}")
    check("restore returns to the maximum size", post[2] - post[0] >= 1900,
          f"{post[2]-post[0]}x{post[3]-post[1]}")
    check("restore focuses the journal when a normal app was foreground",
          root_of(user32.GetForegroundWindow()) == hwnd,
          f"fg={user32.GetForegroundWindow()}")

    wl, wt, wr, wb = rect_of(hwnd)
    bg.pump()
    shot = ImageGrab.grab()
    bl, bt, bw, bh = book_rect(hwnd)
    edge = (wl + 20, (wt + wb) // 2)
    check("transparency survives minimize/restore",
          sample(shot, *edge) == STRIP_RGB,
          str(sample(shot, *edge)))
    check("click-through survives minimize/restore",
          not hit_at(hwnd, *edge) and hit_at(hwnd, bl + bw / 2, bt + bh / 2))

    print("[4b] external minimize (Win+D / taskbar) then Ctrl+J")
    pre2 = rect_of(hwnd)
    user32.ShowWindow(wintypes.HWND(hwnd), 6)  # SW_MINIMIZE
    ext_min = wait_until(lambda: bool(user32.IsIconic(hwnd)), 2.0, pump=bg.pump)
    check("external minimize works", ext_min)
    time.sleep(0.5)  # 等热键线程按 IsIconic 注册 Ctrl+J
    send_hotkey()
    ext_restored = wait_until(lambda: not user32.IsIconic(hwnd), 2.5, pump=bg.pump)
    check("Ctrl+J restores an externally minimized journal", ext_restored)
    time.sleep(0.4)
    bg.pump()
    post2 = rect_of(hwnd)
    check("external restore keeps the exact rect",
          all(abs(post2[i] - pre2[i]) <= 2 for i in range(4)),
          f"pre={pre2} post={post2}")
    shot = ImageGrab.grab()
    edge2 = (post2[0] + 20, (post2[1] + post2[3]) // 2)
    check("transparency survives external restore",
          sample(shot, *edge2) == STRIP_RGB, str(sample(shot, *edge2)))

    print("[5] close")
    bg.destroy()
    user32.PostMessageW(hwnd, WM_CLOSE, 0, 0)
    exited = wait_until(lambda: proc.poll() is not None, 8.0, 0.1)
    check("window closes cleanly", exited, str(proc.poll()))
    if not exited:
        proc.terminate()

    print(f"\n{'ALL PASS' if failures == 0 else str(failures) + ' FAILURE(S)'}")
    return 0 if failures == 0 else 1


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except SystemExit:
        raise
    except Exception as exc:
        print("TEST ERROR:", exc)
        raise SystemExit(1)
