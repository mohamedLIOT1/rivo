import React, { useState } from 'react';
import { Mic2, Play, Pause, Clock, Radio, Volume2 } from 'lucide-react';
import { PODCASTS } from '../data/musicData';

export default function PodcastsScreen({ onPlayEpisode, globalTheme = 'dark' }) {
  const isDark = globalTheme === 'dark';
  const [selectedPodcast, setSelectedPodcast] = useState(PODCASTS[0]);
  const [playbackSpeed, setPlaybackSpeed] = useState('1.0x');

  const speedOptions = ['0.8x', '1.0x', '1.2x', '1.5x', '2.0x'];

  return (
    <div className={`flex-1 overflow-y-auto pb-32 select-none p-4 md:p-8 transition-colors ${
      isDark ? 'bg-[#0b1110] text-[#fdfbf7]' : 'bg-[#17a398] text-[#0b1110]'
    }`}>
      {/* ── Apothecary Broadcast Header ── */}
      <div className={`brutal-border-thick brutal-shadow-lg p-6 mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
        isDark ? 'bg-[#141d1b] border-zinc-700 text-white' : 'bg-[#fdfbf7] border-black text-[#082621]'
      }`}>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-[#082621] text-[#26c4b7] brutal-border flex items-center justify-center">
            <Radio size={24} />
          </div>
          <div>
            <div className={`text-[10px] font-mono font-black uppercase ${isDark ? 'text-zinc-400' : 'text-[#082621]/60'}`}>
              SPOKEN WORD & CLINICAL DISCOURSES
            </div>
            <h1 className={`text-2xl md:text-4xl font-display font-black ${isDark ? 'text-white' : 'text-[#082621]'}`}>
              RIVO BROADCAST BUREAU
            </h1>
          </div>
        </div>

        {/* Speed Controller Bar */}
        <div className={`flex items-center gap-2 p-2 brutal-border ${
          isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-300' : 'bg-[#ede5d3] border-black text-[#082621]'
        }`}>
          <span className="text-[10px] font-mono font-black uppercase px-1">VELOCITY:</span>
          {speedOptions.map((s) => (
            <button
              key={s}
              onClick={() => setPlaybackSpeed(s)}
              className={`brutal-btn px-2.5 py-1 text-xs font-mono font-black uppercase transition-all ${
                playbackSpeed === s 
                  ? 'bg-[#082621] text-[#26c4b7] brutal-border' 
                  : isDark
                    ? 'bg-zinc-700 text-zinc-200 hover:bg-zinc-600'
                    : 'bg-[#fdfbf7] text-[#082621] hover:bg-[#ded2bb]'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Podcast Shows Selector */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {PODCASTS.map((pod) => (
          <div
            key={pod.id}
            onClick={() => setSelectedPodcast(pod)}
            className={`p-4 cursor-pointer transition-all brutal-border flex items-center gap-4 ${
              selectedPodcast.id === pod.id 
                ? (isDark ? 'bg-[#141d1b] border-zinc-700 brutal-shadow-lg scale-[1.01]' : 'bg-[#fdfbf7] border-black brutal-shadow-lg scale-[1.01]')
                : (isDark ? 'bg-[#182320] border-zinc-700 hover:bg-[#141d1b] brutal-shadow-sm' : 'bg-[#ede5d3] border-black hover:bg-[#fdfbf7] brutal-shadow-sm')
            }`}
          >
            <img 
              src={pod.cover} 
              alt={pod.title} 
              className="w-20 h-20 brutal-border object-cover bg-white shrink-0" 
              onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=Podcast&background=082621&color=26c4b7`; }}
            />
            <div className="min-w-0 flex-1">
              <div className="text-[9px] font-mono font-black uppercase text-[#17a398] mb-0.5">
                AUDIO SERIES • #{String(pod.id).slice(-3)}
              </div>
              <h3 className={`font-display font-bold text-base truncate ${isDark ? 'text-white' : 'text-[#082621]'}`}>{pod.title}</h3>
              <p className={`text-xs font-medium truncate mt-0.5 ${isDark ? 'text-zinc-400' : 'text-[#082621]/70'}`}>{pod.author}</p>
              <span className="inline-block text-[10px] font-mono font-black bg-[#082621] text-[#26c4b7] px-2 py-0.5 mt-2">
                {pod.episodesCount} TAPES ARCHIVED
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Episodes List */}
      <section className={`brutal-border-thick brutal-shadow-lg p-6 ${
        isDark ? 'bg-[#141d1b] border-zinc-700 text-white' : 'bg-[#fdfbf7] border-black text-[#082621]'
      }`}>
        <div className={`flex items-center justify-between pb-3 mb-4 border-b-2 ${
          isDark ? 'border-zinc-700 text-zinc-300' : 'border-[#0b1110] text-[#082621]'
        }`}>
          <h2 className="text-lg font-mono font-black uppercase">
            TAPES ARCHIVE: {selectedPodcast.title}
          </h2>
          <span className={`text-[10px] font-mono font-bold ${isDark ? 'text-zinc-400' : 'text-[#082621]/60'}`}>CLINICAL AUDIO LOGS</span>
        </div>

        <div className="flex flex-col gap-3">
          {selectedPodcast.episodes.map((ep) => (
            <div
              key={ep.id}
              className={`p-4 brutal-border brutal-shadow-sm transition-colors ${
                isDark ? 'bg-[#182320] border-zinc-700 hover:bg-[#202f2b]' : 'bg-[#ede5d3] border-black hover:bg-white'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-black text-[#17a398] uppercase">
                      DATE: {ep.date}
                    </span>
                    <span className={`text-[10px] font-mono font-bold ${isDark ? 'text-zinc-400' : 'text-[#082621]/60'}`}>• EPISODE #{ep.id}</span>
                  </div>
                  <h4 className={`text-sm font-bold mt-1 ${isDark ? 'text-white' : 'text-[#082621]'}`}>{ep.title}</h4>
                  <p className={`text-xs mt-1 line-clamp-2 font-medium ${isDark ? 'text-zinc-300' : 'text-[#082621]/80'}`}>{ep.description}</p>
                </div>
                <button
                  onClick={() => onPlayEpisode(ep, selectedPodcast)}
                  className="brutal-btn w-11 h-11 bg-[#f59e0b] hover:bg-amber-400 text-[#0b1110] brutal-border-thick brutal-shadow flex items-center justify-center shrink-0 cursor-pointer"
                  title="Dispense spoken audio"
                >
                  <Play size={20} fill="currentColor" className="ml-0.5 text-[#0b1110]" />
                </button>
              </div>

              <div className={`flex items-center gap-4 mt-3 pt-2 border-t text-xs font-mono font-bold ${
                isDark ? 'border-zinc-700 text-zinc-300' : 'border-[#0b1110]/15 text-[#082621]'
              }`}>
                <span className="flex items-center gap-1">
                  <Clock size={13} /> {ep.duration}
                </span>
                <span className={`px-2 py-0.5 brutal-border ${
                  isDark ? 'bg-zinc-800 text-zinc-300 border-zinc-700' : 'bg-[#fdfbf7] border-black'
                }`}>SPEED: {playbackSpeed}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
