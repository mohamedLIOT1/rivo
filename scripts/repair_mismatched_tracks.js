const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

// Load env
const envPaths = [
  path.resolve(__dirname, '../.env'),
  '/home/ubuntu/rivo/.env',
  path.resolve(process.cwd(), '.env')
];
for (const p of envPaths) {
  try {
    dotenv.config({ path: p });
  } catch (e) {}
}

async function repairMismatchedTracks() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('❌ MONGO_URI not found in environment.');
    process.exit(1);
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB successfully.');

  const db = mongoose.connection.db;
  const Track = db.collection('tracks');
  const Album = db.collection('albums');

  let repairedCount = 0;

  // 1. Repair "الخط ده خطي" (El Khat Dah Khatty) - Cairokee
  console.log('--- Checking "الخط ده خطي" / "El Khat Dah Khatty" ---');
  const elKhatTracks = await Track.find({
    $or: [
      { title: /الخط ده خطي/i },
      { title: /الخط دة خطى/i },
      { title: /el khat/i }
    ]
  }).toArray();

  for (const t of elKhatTracks) {
    console.log(`Found El Khat track: [${t._id}] "${t.title}" | Artist: "${t.artist}" | Dur: ${t.duration}s | AudioUrl: ${t.audioUrl}`);
    // Official Cairokee audio ID for El Khat Dah Khatty: qAq_b3cwBwk or dgeIISJGhMs (309s)
    const officialId = 'qAq_b3cwBwk';
    const officialDur = 309;

    await Track.updateOne(
      { _id: t._id },
      {
        $set: {
          duration: officialDur,
          audioUrl: `https://www.youtube.com/watch?v=${officialId}`,
          youtubeId: officialId,
          updatedAt: new Date()
        }
      }
    );
    repairedCount++;
    console.log(`  -> Repaired [${t._id}] to official Cairokee version (${officialDur}s, ${officialId}).`);
  }

  // 2. Repair "Ethbat Makanak" (اثبت مكانك) - Cairokee
  console.log('--- Checking "اثبت مكانك" / "Ethbat Makanak" ---');
  const ethbatTracks = await Track.find({
    $or: [
      { title: /اثبت مكانك/i },
      { title: /ethbat makanak/i }
    ]
  }).toArray();

  for (const t of ethbatTracks) {
    console.log(`Found Ethbat track: [${t._id}] "${t.title}" | Artist: "${t.artist}" | Dur: ${t.duration}s | AudioUrl: ${t.audioUrl}`);
    // If duration is corrupted to 18 mins (> 600s), fix it
    if (t.duration > 500 || (t.audioUrl && (t.audioUrl.includes('G2nwqlL1nyo') || t.duration > 600))) {
      const isNayer = /nayer/i.test(t.title) || /ناير/i.test(t.title);
      const officialId = isNayer ? '0hhXwSen-Vw' : 'fmFVtO5aI80';
      const officialDur = isNayer ? 353 : 284;

      await Track.updateOne(
        { _id: t._id },
        {
          $set: {
            duration: officialDur,
            audioUrl: `https://www.youtube.com/watch?v=${officialId}`,
            youtubeId: officialId,
            updatedAt: new Date()
          }
        }
      );
      repairedCount++;
      console.log(`  -> Repaired [${t._id}] to official Cairokee version (${officialDur}s, ${officialId}).`);
    }
  }

  // 3. Scan for any standard songs with inflated durations (> 600s) that are NOT podcasts/quran
  console.log('--- Checking for other songs with inflated concert durations (> 600s) ---');
  const inflatedTracks = await Track.find({
    duration: { $gt: 660 },
    isPodcast: { $ne: true },
    isQuran: { $ne: true },
    contentType: { $nin: ['podcast', 'quran'] },
    genre: { $nin: ['podcast', 'quran', 'quran-radio', 'Islamic'] }
  }).toArray();

  console.log(`Found ${inflatedTracks.length} tracks with duration > 11 mins that are not podcasts/Quran:`);
  for (const t of inflatedTracks) {
    // If not obviously a long set/mix/podcast
    const combined = `${t.title} ${t.artist} ${t.album}`.toLowerCase();
    const isActuallyLong = /(?:podcast|بودكاست|حلقة|سورة|مصحف|تلاوة|كوكتيل|ساعتين|حفلة|concert|live|dj|set|mix)/i.test(combined);
    if (!isActuallyLong) {
      console.log(`  Flagged inflated track: [${t._id}] "${t.title}" - "${t.artist}" (dur: ${t.duration}s)`);
      // Reset duration to standard 210s and clear corrupted cached audioUrl so it resolves fresh with our new strict similarity resolver
      await Track.updateOne(
        { _id: t._id },
        {
          $set: {
            duration: 210,
            audioUrl: '',
            updatedAt: new Date()
          }
        }
      );
      repairedCount++;
      console.log(`  -> Reset [${t._id}] duration to 210s and cleared audioUrl for clean re-resolution.`);
    }
  }

  // 4. Clean up Album collection: remove standalone singles falsely marked as Albums
  console.log('--- Cleaning up single releases from Album collection ---');
  const singlesInAlbums = await Album.find({
    $or: [
      { releaseType: 'single' },
      { name: /\s*-\s*Single$/i },
      { name: /\s*\(Single\)$/i },
      { trackCount: 1, isAlbum: true }
    ]
  }).toArray();

  console.log(`Found ${singlesInAlbums.length} singles polluting the Albums collection.`);
  if (singlesInAlbums.length > 0) {
    const res = await Album.deleteMany({
      _id: { $in: singlesInAlbums.map(a => a._id) }
    });
    console.log(`Purged ${res.deletedCount} single entries from Album collection.`);
  }

  // 5. Clean up fake collaboration profiles from Artist collection
  console.log('--- Cleaning up fake collaboration artist profiles ---');
  const Artist = db.collection('artists');
  const allArtistsInDb = await Artist.find({}).toArray();
  let splitArtistNames;
  try {
    splitArtistNames = require('./server/utils/artistAlbumUtils').splitArtistNames;
  } catch (e) {
    splitArtistNames = require('../server/utils/artistAlbumUtils').splitArtistNames;
  }
  const fakeIds = [];
  for (const a of allArtistsInDb) {
    if (!a.name) continue;
    const parts = splitArtistNames(a.name);
    if (parts.length > 1) {
      console.log(`  Flagged fake artist profile: "${a.name}"`);
      fakeIds.push(a._id);
    }
  }
  if (fakeIds.length > 0) {
    const artDelRes = await Artist.deleteMany({ _id: { $in: fakeIds } });
    console.log(`Purged ${artDelRes.deletedCount} fake collaboration artist profiles.`);
  }

  console.log(`✅ Repair complete! Fixed ${repairedCount} tracks.`);
  try { await mongoose.disconnect(); } catch {}
  process.exit(0);
}

repairMismatchedTracks().catch(err => {
  console.error('Repair script failed:', err);
  process.exit(1);
});
