# Winapp Apple Music Skin

A retro hi-fi player for Apple Music on Windows: a Winamp-style deck with Japanese labels. It wraps Apple's web player (music.apple.com) in a small Windows app and draws its own interface over it, so your library, playlists and streaming work just as they do in Apple Music.

Unofficial, not made by or affiliated with Apple. You need an Apple Music subscription.

## Features

- **Deck:** time display, level meter, transport keys and volume across the top.
- **Library:** your playlists, songs, albums and artists, plus search across the whole Apple Music catalog. Songs you add to your library or to a playlist sync to your other devices.
- **Visualizer panel:** 15 WebGL effects (waves, stars, tunnel, plasma, sakura, fireworks and more) that move with the music.
- **Lyrics panel** that follows the song.
- **Queue panel.** With shuffle on, the song you click plays first and the rest is shuffled after it.
- **Your own playlist order:** drag playlists, or use Alt+↑ / Alt+↓. RESET goes back to Apple's order.
- **18 colour themes**, including Hatsune Miku, Kasane Teto and Ado.
- **Compact player** (Ctrl+M) that can stay above everything, including fullscreen browsers and games in windowed fullscreen.

## Run it

Needs Windows 11 (the WebView2 runtime it uses is built in).

1. Download this repository (**Code → Download ZIP**) and extract it.
2. Run `app\MusicPlayer.exe`. The app isn't signed, so Windows may warn about an unknown publisher: **More info → Run anyway**.
3. Sign in on Apple's sign-in page inside the window.

## Keys

| Key | What it does |
| --- | --- |
| Ctrl+M | compact / full player |
| / | search |
| Space | play / pause |
| Backspace | back |
| G, L, Q | visualizer, lyrics, queue |
| [ and ] | change effect |
| F | visualizer fills the window |
| Alt+↑ / Alt+↓ | move the selected playlist |

## Changing it

- **The look and behaviour** are in `app\ui\player.css` and `app\ui\player.js`. Edit them and restart the app; nothing needs rebuilding.
- **The app itself** is `src\MusicPlayer.cs` (the window and the WebView2 host) and `src\AudioTap.cs` (listens to the app's own sound so the visualizer and meter can follow the music). Rebuild with:

  ```powershell
  powershell -ExecutionPolicy Bypass -File .\build.ps1
  ```

  It uses the C# compiler that ships with Windows, so there is nothing to install. Add `-StartMenu` or `-Desktop` for a shortcut there. The three WebView2 DLLs in `app\` come from Microsoft's `Microsoft.Web.WebView2` NuGet package.
- **Testing without a window:** `tools\RunHidden.ps1` runs the app on a hidden desktop, and `tools\Probe.cs` runs just the skin. The notes at the top of each explain how.

## How it works

`MusicPlayer.exe` hosts music.apple.com in WebView2 and injects the skin. Apple's page keeps running underneath: its MusicKit loads your library and plays the music, while the skin draws the interface and tells it what to do. Songs are copy-protected and decoded outside the page, so the page can't hear them; the app captures its own sound output instead and passes it to the visualizer and the level meter.

App icon: Kasane Teto art by LeafyyXD.
