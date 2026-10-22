param([switch]$Move)
$ErrorActionPreference = 'Stop'
$workspace = (Resolve-Path -LiteralPath 'C:\Projects\AIO').Path
$destination = Join-Path $workspace '_artifacts\architecture-quality-audit'
$manifestPath = Join-Path $destination 'original-files.json'
$archivePath = Join-Path $destination 'originals.zip'
$utf8 = [System.Text.UTF8Encoding]::new($false)
$mapping = @(
  @{ old = 'architecture-quality-audit-20261018'; id = '20261018' },
  @{ old = 'architecture-quality-audit-20261019'; id = '20261019' },
  @{ old = 'architecture-quality-audit-20261020'; id = '20261020' },
  @{ old = 'architecture-quality-audit-20261021'; id = '20261021' },
  @{ old = 'architecture-quality-audit-20261021-v5859'; id = '20261021-v5859' }
)
function Assert-InWorkspace([string]$path) {
  $full = [System.IO.Path]::GetFullPath($path)
  if (-not $full.StartsWith($workspace + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Path outside intended workspace: $full"
  }
  return $full
}
[void](Assert-InWorkspace $destination)
[void][System.IO.Directory]::CreateDirectory($destination)
Add-Type -AssemblyName System.IO.Compression.FileSystem
if (Test-Path -LiteralPath $manifestPath) {
  $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
  if ((Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $manifest.archiveSha256) { throw 'Original archive digest mismatch' }
} else {
  if (Test-Path -LiteralPath $archivePath) { throw 'Archive already exists without its manifest; preserve it for inspection' }
  $rows = [System.Collections.Generic.List[object]]::new()
  foreach ($item in $mapping) {
    $source = Assert-InWorkspace (Join-Path $workspace ('_artifacts\' + $item.old))
    $target = Assert-InWorkspace (Join-Path $destination ('evidence\' + $item.id))
    if (-not (Test-Path -LiteralPath $source -PathType Container)) { throw "Missing source: $source" }
    if (Test-Path -LiteralPath $target) { throw "Target must be new: $target" }
    $tree = @(Get-Item -LiteralPath $source) + @(Get-ChildItem -LiteralPath $source -Recurse -Force)
    if ($tree | Where-Object { $_.Attributes -band [System.IO.FileAttributes]::ReparsePoint }) { throw "Refusing linked tree: $source" }
    foreach ($file in ($tree | Where-Object { -not $_.PSIsContainer } | Sort-Object FullName)) {
      $relative = [System.IO.Path]::GetRelativePath($source, $file.FullName).Replace('\', '/')
      $rows.Add([pscustomobject]@{
        originalPath = '_artifacts/' + $item.old + '/' + $relative
        relocatedPath = '_artifacts/architecture-quality-audit/evidence/' + $item.id + '/' + $relative
        archiveEntry = $item.old + '/' + $relative
        bytes = $file.Length
        sha256 = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
      })
    }
  }
  $zip = [System.IO.Compression.ZipFile]::Open($archivePath, [System.IO.Compression.ZipArchiveMode]::Create)
  try {
    foreach ($row in $rows) {
      $inputPath = Assert-InWorkspace (Join-Path $workspace $row.originalPath)
      [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $inputPath, $row.archiveEntry, [System.IO.Compression.CompressionLevel]::Optimal)
    }
  } finally { $zip.Dispose() }
  $zip = [System.IO.Compression.ZipFile]::OpenRead($archivePath)
  try {
    if ($zip.Entries.Count -ne $rows.Count) { throw 'Archive entry count mismatch' }
    foreach ($row in $rows) {
      $entry = $zip.GetEntry($row.archiveEntry)
      if ($null -eq $entry -or $entry.Length -ne $row.bytes) { throw "Archive entry missing/size mismatch: $($row.archiveEntry)" }
      $stream = $entry.Open()
      $hasher = [System.Security.Cryptography.SHA256]::Create()
      try { $actual = [System.Convert]::ToHexString($hasher.ComputeHash($stream)).ToLowerInvariant() } finally { $stream.Dispose(); $hasher.Dispose() }
      if ($actual -ne $row.sha256) { throw "Archive content mismatch: $($row.archiveEntry)" }
    }
  } finally { $zip.Dispose() }
  $manifest = [pscustomobject]@{
    observedAt = [DateTime]::UtcNow.ToString('o')
    sourceDirectories = $mapping
    files = $rows.Count
    bytes = ($rows | Measure-Object -Property bytes -Sum).Sum
    archiveSha256 = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
    boundary = 'Exact original bytes before any relocation or reference correction. Raw JSON/log/TSV evidence is never rewritten.'
    entries = @($rows)
  }
  [System.IO.File]::WriteAllText($manifestPath, ($manifest | ConvertTo-Json -Depth 8) + "`n", $utf8)
}
if (-not $Move) {
  [pscustomobject]@{ files = $manifest.files; bytes = $manifest.bytes; archive = $archivePath; archiveVerified = $true; moved = $false } | ConvertTo-Json
  return
}
# Resolve and check every source/target before moving any directory. No deletion is used.
foreach ($item in $mapping) {
  $source = Assert-InWorkspace (Join-Path $workspace ('_artifacts\' + $item.old))
  $target = Assert-InWorkspace (Join-Path $destination ('evidence\' + $item.id))
  if (-not (Test-Path -LiteralPath $source -PathType Container) -or (Test-Path -LiteralPath $target)) { throw "Invalid move boundary: $source -> $target" }
  foreach ($row in ($manifest.entries | Where-Object { $_.originalPath.StartsWith('_artifacts/' + $item.old + '/') })) {
    $inputPath = Assert-InWorkspace (Join-Path $workspace $row.originalPath)
    if ((Get-FileHash -LiteralPath $inputPath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $row.sha256) { throw "Source changed since backup: $inputPath" }
  }
  if (@(Get-ChildItem -LiteralPath $source -File -Recurse -Force).Count -ne @($manifest.entries | Where-Object { $_.originalPath.StartsWith('_artifacts/' + $item.old + '/') }).Count) { throw "Source tree count changed: $source" }
}
[void][System.IO.Directory]::CreateDirectory((Join-Path $destination 'evidence'))
foreach ($item in $mapping) {
  $source = Assert-InWorkspace (Join-Path $workspace ('_artifacts\' + $item.old))
  $target = Assert-InWorkspace (Join-Path $destination ('evidence\' + $item.id))
  Move-Item -LiteralPath $source -Destination $target
}
foreach ($row in $manifest.entries) {
  $target = Assert-InWorkspace (Join-Path $workspace $row.relocatedPath)
  if ((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant() -ne $row.sha256) { throw "Relocated content mismatch: $target" }
}
[pscustomobject]@{ files = $manifest.files; bytes = $manifest.bytes; archiveVerified = $true; moved = $true; target = $destination } | ConvertTo-Json
