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
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none">
      <div className="bg-[#181818] border border-zinc-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-cyan-400 text-black flex items-center justify-center font-black shadow-lg shadow-cyan-400/20">
              <Radio size={20} />
            </div>
            <div>
              <h3 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                <span>Spotify Jam Room</span>
                {jamSession && (
                  <span className="w-2 h-2 rounded-full bg-[#1DB954] animate-ping" />
                )}
              </h3>
              <p className="text-xs text-zinc-400">Listen together with friends in real-time</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-zinc-400 hover:text-white rounded-full hover:bg-white/10 transition-colors">
            <X size={20} />
          </button>
        </div>

        {jamSession ? (
          <div className="py-4 flex flex-col gap-4 overflow-y-auto pr-1">
            {/* Active Jam Room Banner */}
            <div className="bg-gradient-to-r from-cyan-950 via-zinc-900 to-black p-4 rounded-2xl border border-cyan-500/40 text-center relative overflow-hidden">
              <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400">Active Jam Session</span>
              <h2 className="text-3xl font-black text-white mt-0.5 tracking-wider font-mono">{jamSession.code}</h2>
              <p className="text-xs text-zinc-400 mt-1">Friends can join with this code to share controls and the queue.</p>

              <div className="mt-3 flex items-center justify-center gap-2 flex-wrap">
                <button
                  onClick={handleCopyCode}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-cyan-300 rounded-full font-bold text-xs inline-flex items-center gap-1.5 transition-colors border border-cyan-500/30 active:scale-95 shadow-md"
                >
                  {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                  <span>{copied ? 'Code Copied!' : 'Copy Code'}</span>
                </button>

                <button
                  onClick={handleTuneIn}
                  className="px-4 py-2 bg-cyan-400/20 hover:bg-cyan-400/30 text-cyan-200 rounded-full font-bold text-xs inline-flex items-center gap-1.5 transition-colors border border-cyan-400/30 active:scale-95 shadow-md"
                  title="Force re-sync and unlock audio"
                >
                  <Headphones size={14} className="text-cyan-400" />
                  <span>Sync / Tune In</span>
                </button>
              </div>
            </div>

            {/* Currently Synced Track */}
            {currentTrack && (
              <div className="flex items-center gap-3 p-3 bg-zinc-900 rounded-2xl border border-zinc-800">
                <div className="relative shrink-0">
                  <img src={currentTrack.cover} alt={currentTrack.title} className="w-12 h-12 rounded-xl object-cover shadow-md" />
                  {isPlaying && (
                    <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center">
                      <div className="flex items-end gap-0.5 h-3">
                        <div className="sp-eq-bar" />
                        <div className="sp-eq-bar" />
                        <div className="sp-eq-bar" />
                      </div>
                    </div>
                  )}
                </div>
                <div className="truncate flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] uppercase font-bold text-[#1DB954]">
                      {isPlaying ? 'Playing in Sync' : 'Paused in Room'}
                    </span>
                    <span className={`w-1.5 h-1.5 rounded-full ${isPlaying ? 'bg-[#1DB954] animate-pulse' : 'bg-amber-400'}`} />
                  </div>
                  <h4 className="font-bold text-sm text-white truncate">{currentTrack.title}</h4>
                  <p className="text-xs text-zinc-400 truncate">{currentTrack.artist}</p>
                </div>
              </div>
            )}

            {/* ── Linked Shared Queue Section ── */}
            <div className="bg-zinc-900/90 rounded-2xl border border-zinc-800 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Music size={16} className="text-cyan-400" />
                  <h4 className="text-xs font-black uppercase text-white tracking-wider">
                    Linked Queue ({jamSession.queue?.length || 0})
                  </h4>
                </div>
                <button
                  onClick={() => setIsSearchOpen(!isSearchOpen)}
                  className="px-3 py-1 bg-cyan-400 hover:bg-cyan-300 text-black text-xs font-bold rounded-full transition-transform active:scale-95 flex items-center gap-1"
                >
                  <Plus size={14} />
                  <span>Add Song</span>
                </button>
              </div>

              {/* Add Song Search Drawer */}
              {isSearchOpen && (
                <div className="mb-3 p-3 bg-zinc-950 rounded-xl border border-zinc-800 animate-in slide-in-from-top-2 duration-150">
                  <div className="relative mb-2">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input
                      type="text"
                      placeholder="Search songs to queue..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div className="max-h-40 overflow-y-auto flex flex-col gap-1.5 pr-1">
                    {filteredTracks.map((track) => (
                      <div
                        key={track.id || track._id}
                        className="flex items-center justify-between p-2 rounded-lg bg-zinc-900/60 hover:bg-zinc-800 transition-colors text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                          <img src={track.cover} alt={track.title} className="w-7 h-7 rounded object-cover shrink-0" />
                          <div className="truncate">
                            <p className="font-bold text-white truncate">{track.title}</p>
                            <p className="text-[10px] text-zinc-400 truncate">{track.artist}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleAddTrack(track)}
                          className={`px-2.5 py-1 rounded-md font-bold text-[11px] transition-all flex items-center gap-1 ${
                            justAddedId === (track.id || track._id)
                              ? 'bg-[#1DB954] text-black'
                              : 'bg-white/10 hover:bg-cyan-400 hover:text-black text-white'
                          }`}
                        >
                          {justAddedId === (track.id || track._id) ? (
                            <><Check size={12} /><span>Added!</span></>
                          ) : (
                            <><Plus size={12} /><span>Queue</span></>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Shared Queue List */}
              {jamSession.queue && jamSession.queue.length > 0 ? (
                <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
                  {jamSession.queue.map((track, idx) => (
                    <div
                      key={`${track.id || track._id}-${idx}`}
                      className="flex items-center justify-between p-2 bg-zinc-950/70 rounded-xl border border-zinc-800/80 text-xs group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
                        <span className="text-[10px] font-mono text-zinc-500 w-4 text-center">{idx + 1}</span>
                        <img src={track.cover} alt={track.title} className="w-8 h-8 rounded-lg object-cover shrink-0 shadow" />
                        <div className="truncate">
                          <p className="font-bold text-white truncate">{track.title}</p>
                          <p className="text-[10px] text-zinc-400 truncate">{track.artist}</p>
                        </div>
                      </div>

                      <button
                        onClick={() => onRemoveFromJamQueue?.(idx, track.id || track._id)}
                        className="p-1.5 text-zinc-500 hover:text-red-400 rounded-lg transition-colors"
                        title="Remove from queue"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-zinc-500 text-xs">
                  <p>The shared queue is empty.</p>
                  <p className="text-[11px] text-zinc-600 mt-0.5">Click "Add Song" above to put songs in queue!</p>
                </div>
              )}
            </div>

            {/* Active Members */}
            <div>
              <h4 className="text-xs font-bold uppercase text-zinc-400 mb-2 flex items-center gap-1.5">
                <Users size={14} className="text-cyan-400" />
                <span>Listeners in Room ({jamSession.members?.length || 1})</span>
              </h4>
              <div className="flex flex-col gap-2">
                {(() => {
                  const myMember = (jamSession.members || []).find(m => m.socketId === socket?.id || (currentUser?.id && (m.id === currentUser.id || m._id === currentUser.id)));
                  const isCurrentUserHost = Boolean(myMember?.isHost || jamSession.hostId === socket?.id);

                  return (jamSession.members || []).map((m) => (
                    <div key={m.id || m.socketId} className="flex items-center justify-between p-2.5 bg-zinc-900/60 rounded-xl border border-zinc-800 text-xs">
                      <div className="flex items-center gap-2.5">
                        <img src={m.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop'} alt={m.name} className="w-7 h-7 rounded-full object-cover shadow" />
                        <span className="font-bold text-white">{m.name}</span>
                        <VerifiedBadge userOrName={m} size={13} />
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {m.isHost && (
                          <span className="text-[10px] font-black text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded-full border border-cyan-500/40">
                            Host
                          </span>
                        )}

                        {/* Kick Button for Host */}
                        {isCurrentUserHost && !m.isHost && (
                          <button
                            onClick={() => {
                              if (window.confirm(`Kick "${m.name}" from the Jam room?`)) {
                                onKickMember?.(m);
                              }
                            }}
                            className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                            title={`Kick ${m.name} from Jam`}
                          >
                            <UserMinus size={14} />
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
              className="w-full py-3 bg-red-600/20 hover:bg-red-600/30 text-red-400 font-extrabold text-xs rounded-xl border border-red-500/30 transition-colors mt-2"
            >
              End / Leave Jam Room
            </button>
          </div>
        ) : (
          <div className="py-6 flex flex-col gap-6">
            {/* Host a New Jam */}
            <div className="bg-zinc-900 p-5 rounded-2xl border border-zinc-800">
              <h4 className="font-extrabold text-white text-base">Host a Jam Room</h4>
              <p className="text-xs text-zinc-400 mt-1 mb-4">Start a live sync room and invite your friends to control music and the queue together.</p>
              <button
                onClick={() => {
                  resumeAudioContext();
                  onStartJam();
                }}
                className="w-full py-3 bg-cyan-400 hover:bg-cyan-300 text-black font-extrabold text-xs rounded-xl shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2"
              >
                <Radio size={16} />
                <span>Create Jam Room</span>
              </button>
            </div>

            {/* Join an Existing Room */}
            <div className="bg-zinc-900 p-5 rounded-2xl border border-zinc-800">
              <h4 className="font-extrabold text-white text-base">Join Friend's Jam</h4>
              <p className="text-xs text-zinc-400 mt-1 mb-3">Enter the room code shared by your friend to sync music.</p>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. JAM-8821"
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                  className="flex-1 bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2.5 text-xs text-white uppercase tracking-wider font-mono focus:outline-none focus:border-cyan-400"
                />
                <button
                  onClick={() => {
                    if (inputCode.trim()) {
                      resumeAudioContext();
                      onJoinJam(inputCode.trim());
                      setInputCode('');
                    }
                  }}
                  className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white font-extrabold text-xs rounded-xl border border-zinc-700 active:scale-95 transition-transform"
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
