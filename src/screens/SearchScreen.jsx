import React, { useState } from 'react';
import { Search as SearchIcon, Play, Heart, PlusCircle, Sparkles } from 'lucide-react';
import { GENRES } from '../data/musicData';

export default function SearchScreen({ tracks, onSelectTrack, toggleLike, onOpenAddSongModal }) {
  const [query, setQuery] = useState('');

  const localFiltered = tracks.filter((t) => 
    t.title.toLowerCase().includes(query.toLowerCase()) ||
    t.artist.toLowerCase().includes(query.toLowerCase()) ||
    (t.genre && t.genre.toLowerCase().includes(query.toLowerCase()))
  );

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-32">
      {/* Header with Search Input */}
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold text-white mb-2">البحث في أغانيك ومكتبتك</h1>
        <p className="text-xs text-zinc-400 mb-4">ابحث في قائمة أغاني حسابك والمكتبة الخاصة بك</p>
        <div className="flex items-center gap-2 max-w-2xl">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
            <input
              type="text"
              placeholder="ابحث عن اسم الأغنية أو الفنان في مكتبتك..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-zinc-900 text-white placeholder-zinc-400 pl-12 pr-12 py-3.5 rounded-full border border-zinc-800 focus:outline-none focus:border-[#1DB954] text-sm font-semibold shadow-xl"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400 hover:text-white"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Banner for Importing new songs from YouTube / SoundCloud */}
      <div className="max-w-2xl bg-gradient-to-r from-zinc-900 via-zinc-900 to-[#1DB954]/10 p-4 rounded-2xl border border-zinc-800 flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#1DB954]/20 text-[#1DB954] flex items-center justify-center shrink-0">
            <Sparkles size={20} />
          </div>
          <div>
            <h4 className="text-xs font-extrabold text-white">تريد استيراد أغاني من YouTube أو SoundCloud؟</h4>
            <p className="text-[11px] text-zinc-400">يمكنك البحث وإضافة أغاني جديدة لمكتبتك مباشرة</p>
          </div>
        </div>
        {onOpenAddSongModal && (
          <button
            onClick={onOpenAddSongModal}
            className="py-2 px-3.5 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs rounded-xl transition-all shadow-md shrink-0 flex items-center gap-1.5"
          >
            <PlusCircle size={15} />
            <span>إضافة أغنية</span>
          </button>
        )}
      </div>

      {/* Search Results */}
      {query ? (
        <div className="flex flex-col gap-6 mb-8">
          <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
            <span>نتائج البحث في مكتبتك</span>
            <span className="text-xs text-[#1DB954] font-semibold">({localFiltered.length})</span>
          </h2>

          {localFiltered.length > 0 ? (
            <div className="flex flex-col gap-2">
              {localFiltered.map((track) => (
                <div
                  key={track.id}
                  onClick={() => onSelectTrack(track)}
                  className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/60 hover:bg-zinc-900 cursor-pointer group transition-all border border-zinc-800/60 gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img src={track.cover} alt={track.title} className="w-12 h-12 rounded-lg object-cover shrink-0" />
                    <div className="min-w-0">
                      <h4 className="text-sm font-extrabold text-white truncate group-hover:text-[#1DB954] transition-colors">{track.title}</h4>
                      <p className="text-xs text-zinc-400 truncate flex items-center gap-2 mt-0.5">
                        <span>{track.artist}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase bg-zinc-800 text-zinc-300">
                          {track.genre || 'Music'}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleLike(track.id);
                      }}
                      className="p-2 text-zinc-400 hover:text-white"
                    >
                      <Heart size={18} className={track.liked ? 'fill-[#1DB954] text-[#1DB954]' : ''} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectTrack(track);
                      }}
                      className="px-3 py-1.5 bg-[#1DB954] hover:bg-[#1ed760] text-black font-black text-xs rounded-lg transition-all flex items-center gap-1 shadow-md"
                    >
                      <Play size={14} fill="black" />
                      <span>تشغيل</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-zinc-400 text-xs font-semibold bg-zinc-900/40 rounded-2xl border border-zinc-800 p-6">
              لا توجد أغاني بهذا الاسم في مكتبتك حالياً. اضغط على "إضافة أغنية" بالأعلى لاستيرادها من YouTube أو SoundCloud 🎵
            </div>
          )}
        </div>
      ) : (
        /* Genre Category Cards Grid */
        <section>
          <h2 className="text-xl font-bold text-white mb-4">تصفح الأنواع الموسيقية</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {GENRES.map((g) => (
              <div
                key={g.id}
                onClick={() => setQuery(g.name)}
                style={{ backgroundColor: g.color }}
                className="relative h-36 rounded-xl p-4 overflow-hidden cursor-pointer shadow-lg hover:scale-[1.02] transition-transform flex flex-col justify-between group"
              >
                <h3 className="text-xl font-extrabold text-white drop-shadow-md">{g.name}</h3>
                <div className="absolute -bottom-2 -right-2 text-6xl group-hover:scale-110 transition-transform opacity-90">
                  {g.icon}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
