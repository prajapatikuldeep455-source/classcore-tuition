$ErrorActionPreference = 'Stop'
$src = Join-Path $PSScriptRoot '..\dist\win-unpacked' | Resolve-Path -ErrorAction Stop
$dst = Join-Path $env:USERPROFILE 'Documents\ClassCore\App'
$exe = Join-Path $dst 'ClassCore.exe'

New-Item -ItemType Directory -Force -Path $dst | Out-Null
robocopy $src $dst /MIR /NFL /NDL /NJH /NJS /NC /NS /NP | Out-Null
if ($LASTEXITCODE -gt 7) { throw "Deploy copy failed (robocopy exit $LASTEXITCODE)" }

$sh = New-Object -ComObject WScript.Shell
$shortcuts = @(
  (Join-Path $env:USERPROFILE 'Desktop\ClassCore.lnk'),
  (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\ClassCore.lnk')
)

foreach ($lnk in $shortcuts) {
  $dir = Split-Path $lnk -Parent
  if (!(Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  $sc = $sh.CreateShortcut($lnk)
  $sc.TargetPath = $exe
  $sc.WorkingDirectory = $dst
  $sc.Description = 'ClassCore - Tuition Management'
  $sc.IconLocation = "$exe,0"
  $sc.Save()
  Write-Host "Shortcut: $lnk"
}

Write-Host "Deployed to $dst"
