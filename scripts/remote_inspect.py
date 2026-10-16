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
(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const { Album, Track, User } = require('/home/ubuntu/rivo/server/models');
  
  // Find all Quran tracks
  const quranTracks = await Track.find({
    $or: [
      { isQuran: true },
      { genre: 'Quran' },
      { artist: /منشاوي|عفاسي|حصري|دوسري|قرآن|قران/i },
      { title: /سورة|سوره|قرآن|قران/i }
    ]
  }).lean();
  console.log('Total Quran tracks found:', quranTracks.length);

  // Group by canonical key: audioUrl if present, or normalized (title + reciter)
  const groups = new Map();
  for (const t of quranTracks) {
    let key = '';
    if (t.audioUrl && t.audioUrl.length > 10) {
      // Normalize youtube url: extract video id if youtube
      const ytMatch = t.audioUrl.match(/[?&]v=([a-zA-Z0-9_-]{11})/) || t.audioUrl.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
      if (ytMatch) {
        key = 'yt:' + ytMatch[1];
      } else {
        key = 'url:' + t.audioUrl.trim().toLowerCase();
      }
    } else {
      key = 'name:' + (t.artist || '').trim().toLowerCase() + ':::' + (t.title || '').trim().toLowerCase();
    }

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(t);
  }

  let dupGroups = 0;
  let excessTracks = 0;
  for (const [key, list] of groups.entries()) {
    if (list.length > 1) {
      dupGroups++;
      excessTracks += (list.length - 1);
    }
  }
  console.log(`Duplicate groups: ${dupGroups}, Excess duplicate tracks to remove: ${excessTracks}`);

  // Check how many are referenced by Albums or Users
  const allAlbums = await Album.find().lean();
  const allUsers = await User.find().lean();

  const albumTrackIds = new Set();
  allAlbums.forEach(a => (a.trackIds || []).forEach(id => albumTrackIds.add(String(id))));

  const userTrackIds = new Set();
  allUsers.forEach(u => {
    (u.likedTrackIds || []).forEach(id => userTrackIds.add(String(id)));
    (u.playlists || []).forEach(pl => (pl.trackIds || []).forEach(id => userTrackIds.add(String(id))));
  });

  console.log('Total distinct track IDs in Albums:', albumTrackIds.size);
  console.log('Total distinct track IDs in Users:', userTrackIds.size);

  process.exit(0);
})();
"""

local_tmp = os.path.join(os.path.dirname(__file__), 'temp_inspect.js')
with open(local_tmp, 'w', encoding='utf-8') as f:
    f.write(script)

subprocess.run(["scp", "-i", KEY, "-o", "StrictHostKeyChecking=no", "-o", "BatchMode=yes", "-o", "ConnectTimeout=10", local_tmp, f"{HOST}:/home/ubuntu/rivo/temp_inspect.js"], check=True)
res = subprocess.run(["ssh", "-i", KEY, "-o", "StrictHostKeyChecking=no", "-o", "BatchMode=yes", "-o", "ConnectTimeout=10", HOST, "NODE_PATH=/home/ubuntu/rivo/server/node_modules node /home/ubuntu/rivo/temp_inspect.js"], capture_output=True, text=True, encoding='utf-8')
print("OUTPUT:\n", res.stdout, flush=True)
if res.stderr:
    print("STDERR:\n", res.stderr, flush=True)

subprocess.run(["ssh", "-i", KEY, "-o", "StrictHostKeyChecking=no", "-o", "BatchMode=yes", "-o", "ConnectTimeout=10", HOST, "rm -f /home/ubuntu/rivo/temp_inspect.js"])
if os.path.exists(local_tmp):
    os.remove(local_tmp)
