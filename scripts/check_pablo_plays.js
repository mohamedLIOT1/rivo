const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: '/home/ubuntu/rivo/.env' });

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const Track = mongoose.connection.db.collection('tracks');
  const tracks = await Track.find({ artist: /marwan pablo/i }).toArray();
  console.log(`Total tracks for Marwan Pablo: ${tracks.length}`);
  let sum = 0;
  for (const t of tracks) {
    sum += (Number(t.plays) || 0);
    if (t.plays) {
      console.log(`${t.title} -> plays: ${t.plays}`);
    }
  }
  console.log(`Total sum of plays: ${sum}`);
  await mongoose.disconnect();
}

main().catch(console.error);
