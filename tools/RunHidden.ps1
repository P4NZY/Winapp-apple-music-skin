<#
  Runs a program on a separate, hidden Windows desktop and waits for it.

  Nothing it shows can appear on screen, steal focus or reach the taskbar, so
  the real app (app\MusicPlayer.exe) can be test-run while someone is using
  the PC - including in a fullscreen game. Use the app's own test switches so
  the run is muted, uses a throw-away profile and does not count as "the"
  running player:

    .\tools\RunHidden.ps1 -Exe .\app\MusicPlayer.exe -Arguments `
        '--data-dir C:\Temp\mp-test --script C:\Temp\test.js --result C:\Temp\out.json --delay 8000 --settle 9000'

  The test script stores what it wants reported in window.__mpResult; the app
  writes that to the --result file and exits. (For tests of the skin alone,
  tools\Probe.cs is lighter: it needs no window at all.)
#>
param(
    [Parameter(Mandatory)] [string]$Exe,
    [string]$Arguments = '',
    [int]$TimeoutSec = 90
)
$ErrorActionPreference = 'Stop'
$Exe = (Resolve-Path $Exe).Path

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class HiddenDesktopRunner
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    struct STARTUPINFO
    {
        public int cb; public string lpReserved; public string lpDesktop; public string lpTitle;
        public int dwX, dwY, dwXSize, dwYSize, dwXCountChars, dwYCountChars, dwFillAttribute, dwFlags;
        public short wShowWindow, cbReserved2; public IntPtr lpReserved2, hStdInput, hStdOutput, hStdError;
    }
    [StructLayout(LayoutKind.Sequential)]
    struct PROCESS_INFORMATION { public IntPtr hProcess, hThread; public int dwProcessId, dwThreadId; }

    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    static extern IntPtr CreateDesktop(string name, IntPtr device, IntPtr devmode, int flags, uint access, IntPtr security);
    [DllImport("user32.dll", SetLastError = true)] static extern bool CloseDesktop(IntPtr desktop);
    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    static extern bool CreateProcess(string app, StringBuilder commandLine, IntPtr pa, IntPtr ta, bool inherit, int flags, IntPtr env, string cwd, ref STARTUPINFO si, out PROCESS_INFORMATION pi);
    [DllImport("kernel32.dll")] static extern uint WaitForSingleObject(IntPtr handle, uint ms);
    [DllImport("kernel32.dll")] static extern bool TerminateProcess(IntPtr handle, uint code);
    [DllImport("kernel32.dll")] static extern bool GetExitCodeProcess(IntPtr handle, out uint code);
    [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);

    public static string Run(string exe, string args, string cwd, int timeoutMs)
    {
        string name = "hidden-run-" + System.Diagnostics.Process.GetCurrentProcess().Id;
        IntPtr desk = CreateDesktop(name, IntPtr.Zero, IntPtr.Zero, 0, 0x10000000 /* GENERIC_ALL */, IntPtr.Zero);
        if (desk == IntPtr.Zero) return "could not create a desktop (error " + Marshal.GetLastWin32Error() + ")";
        try
        {
            var si = new STARTUPINFO();
            si.cb = Marshal.SizeOf(typeof(STARTUPINFO));
            si.lpDesktop = "WinSta0\\" + name;
            PROCESS_INFORMATION pi;
            var cmd = new StringBuilder("\"" + exe + "\" " + args);
            if (!CreateProcess(null, cmd, IntPtr.Zero, IntPtr.Zero, false, 0, IntPtr.Zero, cwd, ref si, out pi))
                return "could not start it (error " + Marshal.GetLastWin32Error() + ")";
            string result;
            if (WaitForSingleObject(pi.hProcess, (uint)timeoutMs) == 0)
            {
                uint code;
                GetExitCodeProcess(pi.hProcess, out code);
                result = "exited with code " + code;
            }
            else
            {
                TerminateProcess(pi.hProcess, 1);
                result = "still running after " + (timeoutMs / 1000) + " s: stopped it";
            }
            CloseHandle(pi.hThread);
            CloseHandle(pi.hProcess);
            return result;
        }
        finally { CloseDesktop(desk); }
    }
}
'@

[HiddenDesktopRunner]::Run($Exe, $Arguments, (Split-Path -Parent $Exe), $TimeoutSec * 1000)
