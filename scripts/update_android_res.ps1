Add-Type -AssemblyName System.Drawing

function Resize-Image {
    param (
        [string]$sourcePath,
        [string]$destPath,
        [int]$width,
        [int]$height
    )

    $destDir = [System.IO.Path]::GetDirectoryName($destPath)
    if (-not (Test-Path $destDir)) {
        New-Item -ItemType Directory -Force -Path $destDir | Out-Null
    }

    $srcBmp = New-Object System.Drawing.Bitmap($sourcePath)
    $destBmp = New-Object System.Drawing.Bitmap($width, $height)
    $g = [System.Drawing.Graphics]::FromImage($destBmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($srcBmp, 0, 0, $width, $height)
    $g.Dispose()
    $srcBmp.Dispose()

    $destBmp.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $destBmp.Dispose()
    Write-Host "Updated Android Res: $destPath ($width x $height)"
}

$iconPath = "c:\Users\mohamed\Desktop\liofy\assets\icon.png"
$adaptivePath = "c:\Users\mohamed\Desktop\liofy\assets\adaptive-icon.png"
$splashPath = "c:\Users\mohamed\Desktop\liofy\assets\splash.png"
$resDir = "c:\Users\mohamed\Desktop\liofy\android\app\src\main\res"

$densities = @(
    @{ folder="mipmap-mdpi"; size=48 },
    @{ folder="mipmap-hdpi"; size=72 },
    @{ folder="mipmap-xhdpi"; size=96 },
    @{ folder="mipmap-xxhdpi"; size=144 },
    @{ folder="mipmap-xxxhdpi"; size=192 }
)

foreach ($d in $densities) {
    $targetDir = "$resDir\$($d.folder)"
    Resize-Image $iconPath "$targetDir\ic_launcher.png" $d.size $d.size
    Resize-Image $iconPath "$targetDir\ic_launcher_round.png" $d.size $d.size
    Resize-Image $adaptivePath "$targetDir\ic_launcher_foreground.png" $d.size $d.size
}

# Update splash images in drawable folders
Resize-Image $splashPath "$resDir\drawable\splashscreen_image.png" 480 800
Resize-Image $splashPath "$resDir\drawable-hdpi\splashscreen_image.png" 480 800
Resize-Image $splashPath "$resDir\drawable-mdpi\splashscreen_image.png" 320 480
Resize-Image $splashPath "$resDir\drawable-xhdpi\splashscreen_image.png" 720 1280
Resize-Image $splashPath "$resDir\drawable-xxhdpi\splashscreen_image.png" 960 1600
Resize-Image $splashPath "$resDir\drawable-xxxhdpi\splashscreen_image.png" 1280 1920
