import React, { useState } from 'react';
import { Search as SearchIcon, Play, Heart, PlusCircle, X } from 'lucide-react';
import { GENRES } from '../data/musicData';

export default function SearchScreen({ tracks, onSelectTrack, toggleLike, onOpenAddSongModal }) {
  const [query, setQuery] = useState('');

  const localFiltered = tracks.filter((t) => 
    t.title.toLowerCase().includes(query.toLowerCase()) ||
    t.artist.toLowerCase().includes(query.toLowerCase()) ||
    (t.genre && t.genre.toLowerCase().includes(query.toLowerCase()))
  );

  return (
    <div 
      className="flex-1 overflow-y-auto select-none"
      style={{ 
        background: '#121212',
        paddingBottom: 'calc(var(--player-height) + 32px)',
      }}
    >
      {/* ── Top Section ── */}
      <div className="px-4 md:px-6 pt-6 pb-4">
        <h1 className="text-3xl font-extrabold text-white mb-5 tracking-tight">Search</h1>

        {/* Search Input */}
        <div className="relative max-w-xl mb-4">
          <SearchIcon 
            className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" 
            size={20} 
            style={{ color: '#121212' }}
          />
          <input
            id="search-input"
            type="text"
            placeholder="What do you want to listen to?"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            className="w-full font-semibold text-sm"
            style={{
              background: '#fff',
              color: '#000',
              border: 'none',
              borderRadius: '500px',
              padding: '12px 48px 12px 48px',
              outline: 'none',
              boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            }}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2"
              style={{ color: '#121212' }}
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Add Song Banner */}
        {!query && onOpenAddSongModal && (
          <div 
            className="max-w-xl flex items-center justify-between gap-4 p-4 rounded-lg mb-6"
            style={{ background: '#1DB95420', border: '1px solid #1DB95430' }}
          >
            <div>
              <p className="text-sm font-bold text-white">Want to add songs from YouTube or SoundCloud?</p>
              <p className="text-xs mt-0.5" style={{ color: '#b3b3b3' }}>Import songs and lyrics directly to your library</p>
            </div>
            <button
              onClick={onOpenAddSongModal}
              className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-[#1DB954] text-black hover:bg-[#1ed760] transition-all hover:scale-105 active:scale-95"
            >
              <PlusCircle size={14} />
              Add song
            </button>
          </div>
        )}
      </div>

      <div className="px-4 md:px-6">
        {query ? (
          /* ── Search Results ── */
          <div>
            {localFiltered.length > 0 ? (
              <>
                <p className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: '#b3b3b3' }}>
                  Songs — {localFiltered.length} results
                </p>

                {/* Top Result (first one) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                  {/* Big Top Result Card */}
                  <div>
                    <p className="text-xl font-extrabold text-white mb-3">Top result</p>
                    <div 
                      onClick={() => onSelectTrack(localFiltered[0])}
                      className="p-5 rounded-lg cursor-pointer relative group h-48 flex flex-col justify-end hover:brightness-110 transition-all"
                      style={{ background: '#282828' }}
                    >
                      <img 
                        src={localFiltered[0].cover} 
                        alt={localFiltered[0].title}
                        className="w-24 h-24 rounded-lg shadow-2xl object-cover mb-3"
                      />
                      <p className="text-2xl font-extrabold text-white">{localFiltered[0].title}</p>
                      <p className="text-sm mt-1" style={{ color: '#b3b3b3' }}>{localFiltered[0].artist}</p>
                      <button 
                        className="absolute bottom-5 right-5 w-12 h-12 rounded-full bg-[#1DB954] text-black flex items-center justify-center shadow-2xl opacity-0 group-hover:opacity-100 transition-all hover:scale-105 hover:bg-[#1ed760]"
                        onClick={(e) => { e.stopPropagation(); onSelectTrack(localFiltered[0]); }}
                      >
                        <Play size={22} fill="black" className="ml-0.5" />
                      </button>
                    </div>
                  </div>

                  {/* Songs List (rest) */}
                  <div>
                    <p className="text-xl font-extrabold text-white mb-3">Songs</p>
                    <div className="flex flex-col gap-1">
                      {localFiltered.slice(0, 4).map((track) => (
                        <div
                          key={track.id}
                          onClick={() => onSelectTrack(track)}
                          className="flex items-center gap-3 p-2 rounded-md cursor-pointer group transition-colors hover:bg-white/10"
                        >
                          <img src={track.cover} alt={track.title} className="w-11 h-11 rounded object-cover shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white truncate">{track.title}</p>
                            <p className="text-xs truncate" style={{ color: '#b3b3b3' }}>{track.artist}</p>
                          </div>
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleLike(track.id); }}
                              className="p-1"
                            >
                              <Heart 
                                size={16} 
                                className={track.liked ? 'fill-white text-white' : 'text-[#b3b3b3] hover:text-white'}
                              />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* All Results List */}
                {localFiltered.length > 4 && (
                  <div>
                    <p className="text-xl font-extrabold text-white mb-3">All results</p>
                    <div className="flex flex-col gap-1">
                      {localFiltered.map((track) => (
                        <div
                          key={`all-${track.id}`}
                          onClick={() => onSelectTrack(track)}
                          className="flex items-center gap-3 p-3 rounded-md cursor-pointer group transition-colors hover:bg-white/10"
                        >
                          <img src={track.cover} alt={track.title} className="w-12 h-12 rounded object-cover shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white truncate group-hover:text-[#1DB954] transition-colors">
                              {track.title}
                            </p>
                            <p className="text-xs truncate" style={{ color: '#b3b3b3' }}>
                              {track.artist}
                              {track.genre && (
                                <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase" 
                                  style={{ background: '#333', color: '#b3b3b3' }}>
                                  {track.genre}
                                </span>
                              )}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleLike(track.id); }}
                              className="p-1.5"
                            >
                              <Heart 
                                size={16} 
                                className={track.liked ? 'fill-[#1DB954] text-[#1DB954]' : 'text-[#b3b3b3] hover:text-white'}
                              />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); onSelectTrack(track); }}
                              className="w-8 h-8 rounded-full bg-[#1DB954] text-black flex items-center justify-center hover:bg-[#1ed760] transition-colors"
                            >
                              <Play size={14} fill="black" className="ml-0.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-20">
                <p className="text-xl font-bold text-white mb-2">No results found for "{query}"</p>
                <p className="text-sm" style={{ color: '#b3b3b3' }}>
                  Please make sure your words are spelled correctly, or use fewer or different keywords.
                </p>
              </div>
            )}
          </div>
        ) : (
          /* ── Browse Categories ── */
          <section>
            <h2 className="text-xl font-extrabold text-white mb-4">Browse all</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {GENRES.map((g) => (
                <div
                  key={g.id}
                  onClick={() => setQuery(g.name)}
                  style={{ backgroundColor: g.color }}
                  className="relative h-32 rounded-lg p-3 overflow-hidden cursor-pointer hover:brightness-110 transition-all group"
                >
                  <h3 className="text-base font-extrabold text-white tracking-tight leading-tight z-10 relative">
                    {g.name}
                  </h3>
                  <div 
                    className="absolute -bottom-2 -right-2 text-5xl group-hover:scale-110 transition-transform"
                    style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.4))', transform: 'rotate(20deg)' }}
                  >
                    {g.icon}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
