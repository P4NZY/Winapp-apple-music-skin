<#
  Builds the Music Player app into .\app

    1. icon.png            ->  app\player.ico  (+ app\ui\icon.png for the in-app logo)
    2. src\MusicPlayer.cs  ->  app\MusicPlayer.exe, using the C# compiler that
       src\AudioTap.cs         ships with Windows (nothing to install)
    3. "Music Player" shortcut in this folder; the Start Menu one is refreshed
       if it already exists.

  Run it again after changing icon.png or anything in src\, or after moving
  this folder. The design itself lives in app\ui\player.css and app\ui\player.js:
  edit those and restart the app, no rebuild needed.

    -StartMenu   add the shortcut to the Start Menu
    -Desktop     add the shortcut to the Desktop
#>
param(
    [switch]$Desktop,
    [switch]$StartMenu
)

$ErrorActionPreference = 'Stop'

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$app  = Join-Path $here 'app'
$ui   = Join-Path $app  'ui'
$name = 'Music Player'
$exe  = Join-Path $app  'MusicPlayer.exe'
$ico  = Join-Path $app  'player.ico'
$png  = Join-Path $here 'icon.png'
$src  = Join-Path $here 'src\MusicPlayer.cs'
$csc  = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'

# --- checks -----------------------------------------------------------------

if (-not (Test-Path $png)) { throw "icon.png not found in $here. Put the picture you want as the app icon there." }
if (-not (Test-Path $csc)) { throw "C# compiler not found at $csc (it is part of .NET Framework 4, normally present on Windows 10/11)." }
foreach ($f in 'player.css', 'player.js') {
    if (-not (Test-Path (Join-Path $ui $f))) { throw "Missing app\ui\$f." }
}
# Microsoft's WebView2 SDK (NuGet package Microsoft.Web.WebView2): the two
# lib\net462 DLLs and runtimes\win-x64\native\WebView2Loader.dll.
foreach ($f in 'Microsoft.Web.WebView2.Core.dll', 'Microsoft.Web.WebView2.WinForms.dll', 'WebView2Loader.dll') {
    if (-not (Test-Path (Join-Path $app $f))) { throw "Missing app\$f (from the Microsoft.Web.WebView2 NuGet package)." }
}
$running = Get-Process -Name 'MusicPlayer' -ErrorAction SilentlyContinue |
    Where-Object { try { $_.Path -eq $exe } catch { $false } }
if ($running) { throw 'Music Player is running. Close it, then run build.ps1 again.' }

# --- icon -------------------------------------------------------------------

Add-Type -AssemblyName System.Drawing

# Square, high-quality copy of the picture at the given size (centre-cropped).
function Get-ScaledBitmap([System.Drawing.Image]$image, [int]$size) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g   = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode  = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode    = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.SmoothingMode      = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)

    $side = [Math]::Min($image.Width, $image.Height)
    $sx   = [int][Math]::Floor(($image.Width  - $side) / 2)
    $sy   = [int][Math]::Floor(($image.Height - $side) / 2)
    $attr = New-Object System.Drawing.Imaging.ImageAttributes
    $attr.SetWrapMode([System.Drawing.Drawing2D.WrapMode]::TileFlipXY)   # no faded edges
    $dest = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
    $g.DrawImage($image, $dest, $sx, $sy, $side, $side, [System.Drawing.GraphicsUnit]::Pixel, $attr)
    $attr.Dispose(); $g.Dispose()
    return $bmp
}

function Get-PngBytes([System.Drawing.Bitmap]$bmp) {
    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    return ,$ms.ToArray()
}

# Classic icon image: BITMAPINFOHEADER + bottom-up BGRA rows + empty 1-bit mask.
function Get-DibBytes([System.Drawing.Bitmap]$bmp) {
    $n      = $bmp.Width
    $rect   = New-Object System.Drawing.Rectangle(0, 0, $n, $n)
    $data   = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $stride = $data.Stride
    $pixels = New-Object byte[] ($stride * $n)
    [System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $pixels, 0, $pixels.Length)
    $bmp.UnlockBits($data)

    $maskRow = [int][Math]::Floor(($n + 31) / 32) * 4
    $mask    = New-Object byte[] ($maskRow * $n)

    $ms = New-Object System.IO.MemoryStream
    $bw = New-Object System.IO.BinaryWriter($ms)
    $bw.Write([uint32]40); $bw.Write([int32]$n); $bw.Write([int32]($n * 2))
    $bw.Write([uint16]1);  $bw.Write([uint16]32); $bw.Write([uint32]0)
    $bw.Write([uint32]($pixels.Length + $mask.Length))
    $bw.Write([int32]0); $bw.Write([int32]0); $bw.Write([uint32]0); $bw.Write([uint32]0)
    for ($y = $n - 1; $y -ge 0; $y--) { $bw.Write($pixels, $y * $stride, $stride) }
    $bw.Write($mask, 0, $mask.Length)
    $bw.Flush()
    return ,$ms.ToArray()
}

function New-AppIcon([string]$source, [string]$icoPath, [string]$logoPath) {
    $image = [System.Drawing.Image]::FromFile($source)
    try {
        # 256 is stored as PNG, the small sizes as plain bitmaps (the usual layout)
        $sizes   = 256, 64, 48, 40, 32, 24, 20, 16
        $entries = New-Object 'System.Collections.Generic.List[byte[]]'
        foreach ($s in $sizes) {
            $bmp = Get-ScaledBitmap $image $s
            if ($s -ge 256) { $entries.Add([byte[]](Get-PngBytes $bmp)) } else { $entries.Add([byte[]](Get-DibBytes $bmp)) }
            $bmp.Dispose()
        }

        $bw = New-Object System.IO.BinaryWriter([System.IO.File]::Create($icoPath))
        try {
            $bw.Write([uint16]0); $bw.Write([uint16]1); $bw.Write([uint16]$sizes.Count)
            $offset = 6 + 16 * $sizes.Count
            for ($i = 0; $i -lt $sizes.Count; $i++) {
                $dim = if ($sizes[$i] -ge 256) { 0 } else { $sizes[$i] }      # 0 means 256
                $bw.Write([byte]$dim); $bw.Write([byte]$dim); $bw.Write([byte]0); $bw.Write([byte]0)
                $bw.Write([uint16]1);  $bw.Write([uint16]32)
                $bw.Write([uint32]$entries[$i].Length); $bw.Write([uint32]$offset)
                $offset += $entries[$i].Length
            }
            foreach ($e in $entries) { $bw.Write($e, 0, $e.Length) }
        }
        finally { $bw.Dispose() }

        $logo = Get-ScaledBitmap $image 96
        $logo.Save($logoPath, [System.Drawing.Imaging.ImageFormat]::Png)
        $logo.Dispose()
    }
    finally { $image.Dispose() }
}

New-AppIcon $png $ico (Join-Path $ui 'icon.png')
"Icon:     $ico"

# --- compile ----------------------------------------------------------------

$cscArgs = @(
    '/nologo', '/target:winexe', '/platform:x64', '/optimize+', '/warn:4',
    "/out:$exe",
    "/win32icon:$ico",
    "/reference:$(Join-Path $app 'Microsoft.Web.WebView2.Core.dll')",
    "/reference:$(Join-Path $app 'Microsoft.Web.WebView2.WinForms.dll')",
    '/reference:System.Windows.Forms.dll',
    '/reference:System.Drawing.dll',
    $src,
    (Join-Path $here 'src\AudioTap.cs')      # sound capture for the visualizer
)
& $csc @cscArgs
if ($LASTEXITCODE -ne 0) { throw "Compile failed (csc exit code $LASTEXITCODE)." }
"App:      $exe"

# --- shortcuts --------------------------------------------------------------

function New-PlayerShortcut([string]$lnkPath) {
    $shell = New-Object -ComObject WScript.Shell
    $lnk   = $shell.CreateShortcut($lnkPath)
    $lnk.TargetPath       = $exe
    $lnk.Arguments        = ''
    $lnk.WorkingDirectory = $app
    $lnk.IconLocation     = "$ico,0"
    $lnk.Description      = 'Music Player'
    $lnk.Save()
    "Shortcut: $lnkPath"
}

New-PlayerShortcut (Join-Path $here "$name.lnk")

$startLnk = Join-Path ([Environment]::GetFolderPath('Programs')) "$name.lnk"
if ($StartMenu -or (Test-Path $startLnk)) { New-PlayerShortcut $startLnk }

$deskLnk = Join-Path ([Environment]::GetFolderPath('Desktop')) "$name.lnk"
if ($Desktop -or (Test-Path $deskLnk)) { New-PlayerShortcut $deskLnk }
