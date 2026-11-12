const mongoose = require('mongoose');
require('dotenv').config({ path: '/home/ubuntu/rivo/.env' });

function cleanTitle(str) {
  let s = String(str || '').toLowerCase();
  s = s.replace(/\s*\(feat\.[^)]+\)/gi, '');
  s = s.replace(/\s*\(with[^)]+\)/gi, '');
  s = s.replace(/\s*\(official[^)]*\)/gi, '');
  s = s.replace(/\s*\(lyrics?[^)]*\)/gi, '');
  s = s.replace(/\s*\(video[^)]*\)/gi, '');
  s = s.replace(/\s*\[official[^\]]*\]/gi, '');
  s = s.replace(/\s*\[video[^\]]*\]/gi, '');
  s = s.replace(/\s*-\s*official\b/gi, '');
  s = s.replace(/\s*-\s*video\b/gi, '');
  s = s.replace(/\s*-\s*lyrics?\b/gi, '');
  s = s.replace(/\s*-\s*music video\b/gi, '');
  s = s.replace(/\s*-\s*audio\b/gi, '');
  s = s.replace(/\s*-\s*كليب\b/gi, '');
  s = s.replace(/\s*-\s*فيديو كليب\b/gi, '');
  s = s.replace(/\s*\(كليب[^)]*\)/gi, '');
  s = s.replace(/\s*\(فيديو كليب[^)]*\)/gi, '');
  s = s.replace(/^(cairokee|marwan pablo|el joker|amr diab|wegz|tamer hosny|lege-cy)\s*[-–—:]\s*/gi, '');
  s = s.replace(/\s*[-–—:]\s*(cairokee|marwan pablo|el joker|amr diab|wegz|tamer hosny|lege-cy)$/gi, '');
  s = s.replace(/^(كايروكي|مروان بابلو|الجوكر|عمرو دياب|ويجز|تامر حسني|ليجي سي)\s*[-–—:]\s*/gi, '');
  s = s.replace(/\s*[-–—:]\s*(كايروكي|مروان بابلو|الجوكر|عمرو دياب|ويجز|تامر حسني|ليجي سي)$/gi, '');
  s = s.replace(/[/\\?%*:|"<>_()\-–—]/g, ' ').replace(/\s+/g, ' ').trim();
  return s;
}

function normalizeArtist(artist) {
  let clean = String(artist || '').toLowerCase().trim();
  if (clean.includes('cairokee') || clean.includes('كايروكي')) return 'Cairokee';
  if (clean.includes('pablo') || clean.includes('بابلو')) return 'Marwan Pablo';
  if (clean.includes('joker') || clean.includes('الجوكر')) return 'El Joker';
  if (clean.includes('diab') || clean.includes('عمرو دياب') || clean === 'rotana') return 'Amr Diab';
  if (clean.includes('wegz') || clean.includes('ويجز')) return 'Wegz';
  if (clean.includes('lege-cy') || clean.includes('ليجي')) return 'Lege-Cy';
  if (clean.includes('hosny') || clean.includes('تامر حسني')) return 'Tamer Hosny';
  return artist ? artist.trim() : 'Unknown';
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB for Track Deduplication & Cairokee Profile Merge');

  const Track = mongoose.connection.db.collection('tracks');
  const Artist = mongoose.connection.db.collection('artists');
  const Album = mongoose.connection.db.collection('albums');
  const SongLyrics = mongoose.connection.db.collection('songlyrics');

  // 1. MERGE CAIROKEE PROFILES IN ARTISTS COLLECTION
  console.log('\n--- 1. Unifying Cairokee Artist Profiles ---');
  const cairokeeProfiles = await Artist.find({
    $or: [
      { id: /cairokee/i },
      { name: /cairokee/i },
      { name: /كايروكي/i }
    ]
  }).toArray();

  console.log(`Found ${cairokeeProfiles.length} Cairokee profiles in Artist collection.`);
  let primaryCairokee = cairokeeProfiles.find(a => a.id === 'cairokee') || cairokeeProfiles[0];

  if (!primaryCairokee) {
    const newId = new mongoose.Types.ObjectId();
    primaryCairokee = {
      _id: newId,
      id: 'cairokee',
      name: 'Cairokee',
      isVerified: true,
      avatar: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/7f/a0/00/7fa00086-e72c-191b-6547-e8992f774a9a/885288056853.jpg/600x600bb.jpg',
      bio: 'Egyptian rock band formed in 2003, widely recognized for revolutionizing contemporary Arabic indie and rock music.'
    };
    await Artist.insertOne(primaryCairokee);
    console.log('Created primary Cairokee profile.');
  } else {
    // Ensure primary profile has clean data
    await Artist.updateOne(
      { _id: primaryCairokee._id },
      {
        $set: {
          id: 'cairokee',
          name: 'Cairokee',
          isVerified: true,
          avatar: primaryCairokee.avatar || 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/7f/a0/00/7fa00086-e72c-191b-6547-e8992f774a9a/885288056853.jpg/600x600bb.jpg',
          bio: primaryCairokee.bio || 'Egyptian rock band formed in 2003, widely recognized for revolutionizing contemporary Arabic indie and rock music.'
        }
      }
    );
    // Delete any other duplicate Cairokee profiles
    const otherIds = cairokeeProfiles.filter(p => String(p._id) !== String(primaryCairokee._id)).map(p => p._id);
    if (otherIds.length > 0) {
      await Artist.deleteMany({ _id: { $in: otherIds } });
      console.log(`Deleted ${otherIds.length} duplicate Cairokee profiles.`);
    }
  }

  // 2. UNIFY ARTIST FIELD IN ALL COLLECTIONS
  console.log('\n--- 2. Unifying Cairokee Artist Field across Tracks & Lyrics ---');
  const fixArtistRes = await Track.updateMany(
    { artist: /^(cairokeeofficial|cairokee official|cairokeeoffical|كايروكي)$/i },
    { $set: { artist: 'Cairokee' } }
  );
  console.log(`Updated ${fixArtistRes.modifiedCount} tracks artist to 'Cairokee'.`);

  const fixLyricsRes = await SongLyrics.updateMany(
    { artist: /^(cairokeeofficial|cairokee official|cairokeeoffical|كايروكي)$/i },
    { $set: { artist: 'Cairokee' } }
  );
  console.log(`Updated ${fixLyricsRes.modifiedCount} song lyrics artist to 'Cairokee'.`);

  const fixAlbumsRes = await Album.updateMany(
    { artist: /^(cairokeeofficial|cairokee official|cairokeeoffical|كايروكي)$/i },
    { $set: { artist: 'Cairokee' } }
  );
  console.log(`Updated ${fixAlbumsRes.modifiedCount} albums artist to 'Cairokee'.`);

  // 3. TARGETED DEDUPLICATION: NESENA
  console.log('\n--- 3. Resolving Nesena Duplicate Tracks ---');
  const nesenaClips = await Track.find({
    $or: [
      { title: /Cairokee - Nesena كايروكي - نسينا/i },
      { title: /سوبرنوفا - نسينا - كايروكي/i },
      { _id: new mongoose.Types.ObjectId('6af4a4b28c1a21f9c408503f') },
      { _id: new mongoose.Types.ObjectId('6af4a5018c1a21f9c408515e') }
    ]
  }).toArray();

  if (nesenaClips.length > 0) {
    const ids = nesenaClips.map(t => t._id);
    await Track.deleteMany({ _id: { $in: ids } });
    console.log(`Deleted ${ids.length} inferior Nesena duplicate clips/snippets.`);
  }

  // Ensure the official Nesena track is in Supernova album with verified lyrics
  const officialNesena = await Track.findOne({
    title: new RegExp('^nesena$', 'i'),
    artist: 'Cairokee'
  });
  if (officialNesena) {
    await Track.updateOne(
      { _id: officialNesena._id },
      {
        $set: {
          album: 'Album - Supernova',
          verifiedLyrics: true,
          cover: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/7f/a0/00/7fa00086-e72c-191b-6547-e8992f774a9a/885288056853.jpg/600x600bb.jpg'
        }
      }
    );
    console.log(`Verified official Nesena track [${officialNesena._id}] linked to Album - Supernova.`);
  }

  // 4. SCAN AND PURGE REMAINING DUPLICATES & SNIPPETS ACROSS THE CATALOG
  console.log('\n--- 4. Scanning & Purging Inferior Duplicate Tracks ---');
  const allTracks = await Track.find({ isQuran: { $ne: true }, genre: { $ne: 'Holy Quran' } }).toArray();

  // Group tracks by canonical artist + cleaned base title
  const catalogGroups = {};
  for (const t of allTracks) {
    const normArt = normalizeArtist(t.artist);
    let base = cleanTitle(t.title);
    // Remove Arabic sub-title if both present (e.g. "nesena كايروكي نسينا" -> "nesena")
    if (base.includes('nesena')) base = 'nesena';
    if (base.includes('qusada') || base.includes('قصاد عيني') || base.includes('qusad')) base = 'qusadeiny';
    if (base.includes('telk qadeya') || base.includes('تلك قضية')) base = 'telkqadeya';

    const key = `${normArt}:::${base}`;
    if (!catalogGroups[key]) catalogGroups[key] = [];
    catalogGroups[key].push(t);
  }

  let totalDeletedDuplicates = 0;

  for (const [key, list] of Object.entries(catalogGroups)) {
    if (list.length > 1) {
      console.log(`\nEvaluating group: "${key}" (${list.length} tracks):`);
      
      // Score each track to find the best official album master
      list.sort((a, b) => {
        let scoreA = 0;
        let scoreB = 0;

        // Prefer official album over YouTube or empty
        const aHasAlbum = a.album && !['youtube', '', 'single', 'null'].includes(a.album.toLowerCase().trim());
        const bHasAlbum = b.album && !['youtube', '', 'single', 'null'].includes(b.album.toLowerCase().trim());
        if (aHasAlbum && !bHasAlbum) scoreA += 50;
        if (!aHasAlbum && bHasAlbum) scoreB += 50;

        // Prefer verified lyrics
        if (a.verifiedLyrics && !b.verifiedLyrics) scoreA += 30;
        if (!a.verifiedLyrics && b.verifiedLyrics) scoreB += 30;

        // Prefer has any lyrics
        if (a.lyrics?.length && !b.lyrics?.length) scoreA += 20;
        if (!a.lyrics?.length && b.lyrics?.length) scoreB += 20;

        // Penalize short snippets (< 60s)
        if (a.duration < 60) scoreA -= 100;
        if (b.duration < 60) scoreB -= 100;

        // Penalize raw YouTube video titles
        if (a.title.includes('Official Video') || a.title.includes('فيديو كليب') || a.album === 'YouTube') scoreA -= 25;
        if (b.title.includes('Official Video') || b.title.includes('فيديو كليب') || b.album === 'YouTube') scoreB -= 25;

        // Prefer higher plays
        scoreA += (a.plays || 0) * 0.01;
        scoreB += (b.plays || 0) * 0.01;

        return scoreB - scoreA;
      });

      const master = list[0];
      const duplicatesToDelete = list.slice(1);

      console.log(`  -> KEEPING MASTER: [${master._id}] "${master.title}" (album: "${master.album}", lyrics: ${Boolean(master.lyrics?.length)})`);

      for (const dup of duplicatesToDelete) {
        // If master has no lyrics but duplicate has lyrics, copy them over!
        if (!master.lyrics?.length && dup.lyrics?.length) {
          await Track.updateOne({ _id: master._id }, { $set: { lyrics: dup.lyrics, hasLyrics: true } });
          console.log(`     Transferred lyrics from duplicate [${dup._id}] to master [${master._id}]`);
        }
        await Track.deleteMany({ _id: dup._id });
        console.log(`  ❌ DELETED DUPLICATE: [${dup._id}] "${dup.title}" (album: "${dup.album}", dur: ${dup.duration}s)`);
        totalDeletedDuplicates++;
      }
    }
  }

  console.log(`\n✅ Finished track deduplication. Total duplicate tracks deleted: ${totalDeletedDuplicates}`);
  await mongoose.disconnect();
}

main().catch(console.error);
