using System;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;

namespace desktop_app;

static class Program
{
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern IntPtr LoadLibrary(string lpLibFileName);

    private static Mutex? _mutex;

    /// <summary>
    ///  The main entry point for the application.
    /// </summary>
    [STAThread]
    static void Main()
    {
        const string mutexName = "Global\\Rivo_HiFi_Player_SingleInstance_Mutex";
        _mutex = new Mutex(true, mutexName, out bool createdNew);

        if (!createdNew)
        {
            // Another instance is already running
            return;
        }

        try
        {
            EnsureWebView2Loader();
        }
        catch { }

        ApplicationConfiguration.Initialize();
        Application.Run(new Form1());

        GC.KeepAlive(_mutex);
    }

    public static void EnsureWebView2Loader()
    {
        try
        {
            string appData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            string loaderDir = Path.Combine(appData, "Rivo", "bin");
            if (!Directory.Exists(loaderDir))
            {
                Directory.CreateDirectory(loaderDir);
            }

            string nativeSubDir = Path.Combine(loaderDir, "runtimes", "win-x64", "native");
            if (!Directory.Exists(nativeSubDir))
            {
                Directory.CreateDirectory(nativeSubDir);
            }

            string targetLoaderPath = Path.Combine(loaderDir, "WebView2Loader.dll");
            string targetSubLoaderPath = Path.Combine(nativeSubDir, "WebView2Loader.dll");

            // Extract from embedded resource if missing or smaller than 10KB
            if (!File.Exists(targetLoaderPath) || new FileInfo(targetLoaderPath).Length < 10000)
            {
                var assembly = typeof(Program).Assembly;
                string? resourceName = assembly.GetManifestResourceNames()
                    .FirstOrDefault(n => n.EndsWith("WebView2Loader.dll", StringComparison.OrdinalIgnoreCase));
                if (resourceName != null)
                {
                    using var stream = assembly.GetManifestResourceStream(resourceName);
                    if (stream != null)
                    {
                        using var fileStream = new FileStream(targetLoaderPath, FileMode.Create, FileAccess.Write, FileShare.None);
                        stream.CopyTo(fileStream);
                    }
                }
            }

            // Also copy to native subfolder
            if (File.Exists(targetLoaderPath) && (!File.Exists(targetSubLoaderPath) || new FileInfo(targetSubLoaderPath).Length < 10000))
            {
                try
                {
                    File.Copy(targetLoaderPath, targetSubLoaderPath, true);
                }
                catch { }
            }

            // Also try copying next to current executable if base dir is writable
            try
            {
                string baseDirLoader = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "WebView2Loader.dll");
                if (File.Exists(targetLoaderPath) && !File.Exists(baseDirLoader))
                {
                    File.Copy(targetLoaderPath, baseDirLoader, true);
                }
            }
            catch { }

            // Tell WebView2 Core environment where the loader DLL is
            if (File.Exists(targetLoaderPath))
            {
                try
                {
                    Microsoft.Web.WebView2.Core.CoreWebView2Environment.SetLoaderDllFolderPath(loaderDir);
                }
                catch { }

                // Explicitly load WebView2Loader.dll into the process memory space
                try
                {
                    LoadLibrary(targetLoaderPath);
                }
                catch { }
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[WebView2Loader extraction warning] {ex.Message}");
        }
    }
}