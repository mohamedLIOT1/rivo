const mongoose = require('mongoose');
require('dotenv').config({ path: '/home/ubuntu/rivo/.env' });

function cleanArtist(a) {
  if (!a) return '';
  return String(a)
    .toLowerCase()
    .replace(/official/gi, '')
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanTitle(t) {
  if (!t) return '';
  let str = String(t).trim();

  // Remove common prefixes/suffixes
  str = str.replace(/\s*\(feat\.[^)]+\)/gi, '')
           .replace(/\s*\(ft\.[^)]+\)/gi, '')
           .replace(/\s*\[[^\]]+\]/gi, '')
           .replace(/\s*-\s*(official\s*(music\s*)?video|video|audio|lyric\s*video|كليب|فيديو\s*كليب|الرسمي|أوديو|كلمات).*/gi, '');

  // Strip artist from title
  const knownArtists = ['cairokee', 'amr diab', 'wegz', 'marwan pablo', 'marwan moussa', 'el joker', 'tamer hosny', 'ziad zaza', 'abyusif', 'lege-cy', 'كايروكي', 'عمرو دياب', 'ويجز', 'مروان بابلو', 'مروان موسى', 'الجوكر', 'تامر حسني', 'زياد ظاظا', 'ابيوسف', 'ليجي سي'];
  for (const ka of knownArtists) {
    const regPre = new RegExp(`^${ka}\\s*[-–—:]\\s*`, 'i');
    const regPost = new RegExp(`\\s*[-–—:]\\s*${ka}$`, 'i');
    str = str.replace(regPre, '').replace(regPost, '');
  }

  // If title has "English - Arabic" e.g. "Nesena - نسينا" or "Nesena كايروكي - نسينا"
  // Extract tokens
  return str.toLowerCase().replace(/[/\\?%*:|"<>_()\-]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Arabic transliterations & aliases
const TITLE_ALIASES = [
  ['nesena', 'نسينا'],
  ['roma', 'روما'],
  ['el neyya', 'النية', 'النيه'],
  ['barbary', 'بربري'],
  ['dorak gai', 'دورك جاي'],
  ['makanak', 'مكانك'],
  ['sahran', 'سهران'],
  ['amarain', 'قمرين'],
  ['ahla w ahla', 'أحلى وأحلى', 'احلى و احلى'],
  ['meaddy el nas', 'معدي الناس', 'معدى الناس'],
  ['allem alby', 'علم قلبي', 'علم قلبى'],
  ['tamally maak', 'تملي معاك'],
  ['ya ana ya la', 'يا انا يا لا', 'يا أنا يا لأ'],
  ['kol hayaty', 'كل حياتي'],
  ['placebo', 'بلاسيبو'],
  ['fantazia', 'فانتازيا'],
  ['supernova', 'سوبرنوفا']
];

function getCanonicalTitle(title) {
  const norm = cleanTitle(title);
  for (const group of TITLE_ALIASES) {
    for (const alias of group) {
      if (norm.includes(alias)) {
        return group[0]; // canonical English
      }
    }
  }
  return norm;
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const Track = mongoose.connection.db.collection('tracks');

  const allTracks = await Track.find({}).toArray();
  console.log(`Analyzing ${allTracks.length} tracks with advanced title canonicalization...`);

  const groups = new Map();
  for (const tr of allTracks) {
    const isQuran = tr.isQuran || tr.genre === 'Holy Quran' || tr.artist?.includes('الحصري') || tr.artist?.includes('العفاسي') || tr.artist?.includes('عبد الباسط');
    if (isQuran) continue;

    const art = cleanArtist(tr.artist);
    const canonTitle = getCanonicalTitle(tr.title);
    if (!canonTitle) continue;

    const key = `${art}:::${canonTitle}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(tr);
  }

  let dupCount = 0;
  let tracksToDelete = [];

  for (const [key, list] of groups.entries()) {
    if (list.length > 1) {
      dupCount++;
      const scored = list.map(t => {
        let score = 0;
        const alb = String(t.album || '').toLowerCase();
        const dur = Number(t.duration || 0);

        if (alb && alb !== 'youtube' && alb !== 'single') score += 50;
        if (t.lyricsVerified) score += 30;
        if (t.lyrics && t.lyrics.length > 50) score += 15;
        if (t.cover && !t.cover.includes('hqdefault.jpg')) score += 10;
        if (dur >= 100) score += 10;
        if (dur < 60) score -= 100; // Snippet penalty
        if (alb === 'youtube') score -= 25;
        if (String(t.title).includes('كليب') || String(t.title).toLowerCase().includes('video')) score -= 20;

        return { track: t, score };
      });

      scored.sort((a, b) => b.score - a.score);
      const winner = scored[0].track;
      const losers = scored.slice(1);

      console.log(`\nGroup: [${key}] (${list.length} tracks)`);
      console.log(`  [KEEP]   _id: ${winner._id} | Title: "${winner.title}" | Artist: "${winner.artist}" | Album: "${winner.album}" | Dur: ${winner.duration}s | Score: ${scored[0].score}`);
      for (const l of losers) {
        console.log(`  [DELETE] _id: ${l.track._id} | Title: "${l.track.title}" | Artist: "${l.track.artist}" | Album: "${l.track.album}" | Dur: ${l.track.duration}s | Score: ${l.score}`);
        tracksToDelete.push(l.track._id);
      }
    }
  }

  console.log(`\nFound ${dupCount} duplicate groups. Total redundant tracks to delete: ${tracksToDelete.length}`);
  await mongoose.disconnect();
}
main().catch(console.error);
