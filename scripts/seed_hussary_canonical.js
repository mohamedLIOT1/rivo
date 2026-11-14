/**
 * Seed all 114 Canonical Surahs for Mahmoud Khalil Al-Hussary
 * High-speed MP3Quran CDN streaming
 */

const mongoose = require('mongoose');
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://mohamedmustafat79_db_user:123RiVo.AliLio@cluster0.sr4ypsh.mongodb.net/liofy_db?retryWrites=true&w=majority";

const SURAH_NAMES = [
  'الفاتحة', 'البقرة', 'آل عمران', 'النساء', 'المائدة', 'الأنعام', 'الأعراف', 'الأنفال', 'التوبة', 'يونس',
  'هود', 'يوسف', 'الرعد', 'إبراهيم', 'الحجر', 'النحل', 'الإسراء', 'الكهف', 'مريم', 'طه',
  'الأنبياء', 'الحج', 'المؤمنون', 'النور', 'الفرقان', 'الشعراء', 'النمل', 'القصص', 'العنكبوت', 'الروم',
  'لقمان', 'السجدة', 'الأحزاب', 'سبأ', 'فاطر', 'يس', 'الصافات', 'ص', 'الزمر', 'غافر',
  'فصلت', 'الشورى', 'الزخرف', 'الدخان', 'الجاثية', 'الأحقاف', 'محمد', 'الفتح', 'الحجرات', 'ق',
  'الذاريات', 'الطور', 'النجم', 'القمر', 'الرحمن', 'الواقعة', 'الحديد', 'المجادلة', 'الحشر', 'الممتحنة',
  'الصف', 'الجمعة', 'المنافقون', 'التغابن', 'الطلاق', 'التحريم', 'الملك', 'القلم', 'الحاقة', 'المعارج',
  'نوح', 'الجن', 'المزمل', 'المدثر', 'القيامة', 'الإنسان', 'المرسلات', 'النبأ', 'النازعات', 'عبس',
  'التكوير', 'الانفطار', 'المطففين', 'الانشقاق', 'البروج', 'الطارق', 'الأعلى', 'الغاشية', 'الفجر', 'البلد',
  'الشمس', 'الليل', 'الضحى', 'الشرح', 'التين', 'العلق', 'القدر', 'البينة', 'الزلزلة', 'العاديات',
  'القارعة', 'التكاثر', 'العصر', 'الهمزة', 'الفيل', 'قريش', 'الماعون', 'الكوثر', 'الكافرون', 'النصر',
  'المسد', 'الإخلاص', 'الفلق', 'الناس'
];

const HUSSARY_COVER = 'https://upload.wikimedia.org/wikipedia/commons/7/70/Hussary.jpg';

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB Atlas.');

  const { Track, Artist } = require('../server/models');

  // Check existing Hussary tracks
  await Track.deleteMany({ artist: 'محمود خليل الحصري', isQuran: true });
  console.log('Cleared existing Hussary tracks.');

  const tracksToInsert = [];
  for (let i = 0; i < SURAH_NAMES.length; i++) {
    const num = i + 1;
    const numStr = String(num).padStart(3, '0');
    const surahName = SURAH_NAMES[i];
    const title = `${numStr} | سورة ${surahName} | محمود خليل الحصري`;
    const audioUrl = `https://server13.mp3quran.net/husr/${numStr}.mp3`;

    tracksToInsert.push({
      id: `quran-husr-${numStr}`,
      title,
      artist: 'محمود خليل الحصري',
      primaryArtist: 'محمود خليل الحصري',
      album: 'القرآن الكريم كامل - محمود خليل الحصري',
      cover: HUSSARY_COVER,
      audioUrl,
      duration: 300,
      isQuran: true,
      genre: 'Quran',
      source: 'MP3Quran',
      surahNumber: num,
      plays: 0,
      views: 0
    });
  }

  await Track.insertMany(tracksToInsert);
  console.log(`✅ Successfully seeded all ${tracksToInsert.length} canonical surahs for Mahmoud Khalil Al-Hussary.`);

  // Update artist record
  await Artist.updateOne(
    { name: 'محمود خليل الحصري' },
    { $set: { trackCount: 114, avatar: HUSSARY_COVER, cover: HUSSARY_COVER } }
  );
  console.log('Updated Artist record for Mahmoud Khalil Al-Hussary.');

  await mongoose.disconnect();
}

seed().catch(console.error);
