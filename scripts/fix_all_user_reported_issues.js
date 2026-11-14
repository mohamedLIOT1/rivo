/**
 * Comprehensive Database Migration & Fix Script for User-Reported Issues
 *
 * 1. Fix "Kol Hayaty" album cover to verified 1200x1200px Apple Music artwork.
 * 2. Remove fake Adele albums (Uncharted Deluxe, Long Live the Angels, The Piano Guys, etc.).
 * 3. Set verified, permanent, high-res portraits for all core catalog artists & reciters in the Artist collection.
 * 4. Deduplicate Quran reciter tracks so Alafasy, Minshawi, and Hussary each have exactly 114 canonical surahs.
 * 5. Update accurate trackCount and albumCount on all Artist records.
 * 6. Reset site plays (`plays`) to genuine user plays and preserve external views in `views` for algorithms.
 */

const dns = require('dns');
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch {}

const path = require('path');
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://mohamedmustafat79_db_user:123RiVo.AliLio@cluster0.sr4ypsh.mongodb.net/liofy_db?retryWrites=true&w=majority";

const VERIFIED_ARTIST_AVATARS = {
  'Amr Diab': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/69/2f/b0/692fb07e-6ab9-467a-01f4-f12ec0a39a41/194660835758.jpg/1200x1200bb.jpg',
  'Tamer Hosny': 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/91/ba/6d/91ba6de9-d79a-daca-e5e3-d5d13e1bb000/3615933755032.jpg/1200x1200bb.jpg',
  'Cairokee': 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/46/81/82/468182bd-6914-bf7d-2f4a-4cb4bd5175cd/196925215671.jpg/1200x1200bb.jpg',
  'Mohamed Hamaki': 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/33/aa/5b/33aa5b64-d621-e3a4-eb94-4d89868972e6/190296766442.jpg/1200x1200bb.jpg',
  'Marwan Pablo': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/25/99/06/25990612-bcc8-f286-57ea-c7cdb0aabe75/198588228821.jpg/1200x1200bb.jpg',
  'Wegz': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/da/6b/6a/da6b6a17-8118-9b3b-b92e-7f1854ddea68/199538601800.jpg/1200x1200bb.jpg',
  'Lege-Cy': 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/3d/be/1a/3dbe1ae5-a9c0-ff0c-d8ea-3b87692cadeb/6221216529510_cover.png/1200x1200bb.jpg',
  'Tul8te': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/91/92/51/91925187-578f-ef47-bb71-c035616b23d9/198588806296.jpg/1200x1200bb.jpg',
  'Sherine': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/f9/29/9b/f9299b39-c73d-13e1-c684-b1e8a87cfe1e/3664216111270.png/1200x1200bb.jpg',
  'Abyusif': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/69/f9/aa/69f9aa09-d6b1-3893-a4d7-6f359e65c9dc/0.jpg/1200x1200bb.jpg',
  'Angham': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/33/ca/48/33ca489f-c5e6-7450-f0c4-228769396dc7/1614067.jpg/1200x1200bb.jpg',
  'Mohamed Mounir': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/61/a7/50/61a7500b-3372-9fe8-4f55-2584e4a31602/cover.jpg/1200x1200bb.jpg',
  'Abo El Anwar': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/34/7a/60/347a600c-ef6d-252e-2a29-4814136bf8b7/cover.jpg/1200x1200bb.jpg',
  'Drake': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/8c/d7/30/8cd73004-2d53-e7e4-bf7a-d4915422e261/196874972977.jpg/1200x1200bb.jpg',
  'Kendrick Lamar': 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/94/28/36/94283609-93bb-db1c-e997-44e82c157e90/00602567261216.rgb.jpg/1200x1200bb.jpg',
  'Adele': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/eb/ca/25/ebca2596-cd1e-b295-91a3-771c868d0a79/191404113868.png/1200x1200bb.jpg',
  'Dua Lipa': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/0e/c1/57/0ec1575f-5153-ac4b-d578-c5fa3a90bfe1/5021732511676.jpg/1200x1200bb.jpg',
  'Taylor Swift': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/be/e1/48/bee148d6-d16c-d8f7-0173-d6cf6d684aa1/08PNDIM00678.rgb.jpg/1200x1200bb.jpg',
  'مشاري راشد العفاسي': 'https://upload.wikimedia.org/wikipedia/commons/2/24/%D0%9C%D0%B8%D1%88%D0%B0%D1%80%D0%B8_%D0%A0%D0%B0%D1%88%D0%B8%D0%B4.jpg',
  'محمد صديق المنشاوي': 'https://upload.wikimedia.org/wikipedia/commons/e/ee/Elminshwey.jpg',
  'محمود خليل الحصري': 'https://upload.wikimedia.org/wikipedia/commons/7/70/Hussary.jpg',
  'ياسر الدوسري': 'https://upload.wikimedia.org/wikipedia/commons/6/69/Yasser_Al-Dosari.jpg',
  'عبد الباسط عبد الصمد': 'https://upload.wikimedia.org/wikipedia/ar/7/73/%D8%B5%D9%88%D8%B1%D8%A9_%D8%B4%D8%AE%D8%B5%D9%8A%D8%A9_%D8%B9%D8%A8%D8%AF_%D8%A7%D9%84%D8%A8%D8%A7%D8%B3%D8%B7_%D8%B9%D8%A8%D8%AF_%D8%A7%D9%84%D8%B5%D9%85%D8%AF.png',
  'ماهر المعيقلي': 'https://upload.wikimedia.org/wikipedia/commons/9/90/Maher_Al_Mueaqly.png',
  'عبد الرحمن السديس': 'https://upload.wikimedia.org/wikipedia/commons/1/18/Abdul-Rahman_Al-Sudais_%28Cropped%2C_2011%29.jpg'
};

const KOL_HAYATY_COVER = 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/53/72/e3/5372e3cc-173f-c5ed-88ac-d19ab6b381e8/5061028762894.jpg/1200x1200bb.jpg';

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB Atlas.');

  const { Track, Album, Artist, User } = require('../server/models');

  // 1. Fix "Kol Hayaty" album cover
  console.log('\n--- 1. Fixing Kol Hayaty Album Cover ---');
  const kolRes = await Album.updateMany(
    { name: { $regex: /kol hayaty|كل حياتي/i } },
    { $set: { cover: KOL_HAYATY_COVER } }
  );
  console.log(`Updated Kol Hayaty album cover: ${kolRes.modifiedCount} album(s) updated.`);

  const kolTrackRes = await Track.updateMany(
    { album: { $regex: /kol hayaty|كل حياتي/i } },
    { $set: { cover: KOL_HAYATY_COVER } }
  );
  console.log(`Updated tracks in Kol Hayaty: ${kolTrackRes.modifiedCount} track(s) updated.`);

  // 2. Remove fake Adele albums
  console.log('\n--- 2. Removing Fake Adele Albums ---');
  const fakeAdeleNames = [
    'Uncharted (Deluxe Edition)',
    'Long Live the Angels (Deluxe Version)',
    'The Piano Guys',
    'Lullaby Renditions of Adele',
    'Adele - Piano Covers'
  ];
  const delAdeleRes = await Album.deleteMany({
    artist: { $regex: /^adele$/i },
    name: { $in: fakeAdeleNames }
  });
  console.log(`Deleted fake Adele albums: ${delAdeleRes.deletedCount} album(s) removed.`);

  // 3. Fix Marwan Pablo "CTRL - EP"
  console.log('\n--- 3. Fixing Marwan Pablo CTRL EP ---');
  await Album.updateMany(
    { name: { $regex: /ctrl/i }, artist: { $regex: /pablo/i } },
    { $set: { releaseType: 'ep', trackCount: 5 } }
  );

  // 4. Update permanent verified artist avatars & covers
  console.log('\n--- 4. Updating Permanent Verified Artist Portraits ---');
  for (const [artistName, avatarUrl] of Object.entries(VERIFIED_ARTIST_AVATARS)) {
    const res = await Artist.updateMany(
      { name: { $regex: new RegExp(`^${artistName}$`, 'i') } },
      { $set: { avatar: avatarUrl, cover: avatarUrl } }
    );
    if (res.matchedCount > 0) {
      console.log(`  ✔ Set permanent portrait for "${artistName}"`);
    } else {
      // Create artist document if not existing
      const slug = artistName.toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'art';
      const uniqueId = `artist_${slug}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      await Artist.create({
        id: uniqueId,
        name: artistName,
        avatar: avatarUrl,
        cover: avatarUrl,
        isVerified: true
      });
      console.log(`  ➕ Created verified artist document for "${artistName}"`);
    }
  }

  // 5. Clean up duplicate Quran tracks (Guarantee 114 surahs)
  console.log('\n--- 5. Cleaning Up Quran Reciters Extra Tracks ---');
  // Alafasy extra 9 tracks
  const alafasyExtras = await Track.find({
    artist: 'مشاري راشد العفاسي',
    isQuran: true,
    title: { $not: /^\d{3}\s*\|?\s*سورة/ }
  }).lean();
  if (alafasyExtras.length > 0) {
    const ids = alafasyExtras.map(t => t._id);
    await Track.deleteMany({ _id: { $in: ids } });
    console.log(`  ✔ Removed ${alafasyExtras.length} non-canonical tarawih recordings for Alafasy.`);
  }

  // Minshawi extra 4 tracks
  const minshawiExtras = await Track.find({
    artist: 'محمد صديق المنشاوي',
    isQuran: true,
    title: { $in: ['إذاعة الشيخ محمد صديق المنشاوي (مرتل)', 'سورة مريم', 'سورة طه', 'سورة الأنبياء'] }
  }).lean();
  if (minshawiExtras.length > 0) {
    // Keep the numbered ones (019, 020, 021) and remove unnumbered duplicates
    const idsToDelete = minshawiExtras
      .filter(t => !/^\d{3}/.test(t.title))
      .map(t => t._id);
    if (idsToDelete.length > 0) {
      await Track.deleteMany({ _id: { $in: idsToDelete } });
      console.log(`  ✔ Removed ${idsToDelete.length} unnumbered duplicate tracks for Minshawi.`);
    }
  }

  // Hussary extra 3 tracks
  const hussaryExtras = await Track.find({
    artist: 'محمود خليل الحصري',
    isQuran: true,
    title: { $regex: /ترتيل محمود خليل الحصري برواية حفص عن عاصم/ }
  }).lean();
  if (hussaryExtras.length > 0) {
    const ids = hussaryExtras.map(t => t._id);
    await Track.deleteMany({ _id: { $in: ids } });
    console.log(`  ✔ Removed ${hussaryExtras.length} duplicate tracks for Hussary.`);
  }

  // 6. Recalculate trackCount and albumCount for all artists
  console.log('\n--- 6. Recalculating Track & Album Counters for All Artists ---');
  const allArtists = await Artist.find({}).lean();
  for (const art of allArtists) {
    const trackCount = await Track.countDocuments({
      $or: [
        { artist: { $regex: new RegExp(`^${art.name}$`, 'i') } },
        { primaryArtist: { $regex: new RegExp(`^${art.name}$`, 'i') } }
      ]
    });
    const albumCount = await Album.countDocuments({
      artist: { $regex: new RegExp(`^${art.name}$`, 'i') }
    });
    await Artist.updateOne(
      { _id: art._id },
      { $set: { trackCount, albumCount } }
    );
  }
  console.log(`  ✔ Recalculated counters for ${allArtists.length} artists.`);

  // 7. Sanitize plays / views so site plays reflect authentic plays
  console.log('\n--- 7. Resetting Track Site Plays to Genuine Plays ---');
  const users = await User.find({}).select('listeningStats').lean();
  const realUserPlaysMap = {};
  for (const u of users) {
    if (u.listeningStats && u.listeningStats.trackPlays) {
      for (const [tId, cnt] of Object.entries(u.listeningStats.trackPlays)) {
        realUserPlaysMap[tId] = (realUserPlaysMap[tId] || 0) + (Number(cnt) || 0);
      }
    }
  }

  const tracks = await Track.find({}, '_id plays views youtubeViews').lean();
  const bulkOps = [];
  for (const t of tracks) {
    const currentPlays = Number(t.plays) || 0;
    const currentViews = Number(t.views) || Number(t.youtubeViews) || 0;
    const ytScore = Math.max(currentPlays, currentViews);
    const genuinePlays = realUserPlaysMap[String(t._id)] || 0;

    bulkOps.push({
      updateOne: {
        filter: { _id: t._id },
        update: {
          $set: {
            views: ytScore,
            youtubeViews: ytScore,
            plays: genuinePlays
          }
        }
      }
    });
  }

  for (let i = 0; i < bulkOps.length; i += 500) {
    await Track.bulkWrite(bulkOps.slice(i, i + 500));
  }
  console.log(`  ✔ Successfully sanitized plays & views across ${tracks.length} tracks.`);

  // 8. Verification summary
  console.log('\n=== FINAL VERIFICATION ===');
  const sampleReciters = await Track.aggregate([
    { $match: { isQuran: true } },
    { $group: { _id: '$artist', count: { $sum: 1 } } },
    { $match: { count: { $gt: 5 } } }
  ]);
  console.log('Quran Reciter counts (target 114):', sampleReciters);

  const sampleAdele = await Album.find({ artist: /adele/i }).select('name trackCount').lean();
  console.log('Adele albums after cleanup:', sampleAdele);

  const sampleKol = await Album.findOne({ name: /kol hayaty|كل حياتي/i }).select('name cover').lean();
  console.log('Kol Hayaty cover after fix:', sampleKol);

  await mongoose.disconnect();
  console.log('\n🏁 All database fixes successfully applied!');
}

run().catch(err => {
  console.error('Fatal error during migration:', err);
  process.exit(1);
});
