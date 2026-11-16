// Music Player - the song that is playing, for when the listener is busy with
// something else.
//
// The page tells the app about the song (see "Now playing, for the app" in
// app\ui\player.js); with that the app can
//   - slide a small card into a corner of the screen when the song changes,
//     over whatever is in front (ToastWindow). It never takes the keyboard or
//     the mouse: clicks go straight through it.
//   - show the song on the listener's Discord profile (DiscordPresence), by
//     talking to the Discord app on this PC over its local pipe. Nothing goes
//     anywhere unless the listener switched that on and gave it an
//     application ID of their own.
//
// C# 5 syntax only, like the rest (see MusicPlayer.cs).

using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Text;
using System.Globalization;
using System.IO;
using System.IO.Pipes;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows.Forms;

namespace MusicPlayerApp
{
    // One "np|..." message from the page.
    internal sealed class NowPlaying
    {
        public string State = "stop";       // play | pause | stop
        public string Key = "";             // which song (and where in the queue)
        public string Title = "", Artist = "", Album = "", ArtUrl = "";
        public long DurMs, PosMs;
        public DateTime At = DateTime.UtcNow;
        // body top, body bottom, lettering, lamp, display, display ink (RRGGBB)
        public int[] Colours = { 0x263145, 0x141a27, 0xcfdaec, 0x5aa9ff, 0x050a12, 0x7cc4ff };
        public Image Art;                   // a small copy of the cover, when the page had one

        public bool Playing { get { return State == "play" && Title.Length > 0; } }

        static string Clip(string s, int max)
        {
            s = (s ?? "").Trim();
            return s.Length > max ? s.Substring(0, max) : s;
        }

        // The fields are separated by the character 0x1F (see player.js).
        public static NowPlaying Parse(string body)
        {
            string[] f = body.Split('\u001f');
            if (f.Length < 9) return null;
            var np = new NowPlaying();
            if (f[0] == "play" || f[0] == "pause" || f[0] == "stop") np.State = f[0];
            np.Key = Clip(f[1], 80);
            np.Title = Clip(f[2], 200);
            np.Artist = Clip(f[3], 200);
            np.Album = Clip(f[4], 200);
            long n;
            if (long.TryParse(f[5], out n) && n >= 0 && n < 86400000L) np.DurMs = n;
            if (long.TryParse(f[6], out n) && n >= 0 && n < 86400000L) np.PosMs = n;
            string url = Clip(f[7], 400);
            if (url.StartsWith("https://", StringComparison.OrdinalIgnoreCase) && url.IndexOf('"') < 0 && url.IndexOf('\\') < 0) np.ArtUrl = url;

            string[] c = f[8].Split(',');
            if (c.Length == 6)
            {
                var cols = new int[6];
                bool ok = true;
                for (int i = 0; i < 6; i++)
                    ok &= c[i].Length == 6 && int.TryParse(c[i], NumberStyles.HexNumber, CultureInfo.InvariantCulture, out cols[i]);
                if (ok) np.Colours = cols;
            }

            if (f.Length > 9 && f[9].Length > 200 && f[9].Length < 40000)
            {
                try
                {
                    Image img = Image.FromStream(new MemoryStream(Convert.FromBase64String(f[9])));
                    if (img.Width >= 16 && img.Width <= 600 && img.Height >= 16 && img.Height <= 600) np.Art = img;
                }
                catch { }
            }
            return np;
        }
    }

    // ------------------------------------------------------------- the card --
    internal sealed class ToastWindow : Form
    {
        [StructLayout(LayoutKind.Sequential)] struct POINT { public int X, Y; }
        [DllImport("user32.dll")] static extern IntPtr MonitorFromPoint(POINT pt, uint flags);
        [DllImport("shcore.dll")] static extern int GetDpiForMonitor(IntPtr monitor, int type, out uint dpiX, out uint dpiY);
        [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr hwnd, IntPtr after, int x, int y, int cx, int cy, uint flags);
        [DllImport("dwmapi.dll")] static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int value, int size);

        const int InMs = 240, HoldMs = 4600, OutMs = 420;

        readonly System.Windows.Forms.Timer timer = new System.Windows.Forms.Timer();
        NowPlaying info;
        Image fallbackArt;                  // the app's own picture, when a song has none
        double scale = 1;
        Point home;
        int slide;
        int phase;                          // 0 hidden, 1 coming, 2 staying, 3 going
        DateTime t0, lastTop;
        public Action Settled;              // (tests) called once a card is fully in view

        public ToastWindow(Image fallback)
        {
            fallbackArt = fallback;
            FormBorderStyle = FormBorderStyle.None;
            ShowInTaskbar = false;
            StartPosition = FormStartPosition.Manual;
            AutoScaleMode = AutoScaleMode.None;
            Text = "Music Player - now playing";
            Opacity = 0;
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint | ControlStyles.OptimizedDoubleBuffer, true);
            timer.Interval = 15;
            timer.Tick += delegate { Step(); };
        }

        // Above everything, never focused, not in the taskbar or Alt+Tab, and
        // the mouse goes through it.
        protected override CreateParams CreateParams
        {
            get
            {
                CreateParams cp = base.CreateParams;
                cp.ExStyle |= 0x00000008 /* WS_EX_TOPMOST */ | 0x00000080 /* WS_EX_TOOLWINDOW */ |
                              0x08000000 /* WS_EX_NOACTIVATE */ | 0x00000020 /* WS_EX_TRANSPARENT */ |
                              0x00080000 /* WS_EX_LAYERED */;
                return cp;
            }
        }
        protected override bool ShowWithoutActivation { get { return true; } }

        protected override void OnHandleCreated(EventArgs e)
        {
            base.OnHandleCreated(e);
            try
            {
                int round = 2;              // DWMWCP_ROUND (Windows 11; ignored before)
                DwmSetWindowAttribute(Handle, 33 /* DWMWA_WINDOW_CORNER_PREFERENCE */, ref round, 4);
            }
            catch { }
        }

        static double ScaleAt(Rectangle area)
        {
            try
            {
                POINT p;
                p.X = area.Left + area.Width / 2;
                p.Y = area.Top + area.Height / 2;
                uint dx, dy;
                if (GetDpiForMonitor(MonitorFromPoint(p, 2 /* nearest */), 0, out dx, out dy) == 0 && dx >= 72 && dx <= 960) return dx / 96.0;
            }
            catch { }
            return 1.0;
        }

        // corner: tl | tr | bl | br      area: the part of the screen to keep inside
        public void ShowCard(NowPlaying np, string corner, Rectangle area)
        {
            if (np == null) return;
            if (corner == null || corner.Length != 2) corner = "tr";
            info = np;
            scale = ScaleAt(area);
            int w = (int)Math.Round(372 * scale), h = (int)Math.Round(92 * scale), m = (int)Math.Round(18 * scale);
            bool left = corner[1] == 'l', top = corner[0] == 't';
            home = new Point(left ? area.Left + m : area.Right - m - w, top ? area.Top + m : area.Bottom - m - h);
            slide = (int)Math.Round(30 * scale) * (left ? -1 : 1);

            try
            {
                int edge = Shade(np.Colours[1], 0.45);
                int colour = ((edge & 0xFF) << 16) | (edge & 0xFF00) | ((edge >> 16) & 0xFF);
                DwmSetWindowAttribute(Handle, 34 /* DWMWA_BORDER_COLOR */, ref colour, 4);
            }
            catch { }

            Size = new Size(w, h);
            if (!Visible || phase == 0 || phase == 3)
            {
                phase = 1;
                Alpha(0);
                Location = new Point(home.X + slide, home.Y);
                Visible = true;
            }
            else
            {
                phase = 2;                  // already up: the new song takes its place
                Location = home;
                Alpha(1);
            }
            t0 = DateTime.UtcNow;
            StayOnTop();
            Invalidate();
            timer.Start();
        }

        // the cover arrived a moment after the song: put it on the card that is up
        public void Repaint(NowPlaying np)
        {
            if (np == null || phase == 0) return;
            info = np;
            Invalidate();
        }

        // (never quite 1: at exactly 1 Windows Forms stops telling Windows the
        // card's opacity, and it would stay at whatever it was before)
        void Alpha(double a) { Opacity = a < 0 ? 0 : a > 0.996 ? 0.996 : a; }

        void StayOnTop()
        {
            lastTop = DateTime.UtcNow;
            try
            {
                // HWND_TOPMOST; SWP_NOSIZE | SWP_NOMOVE | SWP_NOACTIVATE | SWP_NOOWNERZORDER
                SetWindowPos(Handle, new IntPtr(-1), 0, 0, 0, 0, 0x0001 | 0x0002 | 0x0010 | 0x0200);
            }
            catch { }
        }

        void Step()
        {
            DateTime now = DateTime.UtcNow;
            double t = (now - t0).TotalMilliseconds;
            if ((now - lastTop).TotalMilliseconds > 400) StayOnTop();
            if (phase == 1)
            {
                double k = Math.Min(1, t / InMs), e = 1 - (1 - k) * (1 - k) * (1 - k);
                Alpha(e);
                Location = new Point(home.X + (int)Math.Round(slide * (1 - e)), home.Y);
                if (k >= 1)
                {
                    phase = 2;
                    t0 = now;
                    if (Settled != null) { try { Settled(); } catch { } }
                }
            }
            else if (phase == 2)
            {
                if (t > HoldMs) { phase = 3; t0 = now; }
            }
            else if (phase == 3)
            {
                double k = Math.Min(1, t / OutMs);
                Alpha(1 - k);
                if (k >= 1) { phase = 0; timer.Stop(); Visible = false; }
            }
            else timer.Stop();
        }

        // ---- drawing ----
        static Color Rgb(int rgb) { return Color.FromArgb((rgb >> 16) & 0xFF, (rgb >> 8) & 0xFF, rgb & 0xFF); }
        static int Mix(int a, int b, double shareOfA)
        {
            int r = (int)Math.Round(((a >> 16) & 0xFF) * shareOfA + ((b >> 16) & 0xFF) * (1 - shareOfA));
            int g = (int)Math.Round(((a >> 8) & 0xFF) * shareOfA + ((b >> 8) & 0xFF) * (1 - shareOfA));
            int bl = (int)Math.Round((a & 0xFF) * shareOfA + (b & 0xFF) * (1 - shareOfA));
            return (r << 16) | (g << 8) | bl;
        }
        static int Shade(int rgb, double keep) { return Mix(rgb, 0x000000, keep); }

        static GraphicsPath Round(RectangleF r, float radius)
        {
            float d = radius * 2;
            var p = new GraphicsPath();
            p.AddArc(r.X, r.Y, d, d, 180, 90);
            p.AddArc(r.Right - d, r.Y, d, d, 270, 90);
            p.AddArc(r.Right - d, r.Bottom - d, d, d, 0, 90);
            p.AddArc(r.X, r.Bottom - d, d, d, 90, 90);
            p.CloseFigure();
            return p;
        }

        float S(double v) { return (float)(v * scale); }

        protected override void OnPaint(PaintEventArgs e)
        {
            NowPlaying np = info;
            if (np == null) return;
            Graphics g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.InterpolationMode = InterpolationMode.HighQualityBicubic;
            g.PixelOffsetMode = PixelOffsetMode.HighQuality;
            g.TextRenderingHint = TextRenderingHint.ClearTypeGridFit;

            int shellA = np.Colours[0], shellB = np.Colours[1], lit = np.Colours[3], lcdBg = np.Colours[4], lcdFg = np.Colours[5];
            var all = new RectangleF(0, 0, ClientSize.Width, ClientSize.Height);

            // the body: the chassis gradient, a light line along the top
            using (var body = new LinearGradientBrush(all, Rgb(shellA), Rgb(shellB), 90f)) g.FillRectangle(body, all);
            using (var hi = new Pen(Rgb(Mix(0xffffff, shellA, 0.17)), 1f)) g.DrawLine(hi, 0, 0.5f, all.Width, 0.5f);

            // the display
            var lcd = new RectangleF(S(7), S(7), all.Width - S(14), all.Height - S(14));
            using (GraphicsPath p = Round(lcd, S(6)))
            {
                using (var b = new SolidBrush(Rgb(lcdBg))) g.FillPath(b, p);
                using (var pen = new Pen(Rgb(Shade(shellB, 0.42)), 1f)) g.DrawPath(pen, p);
            }

            // the cover
            float artSide = lcd.Height - S(14);
            var art = new RectangleF(lcd.X + S(7), lcd.Y + S(7), artSide, artSide);
            Image pic = np.Art ?? fallbackArt;
            using (GraphicsPath p = Round(art, S(4)))
            {
                if (pic != null)
                {
                    GraphicsState keep = g.Save();
                    g.SetClip(p);
                    try { g.DrawImage(pic, art); } catch { }
                    g.Restore(keep);
                }
                else using (var b = new SolidBrush(Rgb(Mix(lcdFg, lcdBg, 0.13)))) g.FillPath(b, p);
                using (var pen = new Pen(Rgb(Mix(lcdFg, lcdBg, 0.22)), 1f)) g.DrawPath(pen, p);
            }

            // the words
            float x = art.Right + S(11), wText = lcd.Right - S(9) - x;
            var fmt = new StringFormat(StringFormatFlags.NoWrap);
            fmt.Trimming = StringTrimming.EllipsisCharacter;
            fmt.LineAlignment = StringAlignment.Near;
            try
            {
                // a lamp and "NOW PLAYING" / its Japanese reading
                float capY = lcd.Y + S(9);
                using (var lamp = new SolidBrush(Rgb(lit))) g.FillEllipse(lamp, x, capY + S(3), S(6), S(6));
                // (sizes in pixels: the card is scaled for its screen by hand)
                using (var capFont = new Font("Segoe UI", S(9.6), FontStyle.Bold, GraphicsUnit.Pixel))
                using (var capBrush = new SolidBrush(Rgb(Mix(lcdFg, lcdBg, 0.7))))
                    g.DrawString("NOW PLAYING   再生中", capFont, capBrush, new RectangleF(x + S(11), capY - S(1), wText - S(11), S(16)), fmt);

                using (var titleFont = new Font("Segoe UI", S(15.5), FontStyle.Bold, GraphicsUnit.Pixel))
                using (var titleBrush = new SolidBrush(Rgb(Mix(lcdFg, 0xffffff, 0.55))))
                    g.DrawString(np.Title.Length > 0 ? np.Title : "Music Player", titleFont, titleBrush, new RectangleF(x - S(2), lcd.Y + S(25), wText + S(2), S(24)), fmt);

                string by = np.Artist;
                if (np.Album.Length > 0) by = by.Length > 0 ? by + "  •  " + np.Album : np.Album;
                using (var byFont = new Font("Segoe UI", S(11.8), FontStyle.Regular, GraphicsUnit.Pixel))
                using (var byBrush = new SolidBrush(Rgb(Mix(lcdFg, lcdBg, 0.82))))
                    g.DrawString(by, byFont, byBrush, new RectangleF(x - S(1), lcd.Y + S(50), wText + S(1), S(20)), fmt);
            }
            catch { }
            fmt.Dispose();
        }

        // (tests) what the card looks like right now
        public void SavePicture(string path)
        {
            try
            {
                using (var bmp = new Bitmap(ClientSize.Width, ClientSize.Height))
                {
                    DrawToBitmap(bmp, new Rectangle(Point.Empty, ClientSize));
                    bmp.Save(path, System.Drawing.Imaging.ImageFormat.Png);
                }
            }
            catch { }
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing) timer.Dispose();
            base.Dispose(disposing);
        }
    }

    // -------------------------------------------------------------- Discord --
    // The Discord app on this PC listens on a named pipe (discord-ipc-0 ... 9).
    // A message is: 4 bytes what it is, 4 bytes how long (both little-endian),
    // then JSON. First a handshake with the application ID, then SET_ACTIVITY
    // whenever the song changes. Closing the pipe clears it.
    internal sealed class DiscordPresence : IDisposable
    {
        const int OpHandshake = 0, OpFrame = 1, OpClose = 2, OpPing = 3, OpPong = 4;
        const int MinGapMs = 4200;          // Discord takes 5 updates per 20 seconds

        readonly Action<string> report;     // "on" | "wait" | "bad" | "err" | "off", for the settings panel
        readonly SynchronizationContext ui;
        readonly string testPipe;           // (tests) talk to this pipe instead of Discord's
        readonly object gate = new object(), writing = new object();
        readonly AutoResetEvent wake = new AutoResetEvent(false);
        readonly ManualResetEvent answered = new ManualResetEvent(false);
        readonly int pid = System.Diagnostics.Process.GetCurrentProcess().Id;

        bool enabled;
        string clientId = "";
        string want = "";                   // the activity wanted (JSON, or "" for none)
        string sent = null;                 // the one Discord has
        string badId = "";                  // an ID Discord turned down: not tried again
        string said = "";
        DateTime lastSend = DateTime.MinValue;
        Thread worker;
        volatile bool quit;
        volatile NamedPipeClientStream pipe;
        volatile bool ready, refused, broken;
        string pipeId = "";

        public DiscordPresence(SynchronizationContext uiContext, Action<string> reportState, string pipeForTests)
        {
            ui = uiContext;
            report = reportState;
            testPipe = pipeForTests;
        }

        static bool IsId(string s)
        {
            if (s == null || s.Length < 15 || s.Length > 22) return false;
            foreach (char c in s) if (c < '0' || c > '9') return false;
            return true;
        }

        public void Configure(bool on, string id)
        {
            lock (gate)
            {
                enabled = on && IsId(id);
                clientId = enabled ? id : "";
                if (worker == null && enabled)
                {
                    worker = new Thread(Run);
                    worker.IsBackground = true;
                    worker.Name = "Discord";
                    worker.Start();
                }
            }
            wake.Set();
        }

        string shownSong = "";              // what the wanted activity is about
        long shownStart;                    // and when that song started, as told to Discord

        public void Show(NowPlaying np)
        {
            bool playing = np != null && np.Playing;
            string song = playing ? np.Title + "\u001f" + np.Artist + "\u001f" + np.Album + "\u001f" + np.ArtUrl + "\u001f" + np.DurMs : "";
            long start = playing ? (long)(np.At - new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc)).TotalMilliseconds - np.PosMs : 0;
            lock (gate)
            {
                // the same song, about where it was said to be: nothing new for
                // Discord (it takes only a few updates a minute)
                if (playing && song == shownSong && Math.Abs(start - shownStart) < 3000) return;
                shownSong = song;
                shownStart = start;
                want = playing ? ActivityJson(np, start) : "";
            }
            wake.Set();
        }

        // ---- JSON by hand (nothing to install: no JSON library in .NET Framework's core) ----
        static string Q(string s)
        {
            var sb = new StringBuilder(s.Length + 8);
            sb.Append('"');
            foreach (char c in s)
            {
                if (c == '"' || c == '\\') sb.Append('\\').Append(c);
                else if (c < 0x20 || c == (char)0x2028 || c == (char)0x2029) sb.Append("\\u").Append(((int)c).ToString("x4"));
                else sb.Append(c);
            }
            return sb.Append('"').ToString();
        }

        // Discord wants 2 to 128 characters in each line it shows.
        static string Line(string s)
        {
            if (s.Length > 128) s = s.Substring(0, 127) + "…";
            if (s.Length == 1) s += "⠀";
            return s;
        }

        static string ActivityJson(NowPlaying np, long start)
        {
            var sb = new StringBuilder(512);
            sb.Append("{\"type\":2");                                   // 2 = "Listening to"
            sb.Append(",\"details\":").Append(Q(Line(np.Title)));
            if (np.Artist.Length > 0) sb.Append(",\"state\":").Append(Q(Line(np.Artist)));
            if (np.DurMs > 0)
                sb.Append(",\"timestamps\":{\"start\":").Append(start).Append(",\"end\":").Append(start + np.DurMs).Append('}');
            if (np.ArtUrl.Length > 0 && np.ArtUrl.Length <= 256)
            {
                sb.Append(",\"assets\":{\"large_image\":").Append(Q(np.ArtUrl));
                if (np.Album.Length > 0) sb.Append(",\"large_text\":").Append(Q(Line(np.Album)));
                sb.Append('}');
            }
            return sb.Append('}').ToString();
        }

        void Say(string state)
        {
            if (state == said) return;
            said = state;
            try { ui.Post(delegate { try { report(state); } catch { } }, null); } catch { }
        }

        // ---- the pipe ----
        bool Write(int op, string json)
        {
            NamedPipeClientStream p = pipe;
            if (p == null) return false;
            try
            {
                byte[] body = Encoding.UTF8.GetBytes(json), all = new byte[8 + body.Length];
                BitConverter.GetBytes(op).CopyTo(all, 0);
                BitConverter.GetBytes(body.Length).CopyTo(all, 4);
                body.CopyTo(all, 8);
                lock (writing) { p.Write(all, 0, all.Length); p.Flush(); }
                return true;
            }
            catch { return false; }
        }

        static bool ReadAll(Stream s, byte[] buf, int n)
        {
            int got = 0;
            while (got < n)
            {
                int r = s.Read(buf, got, n - got);
                if (r <= 0) return false;
                got += r;
            }
            return true;
        }

        // Everything Discord says is read here, on a thread of its own.
        void Listen(object o)
        {
            var p = (NamedPipeClientStream)o;
            var head = new byte[8];
            try
            {
                while (!quit && pipe == p)
                {
                    if (!ReadAll(p, head, 8)) break;
                    int op = BitConverter.ToInt32(head, 0), len = BitConverter.ToInt32(head, 4);
                    if (len < 0 || len > 1 << 20) break;
                    var body = new byte[len];
                    if (!ReadAll(p, body, len)) break;
                    string text = Encoding.UTF8.GetString(body);
                    if (op == OpPing) Write(OpPong, text);
                    else if (op == OpClose)
                    {
                        // 4000 = it does not know that application ID
                        if (text.IndexOf("4000", StringComparison.Ordinal) >= 0 || text.IndexOf("nvalid", StringComparison.Ordinal) >= 0) refused = true;
                        break;
                    }
                    else if (op == OpFrame && text.IndexOf("\"READY\"", StringComparison.Ordinal) >= 0) ready = true;
                    answered.Set();
                }
            }
            catch { }
            if (pipe == p) broken = true;
            answered.Set();
            wake.Set();
        }

        void Drop()
        {
            NamedPipeClientStream p = pipe;
            pipe = null;
            ready = false;
            sent = null;
            if (p != null) { try { p.Dispose(); } catch { } }
        }

        // Is the Discord app there at all? (Asking Windows for the list of pipes
        // is cheaper than knocking on ten doors every time.)
        bool DiscordIsThere()
        {
            if (testPipe != null) return true;
            try { return Directory.GetFiles(@"\\.\pipe\", "discord-ipc-*").Length > 0; }
            catch { return true; }              // the list cannot be read: just try
        }

        bool Connect(string id)
        {
            refused = false;
            broken = false;
            ready = false;
            if (!DiscordIsThere()) { Say("wait"); return false; }
            for (int i = 0; i < 10 && pipe == null; i++)
            {
                string name = testPipe ?? "discord-ipc-" + i;
                NamedPipeClientStream p = null;
                try
                {
                    p = new NamedPipeClientStream(".", name, PipeDirection.InOut, PipeOptions.Asynchronous);
                    p.Connect(testPipe != null ? 1500 : 120);
                    pipe = p;
                }
                catch
                {
                    if (p != null) { try { p.Dispose(); } catch { } }
                }
                if (testPipe != null) break;
            }
            if (pipe == null) { Say("wait"); return false; }

            pipeId = id;
            answered.Reset();
            var t = new Thread(Listen);
            t.IsBackground = true;
            t.Name = "Discord (listening)";
            t.Start(pipe);
            if (!Write(OpHandshake, "{\"v\":1,\"client_id\":" + Q(id) + "}")) { Drop(); Say("err"); return false; }
            answered.WaitOne(5000);
            if (refused) { badId = id; Drop(); Say("bad"); return false; }
            if (!ready) { Drop(); Say("err"); return false; }
            Say("on");
            return true;
        }

        void Run()
        {
            while (!quit)
            {
                wake.WaitOne(pipe == null ? 15000 : 30000);
                if (quit) break;
                bool on;
                string id, a;
                lock (gate) { on = enabled; id = clientId; a = want; }

                if (!on) { Drop(); Say("off"); continue; }
                if (broken || (pipe != null && pipeId != id)) { Drop(); broken = false; }
                if (id == badId) { Say("bad"); continue; }
                if (pipe == null && !Connect(id)) continue;
                if (a == (sent ?? "")) continue;

                int wait = MinGapMs - (int)Math.Min(MinGapMs, (DateTime.UtcNow - lastSend).TotalMilliseconds);
                if (wait > 0)
                {
                    Thread.Sleep(wait);
                    wake.Set();                 // then look again: the newest song wins
                    continue;
                }
                string msg = "{\"cmd\":\"SET_ACTIVITY\",\"args\":{\"pid\":" + pid +
                             (a.Length > 0 ? ",\"activity\":" + a : "") +
                             "},\"nonce\":" + Q(Guid.NewGuid().ToString()) + "}";
                if (Write(OpFrame, msg)) { sent = a; lastSend = DateTime.UtcNow; }
                else { Drop(); Say("err"); }
            }
            Drop();
        }

        public void Dispose()
        {
            quit = true;
            wake.Set();
            Drop();
        }
    }
}
