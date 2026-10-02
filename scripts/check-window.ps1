# Used by the GitHub build (.github/workflows/build.yml) on a Windows computer. Opens the Windows app in the folder
# given, with a window kept bigger than any screen and Neutralino's old saved spot far off the screen (what made the
# window disappear up to 2.9.0). Checks that the window opens inside the screen, closes it like the X button, and
# checks that Lux kept the window's size for next time.
#   pwsh scripts/check-window.ps1 "<folder with LuxManagement.exe>"
param([Parameter(Mandatory)][string]$Dir)
$ErrorActionPreference = 'Stop'
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class LuxWin {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);
}
'@
[LuxWin]::SetProcessDPIAware() | Out-Null
Add-Type -AssemblyName System.Windows.Forms
$area = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea

New-Item -ItemType Directory -Force -Path "$Dir\config", "$Dir\data\people", "$Dir\.tmp" | Out-Null
Set-Content "$Dir\config\settings.json" '{"userId":"u_check","githubUpdates":false,"window":{"width":5000,"height":4000,"maximized":false}}'
Set-Content "$Dir\data\people\u_check.json" '{"name":"Check","createdAt":1}'
Set-Content "$Dir\.tmp\window_state.config.json" '{"x":6000,"y":4000,"width":1320,"height":860,"maximize":false,"minWidth":480,"minHeight":560,"maxWidth":-1,"maxHeight":-1,"resizable":true}'

$p = Start-Process -FilePath "$Dir\LuxManagement.exe" -WorkingDirectory $Dir -PassThru
for ($i = 0; $i -lt 60 -and -not (Test-Path "$Dir\versions\index.json"); $i++) { Start-Sleep -Seconds 2 }
if (-not (Test-Path "$Dir\versions\index.json")) { $p.Kill(); throw 'The Windows app did not open.' }
Start-Sleep -Seconds 3
for ($i = 0; $i -lt 20 -and $p.MainWindowHandle -eq [IntPtr]::Zero; $i++) { Start-Sleep -Milliseconds 500; $p.Refresh() }
$h = $p.MainWindowHandle
$r = New-Object LuxWin+RECT
[LuxWin]::GetWindowRect($h, [ref]$r) | Out-Null
"Lux window: left $($r.Left), top $($r.Top), right $($r.Right), bottom $($r.Bottom). Usable part of the screen: $area"
# Windows 10 and 11 count an invisible resize border of about 7 pixels at the left, right and bottom of a window.
$inside = $r.Left -ge $area.Left - 10 -and $r.Top -ge $area.Top - 1 -and $r.Right -le $area.Right + 10 -and $r.Bottom -le $area.Bottom + 10
if (-not ([LuxWin]::IsWindowVisible($h) -and $inside -and ($r.Right - $r.Left) -ge 400 -and ($r.Bottom - $r.Top) -ge 400)) {
  $p.Kill(); throw 'The Lux window is not on the screen.'
}
if (Test-Path "$Dir\.tmp\window_state.config.json") { $p.Kill(); throw "Neutralino's old window file was not removed." }

# Close it like the X button: Lux saves its data and the window's size, then quits.
[LuxWin]::PostMessage($h, 0x0010, [IntPtr]::Zero, [IntPtr]::Zero) | Out-Null
if (-not $p.WaitForExit(20000)) { $p.Kill(); throw 'Lux did not close.' }
$kept = (Get-Content "$Dir\config\settings.json" -Raw | ConvertFrom-Json).window
"Kept for next time: $($kept | ConvertTo-Json -Compress)"
if (-not $kept -or $kept.width -lt 400 -or $kept.width -gt $area.Width + 20 -or $kept.height -gt $area.Height + 20) { throw 'Lux did not keep the window size.' }
'The Windows app opened on the screen and closed normally.'
