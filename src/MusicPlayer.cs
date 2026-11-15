// Music Player - the app window.
//
// Hosts Apple's web player (music.apple.com) in a WebView2 control and injects
// the skin from app\ui\player.css + app\ui\player.js into it. The page talks
// back with small "verb|arg|arg" messages (theme colours, compact size, ...).
//
// Built by build.ps1 with the C# compiler that ships with Windows, so this file
// sticks to C# 5 syntax (no string interpolation, no ?. operator, etc).

using System;
using System.Diagnostics;
using System.Drawing;
using System.Globalization;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

[assembly: AssemblyTitle("Music Player")]
[assembly: AssemblyProduct("Music Player")]
[assembly: AssemblyVersion("1.0.0.0")]

namespace MusicPlayerApp
{
    internal sealed class Options
    {
        public string Url = "https://music.apple.com/library/all-playlists/";
        public string DataDir;      // --data-dir : use another profile folder
        public string Capture;      // --capture  : save a PNG of the page, then exit
        public string Script;       // --script   : JS file to run before the capture
        public string Result;       // --result   : file that receives window.__mpResult
        public int Delay = 6000;    // --delay    : ms to wait after the page loads
        public int Settle = 2500;   // --settle   : ms to wait after the script ran
        public int Width, Height;   // --size     : starting client size

        // Any of the test switches makes this a throw-away run: muted, no saved
        // window position, and it does not count as "the" running instance.
        public bool IsTestRun { get { return DataDir != null || Capture != null || Script != null; } }

        public static Options Parse(string[] a)
        {
            var o = new Options();
            for (int i = 0; i < a.Length; i++)
            {
                string next = i + 1 < a.Length ? a[i + 1] : null;
                int n;
                switch (a[i])
                {
                    case "--url":      if (next != null) { o.Url = next; i++; } break;
                    case "--data-dir": if (next != null) { o.DataDir = next; i++; } break;
                    case "--capture":  if (next != null) { o.Capture = next; i++; } break;
                    case "--script":   if (next != null) { o.Script = next; i++; } break;
                    case "--result":   if (next != null) { o.Result = next; i++; } break;
                    case "--size":     // WxH client size in pixels, for test captures
                        if (next != null)
                        {
                            string[] wh = next.Split('x');
                            int w, hgt;
                            if (wh.Length == 2 && int.TryParse(wh[0], out w) && int.TryParse(wh[1], out hgt))
                            {
                                o.Width = w;
                                o.Height = hgt;
                            }
                            i++;
                        }
                        break;
                    case "--delay":    if (next != null && int.TryParse(next, out n)) { o.Delay = n; i++; } break;
                    case "--settle":   if (next != null && int.TryParse(next, out n)) { o.Settle = n; i++; } break;
                }
            }
            return o;
        }
    }

    internal static class Program
    {
        [DllImport("user32.dll")] static extern bool SetProcessDpiAwarenessContext(IntPtr value);
        [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr hWnd);
        [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr hWnd, int cmd);
        [DllImport("user32.dll")] static extern bool IsIconic(IntPtr hWnd);

        [STAThread]
        static int Main(string[] args)
        {
            // Per-monitor DPI awareness, so the page is rendered sharp instead of
            // being bitmap-stretched on scaled displays. Must precede any window.
            try { SetProcessDpiAwarenessContext(new IntPtr(-4)); } catch { }

            Options opts = Options.Parse(args);

            Mutex single = null;
            if (!opts.IsTestRun)
            {
                bool created;
                single = new Mutex(true, "MusicPlayerApp.SingleInstance", out created);
                if (!created) { ActivateRunningInstance(); return 0; }
            }

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new PlayerForm(opts));
            GC.KeepAlive(single);
            return 0;
        }

        static void ActivateRunningInstance()
        {
            try
            {
                Process me = Process.GetCurrentProcess();
                foreach (Process p in Process.GetProcessesByName(me.ProcessName))
                {
                    if (p.Id == me.Id) continue;
                    IntPtr h = p.MainWindowHandle;
                    if (h == IntPtr.Zero) continue;
                    if (IsIconic(h)) ShowWindow(h, 9 /* SW_RESTORE */);
                    SetForegroundWindow(h);
                    break;
                }
            }
            catch { }
        }
    }

    internal sealed class PlayerForm : Form
    {
        const int DWMWA_USE_IMMERSIVE_DARK_MODE = 20;
        const int DWMWA_BORDER_COLOR = 34;
        const int DWMWA_CAPTION_COLOR = 35;
        const int DWMWA_TEXT_COLOR = 36;

        [DllImport("dwmapi.dll")] static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int value, int size);
        [DllImport("user32.dll")] static extern uint GetDpiForWindow(IntPtr hwnd);

        const string AppOrigin = "https://music.apple.com/";

        readonly Options opts;
        readonly WebView2 web;
        readonly string appDir, uiDir, dataDir, statePath;
        readonly StringBuilder testLog = new StringBuilder();

        // window state
        bool compact;               // showing the compact (Winamp-style) player
        bool wantOnTop;             // "keep compact player on top" setting
        Rectangle fullBounds;       // library-mode bounds while compact
        bool fullMaximized;
        bool hasCompactPos;
        Point compactPos;

        // title bar colours (RRGGBB), last ones the page asked for
        bool darkScheme = true;     // what the page sees as prefers-color-scheme
        bool captionDark = true;    // whether the title bar itself is a dark colour
        int captionRgb = 0x080b12;
        int textRgb = 0xf2f4f8;

        bool testStarted;
        DateTime lastCrashReload = DateTime.MinValue;
        AudioFeed feed;             // sound for the visualizer (see AudioTap.cs)

        public PlayerForm(Options o)
        {
            opts = o;
            appDir = AppDomain.CurrentDomain.BaseDirectory;
            uiDir = Path.Combine(appDir, "ui");
            dataDir = o.DataDir ?? Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "MusicPlayerApp");
            Directory.CreateDirectory(dataDir);
            statePath = Path.Combine(dataDir, "window.txt");

            Text = "Music Player";
            StartPosition = FormStartPosition.Manual;
            LoadWindowIcon();
            PlaceDefault();
            if (!opts.IsTestRun) RestoreState();
            if (opts.Width > 0 && opts.Height > 0) ClientSize = new Size(opts.Width, opts.Height);
            BackColor = FromRgb(captionRgb);

            web = new WebView2();
            web.Dock = DockStyle.Fill;
            // a file dropped on the window would otherwise replace the player with that file
            web.AllowExternalDrop = false;
            web.DefaultBackgroundColor = BackColor;
            Controls.Add(web);

            Load += OnLoad;
            FormClosing += OnClosing;
            Resize += delegate
            {
                if (!pendingCompact.IsEmpty && WindowState != FormWindowState.Minimized)
                    EnterCompact(pendingCompact.Width, pendingCompact.Height);
            };
        }

        // A test run must not steal focus from whatever the user is doing.
        protected override bool ShowWithoutActivation { get { return opts.IsTestRun; } }

        protected override void OnHandleCreated(EventArgs e)
        {
            base.OnHandleCreated(e);
            ApplyTitleBar();
        }

        // ---------------------------------------------------------------- startup

        async void OnLoad(object sender, EventArgs e)
        {
            try
            {
                string css = File.ReadAllText(Path.Combine(uiDir, "player.css"), Encoding.UTF8);
                string js = File.ReadAllText(Path.Combine(uiDir, "player.js"), Encoding.UTF8);
                string logo = "";
                string logoPath = Path.Combine(uiDir, "icon.png");
                if (File.Exists(logoPath))
                    logo = "data:image/png;base64," + Convert.ToBase64String(File.ReadAllBytes(logoPath));

                string script =
                    "(function(){\"use strict\";" +
                    "var __MP_CSS=" + JsString(css) + ";" +
                    "var __MP_ICON=" + JsString(logo) + ";\n" +
                    js + "\n})();";

                // Copy protection. Songs can be unlocked with Windows' own PlayReady
                // or with Google's Widevine module, which the engine's component
                // updater downloads into the profile. Once that download is there,
                // Apple's player prefers it - and Apple's licence server refuses
                // requests made with it from this app (acquireWebPlaybackLicense
                // answers status -1021 and the page shows "An error occurred").
                // So: drop any downloaded copy before the engine starts, and switch
                // the component updater off so it is not fetched again. Without it
                // the engine offers PlayReady only, and that is what plays here.
                // (PlayReady sound is decoded outside the page, which is why the
                // visualizer listens through AudioTap instead of Web Audio.)
                TryDeleteDirectory(Path.Combine(Path.Combine(dataDir, "WebView2"), "EBWebView", "WidevineCdm"));
                // left behind when the app was updated while it was running
                try { File.Delete(Path.Combine(appDir, "MusicPlayer.old.exe")); } catch { }

                // --autoplay-policy: without it Chromium refuses to start audio
                // until the page has been clicked - one way a web player ends up
                // "playing" in silence.
                var envOpts = new CoreWebView2EnvironmentOptions(
                    "--autoplay-policy=no-user-gesture-required --disable-component-update");
                CoreWebView2Environment env = await CoreWebView2Environment.CreateAsync(
                    null, Path.Combine(dataDir, "WebView2"), envOpts);
                await web.EnsureCoreWebView2Async(env);

                CoreWebView2 core = web.CoreWebView2;
                core.Settings.IsStatusBarEnabled = false;
                core.Profile.PreferredColorScheme = darkScheme
                    ? CoreWebView2PreferredColorScheme.Dark
                    : CoreWebView2PreferredColorScheme.Light;
                if (opts.IsTestRun) core.IsMuted = true;

                // what the page's visualizer listens to: this app's own sound output
                feed = new AudioFeed((int)core.BrowserProcessId,
                    SynchronizationContext.Current ?? new WindowsFormsSynchronizationContext(),
                    delegate(string m) { try { web.CoreWebView2.PostWebMessageAsString(m); } catch { } });

                await core.AddScriptToExecuteOnDocumentCreatedAsync(script);
                core.WebMessageReceived += OnWebMessage;
                core.NewWindowRequested += OnNewWindow;
                core.NavigationStarting += OnNavigationStarting;
                core.NavigationCompleted += OnNavigationCompleted;
                core.NavigationCompleted += delegate { seenSent = -1; };   // a new page: tell it again
                core.ProcessFailed += OnProcessFailed;
                core.Navigate(opts.Url);
                StartSeenWatch();
                WriteLog("app started");
            }
            catch (Exception ex)
            {
                if (opts.Result != null) TryWrite(opts.Result + ".err", ex.ToString());
                if (!opts.IsTestRun)
                    MessageBox.Show(this, "Music Player could not start.\n\n" + ex.Message, "Music Player",
                        MessageBoxButtons.OK, MessageBoxIcon.Error);
                Close();
            }
        }

        // If the page's process dies, bring the player back instead of leaving a
        // dead window - at most once every 15 s, so a crash loop cannot spin; a
        // second crash inside that time is reloaded when the 15 s are up.
        // "Unresponsive" is only written to the log: the page can stall for a
        // while when a game takes the whole machine, and reloading would stop the
        // music for nothing.
        void OnProcessFailed(object sender, CoreWebView2ProcessFailedEventArgs e)
        {
            WriteLog("engine: process failed (" + e.ProcessFailedKind + ")");
            if (e.ProcessFailedKind != CoreWebView2ProcessFailedKind.RenderProcessExited) return;
            double since = (DateTime.UtcNow - lastCrashReload).TotalSeconds;
            if (since >= 15) { ReloadNow(); return; }
            if (reloadTimer != null) return;                 // one is waiting already
            reloadTimer = new System.Windows.Forms.Timer();
            reloadTimer.Interval = (int)Math.Max(500, (15 - since) * 1000);
            reloadTimer.Tick += delegate
            {
                reloadTimer.Stop();
                reloadTimer.Dispose();
                reloadTimer = null;
                ReloadNow();
            };
            reloadTimer.Start();
        }

        void ReloadNow()
        {
            lastCrashReload = DateTime.UtcNow;
            try { web.CoreWebView2.Reload(); } catch { }
        }

        static bool IsAppleHost(Uri u)
        {
            string host = u.Host.ToLowerInvariant();
            return host == "apple.com" || host.EndsWith(".apple.com") || host.EndsWith(".icloud.com");
        }

        // Apple's own pop-ups (sign-in) stay inside the app; anything else that
        // wants a new window opens in the normal browser instead.
        void OnNewWindow(object sender, CoreWebView2NewWindowRequestedEventArgs e)
        {
            Uri u;
            if (!Uri.TryCreate(e.Uri, UriKind.Absolute, out u)) return;
            if (u.Scheme != Uri.UriSchemeHttps && u.Scheme != Uri.UriSchemeHttp) { e.Handled = true; return; }
            if (IsAppleHost(u)) return;
            e.Handled = true;
            try { Process.Start(new ProcessStartInfo(u.AbsoluteUri) { UseShellExecute = true }); } catch { }
        }

        // The same for a link that would replace the player itself: another site
        // opens in the normal browser, a file or anything else is refused - the
        // window has no back button to come back from there.
        void OnNavigationStarting(object sender, CoreWebView2NavigationStartingEventArgs e)
        {
            Uri u;
            if (!Uri.TryCreate(e.Uri, UriKind.Absolute, out u)) { e.Cancel = true; return; }
            if (u.Scheme == "about" || u.Scheme == "data") return;
            if ((u.Scheme == Uri.UriSchemeHttps || u.Scheme == Uri.UriSchemeHttp) && IsAppleHost(u)) return;
            e.Cancel = true;
            if (u.Scheme == Uri.UriSchemeHttps || u.Scheme == Uri.UriSchemeHttp)
            {
                try { Process.Start(new ProcessStartInfo(u.AbsoluteUri) { UseShellExecute = true }); } catch { }
            }
        }

        // ------------------------------------------------- is the window seen? --
        // While the window is minimised, on a hidden virtual desktop, or covered
        // by the window in front (a fullscreen game, a maximised app), the page is
        // told so ("seen|0") and stops its animations - the visualizer, the level
        // bars, the lyrics - and with them the sound capture. Nothing is drawn
        // for nobody. "seen|1" starts them again. Checked once a second.
        [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
        [DllImport("user32.dll")] static extern IntPtr GetWindow(IntPtr hwnd, uint cmd);
        [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr hwnd, out RECT rect);
        [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
        [DllImport("user32.dll")] static extern int GetWindowLong(IntPtr hwnd, int index);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr hwnd, StringBuilder name, int max);
        [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr hwnd, int attr, out int value, int size);
        [StructLayout(LayoutKind.Sequential)] struct RECT { public int Left, Top, Right, Bottom; }

        // ------------------------------------------- compact player on top --
        // With "keep on top" on, the compact player stays above every other
        // window - a fullscreen browser, a game in windowed-fullscreen mode -
        // by putting itself back on top whenever something else took the top
        // spot. It never takes the keyboard focus doing so. (A game in true
        // "exclusive" fullscreen owns the whole screen; no ordinary window can
        // be shown over it.)
        delegate void WinEventProc(IntPtr hook, uint ev, IntPtr hwnd, int idObject, int idChild, uint thread, uint time);
        [DllImport("user32.dll")] static extern IntPtr SetWinEventHook(uint evMin, uint evMax, IntPtr module, WinEventProc proc, uint pid, uint tid, uint flags);
        [DllImport("user32.dll")] static extern bool UnhookWinEvent(IntPtr hook);
        [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr hwnd, IntPtr after, int x, int y, int cx, int cy, uint flags);
        WinEventProc fgProc;                    // (kept in a field so it is not collected while Windows holds it)
        IntPtr fgHook;
        System.Windows.Forms.Timer fgLater;

        void KeepOnTop()
        {
            if (!compact || !wantOnTop || !Visible || WindowState == FormWindowState.Minimized) return;
            try
            {
                if (!TopMost) TopMost = true;
                // HWND_TOPMOST; SWP_NOSIZE | SWP_NOMOVE | SWP_NOACTIVATE | SWP_NOOWNERZORDER
                SetWindowPos(Handle, new IntPtr(-1), 0, 0, 0, 0, 0x0001 | 0x0002 | 0x0010 | 0x0200);
            }
            catch { }
        }

        System.Windows.Forms.Timer seenTimer, reloadTimer;
        int seenSent = -1;                      // -1 nothing sent yet, else 0 / 1
        readonly uint myPid = (uint)Process.GetCurrentProcess().Id;

        void StartSeenWatch()
        {
            seenTimer = new System.Windows.Forms.Timer();
            seenTimer.Interval = 1000;
            seenTimer.Tick += delegate { CheckSeen(); KeepOnTop(); };
            // and at once whenever another window comes to the front (a game
            // being alt-tabbed into, say): out-of-context, so it arrives through
            // this thread's own message loop
            fgProc = delegate
            {
                KeepOnTop();
                if (fgLater == null)
                {
                    fgLater = new System.Windows.Forms.Timer();
                    fgLater.Interval = 400;      // once more a moment later: some apps put themselves on top a little after
                    fgLater.Tick += delegate { fgLater.Stop(); KeepOnTop(); };
                }
                fgLater.Stop();
                fgLater.Start();
            };
            fgHook = SetWinEventHook(3 /* EVENT_SYSTEM_FOREGROUND */, 3, IntPtr.Zero, fgProc, 0, 0, 0 /* out of context */ | 2 /* skip own process */);
            seenTimer.Start();
            Resize += delegate { CheckSeen(); };
            Activated += delegate { CheckSeen(); };
            Deactivate += delegate { CheckSeen(); };
        }

        bool IsSeen()
        {
            if (!Visible || WindowState == FormWindowState.Minimized) return false;
            int cloaked;
            if (DwmGetWindowAttribute(Handle, 14 /* DWMWA_CLOAKED */, out cloaked, 4) == 0 && cloaked != 0) return false;
            if (TopMost) return true;
            IntPtr fg = GetForegroundWindow();
            if (fg == IntPtr.Zero || fg == Handle) return true;
            uint pid;
            GetWindowThreadProcessId(fg, out pid);
            if (pid == myPid) return true;
            // see-through overlays and the desktop itself cover nothing
            int ex = GetWindowLong(fg, -20 /* GWL_EXSTYLE */);
            if ((ex & 0x00080000) != 0 || (ex & 0x00000020) != 0) return true;     // WS_EX_LAYERED, WS_EX_TRANSPARENT
            var cls = new StringBuilder(64);
            GetClassName(fg, cls, 64);
            string c = cls.ToString();
            if (c == "Progman" || c == "WorkerW" || c == "Shell_TrayWnd" || c == "Shell_SecondaryTrayWnd") return true;
            RECT a, b;
            if (!GetWindowRect(fg, out a) || !GetWindowRect(Handle, out b)) return true;
            if (a.Left > b.Left || a.Top > b.Top || a.Right < b.Right || a.Bottom < b.Bottom) return true;
            // it covers our area - but is it in front of us?
            IntPtr h = GetWindow(fg, 2 /* GW_HWNDNEXT */);
            for (int i = 0; i < 3000 && h != IntPtr.Zero; i++)
            {
                if (h == Handle) return false;
                h = GetWindow(h, 2);
            }
            return true;
        }

        void CheckSeen()
        {
            int seen = 1;
            try { seen = IsSeen() ? 1 : 0; } catch { }
            if (seen == seenSent) return;
            try
            {
                if (web == null || web.CoreWebView2 == null) return;
                web.CoreWebView2.PostWebMessageAsString("seen|" + seen);
                seenSent = seen;
            }
            catch { }
        }

        // ------------------------------------------------------ messages from page

        void OnWebMessage(object sender, CoreWebView2WebMessageReceivedEventArgs e)
        {
            string source = e.Source ?? "";
            if (!source.StartsWith(AppOrigin, StringComparison.OrdinalIgnoreCase)) return;

            string msg;
            try { msg = e.TryGetWebMessageAsString(); } catch { return; }
            if (string.IsNullOrEmpty(msg) || msg.Length > 600) return;
            if (opts.IsTestRun) testLog.AppendLine(msg);

            string[] p = msg.Split('|');
            int a, b;
            switch (p[0])
            {
                case "theme":   // theme|<page dark 0/1>|<caption RRGGBB>|<text RRGGBB>|<caption dark 0/1>
                    if (p.Length >= 4 && TryHex(p[2], out a) && TryHex(p[3], out b))
                    {
                        darkScheme = p[1] == "1";
                        captionDark = p.Length >= 5 ? p[4] == "1" : darkScheme;
                        captionRgb = a;
                        textRgb = b;
                        BackColor = FromRgb(captionRgb);
                        ApplyTitleBar();
                        try
                        {
                            web.CoreWebView2.Profile.PreferredColorScheme = darkScheme
                                ? CoreWebView2PreferredColorScheme.Dark
                                : CoreWebView2PreferredColorScheme.Light;
                        }
                        catch { }
                    }
                    break;

                case "compact": // compact|1|<width>|<height>  (CSS px)   or   compact|0
                    if (p.Length >= 4 && p[1] == "1" && int.TryParse(p[2], out a) && int.TryParse(p[3], out b))
                        EnterCompact(Clamp(a, 320, 1400), Clamp(b, 120, 1800));
                    else if (p.Length >= 2 && p[1] == "0")
                        LeaveCompact();
                    break;

                case "ontop":   // ontop|0/1
                    wantOnTop = p.Length >= 2 && p[1] == "1";
                    TopMost = compact && wantOnTop;
                    KeepOnTop();
                    break;

                case "log":     // log|<text>  one line for player.log (the page limits how many)
                    WriteLog(msg.Substring(4));
                    break;

                case "tap":     // tap|1 = the visualizer wants sound (repeated while it does), tap|0 = stop
                    if (feed != null)
                    {
                        if (p.Length >= 2 && p[1] == "1") feed.Want(); else feed.Stop();
                    }
                    break;

                case "title":   // title|<text>
                    string t = msg.Length > 6 ? msg.Substring(6).Trim() : "";
                    Text = t.Length == 0 ? "Music Player" : t;
                    break;
            }
        }

        // ------------------------------------------------------------ compact mode

        double DpiScale
        {
            get
            {
                try { if (IsHandleCreated) return GetDpiForWindow(Handle) / 96.0; } catch { }
                return 1.0;
            }
        }

        int Px(int cssPx) { return (int)Math.Round(cssPx * DpiScale); }

        Size pendingCompact = Size.Empty;       // asked for while minimised: done when the window comes back

        void EnterCompact(int width, int height)
        {
            if (WindowState == FormWindowState.Minimized)
            {
                // not now: changing the window would bring it back on screen,
                // perhaps in the middle of a game
                pendingCompact = new Size(width, height);
                return;
            }
            pendingCompact = Size.Empty;
            bool entering = !compact;
            if (entering)
            {
                fullMaximized = WindowState == FormWindowState.Maximized;
                fullBounds = WindowState == FormWindowState.Normal ? Bounds : RestoreBounds;
                if (WindowState != FormWindowState.Normal) WindowState = FormWindowState.Normal;
                compact = true;
            }

            // the transport row needs about 470 px; do not let it be squeezed
            MinimumSize = new Size(Px(486), Px(200));
            Size wanted = new Size(Px(width), Px(height));
            if (ClientSize != wanted) ClientSize = wanted;

            if (entering && hasCompactPos) Location = compactPos;
            KeepOnScreen();
            TopMost = wantOnTop;
            KeepOnTop();
        }

        void LeaveCompact()
        {
            pendingCompact = Size.Empty;
            if (!compact) return;
            compactPos = Location;
            hasCompactPos = true;
            compact = false;
            TopMost = false;
            Bounds = fullBounds;
            MinimumSize = new Size(Px(520), Px(420));
            if (fullMaximized) WindowState = FormWindowState.Maximized;
            KeepOnScreen();
        }

        void KeepOnScreen()
        {
            if (WindowState != FormWindowState.Normal) return;
            Rectangle wa = Screen.FromRectangle(Bounds).WorkingArea;
            int x = Math.Max(wa.Left, Math.Min(Left, wa.Right - Width));
            int y = Math.Max(wa.Top, Math.Min(Top, wa.Bottom - Height));
            if (x != Left || y != Top) Location = new Point(x, y);
        }

        // ------------------------------------------------------- title bar + icon

        void ApplyTitleBar()
        {
            if (!IsHandleCreated) return;
            try
            {
                int dark = captionDark ? 1 : 0;
                DwmSetWindowAttribute(Handle, DWMWA_USE_IMMERSIVE_DARK_MODE, ref dark, 4);
                int caption = ToColorRef(captionRgb);
                DwmSetWindowAttribute(Handle, DWMWA_CAPTION_COLOR, ref caption, 4);
                DwmSetWindowAttribute(Handle, DWMWA_BORDER_COLOR, ref caption, 4);
                int text = ToColorRef(textRgb);
                DwmSetWindowAttribute(Handle, DWMWA_TEXT_COLOR, ref text, 4);
            }
            catch { }
        }

        void LoadWindowIcon()
        {
            try
            {
                string path = Path.Combine(appDir, "player.ico");
                if (!File.Exists(path)) return;
                float dpi;
                using (Graphics g = Graphics.FromHwnd(IntPtr.Zero)) dpi = g.DpiX;
                int want = (int)Math.Round(32 * dpi / 96.0);
                int size = want <= 32 ? 32 : want <= 40 ? 40 : want <= 48 ? 48 : 64;
                Icon = new Icon(path, new Size(size, size));
            }
            catch { }
        }

        // RRGGBB -> Win32 COLORREF (0x00BBGGRR)
        static int ToColorRef(int rgb) { return ((rgb & 0xFF) << 16) | (rgb & 0xFF00) | ((rgb >> 16) & 0xFF); }
        static Color FromRgb(int rgb) { return Color.FromArgb((rgb >> 16) & 0xFF, (rgb >> 8) & 0xFF, rgb & 0xFF); }
        static int Clamp(int v, int lo, int hi) { return v < lo ? lo : v > hi ? hi : v; }

        static bool TryHex(string s, out int value)
        {
            value = 0;
            return s != null && s.Length == 6 &&
                   int.TryParse(s, NumberStyles.HexNumber, CultureInfo.InvariantCulture, out value);
        }

        // ------------------------------------------------------ saved window state

        void PlaceDefault()
        {
            float dpi;
            using (Graphics g = Graphics.FromHwnd(IntPtr.Zero)) dpi = g.DpiX;
            double s = dpi / 96.0;
            Rectangle wa = Screen.PrimaryScreen.WorkingArea;
            int w = Math.Min((int)(1280 * s), wa.Width - 60);
            int h = Math.Min((int)(860 * s), wa.Height - 60);
            Bounds = new Rectangle(wa.Left + (wa.Width - w) / 2, wa.Top + (wa.Height - h) / 2, w, h);
            MinimumSize = new Size((int)(520 * s), (int)(420 * s));
        }

        void RestoreState()
        {
            try
            {
                if (!File.Exists(statePath)) return;
                foreach (string line in File.ReadAllLines(statePath))
                {
                    int eq = line.IndexOf('=');
                    if (eq < 1) continue;
                    string key = line.Substring(0, eq), val = line.Substring(eq + 1);
                    string[] n = val.Split(',');
                    int a, b, c, d;
                    switch (key)
                    {
                        case "bounds":
                            if (n.Length == 4 && int.TryParse(n[0], out a) && int.TryParse(n[1], out b) &&
                                int.TryParse(n[2], out c) && int.TryParse(n[3], out d))
                            {
                                Rectangle r = new Rectangle(a, b, c, d);
                                if (IsVisibleOnAScreen(r)) Bounds = r;
                            }
                            break;
                        case "maximized":
                            if (val == "1") WindowState = FormWindowState.Maximized;
                            break;
                        case "compactPos":
                            if (n.Length == 2 && int.TryParse(n[0], out a) && int.TryParse(n[1], out b))
                            {
                                compactPos = new Point(a, b);
                                hasCompactPos = IsVisibleOnAScreen(new Rectangle(a, b, 200, 100));
                            }
                            break;
                        case "dark": darkScheme = val == "1"; break;
                        case "captionDark": captionDark = val == "1"; break;
                        case "caption": if (TryHex(val, out a)) captionRgb = a; break;
                        case "text": if (TryHex(val, out a)) textRgb = a; break;
                    }
                }
            }
            catch { }
        }

        static bool IsVisibleOnAScreen(Rectangle r)
        {
            if (r.Width < 200 || r.Height < 100) return false;
            foreach (Screen s in Screen.AllScreens)
            {
                Rectangle i = Rectangle.Intersect(s.WorkingArea, r);
                if (i.Width >= 120 && i.Height >= 80) return true;
            }
            return false;
        }

        // A small log of what happened (player.log beside window.txt): starts,
        // failures, what the player was doing. Kept under 512 KB: when it gets
        // there it is moved to player.old.log and a new one is begun.
        void WriteLog(string text)
        {
            if (opts.IsTestRun) return;
            try
            {
                string path = Path.Combine(dataDir, "player.log");
                var fi = new FileInfo(path);
                if (fi.Exists && fi.Length > 512 * 1024)
                {
                    string old = Path.Combine(dataDir, "player.old.log");
                    if (File.Exists(old)) File.Delete(old);
                    File.Move(path, old);
                }
                string clean = text.Replace('\r', ' ').Replace('\n', ' ');
                File.AppendAllText(path, DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + "  " + clean + Environment.NewLine, Encoding.UTF8);
            }
            catch { }
        }

        void OnClosing(object sender, FormClosingEventArgs e)
        {
            try { if (feed != null) feed.Stop(); } catch { }
            try { if (fgHook != IntPtr.Zero) { UnhookWinEvent(fgHook); fgHook = IntPtr.Zero; } } catch { }
            if (opts.IsTestRun) return;
            try
            {
                Rectangle full;
                bool max;
                if (compact)
                {
                    full = fullBounds;
                    max = fullMaximized;
                    compactPos = Location;
                    hasCompactPos = true;
                }
                else
                {
                    max = WindowState == FormWindowState.Maximized;
                    full = WindowState == FormWindowState.Normal ? Bounds : RestoreBounds;
                }

                var sb = new StringBuilder();
                sb.AppendLine("bounds=" + full.X + "," + full.Y + "," + full.Width + "," + full.Height);
                sb.AppendLine("maximized=" + (max ? "1" : "0"));
                if (hasCompactPos) sb.AppendLine("compactPos=" + compactPos.X + "," + compactPos.Y);
                sb.AppendLine("dark=" + (darkScheme ? "1" : "0"));
                sb.AppendLine("captionDark=" + (captionDark ? "1" : "0"));
                sb.AppendLine("caption=" + captionRgb.ToString("x6"));
                sb.AppendLine("text=" + textRgb.ToString("x6"));
                File.WriteAllText(statePath, sb.ToString());
            }
            catch { }
        }

        // ------------------------------------------------------------- test runs
        // MusicPlayer.exe --data-dir <dir> [--url u] [--script file.js]
        //                 [--result out.json] [--capture out.png]
        // Loads the page, optionally runs a script, saves what the page looks
        // like, then exits. Used to check the skin without a person watching.

        async void OnNavigationCompleted(object sender, CoreWebView2NavigationCompletedEventArgs e)
        {
            if ((opts.Capture == null && opts.Script == null) || testStarted) return;
            testStarted = true;
            try
            {
                await Task.Delay(opts.Delay);
                if (opts.Script != null)
                    await web.CoreWebView2.ExecuteScriptAsync(File.ReadAllText(opts.Script, Encoding.UTF8));
                await Task.Delay(opts.Settle);

                if (opts.Result != null)
                {
                    string r = await web.CoreWebView2.ExecuteScriptAsync(
                        "JSON.stringify(window.__mpResult === undefined ? null : window.__mpResult)");
                    TryWrite(opts.Result, r);
                    testLog.AppendLine("# client=" + ClientSize.Width + "x" + ClientSize.Height +
                                       " compact=" + compact + " topmost=" + TopMost +
                                       " dark=" + darkScheme + " caption=" + captionRgb.ToString("x6") +
                                       " title=" + Text);
                    TryWrite(opts.Result + ".log", testLog.ToString());
                }
                if (opts.Capture != null)
                {
                    using (FileStream fs = File.Create(opts.Capture))
                        await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, fs);
                }
            }
            catch (Exception ex)
            {
                if (opts.Result != null) TryWrite(opts.Result + ".err", ex.ToString());
            }
            Close();
        }

        static void TryWrite(string path, string text)
        {
            try { File.WriteAllText(path, text, Encoding.UTF8); } catch { }
        }

        // Best effort: fails harmlessly if the folder is missing or in use.
        static void TryDeleteDirectory(string path)
        {
            try { if (Directory.Exists(path)) Directory.Delete(path, true); } catch { }
        }

        // Quote a string as a JavaScript string literal.
        static string JsString(string s)
        {
            var sb = new StringBuilder(s.Length + 64);
            sb.Append('"');
            foreach (char c in s)
            {
                switch (c)
                {
                    case '\\': sb.Append("\\\\"); break;
                    case '"': sb.Append("\\\""); break;
                    case '\n': sb.Append("\\n"); break;
                    case '\r': break;
                    case '\t': sb.Append("\\t"); break;
                    default:
                        // control characters and the two Unicode line separators
                        // (0x2028 / 0x2029) may not appear raw in a JS string literal
                        if (c < 0x20 || c == (char)0x2028 || c == (char)0x2029)
                            sb.Append("\\u").Append(((int)c).ToString("x4"));
                        else sb.Append(c);
                        break;
                }
            }
            sb.Append('"');
            return sb.ToString();
        }
    }
}
