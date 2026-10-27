param([int]$TargetPid = 0)

Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class WinEnum {
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr l);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern IntPtr GetWindow(IntPtr h, uint cmd);
  [DllImport("user32.dll")] public static extern IntPtr SendMessageTimeout(IntPtr h, uint msg, IntPtr w, IntPtr l, uint flags, uint timeout, out IntPtr result);
}
"@

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
if ($TargetPid -gt 0) {
  $target = $TargetPid
} else {
  $proc = Get-Process pythonw -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $proc) { Write-Output "no pythonw"; exit 1 }
  $target = $proc.Id
}
Write-Output "PID=$target"

$windows = New-Object System.Collections.ArrayList
[WinEnum]::EnumWindows({ param($h, $l)
  $p = 0
  [WinEnum]::GetWindowThreadProcessId($h, [ref]$p) | Out-Null
  if ($p -eq $target) {
    $sb = New-Object System.Text.StringBuilder 512
    [WinEnum]::GetWindowText($h, $sb, 512) | Out-Null
    $vis = [WinEnum]::IsWindowVisible($h)
    $owner = [WinEnum]::GetWindow($h, 4)
    [void]$windows.Add([pscustomobject]@{ Hwnd = $h; Visible = $vis; Owner = $owner; Title = $sb.ToString() })
  }
  return $true
}, [IntPtr]::Zero) | Out-Null

foreach ($w in $windows) {
  $res = [IntPtr]::Zero
  $ok = [WinEnum]::SendMessageTimeout($w.Hwnd, 0, [IntPtr]::Zero, [IntPtr]::Zero, 2, 2000, [ref]$res)
  Write-Output ("HWND={0} visible={1} owner={2} reply={3} title={4}" -f $w.Hwnd, $w.Visible, $w.Owner, $ok, $w.Title)
}
