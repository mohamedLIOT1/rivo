require('./server/node_modules/dotenv').config({ path: '/home/ubuntu/rivo/.env' });
const mongoose = require('./server/node_modules/mongoose');
const Track = mongoose.model('Track', new mongoose.Schema({}, { strict: false }));
const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));

function normalizeArtist(artist) {
  if (!artist) return '';
  let a = artist.trim().toLowerCase();
  a = a.replace(/official$/i, '').trim();
  return a;
}

function normalizeTitle(title) {
  if (!title) return '';
  let t = title.trim().toLowerCase();
  // remove trailing (official audio), (official video), [official audio], etc.
  t = t.replace(/\s*[\(\[](official\s*(audio|video|music\s*video|visualizer)?|audio|video)[\)\]]/gi, '').trim();
  t = t.replace(/\s+/g, ' ');
  return t;
}

async function run() {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  const tracks = await Track.find({}).lean();
  console.log(`Total tracks in DB: ${tracks.length}`);

  const groups = new Map();

  for (const t of tracks) {
    // If it's a Quran recitation, keep surah intact (reciter is artist)
    const normTitle = normalizeTitle(t.title);
    const normArtist = normalizeArtist(t.artist);
    const key = `${normTitle}:::${normArtist}`;

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(t);
  }

  let duplicateGroupsCount = 0;
  let totalRedundantTracks = 0;

  for (const [key, list] of groups.entries()) {
    if (list.length > 1) {
      duplicateGroupsCount++;
      totalRedundantTracks += (list.length - 1);
    }
  }

  console.log(`Duplicate groups count: ${duplicateGroupsCount}`);
  console.log(`Total redundant tracks to remove: ${totalRedundantTracks}`);
  console.log(`Remaining canonical tracks after cleanup: ${tracks.length - totalRedundantTracks}`);

  // Print first 10 duplicate groups
  let printed = 0;
  for (const [key, list] of groups.entries()) {
    if (list.length > 1 && printed < 10) {
      printed++;
      console.log(`\nGroup: "${key}" (${list.length} tracks):`);
      for (const item of list) {
        console.log(`  - [${item._id}] "${item.title}" by "${item.artist}" | album: "${item.album || ''}" | plays: ${item.plays || 0} | cover: ${Boolean(item.cover || item.coverUrl)} | audioUrl: ${item.audioUrl || item.url || ''}`);
      }
    }
  }

  process.exit(0);
}
run();
