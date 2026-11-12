const mongoose = require('mongoose');
require('dotenv').config({ path: '/home/ubuntu/rivo/.env' });

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const Artist = mongoose.connection.db.collection('artists');
  const Track = mongoose.connection.db.collection('tracks');

  const cairokeeArtists = await Artist.find({ name: /cairokee|كايروكي/i }).toArray();
  console.log('Cairokee artist documents:', JSON.stringify(cairokeeArtists, null, 2));

  const distinctArtists = await Track.distinct('artist', { artist: /cairokee|كايروكي/i });
  console.log('Distinct Cairokee artist names in tracks:', distinctArtists);

  await mongoose.disconnect();
}
main().catch(console.error);
