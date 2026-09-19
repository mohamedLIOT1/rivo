import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, Check, Loader2, Sparkles, Image, User, FileText, CheckCircle2 } from 'lucide-react';
import { API_BASE_URL } from '../config';

export default function EditArtistModal({
  isOpen,
  onClose,
  artist,
  onSaved = () => {},
  globalTheme = 'dark'
}) {
  const isDark = globalTheme === 'dark';

  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [cover, setCover] = useState('');
  const [banner, setBanner] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (artist) {
      const artName = artist.name || artist.artist || (typeof artist === 'string' ? artist : '');
      setName(artName);
      setBio(artist.bio || '');
      setCover(artist.cover || artist.avatar || '');
      setBanner(artist.banner || '');
      setIsVerified(Boolean(artist.isVerified || artist.verified));
      setError(null);
    }
  }, [artist, isOpen]);

  if (!isOpen || !artist) return null;

  const originalName = artist.name || artist.artist || (typeof artist === 'string' ? artist : '');

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Artist name cannot be empty');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const token = localStorage.getItem('liofy_token') || '';
      const res = await fetch(`${API_BASE_URL}/api/artists/${encodeURIComponent(originalName)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: name.trim(),
          bio: bio.trim(),
          cover: cover.trim(),
          banner: banner.trim(),
          isVerified
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update artist profile');
      }

      onSaved(data.artist || {
        ...artist,
        name: name.trim(),
        bio: bio.trim(),
        cover: cover.trim(),
        banner: banner.trim(),
        isVerified
      });
      onClose();
    } catch (err) {
      console.error('Save artist error:', err);
      setError(err.message || 'Error updating artist');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs select-none animate-fadeIn">
      <div 
        className={`w-full max-w-lg p-6 brutal-shadow-lg brutal-border-thick rounded-2xl relative max-h-[90vh] overflow-y-auto ${
          isDark ? 'bg-[#121816] text-white border-zinc-700' : 'bg-[#fdfbf7] text-[#0b1110] border-black'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b-2 border-dashed border-zinc-700">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#f59e0b] text-black flex items-center justify-center brutal-border shrink-0">
              <ShieldCheck size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-black text-sm uppercase tracking-wider">
                  Admin: Edit Artist Page
                </h3>
                <span className="text-[9px] font-mono font-black uppercase px-1.5 py-0.5 rounded bg-[#f59e0b] text-black">
                  Admin Exclusive
                </span>
              </div>
              <p className={`text-[11px] font-sans ${isDark ? 'text-zinc-400' : 'text-[#082621]/70'}`}>
                Customizing public profile for <strong>{originalName}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isDark ? 'hover:bg-zinc-800 text-zinc-400 hover:text-white' : 'hover:bg-black/10 text-zinc-600'
            }`}
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border-2 border-red-500 text-red-500 text-xs font-bold font-mono">
            {error}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          {/* Artist Name */}
          <div>
            <label className="block text-[11px] font-mono font-bold uppercase mb-1 flex items-center gap-1.5">
              <User size={13} className="text-[#17a398]" /> Artist Display Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Marwan Pablo"
              className={`w-full p-2.5 text-xs font-bold rounded-lg brutal-border focus:outline-none ${
                isDark ? 'bg-[#1a2421] text-white border-zinc-700 focus:border-[#17a398]' : 'bg-white text-black border-black focus:border-[#17a398]'
              }`}
              required
            />
          </div>

          {/* Verified Artist Toggle */}
          <div 
            onClick={() => setIsVerified(!isVerified)}
            className={`flex items-center justify-between p-3 rounded-xl brutal-border cursor-pointer transition-all ${
              isVerified 
                ? (isDark ? 'bg-[#17a398]/15 border-[#17a398]' : 'bg-[#17a398]/20 border-[#17a398]')
                : (isDark ? 'bg-[#182320] border-zinc-700' : 'bg-white/80 border-black/30')
            }`}
          >
            <div className="flex items-center gap-2.5">
              <CheckCircle2 size={18} className={isVerified ? 'text-[#17a398]' : 'text-zinc-500'} />
              <div>
                <span className="text-xs font-bold block">Verified Artist Status</span>
                <span className={`text-[10px] ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                  Displays official verified checkmark badge across all songs and search
                </span>
              </div>
            </div>
            <div className={`w-6 h-6 rounded-md flex items-center justify-center brutal-border ${
              isVerified ? 'bg-[#17a398] text-[#0b1110]' : 'bg-zinc-700 text-transparent'
            }`}>
              {isVerified && <Check size={14} strokeWidth={3} />}
            </div>
          </div>

          {/* Cover / Avatar URL */}
          <div>
            <label className="block text-[11px] font-mono font-bold uppercase mb-1 flex items-center gap-1.5">
              <Image size={13} className="text-[#17a398]" /> Profile Avatar / Photo URL
            </label>
            <input
              type="url"
              value={cover}
              onChange={(e) => setCover(e.target.value)}
              placeholder="https://..."
              className={`w-full p-2.5 text-xs font-mono rounded-lg brutal-border focus:outline-none ${
                isDark ? 'bg-[#1a2421] text-white border-zinc-700 focus:border-[#17a398]' : 'bg-white text-black border-black focus:border-[#17a398]'
              }`}
            />
          </div>

          {/* Banner URL */}
          <div>
            <label className="block text-[11px] font-mono font-bold uppercase mb-1 flex items-center gap-1.5">
              <Sparkles size={13} className="text-[#17a398]" /> Header Banner Photo URL (Optional)
            </label>
            <input
              type="url"
              value={banner}
              onChange={(e) => setBanner(e.target.value)}
              placeholder="https://images.unsplash.com/..."
              className={`w-full p-2.5 text-xs font-mono rounded-lg brutal-border focus:outline-none ${
                isDark ? 'bg-[#1a2421] text-white border-zinc-700 focus:border-[#17a398]' : 'bg-white text-black border-black focus:border-[#17a398]'
              }`}
            />
          </div>

          {/* Bio */}
          <div>
            <label className="block text-[11px] font-mono font-bold uppercase mb-1 flex items-center gap-1.5">
              <FileText size={13} className="text-[#17a398]" /> Artist Bio & Description
            </label>
            <textarea
              rows={4}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Write biography, achievements, genre roots..."
              className={`w-full p-2.5 text-xs font-medium rounded-lg brutal-border focus:outline-none resize-none leading-relaxed ${
                isDark ? 'bg-[#1a2421] text-white border-zinc-700 focus:border-[#17a398]' : 'bg-white text-black border-black focus:border-[#17a398]'
              }`}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-2.5 bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] font-mono text-xs font-black uppercase brutal-border brutal-shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 rounded-xl"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              <span>{isSaving ? 'SAVING CHANGES...' : 'SAVE ARTIST PROFILE'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className={`px-5 py-2.5 font-mono text-xs font-bold uppercase brutal-border rounded-xl cursor-pointer ${
                isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700' : 'bg-[#ede5d3] hover:bg-[#ded2bb] text-black border-black'
              }`}
            >
              CANCEL
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
