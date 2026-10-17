import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def patch_youtube_resolver():
    path = os.path.join(BASE_DIR, 'src', 'native', 'services', 'youtubeResolver.js')
    with open(path, 'r', encoding='utf-8') as f:
        code = f.read()

    # 1. Update resolveAudioStream with duration parameter and duration cache checks
    target_needle = """      // 3a. Resolve stream via /api/tracks/resolve-stream (matches authentic upload tracks & web logic)
      try {
        const resolveRes = await fetch(
          `${API_BASE_URL}/api/tracks/resolve-stream?stream=true&title=${encodeURIComponent(rawTitle || cleanTitle)}&artist=${encodeURIComponent(rawArtist || cleanArtist)}&url=${encodeURIComponent(rawUrl)}&id=${encodeURIComponent(trackId)}`,
          { signal: controller.signal }
        );"""
    
    target_repl = """      const targetDuration = Number(track.duration) || null;

      // 3a. Resolve stream via /api/tracks/resolve-stream (matches authentic upload tracks & web logic)
      try {
        const resolveRes = await fetch(
          `${API_BASE_URL}/api/tracks/resolve-stream?stream=true&title=${encodeURIComponent(rawTitle || cleanTitle)}&artist=${encodeURIComponent(rawArtist || cleanArtist)}&url=${encodeURIComponent(rawUrl)}&id=${encodeURIComponent(trackId)}&duration=${encodeURIComponent(targetDuration || '')}`,
          { signal: controller.signal }
        );"""

    if target_needle in code:
        code = code.replace(target_needle, target_repl, 1)

    needle_3b = """      // 3b. Stream endpoint fallback
      const serverStreamRes = await fetch(
        `${API_BASE_URL}/api/tracks/${encodeURIComponent(trackId || 'stream')}/stream?url=${encodeURIComponent(rawUrl)}&title=${encodeURIComponent(cleanTitle || rawTitle)}&artist=${encodeURIComponent(cleanArtist || rawArtist)}`,
        { signal: controller.signal }
      );"""

    repl_3b = """      // 3b. Stream endpoint fallback
      const serverStreamRes = await fetch(
        `${API_BASE_URL}/api/tracks/${encodeURIComponent(trackId || 'stream')}/stream?url=${encodeURIComponent(rawUrl)}&title=${encodeURIComponent(cleanTitle || rawTitle)}&artist=${encodeURIComponent(cleanArtist || rawArtist)}&duration=${encodeURIComponent(targetDuration || '')}`,
        { signal: controller.signal }
      );"""

    if needle_3b in code:
        code = code.replace(needle_3b, repl_3b, 1)

    # 2. Update searchYouTubeClientSide with strict dual query & strict duration filtering
    old_search_start = "export const searchYouTubeClientSide = async (queryOrOptions, maybeOptions = {}) => {"
    old_search_end = "export function extractYouTubeId(input) {"

    new_search_code = """export const searchYouTubeClientSide = async (queryOrOptions, maybeOptions = {}) => {
  let query = '';
  let targetDuration = null;
  let artist = '';
  let title = '';

  if (queryOrOptions && typeof queryOrOptions === 'object') {
    query = queryOrOptions.query || '';
    targetDuration = Number(queryOrOptions.targetDuration || queryOrOptions.duration) || null;
    artist = queryOrOptions.artist || '';
    title = queryOrOptions.title || '';
  } else if (typeof queryOrOptions === 'string') {
    query = queryOrOptions.trim();
    if (typeof maybeOptions === 'number') {
      targetDuration = maybeOptions;
    } else if (maybeOptions && typeof maybeOptions === 'object') {
      targetDuration = Number(maybeOptions.targetDuration || maybeOptions.duration) || null;
      artist = maybeOptions.artist || '';
      title = maybeOptions.title || '';
    }
  }

  if (!artist && !title && query && query.includes(' - ')) {
    const parts = query.split(' - ');
    artist = parts[0].trim();
    title = parts.slice(1).join(' - ').trim();
  }

  const cleanArt = String(artist || '').replace(/["']/g, ' ').trim();
  const cleanTit = String(title || '').replace(/["']/g, ' ').trim();

  // Search queries according to strict guidelines:
  // Primary: "${cleanArtist}" "${cleanTitle}"
  // Secondary: "${cleanTitle}" ${cleanArtist} official audio
  const searchQueries = [];
  if (cleanArt && cleanTit) {
    searchQueries.push(`"${cleanArt}" "${cleanTit}"`);
    searchQueries.push(`"${cleanTit}" ${cleanArt} official audio`);
  } else if (query) {
    const cleanQ = query.replace(/\\s+music$/i, '').trim();
    searchQueries.push(cleanQ);
    searchQueries.push(`${cleanQ} official audio`);
  }

  if (searchQueries.length === 0) return null;

  const key = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';

  const parseSec = (renderer) => {
    const durText = renderer.lengthText?.simpleText || renderer.lengthText?.runs?.[0]?.text || '';
    if (!durText) return 0;
    const parts = durText.split(':').map(p => parseInt(p, 10));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) return parts[0] * 60 + parts[1];
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return 0;
  };

  const normArtist = cleanArt.toLowerCase();
  const normTitle = cleanTit.toLowerCase();

  for (const q of searchQueries) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`https://www.youtube.com/youtubei/v1/search?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context: {
            client: {
              clientName: 'WEB',
              clientVersion: '2.20231201.00.00',
              hl: 'en',
              gl: 'US'
            }
          },
          query: q
        }),
        signal: controller.signal
      });
      clearTimeout(timeout);
      if (!res.ok) continue;

      const d = await res.json();
      const contents = d?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents || [];
      const candidates = contents
        .map(c => c.videoRenderer)
        .filter(v => v && v.videoId);

      if (candidates.length === 0) continue;

      let scoredCandidates = candidates.map(item => {
        const vidId = item.videoId;
        const durSec = parseSec(item);
        const candTitle = (item.title?.runs?.[0]?.text || '').toLowerCase();
        const candChannel = (item.ownerText?.runs?.[0]?.text || '').toLowerCase();

        let score = 0;
        let durationDiff = targetDuration && durSec > 0 ? Math.abs(durSec - targetDuration) : null;

        if (durationDiff !== null) {
          if (durationDiff <= 5) score += 50;
          else if (durationDiff <= 15) score += 30;
          else if (durationDiff <= 35) score += 15;
          else if (durationDiff > 60) score -= 200; // Heavy penalty for mismatch
        }

        if (normTitle && candTitle.includes(normTitle)) score += 40;
        if (normArtist && (candTitle.includes(normArtist) || candChannel.includes(normArtist))) score += 30;

        if (candChannel.includes('topic') || candChannel.includes('official') || candChannel.includes('vevo')) score += 30;
        if (candTitle.includes('official audio') || candTitle.includes('official lyric') || candTitle.includes('official video')) score += 20;

        if (!normTitle.includes('mix') && (candTitle.includes('mix') || candTitle.includes('full album') || candTitle.includes('playlist'))) score -= 100;
        if (!normTitle.includes('live') && candTitle.includes('live') && !normTitle.includes('حفلة')) score -= 50;
        if (durSec > 900 && (!targetDuration || targetDuration < 900)) score -= 100;

        return {
          videoId: vidId,
          duration: durSec || null,
          title: item.title?.runs?.[0]?.text || '',
          channel: item.ownerText?.runs?.[0]?.text || '',
          score,
          durationDiff
        };
      });

      // Strict duration filter: Reject any candidate with durationDiff > 60s
      if (targetDuration) {
        scoredCandidates = scoredCandidates.filter(c => c.durationDiff === null || c.durationDiff <= 60);
      }

      if (scoredCandidates.length > 0) {
        scoredCandidates.sort((a, b) => b.score - a.score);
        const best = scoredCandidates[0];
        return {
          videoId: best.videoId,
          duration: best.duration || targetDuration || null,
          title: best.title,
          channel: best.channel
        };
      }
    } catch (e) {}
  }

  return null;
};

"""

    if old_search_start in code and old_search_end in code:
        before = code[:code.index(old_search_start)]
        after = code[code.index(old_search_end):]
        code = before + new_search_code + after

    with open(path, 'w', encoding='utf-8') as f:
        f.write(code)
    print("Patched youtubeResolver.js successfully")

def patch_helpers():
    path = os.path.join(BASE_DIR, 'server', 'utils', 'helpers.js')
    with open(path, 'r', encoding='utf-8') as f:
        code = f.read()

    # In searchYouTubeId, support dual query and strict duration filtering
    start_str = "async function searchYouTubeId(queryOrOptions, maybeOptions = {}) {"
    end_str = "  // 2. Fallback: YouTube Data API v3"

    new_func = """async function searchYouTubeId(queryOrOptions, maybeOptions = {}) {
  let query = '';
  let targetDuration = null;
  let artist = '';
  let title = '';

  if (queryOrOptions && typeof queryOrOptions === 'object') {
    query = queryOrOptions.query || '';
    targetDuration = Number(queryOrOptions.targetDuration || queryOrOptions.duration) || null;
    artist = queryOrOptions.artist || '';
    title = queryOrOptions.title || '';
  } else if (typeof queryOrOptions === 'string') {
    query = queryOrOptions.trim();
    if (typeof maybeOptions === 'number') {
      targetDuration = maybeOptions;
    } else if (maybeOptions && typeof maybeOptions === 'object') {
      targetDuration = Number(maybeOptions.targetDuration || maybeOptions.duration) || null;
      artist = maybeOptions.artist || '';
      title = maybeOptions.title || '';
    }
  }

  if (!artist && !title && query && query.includes(' - ')) {
    const parts = query.split(' - ');
    artist = parts[0].trim();
    title = parts.slice(1).join(' - ').trim();
  }

  const cleanArt = String(artist || '').replace(/["']/g, ' ').trim();
  const cleanTit = String(title || '').replace(/["']/g, ' ').trim();

  const searchQueries = [];
  if (cleanArt && cleanTit) {
    searchQueries.push(`"${cleanArt}" "${cleanTit}"`);
    searchQueries.push(`"${cleanTit}" ${cleanArt} official audio`);
  } else if (query) {
    const cleanQ = query.replace(/\\s+music$/i, '').trim();
    searchQueries.push(cleanQ);
    searchQueries.push(`${cleanQ} official audio`);
  }

  if (searchQueries.length === 0) return null;

  const cacheKey = `${searchQueries[0]}_${targetDuration || ''}`.toLowerCase();
  if (ytSearchCache.has(cacheKey)) {
    return ytSearchCache.get(cacheKey);
  }

  const parseSec = (renderer) => {
    const durText = renderer.lengthText?.simpleText || renderer.lengthText?.runs?.[0]?.text || '';
    if (!durText) return 0;
    const parts = durText.split(':').map(p => parseInt(p, 10));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) return parts[0] * 60 + parts[1];
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return 0;
  };

  const normArtist = cleanArt.toLowerCase();
  const normTitle = cleanTit.toLowerCase();
  let hadInnertubeCandidates = false;

  // 1. Ultra-fast Innertube search with dual query & strict duration filtering
  for (const finalQuery of searchQueries) {
    try {
      const key = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
      const itRes = await axios.post(`https://www.youtube.com/youtubei/v1/search?key=${key}`, {
        context: {
          client: {
            clientName: 'WEB',
            clientVersion: '2.20231201.00.00',
            hl: 'en',
            gl: 'US'
          }
        },
        query: finalQuery
      }, { timeout: 3500 });

      const contents = itRes.data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents || [];
      const candidates = contents.map(c => c.videoRenderer).filter(v => v && v.videoId);

      if (candidates.length > 0) {
        hadInnertubeCandidates = true;
        let scoredCandidates = candidates.map(item => {
          const vidId = item.videoId;
          const durSec = parseSec(item);
          const candTitle = (item.title?.runs?.[0]?.text || '').toLowerCase();
          const candChannel = (item.ownerText?.runs?.[0]?.text || '').toLowerCase();

          let score = 0;
          let durationDiff = targetDuration && durSec > 0 ? Math.abs(durSec - targetDuration) : null;

          if (durationDiff !== null) {
            if (durationDiff <= 5) score += 50;
            else if (durationDiff <= 15) score += 30;
            else if (durationDiff <= 35) score += 15;
            else if (durationDiff > 60) score -= 200; // Strict duration filter: reject videos > 60s difference!
          }

          if (normTitle && candTitle.includes(normTitle)) score += 40;
          if (normArtist && (candTitle.includes(normArtist) || candChannel.includes(normArtist))) score += 30;

          if (candChannel.includes('topic') || candChannel.includes('official') || candChannel.includes('vevo')) score += 30;
          if (candTitle.includes('official audio') || candTitle.includes('official lyric') || candTitle.includes('official video')) score += 20;

          if (!normTitle.includes('mix') && (candTitle.includes('mix') || candTitle.includes('full album') || candTitle.includes('playlist'))) score -= 100;
          if (!normTitle.includes('live') && candTitle.includes('live') && !normTitle.includes('حفلة')) score -= 50;
          if (durSec > 900 && (!targetDuration || targetDuration < 900)) score -= 100;

          return {
            videoId: vidId,
            duration: durSec || null,
            title: candTitle,
            channel: candChannel,
            score,
            durationDiff
          };
        });

        // Strict duration filter: Reject any candidate with durationDiff > 60s
        if (targetDuration) {
          scoredCandidates = scoredCandidates.filter(c => c.durationDiff === null || c.durationDiff <= 60);
        }

        if (scoredCandidates.length > 0) {
          scoredCandidates.sort((a, b) => b.score - a.score);
          const best = scoredCandidates[0];
          if (best && best.videoId) {
            if (ytSearchCache.size > 5000) ytSearchCache.clear();
            ytSearchCache.set(cacheKey, best.videoId);
            return best.videoId;
          }
        }
      }
    } catch (err) {}
  }

  // If Innertube searched and returned video candidates, but none matched the catalog duration (diff <= 60s),
  // NEVER fall back to blind scrapers or unverified API results!
  if (targetDuration && hadInnertubeCandidates) {
    return null;
  }

  const finalQuery = searchQueries[0];
"""

    if start_str in code and end_str in code:
        before = code[:code.index(start_str)]
        after = code[code.index(end_str):]
        code = before + new_func + "\n" + after

    with open(path, 'w', encoding='utf-8') as f:
        f.write(code)
    print("Patched helpers.js successfully")

def patch_tracks_route():
    path = os.path.join(BASE_DIR, 'server', 'routes', 'tracks.js')
    with open(path, 'r', encoding='utf-8') as f:
        code = f.read()

    # Pass duration in handleTrackStream
    old_h = """    const streamTarget = rawUrl || id || '';
    const streamUrl = await resolveOfficialYouTubeAudioStream(streamTarget, title, artist);"""

    new_h = """    const duration = Number(req.query.duration || track?.duration) || null;
    const streamTarget = rawUrl || id || '';
    const streamUrl = await resolveOfficialYouTubeAudioStream(streamTarget, title, artist, { duration });"""

    if old_h in code:
        code = code.replace(old_h, new_h, 1)

    # Pass duration in resolve-stream
    old_rs1 = "const directAudio = await resolveOfficialYouTubeAudioStream(dbTrack.audioUrl, dbTrack.title, dbTrack.artist);"
    new_rs1 = "const directAudio = await resolveOfficialYouTubeAudioStream(dbTrack.audioUrl, dbTrack.title, dbTrack.artist, { duration: dbTrack.duration || Number(duration) || null });"
    if old_rs1 in code:
        code = code.replace(old_rs1, new_rs1, 1)

    old_rs2 = "const directAudio = await resolveOfficialYouTubeAudioStream(vidCandidate, title || '', artist || '');"
    new_rs2 = "const directAudio = await resolveOfficialYouTubeAudioStream(vidCandidate, title || '', artist || '', { duration: Number(duration) || null });"
    if old_rs2 in code:
        code = code.replace(old_rs2, new_rs2, 1)

    old_rs3 = "const directAudio = await resolveOfficialYouTubeAudioStream(url || '', title || '', artist || '');"
    new_rs3 = "const directAudio = await resolveOfficialYouTubeAudioStream(url || '', title || '', artist || '', { duration: Number(duration) || null });"
    if old_rs3 in code:
        code = code.replace(old_rs3, new_rs3, 1)

    with open(path, 'w', encoding='utf-8') as f:
        f.write(code)
    print("Patched tracks.js route successfully")

def patch_audio_context():
    path = os.path.join(BASE_DIR, 'src', 'native', 'context', 'AudioContext.js')
    with open(path, 'r', encoding='utf-8') as f:
        code = f.read()

    # 1. Update isJamHost to check hostUserId and currentUser
    old_isJamHost = """  const isJamHost = useCallback(() => {
    const session = jamSyncRef.current?.jamSession;
    if (!session) return false;
    const sock = jamSyncRef.current?.socket;
    const sockId = sock?.id;
    if (!sockId) return false;

    if (session.hostId && session.hostId === sockId) return true;
    if (Array.isArray(session.members)) {
      const me = session.members.find(m => m.socketId === sockId);
      if (me && me.isHost) return true;
    }
    return false;
  }, []);"""

    new_isJamHost = """  const isJamHost = useCallback(() => {
    const session = jamSyncRef.current?.jamSession;
    if (!session) return false;
    const sock = jamSyncRef.current?.socket;
    const sockId = sock?.id;
    const myId = String(currentUser?._id || currentUser?.id || '');

    if (session.hostUserId && myId && String(session.hostUserId) === myId) return true;
    if (sockId && session.hostId && session.hostId === sockId) return true;
    if (Array.isArray(session.members)) {
      const me = session.members.find(m => (sockId && m.socketId === sockId) || (myId && String(m.id || m._id) === myId));
      if (me && me.isHost) return true;
    }
    return false;
  }, [currentUser]);"""

    if old_isJamHost in code:
        code = code.replace(old_isJamHost, new_isJamHost, 1)

    # 2. Update playNextTrack to allow collaborative members to advance their queue when shared queue is empty
    old_playNext_jam = """  const playNextTrack = (forceLocal = false) => {
    // 1. Advance shared room queue if active in Jam
    if (!forceLocal && jamSyncRef.current.jamSession && jamSyncRef.current.socket) {
      const roomCode = jamSyncRef.current.jamSession.code || jamSyncRef.current.jamSession.roomCode;
      if (roomCode) {
        if (!canControlJam()) {
          return;
        }
        if (jamSyncRef.current.jamSession.queue && jamSyncRef.current.jamSession.queue.length > 0) {
          jamSyncRef.current.socket.emit('jam:next_track', { roomCode });
          return;
        }
        if (!isJamHost()) {
          jamSyncRef.current.socket.emit('jam:next_track', { roomCode });
          return;
        }
      }
    }"""

    new_playNext_jam = """  const playNextTrack = (forceLocal = false) => {
    // 1. Advance shared room queue if active in Jam
    if (!forceLocal && jamSyncRef.current.jamSession && jamSyncRef.current.socket) {
      const roomCode = jamSyncRef.current.jamSession.code || jamSyncRef.current.jamSession.roomCode;
      if (roomCode) {
        if (!canControlJam()) {
          return;
        }
        // If room has tracks in queue, advance shared queue
        if (jamSyncRef.current.jamSession.queue && jamSyncRef.current.jamSession.queue.length > 0) {
          jamSyncRef.current.socket.emit('jam:next_track', { roomCode });
          return;
        }
        // If room queue is empty and host-only control is locked, request host to advance
        if (!isJamHost() && jamSyncRef.current.jamSession.hostOnlyControl) {
          jamSyncRef.current.socket.emit('jam:next_track', { roomCode });
          return;
        }
        // When collaborative control is active, any member advances their local queue and broadcasts new track to room
      }
    }"""

    if old_playNext_jam in code:
        code = code.replace(old_playNext_jam, new_playNext_jam, 1)

    # 3. Update syncFromOnlineTrack to broadcast to Jam room when active
    old_syncOnline = """  const syncFromOnlineTrack = useCallback(({ track, isPlaying: onlinePlaying, currentTime: onlineTime, duration: onlineDur }) => {
    if (track) {
      currentTrackRef.current = track;
      setCurrentTrackState(track);
      isPlayingRef.current = Boolean(onlinePlaying);
      setIsPlaying(Boolean(onlinePlaying));
      if (onlineTime !== undefined && onlineDur !== undefined) {
        setProgress({ currentTime: onlineTime, duration: onlineDur });
      }
    }
  }, []);"""

    new_syncOnline = """  const syncFromOnlineTrack = useCallback(({ track, isPlaying: onlinePlaying, currentTime: onlineTime, duration: onlineDur }) => {
    if (track) {
      const prevTrack = currentTrackRef.current;
      const isNewTrack = !prevTrack || String(prevTrack._id || prevTrack.id || prevTrack.title) !== String(track._id || track.id || track.title);
      currentTrackRef.current = track;
      setCurrentTrackState(track);
      isPlayingRef.current = Boolean(onlinePlaying);
      setIsPlaying(Boolean(onlinePlaying));
      if (onlineTime !== undefined && onlineDur !== undefined) {
        setProgress({ currentTime: onlineTime, duration: onlineDur });
      }

      // Broadcast to Jam Room if active and collaborative control permits
      if (isNewTrack && jamSyncRef.current.jamSession && jamSyncRef.current.socket && canControlJam()) {
        const roomCode = String(jamSyncRef.current.jamSession.code || jamSyncRef.current.jamSession.roomCode || '').trim().toUpperCase();
        if (roomCode) {
          jamSyncRef.current.socket.emit('jam:sync_play_state', {
            roomCode,
            isPlaying: Boolean(onlinePlaying),
            currentTrack: track,
            currentTime: Number(onlineTime || 0),
            initiatorId: jamSyncRef.current.socket.id,
            userId: currentUser?._id || currentUser?.id,
            isUserAction: true,
            userAction: 'play_track',
          });
        }
      }
    }
  }, [canControlJam, currentUser]);"""

    if old_syncOnline in code:
        code = code.replace(old_syncOnline, new_syncOnline, 1)

    with open(path, 'w', encoding='utf-8') as f:
        f.write(code)
    print("Patched AudioContext.js successfully")

def patch_socket_context():
    path = os.path.join(BASE_DIR, 'src', 'native', 'context', 'SocketContext.js')
    with open(path, 'r', encoding='utf-8') as f:
        code = f.read()

    # 1. Update isCurrentUserHost to check hostUserId
    old_host = """  const isCurrentUserHost = Boolean(
    jamSession && socket &&
      ((jamSession.hostId === socket.id) ||
        (jamSession.members || []).some(m => m.socketId === socket.id && m.isHost))
  );"""

    new_host = """  const myId = String(currentUser?._id || currentUser?.id || '');
  const isCurrentUserHost = Boolean(
    jamSession &&
      ((jamSession.hostUserId && myId && String(jamSession.hostUserId) === myId) ||
        (socket && jamSession.hostId === socket.id) ||
        (jamSession.members || []).some(m => (socket && m.socketId === socket.id) || (myId && String(m.id || m._id) === myId && m.isHost)))
  );"""

    if old_host in code:
        code = code.replace(old_host, new_host, 1)

    # 2. Update jam:sync_play_state to initialize jamSession if prev was null
    old_sync = """    s.on('jam:sync_play_state', (data) => {
      if (data) {
        setJamSession(prev => prev ? ({
          ...prev,
          isPlaying: data.isPlaying !== undefined ? Boolean(data.isPlaying) : prev.isPlaying,
          currentTime: data.currentTime !== undefined ? Number(data.currentTime) : prev.currentTime,
          currentTrack: data.currentTrack || prev.currentTrack,
          updatedAt: data.updatedAt || Date.now(),
        }) : null);

        if (syncRemotePlayStateRef.current) {
          if (data.initiatorId && data.initiatorId === s.id) return;
          syncRemotePlayStateRef.current(data);
        }
      }
    });"""

    new_sync = """    s.on('jam:sync_play_state', (data) => {
      if (data) {
        setJamSession(prev => {
          if (prev) {
            return {
              ...prev,
              isPlaying: data.isPlaying !== undefined ? Boolean(data.isPlaying) : prev.isPlaying,
              currentTime: data.currentTime !== undefined ? Number(data.currentTime) : prev.currentTime,
              currentTrack: data.currentTrack || prev.currentTrack,
              updatedAt: data.updatedAt || Date.now(),
            };
          }
          if (data.roomCode) {
            return {
              code: data.roomCode,
              isPlaying: Boolean(data.isPlaying),
              currentTime: Number(data.currentTime) || 0,
              currentTrack: data.currentTrack,
              updatedAt: data.updatedAt || Date.now(),
              members: []
            };
          }
          return null;
        });

        if (syncRemotePlayStateRef.current) {
          if (data.initiatorId && data.initiatorId === s.id) return;
          syncRemotePlayStateRef.current(data);
        }
      }
    });"""

    if old_sync in code:
        code = code.replace(old_sync, new_sync, 1)

    with open(path, 'w', encoding='utf-8') as f:
        f.write(code)
    print("Patched SocketContext.js successfully")

def patch_jam_room_modal():
    path = os.path.join(BASE_DIR, 'src', 'native', 'components', 'JamRoomModal.js')
    with open(path, 'r', encoding='utf-8') as f:
        code = f.read()

    # In search drawer, make the whole track row clickable to play immediately in Jam room
    old_row = """                <View key={tId} style={styles.searchResultItem}>
                  <Image
                    source={{
                      uri:
                        track.cover ||
                        'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=100',
                    }}
                    style={styles.resultCover}
                  />
                  <View style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
                    <Text style={styles.resultTitle} numberOfLines={1}>
                      {track.title}
                    </Text>
                    <Text style={styles.resultArtist} numberOfLines={1}>
                      {track.artist}
                    </Text>
                  </View>"""

    new_row = """                <View key={tId} style={styles.searchResultItem}>
                  <TouchableOpacity
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0, marginRight: 8 }}
                    activeOpacity={0.7}
                    onPress={() => {
                      const canControl = isCurrentUserHost || !jamSession?.hostOnlyControl;
                      if (canControl) {
                        playTrack(track);
                        showToast(`Playing "${track.title}" in Jam`, 'info');
                      } else {
                        handleAddTrack(track);
                      }
                    }}
                  >
                    <Image
                      source={{
                        uri:
                          track.cover ||
                          'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=100',
                      }}
                      style={styles.resultCover}
                    />
                    <View style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
                      <Text style={styles.resultTitle} numberOfLines={1}>
                        {track.title}
                      </Text>
                      <Text style={styles.resultArtist} numberOfLines={1}>
                        {track.artist}
                      </Text>
                    </View>
                  </TouchableOpacity>"""

    if old_row in code:
        code = code.replace(old_row, new_row, 1)

    with open(path, 'w', encoding='utf-8') as f:
        f.write(code)
    print("Patched JamRoomModal.js successfully")

def patch_toast_and_app():
    # 1. ToastContext.js
    toast_path = os.path.join(BASE_DIR, 'src', 'native', 'context', 'ToastContext.js')
    with open(toast_path, 'r', encoding='utf-8') as f:
        tcode = f.read()

    # Import StatusBar if not present
    if "import { View, Text, StyleSheet, Animated, TouchableOpacity, Image, Platform } from 'react-native';" in tcode:
        tcode = tcode.replace(
            "import { View, Text, StyleSheet, Animated, TouchableOpacity, Image, Platform } from 'react-native';",
            "import { View, Text, StyleSheet, Animated, TouchableOpacity, Image, Platform, StatusBar } from 'react-native';"
        )

    # Safe status bar top padding
    old_top = "top: Platform.OS === 'ios' ? 48 : 20,"
    new_top = "top: Platform.OS === 'ios' ? 52 : ((StatusBar.currentHeight ? StatusBar.currentHeight + 10 : 28)),"
    if old_top in tcode:
        tcode = tcode.replace(old_top, new_top, 1)

    with open(toast_path, 'w', encoding='utf-8') as f:
        f.write(tcode)
    print("Patched ToastContext.js successfully")

    # 2. App.js
    app_path = os.path.join(BASE_DIR, 'App.js')
    with open(app_path, 'r', encoding='utf-8') as f:
        acode = f.read()

    old_app_chat = """      showToast(text, 'chat', {
        title: senderName,
        avatar: senderAvatar,
        onPress: () => {
          setChatTargetUser(targetUser);
          setIsChatOpen(true);
        }
      });"""

    new_app_chat = """      // Don't show toast if already chatting with this sender
      if (isChatOpen && chatTargetUser && String(chatTargetUser._id || chatTargetUser.id) === senderId) {
        return;
      }

      showToast(text, 'chat', {
        title: senderName,
        avatar: senderAvatar,
        onPress: () => {
          setIsFullPlayerOpen(false);
          setIsJamOpen(false);
          setChatTargetUser(targetUser);
          setIsChatOpen(true);
        }
      });"""

    if old_app_chat in acode:
        acode = acode.replace(old_app_chat, new_app_chat, 1)

    with open(app_path, 'w', encoding='utf-8') as f:
        f.write(acode)
    print("Patched App.js successfully")

if __name__ == '__main__':
    patch_youtube_resolver()
    patch_helpers()
    patch_tracks_route()
    patch_audio_context()
    patch_socket_context()
    patch_jam_room_modal()
    patch_toast_and_app()
    print("All patches completed successfully!")
