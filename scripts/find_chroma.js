const path = require('path');
require('/home/ubuntu/node_modules/dotenv').config({ path: '/home/ubuntu/rivo/.env' });
const { Track } = require('/home/ubuntu/rivo/server/models');

async function check() {
  const t = await Track.findOne({ title: /Chroma/i });
  console.log('TRACK_CHROMA:', JSON.stringify(t, null, 2));
  process.exit(0);
}
setTimeout(check, 1000);
