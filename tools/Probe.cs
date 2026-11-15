// Invisible test harness for the Music Player skin.
//
// Hosts a WebView2 under a message-only parent window, so nothing is ever
// shown on screen, nothing appears in the taskbar and focus never moves.
// It injects a skin (player.css + player.js from --ui), loads a page, runs a
// test script, and writes back what the page reported plus a screenshot.
//
// Build (no install needed; uses the app's own WebView2 DLLs):
//   %WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe /nologo /target:winexe /platform:x64
//       /out:Probe.exe /reference:..\app\Microsoft.Web.WebView2.Core.dll
//       /reference:System.Windows.Forms.dll /reference:System.Drawing.dll Probe.cs ..\src\AudioTap.cs
//   then keep Probe.exe next to copies of Microsoft.Web.WebView2.Core.dll and WebView2Loader.dll.
// Run:
//   Probe.exe --data-dir <profile folder> --ui <folder with player.css/js> --script test.js
//             --result out.json [--capture out.png] [--url u] [--size 1280x860]
//             [--delay ms] [--settle ms] [--no-skin] [--tap-pid <process id>]
//   The test script stores what it wants reported in window.__mpResult, and can ask
//   for extra screenshots with  window.chrome.webview.postMessage('shot|name').
//   The page is muted. It gets the same sound feed as in the app (see AudioTap.cs),
//   taken from this harness's own page, or from another process tree with --tap-pid
//   (e.g. the real player while it is playing: listening only, nothing changes there).
//   --data-dir %LOCALAPPDATA%\MusicPlayerApp uses the signed-in profile (works while
//   the app is running); any other folder is a fresh signed-out profile.
//// C# 5 only (built with the csc.exe that ships with Windows).

using System;
using System.Drawing;
using System.IO;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;

internal static class Probe
{
    static string url = "https://music.apple.com/us/new";
    static string dataDir, uiDir, script, result, capture;
    static int delay = 7000, settle = 4000, width = 1280, height = 860, tapPid, taps;
    static bool noSkin;
    static AudioFeed feed;
    static readonly StringBuilder log = new StringBuilder();
    static CoreWebView2Controller controller;
    static bool started;

    [System.Runtime.InteropServices.DllImport("user32.dll")]
    static extern bool SetProcessDpiAwarenessContext(IntPtr value);

    [STAThread]
    static int Main(string[] a)
    {
        // Same DPI mode as the app: processes that share a browser profile must
        // agree on it, or the engine refuses the second one (0x8007139F).
        try { SetProcessDpiAwarenessContext(new IntPtr(-4)); } catch { }

        for (int i = 0; i < a.Length; i++)
        {
            string next = i + 1 < a.Length ? a[i + 1] : null;
            switch (a[i])
            {
                case "--url": url = next; i++; break;
                case "--data-dir": dataDir = next; i++; break;
                case "--ui": uiDir = next; i++; break;
                case "--script": script = next; i++; break;
                case "--result": result = next; i++; break;
                case "--capture": capture = next; i++; break;
                case "--delay": delay = int.Parse(next); i++; break;
                case "--settle": settle = int.Parse(next); i++; break;
                case "--no-skin": noSkin = true; break;
                case "--tap-pid": tapPid = int.Parse(next); i++; break;
                case "--size":
                    string[] wh = next.Split('x');
                    width = int.Parse(wh[0]); height = int.Parse(wh[1]); i++;
                    break;
            }
        }
        if (dataDir == null || result == null) return 2;

        // awaits must come back to this thread: WebView2 is single-threaded
        SynchronizationContext.SetSynchronizationContext(new WindowsFormsSynchronizationContext());
        var ctx = new ApplicationContext();
        Start(ctx);

        // never hang around: hard stop after 3 minutes
        var guard = new System.Windows.Forms.Timer();
        guard.Interval = 180000;
        guard.Tick += delegate { Write(result + ".err", "timeout"); ctx.ExitThread(); };
        guard.Start();

        Application.Run(ctx);
        return 0;
    }

    static async void Start(ApplicationContext ctx)
    {
        try
        {
            // must match the app's own options when sharing its profile
            var envOpts = new CoreWebView2EnvironmentOptions(
                "--autoplay-policy=no-user-gesture-required --disable-component-update");
            CoreWebView2Environment env = await CoreWebView2Environment.CreateAsync(
                null, Path.Combine(dataDir, "WebView2"), envOpts);

            controller = await env.CreateCoreWebView2ControllerAsync(new IntPtr(-3) /* HWND_MESSAGE */);
            controller.Bounds = new Rectangle(0, 0, width, height);
            controller.IsVisible = true;

            CoreWebView2 core = controller.CoreWebView2;
            core.IsMuted = true;
            core.Profile.PreferredColorScheme = CoreWebView2PreferredColorScheme.Dark;

            if (!noSkin && uiDir != null)
            {
                string css = File.ReadAllText(Path.Combine(uiDir, "player.css"), Encoding.UTF8);
                string js = File.ReadAllText(Path.Combine(uiDir, "player.js"), Encoding.UTF8);
                string logo = "";
                string logoPath = Path.Combine(uiDir, "icon.png");
                if (File.Exists(logoPath))
                    logo = "data:image/png;base64," + Convert.ToBase64String(File.ReadAllBytes(logoPath));
                await core.AddScriptToExecuteOnDocumentCreatedAsync(
                    "(function(){\"use strict\";var __MP_CSS=" + JsString(css) + ";var __MP_ICON=" + JsString(logo) + ";\n" + js + "\n})();");
            }

            // the sound the page reacts to: this harness's own (muted) page by default,
            // or another process tree (--tap-pid), e.g. the real player while it plays
            int listenTo = tapPid != 0 ? tapPid : (int)core.BrowserProcessId;
            feed = new AudioFeed(listenTo, SynchronizationContext.Current,
                delegate(string msg) { core.PostWebMessageAsString(msg); });

            core.WebMessageReceived += async delegate(object s, CoreWebView2WebMessageReceivedEventArgs e)
            {
                try
                {
                    string m = e.TryGetWebMessageAsString();
                    if (m == "tap|1") { taps++; feed.Want(); return; }
                    if (m == "tap|0") { feed.Stop(); return; }
                    // a test may un-mute the page for a moment (it keeps its own volume near zero)
                    if (m == "mute|0") { core.IsMuted = false; return; }
                    if (m == "mute|1") { core.IsMuted = true; return; }
                    log.AppendLine(m);
                    // a test script can ask for extra screenshots: "shot|<name>"
                    if (m.StartsWith("shot|") && capture != null)
                    {
                        string name = m.Substring(5);
                        foreach (char bad in Path.GetInvalidFileNameChars()) name = name.Replace(bad, '_');
                        string file = Path.Combine(Path.GetDirectoryName(capture),
                            Path.GetFileNameWithoutExtension(capture) + "-" + name + ".png");
                        using (FileStream fs = File.Create(file))
                            await core.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, fs);
                        return;
                    }
                    // the skin asks the app window to resize for compact mode; mimic that
                    string[] p = m.Split('|');
                    int w, h;
                    if (p.Length >= 4 && p[0] == "compact" && p[1] == "1" && int.TryParse(p[2], out w) && int.TryParse(p[3], out h))
                        controller.Bounds = new Rectangle(0, 0, w, h);
                    else if (p.Length >= 2 && p[0] == "compact" && p[1] == "0")
                        controller.Bounds = new Rectangle(0, 0, width, height);
                }
                catch { }
            };

            core.NavigationCompleted += async delegate
            {
                if (started) return;
                started = true;
                try
                {
                    await Task.Delay(delay);
                    if (script != null)
                        await core.ExecuteScriptAsync(File.ReadAllText(script, Encoding.UTF8));
                    await Task.Delay(settle);
                    string r = await core.ExecuteScriptAsync(
                        "JSON.stringify(window.__mpResult === undefined ? null : window.__mpResult)");
                    Write(result, r);
                    if (taps > 0) log.AppendLine("(tap|1 x" + taps + ")");
                    Write(result + ".log", log.ToString());
                    if (capture != null)
                    {
                        using (FileStream fs = File.Create(capture))
                            await core.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, fs);
                    }
                }
                catch (Exception ex) { Write(result + ".err", ex.ToString()); }
                try { feed.Stop(); } catch { }
                try { core.IsMuted = true; } catch { }
                try { controller.Close(); } catch { }
                ctx.ExitThread();
            };
            core.Navigate(url);
        }
        catch (Exception ex)
        {
            Write(result + ".err", ex.ToString());
            ctx.ExitThread();
        }
    }

    static void Write(string path, string text)
    {
        try { File.WriteAllText(path, text, new UTF8Encoding(false)); } catch { }
    }

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
