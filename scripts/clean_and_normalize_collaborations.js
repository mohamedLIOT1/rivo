/**
 * Data Cleansing & Collaboration Migration Script
 * Strictly modularized (< 400 lines) per AGENTS.md.
 */

const path = require('path');
const mongoose = require('mongoose');
const envPath = process.platform === 'win32' 
  ? path.resolve(__dirname, '../server/.env') 
  : '/home/ubuntu/rivo/.env';
require('dotenv').config({ path: envPath });

const { splitArtistNames, getCanonicalArtistName } = require('../server/utils/artistAlbumUtils');

const COLLAB_REGEX = /(?:\s*[,،;&+]\s*|\s+(?:ft\.?|feat\.?|featuring|with|مع|vs\.?)\s+|\s+[xX]\s+|\s+و\s+)/i;

async function run() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/rivo';
  console.log(`[Migration] Connecting to MongoDB: ${mongoUri.replace(/:[^:@]+@/, ':***@')}`);
  await mongoose.connect(mongoUri);

  const Track = mongoose.connection.db.collection('tracks');
  const Album = mongoose.connection.db.collection('albums');
  const Artist = mongoose.connection.db.collection('artists');

  console.log('[Migration] Step 1: Normalizing Track schemas & assigning primaryArtist / artists / featuredArtists...');
  const allTracks = await Track.find({}, { projection: { _id: 1, artist: 1, title: 1 } }).toArray();
  let tracksUpdated = 0;
  const bulkOps = [];

  for (const t of allTracks) {
    if (!t.artist) continue;
    const parts = splitArtistNames(t.artist);
    const primary = parts[0] || getCanonicalArtistName(t.artist) || t.artist.trim();
    const allArtists = Array.from(new Set(parts.length > 0 ? parts : [primary]));
    const featured = allArtists.filter(a => a.toLowerCase() !== primary.toLowerCase());

    bulkOps.push({
      updateOne: {
        filter: { _id: t._id },
        update: {
          $set: {
            primaryArtist: primary,
            artists: allArtists,
            featuredArtists: featured
          }
        }
      }
    });

    if (bulkOps.length >= 500) {
      await Track.bulkWrite(bulkOps);
      tracksUpdated += bulkOps.length;
      bulkOps.length = 0;
      process.stdout.write(`  Processed ${tracksUpdated}/${allTracks.length} tracks...\r`);
    }
  }

  if (bulkOps.length > 0) {
    await Track.bulkWrite(bulkOps);
    tracksUpdated += bulkOps.length;
  }
  console.log(`\n✅ Step 1 complete: Updated ${tracksUpdated} tracks with primaryArtist, artists & featuredArtists.`);

  console.log('[Migration] Step 2: Normalizing Album schemas & assigning artists array...');
  const allAlbums = await Album.find({}, { projection: { _id: 1, artist: 1, name: 1 } }).toArray();
  let albumsUpdated = 0;
  const albumOps = [];

  for (const a of allAlbums) {
    if (!a.artist) continue;
    const parts = splitArtistNames(a.artist);
    const allArtists = Array.from(new Set(parts.length > 0 ? parts : [getCanonicalArtistName(a.artist) || a.artist.trim()]));

    albumOps.push({
      updateOne: {
        filter: { _id: a._id },
        update: {
          $set: {
            artists: allArtists
          }
        }
      }
    });

    if (albumOps.length >= 200) {
      await Album.bulkWrite(albumOps);
      albumsUpdated += albumOps.length;
      albumOps.length = 0;
    }
  }

  if (albumOps.length > 0) {
    await Album.bulkWrite(albumOps);
    albumsUpdated += albumOps.length;
  }
  console.log(`✅ Step 2 complete: Updated ${albumsUpdated} albums with artists array.`);

  console.log('[Migration] Step 3: Purging fake collaborative artist documents...');
  const allArtistDocs = await Artist.find({}).toArray();
  let fakeArtistsDeleted = 0;

  for (const doc of allArtistDocs) {
    if (!doc.name) continue;
    const isCollab = COLLAB_REGEX.test(doc.name) || splitArtistNames(doc.name).length > 1;
    if (isCollab) {
      console.log(`  🗑️ Removing fake collaborative artist: "${doc.name}"`);
      await Artist.deleteOne({ _id: doc._id });
      fakeArtistsDeleted++;

      // Ensure each constituent artist has a legitimate individual profile if missing
      const constituentArtists = splitArtistNames(doc.name);
      for (const singleArtist of constituentArtists) {
        const canName = getCanonicalArtistName(singleArtist) || singleArtist;
        const exists = await Artist.findOne({
          name: { $regex: new RegExp(`^${canName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
        });
        if (!exists) {
          const artistId = canName.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
          await Artist.insertOne({
            id: artistId,
            name: canName,
            bio: '',
            cover: '',
            avatar: '',
            banner: '',
            isVerified: false,
            genres: [],
            customLinks: [],
            updatedBy: 'migration',
            createdAt: new Date(),
            updatedAt: new Date()
          });
          console.log(`  ✨ Created canonical individual artist stub: "${canName}"`);
        }
      }
    }
  }

  console.log(`✅ Step 3 complete: Purged ${fakeArtistsDeleted} fake collaborative artist profiles.`);
  console.log('[Migration] Step 4: Creating MongoDB indexes on Track & Album...');
  await Track.createIndex({ primaryArtist: 1, plays: -1 });
  await Track.createIndex({ artists: 1, plays: -1 });
  await Track.createIndex({ featuredArtists: 1, plays: -1 });
  await Album.createIndex({ artists: 1 });
  console.log('✅ Step 4 complete: Indexes verified.');

  console.log('[Migration] Step 5: Backfilling missing & verified artist avatars...');
  const { CANONICAL_ARTIST_AVATARS } = require('../server/utils/artworkResolver');
  let avatarsUpdated = 0;
  const remainingArtists = await Artist.find({}).toArray();
  for (const art of remainingArtists) {
    const key = (art.name || '').toLowerCase().trim();
    const verifiedPic = CANONICAL_ARTIST_AVATARS[key];
    const isMissing = !art.avatar || !art.avatar.trim() ||
      art.avatar.includes('photo-1514525253161') ||
      art.avatar.includes('hqdefault.jpg');

    if (verifiedPic || isMissing) {
      const newPic = verifiedPic || art.avatar;
      if (newPic && newPic !== art.avatar) {
        await Artist.updateOne(
          { _id: art._id },
          { $set: { avatar: newPic, cover: newPic, updatedAt: new Date() } }
        );
        avatarsUpdated++;
      }
    }
  }
  console.log(`✅ Step 5 complete: Backfilled high-res avatars for ${avatarsUpdated} artists.`);

  console.log('\n🎉 ALL DATA MIGRATION STEPS FINISHED SUCCESSFULLY!');
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
