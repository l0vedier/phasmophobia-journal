param(
    [int]$Runs = 8,
    [int]$TimeoutSec = 12,
    [string]$AppDir = "E:\Claude code\phasmophobia-journal"
)

Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes, System.Drawing

Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class WinDiag {
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr l);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr hdc, uint flags);
}
"@

function Find-AppWindow([int]$targetPid) {
    $script:found = [IntPtr]::Zero
    [WinDiag]::EnumWindows({
        param($h, $l)
        $p = 0
        [WinDiag]::GetWindowThreadProcessId($h, [ref]$p) | Out-Null
        if ($p -eq $targetPid -and [WinDiag]::IsWindowVisible($h)) {
            $script:found = $h
            return $false
        }
        return $true
    }, [IntPtr]::Zero) | Out-Null
    return $script:found
}

function Test-PageLoaded([IntPtr]$hwnd) {
    try {
        $root = [System.Windows.Automation.AutomationElement]::FromHandle($hwnd)
        if (-not $root) { return $false }
        $cond = New-Object System.Windows.Automation.PropertyCondition(
            [System.Windows.Automation.AutomationElement]::AutomationIdProperty, "resetBtn")
        $el = $root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $cond)
        return ($null -ne $el)
    } catch {
        return $false
    }
}

function Get-CenterBrightness([IntPtr]$hwnd) {
    $r = New-Object WinDiag+RECT
    [WinDiag]::GetWindowRect($hwnd, [ref]$r) | Out-Null
    $w = $r.Right - $r.Left
    $h = $r.Bottom - $r.Top
    if ($w -le 20 -or $h -le 20) { return -1 }
    $bmp = New-Object System.Drawing.Bitmap $w, $h
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $hdc = $g.GetHdc()
    [WinDiag]::PrintWindow($hwnd, $hdc, 2) | Out-Null
    $g.ReleaseHdc($hdc)
    $g.Dispose()
    $small = New-Object System.Drawing.Bitmap 80, 64
    $gs = [System.Drawing.Graphics]::FromImage($small)
    $gs.DrawImage($bmp, 0, 0, 80, 64)
    $gs.Dispose()
    $sum = 0.0
    for ($y = 0; $y -lt 64; $y++) {
        for ($x = 0; $x -lt 80; $x++) {
            $c = $small.GetPixel($x, $y)
            $sum += (0.299 * $c.R + 0.587 * $c.G + 0.114 * $c.B)
        }
    }
    $small.Dispose()
    $bmp.Dispose()
    return [math]::Round($sum / (80 * 64), 1)
}

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Write-Output ("runs={0} timeout={1}s dir={2}" -f $Runs, $TimeoutSec, $AppDir)

for ($i = 1; $i -le $Runs; $i++) {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $p = Start-Process -FilePath pythonw.exe -ArgumentList "main.py" -WorkingDirectory $AppDir -PassThru

    $hwnd = [IntPtr]::Zero
    $winWait = 0
    while ($winWait -lt $TimeoutSec * 1000) {
        Start-Sleep -Milliseconds 250
        $hwnd = Find-AppWindow $p.Id
        if ($hwnd -ne [IntPtr]::Zero) { break }
        $winWait += 250
    }
    if ($hwnd -eq [IntPtr]::Zero) {
        Write-Output ("{0}: NO WINDOW after {1}s" -f $i, $TimeoutSec)
        Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
        continue
    }

    if ([WinDiag]::IsIconic($hwnd)) { [WinDiag]::ShowWindow($hwnd, 9) | Out-Null }

    $loaded = $false
    $loadMs = -1
    while ($sw.Elapsed.TotalSeconds -lt $TimeoutSec) {
        if (Test-PageLoaded $hwnd) { $loaded = $true; $loadMs = [int]$sw.Elapsed.TotalMilliseconds; break }
        Start-Sleep -Milliseconds 300
    }

    Start-Sleep -Milliseconds 400
    $bright = Get-CenterBrightness $hwnd
    $alive = -not $p.HasExited
    $responding = if ($alive) { $p.Responding } else { $false }

    Write-Output ("{0}: loaded={1} load_ms={2} brightness={3} alive={4} responding={5}" -f $i, $loaded, $loadMs, $bright, $alive, $responding)

    if (-not $p.HasExited) {
        $p.CloseMainWindow() | Out-Null
        $waited = 0
        while (-not $p.HasExited -and $waited -lt 5000) { Start-Sleep -Milliseconds 250; $waited += 250 }
        if (-not $p.HasExited) { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue }
    }
    Start-Sleep -Milliseconds 600
}
