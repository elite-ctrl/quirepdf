$ErrorActionPreference = "Continue"
$dest = [IO.Path]::GetFullPath($PSScriptRoot)

if (Test-Path -LiteralPath (Join-Path $dest "quire.port")) {
  Write-Host "Close the black Quire window, then run Uninstall again."
  exit 1
}

Write-Host "Removing Quire..."
Remove-Item -LiteralPath "HKCU:\Software\Classes\Quire.pdf" -Recurse -Force -ErrorAction SilentlyContinue
Remove-ItemProperty -Path "HKCU:\Software\Classes\.pdf\OpenWithProgids" -Name "Quire.pdf" -ErrorAction SilentlyContinue
Remove-Item -LiteralPath "HKCU:\Software\Quire" -Recurse -Force -ErrorAction SilentlyContinue
Remove-ItemProperty -Path "HKCU:\Software\RegisteredApplications" -Name "Quire" -ErrorAction SilentlyContinue
Remove-Item -LiteralPath "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\Quire" -Recurse -Force -ErrorAction SilentlyContinue

$programs = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs"
$desktop = [Environment]::GetFolderPath("Desktop")
Remove-Item -LiteralPath (Join-Path $programs "Quire.lnk") -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath (Join-Path $programs "Uninstall Quire.lnk") -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath (Join-Path $desktop "Quire.lnk") -Force -ErrorAction SilentlyContinue

$cleanup = Join-Path $env:TEMP "quire-uninstall.ps1"
@(
  "Start-Sleep -Seconds 2"
  "Remove-Item -LiteralPath '$dest' -Recurse -Force -ErrorAction SilentlyContinue"
) | Set-Content -LiteralPath $cleanup -Encoding UTF8
Start-Process -FilePath "powershell.exe" -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $cleanup) -WindowStyle Hidden
Write-Host "Quire is removed. PDF files go back to whatever you choose in Windows Settings."
