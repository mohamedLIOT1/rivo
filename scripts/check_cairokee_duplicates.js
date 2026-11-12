const mongoose = require('mongoose');
require('dotenv').config({ path: '/home/ubuntu/rivo/.env' });

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const Artist = mongoose.connection.db.collection('artists');
  const Track = mongoose.connection.db.collection('tracks');

  const cairokeeArtists = await Artist.find({ 
    $or: [
      { name: /cairokee/i },
      { name: /كايروكي/i }
    ]
  }).toArray();

  console.log('--- Cairokee Artist Profiles ---');
  for (const a of cairokeeArtists) {
    console.log({
      _id: a._id,
      id: a.id,
      name: a.name,
      trackCount: a.trackCount,
      isVerified: a.isVerified,
      bio: Boolean(a.bio),
      avatar: a.avatar || a.imageUrl
    });
  }

  console.log('\n--- Cairokee Tracks Grouped by Artist Name ---');
  const distinctTrackArtists = await Track.aggregate([
    { $match: { artist: /cairokee|كايروكي/i } },
    { $group: { _id: '$artist', count: { $sum: 1 } } }
  ]).toArray();
  console.log(distinctTrackArtists);

  console.log('\n--- Checking "Nesena / نسينا" Tracks ---');
  const nesenaTracks = await Track.find({
    $or: [
      { title: /nesena/i },
      { title: /نسينا/i }
    ]
  }).toArray();
  for (const t of nesenaTracks) {
    console.log({
      _id: t._id,
      title: t.title,
      artist: t.artist,
      album: t.album,
      duration: t.duration,
      source: t.source,
      hasLyrics: Boolean(t.lyrics?.length),
      audioUrl: t.audioUrl
    });
  }

  await mongoose.disconnect();
}
main().catch(console.error);
