import React, { useState, useMemo } from 'react';
import { 
  Headphones, BookOpen, Mic, Play, Pause, Search, 
  Sparkles, Clock, Heart, Radio, Filter, ChevronRight
} from 'lucide-react';
import { PODCASTS_AND_AUDIOBOOKS } from '../data/podcastsAndBooks';
import { useAudioPlayer } from '../context/AudioContext';

export default function PodcastsScreen({
  onSelectTrack,
  toggleLike,
  globalTheme = 'dark',
}) {
  const isDark = globalTheme === 'dark';
  const { currentTrack, isPlaying } = useAudioPlayer() || {};
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'podcast' | 'audiobook'
  const [searchQuery, setSearchQuery] = useState('');

  const filteredItems = useMemo(() => {
    return PODCASTS_AND_AUDIOBOOKS.filter(item => {
      const matchCategory = activeTab === 'all' || item.category === activeTab;
      if (!matchCategory) return false;
      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase().trim();
      const text = `${item.title} ${item.artist} ${item.description || ''}`.toLowerCase();
      return text.includes(q);
    });
  }, [activeTab, searchQuery]);

  const formatDuration = (secs) => {
    if (!secs) return '';
    const m = Math.floor(secs / 60);
    const h = Math.floor(m / 60);
    if (h > 0) return `${h} س و ${m % 60} د`;
    return `${m} دقيقة`;
  };

  return (
    <div 
      className={`flex-1 overflow-y-auto select-none p-4 sm:p-6 transition-colors ${
        isDark ? 'bg-[#081210] text-[#fdfbf7]' : 'bg-[#eef8f6] text-[#081210]'
      }`}
      style={{ paddingBottom: 'calc(var(--player-height) + 50px)' }}
    >
      {/* ── HERO BANNER ── */}
      <section className="relative overflow-hidden rounded-2xl brutal-border border-emerald-500/40 bg-gradient-to-r from-[#04120e] via-[#09221b] to-[#04120e] p-5 sm:p-7 mb-6 shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={12} className="text-emerald-400" />
                RIVO AUDIO HUBS
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black font-display tracking-tight text-white mb-2">
              البودكاست والكتب الصوتية
            </h1>
            <p className="text-xs sm:text-sm text-emerald-200/80 max-w-xl font-medium leading-relaxed">
              استمع لأهم الحلقات المعرفية وملخصات الكتب العالمية والروايات المسموعة بأعلى نقاء صوتي وبدون فواصل.
            </p>
          </div>

          <div className="shrink-0 flex items-center gap-3">
            <div className="bg-[#051713] rounded-xl border border-emerald-500/30 p-3.5 text-center min-w-[120px]">
              <span className="text-[10px] font-mono text-emerald-400 block mb-0.5 font-bold uppercase">إجمالي العناوين</span>
              <div className="text-2xl font-black font-display text-white">{PODCASTS_AND_AUDIOBOOKS.length}</div>
              <span className="text-[10px] text-emerald-200/70">حلقة وكتاب</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── FILTER TABS & SEARCH BAR ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'all', label: 'الكل', icon: Sparkles },
            { id: 'podcast', label: 'بودكاست', icon: Mic },
            { id: 'audiobook', label: 'كتب صوتية', icon: BookOpen }
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-xl text-xs font-display font-black flex items-center gap-2 cursor-pointer transition-all ${
                  active
                    ? 'bg-emerald-400 text-black shadow-[0_0_15px_rgba(16,185,129,0.35)] scale-105'
                    : isDark
                      ? 'bg-[#0e221d] text-emerald-300 border border-emerald-900/80 hover:bg-[#132c26]'
                      : 'bg-white text-zinc-800 border border-zinc-300 hover:bg-zinc-100'
                }`}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400/60 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث عن بودكاست أو كتاب صوتي..."
            className={`w-full text-xs font-bold pl-9 pr-3 py-2.5 rounded-xl border focus:outline-none transition-colors ${
              isDark 
                ? 'bg-[#0a1815] text-white border-emerald-900/80 placeholder-emerald-500/50 focus:border-emerald-500' 
                : 'bg-white text-zinc-900 border-zinc-300 placeholder-zinc-500'
            }`}
          />
        </div>
      </div>

      {/* ── ITEMS GRID ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredItems.map(item => {
          const isCurrent = (currentTrack?.id === item.id) || (currentTrack?._id === item.id);
          const isCurrentPlaying = isCurrent && isPlaying;

          return (
            <div
              key={item.id}
              onClick={() => onSelectTrack && onSelectTrack(item, filteredItems)}
              className={`rounded-2xl border p-3.5 flex flex-col justify-between cursor-pointer transition-all duration-200 group ${
                isCurrent
                  ? 'bg-[#0f2e26] border-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.2)]'
                  : isDark
                    ? 'bg-[#091714] border-emerald-950/70 hover:border-emerald-500/40 hover:bg-[#0c1f1a]'
                    : 'bg-white border-zinc-200 hover:border-emerald-400 hover:shadow-md'
              }`}
            >
              <div>
                {/* Artwork */}
                <div className="relative w-full aspect-video rounded-xl overflow-hidden mb-3 border border-emerald-950/80 bg-black/40">
                  <img
                    src={item.cover}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-xs text-[10px] font-mono font-bold text-emerald-300 border border-emerald-500/30">
                    {item.category === 'podcast' ? '🎙️ بودكاست' : '📖 كتاب مسموع'}
                  </span>
                  {item.duration && (
                    <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-xs text-[10px] font-mono text-white flex items-center gap-1">
                      <Clock size={10} className="text-emerald-400" />
                      {formatDuration(item.duration)}
                    </span>
                  )}
                </div>

                {/* Title & Creator */}
                <h3 className={`font-bold text-sm line-clamp-1 group-hover:text-emerald-400 transition-colors ${
                  isCurrent ? 'text-emerald-300' : isDark ? 'text-white' : 'text-zinc-900'
                }`}>
                  {item.title}
                </h3>
                <p className="text-xs text-emerald-300/70 truncate mt-0.5 font-medium">
                  {item.artist}
                </p>
                <p className="text-[11px] text-zinc-400 line-clamp-2 mt-1.5 leading-relaxed">
                  {item.description}
                </p>
              </div>

              {/* Action Bar */}
              <div className="mt-4 pt-3 border-t border-emerald-950/60 flex items-center justify-between">
                <span className="text-[10px] font-mono text-emerald-400/80 uppercase tracking-wider">
                  {item.album}
                </span>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onSelectTrack) onSelectTrack(item, filteredItems);
                  }}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                    isCurrentPlaying
                      ? 'bg-emerald-400 text-black shadow-[0_0_15px_rgba(16,185,129,0.5)]'
                      : 'bg-emerald-950/60 hover:bg-emerald-400 text-emerald-300 hover:text-black border border-emerald-500/40'
                  }`}
                >
                  {isCurrentPlaying ? <Pause size={14} /> : <Play size={14} className="translate-x-0.5" />}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
