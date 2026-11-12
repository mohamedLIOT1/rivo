const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const mongoose = require('mongoose');
require('dotenv').config({ path: '/home/ubuntu/rivo/.env' });

const { uploadAudioToB2 } = require('../server/utils/cloudStorageClient');
const { resolveQuranB2AccountForUpload } = require('../server/utils/cloudUsageHelper');
const { seedCloudCache } = require('../server/utils/cloudMediaServer');

const QURAN_MAP = [
  { id: '6aae8a1d4ae61451c2ef9cc2', url: 'https://server8.mp3quran.net/afs/033.mp3', name: 'Al-Ahzab (Afasy)' },
  { id: '6aae8a1d4ae61451c2ef9cca', url: 'https://server8.mp3quran.net/afs/037.mp3', name: 'As-Saffat (Afasy)' },
  { id: '6aae8a1d4ae61451c2ef9cce', url: 'https://server8.mp3quran.net/afs/039.mp3', name: 'Az-Zumar (Afasy)' },
  { id: '6aae8a1f4ae61451c2ef9d10', url: 'https://server8.mp3quran.net/afs/072.mp3', name: 'Al-Jinn (Afasy)' },
  { id: '6aae8a1f4ae61451c2ef9d18', url: 'https://server8.mp3quran.net/afs/076.mp3', name: 'Al-Insan (Afasy)' },
  { id: '6af2b103051cbed72d8dd5b5', url: 'https://server10.mp3quran.net/minsh/021.mp3', name: 'Al-Anbiya (Minshawi)' },
  { id: '6aae82014ae61451c2ef9af8', url: 'https://server13.mp3quran.net/husr/082.mp3', name: 'Al-Infitar (Hussary)' },
  { id: '6aae82024ae61451c2ef9b1a', url: 'https://server13.mp3quran.net/husr/099.mp3', name: 'Az-Zalzalah (Hussary)' },
  { id: '6aae82014ae61451c2ef9b0c', url: 'https://server13.mp3quran.net/husr/092.mp3', name: 'Al-Layl (Hussary)' },
  { id: '6aae83df4ae61451c2ef9b72', url: 'https://server10.mp3quran.net/minsh/023.mp3', name: 'Al-Mu\'minun (Minshawi)' },
  { id: '6aae83e04ae61451c2ef9bb8', url: 'https://server10.mp3quran.net/minsh/058.mp3', name: 'Al-Mujadilah (Minshawi)' },
  { id: '6af2aae2051cbed72d8dd3f2', url: 'https://server10.mp3quran.net/minsh/020.mp3', name: 'Taha (Minshawi)' },
  { id: '6af29f5c051cbed72d8dd0a8', url: 'https://server10.mp3quran.net/minsh/019.mp3', name: 'Maryam (Minshawi)' },
  { id: '6aae81ff4ae61451c2ef9a6c', url: 'https://server13.mp3quran.net/husr/012.mp3', name: 'Yusuf (Hussary)' },
];

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('[QuranFinish] Connected to MongoDB.');

  const Track = mongoose.model('Track', new mongoose.Schema({}, { strict: false }));
  const tmpDir = path.join('/tmp', 'quran_finish');
  fs.mkdirSync(tmpDir, { recursive: true });

  const qTarget = await resolveQuranB2AccountForUpload();
  const b2Account = qTarget.account;
  console.log(`[QuranFinish] Using B2 account: ${b2Account?.bucketName || 'default'}`);

  let successCount = 0;
  for (const item of QURAN_MAP) {
    const rawMp3 = path.join(tmpDir, `${item.id}.mp3`);
    const transcodedM4a = path.join(tmpDir, `${item.id}.m4a`);

    try {
      console.log(`\n[${item.name}] Downloading from ${item.url}...`);
      execSync(`curl -L -s -f -o "${rawMp3}" "${item.url}"`, { timeout: 60000 });
      
      const stat = fs.statSync(rawMp3);
      if (stat.size < 10000) {
        throw new Error(`File too small: ${stat.size} bytes`);
      }
      console.log(`[${item.name}] Downloaded: ${(stat.size / (1024 * 1024)).toFixed(2)} MB`);

      console.log(`[${item.name}] Transcoding to 64k mono AAC...`);
      execSync(`ffmpeg -y -i "${rawMp3}" -vn -c:a aac -b:a 64k -ac 1 "${transcodedM4a}"`, { stdio: 'pipe', timeout: 120000 });
      
      const m4aStat = fs.statSync(transcodedM4a);
      console.log(`[${item.name}] Transcoded size: ${(m4aStat.size / (1024 * 1024)).toFixed(2)} MB`);

      // Determine duration via ffprobe
      let duration = 300;
      try {
        const out = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${transcodedM4a}"`, { encoding: 'utf8' });
        const parsed = parseFloat(out.trim());
        if (!isNaN(parsed) && parsed > 0) duration = Math.round(parsed);
      } catch {}

      console.log(`[${item.name}] Uploading to Backblaze B2 (quran/${item.id}.m4a)...`);
      const cloudMeta = await uploadAudioToB2(transcodedM4a, `quran/${item.id}.m4a`, {
        category: 'quran',
        accountOverride: b2Account,
        contentType: 'audio/mp4'
      });

      console.log(`[${item.name}] Seeding cloud cache...`);
      await seedCloudCache(item.id, 'm4a', transcodedM4a);

      console.log(`[${item.name}] Updating Track record in MongoDB...`);
      await Track.updateOne({ _id: new mongoose.Types.ObjectId(item.id) }, {
        $set: {
          audioUrl: `/uploads/cloud/${item.id}.m4a`,
          duration,
          cloudStorage: cloudMeta,
          migration: {
            status: 'migrated',
            reason: `b2:${cloudMeta.bucketName || 'quran'}:mp3quran_cdn`,
            category: 'quran',
            updatedAt: new Date()
          }
        }
      });

      successCount++;
      console.log(`[${item.name}] ✅ Successfully migrated!`);
    } catch (err) {
      console.error(`[${item.name}] ❌ ERROR:`, err.message);
    } finally {
      try { if (fs.existsSync(rawMp3)) fs.unlinkSync(rawMp3); } catch {}
      try { if (fs.existsSync(transcodedM4a)) fs.unlinkSync(transcodedM4a); } catch {}
    }
  }

  console.log(`\n========================================`);
  console.log(`Successfully migrated: ${successCount} / ${QURAN_MAP.length}`);

  const quranOr = [{ isQuran: true }, { contentType: 'quran' }, { genre: /quran|قرآن/i }, { album: /quran|قرآن/i }, { title: /سورة|تلاوة|القرآن/i }];
  const totalQuran = await Track.countDocuments({ $or: quranOr });
  const migratedQuran = await Track.countDocuments({ $or: quranOr, 'migration.status': 'migrated' });
  console.log(`Final Quran Cloud Status: ${migratedQuran} / ${totalQuran} (${((migratedQuran/totalQuran)*100).toFixed(1)}%)`);
  console.log(`========================================`);

  await mongoose.disconnect();
}

main().catch(console.error);
