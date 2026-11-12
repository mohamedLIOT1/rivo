const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: '/home/ubuntu/rivo/.env' });

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const Album = mongoose.connection.db.collection('albums');
  const allAlbums = await Album.find({}).toArray();

  let s = 0, e = 0, a = 0;
  for (const alb of allAlbums) {
    const count = Number(alb.trackCount || (Array.isArray(alb.tracks) ? alb.tracks.length : (Array.isArray(alb.trackIds) ? alb.trackIds.length : 0)));
    const name = String(alb.name || '').toLowerCase();

    let releaseType = 'album';
    if (count <= 1 || name.includes('single')) {
      releaseType = 'single';
      s++;
    } else if (count >= 2 && count <= 6) {
      releaseType = 'ep';
      e++;
    } else {
      releaseType = 'album';
      a++;
    }

    await Album.updateOne({ _id: alb._id }, { $set: { releaseType, trackCount: count } });
  }

  console.log(`Updated Release Types -> Singles: ${s}, EPs: ${e}, Albums: ${a}`);
  await mongoose.disconnect();
}

main().catch(console.error);
