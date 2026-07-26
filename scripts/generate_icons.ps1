Add-Type -AssemblyName System.Drawing

function Create-LiofyIcon {
    param (
        [int]$width,
        [int]$height,
        [string]$outputPath,
        [bool]$isSplash = $false,
        [bool]$isTransparent = $false
    )

    $bmp = New-Object System.Drawing.Bitmap($width, $height)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

    if ($isSplash) {
        # Dark splash screen with glowing radial gradient effect
        $bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#09090b"))
        $g.FillRectangle($bgBrush, 0, 0, $width, $height)

        # Draw centered green glow circle
        $glowSize = [int]($width * 0.45)
        $glowX = [int](($width - $glowSize) / 2)
        $glowY = [int](($height - $glowSize) / 2 - $height * 0.05)

        $glowPath = New-Object System.Drawing.Drawing2D.GraphicsPath
        $glowPath.AddEllipse($glowX, $glowY, $glowSize, $glowSize)
        $pbr = New-Object System.Drawing.Drawing2D.PathGradientBrush($glowPath)
        $pbr.CenterColor = [System.Drawing.ColorTranslator]::FromHtml("#1DB954")
        $pbr.SurroundColors = @([System.Drawing.ColorTranslator]::FromHtml("#09090b"))
        $g.FillEllipse($pbr, $glowX, $glowY, $glowSize, $glowSize)

        # Draw green icon badge in middle of splash
        $badgeSize = [int]($width * 0.26)
        $badgeX = [int](($width - $badgeSize) / 2)
        $badgeY = [int](($height - $badgeSize) / 2 - $height * 0.05)

        $greenBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#1DB954"))
        $g.FillEllipse($greenBrush, $badgeX, $badgeY, $badgeSize, $badgeSize)

        # Draw elegantly proportioned white "L" inside the badge
        $lPenWidth = [int]($badgeSize * 0.12)
        $whitePen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, $lPenWidth)
        $whitePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
        $whitePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
        $whitePen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round

        $lx1 = $badgeX + $badgeSize * 0.41
        $ly1 = $badgeY + $badgeSize * 0.32
        $ly2 = $badgeY + $badgeSize * 0.68
        $lx2 = $badgeX + $badgeSize * 0.63

        $g.DrawLine($whitePen, $lx1, $ly1, $lx1, $ly2)
        $g.DrawLine($whitePen, $lx1, $ly2, $lx2, $ly2)

        # Draw "Liofy" text at bottom
        $font = New-Object System.Drawing.Font("Arial", [int]($width * 0.06), [System.Drawing.FontStyle]::Bold)
        $whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
        $sf = New-Object System.Drawing.StringFormat
        $sf.Alignment = [System.Drawing.StringAlignment]::Center
        $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
        $g.DrawString("Liofy", $font, $whiteBrush, ($width / 2), ($badgeY + $badgeSize + $height * 0.08), $sf)
    } else {
        # App Icon
        if (-not $isTransparent) {
            # Rich green gradient background (#1DB954 to #107C38)
            $rect = New-Object System.Drawing.Rectangle(0, 0, $width, $height)
            $c1 = [System.Drawing.ColorTranslator]::FromHtml("#1DB954")
            $c2 = [System.Drawing.ColorTranslator]::FromHtml("#107C38")
            $lgb = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $c1, $c2, 45)
            $g.FillRectangle($lgb, 0, 0, $width, $height)
        }

        # Perfectly sized white "L" in center with generous padding
        $lPenWidth = [int]($width * 0.10)
        $whitePen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, $lPenWidth)
        $whitePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
        $whitePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
        $whitePen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round

        $lx1 = $width * 0.42
        $ly1 = $height * 0.35
        $ly2 = $height * 0.65
        $lx2 = $width * 0.62

        $g.DrawLine($whitePen, $lx1, $ly1, $lx1, $ly2)
        $g.DrawLine($whitePen, $lx1, $ly2, $lx2, $ly2)
    }

    $g.Dispose()
    $bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "Generated: $outputPath ($width x $height)"
}

$assetsDir = "c:\Users\mohamed\Desktop\liofy\assets"
Create-LiofyIcon 1024 1024 "$assetsDir\icon.png"
Create-LiofyIcon 1024 1024 "$assetsDir\adaptive-icon.png"
Create-LiofyIcon 1242 2436 "$assetsDir\splash.png" $true
Create-LiofyIcon 512 512 "$assetsDir\favicon.png"
