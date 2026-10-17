require('./server/node_modules/dotenv').config({ path: '/home/ubuntu/rivo/.env' });
const mongoose = require('./server/node_modules/mongoose');
const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));

async function run() {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  const botAvatar = 'https://rivo-m.duckdns.org/public/assets/rivo-bot.png';
  const res = await User.updateMany(
    { $or: [{ email: 'bot@rivo.app' }, { name: 'Rivo Bot' }, { isBot: true }] },
    { $set: { avatar: botAvatar, isBot: true } }
  );
  console.log('Updated bot in DB:', res);
  const bot = await User.findOne({ email: 'bot@rivo.app' }).lean();
  console.log('Bot now:', bot.name, bot.email, bot.avatar);
  process.exit(0);
}
run();
