const mongoose = require('mongoose');
require('dotenv').config({ path: '/home/ubuntu/rivo/.env' });

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const coll = mongoose.connection.collection('artists');
  const allArtists = await coll.find().sort({ name: 1 }).toArray();
  console.log(`Total Artist Profiles in DB: ${allArtists.length}`);
  allArtists.forEach((a, i) => {
    console.log(`${i + 1}. [${a._id}] "${a.name}" | verified: ${a.isVerified} | monthly: ${a.monthlyListeners} | bio: ${Boolean(a.bio)} | image: ${Boolean(a.imageUrl || a.avatar)}`);
  });
  await mongoose.disconnect();
}

main().catch(console.error);
