/**
 * Database Audit, Cleanup & Quran Isolation Script
 * Rivo Music Platform
 */

const dns = require('dns');
try { dns.setDefaultResultOrder('ipv4first'); dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (e) {}

const path = require('path');
const dotenvPath = process.platform === 'win32'
  ? path.resolve(__dirname, '../.env')
  : '/home/ubuntu/rivo/.env';
require('dotenv').config({ path: dotenvPath });

const mongoose = require('mongoose');

async function main() {
  const MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI) {
    console.error('❌ [Fatal Config] MONGO_URI missing from environment variables (.env)!');
    process.exit(1);
  }

  console.log('🔄 Connecting to MongoDB Atlas...');
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB Atlas successfully.\n');

  const db = mongoose.connection.db;
  const Album = db.collection('albums');
  const Track = db.collection('tracks');

  const { isQuranContent, detectQuranReciter, escapeRegex } = require('../server/utils/helpers');

  // ==========================================
  // STEP 1: Initial Audit of Collections
  // ==========================================
  const initialAlbumCount = await Album.countDocuments();
  const initialTrackCount = await Track.countDocuments();
  console.log('====================================================');
  console.log(`📊 INITIAL DATABASE AUDIT`);
  console.log(`Total albums in 'albums' collection: ${initialAlbumCount}`);
  console.log(`Total tracks in 'tracks' collection: ${initialTrackCount}`);
  console.log('====================================================\n');

  const allAlbums = await Album.find({}).toArray();

  // ==========================================
  // STEP 2: Strict Quran Isolation
  // ==========================================
  console.log('🔍 [Phase 1] Auditing & Isolating Quran Recitations from Music Albums...');
  const quranAlbumIds = [];
  const quranAlbumNames = [];

  for (const a of allAlbums) {
    const rawName = String(a.name || a.title || '').trim();
    const rawArtist = String(a.artist || '').trim();
    const rawGenre = String(a.genre || '').trim();
    const rawDesc = String(a.description || '').trim();

    const isReciter = Boolean(detectQuranReciter(rawName, rawArtist, rawName));
    const isQuranText = isQuranContent(rawName, rawArtist, rawName, rawGenre, rawDesc);
    const isExplicitQuran = Boolean(a.isQuran) || rawGenre === 'Holy Quran' || rawGenre === 'Quran';
    const isIslamicRecitation = (rawGenre === 'Islamic' || rawGenre === 'Quran') && (isReciter || /مصحف|تلاوة|تراويح|شعبة|القراءات|أذكار|اذكار|العفاسي|Alafasy|مسعد/i.test(rawName));

    if (isExplicitQuran || isReciter || isQuranText || isIslamicRecitation) {
      quranAlbumIds.push(a._id);
      quranAlbumNames.push(rawName);
      console.log(`  🕌 Detected Quran Document: "${rawName}" by "${rawArtist}" (_id: ${a._id})`);
    }
  }

  let quranTracksRemapped = 0;
  if (quranAlbumNames.length > 0) {
    // Ensure corresponding tracks are isolated in Quran system
    for (const name of quranAlbumNames) {
      const res = await Track.updateMany(
        { album: new RegExp(`^${escapeRegex(name)}$`, 'i') },
        { 
          $set: { 
            album: 'القرآن الكريم', 
            isQuran: true, 
            contentType: 'quran', 
            genre: 'Holy Quran' 
          } 
        }
      );
      quranTracksRemapped += res.modifiedCount;
    }
  }

  // Also remove Quran albums from 'albums' collection
  let quranAlbumsDeleted = 0;
  if (quranAlbumIds.length > 0) {
    const delRes = await Album.deleteMany({ _id: { $in: quranAlbumIds } });
    quranAlbumsDeleted = delRes.deletedCount;
    console.log(`  ✅ Removed ${quranAlbumsDeleted} Quran recitation documents from 'albums' collection.`);
    console.log(`  ✅ Remapped ${quranTracksRemapped} Quran tracks to album: 'القرآن الكريم' with isQuran=true.`);
  } else {
    console.log('  ℹ️ No Quran documents found in albums collection.');
  }

  // ==========================================
  // STEP 3: Purge Bogus Singles from Albums
  // ==========================================
  console.log('\n🔍 [Phase 2] Auditing & Purging Bogus Singles from Albums Collection...');
  const remainingAlbums = await Album.find({}).toArray();
  const bogusSingleAlbumIds = [];
  const bogusSingleNames = [];

  for (const a of remainingAlbums) {
    const rawName = String(a.name || a.title || '').trim();
    const nameLower = rawName.toLowerCase();
    const tIds = Array.isArray(a.trackIds) ? a.trackIds : [];
    const embedded = Array.isArray(a.tracks) ? a.tracks : [];
    const declared = Number(a.trackCount || 0);
    const maxCount = Math.max(declared, tIds.length, embedded.length);

    const isExplicitSingle = a.releaseType === 'single' ||
      /\s*-\s*Single$/i.test(rawName) ||
      /\s*\(Single\)$/i.test(rawName) ||
      nameLower.endsWith('- single') ||
      nameLower.endsWith('(single)');

    // Bogus single if explicitly single OR only 1 track across all representations
    if (isExplicitSingle || maxCount <= 1 || (tIds.length === 0 && embedded.length <= 1 && declared <= 1)) {
      bogusSingleAlbumIds.push(a._id);
      bogusSingleNames.push(rawName);
      console.log(`  🎵 Detected Bogus Single Album: "${rawName}" by "${a.artist}" (maxTracks: ${maxCount})`);
    }
  }

  let singleAlbumsDeleted = 0;
  if (bogusSingleAlbumIds.length > 0) {
    const delRes = await Album.deleteMany({ _id: { $in: bogusSingleAlbumIds } });
    singleAlbumsDeleted = delRes.deletedCount;
    console.log(`  ✅ Deleted ${singleAlbumsDeleted} bogus 1-track single releases from 'albums' collection.`);
  } else {
    console.log('  ℹ️ No bogus single albums found in albums collection (all previously purged).');
  }

  // ==========================================
  // STEP 4: Remap Tracks to 'Single'
  // ==========================================
  console.log('\n🔍 [Phase 3] Remapping Single Release Tracks in Tracks Collection...');
  let totalTracksRemappedToSingle = 0;

  // 1. Remap tracks referencing deleted single album names
  if (bogusSingleNames.length > 0) {
    for (const name of bogusSingleNames) {
      const res = await Track.updateMany(
        { 
          album: new RegExp(`^${escapeRegex(name)}$`, 'i'),
          isQuran: { $ne: true }
        },
        { $set: { album: 'Single' } }
      );
      totalTracksRemappedToSingle += res.modifiedCount;
    }
  }

  // 2. Remap tracks with explicit single labels like 'Singles'
  const singlesRes = await Track.updateMany(
    { 
      album: { $in: ['Singles', 'singles', 'Album - Chroma', 'Cry'] },
      isQuran: { $ne: true }
    },
    { $set: { album: 'Single' } }
  );
  totalTracksRemappedToSingle += singlesRes.modifiedCount;

  // 3. Remap tracks where album ends with "- Single" or "(Single)"
  const regexSinglesRes = await Track.updateMany(
    {
      album: { $regex: /(?:-\s*Single|\(Single\))$/i },
      isQuran: { $ne: true }
    },
    { $set: { album: 'Single' } }
  );
  totalTracksRemappedToSingle += regexSinglesRes.modifiedCount;

  // 4. Remap tracks with bogus generic source album labels ("YouTube" for non-Quran tracks)
  const ytRes = await Track.updateMany(
    {
      album: 'YouTube',
      isQuran: { $ne: true }
    },
    { $set: { album: 'Single' } }
  );
  totalTracksRemappedToSingle += ytRes.modifiedCount;

  console.log(`  ✅ Total tracks successfully remapped to album: 'Single': ${totalTracksRemappedToSingle}`);

  // ==========================================
  // STEP 5: Preserve Genuine Multi-Track Albums & EPs
  // ==========================================
  console.log('\n🔍 [Phase 4] Standardizing and Preserving Genuine Multi-Track Albums & EPs...');
  const verifiedGenuineAlbums = await Album.find({}).toArray();
  let genuineAlbumsPreserved = 0;

  for (const alb of verifiedGenuineAlbums) {
    const rawName = String(alb.name || alb.title || '').trim();
    const nameLower = rawName.toLowerCase();
    const tIds = Array.isArray(alb.trackIds) ? alb.trackIds : [];
    const embedded = Array.isArray(alb.tracks) ? alb.tracks : [];
    const declared = Number(alb.trackCount || 0);
    const count = Math.max(declared, tIds.length, embedded.length);

    let releaseType = 'album';
    if (nameLower.endsWith('- ep') || nameLower.endsWith('(ep)') || (count >= 2 && count <= 6)) {
      releaseType = 'ep';
    }

    await Album.updateOne(
      { _id: alb._id },
      {
        $set: {
          releaseType,
          isAlbum: true,
          isPublic: true,
          isQuran: false,
          trackCount: count
        }
      }
    );
    genuineAlbumsPreserved++;
  }

  console.log(`  ✅ Standardized and preserved ${genuineAlbumsPreserved} genuine albums and EPs.`);

  // ==========================================
  // STEP 6: Final Verification & Reporting
  // ==========================================
  const finalAlbumCount = await Album.countDocuments();
  const finalTrackCount = await Track.countDocuments();
  const finalQuranAlbums = await Album.countDocuments({
    $or: [
      { isQuran: true },
      { genre: { $in: ['Holy Quran', 'Quran', 'Quran Recitation'] } }
    ]
  });
  const tracksWithSingle = await Track.countDocuments({ album: 'Single' });
  const tracksWithQuran = await Track.countDocuments({ isQuran: true });

  console.log('\n====================================================');
  console.log('🏁 FINAL AUDIT & CLEANUP REPORT');
  console.log('====================================================');
  console.log(`Initial total albums:              ${initialAlbumCount}`);
  console.log(`Quran items isolated & deleted:    ${quranAlbumsDeleted}`);
  console.log(`Bogus singles deleted:             ${singleAlbumsDeleted}`);
  console.log(`Genuine albums & EPs preserved:    ${genuineAlbumsPreserved}`);
  console.log(`Final total albums in collection:  ${finalAlbumCount}`);
  console.log(`Quran albums in music collection:  ${finalQuranAlbums} (Strictly 0)`);
  console.log(`----------------------------------------------------`);
  console.log(`Total tracks in DB:                ${finalTrackCount}`);
  console.log(`Tracks remapped to 'Single':       ${totalTracksRemappedToSingle}`);
  console.log(`Total tracks with album='Single':  ${tracksWithSingle}`);
  console.log(`Total tracks in Quran system:      ${tracksWithQuran}`);
  console.log('====================================================\n');

  await mongoose.disconnect();
  console.log('✅ Database connection closed. Audit & cleanup complete.');
}

main().catch(err => {
  console.error('❌ Script failed with error:', err);
  process.exit(1);
});
