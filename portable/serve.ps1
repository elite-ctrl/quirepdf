param(
  [string]$PdfPath
)

$ErrorActionPreference = "Stop"
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot "."))
$portFile = Join-Path $root "quire.port"
$script:launchName = ""
$script:launchBytes = $null
$script:launchToken = 0
$script:gate = [guid]::NewGuid().ToString("n")

function Set-Launch([string]$path) {
  if ([string]::IsNullOrWhiteSpace($path)) { return $false }
  $path = $path.Trim().Trim('"')
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { return $false }
  if ([IO.Path]::GetExtension($path).ToLowerInvariant() -ne ".pdf") { return $false }
  $script:launchName = [IO.Path]::GetFileName($path)
  $script:launchBytes = [IO.File]::ReadAllBytes($path)
  $script:launchToken += 1
  return $true
}

function Send-Raw($context, [int]$code, $bytes, [string]$type) {
  $context.Response.StatusCode = $code
  $context.Response.Headers["Cache-Control"] = "no-store"
  if ($type) { $context.Response.ContentType = $type }
  if ($null -ne $bytes -and $bytes.Length -gt 0) {
    $context.Response.ContentLength64 = $bytes.Length
    $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  }
  $context.Response.Close()
}

if (Test-Path -LiteralPath $portFile) {
  $existing = (Get-Content -LiteralPath $portFile -Raw).Trim()
  if ($existing -match '^(\d+)\s+(\S+)$') {
    $oldPort = $Matches[1]
    $oldGate = $Matches[2]
    try {
      if ($PdfPath) {
        Invoke-WebRequest -Method Post -Uri "http://127.0.0.1:$oldPort/__quire/open" -Headers @{ "X-Quire-Token" = $oldGate } -Body ([Text.Encoding]::UTF8.GetBytes($PdfPath)) -ContentType "text/plain; charset=utf-8" -UseBasicParsing -TimeoutSec 3 | Out-Null
        Start-Process "http://127.0.0.1:$oldPort/#launch"
      } else {
        Start-Process "http://127.0.0.1:$oldPort/"
      }
      exit 0
    } catch {
      Remove-Item -LiteralPath $portFile -Force -ErrorAction SilentlyContinue
    }
  }
}

if ($PdfPath -and -not (Set-Launch $PdfPath)) {
  Write-Host "That file is not a PDF Quire can open."
}

$listener = New-Object System.Net.HttpListener
$port = 0
foreach ($candidate in 47321..47340) {
  try {
    $listener.Prefixes.Add("http://127.0.0.1:$candidate/")
    $listener.Start()
    $port = $candidate
    break
  } catch {
    $listener = New-Object System.Net.HttpListener
  }
}
if ($port -eq 0) {
  Write-Host "Quire could not open a local address. Close the other Quire window and try again."
  exit 1
}

Set-Content -LiteralPath $portFile -Value "$port $($script:gate)" -Encoding ascii

$mime = @{
  ".html" = "text/html; charset=utf-8"
  ".js"   = "text/javascript; charset=utf-8"
  ".mjs"  = "text/javascript; charset=utf-8"
  ".css"  = "text/css; charset=utf-8"
  ".svg"  = "image/svg+xml"
  ".json" = "application/json"
  ".woff" = "font/woff"
  ".woff2" = "font/woff2"
  ".ttf"  = "font/ttf"
  ".pfb"  = "application/octet-stream"
  ".bcmap" = "application/octet-stream"
  ".jpg"  = "image/jpeg"
  ".png"  = "image/png"
  ".txt"  = "text/plain; charset=utf-8"
}

Write-Host "Quire is open in your browser."
Write-Host "Leave this window open. Close it when you are finished."
Write-Host "Address: http://127.0.0.1:$port/"
if ($script:launchToken -gt 0) {
  Start-Process "http://127.0.0.1:$port/#launch"
} else {
  Start-Process "http://127.0.0.1:$port/"
}

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    try {
      $route = $context.Request.Url.AbsolutePath
      if ($route -eq "/__quire/launch.json") {
        if ($script:launchToken -lt 1 -or $null -eq $script:launchBytes) {
          Send-Raw $context 204 $null "application/json"
        } else {
          $json = @{ name = $script:launchName; token = $script:launchToken } | ConvertTo-Json -Compress
          Send-Raw $context 200 ([Text.Encoding]::UTF8.GetBytes($json)) "application/json; charset=utf-8"
        }
        continue
      }
      if ($route -eq "/__quire/launch.pdf") {
        if ($null -eq $script:launchBytes) {
          Send-Raw $context 404 ([Text.Encoding]::UTF8.GetBytes("Not found")) "text/plain; charset=utf-8"
        } else {
          Send-Raw $context 200 $script:launchBytes "application/pdf"
        }
        continue
      }
      if ($route -eq "/__quire/open" -and $context.Request.HttpMethod -eq "POST") {
        $given = $context.Request.Headers["X-Quire-Token"]
        if ($given -ne $script:gate) {
          Send-Raw $context 403 ([Text.Encoding]::UTF8.GetBytes("No")) "text/plain; charset=utf-8"
          continue
        }
        $reader = New-Object IO.StreamReader($context.Request.InputStream, [Text.Encoding]::UTF8)
        $posted = $reader.ReadToEnd()
        if ($posted.Length -gt 4000 -or -not (Set-Launch $posted)) {
          Send-Raw $context 400 ([Text.Encoding]::UTF8.GetBytes("Not a PDF")) "text/plain; charset=utf-8"
          continue
        }
        Send-Raw $context 204 $null ""
        continue
      }

      $raw = [Uri]::UnescapeDataString($route)
      if ([string]::IsNullOrWhiteSpace($raw) -or $raw -eq "/") { $raw = "/index.html" }
      $relative = $raw.TrimStart("/").Replace("/", [IO.Path]::DirectorySeparatorChar)
      $full = [IO.Path]::GetFullPath((Join-Path $root $relative))
      $rootPrefix = $root.TrimEnd("\") + "\"
      $inside = $full.Equals($root, [StringComparison]::OrdinalIgnoreCase) -or $full.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)
      if (-not $inside -or -not (Test-Path -LiteralPath $full -PathType Leaf)) {
        Send-Raw $context 404 ([Text.Encoding]::UTF8.GetBytes("Not found")) "text/plain; charset=utf-8"
        continue
      }
      $ext = [IO.Path]::GetExtension($full).ToLowerInvariant()
      $type = ""
      if ($mime.ContainsKey($ext)) { $type = $mime[$ext] }
      Send-Raw $context 200 ([IO.File]::ReadAllBytes($full)) $type
    } catch {
      try { $context.Response.Abort() } catch {}
    }
  }
} finally {
  try { $listener.Stop() } catch {}
  Remove-Item -LiteralPath $portFile -Force -ErrorAction SilentlyContinue
}
