import React from 'react';
import { Trophy, Music, Headphones, Flame, Calendar, UserCheck, Disc } from 'lucide-react';
import VerifiedBadge from '../components/VerifiedBadge';

export default function StatsScreen({ tracks = [], currentUser }) {
  // Real calculations only
  const sortedTracks = [...tracks].filter(t => (Number(t.plays) || 0) > 0).sort((a, b) => (Number(b.plays) || 0) - (Number(a.plays) || 0));
  const topTrack = sortedTracks[0] || null;

  // Calculate actual total minutes listened by current user
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
    <div className="flex-1 overflow-y-auto pb-32 select-none px-4 md:px-8 py-6">
      {/* Header Banner */}
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="text-[#1DB954]" size={22} />
            <h1 className="text-2xl md:text-4xl font-black text-white tracking-tight">Weekly Listening Stats</h1>
          </div>
          <p className="text-xs text-zinc-400 mt-1">Real-time weekly statistics calculated strictly from actual listening history</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-full text-xs font-black text-[#1DB954] flex items-center gap-1.5">
          <Flame size={16} />
          <span>Real Activity</span>
        </div>
      </div>

      {/* Top 2 Highlight Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* 🏆 Top Listener of the Week */}
        <div className="bg-gradient-to-br from-amber-950/80 via-zinc-900 to-black p-6 rounded-3xl border border-amber-500/30 flex items-center gap-5 shadow-2xl relative overflow-hidden">
          <div className="absolute top-3 right-3 text-amber-500/20">
            <Trophy size={96} />
          </div>

          {currentUser && userTotalPlays > 0 ? (
            <>
              <img src={currentUser.avatar} alt={currentUser.name} className="w-20 h-20 rounded-full object-cover shadow-2xl border-2 border-amber-400 shrink-0" />
              <div className="relative z-10 truncate">
                <span className="text-[10px] uppercase font-black tracking-widest text-amber-400 flex items-center gap-1">
                  <Trophy size={14} />
                  <span>Top Listener This Week</span>
                </span>
                <div className="flex items-center gap-1.5 mt-1">
                  <h3 className="text-2xl font-black text-white truncate">{currentUser.name}</h3>
                  <VerifiedBadge userOrName={currentUser} size={20} />
                </div>
                <p className="text-xs text-zinc-400 mt-1 font-bold">
                  {userMinutes} mins listened strictly this week
                </p>
              </div>
            </>
          ) : (
            <div className="py-2 text-zinc-400 text-xs font-bold">
              No listening activity recorded yet. Play a song to generate stats!
            </div>
          )}
        </div>

        {/* 🎵 Most Streamed Track of the Week */}
        <div className="bg-gradient-to-br from-emerald-950/80 via-zinc-900 to-black p-6 rounded-3xl border border-emerald-500/30 flex items-center gap-5 shadow-2xl relative overflow-hidden">
          <div className="absolute top-3 right-3 text-emerald-500/20">
            <Headphones size={96} />
          </div>

          {topTrack ? (
            <>
              <img src={topTrack.cover} alt={topTrack.title} className="w-20 h-20 rounded-2xl object-cover shadow-2xl border-2 border-[#1DB954] shrink-0" />
              <div className="relative z-10 truncate">
                <span className="text-[10px] uppercase font-black tracking-widest text-[#1DB954] flex items-center gap-1">
                  <Flame size={14} />
                  <span>Most Streamed Song</span>
                </span>
                <h3 className="text-2xl font-black text-white truncate mt-1">{topTrack.title}</h3>
                <p className="text-xs text-zinc-400 mt-1 font-bold">
                  {topTrack.artist} • {topTrack.plays || 0} real plays
                </p>
              </div>
            </>
          ) : (
            <div className="py-2 text-zinc-400 text-xs font-bold">
              No plays recorded yet. Start listening to see your top song!
            </div>
          )}
        </div>
      </div>

      {/* Weekly Leaderboard Table */}
      <section className="bg-zinc-900/60 p-6 rounded-3xl border border-zinc-800/80">
        <h3 className="text-lg font-extrabold text-white mb-4 flex items-center gap-2">
          <UserCheck size={20} className="text-[#1DB954]" />
          <span>Active Users Leaderboard</span>
        </h3>

        {realLeaderboard.length > 0 ? (
          <div className="flex flex-col gap-2">
            {realLeaderboard.map((friend) => (
              <div
                key={friend.rank}
                className="flex items-center justify-between p-4 rounded-2xl bg-emerald-950/40 border border-[#1DB954]/50 shadow-md"
              >
                <div className="flex items-center gap-4 truncate">
                  <span className="w-7 text-center font-black text-base text-amber-400">
                    #{friend.rank}
                  </span>

                  <img src={friend.avatar} alt={friend.name} className="w-11 h-11 rounded-full object-cover shrink-0" />

                  <div className="truncate">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-white truncate">{friend.name}</h4>
                      <VerifiedBadge userOrName={friend} size={14} />
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-[#1DB954] text-black rounded-full">
                        You
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 truncate">Top Song: {friend.topSong}</p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-sm font-black text-[#1DB954]">{friend.minutes} min</span>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase">This Week</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-zinc-500 text-xs font-bold">
            No real users have listened to songs yet. Upload and play a song to populate real stats!
          </div>
        )}
      </section>
    </div>
  );
}
