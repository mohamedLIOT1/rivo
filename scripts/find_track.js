require('/home/ubuntu/rivo/server/node_modules/dotenv').config({ path: '/home/ubuntu/rivo/.env' });
require('/home/ubuntu/rivo/server/models/Track');
const mongoose = require('/home/ubuntu/rivo/server/node_modules/mongoose');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const Track = mongoose.model('Track');
  const tracks = await Track.find({
    $or: [
      { title: { $regex: 'mafesh', $options: 'i' } },
      { title: { $regex: 'مانع', $options: 'i' } },
      { _id: '6ab6b39ac0d36fb4cc1136ae' }
    ]
  }).lean();
  console.log('Found tracks:', JSON.stringify(tracks, null, 2));
  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
