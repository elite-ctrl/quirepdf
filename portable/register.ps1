$ErrorActionPreference = "Stop"
$bat = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot "Start Quire.bat"))
if (-not (Test-Path -LiteralPath $bat)) {
  Write-Host "Start Quire.bat is missing. Keep these files in the same folder."
  exit 1
}

$command = 'cmd.exe /c ""' + $bat + '" "%1""'
[Microsoft.Win32.Registry]::SetValue("HKEY_CURRENT_USER\Software\Classes\Quire.pdf", "", "Quire PDF")
[Microsoft.Win32.Registry]::SetValue("HKEY_CURRENT_USER\Software\Classes\Quire.pdf\shell\open\command", "", $command)
[Microsoft.Win32.Registry]::SetValue("HKEY_CURRENT_USER\Software\Classes\.pdf\OpenWithProgids", "Quire.pdf", "")
[Microsoft.Win32.Registry]::SetValue("HKEY_CURRENT_USER\Software\Quire\Capabilities", "ApplicationName", "Quire")
[Microsoft.Win32.Registry]::SetValue("HKEY_CURRENT_USER\Software\Quire\Capabilities", "ApplicationDescription", "Quire proof desk")
[Microsoft.Win32.Registry]::SetValue("HKEY_CURRENT_USER\Software\Quire\Capabilities\FileAssociations", ".pdf", "Quire.pdf")
[Microsoft.Win32.Registry]::SetValue("HKEY_CURRENT_USER\Software\RegisteredApplications", "Quire", "Software\Quire\Capabilities")

Write-Host "Quire can open PDF files."
try {
  $ui = New-Object -ComObject ApplicationAssociationRegistrationUI
  $ui.LaunchAdvancedAssociationUI("Quire")
  Write-Host "Tick PDF, then confirm. After that, double-click a PDF to open it in Quire."
} catch {
  Start-Process "ms-settings:defaultapps"
  Write-Host "Windows Settings is open. Set .pdf to Quire. Then double-click a PDF."
}
