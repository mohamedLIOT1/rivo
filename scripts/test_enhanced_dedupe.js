require('./server/node_modules/dotenv').config({ path: '/home/ubuntu/rivo/.env' });
const mongoose = require('./server/node_modules/mongoose');

const Track = mongoose.model('Track', new mongoose.Schema({}, { strict: false }));

function normalizeTitle(title) {
  if (!title) return '';
  let t = title.trim().toLowerCase();
  t = t.replace(/\s*[\(\[](official\s*(audio|video|music\s*video|visualizer)?|audio|video)[\)\]]/gi, '').trim();
  t = t.replace(/\s+/g, ' ');
  return t;
}

function getPrimaryArtist(artist) {
  if (!artist) return '';
  let a = artist.trim().toLowerCase();
  // Remove topic suffixes
  a = a.replace(/\s*-\s*topic$/i, '').trim();
  a = a.replace(/official$/i, '').trim();
  // Split on commas, feat, ft, &, x, مع, and non-breaking spaces
  const parts = a.split(/,|\s+feat\.?\s+|\s+ft\.?\s+|\s+&\s+|\s+x\s+|\s+مع\s+/i);
  let primary = (parts[0] || '').trim();
  // remove Arabic or English duplicate e.g. "shehab - شهاب"
  if (primary.includes(' - ')) {
    primary = primary.split(' - ')[0].trim();
  }
  return primary.replace(/\s+/g, ' ');
}

async function inspect() {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  const allTracks = await Track.find({}).lean();
  console.log(`Total tracks in DB: ${allTracks.length}`);

  const groups = new Map();
  for (const t of allTracks) {
    const normTitle = normalizeTitle(t.title);
    const primArtist = getPrimaryArtist(t.artist);
    const key = `${normTitle}:::${primArtist}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(t);
  }

  let dupesCount = 0;
  for (const [key, list] of groups.entries()) {
    if (list.length > 1) {
      dupesCount++;
      console.log(`Duplicate group [${key}]:`);
      for (const t of list) {
        console.log(`   -> id: ${t._id} | title: "${t.title}" | artist: "${t.artist}" | album: "${t.album}"`);
      }
    }
  }
  console.log(`\nFound ${dupesCount} duplicate groups with primary artist matching!`);
  process.exit(0);
}
inspect();
