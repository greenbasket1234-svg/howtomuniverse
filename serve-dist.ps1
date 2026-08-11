param(
  [int]$Port = 3000
)

$ErrorActionPreference = 'Stop'
$Root = Join-Path $PSScriptRoot 'dist'
$Index = Join-Path $Root 'index.html'

if (-not (Test-Path $Index)) {
  Write-Host '[오류] dist\index.html 파일이 없습니다.' -ForegroundColor Red
  Write-Host 'start-dev.cmd를 먼저 실행해 빌드하거나, 전체 압축을 다시 풀어주세요.'
  Read-Host 'Enter 키를 누르면 종료합니다'
  exit 1
}

$listener = New-Object System.Net.HttpListener
$prefix = "http://127.0.0.1:$Port/"
$listener.Prefixes.Add($prefix)

try {
  $listener.Start()
} catch {
  Write-Host "[오류] 포트 $Port 를 열 수 없습니다. 다른 광고관제소 서버가 실행 중인지 확인해주세요." -ForegroundColor Red
  Write-Host $_.Exception.Message
  Read-Host 'Enter 키를 누르면 종료합니다'
  exit 1
}

$mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.js'   = 'text/javascript; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.svg'  = 'image/svg+xml'
  '.png'  = 'image/png'
  '.jpg'  = 'image/jpeg'
  '.jpeg' = 'image/jpeg'
  '.webp' = 'image/webp'
  '.ico'  = 'image/x-icon'
  '.woff' = 'font/woff'
  '.woff2'= 'font/woff2'
}

Write-Host "광고관제소 실행 중: $prefix" -ForegroundColor Green
Write-Host '이 창을 닫으면 서버가 종료됩니다.'

while ($listener.IsListening) {
  try {
    $context = $listener.GetContext()
    $requestPath = [Uri]::UnescapeDataString($context.Request.Url.AbsolutePath.TrimStart('/'))
    if ([string]::IsNullOrWhiteSpace($requestPath)) { $requestPath = 'index.html' }

    $candidate = Join-Path $Root $requestPath
    $fullRoot = [IO.Path]::GetFullPath($Root)
    $fullCandidate = [IO.Path]::GetFullPath($candidate)

    if (-not $fullCandidate.StartsWith($fullRoot, [StringComparison]::OrdinalIgnoreCase)) {
      $context.Response.StatusCode = 403
      $context.Response.Close()
      continue
    }

    if (-not (Test-Path $fullCandidate -PathType Leaf)) {
      $fullCandidate = $Index
    }

    $bytes = [IO.File]::ReadAllBytes($fullCandidate)
    $ext = [IO.Path]::GetExtension($fullCandidate).ToLowerInvariant()
    $contentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }

    $context.Response.StatusCode = 200
    $context.Response.ContentType = $contentType
    $context.Response.Headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    $context.Response.Headers['Pragma'] = 'no-cache'
    $context.Response.Headers['Expires'] = '0'
    $context.Response.ContentLength64 = $bytes.Length
    $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    $context.Response.OutputStream.Close()
  } catch {
    if ($listener.IsListening) {
      try { $context.Response.StatusCode = 500; $context.Response.Close() } catch {}
    }
  }
}
