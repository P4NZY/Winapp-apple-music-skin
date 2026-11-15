# Winapp Apple Music Skin

A retro hi-fi player for Apple Music on Windows and Mac: a Winamp-style deck with Japanese labels. It wraps Apple's web player (music.apple.com) and draws its own interface over it, so your library, playlists and streaming work just as they do in Apple Music. On Windows it is a small app of its own; on a Mac it runs in Chrome, Edge or Brave, in a window of its own with a Dock icon (see [Mac](#mac)).

Unofficial, not made by or affiliated with Apple. You need an Apple Music subscription.

Looking for Spotify and SoundCloud? The same player for those is [Stream Player](https://github.com/P4NZY/stream-player-mac) (Mac).

## Features

- **Deck:** time display, level meter, transport keys and volume across the top.
- **Library:** your playlists, songs, albums and artists, plus search across the whole Apple Music catalog. Songs you add to your library or to a playlist sync to your other devices.
- **Visualizer panel:** 15 WebGL effects (waves, stars, tunnel, plasma, sakura, fireworks and more) that move with the music.
- **Lyrics panel** that follows the song.
- **Queue panel.** With shuffle on, the song you click plays first and the rest is shuffled after it.
- **Your own playlist order:** drag playlists, or use Alt+↑ / Alt+↓. RESET goes back to Apple's order.
- **18 colour themes**, including Hatsune Miku, Kasane Teto and Ado.
- **Compact player** (Ctrl+M) that can stay above everything: on Windows including fullscreen browsers and games in windowed fullscreen, on a Mac in a small window of its own that floats above every app.

## Run it on Windows

Needs Windows 11 (the WebView2 runtime it uses is built in).

1. Download this repository (**Code → Download ZIP**) and extract it.
2. Run `app\MusicPlayer.exe`. The app isn't signed, so Windows may warn about an unknown publisher: **More info → Run anyway**.
3. Sign in on Apple's sign-in page inside the window.

## Mac

The same player for a Mac, in `Music Player for Mac/`. Needs Google Chrome, Microsoft Edge or Brave.

1. Download this repository (**Code → Download ZIP**) and extract it.
2. Open Terminal, type `bash ` (with a space), drag `Music Player for Mac/install.sh` into the window and press Return.
3. Music Player opens. With Edge or Brave it is ready straight away; Chrome no longer loads extensions from the command line, so the first time it opens Chrome's Extensions page with directions for switching the player on (Load unpacked).
4. Sign in to Apple Music in the window (the OPEN APPLE MUSIC key, then Apple's own Sign In).

The installer makes a **Music Player** app in your Applications folder: it opens the player in a browser profile of its own (with Brave it switches Widevine on, which Apple's full songs need) and stays open while the player does, so the Dock shows the dot under it. The visualizer follows the music by itself, and the compact player floats above every app. `Music Player for Mac/READ ME FIRST.txt` has the details.

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
- **The Mac version** uses the same skin. `Music Player for Mac\extension\skin.js` is made from `app\ui` (with the icon) by `tools\make-mac.ps1`, so run that after changing `app\ui`:

  ```powershell
  powershell -ExecutionPolicy Bypass -File .\tools\make-mac.ps1
  ```

  Everything else in `Music Player for Mac` (the installer, the extension's own scripts) is edited by hand. On the Mac, run `install.sh` again to put a change in place. Mac-only parts of the skin are kept behind `HOST_KIND === 'mac'`, so they never run in the Windows app.

## How it works

`MusicPlayer.exe` hosts music.apple.com in WebView2 and injects the skin. Apple's page keeps running underneath: its MusicKit loads your library and plays the music, while the skin draws the interface and tells it what to do. Songs are copy-protected and decoded outside the page, so the page can't hear them; the app captures its own sound output instead and passes it to the visualizer and the level meter.

On a Mac, a browser extension injects the same skin into music.apple.com, in an app window with a browser profile of its own. To let the visualizer hear the music, the extension captures the tab's sound (`chrome.tabCapture`). The browser is started with `--allowlisted-extension-id`, so no toolbar click is needed. The floating compact player is a Document Picture-in-Picture window.

App icon: Kasane Teto art by LeafyyXD.
