const mongoose = require('mongoose');
require('dotenv').config({ path: '/home/ubuntu/rivo/.env' });

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const Track = mongoose.connection.db.collection('tracks');

  const allNesena = await Track.find({
    $or: [
      { title: /nesena/i },
      { title: /نسينا/i }
    ]
  }).toArray();

  console.log(`Found ${allNesena.length} tracks matching nesena/نسينا:`);
  for (const t of allNesena) {
    console.log(`- [${t._id}] "${t.title}" | artist: "${t.artist}" | album: "${t.album}" | dur: ${t.duration}`);
    // If it is the youtube clip or the 42s snippet, delete it!
    const isClip = t.title.includes('كايروكي - نسينا') || t.title.includes('سوبرنوفا - نسينا') || t.album === 'YouTube' || t.duration < 60;
    if (isClip && (t.artist.includes('Cairokee') || t.artist === 'Dark Side' || t.title.includes('كايروكي'))) {
      await Track.deleteOne({ _id: t._id });
      console.log(`  -> ❌ DELETED: [${t._id}] "${t.title}"`);
    }
  }

  // Double check remaining Nesena tracks
  const remaining = await Track.find({
    $or: [
      { title: /nesena/i },
      { title: /نسينا/i }
    ]
  }).toArray();
  console.log('\nRemaining after cleanup:');
  for (const t of remaining) {
    console.log(`- [${t._id}] "${t.title}" | artist: "${t.artist}" | album: "${t.album}"`);
  }

  await mongoose.disconnect();
}

main().catch(console.error);
