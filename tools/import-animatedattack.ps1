# One-off importer: converts the purchased "AnimatedAttack" effect pack
# (app/Attack Effect/AnimatedAttack/<name>/PNG(S)/<name>_NN.png, full-canvas
# transparent frames) into our standard effect-folder format:
#   app/Attack Effect/<NN>_<Name>/frame_01.png, frame_02.png, ..., metadata.json
#
# Steps per effect:
#   1. Load all frames.
#   2. Compute ONE shared bounding box of non-transparent pixels across all
#      frames (so the animation doesn't jump around when frames are cropped).
#   3. Crop every frame to that shared box.
#   4. Downscale (if needed) so the longer edge is at most $MaxDim, keeping
#      aspect ratio, so effects render at a similar on-screen scale to the
#      existing 64 effects (which are tiny ~32-48px source cells shown at 3x).
#   5. Save frame_NN.png + metadata.json into a new numbered folder.
#
# Usage: powershell -File tools\import-animatedattack.ps1

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$effectsDir = Join-Path $root "app\Attack Effect"
$sourceDir = Join-Path $effectsDir "AnimatedAttack"
$MaxDim = 130   # matches the largest existing effect cell dimension (~150)

# name-as-it-should-appear -> source subfolder name under AnimatedAttack
$effects = @(
    @{ Display = "PunchStrike";     Folder = "punch" },
    @{ Display = "Strike";          Folder = "strike" },
    @{ Display = "Uppercut";        Folder = "uppercut" },
    @{ Display = "SlashEffect";     Folder = "slash" },
    @{ Display = "PunchBlast";      Folder = "punch_blast" },
    @{ Display = "HorizontalSlash"; Folder = "horizontal_slash" },
    @{ Display = "PunchAction";     Folder = "punch_action" },
    @{ Display = "SlashSlam";       Folder = "slash_slam" }
)

# Find the highest existing numeric prefix among current effect folders.
$existing = Get-ChildItem -Path $effectsDir -Directory | Where-Object { $_.Name -match '^(\d+)_' }
$maxNum = 0
foreach ($e in $existing) {
    $n = [int]($e.Name -replace '^(\d+)_.*', '$1')
    if ($n -gt $maxNum) { $maxNum = $n }
}

function Get-AlphaBounds([System.Drawing.Bitmap[]]$bitmaps) {
    $minX = [int]::MaxValue; $minY = [int]::MaxValue
    $maxX = -1; $maxY = -1
    foreach ($bmp in $bitmaps) {
        $rect = New-Object System.Drawing.Rectangle 0, 0, $bmp.Width, $bmp.Height
        $data = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $stride = $data.Stride
        $bytes = New-Object byte[] ($stride * $bmp.Height)
        [System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $bytes, 0, $bytes.Length)
        $bmp.UnlockBits($data)
        for ($y = 0; $y -lt $bmp.Height; $y++) {
            $rowOffset = $y * $stride
            for ($x = 0; $x -lt $bmp.Width; $x++) {
                $alpha = $bytes[$rowOffset + $x * 4 + 3]
                if ($alpha -gt 8) {
                    if ($x -lt $minX) { $minX = $x }
                    if ($y -lt $minY) { $minY = $y }
                    if ($x -gt $maxX) { $maxX = $x }
                    if ($y -gt $maxY) { $maxY = $y }
                }
            }
        }
    }
    if ($maxX -lt 0) { throw "No non-transparent pixels found." }
    return @{ X = $minX; Y = $minY; Width = ($maxX - $minX + 1); Height = ($maxY - $minY + 1) }
}

$nextNum = $maxNum + 1
foreach ($effect in $effects) {
    $srcFolder = Join-Path $sourceDir $effect.Folder
    $pngSub = Get-ChildItem -Path $srcFolder -Directory | Where-Object { $_.Name -match "^PNG" } | Select-Object -First 1
    $frameFiles = Get-ChildItem -Path $pngSub.FullName -Filter "*.png" | Where-Object { $_.Name -notmatch "spritesheet" } | Sort-Object Name

    $bitmaps = @()
    foreach ($f in $frameFiles) {
        $bitmaps += [System.Drawing.Bitmap]::FromFile($f.FullName)
    }

    $bounds = Get-AlphaBounds $bitmaps

    # Downscale factor so the longer cropped edge <= $MaxDim.
    $longEdge = [Math]::Max($bounds.Width, $bounds.Height)
    $scale = if ($longEdge -gt $MaxDim) { $MaxDim / $longEdge } else { 1.0 }
    $outW = [Math]::Max(1, [int][Math]::Round($bounds.Width * $scale))
    $outH = [Math]::Max(1, [int][Math]::Round($bounds.Height * $scale))

    $folderName = "{0:00}_{1}" -f $nextNum, $effect.Display
    $destDir = Join-Path $effectsDir $folderName
    New-Item -ItemType Directory -Path $destDir -Force | Out-Null

    for ($i = 0; $i -lt $bitmaps.Count; $i++) {
        $srcBmp = $bitmaps[$i]
        $cropRect = New-Object System.Drawing.Rectangle $bounds.X, $bounds.Y, $bounds.Width, $bounds.Height
        $outBmp = New-Object System.Drawing.Bitmap $outW, $outH, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $g = [System.Drawing.Graphics]::FromImage($outBmp)
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $g.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
        $destRect = New-Object System.Drawing.Rectangle 0, 0, $outW, $outH
        $g.DrawImage($srcBmp, $destRect, $cropRect, [System.Drawing.GraphicsUnit]::Pixel)
        $g.Dispose()

        $frameName = "frame_{0:00}.png" -f ($i + 1)
        $outBmp.Save((Join-Path $destDir $frameName), [System.Drawing.Imaging.ImageFormat]::Png)
        $outBmp.Dispose()
        $srcBmp.Dispose()
    }

    $meta = [ordered]@{
        name      = $effect.Display
        frames    = $bitmaps.Count
        cell_size = @($outW, $outH)
        source    = "AnimatedAttack/$($effect.Folder)"
    }
    ($meta | ConvertTo-Json) | Set-Content -Path (Join-Path $destDir "metadata.json") -Encoding UTF8

    Write-Host "Created $folderName ($($bitmaps.Count) frames, ${outW}x${outH})"
    $nextNum++
}
