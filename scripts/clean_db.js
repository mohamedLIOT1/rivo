require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('❌ MONGO_URI is missing from .env!');
  process.exit(1);
}

async function run() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB.');

  const Track = require('../server/models/Track');
  const Album = require('../server/models/Album');

  const duplicateIds = [
    '6ad8f0227dd3f2c5ba1fe409',
    '6ad7c66d78e1082780925207',
    '6ad83a6ffee6e2e779efeb80',
    '6ad7e05db0f581602eb4aa15',
    '6ad7696bb288ab16291fd1ae',
    '6ad76928b288ab16291fd09a',
    '6ad8eb847dd3f2c5ba1fe1cc',
    '6ad78191617a463fd2b60cb2',
    '6ad7572c82b546ebaa1b240f',
    '6ad7572b82b546ebaa1b240b',
    '6ad7569082b546ebaa1b23fc',
    '6ad74ff13d91785d70eeb625',
    '6ad74ff13d91785d70eeb623',
    '6ad74e28bfc0379104021376'
  ];

  // 1. Delete duplicate tracks from Track collection
  const delRes = await Track.deleteMany({ _id: { $in: duplicateIds } });
  console.log(`[1/3] Deleted ${delRes.deletedCount} duplicate attack tracks.`);

  // 2. Remove duplicates & misplaced tracks from Album - Classics, Vol. 1
  const classicsAlbum = await Album.findOne({ name: /Classics, Vol/i });
  if (classicsAlbum) {
    const beforeCount = classicsAlbum.trackIds?.length || 0;
    classicsAlbum.trackIds = (classicsAlbum.trackIds || []).filter(id => {
      const s = String(id);
      return !duplicateIds.includes(s) && s !== '6ab6feef49510bc9ca38ce68';
    });
    await classicsAlbum.save();
    console.log(`[2/3] Cleaned Classics, Vol. 1: ${beforeCount} tracks -> ${classicsAlbum.trackIds.length} tracks.`);
  }

  // 3. Ensure Kont Faker is in Noaata Beida
  const noaataAlbum = await Album.findOne({ name: /Noaata Beida/i });
  if (noaataAlbum) {
    const kfId = '6ab6feef49510bc9ca38ce68';
    const ids = (noaataAlbum.trackIds || []).map(String);
    if (!ids.includes(kfId)) {
      noaataAlbum.trackIds.push(kfId);
      await noaataAlbum.save();
    }
    console.log(`[3/3] Verified Noaata Beida has Kont Faker (${noaataAlbum.trackIds.length} tracks).`);
  }

  // Also remove from any other album trackIds just in case
  await Album.updateMany({}, {
    $pull: {
      trackIds: { $in: duplicateIds }
    }
  });

  console.log('🎉 Database cleanup finished successfully!');
  await mongoose.disconnect();
  process.exit(0);
}

run().catch(err => {
  console.error('Cleanup error:', err);
  process.exit(1);
});
