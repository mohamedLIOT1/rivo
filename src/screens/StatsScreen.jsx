import React from 'react';
import { Trophy, Music, Headphones, Flame, Calendar, UserCheck, Disc, Activity } from 'lucide-react';
import VerifiedBadge from '../components/VerifiedBadge';

export default function StatsScreen({ tracks = [], currentUser, globalTheme = 'dark' }) {
  const isDark = globalTheme === 'dark';
  const sortedTracks = [...tracks].filter(t => (Number(t.plays) || 0) > 0).sort((a, b) => (Number(b.plays) || 0) - (Number(a.plays) || 0));
  const topTrack = sortedTracks[0] || null;

  const userTotalPlays = tracks.reduce((acc, t) => acc + (Number(t.plays) || 0), 0);
  const userMinutes = Math.round((userTotalPlays * 3.5));

  const realLeaderboard = userTotalPlays > 0 && currentUser ? [
    {
      rank: 1,
      name: currentUser.name,
      avatar: currentUser.avatar,
      minutes: userMinutes,
      topSong: topTrack ? topTrack.title : 'None',
      isCurrentUser: true
    }
  ] : [];

  return (
    <div className={`flex-1 overflow-y-auto pb-32 select-none p-4 md:p-8 transition-colors ${
      isDark ? 'bg-[#0b1110] text-[#fdfbf7]' : 'bg-[#17a398] text-[#0b1110]'
    }`}>
      {/* Header Banner */}
      <div className={`brutal-border-thick brutal-shadow-lg p-6 mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
        isDark ? 'bg-[#141d1b] border-zinc-700 text-white' : 'bg-[#fdfbf7] border-black text-[#082621]'
      }`}>
        <div>
          <div className="flex items-center gap-2">
            <Activity className="text-[#17a398]" size={22} />
            <h1 className={`text-2xl md:text-4xl font-display font-black ${isDark ? 'text-white' : 'text-[#082621]'}`}>
              LISTENING ACTIVITY & STATS
            </h1>
          </div>
          <p className={`text-xs font-mono mt-1 ${isDark ? 'text-zinc-400' : 'text-[#082621]/70'}`}>
            Your streaming and listening stats on Liofy
          </p>
        </div>

        <div className={`brutal-border px-3 py-1.5 text-xs font-mono font-black flex items-center gap-1.5 self-start sm:self-auto ${
          isDark ? 'bg-zinc-800 text-zinc-300 border-zinc-700' : 'bg-[#ede5d3] text-[#082621] border-black'
        }`}>
          <Flame size={15} className="text-[#dc2626]" />
          <span>VERIFIED STATS</span>
        </div>
      </div>

      {/* Top 2 Highlight Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* 🏆 Top Listener */}
        <div className={`p-6 brutal-border-thick brutal-shadow flex items-center gap-5 relative overflow-hidden ${
          isDark ? 'bg-[#141d1b] border-zinc-700 text-white' : 'bg-[#fdfbf7] border-black text-[#082621]'
        }`}>
          <div className="absolute top-2 right-2 text-[#082621]/10 pointer-events-none">
            <Trophy size={80} />
          </div>

          {currentUser && userTotalPlays > 0 ? (
            <>
              <img src={currentUser.avatar} alt={currentUser.name} className="w-18 h-18 brutal-border object-cover bg-[#ede5d3] shrink-0" />
              <div className="relative z-10 truncate">
                <span className="text-[10px] uppercase font-mono font-black text-[#17a398] flex items-center gap-1">
                  <Trophy size={13} />
                  <span>TOP LISTENER OF THE WEEK</span>
                </span>
                <div className="flex items-center gap-1.5 mt-1">
                  <h3 className={`text-xl font-display font-black truncate ${isDark ? 'text-white' : 'text-[#082621]'}`}>{currentUser.name}</h3>
                  <VerifiedBadge userOrName={currentUser} size={18} />
                </div>
                <p className={`text-xs font-mono mt-1 font-bold ${isDark ? 'text-zinc-400' : 'text-[#082621]/80'}`}>
                  {userMinutes} MINUTES STREAMED
                </p>
              </div>
            </>
          ) : (
            <div className={`py-4 text-xs font-mono ${isDark ? 'text-zinc-400' : 'text-[#082621]/70'}`}>
              NO LISTENING ACTIVITY RECORDED YET. PLAY SONGS TO GENERATE STATS!
            </div>
          )}
        </div>

        {/* 🎵 Most Streamed Track */}
        <div className="bg-[#082621] text-[#fdfbf7] p-6 brutal-border-thick brutal-shadow flex items-center gap-5 relative overflow-hidden">
          <div className="absolute top-2 right-2 text-[#26c4b7]/10 pointer-events-none">
            <Headphones size={80} />
          </div>

          {topTrack ? (
            <>
              <img src={topTrack.cover} alt={topTrack.title} className="w-18 h-18 brutal-border object-cover bg-white shrink-0" />
              <div className="relative z-10 truncate">
                <span className="text-[10px] uppercase font-mono font-black text-[#f59e0b] flex items-center gap-1">
                  <Flame size={13} />
                  <span>MOST STREAMED TRACK</span>
                </span>
                <h3 className="text-xl font-display font-black text-[#fdfbf7] truncate mt-1">{topTrack.title}</h3>
                <p className="text-xs font-mono text-[#ded2bb] mt-1 font-bold">
                  {topTrack.artist} • {topTrack.plays || 0} PLAYS
                </p>
              </div>
            </>
          ) : (
            <div className="py-4 text-[#ded2bb] text-xs font-mono">
              NO TRACKS STREAMED YET. START LISTENING TO DISCOVER YOUR TOP TRACK!
            </div>
          )}
        </div>
      </div>

      {/* Weekly Leaderboard Table */}
      <section className={`brutal-border-thick brutal-shadow-lg p-6 ${
        isDark ? 'bg-[#141d1b] border-zinc-700 text-white' : 'bg-[#fdfbf7] border-black text-[#082621]'
      }`}>
        <div className={`flex items-center justify-between pb-3 mb-4 border-b-2 ${
          isDark ? 'border-zinc-700 text-zinc-300' : 'border-[#0b1110] text-[#082621]'
        }`}>
          <h3 className="text-lg font-mono font-black uppercase flex items-center gap-2">
            <UserCheck size={18} className="text-[#17a398]" />
            <span>LISTENING LEADERBOARD</span>
          </h3>
          <span className={`text-xs font-mono ${isDark ? 'text-zinc-400' : 'text-[#082621]/60'}`}>WEEKLY REPORT</span>
        </div>

        {realLeaderboard.length > 0 ? (
          <div className="flex flex-col gap-2">
            {realLeaderboard.map((friend) => (
              <div
                key={friend.rank}
                className={`flex items-center justify-between p-3.5 brutal-border brutal-shadow-sm ${
                  isDark ? 'bg-[#182320] border-zinc-700 text-white' : 'bg-[#ede5d3] border-black text-[#082621]'
                }`}
              >
                <div className="flex items-center gap-4 truncate">
                  <span className={`w-7 text-center font-mono font-black text-sm ${isDark ? 'text-zinc-300' : 'text-[#082621]'}`}>
                    #{friend.rank}
                  </span>

                  <img src={friend.avatar} alt={friend.name} className="w-10 h-10 brutal-border object-cover shrink-0 bg-white" />

                  <div className="truncate">
                    <div className="flex items-center gap-2">
                      <h4 className={`font-bold text-sm truncate ${isDark ? 'text-white' : 'text-[#082621]'}`}>{friend.name}</h4>
                      <VerifiedBadge userOrName={friend} size={14} />
                      <span className="text-[9px] font-mono font-black uppercase px-2 py-0.5 bg-[#082621] text-[#26c4b7]">
                        LISTENER
                      </span>
                    </div>
                    <p className={`text-xs truncate font-mono ${isDark ? 'text-zinc-400' : 'text-[#082621]/70'}`}>TOP SONG: {friend.topSong}</p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className={`text-sm font-mono font-black ${isDark ? 'text-white' : 'text-[#082621]'}`}>{friend.minutes} MIN</span>
                  <p className={`text-[10px] font-mono font-bold uppercase ${isDark ? 'text-zinc-400' : 'text-[#082621]/60'}`}>THIS WEEK</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={`text-center py-8 text-xs font-mono ${isDark ? 'text-zinc-400' : 'text-[#082621]/70'}`}>
            NO STREAMING RECORDS DOCUMENTED THIS WEEK.
          </div>
        )}
      </section>
    </div>
  );
}
