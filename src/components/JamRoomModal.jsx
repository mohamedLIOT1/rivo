import React, { useState } from 'react';
import { X, Radio, Users, Copy, Check, Play, Pause, Volume2, Plus, Trash2, Search, Music, Headphones, UserMinus } from 'lucide-react';
import { resumeAudioContext } from '../utils/audioEngine';
import VerifiedBadge from './VerifiedBadge';

export default function JamRoomModal({ 
  isOpen, 
  onClose, 
  jamSession, 
  onStartJam, 
  onJoinJam, 
  onLeaveJam,
  currentTrack,
  isPlaying,
  tracks = [],
  onAddToJamQueue,
  onRemoveFromJamQueue,
  onPlayTrack,
  currentUser = null,
  socket = null,
  onKickMember = () => {},
  globalTheme = 'dark'
}) {
  const [inputCode, setInputCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [justAddedId, setJustAddedId] = useState(null);

  const isDark = globalTheme === 'dark' || (typeof document !== 'undefined' && document.documentElement.classList.contains('dark'));

  if (!isOpen) return null;

  const handleCopyCode = () => {
    if (jamSession) {
      navigator.clipboard.writeText(jamSession.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleTuneIn = () => {
    resumeAudioContext();
    if (currentTrack && onPlayTrack) {
      onPlayTrack(currentTrack);
    }
  };

  const filteredTracks = searchQuery.trim()
    ? tracks.filter(t => 
        (t.title && t.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (t.artist && t.artist.toLowerCase().includes(searchQuery.toLowerCase()))
      ).slice(0, 10)
    : tracks.slice(0, 8);

  const handleAddTrack = (track) => {
    onAddToJamQueue?.(track);
    setJustAddedId(track.id || track._id);
    setTimeout(() => setJustAddedId(null), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 select-none">
      <div className={`rounded-2xl max-w-lg w-full p-6 max-h-[92vh] flex flex-col overflow-hidden relative brutal-shadow-lg ${
        isDark ? 'bg-[#121212] text-white border-2 border-zinc-800' : 'bg-[#fdfbf7] text-[#0b1110] brutal-border-thick'
      }`}>
        {/* Modal Header */}
        <div className={`flex items-center justify-between pb-3 border-b-2 shrink-0 ${
          isDark ? 'border-zinc-800' : 'border-[#0b1110]'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-[#17a398] text-[#082621] brutal-border flex items-center justify-center font-black rounded-lg">
              <Radio size={18} />
            </div>
            <div>
              <h3 className={`text-base font-display font-black uppercase flex items-center gap-2 ${
                isDark ? 'text-white' : 'text-[#082621]'
              }`}>
                <span>Jam Session</span>
                {jamSession && (
                  <span className="w-2 h-2 rounded-full bg-[#17a398] animate-ping" />
                )}
              </h3>
              <p className={`text-[11px] font-sans ${isDark ? 'text-zinc-400' : 'text-[#082621]/70'}`}>
                Listen together with friends in real-time
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className={`brutal-btn p-1 brutal-border cursor-pointer rounded-lg ${
              isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-white border-zinc-700' : 'bg-[#ede5d3] hover:bg-[#ded2bb] text-[#0b1110] border-black'
            }`}
          >
            <X size={18} />
          </button>
        </div>

        {jamSession ? (
          <div className="py-4 flex flex-col gap-4 overflow-y-auto pr-1">
            {/* Active Jam Room Banner */}
            <div className={`p-4 brutal-border brutal-shadow text-center relative overflow-hidden rounded-xl ${
              isDark ? 'bg-zinc-900 text-white border-zinc-800' : 'bg-[#082621] text-[#fdfbf7]'
            }`}>
              <span className="text-[10px] font-mono font-black uppercase text-[#17a398]">ACTIVE JAM ROOM CODE</span>
              <h2 className="text-3xl font-mono font-black text-[#f59e0b] mt-1 tracking-wider">{jamSession.code}</h2>
              <p className={`text-xs mt-1 font-sans ${isDark ? 'text-zinc-400' : 'text-[#ded2bb]'}`}>
                Share this code with friends to synchronize listening.
              </p>

              <div className="mt-3 flex items-center justify-center gap-2 flex-wrap">
                <button
                  onClick={handleCopyCode}
                  className={`brutal-btn px-4 py-2 font-mono font-black text-xs uppercase brutal-border brutal-shadow-sm inline-flex items-center gap-1.5 cursor-pointer rounded-lg ${
                    isDark ? 'bg-zinc-800 text-white border-zinc-700 hover:bg-zinc-700' : 'bg-[#fdfbf7] text-[#082621]'
                  }`}
                >
                  {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                  <span>{copied ? 'CODE COPIED!' : 'COPY JAM CODE'}</span>
                </button>

                <button
                  onClick={handleTuneIn}
                  className="brutal-btn px-4 py-2 bg-[#17a398] hover:bg-[#26c4b7] text-black font-mono font-black text-xs uppercase brutal-border brutal-shadow-sm inline-flex items-center gap-1.5 cursor-pointer rounded-lg"
                  title="Force re-sync and unlock audio"
                >
                  <Headphones size={14} />
                  <span>SYNC AUDIO</span>
                </button>
              </div>
            </div>

            {/* Currently Synced Track */}
            {currentTrack && (
              <div className={`flex items-center gap-3 p-3 brutal-border rounded-xl ${
                isDark ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-[#ede5d3] border-black text-[#0b1110]'
              }`}>
                <img src={currentTrack.cover} alt={currentTrack.title} className="w-11 h-11 brutal-border object-cover bg-white shrink-0 rounded-lg" />
                <div className="truncate flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono font-black uppercase text-[#17a398]">
                      {isPlaying ? 'PLAYING IN SYNC' : 'PLAYBACK PAUSED'}
                    </span>
                    <span className={`w-1.5 h-1.5 rounded-full ${isPlaying ? 'bg-[#17a398] animate-pulse' : 'bg-amber-400'}`} />
                  </div>
                  <h4 className={`font-bold text-xs sm:text-sm truncate ${isDark ? 'text-white' : 'text-[#0b1110]'}`}>{currentTrack.title}</h4>
                  <p className={`text-[11px] truncate font-medium ${isDark ? 'text-zinc-400' : 'text-[#082621]/70'}`}>{currentTrack.artist}</p>
                </div>
              </div>
            )}

            {/* ── Linked Shared Queue Section ── */}
            <div className={`brutal-border p-4 rounded-xl ${
              isDark ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-[#fdfbf7] border-black text-[#0b1110]'
            }`}>
              <div className={`flex items-center justify-between mb-3 pb-2 border-b ${
                isDark ? 'border-zinc-800' : 'border-[#0b1110]/20'
              }`}>
                <div className="flex items-center gap-2">
                  <Music size={15} className="text-[#17a398]" />
                  <h4 className={`text-xs font-mono font-black uppercase ${isDark ? 'text-white' : 'text-[#082621]'}`}>
                    JAM QUEUE ({jamSession.queue?.length || 0})
                  </h4>
                </div>
                <button
                  onClick={() => setIsSearchOpen(!isSearchOpen)}
                  className="brutal-btn px-3 py-1 bg-[#17a398] hover:bg-[#26c4b7] text-black text-[11px] font-mono font-black uppercase brutal-border brutal-shadow-sm flex items-center gap-1 cursor-pointer rounded-lg"
                >
                  <Plus size={13} />
                  <span>ADD SONG</span>
                </button>
              </div>

              {/* Add Song Search Drawer */}
              {isSearchOpen && (
                <div className={`mb-3 p-3 brutal-border rounded-xl ${
                  isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-[#ede5d3] border-black'
                }`}>
                  <div className="relative mb-2">
                    <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-zinc-400' : 'text-[#082621]/60'}`} />
                    <input
                      type="text"
                      placeholder="Search songs to queue..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={`w-full brutal-border pl-8 pr-3 py-1.5 text-xs font-mono rounded-lg focus:outline-none ${
                        isDark ? 'bg-zinc-900 border-zinc-700 text-white placeholder-zinc-500' : 'bg-[#fdfbf7] border-black text-[#0b1110]'
                      }`}
                    />
                  </div>

                  <div className="max-h-40 overflow-y-auto flex flex-col gap-1.5 pr-1">
                    {filteredTracks.map((track) => (
                      <div
                        key={track.id || track._id}
                        className={`flex items-center justify-between p-2 brutal-border text-xs rounded-lg ${
                          isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-[#fdfbf7] border-black'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                          <img src={track.cover} alt={track.title} className="w-7 h-7 brutal-border object-cover shrink-0 bg-white rounded" />
                          <div className="truncate">
                            <p className={`font-bold truncate text-xs ${isDark ? 'text-white' : 'text-[#0b1110]'}`}>{track.title}</p>
                            <p className={`text-[10px] truncate ${isDark ? 'text-zinc-400' : 'text-[#082621]/70'}`}>{track.artist}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleAddTrack(track)}
                          className={`brutal-btn px-2.5 py-1 brutal-border text-[10px] font-mono font-black uppercase flex items-center gap-1 rounded ${
                            justAddedId === (track.id || track._id)
                              ? 'bg-[#17a398] text-black'
                              : 'bg-[#f59e0b] text-black'
                          }`}
                        >
                          {justAddedId === (track.id || track._id) ? (
                            <><Check size={11} /><span>QUEUED</span></>
                          ) : (
                            <><Plus size={11} /><span>QUEUE</span></>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Shared Queue List */}
              {jamSession.queue && jamSession.queue.length > 0 ? (
                <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
                  {jamSession.queue.map((track, idx) => (
                    <div
                      key={`${track.id || track._id}-${idx}`}
                      className={`flex items-center justify-between p-2 brutal-border text-xs rounded-lg ${
                        isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-[#ede5d3] border-black'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
                        <span className={`text-[10px] font-mono font-bold w-4 text-center ${isDark ? 'text-zinc-400' : 'text-[#082621]'}`}>{idx + 1}</span>
                        <img src={track.cover} alt={track.title} className="w-8 h-8 brutal-border object-cover shrink-0 bg-white rounded" />
                        <div className="truncate">
                          <p className={`font-bold truncate ${isDark ? 'text-white' : 'text-[#0b1110]'}`}>{track.title}</p>
                          <p className={`text-[10px] truncate ${isDark ? 'text-zinc-400' : 'text-[#082621]/70'}`}>{track.artist}</p>
                        </div>
                      </div>

                      <button
                        onClick={() => onRemoveFromJamQueue?.(idx, track.id || track._id)}
                        className="p-1 text-[#dc2626] hover:bg-red-500/20 rounded"
                        title="Remove from queue"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={`text-center py-5 text-xs font-mono ${isDark ? 'text-zinc-500' : 'text-[#082621]/70'}`}>
                  <p>JAM QUEUE IS CURRENTLY EMPTY.</p>
                </div>
              )}
            </div>

            {/* Active Members */}
            <div>
              <h4 className={`text-[10px] font-mono font-black uppercase mb-2 flex items-center gap-1.5 ${
                isDark ? 'text-zinc-400' : 'text-[#082621]'
              }`}>
                <Users size={13} className="text-[#17a398]" />
                <span>LISTENERS IN ROOM ({jamSession.members?.length || 1})</span>
              </h4>
              <div className="flex flex-col gap-1.5">
                {(() => {
                  const myMember = (jamSession.members || []).find(m => m.socketId === socket?.id || (currentUser?.id && (m.id === currentUser.id || m._id === currentUser.id)));
                  const isCurrentUserHost = Boolean(myMember?.isHost || jamSession.hostId === socket?.id);

                  return (jamSession.members || []).map((m) => (
                    <div key={m.id || m.socketId} className={`flex items-center justify-between p-2 brutal-border text-xs rounded-lg ${
                      isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-[#ede5d3] border-black'
                    }`}>
                      <div className="flex items-center gap-2">
                        <img src={m.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop'} alt={m.name} className="w-6 h-6 brutal-border object-cover shrink-0 bg-white rounded" />
                        <span className={`font-bold ${isDark ? 'text-white' : 'text-[#0b1110]'}`}>{m.name}</span>
                        <VerifiedBadge userOrName={m} size={12} />
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {m.isHost && (
                          <span className="text-[9px] font-mono font-black uppercase text-black bg-[#17a398] px-1.5 py-0.5 rounded">
                            HOST
                          </span>
                        )}

                        {isCurrentUserHost && !m.isHost && (
                          <button
                            onClick={() => {
                              if (window.confirm(`Disconnect "${m.name}" from Jam?`)) {
                                onKickMember?.(m);
                              }
                            }}
                            className="p-1 text-[#dc2626] hover:bg-red-500/20 rounded"
                            title={`Disconnect ${m.name}`}
                          >
                            <UserMinus size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>

            <button
              onClick={() => {
                onLeaveJam();
                onClose();
              }}
              className="brutal-btn w-full py-2.5 bg-red-500/10 hover:bg-red-500/20 text-[#dc2626] font-mono text-xs font-black uppercase brutal-border brutal-shadow-sm mt-1 rounded-lg cursor-pointer"
            >
              LEAVE JAM ROOM
            </button>
          </div>
        ) : (
          <div className="py-6 flex flex-col gap-4">
            {/* Host a New Jam */}
            <div className={`p-5 brutal-border rounded-xl ${
              isDark ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-[#ede5d3] border-black text-[#082621]'
            }`}>
              <h4 className={`font-display font-black uppercase text-sm ${isDark ? 'text-white' : 'text-[#082621]'}`}>
                Host a Jam
              </h4>
              <p className={`text-xs font-sans mt-1 mb-4 ${isDark ? 'text-zinc-400' : 'text-[#082621]/70'}`}>
                Start a live Jam room and invite friends to listen together in real-time.
              </p>
              <button
                onClick={() => {
                  resumeAudioContext();
                  onStartJam();
                }}
                className="brutal-btn w-full py-2.5 bg-[#17a398] hover:bg-[#26c4b7] text-black font-display font-black text-xs uppercase brutal-border brutal-shadow flex items-center justify-center gap-2 cursor-pointer rounded-lg"
              >
                <Radio size={15} />
                <span>Create Jam</span>
              </button>
            </div>

            {/* Join an Existing Room */}
            <div className={`p-5 brutal-border rounded-xl ${
              isDark ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-[#ede5d3] border-black text-[#082621]'
            }`}>
              <h4 className={`font-display font-black uppercase text-sm ${isDark ? 'text-white' : 'text-[#082621]'}`}>
                Join a Jam
              </h4>
              <p className={`text-xs font-sans mt-1 mb-3 ${isDark ? 'text-zinc-400' : 'text-[#082621]/70'}`}>
                Enter the Jam room code provided by another listener.
              </p>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. JAM-9921"
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                  className={`flex-1 brutal-border px-3 py-2 text-xs font-mono font-bold uppercase focus:outline-none rounded-lg ${
                    isDark ? 'bg-zinc-800 border-zinc-700 text-white placeholder-zinc-500' : 'bg-[#fdfbf7] border-black text-[#0b1110]'
                  }`}
                />
                <button
                  onClick={() => {
                    if (inputCode.trim()) {
                      resumeAudioContext();
                      onJoinJam(inputCode.trim());
                      setInputCode('');
                    }
                  }}
                  className="brutal-btn px-5 py-2 bg-[#f59e0b] hover:bg-amber-400 text-black font-display font-black text-xs uppercase brutal-border brutal-shadow-sm cursor-pointer rounded-lg"
                >
                  Join
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
