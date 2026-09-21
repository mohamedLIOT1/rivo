param()
Add-Type -AssemblyName System.Drawing

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$splashPath = Join-Path $scriptDir "..\assets\splash.png"
$splashImg = [System.Drawing.Image]::FromFile($splashPath)

# #1b4e3b matches the Rivo emblem background
$bgColor = [System.Drawing.Color]::FromArgb(255, 27, 78, 59)

$targets = @(
    @{ Path = "..\android\app\src\main\res\drawable\splashscreen_image.png"; Width = 480; Height = 800 },
    @{ Path = "..\android\app\src\main\res\drawable-hdpi\splashscreen_image.png"; Width = 480; Height = 800 },
    @{ Path = "..\android\app\src\main\res\drawable-mdpi\splashscreen_image.png"; Width = 320; Height = 480 },
    @{ Path = "..\android\app\src\main\res\drawable-xhdpi\splashscreen_image.png"; Width = 720; Height = 1280 },
    @{ Path = "..\android\app\src\main\res\drawable-xxhdpi\splashscreen_image.png"; Width = 960; Height = 1600 },
    @{ Path = "..\android\app\src\main\res\drawable-xxxhdpi\splashscreen_image.png"; Width = 1280; Height = 1920 }
)

foreach ($t in $targets) {
    $outPath = Join-Path $scriptDir $t.Path
    $w = $t.Width
    $h = $t.Height

    $bmp = New-Object System.Drawing.Bitmap($w, $h)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality

    $brush = New-Object System.Drawing.SolidBrush($bgColor)
    $g.FillRectangle($brush, 0, 0, $w, $h)
    $brush.Dispose()

    $iconDim = [int]([Math]::Min($w, $h) * 0.42)
    $x = [int](($w - $iconDim) / 2)
    $y = [int](($h - $iconDim) / 2)

    # Rounded rectangle clip to completely clip any white corners from the raw source PNG
    $r = [int]($iconDim * 0.20)
    $d = $r * 2
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddArc($x, $y, $d, $d, 180, 90)
    $path.AddArc($x + $iconDim - $d, $y, $d, $d, 270, 90)
    $path.AddArc($x + $iconDim - $d, $y + $iconDim - $d, $d, $d, 0, 90)
    $path.AddArc($x, $y + $iconDim - $d, $d, $d, 90, 90)
    $path.CloseFigure()

    $g.SetClip($path)
    $g.DrawImage($splashImg, $x, $y, $iconDim, $iconDim)
    $g.ResetClip()
    $path.Dispose()
    $g.Dispose()

    if (Test-Path $outPath) {
        Remove-Item $outPath -Force
    }
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Output "Generated: $outPath ($w x $h)"
}

$splashImg.Dispose()
Write-Output "Done!"
