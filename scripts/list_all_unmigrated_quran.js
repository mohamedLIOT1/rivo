const mongoose = require('mongoose');
require('dotenv').config({ path: '/home/ubuntu/rivo/.env' });

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const Track = mongoose.model('Track', new mongoose.Schema({}, { strict: false }));
  
  const quranOr = [{ isQuran: true }, { contentType: 'quran' }, { genre: /quran|قرآن/i }, { album: /quran|قرآن/i }, { title: /سورة|تلاوة|القرآن/i }];
  const allQuran = await Track.find({ $or: quranOr }).lean();
  console.log('Total Quran in DB:', allQuran.length);

  const notMigrated = allQuran.filter(t => t.migration?.status !== 'migrated');
  console.log('Not migrated count:', notMigrated.length);

  notMigrated.forEach((t, i) => {
    console.log(`${i + 1}. [${t._id}] "${t.title}" by "${t.artist}" | surah: ${t.surahNumber} | status: ${t.migration?.status} | err: ${t.migration?.lastError}`);
  });

  await mongoose.disconnect();
}

main().catch(console.error);
