using System;
using System.Threading;
using System.Windows.Forms;

namespace desktop_app;

static class Program
{
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

        ApplicationConfiguration.Initialize();
        Application.Run(new Form1());

        GC.KeepAlive(_mutex);
    }    
}