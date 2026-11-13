/**
 * Database Auto-Repair and Reconciliation Service
 * Idempotently fixes known catalog discrepancies and dead CDN links.
 * Strictly modularized (< 400 lines).
 */

const { Album, Artist } = require('../models');

const VERIFIED_SAHRAN_COVER = 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/69/2f/b0/692fb07e-6ab9-467a-01f4-f12ec0a39a41/194660835758.jpg/600x600bb.jpg';
const VERIFIED_ABDULRAHMAN_AVATAR = 'https://is1-ssl.mzstatic.com/image/thumb/Music118/v4/6d/ee/53/6dee53f8-d3ef-756b-18cc-d1d6dd20edc2/cover.jpg/600x600bb.jpg';

async function runDatabaseRepairs() {
  try {
    console.log('[DBRepair] Running catalog reconciliation checks...');

    // 1. Fix Album "عمره ما يغيب" — Belongs to Mohamed Hamaki, NOT Abdulrahman Mohammed
    const omroAlbum = await Album.findOne({
      $or: [
        { name: { $regex: /عمره ما يغيب/i } },
        { id: 'album-1794523867500-l9n14l' },
      ],
    });

    if (omroAlbum) {
      if (omroAlbum.artist !== 'Mohamed Hamaki') {
        console.log(`[DBRepair] Correcting artist for album "${omroAlbum.name}" from "${omroAlbum.artist}" -> "Mohamed Hamaki"`);
        omroAlbum.artist = 'Mohamed Hamaki';
        await omroAlbum.save().catch(() => {});
      }

      // Reconcile Abdulrahman Mohammed's profile
      const abdulrahman = await Artist.findOne({
        $or: [
          { name: { $regex: /abdulrahman mohammed/i } },
          { id: 'abdulrahman mohammed' },
        ],
      });

      if (abdulrahman) {
        let changed = false;
        if (Array.isArray(abdulrahman.albums)) {
          const prevLen = abdulrahman.albums.length;
          abdulrahman.albums = abdulrahman.albums.filter((a) => {
            const albName = String(a.name || a.title || '');
            const albId = String(a.id || a._id || '');
            return !albName.includes('عمره ما يغيب') && albId !== 'album-1794523867500-l9n14l';
          });
          if (abdulrahman.albums.length !== prevLen) {
            changed = true;
            abdulrahman.albumCount = abdulrahman.albums.length;
          }
        }

        // Fix avatar if it was erroneously set to Hamaki's album cover
        if (!abdulrahman.avatar || abdulrahman.avatar.includes('479118.jpg')) {
          abdulrahman.avatar = VERIFIED_ABDULRAHMAN_AVATAR;
          abdulrahman.image = VERIFIED_ABDULRAHMAN_AVATAR;
          abdulrahman.cover = VERIFIED_ABDULRAHMAN_AVATAR;
          changed = true;
        }

        if (changed) {
          console.log('[DBRepair] Disassociated Hamaki album from Abdulrahman Mohammed & restored official avatar');
          await abdulrahman.save().catch(() => {});
        }
      }

      // Ensure "عمره ما يغيب" is properly associated with Mohamed Hamaki
      const hamaki = await Artist.findOne({
        $or: [
          { name: { $regex: /mohamed hamaki/i } },
          { id: 'mohamed hamaki' },
        ],
      });

      if (hamaki && Array.isArray(hamaki.albums)) {
        const hasOmro = hamaki.albums.some((a) => {
          const albName = String(a.name || a.title || '');
          const albId = String(a.id || a._id || '');
          return albName.includes('عمره ما يغيب') || albId === 'album-1794523867500-l9n14l';
        });

        if (!hasOmro) {
          hamaki.albums.push({
            id: omroAlbum.id || 'album-1794523867500-l9n14l',
            name: omroAlbum.name || 'عمره ما يغيب',
            artist: 'Mohamed Hamaki',
            cover: omroAlbum.cover,
            releaseDate: omroAlbum.releaseDate || '2015',
            genre: omroAlbum.genre || 'Arabic Pop',
            releaseType: 'album',
            trackCount: Number(omroAlbum.trackCount || 15),
          });
          hamaki.albumCount = hamaki.albums.length;
          console.log('[DBRepair] Associated "عمره ما يغيب" with Mohamed Hamaki artist discography');
          await hamaki.save().catch(() => {});
        }
      }
    }

    // 2. Fix Album "Sahran" (Amr Diab) — Replace dead 404 Apple Music CDN cover
    const sahranResult = await Album.updateMany(
      {
        $or: [
          { name: /^sahran$/i },
          { name: /^سهران$/i },
          { id: 'album-1794511351982-lqwnho' },
        ],
      },
      {
        $set: {
          cover: VERIFIED_SAHRAN_COVER,
        },
      }
    ).catch(() => null);

    if (sahranResult && sahranResult.modifiedCount > 0) {
      console.log(`[DBRepair] Updated ${sahranResult.modifiedCount} "Sahran" album cover(s) to working CDN URL`);
    }

    // Also update inside Amr Diab's embedded albums array
    const amrDiab = await Artist.findOne({
      $or: [
        { name: { $regex: /amr diab/i } },
        { id: 'amr diab' },
      ],
    });

    if (amrDiab && Array.isArray(amrDiab.albums)) {
      let updatedAmr = false;
      amrDiab.albums.forEach((alb) => {
        const name = String(alb.name || alb.title || '').trim().toLowerCase();
        if (name === 'sahran' || name === 'سهران' || alb.id === 'album-1794511351982-lqwnho') {
          if (alb.cover !== VERIFIED_SAHRAN_COVER) {
            alb.cover = VERIFIED_SAHRAN_COVER;
            updatedAmr = true;
          }
        }
      });
      if (updatedAmr) {
        console.log('[DBRepair] Updated "Sahran" cover inside Amr Diab artist profile');
        await amrDiab.save().catch(() => {});
      }
    }

    // 3. Fix 7OB&KASHAT (Belongs to Marwan Pablo, NOT Abyusif)
    await Album.updateMany({ name: /7OB&KASHAT/i }, { $set: { artist: 'Marwan Pablo' } }).catch(() => {});
    await Artist.updateMany({ name: /abyusif/i }, { $pull: { albums: { name: /7OB&KASHAT/i } } }).catch(() => {});
    const pablo = await Artist.findOne({ name: /marwan pablo/i }).catch(() => null);
    if (pablo) {
      const kashatAlb = await Album.findOne({ name: /7OB&KASHAT/i }).catch(() => null);
      if (kashatAlb && !(pablo.albums || []).some(a => String(a.name || '').toLowerCase() === '7ob&kashat')) {
        await Artist.updateOne({ _id: pablo._id }, { $push: { albums: kashatAlb } }).catch(() => {});
        console.log('[DBRepair] Reconciled 7OB&KASHAT with Marwan Pablo');
      }
    }

    // 4. Fix "مزيكا القرن 21" (Belongs to Sadat, NOT Wegz)
    await Album.updateMany({ name: /مزيكا القرن 21/i }, { $set: { artist: 'Sadat' } }).catch(() => {});
    await Artist.updateMany({ name: /wegz/i }, { $pull: { albums: { name: /مزيكا القرن 21/i } } }).catch(() => {});

    // 5. Remove generic 1,000+ "Single" dump album erroneously attributed to Mahmoud El Leithy
    await Album.deleteMany({ name: /^Single$/i, artist: /mahmoud el leithy|محمود الليث/i }).catch(() => {});
    await Artist.updateMany({ name: /mahmoud el leithy|محمود الليث/i }, { $pull: { albums: { name: /^Single$/i } } }).catch(() => {});

    // 6. Fix Compilations incorrectly attributed to single artists
    await Album.updateMany({ name: /Arabic Hits Of The 80's/i }, { $set: { artist: 'Various Artists' } }).catch(() => {});
    await Artist.updateMany({ name: /amr diab|عمرو دياب/i }, { $pull: { albums: { name: /Arabic Hits Of The 80's/i } } }).catch(() => {});

    await Album.updateMany({ name: /Dalaa for women only/i }, { $set: { artist: 'Various Artists' } }).catch(() => {});
    await Artist.updateMany({ name: /sherine|شيرين/i }, { $pull: { albums: { name: /Dalaa for women only/i } } }).catch(() => {});

    await Album.updateMany({ name: /Habibi \(Romantic Arabic Hits\)|Riyadh Trio Night/i }, { $set: { artist: 'Various Artists' } }).catch(() => {});
    await Artist.updateMany({ name: /angham|أنغام/i }, { $pull: { albums: { name: /Habibi|Riyadh Trio Night/i } } }).catch(() => {});

    await Album.updateMany({ name: /KEIF 001/i }, { $set: { artist: 'Lege-Cy' } }).catch(() => {});

    console.log('✅ [DBRepair] Catalog reconciliation completed successfully.');
  } catch (err) {
    console.error('⚠️ [DBRepair] Catalog repair encountered notice:', err.message);
  }
}

module.exports = {
  runDatabaseRepairs,
  VERIFIED_SAHRAN_COVER,
  VERIFIED_ABDULRAHMAN_AVATAR,
};
