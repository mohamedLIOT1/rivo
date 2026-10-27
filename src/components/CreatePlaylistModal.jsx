import React, { useState, useEffect, useMemo } from 'react';
import { X, Plus, Camera, Globe, Lock, Sliders, Disc, Check, CheckSquare, Square, Search, ArrowLeft, HardDrive, Sparkles, DownloadCloud } from 'lucide-react';
import { getOfflineTracks } from '../utils/offlineStorage';
import { isDesktopApp } from '../version';

export default function CreatePlaylistModal({ isOpen, onClose, onCreatePlaylist, isQuran = false, allTracks = [] }) {
  // Step state: 'select_type' | 'form'
  const [step, setStep] = useState(isQuran ? 'form' : 'select_type');
  const [playlistType, setPlaylistType] = useState(isQuran ? 'standard' : 'standard'); // 'standard' | 'mix'

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [cover, setCover] = useState('');
  const [coverPreview, setCoverPreview] = useState('');
  const [isPublic, setIsPublic] = useState(true);

  // Device tracks for DJ Mix
  const [deviceTracks, setDeviceTracks] = useState([]);
  const [loadingDeviceTracks, setLoadingDeviceTracks] = useState(false);
  const [trackSearch, setTrackSearch] = useState('');
  const [selectedTrackIds, setSelectedTrackIds] = useState(new Set());

  // Reset or load state when modal opens
  useEffect(() => {
    if (isOpen) {
      if (isQuran) {
        setStep('form');
        setPlaylistType('standard');
      } else {
        setStep('select_type');
        setPlaylistType('standard');
      }
      setTitle('');
      setDescription('');
      setCover('');
      setCoverPreview('');
      setIsPublic(true);
      setTrackSearch('');
      setSelectedTrackIds(new Set());

      // Pre-load offline tracks from storage & memory
      loadDeviceTracks();
    }
  }, [isOpen, isQuran]);

  const loadDeviceTracks = async () => {
    setLoadingDeviceTracks(true);
    try {
      const offlineList = await getOfflineTracks().catch(() => []);
      const poolMap = new Map();

      // Add storage offline tracks
      (offlineList || []).forEach(t => {
        if (t && (t.id || t._id)) {
          const id = String(t.id || t._id);
          poolMap.set(id, { ...t, id, _id: id });
        }
      });

      // Add prop tracks flagged as downloaded or offline
      (allTracks || []).forEach(t => {
        if (t && (t.downloaded || t.isOffline)) {
          const id = String(t.id || t._id);
          if (!poolMap.has(id)) {
            poolMap.set(id, { ...t, id, _id: id });
          }
        }
      });

      const list = Array.from(poolMap.values());
      setDeviceTracks(list);

      // Auto-select all device tracks by default so user can quickly create mix
      const allIds = new Set(list.map(t => String(t.id || t._id)));
      setSelectedTrackIds(allIds);
    } catch {
      setDeviceTracks([]);
    } finally {
      setLoadingDeviceTracks(false);
    }
  };

  const filteredDeviceTracks = useMemo(() => {
    if (!trackSearch.trim()) return deviceTracks;
    const q = trackSearch.toLowerCase().trim();
    return (deviceTracks || []).filter(t => {
      const titleStr = (t.title || '').toLowerCase();
      const artistStr = (t.artist || '').toLowerCase();
      return titleStr.includes(q) || artistStr.includes(q);
    });
  }, [deviceTracks, trackSearch]);

  if (!isOpen) return null;

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setCover(reader.result);
      setCoverPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const toggleTrackSelection = (id) => {
    const next = new Set(selectedTrackIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedTrackIds(next);
  };

  const selectAllFiltered = () => {
    const next = new Set(selectedTrackIds);
    filteredDeviceTracks.forEach(t => next.add(String(t.id || t._id)));
    setSelectedTrackIds(next);
  };

  const deselectAllFiltered = () => {
    const next = new Set(selectedTrackIds);
    filteredDeviceTracks.forEach(t => next.delete(String(t.id || t._id)));
    setSelectedTrackIds(next);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    const defaultCover = `https://ui-avatars.com/api/?name=${encodeURIComponent(title)}&background=082621&color=26c4b7&size=512&bold=true&format=svg`;
    const isMix = playlistType === 'mix';
    const trackIds = isMix ? Array.from(selectedTrackIds) : [];

    onCreatePlaylist(
      title.trim(),
      description.trim(),
      cover || defaultCover,
      isPublic,
      isQuran,
      isMix,
      trackIds
    );

    setTitle('');
    setDescription('');
    setCover('');
    setCoverPreview('');
    setIsPublic(true);
    setSelectedTrackIds(new Set());
    onClose();
  };

  const formatTime = (secs) => {
    if (!secs || isNaN(secs)) return '3:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 select-none">
      <div className={`bg-[#fdfbf7] brutal-border-thick brutal-shadow-lg w-full relative transition-all ${
        step === 'form' && playlistType === 'mix' ? 'max-w-xl' : 'max-w-md'
      } p-6 max-h-[92vh] flex flex-col`}>
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b-2 border-[#0b1110] shrink-0">
          <div className="flex items-center gap-2">
            {step === 'form' && !isQuran && (
              <button
                type="button"
                onClick={() => setStep('select_type')}
                className="brutal-btn p-1 bg-[#ede5d3] brutal-border hover:bg-[#ded2bb] text-[#0b1110] mr-1"
                title="Back to type selection"
              >
                <ArrowLeft size={16} />
              </button>
            )}
            <div className={`w-3 h-3 brutal-border ${playlistType === 'mix' ? 'bg-[#f59e0b]' : 'bg-[#17a398]'}`} />
            <h3 className="text-sm font-mono font-black uppercase text-[#082621]">
              {step === 'select_type'
                ? 'Choose Playlist Type'
                : isQuran
                ? 'Create Quran Playlist'
                : playlistType === 'mix'
                ? '🎛️ Create DJ Mix Playlist'
                : 'Create Standard Playlist'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="brutal-btn p-1 bg-[#ede5d3] brutal-border hover:bg-[#ded2bb] text-[#0b1110]"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── STEP 1: CHOOSE PLAYLIST TYPE ──────────────────────────────────── */}
        {step === 'select_type' && (
          <div className="flex flex-col gap-4 my-4 overflow-y-auto">
            <p className="text-xs font-mono text-[#082621]/70">
              Select what type of playlist you want to create:
            </p>

            {/* Standard Playlist Card */}
            <div
              onClick={() => {
                setPlaylistType('standard');
                setTitle('');
                setStep('form');
              }}
              className="group p-4 bg-[#ede5d3] hover:bg-white brutal-border brutal-shadow cursor-pointer transition-all flex items-start gap-4"
            >
              <div className="w-12 h-12 bg-[#082621] brutal-border flex items-center justify-center text-[#26c4b7] shrink-0 group-hover:bg-[#17a398] group-hover:text-[#082621] transition-colors">
                <Disc size={26} />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-xs font-mono font-black text-[#082621] uppercase">Standard Playlist</h4>
                  <span className="text-[10px] font-mono font-bold bg-[#fdfbf7] px-2 py-0.5 brutal-border text-[#082621]">
                    STREAMING
                  </span>
                </div>
                <p className="text-[11px] text-[#082621]/80 leading-relaxed">
                  Regular audio playlist for streaming, organizing, and saving your favorite tracks across Rivo.
                </p>
                <div className="mt-3 flex justify-end">
                  <span className="text-[10px] font-mono font-black uppercase text-[#17a398] group-hover:underline">
                    SELECT STANDARD →
                  </span>
                </div>
              </div>
            </div>

            {/* DJ Mix Playlist Card */}
            <div
              onClick={() => {
                if (!isDesktopApp) {
                  // In Web environment, alert the user about downloadable app requirement or proceed with caution
                  setPlaylistType('mix');
                  setTitle('My DJ Mix');
                  setStep('form');
                } else {
                  setPlaylistType('mix');
                  setTitle('My DJ Mix');
                  setStep('form');
                }
              }}
              className="group p-4 bg-[#17a398]/10 hover:bg-[#17a398]/20 border-2 border-[#17a398] brutal-shadow cursor-pointer transition-all flex items-start gap-4 relative overflow-hidden"
            >
              <div className="w-12 h-12 bg-[#17a398] brutal-border flex items-center justify-center text-[#082621] shrink-0">
                <Sliders size={26} />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-xs font-mono font-black text-[#082621] uppercase flex items-center gap-1.5">
                    <span>🎛️ DJ Mix Playlist</span>
                  </h4>
                  <span className="text-[10px] font-mono font-black bg-[#17a398] text-[#082621] px-2 py-0.5 brutal-border">
                    OFFLINE ENGINE
                  </span>
                </div>
                <p className="text-[11px] text-[#082621]/80 leading-relaxed">
                  Seamless continuous dual-engine crossfade mix powered by locally downloaded tracks on this device.
                </p>

                {!isDesktopApp && (
                  <div className="mt-2 p-1.5 bg-[#fdfbf7] brutal-border text-[10px] font-mono text-[#f59e0b] flex items-center gap-1.5">
                    <span>⚡ Optimized for Rivo Desktop & Mobile apps</span>
                  </div>
                )}

                <div className="mt-3 flex justify-end">
                  <span className="text-[10px] font-mono font-black uppercase text-[#082621] group-hover:underline">
                    CREATE DJ MIX →
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 2: CREATION FORM ─────────────────────────────────────────── */}
        {step === 'form' && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 my-3 flex-1 overflow-y-auto pr-1">
            {/* Title & Cover */}
            <div className="flex items-center gap-4 shrink-0">
              <label className="w-20 h-20 bg-[#ede5d3] brutal-border border-dashed hover:bg-white flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden relative group shrink-0">
                {coverPreview ? (
                  <img src={coverPreview} alt="cover preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-[#082621]">
                    {playlistType === 'mix' ? <Sliders size={22} className="text-[#17a398]" /> : <Camera size={22} />}
                    <span className="text-[8px] font-mono font-black uppercase">
                      {playlistType === 'mix' ? 'MIX ART' : 'COVER'}
                    </span>
                  </div>
                )}
                <div className="absolute inset-0 bg-[#082621]/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera size={18} className="text-[#26c4b7]" />
                </div>
                <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
              </label>

              <div className="flex-1">
                <label className="text-[10px] font-mono font-black uppercase text-[#082621] block mb-1">
                  {playlistType === 'mix'
                    ? 'DJ MIX TITLE *'
                    : isQuran
                    ? 'QURAN PLAYLIST TITLE *'
                    : 'PLAYLIST TITLE *'}
                </label>
                <input
                  type="text"
                  placeholder={
                    playlistType === 'mix'
                      ? 'e.g. Club Nights DJ Mix'
                      : isQuran
                      ? 'e.g. Surah Al-Baqarah Recitations'
                      : 'e.g. Chill Vibes Mix'
                  }
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  autoFocus
                  className="w-full bg-[#ede5d3] brutal-border px-3 py-2 text-xs font-sans font-bold text-[#0b1110] placeholder-[#082621]/40 focus:outline-none focus:bg-white"
                />
              </div>
            </div>

            {/* Description */}
            <div className="shrink-0">
              <label className="text-[10px] font-mono font-black uppercase text-[#082621] block mb-1">
                DESCRIPTION (OPTIONAL)
              </label>
              <textarea
                placeholder={
                  playlistType === 'mix'
                    ? 'Continuous seamless crossfade set with sample-accurate transitions...'
                    : 'Add an optional description...'
                }
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full bg-[#ede5d3] brutal-border px-3 py-1.5 text-xs font-sans font-medium text-[#0b1110] placeholder-[#082621]/40 focus:outline-none focus:bg-white resize-none"
              />
            </div>

            {/* Privacy Toggle */}
            <div className="p-2.5 bg-[#ede5d3] brutal-border flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                {isPublic ? <Globe size={16} className="text-[#17a398]" /> : <Lock size={16} className="text-[#f59e0b]" />}
                <div>
                  <p className="text-xs font-mono font-bold text-[#082621]">
                    {isPublic ? 'PUBLIC PLAYLIST' : 'PRIVATE PLAYLIST'}
                  </p>
                  <p className="text-[10px] text-[#082621]/70">
                    {isPublic ? 'Visible on your profile' : 'Only visible to you'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPublic(!isPublic)}
                className="brutal-btn px-2.5 py-1 bg-[#fdfbf7] brutal-border text-[9px] font-mono font-black uppercase text-[#082621]"
              >
                {isPublic ? 'PUBLIC' : 'PRIVATE'}
              </button>
            </div>

            {/* ── RECOMMENDED DEVICE TRACKS FOR DJ MIX ──────────────────────── */}
            {playlistType === 'mix' && (
              <div className="flex flex-col gap-2 p-3 bg-[#ede5d3]/70 brutal-border flex-1 min-h-[180px]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <HardDrive size={15} className="text-[#17a398]" />
                    <span className="text-[11px] font-mono font-black uppercase text-[#082621]">
                      Device Tracks ({filteredDeviceTracks.length})
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={selectAllFiltered}
                      className="px-2 py-0.5 bg-[#fdfbf7] brutal-border text-[9px] font-mono font-bold hover:bg-white text-[#082621]"
                    >
                      SELECT ALL
                    </button>
                    <button
                      type="button"
                      onClick={deselectAllFiltered}
                      className="px-2 py-0.5 bg-[#fdfbf7] brutal-border text-[9px] font-mono font-bold hover:bg-white text-[#082621]"
                    >
                      CLEAR
                    </button>
                    <span className="text-[9px] font-mono font-black bg-[#17a398] text-[#082621] px-2 py-0.5 brutal-border">
                      {selectedTrackIds.size} SELECTED
                    </span>
                  </div>
                </div>

                <p className="text-[10px] text-[#082621]/75">
                  Select songs currently saved on your device to include in this mix for instant zero-latency crossfades:
                </p>

                {/* Track Search */}
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-2.5 text-[#082621]/50" />
                  <input
                    type="text"
                    value={trackSearch}
                    onChange={(e) => setTrackSearch(e.target.value)}
                    placeholder="Search device tracks..."
                    className="w-full bg-white brutal-border pl-8 pr-3 py-1.5 text-xs font-mono text-[#0b1110] placeholder-[#082621]/40 focus:outline-none"
                  />
                </div>

                {/* Track List */}
                <div className="max-h-44 overflow-y-auto brutal-border bg-white divide-y divide-[#ede5d3]">
                  {loadingDeviceTracks ? (
                    <div className="p-4 text-center text-xs font-mono text-[#082621]/60">
                      Scanning device vault...
                    </div>
                  ) : filteredDeviceTracks.length === 0 ? (
                    <div className="p-4 text-center flex flex-col items-center gap-1.5">
                      <Disc size={20} className="text-[#082621]/40" />
                      <p className="text-xs font-mono font-bold text-[#082621]">
                        {deviceTracks.length === 0
                          ? 'No downloaded tracks found on this device.'
                          : 'No matching device tracks found.'}
                      </p>
                      <p className="text-[10px] text-[#082621]/60 max-w-xs">
                        {deviceTracks.length === 0
                          ? 'Tip: Download songs first to enable dual-buffer seamless DJ crossfading.'
                          : 'Try adjusting your search terms.'}
                      </p>
                    </div>
                  ) : (
                    filteredDeviceTracks.map((t) => {
                      const id = String(t.id || t._id);
                      const isSelected = selectedTrackIds.has(id);
                      return (
                        <div
                          key={id}
                          onClick={() => toggleTrackSelection(id)}
                          className={`p-2 flex items-center justify-between cursor-pointer transition-colors ${
                            isSelected ? 'bg-[#17a398]/15 hover:bg-[#17a398]/25' : 'hover:bg-[#fdfbf7]'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 flex-1 min-w-0 pr-2">
                            <div className="text-[#082621] shrink-0">
                              {isSelected ? (
                                <CheckSquare size={16} className="text-[#17a398]" />
                              ) : (
                                <Square size={16} className="text-[#082621]/40" />
                              )}
                            </div>
                            <div className="w-8 h-8 bg-[#ede5d3] brutal-border shrink-0 overflow-hidden">
                              {t.cover ? (
                                <img src={t.cover} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <Disc size={16} className="m-auto text-[#082621]/50" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-[#0b1110] truncate">{t.title}</p>
                              <p className="text-[10px] text-[#082621]/70 truncate">{t.artist || 'Unknown Artist'}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[9px] font-mono text-[#082621]/60">
                              {formatTime(t.duration)}
                            </span>
                            <span className="text-[8px] font-mono font-bold bg-[#ede5d3] px-1.5 py-0.5 brutal-border text-[#082621]">
                              LOCAL
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              className="brutal-btn w-full py-2.5 bg-[#082621] hover:bg-[#0b1110] text-[#26c4b7] font-mono text-xs font-black uppercase brutal-border brutal-shadow flex items-center justify-center gap-2 cursor-pointer mt-1 shrink-0"
            >
              <Plus size={16} />
              <span>
                {playlistType === 'mix'
                  ? `CREATE DJ MIX (${selectedTrackIds.size} TRACKS)`
                  : isQuran
                  ? 'CREATE QURAN PLAYLIST'
                  : 'CREATE PLAYLIST'}
              </span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
