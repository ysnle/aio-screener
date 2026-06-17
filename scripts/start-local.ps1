param(
  [int]$Port = 8765,
  [string]$Bind = '127.0.0.1'
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$bundledPython = 'C:\Users\zmfhd\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
if (Test-Path -LiteralPath $bundledPython) {
  $python = $bundledPython
} else {
  $python = Get-Command py, python -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty Source -First 1
  if (-not $python) {
    throw 'Python executable not found. Install Python or update scripts/start-local.ps1 with its absolute path.'
  }
}

Set-Location -LiteralPath $projectRoot
Write-Host "AIO local server: http://${Bind}:$Port/"
Write-Host "Serving: $projectRoot"
Write-Host 'Stop with Ctrl+C.'
& $python -m http.server $Port --bind $Bind
