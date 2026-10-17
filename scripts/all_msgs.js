require('./server/node_modules/dotenv').config({ path: '/home/ubuntu/rivo/.env' });
const mongoose = require('./server/node_modules/mongoose');
const Message = mongoose.model('Message', new mongoose.Schema({}, { strict: false }));

async function run() {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  const msgs = await Message.find({}).sort({ createdAt: 1 }).lean();
  console.log(`TOTAL MESSAGES IN DB: ${msgs.length}`);
  for (const m of msgs) {
    console.log(`[${m.createdAt}] from ${m.sender} to ${m.recipient}: "${m.text}"`);
  }
  process.exit(0);
}
run();
