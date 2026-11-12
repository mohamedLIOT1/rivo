const mongoose = require('mongoose');
require('dotenv').config({ path: '/home/ubuntu/rivo/.env' });

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const Artist = mongoose.connection.db.collection('artists');
  const Track = mongoose.connection.db.collection('tracks');

  // Search all artists matching cairokee or كايروكي
  const artists = await Artist.find({
    $or: [
      { name: /cairo/i },
      { name: /كايرو/ },
      { id: /cairo/i },
      { id: /كايرو/ }
    ]
  }).toArray();
  console.log('Artists matching cairo/كايرو in Artist collection:');
  console.log(artists.map(a => ({ _id: a._id, id: a.id, name: a.name })));

  // Search tracks where artist matches cairo/كايرو
  const trackArtists = await Track.distinct('artist', {
    $or: [
      { artist: /cairo/i },
      { artist: /كايرو/ }
    ]
  });
  console.log('\nTrack artists in Track collection:');
  console.log(trackArtists);

  // Also check what GET /api/artists returns for Cairokee
  const { getCanonicalArtistName } = require('../server/utils/helpers');
  const allTracks = await Track.find({}, 'artist album title cover plays').lean();
  const cairoTracks = allTracks.filter(t => (t.artist || '').match(/cairo|كايرو/i));
  console.log(`\nFound ${cairoTracks.length} tracks matching cairo/كايرو.`);
  const canonicalGroups = {};
  for (const t of cairoTracks) {
    const can = getCanonicalArtistName(t.artist);
    canonicalGroups[can] = (canonicalGroups[can] || 0) + 1;
  }
  console.log('Canonical groups for these tracks:', canonicalGroups);

  await mongoose.disconnect();
}
main().catch(console.error);
