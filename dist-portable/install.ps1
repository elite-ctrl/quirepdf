$ErrorActionPreference = "Stop"
$source = [IO.Path]::GetFullPath($PSScriptRoot)
$dest = Join-Path $env:LOCALAPPDATA "Quire"

if (Test-Path -LiteralPath (Join-Path $dest "quire.port")) {
  Write-Host "Close the black Quire window, then run Install again."
  exit 1
}

Write-Host "Installing Quire..."
New-Item -ItemType Directory -Force -Path $dest | Out-Null
Get-ChildItem -LiteralPath $source -Force | ForEach-Object {
  if ($_.Name -eq "quire.port") { return }
  Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $dest $_.Name) -Recurse -Force
}

. (Join-Path $dest "register.ps1")

$programs = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs"
$desktop = [Environment]::GetFolderPath("Desktop")
$shell = New-Object -ComObject WScript.Shell

function New-QuireShortcut([string]$path, [string]$target, [string]$description) {
  $link = $shell.CreateShortcut($path)
  $link.TargetPath = $target
  $link.WorkingDirectory = $dest
  $link.Description = $description
  $link.Save()
}

New-QuireShortcut (Join-Path $programs "Quire.lnk") (Join-Path $dest "Start Quire.bat") "Quire proof desk"
New-QuireShortcut (Join-Path $desktop "Quire.lnk") (Join-Path $dest "Start Quire.bat") "Quire proof desk"
New-QuireShortcut (Join-Path $programs "Uninstall Quire.lnk") (Join-Path $dest "Uninstall Quire.bat") "Remove Quire"

$uninstallKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\Quire"
New-Item -Path $uninstallKey -Force | Out-Null
Set-ItemProperty -Path $uninstallKey -Name DisplayName -Value "Quire"
Set-ItemProperty -Path $uninstallKey -Name DisplayVersion -Value "1.0"
Set-ItemProperty -Path $uninstallKey -Name Publisher -Value "Quire"
Set-ItemProperty -Path $uninstallKey -Name InstallLocation -Value $dest
Set-ItemProperty -Path $uninstallKey -Name UninstallString -Value ('"{0}"' -f (Join-Path $dest "Uninstall Quire.bat"))
Set-ItemProperty -Path $uninstallKey -Name NoModify -Value 1 -Type DWord
Set-ItemProperty -Path $uninstallKey -Name NoRepair -Value 1 -Type DWord

Write-Host ""
Write-Host "Quire is installed."
Write-Host "It is in the Start menu and on the desktop."
Write-Host "Double-click a PDF to open it here. Leave the black window open while you work."
Write-Host "Remove it later from Start, or from Windows Settings, Apps."
