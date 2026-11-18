// Music Player - audio tap
//
// Listens to what this app itself is playing, so the visualizer and the level
// bars can react to the music. Apple's songs are copy-protected and are
// decoded outside the web page (the page only ever sees silence), so the
// signal is picked up on its way to the speakers instead, using the Windows
// "process loopback" capture: only the sound of one process tree is heard,
// not games or other apps. Nothing is recorded or stored - the last fraction
// of a second is kept in memory and handed to the visualizer.
//
// Which process to listen to matters (measured on Windows 11, while a song
// was playing):
//   - ordinary sound (previews, anything unprotected) comes from the browser
//     engine's audio service and is heard by listening to the engine's
//     process tree;
//   - protected songs are played by a separate helper of the engine (its
//     "MediaFoundationService" process, which starts Windows' mfpmp.exe).
//     Listening to the engine's tree, or to the app's, gives silence for
//     these; listening to that helper itself gives the music.
// So AudioFeed below keeps two taps, one on each, and passes on whichever one
// is making sound.
//
// Needs Windows 10 version 2004 or later; on older systems Start() reports
// "failed" and the visualizer falls back to its built-in animation.
//
// C# 5 only (built with the csc.exe that ships with Windows).

using System;
using System.Runtime.InteropServices;
using System.Threading;

internal sealed class AudioTap : IDisposable
{
    public const int SampleRate = 44100;         // what we ask Windows to convert to (16-bit stereo)
    const int RingFrames = 8192;                 // about 0.19 s

    readonly int pid;
    readonly short[] ring = new short[RingFrames * 2];
    readonly object gate = new object();
    short[] scratch = new short[4096];
    long written;                                // stereo frames captured so far
    Thread thread;
    volatile bool stop;
    readonly ManualResetEvent wake = new ManualResetEvent(false);

    /// <summary>off | starting | on | failed</summary>
    public volatile string State = "off";
    public volatile int LastError;
    /// <summary>Raised on the capture thread whenever new audio has arrived.</summary>
    public Action OnData;

    public AudioTap(int processId) { pid = processId; }

    public bool Running { get { return thread != null; } }

    public void Start()
    {
        if (thread != null) return;
        stop = false;
        wake.Reset();
        var t = new Thread(Run);
        t.IsBackground = true;
        t.Name = "AudioTap";
        t.SetApartmentState(ApartmentState.MTA);
        thread = t;
        t.Start();
    }

    // Not waited for: the thread ends by itself within a fifth of a second, or
    // once Windows answers a request it is waiting on (up to 5 s). This is
    // called on the app window's thread, and waiting here (it used to, up to
    // 1.5 s for each of the two taps) held the whole window up - no clicks,
    // no drawing - every time the visualizer stopped or the helper changed.
    public void Stop()
    {
        Thread t = thread;
        if (t == null) return;
        thread = null;
        stop = true;
        wake.Set();
    }

    public void Dispose() { Stop(); }

    /// <summary>
    /// Copies the newest <paramref name="frames"/> stereo frames (L,R,L,R...) into dest and
    /// returns how many frames have been captured in total (so a reader can tell
    /// how many of them are new since its last call).
    /// </summary>
    public long Read(short[] dest, int frames)
    {
        if (frames > RingFrames) frames = RingFrames;
        lock (gate)
        {
            long have = Math.Min(written, frames);
            int missing = frames - (int)have;
            if (missing > 0) Array.Clear(dest, 0, missing * 2);
            long start = written - have;                     // absolute frame index
            int pos = (int)(start % RingFrames);
            int n = (int)have;
            int first = Math.Min(n, RingFrames - pos);
            Array.Copy(ring, pos * 2, dest, missing * 2, first * 2);
            if (n > first) Array.Copy(ring, 0, dest, (missing + first) * 2, (n - first) * 2);
            return written;
        }
    }

    void Push(IntPtr data, int frames, bool silent)
    {
        if (frames <= 0) return;
        if (frames > RingFrames) { data = IntPtr.Add(data, (frames - RingFrames) * 4); frames = RingFrames; }
        int n = frames * 2;
        if (scratch.Length < n) scratch = new short[n];
        if (silent || data == IntPtr.Zero) Array.Clear(scratch, 0, n);
        else Marshal.Copy(data, scratch, 0, n);
        lock (gate)
        {
            int pos = (int)(written % RingFrames);
            int first = Math.Min(frames, RingFrames - pos);
            Array.Copy(scratch, 0, ring, pos * 2, first * 2);
            if (frames > first) Array.Copy(scratch, first * 2, ring, 0, (frames - first) * 2);
            written += frames;
        }
    }

    void Run()
    {
        int failures = 0;
        while (!stop)
        {
            IAudioClient client = null;
            try
            {
                State = "starting";
                int hr = ActivateForProcess(pid, out client);
                if (hr < 0 || client == null) LastError = hr;
                else
                {
                    hr = Capture(client);
                    if (hr < 0) LastError = hr; else failures = 0;
                }
            }
            catch (Exception e) { LastError = Marshal.GetHRForException(e); }
            finally
            {
                if (client != null) { try { Marshal.ReleaseComObject(client); } catch { } }
            }
            if (stop) break;
            // could not start, or the stream went away (device change): try again in a while
            State = "failed";
            failures++;
            wake.WaitOne(failures > 5 ? 10000 : 2000);
        }
        State = "off";
    }

    int Capture(IAudioClient client)
    {
        IntPtr fmt = Marshal.AllocHGlobal(18);
        var evt = new AutoResetEvent(false);
        object capObj = null;
        bool started = false;
        try
        {
            Marshal.WriteInt16(fmt, 0, 1);                       // WAVE_FORMAT_PCM
            Marshal.WriteInt16(fmt, 2, 2);                       // channels
            Marshal.WriteInt32(fmt, 4, SampleRate);
            Marshal.WriteInt32(fmt, 8, SampleRate * 4);          // bytes per second
            Marshal.WriteInt16(fmt, 12, 4);                      // block align
            Marshal.WriteInt16(fmt, 14, 16);                     // bits per sample
            Marshal.WriteInt16(fmt, 16, 0);

            const int Loopback = 0x00020000, EventCallback = 0x00040000, SrcDefaultQuality = 0x08000000;
            int autoConvert = unchecked((int)0x80000000);
            int hr = client.Initialize(0 /* shared */, Loopback | EventCallback | autoConvert | SrcDefaultQuality,
                                       2000000 /* 200 ms */, 0, fmt, IntPtr.Zero);
            if (hr < 0) return hr;
            hr = client.SetEventHandle(evt.SafeWaitHandle.DangerousGetHandle());
            if (hr < 0) return hr;
            Guid iid = typeof(IAudioCaptureClient).GUID;
            hr = client.GetService(ref iid, out capObj);
            if (hr < 0) return hr;
            var cap = (IAudioCaptureClient)capObj;
            hr = client.Start();
            if (hr < 0) return hr;
            started = true;
            State = "on";

            var handles = new WaitHandle[] { evt, wake };
            while (!stop)
            {
                WaitHandle.WaitAny(handles, 200);
                bool got = false;
                while (!stop)
                {
                    uint next;
                    hr = cap.GetNextPacketSize(out next);
                    if (hr < 0) return hr;
                    if (next == 0) break;
                    IntPtr data; uint frames, flags; ulong p1, p2;
                    hr = cap.GetBuffer(out data, out frames, out flags, out p1, out p2);
                    if (hr < 0) return hr;
                    Push(data, (int)frames, (flags & 2) != 0 /* AUDCLNT_BUFFERFLAGS_SILENT */);
                    cap.ReleaseBuffer(frames);
                    got = true;
                }
                if (got)
                {
                    Action cb = OnData;
                    if (cb != null) { try { cb(); } catch { } }
                }
            }
            return 0;
        }
        finally
        {
            if (started) { try { client.Stop(); } catch { } }
            if (capObj != null) { try { Marshal.ReleaseComObject(capObj); } catch { } }
            Marshal.FreeHGlobal(fmt);
            evt.Dispose();
        }
    }

    // Ask Windows for a capture stream of everything one process tree renders.
    static int ActivateForProcess(int processId, out IAudioClient client)
    {
        client = null;
        int union = 8, ptr = IntPtr.Size == 8 ? 16 : 12, size = IntPtr.Size == 8 ? 24 : 16;
        IntPtr blob = Marshal.AllocHGlobal(12), pv = Marshal.AllocHGlobal(size);
        bool pending = false;
        try
        {
            Marshal.WriteInt32(blob, 0, 1);              // AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK
            Marshal.WriteInt32(blob, 4, processId);      // target process
            Marshal.WriteInt32(blob, 8, 0);              // PROCESS_LOOPBACK_MODE_INCLUDE_TARGET_PROCESS_TREE
            for (int i = 0; i < size; i++) Marshal.WriteByte(pv, i, 0);
            Marshal.WriteInt16(pv, 0, 65);               // VT_BLOB
            Marshal.WriteInt32(pv, union, 12);           // blob size
            Marshal.WriteIntPtr(pv, ptr, blob);          // blob data

            var done = new Completion();
            Guid iid = typeof(IAudioClient).GUID;
            IActivateAudioInterfaceAsyncOperation op;
            int hr = ActivateAudioInterfaceAsync("VAD\\Process_Loopback", ref iid, pv, done, out op);
            if (hr < 0) return hr;
            if (!done.Done.WaitOne(5000))
            {
                // Windows has not answered yet and may still read the request
                // later: leave its memory alone (a few bytes, once in a blue moon)
                pending = true;
                return unchecked((int)0x800705B4);                              // timed out
            }
            if (done.Hr < 0) return done.Hr;
            client = done.Client as IAudioClient;
            return client == null ? unchecked((int)0x80004002) : 0;
        }
        catch (EntryPointNotFoundException) { return unchecked((int)0x80004001); }
        catch (DllNotFoundException) { return unchecked((int)0x80004001); }
        finally
        {
            if (!pending)
            {
                Marshal.FreeHGlobal(blob);
                Marshal.FreeHGlobal(pv);
            }
        }
    }

    sealed class Completion : IActivateAudioInterfaceCompletionHandler, IAgileObject
    {
        public readonly ManualResetEvent Done = new ManualResetEvent(false);
        public int Hr = unchecked((int)0x80004005);
        public object Client;

        public int ActivateCompleted(IActivateAudioInterfaceAsyncOperation op)
        {
            try
            {
                int result; object obj;
                int hr = op.GetActivateResult(out result, out obj);
                Hr = hr < 0 ? hr : result;
                Client = obj;
            }
            catch (Exception e) { Hr = Marshal.GetHRForException(e); }
            Done.Set();
            return 0;
        }
    }

    // ------------------------------------------------------------- interop ----

    [DllImport("Mmdevapi.dll", ExactSpelling = true, PreserveSig = true)]
    static extern int ActivateAudioInterfaceAsync(
        [MarshalAs(UnmanagedType.LPWStr)] string deviceInterfacePath, [In] ref Guid riid, IntPtr activationParams,
        IActivateAudioInterfaceCompletionHandler completionHandler, out IActivateAudioInterfaceAsyncOperation operation);

    [ComImport, Guid("1CB9AD4C-DBFA-4c32-B178-C2F568A703B2"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IAudioClient
    {
        [PreserveSig] int Initialize(int shareMode, int streamFlags, long bufferDuration, long periodicity, IntPtr format, IntPtr sessionGuid);
        [PreserveSig] int GetBufferSize(out uint frames);
        [PreserveSig] int GetStreamLatency(out long latency);
        [PreserveSig] int GetCurrentPadding(out uint frames);
        [PreserveSig] int IsFormatSupported(int shareMode, IntPtr format, out IntPtr closest);
        [PreserveSig] int GetMixFormat(out IntPtr format);
        [PreserveSig] int GetDevicePeriod(out long defaultPeriod, out long minimumPeriod);
        [PreserveSig] int Start();
        [PreserveSig] int Stop();
        [PreserveSig] int Reset();
        [PreserveSig] int SetEventHandle(IntPtr handle);
        [PreserveSig] int GetService([In] ref Guid riid, [MarshalAs(UnmanagedType.IUnknown)] out object service);
    }

    [ComImport, Guid("C8ADBD64-E71E-48a0-A4DE-185C395CD317"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IAudioCaptureClient
    {
        [PreserveSig] int GetBuffer(out IntPtr data, out uint frames, out uint flags, out ulong devicePosition, out ulong qpcPosition);
        [PreserveSig] int ReleaseBuffer(uint frames);
        [PreserveSig] int GetNextPacketSize(out uint frames);
    }

    [ComImport, Guid("41D949AB-9862-444A-80F6-C261334DA5EB"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IActivateAudioInterfaceCompletionHandler
    {
        [PreserveSig] int ActivateCompleted(IActivateAudioInterfaceAsyncOperation operation);
    }

    [ComImport, Guid("72A22D78-CDE4-431D-B8CC-843A71199B6D"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IActivateAudioInterfaceAsyncOperation
    {
        [PreserveSig] int GetActivateResult(out int activateResult, [MarshalAs(UnmanagedType.IUnknown)] out object activatedInterface);
    }

    [ComImport, Guid("94EA2B94-E9CC-49E0-C0FF-EE64CA8F5B90"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IAgileObject { }
}

// Hands the captured sound to the page, on request.
//
// The page asks with "tap|1" and keeps asking a few times a second for as long
// as it is drawing something that moves with the music. While it asks, it gets
//     pcm|<base64>      8 bytes: frames sent so far (little-endian), then the
//                       newest 1024 stereo frames as 16-bit samples (L,R,L,R...)
//     tapstate|<state>  on / failed|<error code>
// about 60 times a second (twice a second while everything is silent). When the
// page stops asking - hidden window, panel closed - listening stops by itself.
internal sealed class AudioFeed : IDisposable
{
    const int Frames = 1024;
    const int PauseAfterMs = 1500;      // page stopped asking: stop sending
    const int StopAfterMs = 6000;       // ...and a little later stop listening

    readonly int pid;                   // the browser engine's main process
    readonly SynchronizationContext ui;
    readonly Action<string> post;
    readonly short[] framesOwn = new short[Frames * 2];
    readonly short[] framesMedia = new short[Frames * 2];
    readonly byte[] packet = new byte[8 + Frames * 4];
    AudioTap own;                       // the engine's process tree: ordinary sound
    AudioTap media;                     // the protected-playback helper: Apple's songs
    int mediaPid;
    long sent, ownSeen, mediaSeen;
    bool lastWasMedia;
    System.Threading.Timer watch;
    int pending, lastSendTick, lastWantTick, quiet;
    string lastState = "";

    /// <param name="browserProcessId">main process of the browser engine showing the page</param>
    /// <param name="ui">the thread the page may be talked to from</param>
    /// <param name="post">sends one message to the page (called on the ui thread)</param>
    public AudioFeed(int browserProcessId, SynchronizationContext ui, Action<string> post)
    {
        pid = browserProcessId;
        this.ui = ui;
        this.post = post;
    }

    /// <summary>The page wants audio (also its keep-alive). Call on the ui thread.</summary>
    public void Want()
    {
        lastWantTick = Environment.TickCount;
        if (own != null) return;
        quiet = 0;
        lastState = "";
        own = new AudioTap(pid);
        own.OnData = OnData;
        own.Start();
        // twice a second: look for the protected-playback helper (off the ui thread), then check in
        watch = new System.Threading.Timer(delegate
        {
            int found = 0;
            try { found = MediaHelper.Find(pid); } catch { }
            try { ui.Post(Check, found); } catch { }
        }, null, 50, 500);
    }

    /// <summary>Stop listening now. Call on the ui thread.</summary>
    public void Stop()
    {
        AudioTap a = own, b = media;
        own = null;
        media = null;
        mediaPid = 0;
        if (watch != null) { watch.Dispose(); watch = null; }
        if (a != null) { a.OnData = null; a.Stop(); }
        if (b != null) { b.OnData = null; b.Stop(); }
    }

    public void Dispose() { Stop(); }

    void OnData()                         // a capture thread
    {
        if (unchecked(Environment.TickCount - lastSendTick) < 14) return;      // 60 a second is plenty
        if (Interlocked.Exchange(ref pending, 1) != 0) return;
        try { ui.Post(Send, null); } catch { pending = 0; }
    }

    static int Peak(short[] s)
    {
        int peak = 0;
        for (int i = 0; i < s.Length; i += 6)        // (6: alternates left and right samples)
        {
            int v = s[i]; if (v < 0) v = -v;
            if (v > peak) peak = v;
        }
        return peak;
    }

    void Send(object unused)              // ui thread
    {
        pending = 0;
        AudioTap a = own, b = media;
        if (a == null) return;
        int now = Environment.TickCount;
        lastSendTick = now;
        if (unchecked(now - lastWantTick) > PauseAfterMs) return;

        long ownTotal = a.Read(framesOwn, Frames), mediaTotal = 0;
        int peak = Peak(framesOwn), mediaPeak = 0;
        if (b != null) { mediaTotal = b.Read(framesMedia, Frames); mediaPeak = Peak(framesMedia); }

        // pass on whichever of the two is making sound (the helper wins a tie)
        bool useMedia = b != null && mediaPeak > 2 && mediaPeak >= peak;
        if (useMedia) peak = mediaPeak;
        if (peak <= 2) { quiet++; if (quiet > 40 && quiet % 30 != 0) { ownSeen = ownTotal; mediaSeen = mediaTotal; return; } }
        else quiet = 0;

        // how many of these frames the page has not had yet
        long fresh = useMedia ? mediaTotal - mediaSeen : ownTotal - ownSeen;
        if (useMedia != lastWasMedia || fresh > Frames || fresh < 0) fresh = Frames;
        lastWasMedia = useMedia;
        ownSeen = ownTotal;
        mediaSeen = mediaTotal;
        sent += fresh;

        for (int i = 0; i < 8; i++) packet[i] = (byte)(sent >> (8 * i));
        Buffer.BlockCopy(useMedia ? framesMedia : framesOwn, 0, packet, 8, Frames * 4);
        try { post("pcm|" + Convert.ToBase64String(packet)); } catch { }
    }

    void Check(object found)              // ui thread, twice a second
    {
        AudioTap a = own;
        if (a == null) return;
        if (unchecked(Environment.TickCount - lastWantTick) > StopAfterMs) { Stop(); return; }

        // the helper comes and goes with protected playback: follow it
        int helper = found is int ? (int)found : 0;
        if (helper != mediaPid)
        {
            if (media != null) { media.OnData = null; media.Stop(); media = null; }
            mediaPid = helper;
            if (helper != 0)
            {
                media = new AudioTap(helper);
                media.OnData = OnData;
                media.Start();
            }
        }

        string st = a.State;
        if (st == "starting") return;
        if (st == "failed") st += "|0x" + a.LastError.ToString("X8");
        if (st == lastState) return;
        lastState = st;
        try { post("tapstate|" + st); } catch { }
    }
}

// Finds the browser engine's protected-playback helper: the child process of
// the engine that has started Windows' protected media process (mfpmp.exe).
internal static class MediaHelper
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    struct ProcessEntry
    {
        public uint dwSize, cntUsage, th32ProcessID;
        public IntPtr th32DefaultHeapID;
        public uint th32ModuleID, cntThreads, th32ParentProcessID;
        public int pcPriClassBase;
        public uint dwFlags;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)] public string szExeFile;
    }

    [DllImport("kernel32.dll", SetLastError = true)] static extern IntPtr CreateToolhelp32Snapshot(uint flags, uint processId);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] static extern bool Process32FirstW(IntPtr snapshot, ref ProcessEntry entry);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] static extern bool Process32NextW(IntPtr snapshot, ref ProcessEntry entry);
    [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);

    /// <summary>Process id of the helper, or 0 when no protected playback is going on.</summary>
    public static int Find(int browserProcessId)
    {
        IntPtr snap = CreateToolhelp32Snapshot(2 /* processes */, 0);
        if (snap == IntPtr.Zero || snap == new IntPtr(-1)) return 0;
        try
        {
            var parentOf = new System.Collections.Generic.Dictionary<uint, uint>();
            var mediaParents = new System.Collections.Generic.List<uint>();
            var e = new ProcessEntry();
            e.dwSize = (uint)Marshal.SizeOf(typeof(ProcessEntry));
            if (!Process32FirstW(snap, ref e)) return 0;
            do
            {
                parentOf[e.th32ProcessID] = e.th32ParentProcessID;
                if (string.Equals(e.szExeFile, "mfpmp.exe", StringComparison.OrdinalIgnoreCase)) mediaParents.Add(e.th32ParentProcessID);
            }
            while (Process32NextW(snap, ref e));

            foreach (uint helper in mediaParents)
            {
                uint grand;
                if (parentOf.TryGetValue(helper, out grand) && grand == (uint)browserProcessId) return (int)helper;
            }
            return 0;
        }
        finally { CloseHandle(snap); }
    }
}
