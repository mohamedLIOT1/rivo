import React, { useState } from 'react';
import { 
  X, Radio, Users, Copy, Check, Play, Pause, Volume2, Plus, Trash2, 
  Search, Music, Headphones, UserMinus, Crown, GripVertical, ChevronUp, ChevronDown 
} from 'lucide-react';
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
  onReorderJamQueue = () => {},
  onTransferHost = () => {},
  onPlayTrack,
  currentUser = null,
  socket = null,
  onKickMember = () => {},
  onViewProfile = () => {},
  globalTheme = 'dark'
}) {
  const [inputCode, setInputCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [justAddedId, setJustAddedId] = useState(null);
  const [draggedQueueIndex, setDraggedQueueIndex] = useState(null);

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
    const activeTrack = jamSession?.currentTrack || currentTrack;
    if (activeTrack && onPlayTrack) {
      onPlayTrack(activeTrack, null, true);
    }
    if (jamSession && socket) {
      socket.emit('jam:request_sync', { roomCode: jamSession.code });
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
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 select-none">
      <div className={`rounded-2xl w-full max-w-lg md:max-w-2xl lg:max-w-3xl landscape:max-w-3xl p-4 sm:p-6 max-h-[95vh] flex flex-col overflow-hidden relative brutal-shadow-lg ${
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
          <div className="py-3 flex flex-col landscape:grid landscape:grid-cols-2 landscape:gap-4 gap-4 overflow-y-auto pr-1">
            {/* Left Column in Landscape: Controls & Members */}
            <div className="flex flex-col gap-3">
              {/* Active Jam Room Banner */}
              <div className={`p-3.5 brutal-border brutal-shadow text-center relative overflow-hidden rounded-xl ${
                isDark ? 'bg-zinc-900 text-white border-zinc-800' : 'bg-[#082621] text-[#fdfbf7]'
              }`}>
                <span className="text-[10px] font-mono font-black uppercase text-[#17a398]">ACTIVE JAM ROOM CODE</span>
                <h2 className="text-2xl sm:text-3xl font-mono font-black text-[#f59e0b] mt-0.5 tracking-wider">{jamSession.code}</h2>
                <p className={`text-[11px] mt-0.5 font-sans ${isDark ? 'text-zinc-400' : 'text-[#ded2bb]'}`}>
                  Share this code with friends to synchronize listening.
                </p>

                <div className="mt-2.5 flex items-center justify-center gap-2 flex-wrap">
                  <button
                    onClick={handleCopyCode}
                    className={`brutal-btn px-3.5 py-1.5 font-mono font-black text-xs uppercase brutal-border brutal-shadow-sm inline-flex items-center gap-1.5 cursor-pointer rounded-lg ${
                      isDark ? 'bg-zinc-800 text-white border-zinc-700 hover:bg-zinc-700' : 'bg-[#fdfbf7] text-[#082621]'
                    }`}
                  >
                    {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                    <span>{copied ? 'COPIED!' : 'COPY CODE'}</span>
                  </button>

                  <button
                    onClick={handleTuneIn}
                    className="brutal-btn px-3.5 py-1.5 bg-[#17a398] hover:bg-[#26c4b7] text-black font-mono font-black text-xs uppercase brutal-border brutal-shadow-sm inline-flex items-center gap-1.5 cursor-pointer rounded-lg"
                    title="Force re-sync and unlock audio"
                  >
                    <Headphones size={14} />
                    <span>SYNC AUDIO</span>
                  </button>
                </div>
              </div>

              {/* Host Control Mode Banner */}
              {(() => {
                const myMember = (jamSession.members || []).find(m => m.socketId === socket?.id || (currentUser?.id && (m.id === currentUser.id || m._id === currentUser.id)));
                const isCurrentUserHost = Boolean(myMember?.isHost || jamSession.hostId === socket?.id || (currentUser?.id && jamSession.hostUserId && String(jamSession.hostUserId) === String(currentUser.id)));
                const isHostOnly = Boolean(jamSession.hostOnlyControl);

                return (
                  <div className={`p-2.5 rounded-xl border flex items-center justify-between gap-2.5 ${
                    isDark ? 'bg-zinc-900/80 border-zinc-800 text-white' : 'bg-[#f4eee0] border-black/20 text-[#0b1110]'
                  }`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <Radio size={15} className={isHostOnly ? 'text-amber-400 shrink-0' : 'text-[#17a398] shrink-0'} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-[11px] font-bold ${isHostOnly ? 'text-amber-400' : 'text-[#17a398]'}`}>
                            {isHostOnly ? 'Host-Only Control Locked' : 'Collaborative Control Active'}
                          </span>
                        </div>
                        <p className={`text-[10px] truncate ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                          {isHostOnly ? 'Members can listen only; only host can change tracks' : 'Any member in this room can play, pause & change tracks'}
                        </p>
                      </div>
                    </div>

                    {isCurrentUserHost && (
                      <button
                        type="button"
                        onClick={() => {
                          const nextMode = !isHostOnly;
                          socket?.emit('jam:set_control_mode', { roomCode: jamSession.code, hostOnlyControl: nextMode });
                        }}
                        className={`px-2.5 py-1 text-[10px] font-mono font-black uppercase rounded-lg brutal-border cursor-pointer shrink-0 transition-colors ${
                          isHostOnly ? 'bg-amber-400 hover:bg-amber-500 text-black' : 'bg-[#17a398] hover:bg-[#26c4b7] text-black'
                        }`}
                      >
                        {isHostOnly ? 'Unlock for All' : 'Lock to Host'}
                      </button>
                    )}
                  </div>
                );
              })()}

              {/* Currently Synced Track */}
              {(() => {
                const activeTrack = jamSession?.currentTrack || currentTrack;
                const activePlaying = jamSession ? Boolean(jamSession.isPlaying) : isPlaying;
                if (!activeTrack) return null;

                return (
                  <div className={`flex items-center gap-2.5 p-2.5 brutal-border rounded-xl ${
                    isDark ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-[#ede5d3] border-black text-[#0b1110]'
                  }`}>
                    <img src={activeTrack.cover || activeTrack.coverUrl || '/favicon.ico'} alt={activeTrack.title} className="w-10 h-10 brutal-border object-cover bg-white shrink-0 rounded-lg" />
                    <div className="truncate flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-mono font-black uppercase text-[#17a398]">
                          {activePlaying ? 'PLAYING IN SYNC' : 'PLAYBACK PAUSED'}
                        </span>
                        <span className={`w-1.5 h-1.5 rounded-full ${activePlaying ? 'bg-[#17a398] animate-pulse' : 'bg-amber-400'}`} />
                      </div>
                      <h4 className={`font-bold text-xs truncate ${isDark ? 'text-white' : 'text-[#0b1110]'}`}>{activeTrack.title}</h4>
                      <p className={`text-[10px] truncate font-medium ${isDark ? 'text-zinc-400' : 'text-[#082621]/70'}`}>{activeTrack.artist}</p>
                    </div>
                  </div>
                );
              })()}

              {/* Active Members */}
              <div>
                <h4 className={`text-[10px] font-mono font-black uppercase mb-1.5 flex items-center gap-1.5 ${
                  isDark ? 'text-zinc-400' : 'text-[#082621]'
                }`}>
                  <Users size={12} className="text-[#17a398]" />
                  <span>LISTENERS IN ROOM ({jamSession.members?.length || 1})</span>
                </h4>
                <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto pr-1">
                  {(() => {
                    const myMember = (jamSession.members || []).find(m => m.socketId === socket?.id || (currentUser?.id && (m.id === currentUser.id || m._id === currentUser.id)));
                    const isCurrentUserHost = Boolean(myMember?.isHost || jamSession.hostId === socket?.id);

                    return (jamSession.members || []).map((m) => (
                      <div key={m.id || m.socketId} className={`flex items-center justify-between p-2 brutal-border text-xs rounded-lg ${
                        isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-[#ede5d3] border-black'
                      }`}>
                        <button
                          type="button"
                          onClick={() => {
                            onClose?.();
                            if (onViewProfile) onViewProfile(m.id || m._id);
                          }}
                          className="flex items-center gap-2 min-w-0 flex-1 mr-2 text-left hover:underline cursor-pointer group"
                          title={`View ${m.name}'s profile`}
                        >
                          <img src={m.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop'} alt={m.name} className="w-5 h-5 brutal-border object-cover shrink-0 bg-white rounded group-hover:scale-105 transition-transform" />
                          <span className={`font-bold truncate text-[11px] ${isDark ? 'text-white' : 'text-[#0b1110]'}`}>{m.name}</span>
                          <VerifiedBadge userOrName={m} size={11} />
                        </button>
                        
                        <div className="flex items-center gap-1.5 shrink-0">
                          {m.isHost && (
                            <span className="text-[8px] font-mono font-black uppercase text-black bg-[#17a398] px-1.5 py-0.5 rounded flex items-center gap-1">
                              <Crown size={9} strokeWidth={3} />
                              <span>HOST</span>
                            </span>
                          )}

                          {isCurrentUserHost && !m.isHost && (
                            <>
                              <button
                                onClick={() => {
                                  if (window.confirm(`Transfer host of this Jam to "${m.name}" without leaving?`)) {
                                    onTransferHost?.(m);
                                  }
                                }}
                                className="px-1.5 py-0.5 bg-[#f59e0b] hover:bg-amber-400 text-black font-mono font-black text-[8px] uppercase brutal-border rounded flex items-center gap-1 cursor-pointer"
                                title={`Transfer Host to ${m.name}`}
                              >
                                <Crown size={9} strokeWidth={2.5} />
                                <span>HOST</span>
                              </button>

                              <button
                                onClick={() => {
                                  if (window.confirm(`Disconnect "${m.name}" from Jam?`)) {
                                    onKickMember?.(m);
                                  }
                                }}
                                className="p-1 text-[#dc2626] hover:bg-red-500/20 rounded cursor-pointer"
                                title={`Disconnect ${m.name}`}
                              >
                                <UserMinus size={12} />
                              </button>
                            </>
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
                className="brutal-btn w-full py-2 bg-red-500/10 hover:bg-red-500/20 text-[#dc2626] font-mono text-[11px] font-black uppercase brutal-border brutal-shadow-sm rounded-lg cursor-pointer"
              >
                LEAVE JAM ROOM
              </button>
            </div>

            {/* Right Column in Landscape: Linked Shared Queue Section */}
            <div className="flex flex-col gap-3">
              <div className={`brutal-border p-3.5 rounded-xl flex flex-col ${
                isDark ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-[#fdfbf7] border-black text-[#0b1110]'
              }`}>
                <div className={`flex items-center justify-between mb-2.5 pb-2 border-b ${
                  isDark ? 'border-zinc-800' : 'border-[#0b1110]/20'
                }`}>
                  <div className="flex items-center gap-2">
                    <Music size={14} className="text-[#17a398]" />
                    <h4 className={`text-xs font-mono font-black uppercase ${isDark ? 'text-white' : 'text-[#082621]'}`}>
                      JAM QUEUE ({jamSession.queue?.length || 0})
                    </h4>
                  </div>
                  <button
                    onClick={() => setIsSearchOpen(!isSearchOpen)}
                    className="brutal-btn px-2.5 py-1 bg-[#17a398] hover:bg-[#26c4b7] text-black text-[10px] font-mono font-black uppercase brutal-border brutal-shadow-sm flex items-center gap-1 cursor-pointer rounded-lg"
                  >
                    <Plus size={12} />
                    <span>ADD SONG</span>
                  </button>
                </div>

                {/* Add Song Search Drawer */}
                {isSearchOpen && (
                  <div className={`mb-3 p-2.5 brutal-border rounded-xl ${
                    isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-[#ede5d3] border-black'
                  }`}>
                    <div className="relative mb-2">
                      <Search size={13} className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${isDark ? 'text-zinc-400' : 'text-[#082621]/60'}`} />
                      <input
                        type="text"
                        placeholder="Search songs to queue..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className={`w-full brutal-border pl-7 pr-3 py-1 text-xs font-mono rounded-lg focus:outline-none ${
                          isDark ? 'bg-zinc-900 border-zinc-700 text-white placeholder-zinc-500' : 'bg-[#fdfbf7] border-black text-[#0b1110]'
                        }`}
                      />
                    </div>

                    <div className="max-h-36 overflow-y-auto flex flex-col gap-1 pr-1">
                      {filteredTracks.map((track) => (
                        <div
                          key={track.id || track._id}
                          className={`flex items-center justify-between p-1.5 brutal-border text-xs rounded-lg ${
                            isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-[#fdfbf7] border-black'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                            <img src={track.cover} alt={track.title} className="w-6 h-6 brutal-border object-cover shrink-0 bg-white rounded" />
                            <div className="truncate">
                              <p className={`font-bold truncate text-[11px] ${isDark ? 'text-white' : 'text-[#0b1110]'}`}>{track.title}</p>
                              <p className={`text-[9px] truncate ${isDark ? 'text-zinc-400' : 'text-[#082621]/70'}`}>{track.artist}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleAddTrack(track)}
                            className={`brutal-btn px-2 py-0.5 brutal-border text-[9px] font-mono font-black uppercase flex items-center gap-1 rounded ${
                              justAddedId === (track.id || track._id)
                                ? 'bg-[#17a398] text-black'
                                : 'bg-[#f59e0b] text-black'
                            }`}
                          >
                            {justAddedId === (track.id || track._id) ? (
                              <><Check size={10} /><span>QUEUED</span></>
                            ) : (
                              <><Plus size={10} /><span>QUEUE</span></>
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Shared Queue List */}
                {jamSession.queue && jamSession.queue.length > 0 ? (
                  <div className="flex flex-col gap-1.5 max-h-56 landscape:max-h-64 overflow-y-auto pr-1">
                    {jamSession.queue.map((track, idx) => {
                      const isDragging = draggedQueueIndex === idx;
                      return (
                        <div
                          key={`${track.id || track._id}-${idx}`}
                          draggable
                          onDragStart={(e) => {
                            setDraggedQueueIndex(idx);
                            e.dataTransfer.effectAllowed = 'move';
                            try { e.dataTransfer.setData('text/plain', String(idx)); } catch {}
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (draggedQueueIndex !== null && draggedQueueIndex !== idx) {
                              onReorderJamQueue?.(draggedQueueIndex, idx);
                            }
                            setDraggedQueueIndex(null);
                          }}
                          onDragEnd={() => setDraggedQueueIndex(null)}
                          className={`flex items-center justify-between p-2 brutal-border text-xs rounded-lg transition-all ${
                            isDragging ? 'opacity-40 border-dashed border-[#17a398] scale-98' : ''
                          } ${
                            isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-[#ede5d3] border-black'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                            <div 
                              className="cursor-grab active:cursor-grabbing p-1 text-zinc-500 hover:text-[#17a398] shrink-0"
                              title="Drag to reorder song"
                            >
                              <GripVertical size={13} />
                            </div>
                            <span className={`text-[10px] font-mono font-bold w-4 text-center shrink-0 ${isDark ? 'text-zinc-400' : 'text-[#082621]'}`}>
                              {idx + 1}
                            </span>
                            <img src={track.cover} alt={track.title} className="w-7 h-7 brutal-border object-cover shrink-0 bg-white rounded" />
                            <div className="truncate min-w-0 flex-1">
                              <p className={`font-bold truncate text-[11px] ${isDark ? 'text-white' : 'text-[#0b1110]'}`}>{track.title}</p>
                              <p className={`text-[9px] truncate ${isDark ? 'text-zinc-400' : 'text-[#082621]/70'}`}>{track.artist}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {/* Move Up / Down Buttons (Great for Touch / Mobile) */}
                            <div className="flex flex-col">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => onReorderJamQueue?.(idx, idx - 1)}
                                className="p-0.5 hover:text-[#17a398] disabled:opacity-20 cursor-pointer"
                                title="Move up"
                              >
                                <ChevronUp size={11} />
                              </button>
                              <button
                                type="button"
                                disabled={idx === jamSession.queue.length - 1}
                                onClick={() => onReorderJamQueue?.(idx, idx + 1)}
                                className="p-0.5 hover:text-[#17a398] disabled:opacity-20 cursor-pointer"
                                title="Move down"
                              >
                                <ChevronDown size={11} />
                              </button>
                            </div>

                            <button
                              onClick={() => onRemoveFromJamQueue?.(idx, track.id || track._id)}
                              className="p-1 text-[#dc2626] hover:bg-red-500/20 rounded cursor-pointer"
                              title="Remove from queue"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className={`text-center py-6 text-xs font-mono ${isDark ? 'text-zinc-500' : 'text-[#082621]/70'}`}>
                    <p>JAM QUEUE IS CURRENTLY EMPTY.</p>
                  </div>
                )}
              </div>
            </div>
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
