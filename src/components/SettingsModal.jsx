import React, { useState, useEffect } from 'react';
import { X, Settings, ShieldCheck, Check, Radio, Copy, ExternalLink, Unlink } from 'lucide-react';
import { FULL_VERSION } from '../version';
import { API_BASE_URL } from '../config';

export default function SettingsModal({
  isOpen,
  onClose,
  audioQuality,
  setAudioQuality,
  crossfade,
  setCrossfade,
  isOfflineMode,
  setIsOfflineMode,
  globalTheme = 'dark'
}) {
  const isDark = globalTheme === 'dark';
  const [discordStatus, setDiscordStatus] = useState(null);
  const [linkCode, setLinkCode] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [discordLoading, setDiscordLoading] = useState(false);
  const [discordMsg, setDiscordMsg] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const token = localStorage.getItem('rivo_token') || localStorage.getItem('liofy_token') || localStorage.getItem('token') || '';
    if (!token) return;

    fetch(`${API_BASE_URL}/api/discord/status`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        if (!data.error) setDiscordStatus(data);
      })
      .catch(() => {});
  }, [isOpen]);

  const handleGenerateCode = async () => {
    setDiscordLoading(true);
    setDiscordMsg('');
    const token = localStorage.getItem('rivo_token') || localStorage.getItem('liofy_token') || localStorage.getItem('token') || '';
    try {
      const res = await fetch(`${API_BASE_URL}/api/discord/link-code`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.code) {
        setLinkCode(data.code);
        setDiscordMsg('Send this code to the Rivo Discord bot in DM!');
      }
    } catch (e) {
      setDiscordMsg('Failed to generate link code');
    } finally {
      setDiscordLoading(false);
    }
  };

  const handleToggleDiscord = async () => {
    if (!discordStatus) return;
    const next = !discordStatus.enabled;
    const token = localStorage.getItem('rivo_token') || localStorage.getItem('liofy_token') || localStorage.getItem('token') || '';
    try {
      await fetch(`${API_BASE_URL}/api/discord/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ enabled: next })
      });
      setDiscordStatus({ ...discordStatus, enabled: next });
    } catch (e) {}
  };

  const handleUnlinkDiscord = async () => {
    const token = localStorage.getItem('rivo_token') || localStorage.getItem('liofy_token') || localStorage.getItem('token') || '';
    try {
      await fetch(`${API_BASE_URL}/api/discord/unlink`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      setDiscordStatus({ linked: false, username: '', enabled: false });
      setLinkCode('');
      setDiscordMsg('Discord account unlinked');
    } catch (e) {}
  };

  const handleConnectToken = async () => {
    if (!tokenInput.trim()) return;
    setDiscordLoading(true);
    setDiscordMsg('');
    const token = localStorage.getItem('rivo_token') || localStorage.getItem('liofy_token') || localStorage.getItem('token') || '';
    try {
      const res = await fetch(`${API_BASE_URL}/api/discord/link-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ token: tokenInput.trim() })
      });
      const data = await res.json();
      if (data.success) {
        setDiscordStatus({ linked: true, username: data.username, enabled: true });
        setTokenInput('');
        setShowTokenInput(false);
        setDiscordMsg(`Connected as ${data.username}!`);
      } else {
        setDiscordMsg(data.error || 'Connection failed');
      }
    } catch (e) {
      setDiscordMsg('Failed to connect Discord account');
    } finally {
      setDiscordLoading(false);
    }
  };

  const handleCopyCode = () => {
    if (!linkCode) return;
    navigator.clipboard?.writeText(linkCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  if (!isOpen) return null;

  const qualities = [
    { label: 'Lossless Master (320 kbps Studio)', value: '320' },
    { label: 'High Fidelity (256 kbps Balanced)', value: '256' },
    { label: 'Standard Quality (160 kbps Data-Saver)', value: '160' },
    { label: 'Automatic (Adaptive Network)', value: 'auto' }
  ];

  const isLoggedIn = Boolean(
    localStorage.getItem('rivo_token') || localStorage.getItem('liofy_token') || localStorage.getItem('token')
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className={`brutal-border-thick brutal-shadow-lg max-w-md w-full p-6 relative max-h-[92vh] overflow-y-auto ${
        isDark ? 'bg-[#121917] text-white border-zinc-700' : 'bg-[#fdfbf7] text-[#0b1110] border-[#0b1110]'
      }`}>
        <div className={`flex items-center justify-between pb-3 border-b-2 ${
          isDark ? 'border-zinc-700' : 'border-[#0b1110]'
        }`}>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-[#17a398] brutal-border" />
            <h3 className={`text-base font-mono font-black uppercase ${
              isDark ? 'text-[#26c4b7]' : 'text-[#082621]'
            }`}>Audio & App Settings</h3>
          </div>
          <button onClick={onClose} className={`brutal-btn p-1 brutal-border ${
            isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-white border-zinc-700' : 'bg-[#ede5d3] hover:bg-[#ded2bb] text-[#0b1110] border-[#0b1110]'
          }`}>
            <X size={18} />
          </button>
        </div>

        {/* Quality Guarantee Badge */}
        <div className={`my-4 p-4 brutal-border brutal-shadow-sm flex items-center justify-between ${
          isDark ? 'bg-[#082621] border-[#17a398]/50 text-white' : 'bg-[#082621] text-[#fdfbf7] border-[#0b1110]'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#26c4b7] text-[#082621] brutal-border flex items-center justify-center font-mono font-black text-sm">
              R
            </div>
            <div>
              <h4 className="font-mono font-black uppercase text-sm text-[#26c4b7]">Rivo Hi-Fi Audio</h4>
              <p className={`text-[11px] ${isDark ? 'text-zinc-300' : 'text-[#ded2bb]'}`}>Unlimited Streaming • 24-Bit Acoustic Fidelity • Zero Loss</p>
            </div>
          </div>
        </div>

        {/* Discord Rich Presence Integration Section */}
        <div className={`py-4 border-b-2 p-3 brutal-border mb-3 ${
          isDark ? 'border-zinc-700 bg-zinc-800/60' : 'border-[#0b1110] bg-[#f2ecde]/50'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#5865F2] inline-block animate-pulse" />
              <span className={`text-xs font-mono font-black uppercase ${
                isDark ? 'text-white' : 'text-[#082621]'
              }`}>Discord Rich Presence</span>
            </div>
            {discordStatus?.linked && (
              <span className="text-[10px] font-mono font-bold bg-[#5865F2] text-white px-1.5 py-0.5 brutal-border">
                {discordStatus.username || 'CONNECTED'}
              </span>
            )}
          </div>
          <p className={`text-[11px] mb-3 ${
            isDark ? 'text-zinc-300' : 'text-[#082621]/70'
          }`}>
            Displays your live listening track, cover &amp; progress on your Discord profile like Spotify.
          </p>

          {!isLoggedIn ? (
            <p className="text-[11px] font-mono text-[#f59e0b] bg-[#082621] p-2 brutal-border">
              ⚠️ Log in to Rivo to connect your Discord account.
            </p>
          ) : discordStatus?.linked ? (
            <div className="flex flex-col gap-2">
              <div className={`flex items-center justify-between p-2 brutal-border ${
                isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-[#ede5d3] border-[#0b1110]'
              }`}>
                <div>
                  <span className={`text-[11px] font-mono font-bold block ${
                    isDark ? 'text-white' : 'text-[#082621]'
                  }`}>Sync Listening Status</span>
                  <span className={`text-[9px] font-mono ${
                    isDark ? 'text-zinc-400' : 'text-[#082621]/70'
                  }`}>
                    {discordStatus.enabled ? '🟢 Live on your Discord profile' : '⏸️ Sync is currently paused'}
                  </span>
                </div>
                <button
                  onClick={handleToggleDiscord}
                  className={`brutal-btn px-3 py-1.5 text-[10px] font-mono font-black uppercase brutal-border transition flex items-center gap-1.5 cursor-pointer ${
                    discordStatus.enabled ? 'bg-[#17a398] hover:bg-[#26c4b7] text-white' : 'bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-600'
                  }`}
                  title={discordStatus.enabled ? 'Click to Pause' : 'Click to Enable'}
                >
                  <span className={`w-2 h-2 rounded-full ${discordStatus.enabled ? 'bg-emerald-300 animate-pulse' : 'bg-amber-500'}`} />
                  {discordStatus.enabled ? 'ACTIVE' : 'PAUSED (CLICK)'}
                </button>
              </div>
              <button
                onClick={handleUnlinkDiscord}
                className="brutal-btn w-full py-1 text-[11px] font-mono font-bold bg-[#fee2e2] hover:bg-red-200 text-red-700 brutal-border flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Unlink size={13} />
                Unlink Discord Profile
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {linkCode ? (
                <div className={`p-3 brutal-border text-center ${
                  isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-[#ede5d3] border-[#0b1110]'
                }`}>
                  <p className={`text-[10px] font-mono mb-1 ${isDark ? 'text-zinc-300' : 'text-[#082621]/70'}`}>Your 6-Digit Bot Link Code:</p>
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <span className="text-xl font-mono font-black tracking-widest text-[#5865F2] bg-white px-3 py-1 brutal-border">
                      {linkCode}
                    </span>
                    <button
                      onClick={handleCopyCode}
                      className={`brutal-btn p-1.5 brutal-border ${isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-white' : 'bg-[#ede5d3] hover:bg-white text-black'}`}
                      title="Copy Code"
                    >
                      {copiedCode ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                    </button>
                  </div>
                  <p className={`text-[10px] ${isDark ? 'text-zinc-400' : 'text-[#082621]/80'}`}>
                    Send this code to the Rivo Discord bot in DM to link your account.
                  </p>
                </div>
              ) : (
                <button
                  onClick={handleGenerateCode}
                  disabled={discordLoading}
                  className="brutal-btn py-1.5 bg-[#5865F2] hover:bg-[#4752c4] text-white font-mono text-xs font-bold uppercase brutal-border brutal-shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Radio size={14} />
                  {discordLoading ? 'Generating...' : 'Get Discord Link Code'}
                </button>
              )}

              {/* Direct Token Link Toggle */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowTokenInput(!showTokenInput)}
                  className="text-[10px] font-mono font-bold text-[#17a398] underline hover:text-[#26c4b7] mt-1"
                >
                  {showTokenInput ? '▲ Hide Direct Token Input' : '▼ Or Connect Directly via User Token'}
                </button>

                {showTokenInput && (
                  <div className={`mt-2 p-2.5 brutal-border flex flex-col gap-2 ${
                    isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-[#ede5d3] border-[#0b1110]'
                  }`}>
                    <input
                      type="password"
                      placeholder="Paste Discord User Token here..."
                      value={tokenInput}
                      onChange={(e) => setTokenInput(e.target.value)}
                      className={`w-full text-xs font-mono p-1.5 brutal-border focus:outline-none ${
                        isDark ? 'bg-zinc-950 text-white border-zinc-700' : 'bg-white text-[#0b1110] border-[#0b1110]'
                      }`}
                    />
                    <button
                      onClick={handleConnectToken}
                      disabled={discordLoading || !tokenInput.trim()}
                      className="brutal-btn py-1 bg-[#17a398] hover:bg-[#13847b] text-white font-mono text-xs font-bold brutal-border cursor-pointer disabled:opacity-50"
                    >
                      {discordLoading ? 'Connecting...' : 'Connect Token (Encrypted)'}
                    </button>
                    <p className={`text-[9px] ${isDark ? 'text-zinc-400' : 'text-[#082621]/60'}`}>
                      Tokens are encrypted with AES-256 and stored securely for presence updates only.
                    </p>
                  </div>
                )}
              </div>

              {discordMsg && (
                <p className={`text-[10px] font-mono text-center font-bold mt-1 ${isDark ? 'text-[#26c4b7]' : 'text-[#082621]'}`}>
                  {discordMsg}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Offline Mode Toggle */}
        <div className={`flex items-center justify-between py-3 border-b-2 ${
          isDark ? 'border-zinc-700' : 'border-[#0b1110]'
        }`}>
          <div>
            <span className={`text-xs font-mono font-black uppercase ${isDark ? 'text-white' : 'text-[#082621]'}`}>Offline Storage Mode</span>
            <p className={`text-[11px] ${isDark ? 'text-zinc-400' : 'text-[#082621]/70'}`}>Only play downloaded offline tracks</p>
          </div>
          <button
            onClick={() => setIsOfflineMode(!isOfflineMode)}
            className={`brutal-btn px-3 py-1 text-xs font-mono font-black uppercase brutal-border brutal-shadow-sm ${
              isOfflineMode 
                ? (isDark ? 'bg-[#17a398] text-white' : 'bg-[#082621] text-[#26c4b7]') 
                : (isDark ? 'bg-zinc-800 text-zinc-300 border-zinc-700' : 'bg-[#ede5d3] text-[#082621]')
            }`}
          >
            {isOfflineMode ? 'ACTIVE' : 'DISABLED'}
          </button>
        </div>

        {/* Crossfade Slider */}
        <div className={`py-4 border-b-2 ${isDark ? 'border-zinc-700' : 'border-[#0b1110]'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs font-mono font-black uppercase ${isDark ? 'text-white' : 'text-[#082621]'}`}>Crossfade</span>
            <span className={`text-xs font-mono font-bold px-2 py-0.5 brutal-border ${
              isDark ? 'bg-zinc-800 text-[#26c4b7] border-zinc-700' : 'bg-[#ede5d3] text-[#17a398] border-[#0b1110]'
            }`}>
              {crossfade} SECONDS
            </span>
          </div>
          <div className="relative w-full group h-4 flex items-center cursor-pointer">
            <div className={`w-full h-2.5 rounded-full overflow-hidden brutal-border ${isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-[#ede5d3] border-[#0b1110]'}`}>
              <div 
                className="h-full bg-[#17a398] group-hover:bg-[#26c4b7] transition-all duration-75"
                style={{ width: `${Math.min(100, Math.max(0, (crossfade / 12) * 100))}%` }}
              />
            </div>
            <div 
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full brutal-border shadow-md pointer-events-none transition-transform group-hover:scale-125 z-10"
              style={{ left: `calc(${Math.min(100, Math.max(0, (crossfade / 12) * 100))}% - 8px)` }}
            />
            <input
              type="range"
              min="0"
              max="12"
              step="1"
              value={crossfade}
              onChange={(e) => setCrossfade(Number(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
            />
          </div>
        </div>

        {/* Audio Streaming Quality */}
        <div className="py-4">
          <label className={`text-[10px] font-mono font-black uppercase block mb-2 ${isDark ? 'text-zinc-300' : 'text-[#082621]'}`}>
            AUDIO FIDELITY & STREAMING QUALITY
          </label>
          <div className="flex flex-col gap-1.5">
            {qualities.map((q) => (
              <button
                key={q.value}
                onClick={() => setAudioQuality(q.value)}
                className={`brutal-btn p-2.5 text-left text-xs font-mono font-bold flex items-center justify-between brutal-border ${
                  audioQuality === q.value 
                    ? (isDark ? 'bg-[#17a398] text-white border-zinc-700' : 'bg-[#082621] text-[#26c4b7] brutal-shadow-sm') 
                    : (isDark ? 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700' : 'bg-[#ede5d3] text-[#082621] hover:bg-white')
                }`}
              >
                <span>{q.label}</span>
                {audioQuality === q.value && <Check size={16} />}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={onClose}
          className="brutal-btn w-full py-2.5 bg-[#f59e0b] hover:bg-amber-400 text-[#0b1110] font-mono text-xs font-black uppercase brutal-border brutal-shadow cursor-pointer"
        >
          SAVE SETTINGS
        </button>

        {/* Version Information */}
        <div className={`mt-4 pt-3 border-t-2 text-center ${isDark ? 'border-zinc-700' : 'border-[#0b1110]'}`}>
          <p className="font-mono text-[11px] font-black uppercase tracking-wider text-[#17a398]">
            Rivo Sonic Dispensary {FULL_VERSION}
          </p>
          <p className={`font-mono text-[9px] mt-0.5 ${isDark ? 'text-zinc-400' : 'text-[#082621]/60'}`}>
            Non-stop Flow • Pure Sound Relief
          </p>
        </div>
      </div>
    </div>
  );
}
