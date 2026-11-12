const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: '/home/ubuntu/rivo/.env' });

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const Album = mongoose.connection.db.collection('albums');
  const Track = mongoose.connection.db.collection('tracks');

  const allAlbums = await Album.find({}).toArray();
  console.log(`Initial total albums: ${allAlbums.length}`);

  const singlesToDelete = [];
  const realAlbumsToKeep = [];

  for (const alb of allAlbums) {
    const name = String(alb.name || '').trim();
    const nameLower = name.toLowerCase();
    const count = Number(alb.trackCount || (Array.isArray(alb.tracks) ? alb.tracks.length : (Array.isArray(alb.trackIds) ? alb.trackIds.length : 0)));

    // Do NOT delete Quran collections
    const isQuran = Boolean(alb.isQuran || nameLower.includes('القرآن') || nameLower.includes('قرآن') || alb.artist?.includes('العفاسي') || alb.artist?.includes('عبد الباسط') || alb.artist?.includes('الحصري') || alb.artist?.includes('المنشاوي'));
    if (isQuran) {
      realAlbumsToKeep.push(alb);
      continue;
    }

    const isExplicitSingle = alb.releaseType === 'single';
    const isNameSingle = nameLower.endsWith('- single') || nameLower.endsWith('(single)') || nameLower.includes(' - single');
    const isSingleTrack = count <= 1;

    if (isExplicitSingle || isNameSingle || isSingleTrack) {
      singlesToDelete.push(alb);
    } else {
      realAlbumsToKeep.push(alb);
    }
  }

  console.log(`Found ${singlesToDelete.length} singles erroneously stored as albums.`);
  console.log(`Found ${realAlbumsToKeep.length} genuine multi-track albums/EPs to keep.`);

  // Delete all single albums
  const deleteIds = singlesToDelete.map(a => a._id);
  if (deleteIds.length > 0) {
    const res = await Album.deleteMany({ _id: { $in: deleteIds } });
    console.log(`Deleted ${res.deletedCount} single albums from albums collection.`);
  }

  // Update track.album for any track that had a deleted album name
  let tracksUpdated = 0;
  for (const single of singlesToDelete) {
    const cleanName = String(single.name || '').trim();
    const upd = await Track.updateMany(
      { album: new RegExp(`^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      { $set: { album: 'Single' } }
    );
    tracksUpdated += upd.modifiedCount;
  }
  console.log(`Reset ${tracksUpdated} track .album fields to 'Single'.`);

  // Ensure all remaining albums have releaseType correctly set (album or ep)
  for (const alb of realAlbumsToKeep) {
    const count = Number(alb.trackCount || (Array.isArray(alb.tracks) ? alb.tracks.length : (Array.isArray(alb.trackIds) ? alb.trackIds.length : 0)));
    const nameLower = String(alb.name || '').toLowerCase();
    let releaseType = 'album';
    if (nameLower.endsWith('- ep') || nameLower.endsWith('(ep)') || (count >= 2 && count <= 6)) {
      releaseType = 'ep';
    }
    await Album.updateOne({ _id: alb._id }, { $set: { releaseType, isAlbum: true } });
  }

  console.log('Finished purging singles from albums collection.');
  await mongoose.disconnect();
}

main().catch(console.error);
