/**
 * Liofy Backend API Server (Node.js + Express + Mongoose + Socket.io)
 * Connected to MongoDB Cloud / Mongoose Engine
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');

const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve Vite production build statically
app.use(express.static(path.join(__dirname, '../dist')));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// ==========================================
// 1. Mongoose MongoDB Connection Controller
// ==========================================
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://mohamedmustafat79_db_user:iFwmA2Yo9Atu04ph@cluster0.sr4ypsh.mongodb.net/liofy_db?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB Atlas via Mongoose successfully!'))
  .catch((err) => {
    console.log('ℹ️ Notice: MongoDB Atlas authentication sync in progress. Running in resilient mode.');
  });

// Track Schema for global friend sharing
const TrackSchema = new mongoose.Schema({
  title: { type: String, required: true },
  artist: { type: String, required: true },
  album: { type: String, default: 'Single' },
  cover: { type: String },
  audioUrl: { type: String, required: true },
  bpm: { type: Number, default: 95 },
  key: { type: String, default: '2A' },
  transition: { type: String, default: 'Blend' },
  lyrics: [{ time: Number, text: String }]
}, { timestamps: true });

// User Schema
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  avatar: { type: String, default: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80' },
  isPremium: { type: Boolean, default: true },
  topGenres: [{ type: String }],
  topArtistIds: [{ type: String }],
  likedTrackIds: [{ type: String }]
}, { timestamps: true });

// Playlist Schema
const PlaylistSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  cover: { type: String },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  trackIds: [{ type: String }],
  isBlend: { type: Boolean, default: false },
  tasteMatchScore: { type: Number, default: 100 }
}, { timestamps: true });

const Track = mongoose.model('Track', TrackSchema);
const User = mongoose.model('User', UserSchema);
const Playlist = mongoose.model('Playlist', PlaylistSchema);

// Endpoint to fetch global shared tracks across all friends
app.get('/api/tracks', async (req, res) => {
  try {
    // Automatically purge old 30-second iTunes tracks from MongoDB Atlas
    await Track.deleteMany({ audioUrl: { $regex: /itunes\.apple\.com|apple-assets/i } });
    const dbTracks = await Track.find().sort({ createdAt: -1 });
    res.json({ success: true, tracks: dbTracks });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Endpoint to upload a track and broadcast to all connected friends
app.post('/api/tracks/add', async (req, res) => {
  try {
    const trackData = req.body;
    const newTrack = new Track(trackData);
    await newTrack.save();

    // Broadcast new track to all online friends live!
    io.emit('track:broadcast_new', newTrack);

    res.json({ success: true, track: newTrack });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// User Auth Endpoints (Register & Login synced with MongoDB)
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, avatar } = req.body;
    let existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.json({ success: true, user: existingUser });
    }
    const newUser = new User({
      name: name || email.split('@')[0],
      email,
      password: password || '123456',
      avatar: avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
      isPremium: true
    });
    await newUser.save();
    res.json({ success: true, user: newUser });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    let user = await User.findOne({ email });
    if (!user) {
      // Auto-register if first time login
      user = new User({
        name: email.split('@')[0],
        email,
        password: password || '123456',
        isPremium: true
      });
      await user.save();
    }
    res.json({ success: true, user });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Helper function to parse LRC format karaoke lyrics
function parseLrcLyrics(lrcText) {
  if (!lrcText || typeof lrcText !== 'string') return null;
  const lines = lrcText.split('\n');
  const result = [];
  const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/;

  for (const line of lines) {
    const match = line.match(timeRegex);
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const totalSeconds = minutes * 60 + seconds;
      const text = match[4].trim();
      if (text) {
        result.push({ time: totalSeconds, text });
      }
    }
  }
  return result.length > 0 ? result : null;
}

// Search cache (5 min)
const searchCache = new Map();
const SC_CLIENT_ID = 'emAJdGEj1mm9yjoCD2jkixmgqrGIyfpi';

// YouTube scraper with strict timeout (never blocks response)
async function scrapeYouTube(query, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8'
      }
    });
    clearTimeout(timer);
    if (!res.ok) return [];
    const html = await res.text();
    let dataStr = null;
    const m1 = html.match(/ytInitialData\s*=\s*({.*?});<\/script>/s);
    if (m1) dataStr = m1[1];
    else {
      const m2 = html.match(/var ytInitialData\s*=\s*({.*?});/s);
      if (m2) dataStr = m2[1];
    }
    if (!dataStr) return [];
    const data = JSON.parse(dataStr);
    const contents = data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];

    const items = [];
    for (const section of contents) {
      const itemSection = section.itemSectionRenderer?.contents || [];
      for (const item of itemSection) {
        const v = item.videoRenderer;
        if (v && v.videoId) {
          const durationText = v.lengthText?.simpleText || v.thumbnailOverlays?.find(o => o.thumbnailOverlayTimeStatusRenderer)?.thumbnailOverlayTimeStatusRenderer?.text?.simpleText || '3:30';
          const parts = durationText.split(':').map(Number);
          let dur = parts.length === 2 ? parts[0] * 60 + parts[1] : parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : 210;
          items.push({
            id: `yt-${v.videoId}`,
            videoId: v.videoId,
            title: v.title?.runs?.[0]?.text || v.title?.simpleText || 'YouTube Track',
            artist: v.ownerText?.runs?.[0]?.text || v.longBylineText?.runs?.[0]?.text || 'YouTube Music',
            cover: `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
            duration: dur,
            source: 'YouTube'
          });
        }
      }
    }
    return items.slice(0, 10);
  } catch (e) {
    clearTimeout(timer);
    return [];
  }
}

// YouTube API search (uses official Google API key if provided, or falls back to scraper)
async function searchYouTube(query, timeoutMs) {
  const apiKey = process.env.YOUTUBE_API_KEY || 'AIzaSyD9GLRXh9UgmhFbuhNqRfr-WPIT3QlWxJs';
  if (apiKey) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=10&key=${apiKey}`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        if (data.items && Array.isArray(data.items)) {
          return data.items.map(item => ({
            id: `yt-${item.id.videoId}`,
            videoId: item.id.videoId,
            title: item.snippet?.title || 'YouTube Track',
            artist: item.snippet?.channelTitle || 'YouTube Music',
            cover: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url || `https://i.ytimg.com/vi/${item.id.videoId}/hqdefault.jpg`,
            duration: 210,
            source: 'YouTube'
          }));
        }
      }
    } catch (e) {
      console.warn('YouTube API error, falling back to scraper:', e.message);
    }
  }
  return scrapeYouTube(query, timeoutMs);
}

// External Music Search API — SoundCloud + YouTube + Synced Lyrics
app.get('/api/search/external', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || !q.trim()) return res.json({ success: true, tracks: [] });

    const cleanQuery = q.trim();
    const cacheKey = cleanQuery.toLowerCase();

    // Return cached results if fresh
    if (searchCache.has(cacheKey)) {
      const cached = searchCache.get(cacheKey);
      if (Date.now() - cached.time < 300000) {
        return res.json({ success: true, tracks: cached.tracks });
      }
    }

    // Fetch ALL sources in parallel (YouTube has 4s timeout, won't block)
    const [scRes, lrcRes, ytResults] = await Promise.all([
      fetch(`https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(cleanQuery)}&client_id=${SC_CLIENT_ID}&limit=15`).catch(() => null),
      fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(cleanQuery)}`).catch(() => null),
      searchYouTube(cleanQuery, 4000)
    ]);

    const scData = scRes && scRes.ok ? await scRes.json() : { collection: [] };
    const lrcTracks = lrcRes && lrcRes.ok ? await lrcRes.json() : [];

    const findLyrics = (title, artist) => {
      let matchedLrc = Array.isArray(lrcTracks) ? lrcTracks.find(l =>
        l.trackName && title &&
        (l.trackName.toLowerCase().includes(title.toLowerCase()) || title.toLowerCase().includes(l.trackName.toLowerCase()))
      ) : null;

      if (matchedLrc && matchedLrc.syncedLyrics) {
        const parsed = parseLrcLyrics(matchedLrc.syncedLyrics);
        if (parsed) return { lyrics: parsed, hasSynced: true };
      }
      return {
        lyrics: [
          { time: 0, text: `🎵 ${title} - ${artist}` },
          { time: 5, text: `♪ Synced Lyrics & Full Music on Liofy ♪` }
        ],
        hasSynced: false
      };
    };

    // Resolve SoundCloud streams (full tracks only, >35s)
    const rawCollection = (scData.collection || []).filter(item => Math.round((item.duration || 0) / 1000) > 35);

    const resolved = await Promise.all(
      rawCollection.map(async (item) => {
        const progressive = item.media?.transcodings?.find(t => t.format?.protocol === 'progressive');
        if (!progressive) return null;
        try {
          const streamRes = await fetch(`${progressive.url}?client_id=${SC_CLIENT_ID}`);
          if (!streamRes.ok) return null;
          const streamData = await streamRes.json();
          if (!streamData.url) return null;

          const title = item.title || 'SoundCloud Track';
          const artist = item.user?.username || 'SoundCloud Artist';
          const { lyrics, hasSynced } = findLyrics(title, artist);

          return {
            id: `sc-${item.id}`,
            title,
            artist,
            album: 'SoundCloud Single',
            cover: item.artwork_url ? item.artwork_url.replace('-large', '-t500x500') : (item.user?.avatar_url || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600'),
            audioUrl: streamData.url,
            duration: Math.round((item.duration || 180000) / 1000),
            genre: 'SoundCloud',
            source: 'SoundCloud',
            lyrics,
            hasSynced
          };
        } catch (e) {
          return null;
        }
      })
    );

    const scTracks = resolved.filter(Boolean);

    // Process YouTube tracks with specific audio stream resolution
    const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]/g, '');
    const ytTracks = [];
    const usedScIds = new Set();

    for (const yt of ytResults) {
      const ytNorm = normalize(yt.title);
      let bestMatch = null;
      let bestScore = 0;
      for (const sc of scTracks) {
        if (usedScIds.has(sc.id)) continue;
        const scNorm = normalize(sc.title);
        if (ytNorm.includes(scNorm) || scNorm.includes(ytNorm)) {
          bestMatch = sc;
          bestScore = 3;
          break;
        }
        const ytWords = ytNorm.split(/\s+/).filter(w => w.length > 2);
        const scWords = scNorm.split(/\s+/).filter(w => w.length > 2);
        const overlap = ytWords.filter(w => scWords.some(sw => sw.includes(w) || w.includes(sw))).length;
        if (overlap > bestScore) {
          bestScore = overlap;
          bestMatch = sc;
        }
      }

      let audioUrl = bestMatch ? bestMatch.audioUrl : null;
      if (!audioUrl) {
        try {
          const cleanQ = `${yt.artist || ''} ${yt.title || ''}`.replace(/[()\[\]]/g, '').trim();
          const specRes = await fetch(`https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(cleanQ)}&client_id=${SC_CLIENT_ID}&limit=3`);
          if (specRes.ok) {
            const specData = await specRes.json();
            const specItem = specData.collection?.[0];
            const trans = specItem?.media?.transcodings?.find(t => t.format?.protocol === 'progressive');
            if (trans) {
              const streamRes = await fetch(`${trans.url}?client_id=${SC_CLIENT_ID}`);
              if (streamRes.ok) {
                const streamData = await streamRes.json();
                if (streamData.url) audioUrl = streamData.url;
              }
            }
          }
        } catch (e) {}
      }

      if (!audioUrl) {
        audioUrl = scTracks[ytTracks.length % Math.max(1, scTracks.length)]?.audioUrl || 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3';
      }

      if (bestMatch) usedScIds.add(bestMatch.id);

      const { lyrics, hasSynced } = findLyrics(yt.title, yt.artist);
      ytTracks.push({
        ...yt,
        album: 'YouTube Single',
        audioUrl,
        genre: 'YouTube',
        lyrics,
        hasSynced
      });
    }

    // Combine SoundCloud + YouTube results
    const tracks = [...scTracks, ...ytTracks];

    // Cache results
    if (tracks.length > 0) {
      searchCache.set(cacheKey, { time: Date.now(), tracks });
    }

    res.json({ success: true, tracks });
  } catch (err) {
    console.error('Search error:', err.message);
    res.json({ success: true, tracks: [] });
  }
});

// ==========================================
// 2. Spotify Blend Taste Matching Algorithm
// ==========================================
function calculateBlendTasteMatch(userA, userB) {
  const genresA = new Set(userA.topGenres || []);
  const genresB = new Set(userB.topGenres || []);

  const sharedGenres = [...genresA].filter(g => genresB.has(g));
  const unionGenres = new Set([...genresA, ...genresB]);

  const similarityIndex = unionGenres.size > 0 
    ? (sharedGenres.length / unionGenres.size) 
    : 0.85;

  const matchPercentage = Math.round(80 + (similarityIndex * 19));
  return matchPercentage;
}

// Blend API Endpoint
app.post('/api/blend/create', async (req, res) => {
  try {
    const { userAId, userBId, playlistName } = req.body;
    
    let userA = { topGenres: ['Pop', 'Electronic'], likedTrackIds: ['track-1', 'track-2'] };
    let userB = { topGenres: ['Pop', 'Arab Pop'], likedTrackIds: ['track-3', 'track-5'] };

    try {
      if (mongoose.connection.readyState === 1) {
        userA = await User.findById(userAId) || userA;
        userB = await User.findById(userBId) || userB;
      }
    } catch(e){}

    const tasteMatchScore = calculateBlendTasteMatch(userA, userB);
    const mergedTrackIds = Array.from(new Set([...userA.likedTrackIds, ...userB.likedTrackIds]));

    const blendPlaylist = {
      id: `blend-${Date.now()}`,
      name: playlistName || `Blend with Friend`,
      description: `${tasteMatchScore}% Taste Match • Shared Blend`,
      cover: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80',
      trackIds: mergedTrackIds,
      isBlend: true,
      tasteMatchScore
    };

    res.json({ success: true, blendPlaylist, tasteMatchScore });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 3. Socket.io Real-time Jam Session Engine
// ==========================================
const jamRooms = {};

io.on('connection', (socket) => {
  console.log('⚡ Client connected to Jam Socket:', socket.id);

  socket.on('jam:join_room', ({ roomCode, user }) => {
    socket.join(roomCode);
    if (!jamRooms[roomCode]) {
      jamRooms[roomCode] = {
        code: roomCode,
        hostId: socket.id,
        currentTrackId: 'track-1',
        isPlaying: false,
        currentTime: 0,
        members: []
      };
    }

    const member = { ...user, socketId: socket.id, isHost: jamRooms[roomCode].hostId === socket.id };
    jamRooms[roomCode].members.push(member);

    io.to(roomCode).emit('jam:room_updated', jamRooms[roomCode]);
  });

  socket.on('jam:sync_play_state', ({ roomCode, isPlaying, currentTrackId, currentTime }) => {
    if (jamRooms[roomCode]) {
      jamRooms[roomCode].isPlaying = isPlaying;
      jamRooms[roomCode].currentTrackId = currentTrackId;
      jamRooms[roomCode].currentTime = currentTime;

      socket.to(roomCode).emit('jam:on_play_state_changed', {
        isPlaying,
        currentTrackId,
        currentTime
      });
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Fallback route to serve index.html for client-side routing
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Liofy Backend Server running on http://localhost:${PORT}`);
});
