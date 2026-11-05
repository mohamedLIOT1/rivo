require('dotenv').config({ path: '/home/ubuntu/rivo/.env' });
const { User } = require('./server/models');
const { fetchListeningActivities } = require('./server/routes/users/userHelpers');
const mongoose = require('mongoose');

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const me = await User.findOne({ email: 'lio@gmail.com' });
  console.log('ME:', me ? me.email : 'null', 'FOLLOWING:', me ? me.following : 'none');
  const activities = await fetchListeningActivities(me ? me._id : null, null);
  console.log('ACTIVITIES:', JSON.stringify(activities.map(a => ({ id: a.id, name: a.name, isVerified: a.isVerified, lastActiveAt: a.lastActiveAt })), null, 2));
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
