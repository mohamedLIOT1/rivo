const mongoose = require('mongoose');
require('dotenv').config({ path: '/home/ubuntu/rivo/.env' });

function normalizeTitle(title) {
  let clean = String(title || '').toLowerCase();
  clean = clean.replace(/\s*\(feat\.[^)]+\)/gi, '');
  clean = clean.replace(/\s*\(with[^)]+\)/gi, '');
  clean = clean.replace(/\s*\(official[^)]*\)/gi, '');
  clean = clean.replace(/\s*\(video[^)]*\)/gi, '');
  clean = clean.replace(/\s*\[official[^\]]*\]/gi, '');
  clean = clean.replace(/\s*\[video[^\]]*\]/gi, '');
  clean = clean.replace(/\s*-\s*official\b/gi, '');
  clean = clean.replace(/\s*-\s*video\b/gi, '');
  clean = clean.replace(/\s*-\s*music video\b/gi, '');
  clean = clean.replace(/\s*-\s*audio\b/gi, '');
  clean = clean.replace(/\s*-\s*كليب\b/gi, '');
  clean = clean.replace(/\s*-\s*فيديو كليب\b/gi, '');
  clean = clean.replace(/\s*\(كليب[^)]*\)/gi, '');
  clean = clean.replace(/\s*\(فيديو كليب[^)]*\)/gi, '');
  clean = clean.replace(/^(cairokee|marwan pablo|el joker|amr diab|wegz|tamer hosny|lege-cy)\s*[-–—:]\s*/gi, '');
  clean = clean.replace(/\s*[-–—:]\s*(cairokee|marwan pablo|el joker|amr diab|wegz|tamer hosny|lege-cy)$/gi, '');
  clean = clean.replace(/^(كايروكي|مروان بابلو|الجوكر|عمرو دياب|ويجز|تامر حسني|ليجي سي)\s*[-–—:]\s*/gi, '');
  clean = clean.replace(/\s*[-–—:]\s*(كايروكي|مروان بابلو|الجوكر|عمرو دياب|ويجز|تامر حسني|ليجي سي)$/gi, '');
  // normalize spaces and punctuation
  clean = clean.replace(/[/\\?%*:|"<>_()\-–—]/g, ' ').replace(/\s+/g, ' ').trim();
  return clean;
}

function normalizeArtist(artist) {
  let clean = String(artist || '').toLowerCase().trim();
  if (clean.includes('cairokee') || clean.includes('كايروكي')) return 'cairokee';
  if (clean.includes('pablo') || clean.includes('بابلو')) return 'marwan pablo';
  if (clean.includes('joker') || clean.includes('الجوكر')) return 'el joker';
  if (clean.includes('diab') || clean.includes('عمرو دياب')) return 'amr diab';
  if (clean.includes('wegz') || clean.includes('ويجز')) return 'wegz';
  if (clean.includes('lege-cy') || clean.includes('ليجي')) return 'lege-cy';
  if (clean.includes('hosny') || clean.includes('تامر حسني')) return 'tamer hosny';
  return clean;
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const Track = mongoose.connection.db.collection('tracks');

  const allTracks = await Track.find({}).toArray();
  console.log(`Analyzing ${allTracks.length} tracks for duplicates...`);

  // Group by normalizedArtist + normalizedTitle
  const groups = {};
  for (const t of allTracks) {
    // Skip Quran
    if (t.isQuran || t.genre === 'Holy Quran') continue;

    const normArt = normalizeArtist(t.artist);
    const normTit = normalizeTitle(t.title);
    if (!normTit) continue;

    const key = `${normArt}:::${normTit}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  }

  const duplicates = Object.entries(groups).filter(([k, list]) => list.length > 1);
  console.log(`Found ${duplicates.length} duplicate groups!`);

  for (const [key, list] of duplicates.slice(0, 15)) {
    console.log(`\nGroup: "${key}" (${list.length} tracks):`);
    list.forEach(t => {
      console.log(`  - [${t._id}] "${t.title}" | artist: "${t.artist}" | album: "${t.album}" | duration: ${t.duration}s | lyrics: ${Boolean(t.lyrics?.length)} | verified: ${Boolean(t.verifiedLyrics)}`);
    });
  }

  await mongoose.disconnect();
}
main().catch(console.error);
