import React, { useState, useEffect } from 'react';
import { Radio, Copy, Check, Unlink } from 'lucide-react';
import { API_BASE_URL } from '../../config';
import { usePreferences } from '../../context/PreferencesContext';

export default function DiscordSettingCard({ isOpen, isDark = true }) {
  const { t } = usePreferences();
  const [discordStatus, setDiscordStatus] = useState(null);
  const [linkCode, setLinkCode] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [discordLoading, setDiscordLoading] = useState(false);
  const [discordMsg, setDiscordMsg] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);

  const isLoggedIn = Boolean(
    localStorage.getItem('rivo_token') || localStorage.getItem('liofy_token') || localStorage.getItem('token')
  );

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

  useEffect(() => {
    const handleMsg = (e) => {
      if (e.data?.type === 'RIVO_LINK_SUCCESS' && e.data.username) {
        setDiscordStatus({ linked: true, username: e.data.username, enabled: true });
        setDiscordMsg(`Linked successfully as @${e.data.username}!`);
      }
    };
    window.addEventListener('message', handleMsg);
    return () => window.removeEventListener('message', handleMsg);
  }, []);

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
    } catch {
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
    } catch {}
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
    } catch {}
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
    } catch {
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

  return (
    <div className={`py-4 border-b-2 p-3 brutal-border mb-3 ${
      isDark ? 'border-zinc-700 bg-zinc-800/60' : 'border-[#0b1110] bg-[#f2ecde]/50'
    }`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#5865F2] inline-block animate-pulse" />
          <span className={`text-xs font-mono font-black uppercase ${
            isDark ? 'text-white' : 'text-[#082621]'
          }`}>{t('settings.discordTitle')}</span>
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
        {t('settings.discordDesc')}
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
              }`}>{t('settings.discordToggle')}</span>
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
            {t('settings.discordUnlink')}
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
              <p className={`text-[10px] mb-2 ${isDark ? 'text-zinc-400' : 'text-[#082621]/80'}`}>
                Send this code to the Rivo Discord bot in DM to link your account.
              </p>
              <a
                href="https://discord.com/users/1440997674630250506"
                target="_blank"
                rel="noreferrer"
                className="brutal-btn inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[#5865F2] hover:bg-[#4752c4] text-white font-mono text-[11px] font-bold uppercase brutal-border brutal-shadow-sm transition"
              >
                Open RIVO Bot in Discord ↗
              </a>
            </div>
          ) : (
            <button
              onClick={handleGenerateCode}
              disabled={discordLoading}
              className="brutal-btn py-1.5 bg-[#5865F2] hover:bg-[#4752c4] text-white font-mono text-xs font-bold uppercase brutal-border brutal-shadow-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <Radio size={14} />
              {discordLoading ? 'Generating...' : t('settings.discordGenerateBtn')}
            </button>
          )}

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
  );
}
