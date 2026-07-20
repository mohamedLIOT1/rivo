const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'db.json');

const DEFAULT_SEED_TRACKS = [
  {
    id: "track-seed-1",
    title: "Lege-Cy - El Neyya (ليجي-سي - النيه)",
    artist: "Lege-Cy",
    album: "El Neyya",
    cover: "https://i.ytimg.com/vi/NEGYA_DEFAULT/hqdefault.jpg",
    audioUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    duration: 210,
    genre: "Hip-Hop",
    source: "YouTube"
  },
  {
    id: "track-seed-2",
    title: "Amr Diab - Aref Habiby (عمرو دياب - عارف حبيبي)",
    artist: "Amr Diab",
    album: "Single",
    cover: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600",
    audioUrl: "https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3",
    duration: 240,
    genre: "Arab Pop",
    source: "Liofy"
  },
  {
    id: "track-seed-3",
    title: "Lege-Cy - Placebo (بلاسبو)",
    artist: "Lege-Cy",
    album: "Placebo",
    cover: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600",
    audioUrl: "https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a73228.mp3",
    duration: 195,
    genre: "Hip-Hop",
    source: "Liofy"
  },
  {
    id: "track-seed-4",
    title: "Lege-Cy x ISMAIL NOSRAT - LAW NASYA",
    artist: "Lege-Cy",
    album: "LAW NASYA",
    cover: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600",
    audioUrl: "https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3",
    duration: 220,
    genre: "Hip-Hop",
    source: "Liofy"
  }
];

function initDb() {
  if (!fs.existsSync(DB_FILE)) {
    const initialData = {
      users: [],
      tracks: DEFAULT_SEED_TRACKS,
      playlists: []
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
  }
}

function readDb() {
  initDb();
  try {
    const content = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(content);
    if (!parsed.tracks || parsed.tracks.length === 0) {
      parsed.tracks = DEFAULT_SEED_TRACKS;
      writeDb(parsed);
    }
    return parsed;
  } catch (e) {
    return { users: [], tracks: DEFAULT_SEED_TRACKS, playlists: [] };
  }
}

function writeDb(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Database write error:', e.message);
  }
}

module.exports = {
  getUsers: () => readDb().users || [],
  getUserByEmail: (email) => {
    if (!email) return null;
    const clean = String(email).trim().toLowerCase();
    const db = readDb();
    return (db.users || []).find(u => u.email && String(u.email).trim().toLowerCase() === clean) || null;
  },
  saveUser: (userData) => {
    if (!userData || !userData.email) return null;
    const db = readDb();
    db.users = db.users || [];
    const cleanEmail = String(userData.email).trim().toLowerCase();
    const index = db.users.findIndex(u => u.email && String(u.email).trim().toLowerCase() === cleanEmail);
    
    const existing = index >= 0 ? db.users[index] : {};
    
    // Preserve existing userTracks if new userTracks is empty
    let finalUserTracks = existing.userTracks || [];
    if (Array.isArray(userData.userTracks) && userData.userTracks.length > 0) {
      finalUserTracks = userData.userTracks;
    }

    const updatedUser = {
      ...existing,
      ...userData,
      email: cleanEmail,
      userTracks: finalUserTracks,
      avatar: userData.avatar || existing.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
      name: userData.name || existing.name || cleanEmail.split('@')[0]
    };

    if (index >= 0) {
      db.users[index] = updatedUser;
    } else {
      db.users.push(updatedUser);
    }
    writeDb(db);
    return updatedUser;
  },
  getTracks: () => {
    const db = readDb();
    if (!db.tracks || db.tracks.length === 0) return DEFAULT_SEED_TRACKS;
    return db.tracks;
  },
  saveTrack: (trackData) => {
    if (!trackData) return null;
    const db = readDb();
    db.tracks = db.tracks || [];
    const id = String(trackData.id || trackData._id || `track-${Date.now()}`);
    const index = db.tracks.findIndex(t => String(t.id || t._id) === id);
    const trackObj = {
      ...trackData,
      id,
      title: trackData.title || 'Untitled Track',
      artist: trackData.artist || 'Unknown Artist',
      cover: trackData.cover || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600',
      audioUrl: trackData.audioUrl || 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3'
    };
    if (index >= 0) {
      db.tracks[index] = trackObj;
    } else {
      db.tracks.unshift(trackObj);
    }
    writeDb(db);
    return trackObj;
  },
  getPlaylists: () => readDb().playlists || [],
  savePlaylist: (playlistData) => {
    if (!playlistData) return null;
    const db.playlists = readDb().playlists || [];
    const id = String(playlistData.id || `pl-${Date.now()}`);
    const index = db.playlists.findIndex(p => String(p.id) === id);
    const plObj = { ...playlistData, id };
    if (index >= 0) {
      db.playlists[index] = plObj;
    } else {
      db.playlists.unshift(plObj);
    }
    const dbData = readDb();
    dbData.playlists = db.playlists;
    writeDb(dbData);
    return plObj;
  }
};
