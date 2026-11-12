const mongoose = require('mongoose');
require('dotenv').config({ path: '/home/ubuntu/rivo/.env' });

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const Track = mongoose.model('Track', new mongoose.Schema({}, { strict: false }));
  
  const quranOr = [{ isQuran: true }, { contentType: 'quran' }, { genre: /quran|قرآن/i }, { album: /quran|قرآن/i }, { title: /سورة|تلاوة|القرآن/i }];
  const allQuran = await Track.find({ $or: quranOr }).lean();
  console.log('Total Quran in DB:', allQuran.length);

  const migrated = allQuran.filter(t => t.migration?.status === 'migrated');
  const failed = allQuran.filter(t => t.migration?.status === 'failed');
  const unmigrated = allQuran.filter(t => !t.migration || !['migrated', 'skipped'].includes(t.migration?.status));

  console.log('Migrated:', migrated.length);
  console.log('Failed:', failed.length);
  console.log('Pending/Unmigrated:', unmigrated.length);

  console.log('\n--- Details of Failed / Unmigrated ---');
  [...failed, ...unmigrated].forEach(t => {
    console.log('-', t.title, '| Status:', t.migration?.status, '| Reason/Error:', t.migration?.lastError || t.migration?.reason);
  });

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(console.error);
