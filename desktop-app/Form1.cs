using System;
using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Windows.Forms;
using DiscordRPC;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace desktop_app;

public partial class Form1 : Form
{
    [DllImport("dwmapi.dll")]
    private static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int attrValue, int attrSize);

    private const int DWMWA_USE_IMMERSIVE_DARK_MODE_BEFORE_20H1 = 19;
    private const int DWMWA_USE_IMMERSIVE_DARK_MODE = 20;
    private const int DWMWA_CAPTION_COLOR = 35;

    private WebView2 _webView = null!;
    private DiscordRpcClient? _discord;
    private string _lastTrackId = "";
    private bool _isPlaying = false;

    public Form1()
    {
        InitializeComponent();
        ConfigureWindow();
        InitializeDiscordRpc();
        InitializeWebView();
        CheckForUpdatesAsync();
    }

    private void ConfigureWindow()
    {
        this.Text = "Rivo — Hi-Fi Audio Player";
        this.Size = new Size(1300, 850);
        this.MinimumSize = new Size(800, 600);
        this.StartPosition = FormStartPosition.CenterScreen;
        this.BackColor = Color.FromArgb(16, 23, 22);

        try
        {
            int trueVal = 1;
            DwmSetWindowAttribute(this.Handle, DWMWA_USE_IMMERSIVE_DARK_MODE, ref trueVal, sizeof(int));
            DwmSetWindowAttribute(this.Handle, DWMWA_USE_IMMERSIVE_DARK_MODE_BEFORE_20H1, ref trueVal, sizeof(int));
            int titleColor = 0x00161710; // Dark color matching Rivo (#101716 -> BGR: 0x161710)
            DwmSetWindowAttribute(this.Handle, DWMWA_CAPTION_COLOR, ref titleColor, sizeof(int));
        }
        catch { }

        try
        {
            if (File.Exists("icon.ico"))
            {
                this.Icon = new Icon("icon.ico");
            }
        }
        catch { }

        this.FormClosing += (s, e) =>
        {
            try
            {
                _discord?.ClearPresence();
                _discord?.Dispose();
            }
            catch { }
        };
    }

    private void InitializeDiscordRpc()
    {
        try
        {
            // Official Rivo Discord App Client ID
            _discord = new DiscordRpcClient("1440997674630250506");
            _discord.Initialize();
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[Discord RPC Error] {ex.Message}");
        }
    }

    private async void InitializeWebView()
    {
        _webView = new WebView2
        {
            Dock = DockStyle.Fill,
            DefaultBackgroundColor = Color.FromArgb(16, 23, 22)
        };
        this.Controls.Add(_webView);

        try
        {
            CoreWebView2Environment? environment = null;
            try
            {
                string perfFlags = "--autoplay-policy=no-user-gesture-required --enable-gpu-rasterization --enable-zero-copy --ignore-gpu-blocklist --enable-features=OverlayScrollbar --disable-features=Translate,OptimizationHints,MediaRouter --renderer-process-limit=2";
                var options = new CoreWebView2EnvironmentOptions(perfFlags);
                string userDataFolder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Rivo", "Profile");
                environment = await CoreWebView2Environment.CreateAsync(null, userDataFolder, options);
            }
            catch { }

            try
            {
                if (environment != null)
                {
                    await _webView.EnsureCoreWebView2Async(environment);
                }
                else
                {
                    await _webView.EnsureCoreWebView2Async();
                }
            }
            catch (Exception ex) when (ex.HResult == unchecked((int)0x800700AA) || ex.Message.Contains("0x800700AA"))
            {
                await _webView.EnsureCoreWebView2Async();
            }
            _webView.CoreWebView2.Settings.IsStatusBarEnabled = false;
            _webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
            _webView.CoreWebView2.Settings.AreDevToolsEnabled = false;
            _webView.CoreWebView2.Settings.AreBrowserAcceleratorKeysEnabled = false;
            _webView.CoreWebView2.Settings.IsZoomControlEnabled = false;
            _webView.CoreWebView2.Settings.IsBuiltInErrorPageEnabled = false;
            _webView.CoreWebView2.Settings.IsPinchZoomEnabled = false;

            _webView.CoreWebView2.WebMessageReceived += OnWebMessageReceived;

            // Injected script to flag RIVO_DESKTOP and sync audio playback with Discord RPC natively
            string syncScript = @"
                (function() {
                    window.RIVO_DESKTOP = true;
                    let lastState = '';
                    setInterval(() => {
                        try {
                            const audio = document.querySelector('audio');
                            const meta = navigator.mediaSession?.metadata;
                            if (audio && !audio.paused && meta && meta.title) {
                                const curTime = audio.currentTime || 0;
                                const dur = audio.duration || 0;
                                const stateKey = meta.title + '_' + Math.floor(curTime / 5);
                                if (stateKey !== lastState) {
                                    lastState = stateKey;
                                    window.chrome.webview.postMessage(JSON.stringify({
                                        action: 'PLAY',
                                        title: meta.title || 'Playing',
                                        artist: meta.artist || 'Rivo Artist',
                                        album: meta.album || 'Rivo Hi-Fi',
                                        artwork: meta.artwork && meta.artwork.length > 0 ? meta.artwork[0].src : '',
                                        currentTime: curTime,
                                        duration: dur
                                    }));
                                }
                            } else if (audio && audio.paused && lastState !== 'PAUSED') {
                                lastState = 'PAUSED';
                                window.chrome.webview.postMessage(JSON.stringify({ action: 'PAUSE' }));
                            }
                        } catch (err) {}
                    }, 1000);
                })();
            ";

            await _webView.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(syncScript);
            _webView.Source = new Uri("https://rivo-m.duckdns.org");
        }
        catch (Exception ex)
        {
            MessageBox.Show($"Failed to initialize WebView2: {ex.Message}", "Rivo", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }

    private void OnWebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        try
        {
            string raw = e.TryGetWebMessageAsString();
            if (string.IsNullOrEmpty(raw)) return;

            using JsonDocument doc = JsonDocument.Parse(raw);
            var root = doc.RootElement;
            string action = root.GetProperty("action").GetString() ?? "";

            if (action == "PLAY" && _discord != null && _discord.IsInitialized)
            {
                string title = root.GetProperty("title").GetString() ?? "Rivo";
                string artist = root.GetProperty("artist").GetString() ?? "Rivo Music";
                string album = root.GetProperty("album").GetString() ?? "Rivo";
                string artwork = root.GetProperty("artwork").GetString() ?? "";
                double curTime = root.GetProperty("currentTime").GetDouble();
                double duration = root.GetProperty("duration").GetDouble();

                DateTime start = DateTime.UtcNow.AddSeconds(-curTime);
                DateTime? end = duration > 0 ? DateTime.UtcNow.AddSeconds(duration - curTime) : null;

                string coverUrl = artwork.StartsWith("http") ? artwork : "https://rivo-m.duckdns.org/discord-badge.png";

                _discord.SetPresence(new RichPresence()
                {
                    Details = title,
                    State = $"by {artist}",
                    Timestamps = new Timestamps()
                    {
                        Start = start,
                        End = end
                    },
                    Assets = new Assets()
                    {
                        LargeImageKey = coverUrl,
                        LargeImageText = album,
                        SmallImageKey = "https://rivo-m.duckdns.org/discord-badge.png",
                        SmallImageText = "Rivo Hi-Fi"
                    },
                    Buttons = new DiscordRPC.Button[]
                    {
                        new DiscordRPC.Button()
                        {
                            Label = "Listen on Rivo",
                            Url = "https://rivo-m.duckdns.org"
                        }
                    }
                });

                _isPlaying = true;
            }
            else if (action == "PAUSE" && _discord != null)
            {
                _discord.ClearPresence();
                _isPlaying = false;
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[WebMessage Error] {ex.Message}");
        }
    }

    private async void CheckForUpdatesAsync()
    {
        try
        {
            using var client = new System.Net.Http.HttpClient { Timeout = TimeSpan.FromSeconds(5) };
            var json = await client.GetStringAsync("https://rivo-m.duckdns.org/api/app/version");
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            string currentVersion = "1.4.3";
            string remoteVersion = "";
            string downloadUrl = "https://rivo-m.duckdns.org/downloads/Rivo.exe";
            string notes = "";

            if (root.TryGetProperty("platforms", out var platforms) && platforms.TryGetProperty("windows", out var win))
            {
                if (win.TryGetProperty("version", out var v)) remoteVersion = v.GetString() ?? "";
                if (win.TryGetProperty("downloadUrl", out var dl))
                {
                    string rawDl = dl.GetString() ?? "";
                    downloadUrl = rawDl.StartsWith("http") ? rawDl : $"https://rivo-m.duckdns.org{rawDl}";
                }
                if (win.TryGetProperty("notes", out var n)) notes = n.GetString() ?? "";
            }
            else if (root.TryGetProperty("version", out var v))
            {
                remoteVersion = v.GetString() ?? "";
            }

            if (!string.IsNullOrEmpty(remoteVersion) && IsNewerVersion(remoteVersion, currentVersion))
            {
                var result = MessageBox.Show(
                    $"A new update for Rivo is available!\n\n" +
                    $"• Installed: v{currentVersion}\n" +
                    $"• Latest: v{remoteVersion}\n\n" +
                    (string.IsNullOrEmpty(notes) ? "" : $"Notes: {notes}\n\n") +
                    $"Would you like to download and install the new version now?",
                    "Rivo — Update Available",
                    MessageBoxButtons.YesNo,
                    MessageBoxIcon.Information
                );

                if (result == DialogResult.Yes)
                {
                    System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
                    {
                        FileName = downloadUrl,
                        UseShellExecute = true
                    });
                }
            }
        }
        catch { }
    }

    private static bool IsNewerVersion(string remote, string current)
    {
        try
        {
            var rParts = remote.TrimStart('v', 'V').Split('.');
            var cParts = current.TrimStart('v', 'V').Split('.');
            int len = Math.Max(rParts.Length, cParts.Length);
            for (int i = 0; i < len; i++)
            {
                int r = i < rParts.Length && int.TryParse(rParts[i], out var rv) ? rv : 0;
                int c = i < cParts.Length && int.TryParse(cParts[i], out var cv) ? cv : 0;
                if (r > c) return true;
                if (r < c) return false;
            }
        }
        catch { }
        return false;
    }
}
