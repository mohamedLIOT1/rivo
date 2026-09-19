import React, { useState, useEffect, useMemo } from 'react';
import { Trophy, Headphones, Flame, UserCheck, Activity, Clock, Sparkles } from 'lucide-react';
import VerifiedBadge, { isUserVerified } from '../components/VerifiedBadge';
import { API_BASE_URL } from '../config';
import {
  getListeningStats,
  getRealTopTrack,
  formatListeningMinutes
} from '../utils/listeningTracker';

export default function StatsScreen({ tracks = [], currentUser, globalTheme = 'dark' }) {
  const isDark = globalTheme === 'dark';
  const [localStats, setLocalStats] = useState(() => getListeningStats());
  const [serverLeaderboard, setServerLeaderboard] = useState([]);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(false);

  // Subscribe to live listening updates (ticks as audio plays in real-time)
  useEffect(() => {
    const handleUpdate = (e) => {
      if (e?.detail) setLocalStats({ ...e.detail });
      else setLocalStats(getListeningStats());
    };
    window.addEventListener('rivo:listening_stats_updated', handleUpdate);
    window.addEventListener('liofy:listening_stats_updated', handleUpdate);
    return () => {
      window.removeEventListener('rivo:listening_stats_updated', handleUpdate);
      window.removeEventListener('liofy:listening_stats_updated', handleUpdate);
    };
  }, []);

  // Fetch real platform leaderboard from backend
  useEffect(() => {
    let isMounted = true;
    const fetchLeaderboard = async () => {
      try {
        setIsLoadingLeaderboard(true);
        const token = localStorage.getItem('rivo_token') || localStorage.getItem('liofy_token') || localStorage.getItem('token');
        const res = await fetch(`${API_BASE_URL}/api/stats/leaderboard`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.success && Array.isArray(data.leaderboard)) {
            setServerLeaderboard(data.leaderboard);
          }
        }
      } catch (err) {
        console.warn('[StatsScreen] Error fetching leaderboard:', err);
      } finally {
        if (isMounted) setIsLoadingLeaderboard(false);
      }
    };

    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Compute real current user stats
  const userRealSeconds = Math.max(
    Number(localStats.weeklySeconds) || 0,
    Number(localStats.totalSeconds) || 0
  );
  const userFormattedTime = formatListeningMinutes(userRealSeconds);
  const realTopTrack = useMemo(() => getRealTopTrack(tracks), [tracks, localStats]);

  // Merge server leaderboard with live local user stats
  const realLeaderboard = useMemo(() => {
    let list = [...serverLeaderboard];

    if (currentUser) {
      const curId = String(currentUser.id || currentUser._id || '');
      const curName = (currentUser.name || '').trim().toLowerCase();
      const existingIdx = list.findIndex(u => 
        (curId && String(u.id) === curId) || 
        ((u.name || '').trim().toLowerCase() === curName)
      );

      const topSongTitle = realTopTrack ? `${realTopTrack.title} - ${realTopTrack.artist}` : 'Various Tracks';

      if (existingIdx !== -1) {
        // Update existing entry with live maximum seconds
        const prev = list[existingIdx];
        const maxSec = Math.max(prev.seconds || 0, userRealSeconds);
        list[existingIdx] = {
          ...prev,
          seconds: maxSec,
          minutes: Math.floor(maxSec / 60),
          avatar: currentUser.avatar || prev.avatar,
          name: currentUser.name || prev.name,
          topSong: realTopTrack ? topSongTitle : prev.topSong,
          isCurrentUser: true,
          isVerified: isUserVerified(currentUser) || Boolean(prev.isVerified)
        };
      } else if (userRealSeconds > 0 || (currentUser && currentUser.name)) {
        // Current user not yet in server list: insert them
        list.push({
          id: curId || 'current_user',
          name: currentUser.name,
          avatar: currentUser.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop',
          minutes: Math.floor(userRealSeconds / 60),
          seconds: userRealSeconds,
          topSong: topSongTitle,
          isVerified: isUserVerified(currentUser),
          isCurrentUser: true
        });
      }
    }

    // Sort by seconds strictly
    list.sort((a, b) => (Number(b.seconds) || 0) - (Number(a.seconds) || 0));

    // Reassign ranks
    return list.map((item, idx) => ({
      ...item,
      rank: idx + 1
    }));
  }, [serverLeaderboard, currentUser, userRealSeconds, realTopTrack]);

  // Top listener of the week is rank #1
  const topListener = realLeaderboard.length > 0 ? realLeaderboard[0] : null;

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
            Real-time streaming and listening stats verified from actual playback
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className={`brutal-border px-3 py-1.5 text-xs font-mono font-black flex items-center gap-1.5 ${
            isDark ? 'bg-zinc-800 text-zinc-300 border-zinc-700' : 'bg-[#ede5d3] text-[#082621] border-black'
          }`}>
            <Flame size={15} className="text-[#dc2626]" />
            <span>VERIFIED STATS</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#082621] text-[#26c4b7] text-[11px] font-mono font-black brutal-border">
            <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
            <span>LIVE</span>
          </div>
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

          {topListener && (topListener.seconds > 0 || topListener.minutes > 0) ? (
            <>
              <img
                src={topListener.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop'}
                alt={topListener.name}
                className="w-18 h-18 brutal-border object-cover bg-[#ede5d3] shrink-0"
              />
              <div className="relative z-10 truncate">
                <span className="text-[10px] uppercase font-mono font-black text-[#17a398] flex items-center gap-1">
                  <Trophy size={13} />
                  <span>TOP LISTENER OF THE WEEK</span>
                </span>
                <div className="flex items-center gap-1.5 mt-1">
                  <h3 className={`text-xl font-display font-black truncate ${isDark ? 'text-white' : 'text-[#082621]'}`}>
                    {topListener.name}
                  </h3>
                  <VerifiedBadge userOrName={topListener} size={18} />
                </div>
                <p className={`text-xs font-mono mt-1 font-bold ${isDark ? 'text-zinc-400' : 'text-[#082621]/80'}`}>
                  {formatListeningMinutes(topListener.seconds || topListener.minutes * 60)} STREAMED
                </p>
              </div>
            </>
          ) : currentUser ? (
            <>
              <img
                src={currentUser.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop'}
                alt={currentUser.name}
                className="w-18 h-18 brutal-border object-cover bg-[#ede5d3] shrink-0"
              />
              <div className="relative z-10 truncate">
                <span className="text-[10px] uppercase font-mono font-black text-[#17a398] flex items-center gap-1">
                  <Trophy size={13} />
                  <span>TOP LISTENER OF THE WEEK</span>
                </span>
                <div className="flex items-center gap-1.5 mt-1">
                  <h3 className={`text-xl font-display font-black truncate ${isDark ? 'text-white' : 'text-[#082621]'}`}>
                    {currentUser.name}
                  </h3>
                  <VerifiedBadge userOrName={currentUser} size={18} />
                </div>
                <p className={`text-xs font-mono mt-1 font-bold ${isDark ? 'text-zinc-400' : 'text-[#082621]/80'}`}>
                  {userRealSeconds > 0 ? `${userFormattedTime} STREAMED` : 'READY TO STREAM'}
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

          {realTopTrack ? (
            <>
              <img
                src={realTopTrack.cover || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=200&h=200&fit=crop'}
                alt={realTopTrack.title}
                className="w-18 h-18 brutal-border object-cover bg-white shrink-0"
              />
              <div className="relative z-10 truncate">
                <span className="text-[10px] uppercase font-mono font-black text-[#f59e0b] flex items-center gap-1">
                  <Flame size={13} />
                  <span>MOST STREAMED TRACK</span>
                </span>
                <h3 className="text-xl font-display font-black text-[#fdfbf7] truncate mt-1">
                  {realTopTrack.title}
                </h3>
                <p className="text-xs font-mono text-[#ded2bb] mt-1 font-bold">
                  {realTopTrack.artist} • {realTopTrack.plays || (realTopTrack.seconds >= 15 ? 1 : 0)} PLAYS
                  {realTopTrack.seconds > 0 && ` (${formatListeningMinutes(realTopTrack.seconds)})`}
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
          <span className={`text-xs font-mono ${isDark ? 'text-zinc-400' : 'text-[#082621]/60'}`}>
            WEEKLY REPORT
          </span>
        </div>

        {realLeaderboard.length > 0 ? (
          <div className="flex flex-col gap-2">
            {realLeaderboard.map((user) => (
              <div
                key={user.id || user.rank}
                className={`flex items-center justify-between p-3.5 brutal-border brutal-shadow-sm transition-transform hover:-translate-y-0.5 ${
                  user.isCurrentUser
                    ? (isDark ? 'bg-[#1e2f2b] border-[#17a398] text-white' : 'bg-[#d8f3ec] border-black text-[#082621]')
                    : (isDark ? 'bg-[#182320] border-zinc-700 text-white' : 'bg-[#ede5d3] border-black text-[#082621]')
                }`}
              >
                <div className="flex items-center gap-4 truncate">
                  <span className={`w-7 text-center font-mono font-black text-sm ${
                    user.rank === 1 ? 'text-[#f59e0b]' : isDark ? 'text-zinc-300' : 'text-[#082621]'
                  }`}>
                    #{user.rank}
                  </span>

                  <img
                    src={user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop'}
                    alt={user.name}
                    className="w-10 h-10 brutal-border object-cover shrink-0 bg-white"
                  />

                  <div className="truncate">
                    <div className="flex items-center gap-2">
                      <h4 className={`font-bold text-sm truncate ${isDark ? 'text-white' : 'text-[#082621]'}`}>
                        {user.name}
                      </h4>
                      <VerifiedBadge userOrName={user} size={14} />
                      {user.isCurrentUser ? (
                        <span className="text-[9px] font-mono font-black uppercase px-2 py-0.5 bg-[#17a398] text-[#082621]">
                          YOU
                        </span>
                      ) : (
                        <span className="text-[9px] font-mono font-black uppercase px-2 py-0.5 bg-[#082621] text-[#26c4b7]">
                          LISTENER
                        </span>
                      )}
                    </div>
                    <p className={`text-xs truncate font-mono ${isDark ? 'text-zinc-400' : 'text-[#082621]/70'}`}>
                      TOP SONG: {user.topSong || 'None'}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className={`text-sm font-mono font-black ${isDark ? 'text-white' : 'text-[#082621]'}`}>
                    {formatListeningMinutes(user.seconds || user.minutes * 60)}
                  </span>
                  <p className={`text-[10px] font-mono font-bold uppercase ${isDark ? 'text-zinc-400' : 'text-[#082621]/60'}`}>
                    THIS WEEK
                  </p>
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
