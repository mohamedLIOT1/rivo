/**
 * Deep Deduplication & Catalog Auditor Specialist
 * Rivo Music Platform - MongoDB Atlas
 * 
 * Deduplicates albums/EPs, tracks, updates track pointers, merges playlists/favorites,
 * isolates Quran, and applies official HD artwork.
 */

const dns = require('dns');
try { dns.setDefaultResultOrder('ipv4first'); } catch (e) {}
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (e) {}

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const { OFFICIAL_ALBUM_COVERS, CANONICAL_ALBUM_KEY_MAP } = require('./db_dedup_constants');

function normalizeArabic(str) {
  if (!str) return '';
  return str
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ|ئ/g, 'ء')
    .trim();
}

function normalizeArtist(raw) {
  const a = String(raw || '').trim().toLowerCase();
  if (a.includes('cairokee') || a.includes('كايروكي') || a.includes('amir eid') || a.includes('امير عيد')) return 'Cairokee';
  if (a.includes('pablo') || a.includes('بابلو')) return 'Marwan Pablo';
  if (a.includes('moussa') || a.includes('موسى') || a.includes('موسي')) return 'Marwan Moussa';
  if (a.includes('wegz') || a.includes('ويجز')) return 'Wegz';
  if (a.includes('lege-cy') || a.includes('ليجي')) return 'Lege-Cy';
  if (a.includes('diab') || a.includes('عمرو دياب')) return 'Amr Diab';
  if (a.includes('hosny') || a.includes('تامر حسني')) return 'Tamer Hosny';
  if (a.includes('ashour') || a.includes('تامر عاشور')) return 'Tamer Ashour';
  if (a.includes('hamaki') || a.includes('حماقي')) return 'Mohamed Hamaki';
  if (a.includes('sherine') || a.includes('شيرين')) return 'Sherine';
  if (a.includes('sabry') || a.includes('رامي صبري')) return 'Ramy Sabry';
  if (a.includes('angham') || a.includes('انغام') || a.includes('أنغام')) return 'Angham';
  if (a.includes('asala') || a.includes('اصالة') || a.includes('أصالة')) return 'Asala';
  if (a.includes('elissa') || a.includes('اليسا') || a.includes('إليسا')) return 'Elissa';
  if (a.includes('ajram') || a.includes('نانسي')) return 'Nancy Ajram';
  if (a.includes('sultan') || a.includes('بهاء سلطان')) return 'Bahaa Sultan';
  if (a.includes('jassar') || a.includes('وائل جسار')) return 'Wael Jassar';
  if (a.includes('tul8te') || a.includes('تووليت')) return 'Tul8te';
  if (a.includes('zaza') || a.includes('ظاظا')) return 'Ziad Zaza';
  if (a.includes('saad') || a.includes('احمد سعد') || a.includes('أحمد سعد')) return 'Ahmed Saad';
  if (a.includes('weeknd')) return 'The Weeknd';
  if (a.includes('sary hany') || a.includes('ساري هاني')) return 'Sary Hany';
  return raw ? raw.trim() : 'Unknown';
}

function normalizeAlbumTitle(raw) {
  if (!raw) return '';
  let s = String(raw).trim();
  s = s.replace(/^(?:album|ep|اللبوم|ألبوم|البوم|ميني البوم|ميني ألبوم)\s*[-–—:]\s*/gi, '');
  s = s.replace(/\s*-\s*EP\b/gi, '').replace(/\s*-\s*Single\b/gi, '').replace(/\s*-\s*Album\b/gi, '');
  s = s.replace(/\s*\((?:deluxe\s*edition|deluxe|side\s*[a-z]|ep|album|live|single|jazz\s*edition|original\s*score|remastered|نسخة\s*لايف|لايف|edici[oó]n\s*deluxe)\)/gi, '');
  s = s.replace(/\s*\[(?:deluxe\s*edition|deluxe|side\s*[a-z]|ep|album|live|single|jazz\s*edition|original\s*score|remastered)\]/gi, '');
  s = s.replace(/\s*-\s*(?:deluxe\s*edition|deluxe|ep|album|live|single)\b/gi, '');
  s = normalizeArabic(s).toLowerCase();
  s = s.replace(/['"`]/g, '').replace(/[^\w\s\u0600-\u06FF-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (CANONICAL_ALBUM_KEY_MAP[s]) return CANONICAL_ALBUM_KEY_MAP[s];
  return s;
}

function cleanTrackTitle(str) {
  let s = String(str || '').toLowerCase();
  s = s.replace(/\s*\(feat\.[^)]+\)/gi, '').replace(/\s*\(with[^)]+\)/gi, '');
  s = s.replace(/\s*\(official[^)]*\)/gi, '').replace(/\s*\(lyrics?[^)]*\)/gi, '').replace(/\s*\(video[^)]*\)/gi, '');
  s = s.replace(/\s*\[official[^\]]*\]/gi, '').replace(/\s*\[video[^\]]*\]/gi, '');
  s = s.replace(/\s*-\s*(?:official|video|lyrics?|music video|audio|كليب|فيديو كليب)\b/gi, '');
  s = s.replace(/\s*\((?:كليب|فيديو كليب)[^)]*\)/gi, '');
  s = normalizeArabic(s);
  s = s.replace(/[/\\?%*:|"<>_()\-–—]/g, ' ').replace(/\s+/g, ' ').trim();
  return s;
}

function upgradeCoverToHD(cover, albumKey) {
  if (albumKey && OFFICIAL_ALBUM_COVERS[albumKey]) return OFFICIAL_ALBUM_COVERS[albumKey];
  if (!cover || typeof cover !== 'string') return cover;
  const c = cover.trim();
  if (c.includes('googleusercontent.com') || c.includes('ggpht.com')) {
    return c.replace(/=w\d+-h\d+.*$/, '=w1200-h1200-l90-rj');
  }
  if (c.includes('mzstatic.com')) {
    return c.replace(/\/\d+x\d+bb\.(jpg|png|webp)/, '/1200x1200bb.$1');
  }
  return c;
}

async function runDeepDeduplication() {
  console.log('🚀 [Rivo Catalog Auditor] Starting Deep Database Deduplication...');
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 20000 });
  const db = mongoose.connection.db;
  const Album = db.collection('albums');
  const Track = db.collection('tracks');
  const User = db.collection('users');

  // PHASE 1: Strict Quran Isolation
  console.log('\n📖 [Phase 1] Isolating Quran tracks and verifying 0 Quran in albums...');
  const quranAlbumRes = await Album.deleteMany({
    $or: [{ isQuran: true }, { genre: 'Holy Quran' }, { name: /قرآن/i }, { name: /سورة/i }]
  });
  if (quranAlbumRes.deletedCount > 0) {
    console.log(`  Removed ${quranAlbumRes.deletedCount} misplaced Quran entries from albums.`);
  }

  const quranTrackRes = await Track.updateMany(
    { $or: [{ isQuran: true }, { genre: 'Holy Quran' }, { album: /المصحف|قرآن|سورة/i }] },
    { $set: { isQuran: true, album: 'القرآن الكريم', genre: 'Holy Quran' } }
  );
  console.log(`  Normalized ${quranTrackRes.modifiedCount} Quran tracks to isQuran: true & album: 'القرآن الكريم'.`);

  // PHASE 2: Album Cluster Deduplication
  console.log('\n💿 [Phase 2] Detecting and merging duplicate album clusters...');
  const allAlbums = await Album.find({}).toArray();
  const albumClusters = new Map();

  for (const a of allAlbums) {
    if (a.isQuran || a.genre === 'Holy Quran') continue;
    const normArt = normalizeArtist(a.artist);
    const normTit = normalizeAlbumTitle(a.name);
    if (!normTit) continue;
    const key = `${normArt}:::${normTit}`;
    if (!albumClusters.has(key)) albumClusters.set(key, []);
    albumClusters.get(key).push(a);
  }

  let mergedAlbumClusters = 0;
  let totalDeletedAlbums = 0;

  for (const [key, group] of albumClusters.entries()) {
    if (group.length <= 1) continue;
    mergedAlbumClusters++;

    // Pick canonical winner
    group.sort((a, b) => {
      const countA = Math.max(a.trackCount || 0, a.tracks?.length || 0, a.trackIds?.length || 0);
      const countB = Math.max(b.trackCount || 0, b.tracks?.length || 0, b.trackIds?.length || 0);
      if (countB !== countA) return countB - countA;
      const scoreC = (c) => (c || '').includes('1200x1200') ? 3 : (c || '').includes('mzstatic') ? 2 : 1;
      const csDiff = scoreC(b.cover) - scoreC(a.cover);
      if (csDiff !== 0) return csDiff;
      const aPref = /^album\s*[-–—:]/i.test(a.name || '');
      const bPref = /^album\s*[-–—:]/i.test(b.name || '');
      if (aPref && !bPref) return 1;
      if (!aPref && bPref) return -1;
      return 0;
    });

    const winner = group[0];
    const duplicates = group.slice(1);
    const albumKey = key.split(':::')[1];

    winner.name = winner.name.replace(/^(?:Album|EP|ألبوم|اللبوم)\s*[-–—:]\s*/i, '').trim();
    winner.artist = normalizeArtist(winner.artist);
    winner.cover = upgradeCoverToHD(winner.cover, albumKey);

    const mergedTrackMap = new Map();
    for (const t of (winner.tracks || [])) {
      const tKey = cleanTrackTitle(t.title || t.name);
      if (tKey) mergedTrackMap.set(tKey, t);
    }

    for (const d of duplicates) {
      for (const t of (d.tracks || [])) {
        const tKey = cleanTrackTitle(t.title || t.name);
        if (tKey && !mergedTrackMap.has(tKey)) {
          mergedTrackMap.set(tKey, { ...t, album: winner.name });
        }
      }
    }

    const unifiedTracks = Array.from(mergedTrackMap.values());
    const unifiedTrackIds = unifiedTracks.map(t => t.id).filter(Boolean);
    const winnerId = winner.id || winner._id.toString();

    await Album.updateOne(
      { _id: winner._id },
      {
        $set: {
          name: winner.name,
          artist: winner.artist,
          cover: winner.cover,
          tracks: unifiedTracks,
          trackIds: unifiedTrackIds,
          trackCount: unifiedTracks.length
        }
      }
    );

    const dupNames = duplicates.map(d => d.name);
    const dupIds = duplicates.map(d => d.id).filter(Boolean);
    const dupObjectIds = duplicates.map(d => d._id.toString());

    await Track.updateMany(
      { $or: [{ album: { $in: dupNames } }, { albumId: { $in: [...dupIds, ...dupObjectIds] } }] },
      { $set: { album: winner.name, albumId: winnerId } }
    );

    const deleteIds = duplicates.map(d => d._id);
    await Album.deleteMany({ _id: { $in: deleteIds } });
    totalDeletedAlbums += deleteIds.length;

    console.log(`  Merged Cluster "${key}": Winner "${winner.name}" (${unifiedTracks.length} tracks). Removed ${deleteIds.length} duplicate album docs.`);
  }

  // PHASE 3: Deduplicate tracks collection
  console.log('\n🎵 [Phase 3] Deduplicating tracks in "tracks" collection...');
  const allTracks = await Track.find({}, {
    projection: { _id: 1, title: 1, artist: 1, album: 1, albumId: 1, plays: 1, duration: 1, audioUrl: 1, youtubeId: 1, isQuran: 1, genre: 1, cover: 1 }
  }).toArray();

  const trackGroups = new Map();
  for (const t of allTracks) {
    if (t.isQuran || t.genre === 'Holy Quran') continue;
    const normArt = normalizeArtist(t.artist);
    const normTit = cleanTrackTitle(t.title);
    if (!normTit) continue;
    const key = `${normArt}:::${normTit}`;
    if (!trackGroups.has(key)) trackGroups.set(key, []);
    trackGroups.get(key).push(t);
  }

  let mergedTrackClusters = 0;
  let totalDeletedTracks = 0;

  for (const [key, group] of trackGroups.entries()) {
    if (group.length <= 1) continue;
    mergedTrackClusters++;

    group.sort((a, b) => {
      const score = (t) => {
        let s = 0;
        if (t.duration && t.duration > 30) s += 30;
        if (t.plays) s += Math.min(t.plays, 50);
        if (t.album && t.album !== 'Unknown') s += 10;
        return s;
      };
      return score(b) - score(a);
    });

    const winnerTrack = group[0];
    const loserTracks = group.slice(1);
    const winnerIdStr = winnerTrack._id.toString();

    let totalPlays = winnerTrack.plays || 0;
    const updates = {};
    for (const l of loserTracks) {
      if (l.plays) totalPlays += l.plays;
      if (!winnerTrack.duration && l.duration) {
        winnerTrack.duration = l.duration;
        updates.duration = l.duration;
      }
    }
    updates.plays = totalPlays;
    await Track.updateOne({ _id: winnerTrack._id }, { $set: updates });

    const loserIdStrs = loserTracks.map(l => l._id.toString());
    for (const lId of loserIdStrs) {
      await User.updateMany(
        { likedTrackIds: lId },
        { $set: { "likedTrackIds.$[elem]": winnerIdStr } },
        { arrayFilters: [{ elem: lId }] }
      );
      await User.updateMany(
        { "playlists.trackIds": lId },
        { $set: { "playlists.$[].trackIds.$[elem]": winnerIdStr } },
        { arrayFilters: [{ elem: lId }] }
      );
    }

    const loserIds = loserTracks.map(l => l._id);
    await Track.deleteMany({ _id: { $in: loserIds } });
    totalDeletedTracks += loserIds.length;
  }

  // Deduplicate array references inside users
  const usersWithPlaylists = await User.find({
    $or: [{ likedTrackIds: { $exists: true, $ne: [] } }, { playlists: { $exists: true, $ne: [] } }]
  }).toArray();

  for (const u of usersWithPlaylists) {
    let dirty = false;
    let newLiked = u.likedTrackIds;
    if (Array.isArray(newLiked)) {
      const dedupLiked = [...new Set(newLiked)];
      if (dedupLiked.length !== newLiked.length) {
        newLiked = dedupLiked;
        dirty = true;
      }
    }
    const newPlaylists = (u.playlists || []).map(p => {
      if (Array.isArray(p.trackIds)) {
        const dedup = [...new Set(p.trackIds)];
        if (dedup.length !== p.trackIds.length) {
          dirty = true;
          return { ...p, trackIds: dedup };
        }
      }
      return p;
    });
    if (dirty) {
      await User.updateOne({ _id: u._id }, { $set: { likedTrackIds: newLiked, playlists: newPlaylists } });
    }
  }

  // PHASE 4: Final Database Health & Verification
  const finalAlbumCount = await Album.countDocuments();
  const finalTrackCount = await Track.countDocuments();
  const finalQuranAlbumCount = await Album.countDocuments({
    $or: [{ isQuran: true }, { genre: 'Holy Quran' }]
  });

  console.log('\n======================================================');
  console.log('🏁 [Deduplication Audit Complete Summary]');
  console.log(`- Merged Album Clusters: ${mergedAlbumClusters} clusters (Deleted ${totalDeletedAlbums} redundant albums)`);
  console.log(`- Merged Track Clusters: ${mergedTrackClusters} clusters (Deleted ${totalDeletedTracks} redundant tracks)`);
  console.log(`- Final Albums Count: ${finalAlbumCount}`);
  console.log(`- Final Tracks Count: ${finalTrackCount}`);
  console.log(`- Quran Albums in Music Collection: ${finalQuranAlbumCount} (Strictly 0 Requirement Met: ${finalQuranAlbumCount === 0})`);
  console.log('======================================================\n');

  await mongoose.disconnect();
  console.log('✅ Disconnected cleanly from MongoDB Atlas. Exiting process.');
  process.exit(0);
}

runDeepDeduplication().catch(err => {
  console.error('❌ [Fatal Error during Deduplication]:', err);
  process.exit(1);
});
