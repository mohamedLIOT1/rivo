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
  onKickMember = () => {}
}) {
  const [inputCode, setInputCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [justAddedId, setJustAddedId] = useState(null);

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
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 select-none">
      <div className="bg-[#fdfbf7] brutal-border-thick brutal-shadow-lg max-w-lg w-full p-6 max-h-[92vh] flex flex-col overflow-hidden relative">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b-2 border-[#0b1110] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-[#082621] text-[#26c4b7] brutal-border flex items-center justify-center font-black">
              <Radio size={18} />
            </div>
            <div>
              <h3 className="text-base font-mono font-black uppercase text-[#082621] flex items-center gap-2">
                <span>Rivo Collective Radio</span>
                {jamSession && (
                  <span className="w-2 h-2 rounded-full bg-[#17a398] animate-ping" />
                )}
              </h3>
              <p className="text-[11px] text-[#082621]/70 font-sans">Synchronized multi-patient acoustic transmission</p>
            </div>
          </div>
          <button onClick={onClose} className="brutal-btn p-1 bg-[#ede5d3] brutal-border hover:bg-[#ded2bb] text-[#0b1110]">
            <X size={18} />
          </button>
        </div>

        {jamSession ? (
          <div className="py-4 flex flex-col gap-4 overflow-y-auto pr-1">
            {/* Active Jam Room Banner */}
            <div className="bg-[#082621] text-[#fdfbf7] p-4 brutal-border brutal-shadow text-center relative overflow-hidden">
              <span className="text-[10px] font-mono font-black uppercase text-[#26c4b7]">ACTIVE TRANSMISSION FREQUENCY</span>
              <h2 className="text-3xl font-mono font-black text-[#f59e0b] mt-1 tracking-wider">{jamSession.code}</h2>
              <p className="text-xs text-[#ded2bb] mt-1 font-sans">Share this broadcast key with fellow patients to synchronize listening.</p>

              <div className="mt-3 flex items-center justify-center gap-2 flex-wrap">
                <button
                  onClick={handleCopyCode}
                  className="brutal-btn px-4 py-2 bg-[#fdfbf7] text-[#082621] font-mono font-black text-xs uppercase brutal-border brutal-shadow-sm inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                  <span>{copied ? 'KEY COPIED!' : 'COPY BROADCAST KEY'}</span>
                </button>

                <button
                  onClick={handleTuneIn}
                  className="brutal-btn px-4 py-2 bg-[#26c4b7] text-[#082621] font-mono font-black text-xs uppercase brutal-border brutal-shadow-sm inline-flex items-center gap-1.5 cursor-pointer"
                  title="Force re-sync and unlock audio"
                >
                  <Headphones size={14} />
                  <span>SYNC / TUNE IN</span>
                </button>
              </div>
            </div>

            {/* Currently Synced Track */}
            {currentTrack && (
              <div className="flex items-center gap-3 p-3 bg-[#ede5d3] brutal-border">
                <img src={currentTrack.cover} alt={currentTrack.title} className="w-11 h-11 brutal-border object-cover bg-white shrink-0" />
                <div className="truncate flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono font-black uppercase text-[#17a398]">
                      {isPlaying ? 'DISPENSING IN SYNC' : 'TRANSMISSION PAUSED'}
                    </span>
                    <span className={`w-1.5 h-1.5 rounded-full ${isPlaying ? 'bg-[#17a398] animate-pulse' : 'bg-amber-400'}`} />
                  </div>
                  <h4 className="font-bold text-xs sm:text-sm text-[#0b1110] truncate">{currentTrack.title}</h4>
                  <p className="text-[11px] text-[#082621]/70 truncate font-medium">{currentTrack.artist}</p>
                </div>
              </div>
            )}

            {/* ── Linked Shared Queue Section ── */}
            <div className="bg-[#fdfbf7] brutal-border p-4">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#0b1110]/20">
                <div className="flex items-center gap-2">
                  <Music size={15} className="text-[#17a398]" />
                  <h4 className="text-xs font-mono font-black uppercase text-[#082621]">
                    BROADCAST QUEUE ({jamSession.queue?.length || 0})
                  </h4>
                </div>
                <button
                  onClick={() => setIsSearchOpen(!isSearchOpen)}
                  className="brutal-btn px-3 py-1 bg-[#f59e0b] hover:bg-amber-400 text-[#0b1110] text-[11px] font-mono font-black uppercase brutal-border brutal-shadow-sm flex items-center gap-1 cursor-pointer"
                >
                  <Plus size={13} />
                  <span>INJECT TRACK</span>
                </button>
              </div>

              {/* Add Song Search Drawer */}
              {isSearchOpen && (
                <div className="mb-3 p-3 bg-[#ede5d3] brutal-border">
                  <div className="relative mb-2">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#082621]/60" />
                    <input
                      type="text"
                      placeholder="Search dispensary catalogue to queue..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-[#fdfbf7] brutal-border pl-8 pr-3 py-1.5 text-xs font-mono text-[#0b1110] focus:outline-none"
                    />
                  </div>

                  <div className="max-h-40 overflow-y-auto flex flex-col gap-1.5 pr-1">
                    {filteredTracks.map((track) => (
                      <div
                        key={track.id || track._id}
                        className="flex items-center justify-between p-2 bg-[#fdfbf7] brutal-border text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                          <img src={track.cover} alt={track.title} className="w-7 h-7 brutal-border object-cover shrink-0 bg-white" />
                          <div className="truncate">
                            <p className="font-bold text-[#0b1110] truncate text-xs">{track.title}</p>
                            <p className="text-[10px] text-[#082621]/70 truncate">{track.artist}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleAddTrack(track)}
                          className={`brutal-btn px-2.5 py-1 brutal-border text-[10px] font-mono font-black uppercase flex items-center gap-1 ${
                            justAddedId === (track.id || track._id)
                              ? 'bg-[#082621] text-[#26c4b7]'
                              : 'bg-[#f59e0b] text-[#0b1110]'
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
                      className="flex items-center justify-between p-2 bg-[#ede5d3] brutal-border text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
                        <span className="text-[10px] font-mono font-bold text-[#082621] w-4 text-center">{idx + 1}</span>
                        <img src={track.cover} alt={track.title} className="w-8 h-8 brutal-border object-cover shrink-0 bg-white" />
                        <div className="truncate">
                          <p className="font-bold text-[#0b1110] truncate">{track.title}</p>
                          <p className="text-[10px] text-[#082621]/70 truncate">{track.artist}</p>
                        </div>
                      </div>

                      <button
                        onClick={() => onRemoveFromJamQueue?.(idx, track.id || track._id)}
                        className="p-1 text-[#dc2626] hover:bg-red-100"
                        title="Remove from queue"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-5 text-xs font-mono text-[#082621]/70">
                  <p>SHARED QUEUE IS CURRENTLY EMPTY.</p>
                </div>
              )}
            </div>

            {/* Active Members */}
            <div>
              <h4 className="text-[10px] font-mono font-black uppercase text-[#082621] mb-2 flex items-center gap-1.5">
                <Users size={13} className="text-[#17a398]" />
                <span>CONNECTED PATIENTS IN BROADCAST ({jamSession.members?.length || 1})</span>
              </h4>
              <div className="flex flex-col gap-1.5">
                {(() => {
                  const myMember = (jamSession.members || []).find(m => m.socketId === socket?.id || (currentUser?.id && (m.id === currentUser.id || m._id === currentUser.id)));
                  const isCurrentUserHost = Boolean(myMember?.isHost || jamSession.hostId === socket?.id);

                  return (jamSession.members || []).map((m) => (
                    <div key={m.id || m.socketId} className="flex items-center justify-between p-2 bg-[#ede5d3] brutal-border text-xs">
                      <div className="flex items-center gap-2">
                        <img src={m.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop'} alt={m.name} className="w-6 h-6 brutal-border object-cover shrink-0 bg-white" />
                        <span className="font-bold text-[#0b1110]">{m.name}</span>
                        <VerifiedBadge userOrName={m} size={12} />
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {m.isHost && (
                          <span className="text-[9px] font-mono font-black uppercase text-[#26c4b7] bg-[#082621] px-1.5 py-0.5">
                            TRANSMITTER HOST
                          </span>
                        )}

                        {isCurrentUserHost && !m.isHost && (
                          <button
                            onClick={() => {
                              if (window.confirm(`Disconnect "${m.name}" from broadcast?`)) {
                                onKickMember?.(m);
                              }
                            }}
                            className="p-1 text-[#dc2626] hover:bg-red-100"
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
              className="brutal-btn w-full py-2.5 bg-red-100 hover:bg-red-200 text-[#dc2626] font-mono text-xs font-black uppercase brutal-border brutal-shadow-sm mt-1"
            >
              DISCONNECT FROM BROADCAST
            </button>
          </div>
        ) : (
          <div className="py-6 flex flex-col gap-4">
            {/* Host a New Jam */}
            <div className="bg-[#ede5d3] p-5 brutal-border">
              <h4 className="font-mono font-black uppercase text-[#082621] text-sm">Host Collective Transmission</h4>
              <p className="text-xs text-[#082621]/70 font-sans mt-1 mb-4">Initialize a synchronous audio broadcast and invite peers to tune in simultaneously.</p>
              <button
                onClick={() => {
                  resumeAudioContext();
                  onStartJam();
                }}
                className="brutal-btn w-full py-2.5 bg-[#082621] hover:bg-[#0b1110] text-[#26c4b7] font-mono text-xs font-black uppercase brutal-border brutal-shadow flex items-center justify-center gap-2 cursor-pointer"
              >
                <Radio size={15} />
                <span>INITIALIZE BROADCAST CONSOLE</span>
              </button>
            </div>

            {/* Join an Existing Room */}
            <div className="bg-[#ede5d3] p-5 brutal-border">
              <h4 className="font-mono font-black uppercase text-[#082621] text-sm">Tune into Peer Transmission</h4>
              <p className="text-xs text-[#082621]/70 font-sans mt-1 mb-3">Input the broadcast frequency key provided by another listener.</p>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. RIVO-9921"
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                  className="flex-1 bg-[#fdfbf7] brutal-border px-3 py-2 text-xs font-mono font-bold text-[#0b1110] uppercase focus:outline-none"
                />
                <button
                  onClick={() => {
                    if (inputCode.trim()) {
                      resumeAudioContext();
                      onJoinJam(inputCode.trim());
                      setInputCode('');
                    }
                  }}
                  className="brutal-btn px-5 py-2 bg-[#f59e0b] hover:bg-amber-400 text-[#0b1110] font-mono text-xs font-black uppercase brutal-border brutal-shadow-sm cursor-pointer"
                >
                  TUNE IN
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
