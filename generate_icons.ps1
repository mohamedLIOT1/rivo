Add-Type -AssemblyName System.Drawing

function Generate-Icon {
    param([int]$size, [string]$outputPath, [bool]$isRound = $false)

    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    $rect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
    $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, [System.Drawing.ColorTranslator]::FromHtml("#1ed760"), [System.Drawing.ColorTranslator]::FromHtml("#12833b"), 45)

    if ($isRound) {
        $path = New-Object System.Drawing.Drawing2D.GraphicsPath
        $path.AddEllipse(0, 0, $size, $size)
        $g.FillPath($bgBrush, $path)
    } else {
        $radius = [int]($size * 0.25)
        $path = New-Object System.Drawing.Drawing2D.GraphicsPath
        $path.AddArc(0, 0, $radius, $radius, 180, 90)
        $path.AddArc($size - $radius, 0, $radius, $radius, 270, 90)
        $path.AddArc($size - $radius, $size - $radius, $radius, $radius, 0, 90)
        $path.AddArc(0, $size - $radius, $radius, $radius, 90, 90)
        $path.CloseFigure()
        $g.FillPath($bgBrush, $path)
    }

    # Draw sleek music note shape
    $blackBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#050505"))

    # Left note head (circle)
    $headR = [int]($size * 0.16)
    $cx1 = [int]($size * 0.38)
    $cy1 = [int]($size * 0.62)
    $g.FillEllipse($blackBrush, $cx1 - $headR/2, $cy1 - $headR/2, $headR, $headR)

    # Right note head (circle)
    $cx2 = [int]($size * 0.68)
    $cy2 = [int]($size * 0.52)
    $g.FillEllipse($blackBrush, $cx2 - $headR/2, $cy2 - $headR/2, $headR, $headR)

    # Vertical stems
    $stemW = [math]::Max(2, [int]($size * 0.07))
    $stemH = [int]($size * 0.38)
    $g.FillRectangle($blackBrush, $cx1 + $headR/3 - $stemW/2, $cy1 - $stemH, $stemW, $stemH)
    $g.FillRectangle($blackBrush, $cx2 + $headR/3 - $stemW/2, $cy2 - $stemH, $stemW, $stemH)

    # Top connecting beam
    $beamH = [math]::Max(3, [int]($size * 0.09))
    $p1 = New-Object System.Drawing.PointF($cx1 + $headR/3 - $stemW/2, $cy1 - $stemH)
    $p2 = New-Object System.Drawing.PointF($cx2 + $headR/3 + $stemW/2, $cy2 - $stemH)
    $p3 = New-Object System.Drawing.PointF($cx2 + $headR/3 + $stemW/2, $cy2 - $stemH + $beamH)
    $p4 = New-Object System.Drawing.PointF($cx1 + $headR/3 - $stemW/2, $cy1 - $stemH + $beamH)
    $beamPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $beamPath.AddPolygon([System.Drawing.PointF[]]@($p1, $p2, $p3, $p4))
    $g.FillPath($blackBrush, $beamPath)

    $dir = [System.IO.Path]::GetDirectoryName($outputPath)
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force }
    $bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
}

Generate-Icon 192 "public/icon-192.png" $false
Generate-Icon 512 "public/icon-512.png" $false
Write-Host "Generated test icons!"
