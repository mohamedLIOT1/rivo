import React, { useState, useEffect } from 'react';
import { 
  Download, 
  Monitor, 
  Smartphone, 
  Apple, 
  CheckCircle, 
  Sparkles, 
  ArrowRight, 
  RefreshCw, 
  ShieldCheck, 
  Radio, 
  Cpu, 
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Info
} from 'lucide-react';

export default function DownloadScreen({ globalTheme = 'dark' }) {
  const [detectedOs, setDetectedOs] = useState('windows');
  const [showIosGuide, setShowIosGuide] = useState(false);
  const isDark = globalTheme === 'dark';

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const userAgent = window.navigator.userAgent.toLowerCase();
      if (/android/.test(userAgent)) {
        setDetectedOs('android');
      } else if (/iphone|ipad|ipod/.test(userAgent)) {
        setDetectedOs('ios');
      } else if (/win/.test(userAgent)) {
        setDetectedOs('windows');
      } else if (/mac/.test(userAgent)) {
        setDetectedOs('mac');
      }
    }
  }, []);

  const apps = [
    {
      id: 'windows',
      name: 'Rivo for Windows',
      osLabel: 'Windows 10 / 11 (64-bit)',
      badge: 'NATIVE DESKTOP',
      version: 'v1.4.4',
      fileType: '.EXE',
      fileSize: '1.8 MB',
      icon: Monitor,
      downloadUrl: '/downloads/Rivo.exe',
      directName: 'Rivo.exe',
      highlights: [
        'Official Discord Rich Presence sync (No extensions needed)',
        'Native Windows media session & taskbar playback controls',
        'Built-in auto-update checker on startup',
        'Hardware-accelerated WebView2 engine with 24-bit Hi-Fi audio'
      ],
      isRecommended: detectedOs === 'windows' || detectedOs === 'mac'
    },
    {
      id: 'android',
      name: 'Rivo for Android',
      osLabel: 'Android 8.0 & Above',
      badge: 'HYBRID HI-FI',
      version: 'v1.4.4',
      fileType: '.APK',
      fileSize: '67 MB',
      icon: Smartphone,
      downloadUrl: '/downloads/Rivo.apk',
      directName: 'Rivo.apk',
      highlights: [
        'Complete Rivo Web UI: all playlists, full profile & Friend Activity',
        'Real-time Chat, Live Jam Rooms & Discord Rich Presence sync',
        'Lock screen controls & background audio streaming',
        'Full Offline Vault & local MP3 cache playback'
      ],
      isRecommended: detectedOs === 'android'
    },
    {
      id: 'ios',
      name: 'Rivo for iOS',
      osLabel: 'iOS 15.0 & Above',
      badge: 'HYBRID HI-FI',
      version: 'v1.4.4',
      fileType: '.IPA',
      fileSize: '8.8 MB',
      icon: Apple,
      downloadUrl: '/downloads/Rivo.ipa',
      directName: 'Rivo.ipa',
      highlights: [
        'Complete Rivo Web UI: 100% web design, all playlists & songs',
        'Full Profile, real-time Chat, Live Jam & Friend Activity',
        'Live Discord Rich Presence sync across devices',
        'Native Apple Media Controls & iOS Control Center sync',
        'Full Offline Vault for cached music & Quran'
      ],
      isRecommended: detectedOs === 'ios'
    }
  ];

  return (
    <div className="flex-1 overflow-y-auto px-4 py-8 md:px-8 max-w-7xl mx-auto w-full selection:bg-[#17a398] selection:text-black">
      {/* ── HERO BANNER ── */}
      <div 
        className="relative overflow-hidden brutal-border p-6 md:p-10 mb-10 shadow-[6px_6px_0px_#000]"
        style={{
          background: isDark 
            ? 'linear-gradient(135deg, #101918 0%, #0d1e1c 50%, #081312 100%)' 
            : 'linear-gradient(135deg, #e6fffa 0%, #ccfbf1 50%, #99f6e4 100%)',
          borderColor: isDark ? '#1f2e2c' : '#0f766e'
        }}
      >
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-sm border mb-4 bg-teal-500/10 border-teal-500/30 text-teal-400 font-mono text-xs font-bold tracking-wider uppercase">
            <Sparkles className="w-3.5 h-3.5 text-teal-400" />
            Official Multi-Platform Releases
          </div>

          <h1 className={`text-3xl md:text-5xl font-black tracking-tight mb-4 uppercase ${isDark ? 'text-white' : 'text-[#0f2824]'}`}>
            GET <span className="text-[#17a398]">RIVO</span> ON ANY DEVICE
          </h1>

          <p className={`text-sm md:text-base leading-relaxed mb-6 font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
            Experience crystal-clear 24-bit Hi-Fi music streaming, seamless background playback, offline caching, 
            and official Discord Rich Presence sync across all your devices.
          </p>

          <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-1.5 text-teal-400 font-bold">
              <CheckCircle className="w-4 h-4" /> Zero Ads & Uncapped Bitrate
            </div>
            <div className="flex items-center gap-1.5 text-teal-400 font-bold">
              <CheckCircle className="w-4 h-4" /> Native Audio Controls
            </div>
            <div className="flex items-center gap-1.5 text-teal-400 font-bold">
              <CheckCircle className="w-4 h-4" /> In-App Auto-Updates
            </div>
          </div>
        </div>

        {/* Ambient watermark */}
        <div className="absolute -right-8 -bottom-10 pointer-events-none select-none text-[140px] md:text-[200px] font-black opacity-[0.03] text-teal-400 leading-none">
          RIVO
        </div>
      </div>

      {/* ── APPS GRID ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {apps.map((app) => {
          const Icon = app.icon;
          return (
            <div
              key={app.id}
              className={`relative flex flex-col justify-between brutal-border p-6 transition-all duration-200 shadow-[5px_5px_0px_#000] hover:translate-y-[-2px] ${
                app.isRecommended 
                  ? isDark 
                    ? 'border-[#17a398] bg-[#0e1b19]' 
                    : 'border-[#0f766e] bg-[#f0fdf4]'
                  : isDark 
                    ? 'border-[#1a2826] bg-[#0d1615]' 
                    : 'border-slate-300 bg-white'
              }`}
            >
              {app.isRecommended && (
                <div className="absolute -top-3 left-6 px-2.5 py-0.5 bg-[#17a398] text-black font-mono font-black text-[10px] tracking-wider uppercase shadow-[2px_2px_0px_#000]">
                  ★ RECOMMENDED FOR YOUR DEVICE
                </div>
              )}

              <div>
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-sm bg-[#17a398]/10 border border-[#17a398]/30 flex items-center justify-center text-[#17a398]">
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-black/40 border border-white/10 text-teal-400 font-bold">
                      {app.version}
                    </span>
                    <div className="text-[10px] text-slate-400 font-mono mt-1">
                      {app.fileType} • {app.fileSize}
                    </div>
                  </div>
                </div>

                <h3 className={`text-xl font-bold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {app.name}
                </h3>
                <div className="text-xs font-mono text-[#17a398] font-bold mb-4">
                  {app.osLabel}
                </div>

                <ul className="space-y-2.5 mb-6 text-xs text-slate-300">
                  {app.highlights.map((highlight, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-[#17a398] font-bold mt-0.5">•</span>
                      <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>{highlight}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <a
                  href={app.downloadUrl}
                  download={app.directName}
                  className={`w-full flex items-center justify-center gap-2 py-3 px-4 font-bold text-sm tracking-wide uppercase font-mono transition-transform duration-100 active:translate-y-[2px] brutal-border shadow-[3px_3px_0px_#000] ${
                    app.isRecommended
                      ? 'bg-[#17a398] text-black hover:bg-[#148f85]'
                      : isDark
                        ? 'bg-[#1f302e] text-white hover:bg-[#28403d]'
                        : 'bg-slate-800 text-white hover:bg-slate-900'
                  }`}
                >
                  <Download className="w-4 h-4" />
                  DOWNLOAD {app.fileType}
                </a>

                {app.id === 'ios' && (
                  <button
                    onClick={() => setShowIosGuide(!showIosGuide)}
                    className="w-full mt-2.5 flex items-center justify-center gap-1.5 text-[11px] font-mono text-[#17a398] hover:underline"
                  >
                    <Info className="w-3.5 h-3.5" />
                    How to install on iPhone?
                    {showIosGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── IOS SIDELOAD GUIDE ACCORDION ── */}
      {showIosGuide && (
        <div className={`brutal-border p-6 mb-12 shadow-[4px_4px_0px_#000] ${isDark ? 'bg-[#0f1918] border-[#1f2e2c]' : 'bg-amber-50 border-amber-300'}`}>
          <h4 className="text-base font-bold text-teal-400 mb-2 uppercase font-mono flex items-center gap-2">
            <Apple className="w-4 h-4" /> Installing Rivo on iOS (No Jailbreak Required)
          </h4>
          <p className="text-xs text-slate-300 mb-4 leading-relaxed">
            Because Apple restricts direct IPA installation from Safari, you can install the Rivo IPA easily using any free sideloading utility:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
            <div className="p-3 bg-black/30 border border-white/5 rounded">
              <span className="text-teal-400 font-bold block mb-1">1. Scarlet (Direct Sideload)</span>
              Download directly without computer at <a href="https://usescarlet.com" target="_blank" rel="noreferrer" className="text-teal-300 underline">usescarlet.com</a>, then import Rivo.ipa.
            </div>
            <div className="p-3 bg-black/30 border border-white/5 rounded">
              <span className="text-teal-400 font-bold block mb-1">2. AltStore (PC / Mac)</span>
              Free and official sideloading tool. Open AltStore on your phone and choose "Install IPA".
            </div>
            <div className="p-3 bg-black/30 border border-white/5 rounded">
              <span className="text-teal-400 font-bold block mb-1">3. Sideloadly / TrollStore</span>
              Drag and drop Rivo.ipa into Sideloadly with your Apple ID for permanent signing.
            </div>
          </div>
        </div>
      )}

      {/* ── BROWSER EXTENSION & AUTO-UPDATE FOOTER ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Discord Extension */}
        <div className={`brutal-border p-6 shadow-[4px_4px_0px_#000] ${isDark ? 'bg-[#0b1413] border-[#1a2826]' : 'bg-white border-slate-300'}`}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded bg-[#5865F2]/10 border border-[#5865F2]/30 flex items-center justify-center text-[#5865F2]">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-white uppercase">Rivo Discord Helper</h4>
              <p className="text-xs text-slate-400 font-mono">Browser Extension for Web Player</p>
            </div>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed mb-4">
            If you listen via Chrome, Edge, Brave or Opera, install the Rivo extension to show "Listening to Rivo" on your Discord profile automatically.
          </p>
          <div className="flex gap-3">
            <a
              href="/downloads/rivo-extension.zip"
              download="rivo-discord-helper.zip"
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-mono text-xs font-bold uppercase brutal-border flex items-center gap-2"
            >
              <Download className="w-3.5 h-3.5" /> Download ZIP
            </a>
          </div>
        </div>

        {/* In-App Auto-Update Guarantee */}
        <div className={`brutal-border p-6 shadow-[4px_4px_0px_#000] ${isDark ? 'bg-[#0b1413] border-[#1a2826]' : 'bg-white border-slate-300'}`}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-white uppercase">Built-in Update Engine</h4>
              <p className="text-xs text-slate-400 font-mono">Zero Maintenance Required</p>
            </div>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed mb-4">
            Every release of Rivo checks for updates seamlessly upon startup. When a new version is released, the app prompts you with a 1-click update option.
          </p>
          <div className="flex items-center gap-2 text-xs font-mono text-emerald-400">
            <ShieldCheck className="w-4 h-4" /> Always verified against official Rivo releases.
          </div>
        </div>
      </div>
    </div>
  );
}
