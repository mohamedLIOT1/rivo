import subprocess
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

KEY = r"C:\Users\mohamed\Downloads\my-bot-key.pem"
HOST = "ubuntu@rivo-m.duckdns.org"

script = """
const mongoose = require('mongoose');
require('dotenv').config({ path: '/home/ubuntu/rivo/.env' });

function cleanQuranTrackTitle(title) {
  if (!title || typeof title !== 'string') return '';
  return title
    .replace(/\\|\\s*بدون\\s*إ?علانات\\s*\\d*/gi, '')
    .replace(/[\\(\\[\\{]\\s*بدون\\s*إ?علانات\\s*[\\)\\]\\}]/gi, '')
    .replace(/\\|\\s*كامل\\s*بدون\\s*فواصل/gi, '')
    .replace(/^\\d{1,3}\\s*[\\.\\-–]\\s*/, '')
    .replace(/[\\s|–-]+$/, '')
    .trim() || title;
}

function normalizeArabicText(text = '') {
  return String(text || '')
    .toLowerCase()
    .replace(/[\\u064B-\\u065F\\u0670]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .trim();
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to MongoDB');
  const { Album, Track, User } = require('/home/ubuntu/rivo/server/models');

  const quranTracks = await Track.find({
    $or: [
      { isQuran: true },
      { genre: 'Quran' },
      { artist: /منشاوي|عفاسي|حصري|دوسري|قرآن|قران/i },
      { title: /سورة|سوره|قرآن|قران/i }
    ]
  }).lean();

  console.log('Total Quran tracks found:', quranTracks.length);

  // Group tracks
  const groups = new Map();
  for (const t of quranTracks) {
    let key = '';
    if (t.audioUrl && t.audioUrl.length > 10) {
      const ytMatch = t.audioUrl.match(/[?&]v=([a-zA-Z0-9_-]{11})/) || t.audioUrl.match(/youtu\\.be\\/([a-zA-Z0-9_-]{11})/);
      key = ytMatch ? `yt:${ytMatch[1]}` : `url:${t.audioUrl.trim().toLowerCase()}`;
    } else {
      const cleanT = cleanQuranTrackTitle(t.title || '');
      key = `meta:${normalizeArabicText(t.artist || '')}:::${normalizeArabicText(cleanT)}`;
    }

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(t);
  }

  // Load albums and users to check references
  const allAlbums = await Album.find().lean();
  const allUsers = await User.find().lean();

  const refSet = new Set();
  allAlbums.forEach(a => (a.trackIds || []).forEach(id => refSet.add(String(id))));
  allUsers.forEach(u => {
    (u.likedTrackIds || []).forEach(id => refSet.add(String(id)));
    (u.playlists || []).forEach(pl => (pl.trackIds || []).forEach(id => refSet.add(String(id))));
  });

  const dupMap = new Map(); // dupId -> canonicalId
  const dupIdsToDelete = [];

  for (const [key, list] of groups.entries()) {
    if (list.length <= 1) continue;

    // Pick canonical: prefer one in refSet, then one with oldest createdAt
    let canonical = list.find(t => refSet.has(String(t._id)));
    if (!canonical) {
      canonical = list[0];
    }
    const canId = String(canonical._id);

    for (const t of list) {
      const tId = String(t._id);
      if (tId !== canId) {
        dupIdsToDelete.push(t._id);
        dupMap.set(tId, canId);
      }
    }
  }

  console.log(`Found ${dupIdsToDelete.length} duplicates to remove across ${groups.size} unique Quran recitations.`);

  // Remap Album trackIds
  let albumsUpdated = 0;
  for (const a of allAlbums) {
    if (!Array.isArray(a.trackIds) || a.trackIds.length === 0) continue;
    let changed = false;
    const newTrackIds = a.trackIds.map(id => {
      const sId = String(id);
      if (dupMap.has(sId)) {
        changed = true;
        return dupMap.get(sId);
      }
      return id;
    });
    // Remove consecutive duplicates inside album if any
    const uniqueIds = Array.from(new Set(newTrackIds.map(String)));
    if (changed || uniqueIds.length !== a.trackIds.length) {
      await Album.updateOne({ _id: a._id }, { $set: { trackIds: uniqueIds } });
      albumsUpdated++;
    }
  }
  console.log(`Updated ${albumsUpdated} albums with remapped trackIds.`);

  // Remap User playlists and likedTrackIds
  let usersUpdated = 0;
  for (const u of allUsers) {
    let changed = false;
    let newLiked = u.likedTrackIds || [];
    if (newLiked.length > 0) {
      const remapped = Array.from(new Set(newLiked.map(id => dupMap.get(String(id)) || String(id))));
      if (remapped.length !== newLiked.length || remapped.some((id, idx) => String(id) !== String(newLiked[idx]))) {
        newLiked = remapped;
        changed = true;
      }
    }

    let newPlaylists = u.playlists || [];
    if (newPlaylists.length > 0) {
      for (const pl of newPlaylists) {
        if (Array.isArray(pl.trackIds) && pl.trackIds.length > 0) {
          const remapped = Array.from(new Set(pl.trackIds.map(id => dupMap.get(String(id)) || String(id))));
          if (remapped.length !== pl.trackIds.length || remapped.some((id, idx) => String(id) !== String(pl.trackIds[idx]))) {
            pl.trackIds = remapped;
            changed = true;
          }
        }
      }
    }

    if (changed) {
      await User.updateOne({ _id: u._id }, { $set: { likedTrackIds: newLiked, playlists: newPlaylists } });
      usersUpdated++;
    }
  }
  console.log(`Updated ${usersUpdated} users with remapped trackIds.`);

  // Delete duplicates from Track collection
  const delRes = await Track.deleteMany({ _id: { $in: dupIdsToDelete } });
  console.log(`Successfully deleted ${delRes.deletedCount} duplicate track documents!`);

  // Verify remaining Quran tracks count
  const remainingQuran = await Track.find({
    $or: [
      { isQuran: true },
      { genre: 'Quran' },
      { artist: /منشاوي|عفاسي|حصري|دوسري|قرآن|قران/i },
      { title: /سورة|سوره|قرآن|قران/i }
    ]
  }).lean();
  console.log(`Total remaining distinct Quran tracks: ${remainingQuran.length}`);

  const remainingAfasy = remainingQuran.filter(t => /عفاسي|afasy/i.test((t.artist||'') + ' ' + (t.title||'')));
  console.log(`Remaining Afasy recitations: ${remainingAfasy.length}`);

  const remainingMinshawi = remainingQuran.filter(t => /منشاوي|minshawi/i.test((t.artist||'') + ' ' + (t.title||'')));
  console.log(`Remaining Minshawi recitations: ${remainingMinshawi.length}`);

  process.exit(0);
})();
"""

local_tmp = os.path.join(os.path.dirname(__file__), 'temp_dedup.js')
with open(local_tmp, 'w', encoding='utf-8') as f:
    f.write(script)

subprocess.run(["scp", "-i", KEY, "-o", "StrictHostKeyChecking=no", "-o", "BatchMode=yes", "-o", "ConnectTimeout=10", local_tmp, f"{HOST}:/home/ubuntu/rivo/temp_dedup.js"], check=True)
res = subprocess.run(["ssh", "-i", KEY, "-o", "StrictHostKeyChecking=no", "-o", "BatchMode=yes", "-o", "ConnectTimeout=10", HOST, "NODE_PATH=/home/ubuntu/rivo/server/node_modules node /home/ubuntu/rivo/temp_dedup.js"], capture_output=True, text=True, encoding='utf-8')
print("OUTPUT:\n", res.stdout, flush=True)
if res.stderr:
    print("STDERR:\n", res.stderr, flush=True)

subprocess.run(["ssh", "-i", KEY, "-o", "StrictHostKeyChecking=no", "-o", "BatchMode=yes", "-o", "ConnectTimeout=10", HOST, "rm -f /home/ubuntu/rivo/temp_dedup.js"])
if os.path.exists(local_tmp):
    os.remove(local_tmp)
