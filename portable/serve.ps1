$ErrorActionPreference = "Stop"
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot "."))
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
Start-Process "http://127.0.0.1:$port/"

while ($listener.IsListening) {
  $context = $listener.GetContext()
  try {
    $raw = [Uri]::UnescapeDataString($context.Request.Url.AbsolutePath)
    if ([string]::IsNullOrWhiteSpace($raw) -or $raw -eq "/") { $raw = "/index.html" }
    $relative = $raw.TrimStart("/").Replace("/", [IO.Path]::DirectorySeparatorChar)
    $full = [IO.Path]::GetFullPath((Join-Path $root $relative))
    $rootPrefix = $root.TrimEnd("\") + "\"
    $inside = $full.Equals($root, [StringComparison]::OrdinalIgnoreCase) -or $full.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)
    if (-not $inside -or -not (Test-Path -LiteralPath $full -PathType Leaf)) {
      $context.Response.StatusCode = 404
      $missing = [Text.Encoding]::UTF8.GetBytes("Not found")
      $context.Response.OutputStream.Write($missing, 0, $missing.Length)
      $context.Response.Close()
      continue
    }
    $ext = [IO.Path]::GetExtension($full).ToLowerInvariant()
    if ($mime.ContainsKey($ext)) { $context.Response.ContentType = $mime[$ext] }
    $bytes = [IO.File]::ReadAllBytes($full)
    $context.Response.ContentLength64 = $bytes.Length
    $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    $context.Response.Close()
  } catch {
    try { $context.Response.Abort() } catch {}
  }
}
