const mongoose = require('mongoose');
const https = require('https');
require('dotenv').config({ path: '/home/ubuntu/rivo/.env' });

function itunesSearchAlbum(title, artist) {
  return new Promise(resolve => {
    const term = `${artist} ${title}`.trim();
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=album&country=EG&limit=5`;
    https.get(url, res => {
      let raw = '';
      res.on('data', d => raw += d);
      res.on('end', () => {
        try {
          const data = JSON.parse(raw);
          const results = data.results || [];
          if (results.length === 0) return resolve(null);
          const cleanTitle = title.toLowerCase().replace(/[-–—]/g, ' ').trim();
          const match = results.find(r => {
            const rName = (r.collectionName || '').toLowerCase().replace(/[-–—]/g, ' ').trim();
            return rName.includes(cleanTitle) || cleanTitle.includes(rName);
          }) || results[0];
          resolve(match);
        } catch(e) { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

function itunesLookupTracks(collectionId) {
  return new Promise(resolve => {
    const url = `https://itunes.apple.com/lookup?id=${collectionId}&entity=song&country=EG`;
    https.get(url, res => {
      let raw = '';
      res.on('data', d => raw += d);
      res.on('end', () => {
        try {
          const data = JSON.parse(raw);
          const tracks = (data.results || [])
            .filter(r => r.wrapperType === 'track')
            .map(r => ({
              id: `itunes-${r.trackId}`,
              title: r.trackName,
              artist: r.artistName,
              album: r.collectionName,
              cover: r.artworkUrl100 ? r.artworkUrl100.replace('100x100bb.jpg', '600x600bb.jpg') : '',
              duration: Math.round((r.trackTimeMillis || 180000) / 1000),
              trackNumber: r.trackNumber || 1,
              streamUrl: r.previewUrl || ''
            }));
          resolve(tracks);
        } catch(e) { resolve([]); }
      });
    }).on('error', () => resolve([]));
  });
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const Album = mongoose.connection.db.collection('albums');
  const Track = mongoose.connection.db.collection('tracks');

  // ==========================================
  // PART 1: DEDUPLICATE REDUNDANT TRACKS
  // ==========================================
  console.log('\n--- PART 1: TRACK DEDUPLICATION ---');
  
  // 1. Delete snippet tracks under 60 seconds that are not intros
  const snippets = await Track.find({
    duration: { $gt: 0, $lt: 60 },
    title: { $not: /intro|outro|skit/i },
    genre: { $ne: 'Holy Quran' }
  }).toArray();
  if (snippets.length > 0) {
    console.log(`Found ${snippets.length} snippet tracks (<60s) to delete:`);
    for (const sn of snippets) {
      console.log(`  Deleting snippet: "${sn.title}" (${sn.duration}s) by ${sn.artist}`);
    }
    const snIds = snippets.map(s => s._id);
    await Track.deleteMany({ _id: { $in: snIds } });
  }

  // 2. Specific known duplicates to delete
  // Nesena: delete the YouTube clip rip, keep the Supernova album track
  const delNesena = await Track.deleteMany({
    _id: new mongoose.Types.ObjectId('6af4a4b28c1a21f9c408503f') // Cairokee - Nesena كايروكي - نسينا (album: YouTube)
  });
  console.log(`Deleted Nesena YouTube rip: ${delNesena.deletedCount}`);

  // Ala bab EL Cima duplicate
  await Track.deleteMany({ _id: new mongoose.Types.ObjectId('6ad9a60553c618bedc5c860a') });

  // Ana Negm single duplicate (keep Roma album version)
  await Track.deleteMany({ _id: new mongoose.Types.ObjectId('6aea119f840b7a9544a67a58') });

  // Kont Faker single duplicate (keep Classics version)
  await Track.deleteMany({ _id: new mongoose.Types.ObjectId('6aea191bc41ee0189194f6f6') });

  // Ethbat Makanak duplicate (keep Classics version)
  await Track.deleteMany({ _id: new mongoose.Types.ObjectId('6aec8e9da1b8dd372e4de15c') });

  // ANONYMOUS duplicate (keep original, delete single copy)
  await Track.deleteMany({ _id: new mongoose.Types.ObjectId('6ae4f6bbbad5bdfe4c205b40') });

  // Don Toliver duplicate
  await Track.deleteMany({ _id: new mongoose.Types.ObjectId('6ae63b4d166e125fd76d6073') });

  // 3alam Kadaba duplicate
  await Track.deleteMany({ _id: new mongoose.Types.ObjectId('6aaecbcb9cd52d5f5a40bb21') });

  // Nasy duplicate
  await Track.deleteMany({ _id: new mongoose.Types.ObjectId('6aaecbcb9cd52d5f5a40bb3f') });

  // تروح لمين duplicate
  await Track.deleteMany({ _id: new mongoose.Types.ObjectId('6aaec6b39cd52d5f5a40b7db') });

  console.log('Finished track deduplication.');

  // ==========================================
  // PART 2: PURGE EMPTY / DUMMY / SINGLE ALBUMS
  // ==========================================
  console.log('\n--- PART 2: ALBUM COLLECTION CLEANUP ---');

  const allAlbums = await Album.find({}).toArray();
  console.log(`Initial albums in DB: ${allAlbums.length}`);

  const albumsToDelete = [];
  const albumsToEnrich = [];

  for (const alb of allAlbums) {
    const isQuran = Boolean(alb.isQuran || alb.genre === 'Holy Quran' || alb.artist?.includes('الحصري') || alb.artist?.includes('العفاسي') || alb.artist?.includes('عبد الباسط') || alb.artist?.includes('المنشاوي'));
    if (isQuran) continue;

    const count = Number(alb.trackCount || (Array.isArray(alb.tracks) ? alb.tracks.length : (Array.isArray(alb.trackIds) ? alb.trackIds.length : 0)));
    const nameLower = String(alb.name || '').toLowerCase().trim();

    // Pure singles: delete from albums collection
    const isSingle = alb.releaseType === 'single' || nameLower.endsWith('- single') || nameLower.endsWith('(single)') || nameLower.includes(' - single');

    // Duplicate empty Arabic albums that exist in English (e.g. معدي الناس vs Meaddy El Nas, أحلى و أحلى vs Ahla W Ahla, سهران vs Sahran)
    const isDummyArabic = (nameLower === 'معدي الناس' || nameLower === 'أحلى و أحلى' || nameLower === 'سهران' || nameLower === 'أماكن السهر' || nameLower === 'باليني') && count === 0;

    if (isDummyArabic || (isSingle && count <= 1)) {
      albumsToDelete.push(alb);
    } else if (count === 0) {
      // It has 0 tracks, see if it's a real album like reputation or Allem Alby
      albumsToEnrich.push(alb);
    }
  }

  console.log(`Identified ${albumsToDelete.length} dummy/single albums to DELETE.`);
  console.log(`Identified ${albumsToEnrich.length} empty albums to check for enrichment.`);

  // Enrich real albums if possible, otherwise delete them
  for (const alb of albumsToEnrich) {
    console.log(`Checking enrichment for: "${alb.name}" by ${alb.artist}`);
    try {
      const itunesAlb = await itunesSearchAlbum(alb.name, alb.artist);
      if (itunesAlb && itunesAlb.collectionId) {
        const fullTracks = await itunesLookupTracks(itunesAlb.collectionId);
        if (fullTracks.length >= 2) {
          console.log(`  Enriching with ${fullTracks.length} official tracks from Apple Music!`);
          const highResCover = itunesAlb.artworkUrl100 ? itunesAlb.artworkUrl100.replace('100x100bb.jpg', '600x600bb.jpg') : alb.cover;
          const releaseType = fullTracks.length <= 6 ? 'ep' : 'album';
          await Album.updateOne({ _id: alb._id }, {
            $set: {
              tracks: fullTracks,
              trackCount: fullTracks.length,
              cover: highResCover,
              releaseType,
              isAlbum: true
            }
          });
          continue;
        }
      }
    } catch (e) {
      console.warn(`  Enrichment failed for ${alb.name}:`, e.message);
    }
    // If could not enrich or trackCount < 2, delete from albums
    console.log(`  Could not find multi-track release, marking for deletion.`);
    albumsToDelete.push(alb);
  }

  // Perform deletion
  const delIds = albumsToDelete.map(a => a._id);
  if (delIds.length > 0) {
    const res = await Album.deleteMany({ _id: { $in: delIds } });
    console.log(`Successfully deleted ${res.deletedCount} single/dummy albums from DB.`);
  }

  // Update track.album = 'Single' for deleted singles
  for (const delAlb of albumsToDelete) {
    const cleanName = String(delAlb.name || '').trim();
    if (cleanName) {
      await Track.updateMany(
        { album: cleanName },
        { $set: { album: 'Single' } }
      );
    }
  }

  // Final count
  const remainingAlbums = await Album.countDocuments();
  console.log(`Remaining valid albums/EPs in DB: ${remainingAlbums}`);

  await mongoose.disconnect();
}
main().catch(console.error);
