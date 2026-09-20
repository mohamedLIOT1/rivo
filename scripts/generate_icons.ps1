Add-Type -AssemblyName System.Drawing

$configs = @(
    @{ dir = 'mipmap-mdpi'; sz = 48 },
    @{ dir = 'mipmap-hdpi'; sz = 72 },
    @{ dir = 'mipmap-xhdpi'; sz = 96 },
    @{ dir = 'mipmap-xxhdpi'; sz = 144 },
    @{ dir = 'mipmap-xxxhdpi'; sz = 192 }
)

$srcPath = "c:\Users\Ali\StudioProjects\liofy\assets\icon.png"

foreach ($cfg in $configs) {
    $bmp = [System.Drawing.Image]::FromFile($srcPath)
    $dest = New-Object System.Drawing.Bitmap $cfg.sz, $cfg.sz
    $g = [System.Drawing.Graphics]::FromImage($dest)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($bmp, 0, 0, $cfg.sz, $cfg.sz)
    
    $outDir = "c:\Users\Ali\StudioProjects\liofy\android\app\src\main\res\" + $cfg.dir
    $dest.Save("$outDir\ic_launcher.png", [System.Drawing.Imaging.ImageFormat]::Png)
    $dest.Save("$outDir\ic_launcher_round.png", [System.Drawing.Imaging.ImageFormat]::Png)
    $dest.Save("$outDir\ic_launcher_foreground.png", [System.Drawing.Imaging.ImageFormat]::Png)
    
    $g.Dispose()
    $dest.Dispose()
    $bmp.Dispose()
    Write-Output "Generated $($cfg.dir) at $($cfg.sz)x$($cfg.sz)"
}
