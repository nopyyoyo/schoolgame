# Regenerates app/attack-effects.js by scanning every subfolder of app/Attack Effect.
# Each subfolder must contain frame_01.png, frame_02.png, ... and a metadata.json with
# at least: { "frames": <int>, "cell_size": [width, height] }.
#
# Run this any time you add/remove/rename an effect folder, then refresh the browser
# (hard refresh / bump cache-busting version if needed). No other code changes required.
#
# Usage: powershell -File tools\build-attack-effects.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$effectsDir = Join-Path $root "app\Attack Effect"
$outFile = Join-Path $root "app\attack-effects.js"

$folders = Get-ChildItem -Path $effectsDir -Directory | Sort-Object Name

$entries = @()
foreach ($folder in $folders) {
    $metaPath = Join-Path $folder.FullName "metadata.json"
    if (-not (Test-Path $metaPath)) {
        Write-Warning "Skipping '$($folder.Name)': no metadata.json found."
        continue
    }
    $meta = Get-Content $metaPath -Raw | ConvertFrom-Json

    $frameFiles = Get-ChildItem -Path $folder.FullName -Filter "frame_*.png"
    $frameCount = $frameFiles.Count
    if ($meta.frames -and $meta.frames -ne $frameCount) {
        Write-Warning "'$($folder.Name)': metadata.json says $($meta.frames) frames but found $frameCount frame_*.png files. Using actual file count."
    }
    if ($frameCount -eq 0) {
        Write-Warning "Skipping '$($folder.Name)': no frame_*.png files found."
        continue
    }

    $width = $meta.cell_size[0]
    $height = $meta.cell_size[1]

    $entries += [PSCustomObject]@{
        folder = $folder.Name
        frames = $frameCount
        width  = $width
        height = $height
    }
}

$lines = @("window.ATTACK_EFFECTS = [")
for ($i = 0; $i -lt $entries.Count; $i++) {
    $e = $entries[$i]
    $comma = if ($i -lt $entries.Count - 1) { "," } else { "" }
    $lines += "  {"
    $lines += "    ""folder"": ""$($e.folder)"","
    $lines += "    ""frames"": $($e.frames),"
    $lines += "    ""width"": $($e.width),"
    $lines += "    ""height"": $($e.height)"
    $lines += "  }$comma"
}
$lines += "];"

$lines -join "`r`n" | Set-Content -Path $outFile -Encoding UTF8

Write-Host "Wrote $($entries.Count) effect entries to $outFile"
