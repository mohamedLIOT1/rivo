const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'db.json');

function initDb() {
  if (!fs.existsSync(DB_FILE)) {
    const initialData = {
      users: [],
      tracks: [],
      playlists: []
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
  }
}

function readDb() {
  initDb();
  try {
    const content = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(content);
  } catch (e) {
    return { users: [], tracks: [], playlists: [] };
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
    const updatedUser = {
      ...existing,
      ...userData,
      email: cleanEmail,
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
  getTracks: () => readDb().tracks || [],
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
    const db = readDb();
    db.playlists = db.playlists || [];
    const id = String(playlistData.id || `pl-${Date.now()}`);
    const index = db.playlists.findIndex(p => String(p.id) === id);
    const plObj = { ...playlistData, id };
    if (index >= 0) {
      db.playlists[index] = plObj;
    } else {
      db.playlists.unshift(plObj);
    }
    writeDb(db);
    return plObj;
  }
};
