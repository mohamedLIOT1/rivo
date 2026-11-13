import { useState, useMemo, useCallback, useEffect } from 'react';
import { API_BASE_URL } from '../config';
import { isQuranContent } from '../utils/quranUtils';
import { getSmartTasteAndMoodTracks } from '../utils/tasteAlgorithm';
import {
  loadCachedAiMoodMix,
  saveCachedAiMoodMix,
} from '../utils/aiMoodMixCache';

export function useHomeAiMoodMix({
  showMusic,
  displayTracks,
  cacheOwnerId,
  bucket12h,
  currentMood,
  currentUser,
  isRTL,
  popularTracks = [],
  onSelectTrack,
}) {
  const [aiMoodMix, setAiMoodMix] = useState(() => loadCachedAiMoodMix(cacheOwnerId, displayTracks) || []);

  useEffect(() => {
    if (!showMusic) return;

    const cached = loadCachedAiMoodMix(cacheOwnerId, displayTracks);
    if (cached) {
      setAiMoodMix(cached);
      if (cached.__source === 'server') return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      const token = currentUser?.token || localStorage.getItem('rivo_token') || localStorage.getItem('liofy_token') || localStorage.getItem('token') || '';
      let followed = [];
      try {
        const raw = localStorage.getItem('rivo_followed_artists') || localStorage.getItem('liofy_followed_artists');
        if (raw) followed = JSON.parse(raw);
      } catch {}
      const localSeeds = displayTracks.length > 0
        ? getSmartTasteAndMoodTracks({
            allTracks: displayTracks,
            currentUser,
            followedArtists: followed,
            likedTrackIds: currentUser?.likedTrackIds || currentUser?.likedTracks || [],
            limit: 12,
          })
        : [];

      fetch(`${API_BASE_URL}/api/ai/mood-mix`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          mood: currentMood.id,
          timeOfDay: currentMood.id,
          seedTracks: localSeeds.slice(0, 5),
          followedArtists: followed,
          limit: 15,
          isQuran: false,
        }),
        signal: controller.signal,
      })
        .then(r => (r.ok ? r.json() : null))
        .then(d => {
          if (controller.signal.aborted) return;
          const recs = (d?.tracks || d?.recommendations || []).filter(tr => !isQuranContent(tr));
          const pool = recs.length > 0 ? recs : localSeeds;
          const merged = [];
          const seen = new Set();
          for (const tr of pool) {
            const tid = String(tr?.id || tr?._id || '');
            if (tid && !seen.has(tid)) {
              seen.add(tid);
              merged.push({ ...tr, isSmartMoodQueue: true, isAiSuggestion: true });
            }
            if (merged.length >= 15) break;
          }

          if (merged.length > 0) {
            setAiMoodMix(merged);
            saveCachedAiMoodMix({
              ownerId: cacheOwnerId,
              moodId: d?.mood || currentMood.id,
              bucket12h: d?.bucket12h,
              source: recs.length > 0 ? 'server' : 'local',
              name: isRTL ? 'مُختارات لك • قائمة ذكاء ريفو' : 'Made For You • AI Mood Mix',
              description: `${currentMood.label} • Auto-refreshes every 12h`,
              tracks: merged,
            });
          }
        })
        .catch(() => {});
    }, 80);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [showMusic, displayTracks, cacheOwnerId, bucket12h, currentMood.id, currentMood.label, currentUser, isRTL]);

  const handlePlaySmartCassette = useCallback(() => {
    if (aiMoodMix && aiMoodMix.length > 0) {
      onSelectTrack?.(aiMoodMix[0], aiMoodMix);
      return;
    }

    let followed = [];
    try {
      const raw = localStorage.getItem('rivo_followed_artists') || localStorage.getItem('liofy_followed_artists');
      if (raw) followed = JSON.parse(raw);
    } catch {}

    const smart10 = getSmartTasteAndMoodTracks({
      allTracks: displayTracks,
      currentUser,
      followedArtists: followed,
      likedTrackIds: currentUser?.likedTrackIds || currentUser?.likedTracks || [],
      limit: 12,
    });

    if (smart10.length > 0) {
      onSelectTrack?.(smart10[0], smart10.map(tr => ({ ...tr, isSmartMoodQueue: true })));
    } else if (popularTracks.length > 0) {
      onSelectTrack?.(popularTracks[0], popularTracks.slice(0, 10));
    }
  }, [displayTracks, currentUser, aiMoodMix, popularTracks, onSelectTrack]);

  const heroCassetteArtists = useMemo(() => {
    return Array.from(new Set((aiMoodMix || []).map(tr => tr?.artist).filter(Boolean))).slice(0, 3).join(' • ');
  }, [aiMoodMix]);

  const aiMoodPlaylistObj = useMemo(() => {
    if (!aiMoodMix || aiMoodMix.length === 0) return null;
    const artistsSummary = Array.from(
      new Set(aiMoodMix.map(tr => tr?.artist).filter(Boolean))
    ).slice(0, 4).join(' • ');
    return {
      id: 'ai-mood-mix',
      name: isRTL ? 'مُختارات لك • قائمة ذكاء ريفو' : 'Made For You • AI Mood Mix',
      description: artistsSummary
        ? `${currentMood.label} — ${artistsSummary}`
        : currentMood.label,
      isAiMoodPlaylist: true,
      tracks: aiMoodMix,
      trackIds: aiMoodMix.map(tr => String(tr.id || tr._id)),
    };
  }, [aiMoodMix, isRTL, currentMood.label]);

  return {
    aiMoodMix,
    aiMoodPlaylistObj,
    handlePlaySmartCassette,
    heroCassetteArtists,
  };
}
