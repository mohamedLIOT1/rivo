import React from 'react';
import { Play, Heart, Music, Plus, Edit3, Disc, Trash2 } from 'lucide-react';

export default function HomeScreen({ 
  tracks = [], 
  playlists = [], 
  artists = [], 
  onSelectTrack, 
  onSelectPlaylist, 
  toggleLike, 
  onSelectArtist,
  openAddSongModal,
  openEditSongModal,
  onDeleteTrack
}) {
  const defaultTrackCover = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><rect width="300" height="300" fill="%231DB954"/><circle cx="150" cy="150" r="90" fill="%23121212"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="%231DB954" font-size="80">🎵</text></svg>`;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const displayTracks = React.useMemo(() => {
    if (!tracks || tracks.length === 0) return [];
    const shuffled = [...tracks];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }, [tracks]);

  return (
    <div className="flex-1 overflow-y-auto pb-32 select-none px-4 md:px-8 py-6">
      {/* Top Greeting Banner */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl md:text-4xl font-black text-white tracking-tight">{getGreeting()}</h1>
        <button
          onClick={openAddSongModal}
          className="bg-gradient-to-r from-emerald-500 to-[#1DB954] text-black font-extrabold px-4 py-2 rounded-full text-xs flex items-center gap-2 shadow-lg hover:scale-105 active:scale-95 transition-all"
        >
          <Plus size={16} />
          <span>+ Add Song & Synced Lyrics</span>
        </button>
      </div>

      {tracks.length > 0 ? (
        <div className="flex flex-col gap-8">
          {/* Quick Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {displayTracks.slice(0, 6).map((track) => (
              <div
                key={track.id}
                onClick={() => onSelectTrack(track)}
                className="flex items-center gap-3 bg-zinc-900/80 hover:bg-zinc-800/80 rounded-xl overflow-hidden cursor-pointer transition-all border border-zinc-800/50 group"
              >
                <img 
                  src={track.cover || defaultTrackCover} 
                  onError={(e) => { e.target.src = defaultTrackCover; }}
                  alt={track.title} 
                  className="w-16 h-16 object-cover shrink-0" 
                />
                <div className="truncate flex-1">
                  <h4 className="font-bold text-sm text-white truncate">{track.title}</h4>
                  <p className="text-xs text-zinc-400 truncate">{track.artist}</p>
                </div>
                <div className="flex items-center gap-1 mr-2">
                  {onDeleteTrack && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('هل أنت تأكد من حذف هذه الأغنية؟')) {
                          onDeleteTrack(track.id);
                        }
                      }}
                      className="p-1.5 text-zinc-500 hover:text-red-400 rounded-full hover:bg-red-500/10"
                      title="Delete Track"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditSongModal(track);
                    }}
                    className="p-1.5 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-800"
                    title="Edit Song & Lyrics"
                  >
                    <Edit3 size={15} />
                  </button>
                  <button className="w-8 h-8 rounded-full bg-[#1DB954] text-black flex items-center justify-center shadow-xl opacity-0 group-hover:opacity-100 transition-opacity">
                    <Play size={14} fill="black" className="ml-0.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Suggested Songs (Randomly Shuffled) */}
          <section>
            <h2 className="text-xl font-extrabold text-white mb-4">Suggested Songs - أغاني مقترحة ({tracks.length})</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {displayTracks.map((track) => (
                <div
                  key={track.id}
                  onClick={() => onSelectTrack(track)}
                  className="bg-zinc-900/60 p-3 rounded-2xl border border-zinc-800/60 hover:bg-zinc-800/60 cursor-pointer group transition-all relative"
                >
                  <div className="relative aspect-square rounded-xl overflow-hidden mb-3 bg-zinc-950">
                    <img 
                      src={track.cover || defaultTrackCover} 
                      onError={(e) => { e.target.src = defaultTrackCover; }}
                      alt={track.title} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                    />
                    <button className="absolute bottom-2 right-2 w-10 h-10 rounded-full bg-[#1DB954] text-black flex items-center justify-center shadow-xl opacity-0 group-hover:opacity-100 transition-opacity">
                      <Play size={18} fill="black" className="ml-0.5" />
                    </button>
                  </div>
                  <div className="flex items-start justify-between">
                    <div className="truncate flex-1">
                      <h4 className="font-bold text-sm text-white truncate">{track.title}</h4>
                      <p className="text-xs text-zinc-400 truncate mt-0.5">{track.artist}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {onDeleteTrack && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('هل أنت تأكد من حذف هذه الأغنية؟')) {
                              onDeleteTrack(track.id);
                            }
                          }}
                          className="p-1 text-zinc-500 hover:text-red-400 rounded-full hover:bg-red-500/10"
                          title="Delete Track"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditSongModal(track);
                        }}
                        className="p-1 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-800 shrink-0"
                        title="Edit Song & Lyrics"
                      >
                        <Edit3 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : (
        /* Empty State Screen */
        <div className="my-12 flex flex-col items-center justify-center text-center p-8 bg-zinc-900/40 rounded-3xl border border-zinc-800/80 max-w-xl mx-auto">
          <div className="w-20 h-20 rounded-full bg-emerald-950/80 border border-emerald-500/30 flex items-center justify-center text-[#1DB954] mb-4 shadow-2xl">
            <Disc size={40} className="animate-spin-slow" />
          </div>
          <h2 className="text-2xl font-black text-white">Your Music Library is Empty</h2>
          <p className="text-xs md:text-sm text-zinc-400 mt-2 max-w-md">
            Add your custom MP3 songs, cover artwork, and synced karaoke lyrics to start listening!
          </p>

          <button
            onClick={openAddSongModal}
            className="mt-6 px-6 py-3.5 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-sm rounded-full shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
          >
            <Plus size={18} />
            <span>+ Add Your First Song & Lyrics</span>
          </button>
        </div>
      )}
    </div>
  );
}
