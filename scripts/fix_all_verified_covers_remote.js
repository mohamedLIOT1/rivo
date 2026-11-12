const mongoose = require('mongoose');
const https = require('https');
const http = require('http');
require('dotenv').config({ path: '/home/ubuntu/rivo/.env' });

function checkUrl(url) {
  return new Promise((resolve) => {
    if (!url || typeof url !== 'string') return resolve(0);
    try {
      const u = new URL(url);
      const mod = u.protocol === 'https:' ? https : http;
      const req = mod.request(u, { method: 'HEAD', timeout: 5000 }, (res) => {
        resolve(res.statusCode);
      });
      req.on('error', () => resolve(0));
      req.on('timeout', () => { req.destroy(); resolve(408); });
      req.end();
    } catch (e) {
      resolve(0);
    }
  });
}

function searchItunesAlbum(term) {
  return new Promise((resolve) => {
    try {
      const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=album&country=EG&limit=5`;
      https.get(url, (res) => {
        let raw = '';
        res.on('data', d => raw += d);
        res.on('end', () => {
          try {
            const data = JSON.parse(raw);
            resolve(data.results || []);
          } catch(e) { resolve([]); }
        });
      }).on('error', () => resolve([]));
    } catch(e) { resolve([]); }
  });
}

const KNOWN_VERIFIED_COVERS = {
  // El Joker
  'talatini': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/0f/07/c7/0f07c79e-9717-bcc0-471b-32963e4f4bbf/6221117179777.jpg/600x600bb.jpg',
  // Marwan Moussa
  'matador': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/b2/77/a5/b277a527-2d33-a3be-6c49-7eaea3ed056f/6221117202772.jpg/600x600bb.jpg',
  // Lege-Cy
  'bgd': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/0a/1c/f8/0a1cf858-7be3-fbd4-910c-b339dc1e5f6d/6221216719980_Artwork.png/600x600bb.jpg',
  '191-181': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/4b/3b/74/4b3b7438-50f4-1555-fec5-cc40ed9d74a7/6221216496751_Artwork.jpg/600x600bb.jpg',
  'placebo': 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/3d/be/1a/3dbe1ae5-a9c0-ff0c-d8ea-3b87692cadeb/6221216529510_cover.png/600x600bb.jpg',
  'plan-b': 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/ef/28/e0/ef28e07b-c631-8981-55f4-a8979a433fc5/6221216496775_cover.jpg/600x600bb.jpg',
  'plan-b - ep': 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/ef/28/e0/ef28e07b-c631-8981-55f4-a8979a433fc5/6221216496775_cover.jpg/600x600bb.jpg',
  'agzakhana': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/65/7c/94/657c9473-c77e-601c-9bbc-4540ecc2c08b/6221216496768_Artwork.jpg/600x600bb.jpg',
  'album - 6 shohour': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/71/a2/1d/71a21d7d-a877-2513-eed7-727a5d88b77c/199350839948.jpg/600x600bb.jpg',
  'album - no problema': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/45/36/32/453632e0-9b7b-f51d-12ac-64651815b6df/6221216496690_Artwork.jpg/600x600bb.jpg',
  // Amr Diab
  'sahran': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/69/2f/b0/692fb07e-6ab9-467a-01f4-f12ec0a39a41/194660835758.jpg/600x600bb.jpg',
  'سهران': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/69/2f/b0/692fb07e-6ab9-467a-01f4-f12ec0a39a41/194660835758.jpg/600x600bb.jpg',
  'kol hayaty': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/53/72/e3/5372e3cc-173f-c5ed-88ac-d19ab6b381e8/5061028762894.jpg/600x600bb.jpg',
  'كل حياتي': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/53/72/e3/5372e3cc-173f-c5ed-88ac-d19ab6b381e8/5061028762894.jpg/600x600bb.jpg',
  'makanak': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/61/e2/77/61e2774e-d949-c7cc-01e0-ac9930c78f68/019771240652.jpg/600x600bb.jpg',
  'مكانك': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/61/e2/77/61e2774e-d949-c7cc-01e0-ac9930c78f68/019771240652.jpg/600x600bb.jpg',
  'ya ana ya la': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/6b/fa/d0/6bfad002-1f1c-046a-2d4d-a932841e00a5/3616842369259.jpg/600x600bb.jpg',
  'يا انا يا لا': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/6b/fa/d0/6bfad002-1f1c-046a-2d4d-a932841e00a5/3616842369259.jpg/600x600bb.jpg',
  'ahla w ahla': 'https://is1-ssl.mzstatic.com/image/thumb/Music118/v4/64/08/df/6408df48-e8ce-9f5b-9d41-eeefc6b81a8b/cover.jpg/600x600bb.jpg',
  'أحلى وأحلى': 'https://is1-ssl.mzstatic.com/image/thumb/Music118/v4/64/08/df/6408df48-e8ce-9f5b-9d41-eeefc6b81a8b/cover.jpg/600x600bb.jpg',
  'tamally maak': 'https://is1-ssl.mzstatic.com/image/thumb/Music69/v4/31/4d/d4/314dd42d-3246-e7a3-107a-3d521fa9a7e2/dj.iiicnpub.jpg/600x600bb.jpg',
  'تملي معاك': 'https://is1-ssl.mzstatic.com/image/thumb/Music69/v4/31/4d/d4/314dd42d-3246-e7a3-107a-3d521fa9a7e2/dj.iiicnpub.jpg/600x600bb.jpg',
  'amarain': 'https://is1-ssl.mzstatic.com/image/thumb/Music6/v4/b9/56/14/b956146c-cc81-19ce-8521-a53ec220d912/dj.lqunswjh.jpg/600x600bb.jpg',
  'قمرين': 'https://is1-ssl.mzstatic.com/image/thumb/Music6/v4/b9/56/14/b956146c-cc81-19ce-8521-a53ec220d912/dj.lqunswjh.jpg/600x600bb.jpg',
  // Wegz
  'aqareb': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/da/6b/6a/da6b6a17-8118-9b3b-b92e-7f1854ddea68/199538601800.jpg/600x600bb.jpg',
  'aqareb (side b)': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/72/f3/d6/72f3d6c8-f17d-fe79-ba17-5781a4a4bc87/199806555736.jpg/600x600bb.jpg',
  'gadwal el darb': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/0b/4b/83/0b4b83d4-e6c2-e172-970e-e58d68e02397/199066748190.jpg/600x600bb.jpg',
  // Cairokee
  'album - roma': 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/46/81/82/468182bd-6914-bf7d-2f4a-4cb4bd5175cd/196925215671.jpg/600x600bb.jpg',
  'album - supernova': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/7f/a0/00/7fa00086-e72c-191b-6547-e8992f774a9a/885288056853.jpg/600x600bb.jpg',
  'album - the ugly ducklings': 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/17/21/ff/1721ffa2-9895-8c92-43af-eaebd0a31cc6/3615938009819.png/600x600bb.jpg',
  'album - nas w nas': 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/64/78/b1/6478b176-8977-c2fb-bacd-761567625b00/196925011204.jpg/600x600bb.jpg',
  'album - noaata beida': 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/e9/de/11/e9de11f3-be73-e0df-b4ff-72dd702476e3/196626997326.jpg/600x600bb.jpg',
  'album - rivo': 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/6a/71/f3/6a71f3e3-b9c0-a08d-a782-4fead92c8ed6/cover.jpg/600x600bb.jpg',
  'album - roxi': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/ad/83/7f/ad837f70-04a2-b985-2e0b-dbeaf1f2c5c2/196872351095.jpg/600x600bb.jpg',
  // Marwan Pablo
  'ctrl - ep': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/25/99/06/25990612-bcc8-f286-57ea-c7cdb0aabe75/198588228821.jpg/600x600bb.jpg',
  'the last piece of art': 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/ea/d7/bc/ead7bc49-c2bb-e21a-23df-a2ff41034953/197190080810.jpg/600x600bb.jpg'
};

const ARTIST_AVATARS = {
  'Lege-Cy': 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/3d/be/1a/3dbe1ae5-a9c0-ff0c-d8ea-3b87692cadeb/6221216529510_cover.png/600x600bb.jpg',
  'Marwan Pablo': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/25/99/06/25990612-bcc8-f286-57ea-c7cdb0aabe75/198588228821.jpg/600x600bb.jpg',
  'Marwan Moussa': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/b2/77/a5/b277a527-2d33-a3be-6c49-7eaea3ed056f/6221117202772.jpg/600x600bb.jpg',
  'El Joker': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/0f/07/c7/0f07c79e-9717-bcc0-471b-32963e4f4bbf/6221117179777.jpg/600x600bb.jpg',
  'Cairokee': 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/46/81/82/468182bd-6914-bf7d-2f4a-4cb4bd5175cd/196925215671.jpg/600x600bb.jpg',
  'Wegz': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/da/6b/6a/da6b6a17-8118-9b3b-b92e-7f1854ddea68/199538601800.jpg/600x600bb.jpg',
  'Amr Diab': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/69/2f/b0/692fb07e-6ab9-467a-01f4-f12ec0a39a41/194660835758.jpg/600x600bb.jpg'
};

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to MongoDB');

  const Album = mongoose.connection.db.collection('albums');
  const Track = mongoose.connection.db.collection('tracks');
  const Artist = mongoose.connection.db.collection('artists');
  const Playlist = mongoose.connection.db.collection('playlists');

  // 1. Purge any album matching user playlist names
  const playlists = await Playlist.find().toArray();
  const playlistNames = new Set(playlists.map(p => p.name?.trim().toLowerCase()).filter(Boolean));
  // Add common user custom crate names
  ['peter parker', 'nv.1', 'mdi_9.05', 'mix', 'b.b', 'imported links', 'liked songs'].forEach(n => playlistNames.add(n));

  console.log(`Checking ${playlistNames.size} user playlist names to guard against album pollution...`);
  const badAlbumDel = await Album.deleteMany({
    $or: [
      { name: { $in: Array.from(playlistNames).map(n => new RegExp(`^${n}$`, 'i')) } },
      { name: 'Peter parker' },
      { name: 'Peter parker ' }
    ]
  });
  console.log(`Deleted ${badAlbumDel.deletedCount} erroneously created albums matching user playlists.`);

  // Clean tracks that have album set to user playlist name
  for (const pl of playlistNames) {
    const res = await Track.updateMany(
      { album: new RegExp(`^${pl.trim()}$`, 'i') },
      { $set: { album: 'Single' } }
    );
    if (res.modifiedCount > 0) {
      console.log(`Reset ${res.modifiedCount} tracks with album: "${pl}" -> "Single"`);
    }
  }

  // 2. Iterate all Albums and ensure every cover returns 200 OK
  const allAlbums = await Album.find().toArray();
  console.log(`\nVerifying covers for ${allAlbums.length} albums...`);

  let updatedCount = 0;
  for (const alb of allAlbums) {
    const albKey = (alb.name || '').trim().toLowerCase();
    let currentCover = alb.cover || '';

    // Standardize 1200x1200bb to 600x600bb
    if (currentCover.includes('/1200x1200bb.jpg')) {
      currentCover = currentCover.replace('/1200x1200bb.jpg', '/600x600bb.jpg');
    }

    let status = await checkUrl(currentCover);
    let targetCover = currentCover;

    // Check if we have a known verified cover
    if ((status !== 200 || !targetCover) && KNOWN_VERIFIED_COVERS[albKey]) {
      const known = KNOWN_VERIFIED_COVERS[albKey];
      const kStatus = await checkUrl(known);
      if (kStatus === 200) {
        targetCover = known;
        status = 200;
      }
    }

    // If still failing, dynamically search iTunes
    if (status !== 200 || !targetCover) {
      const results = await searchItunesAlbum(`${alb.artist || ''} ${alb.name || ''}`.trim());
      for (const r of results) {
        if (r.artworkUrl100) {
          const cand = r.artworkUrl100.replace('100x100bb.jpg', '600x600bb.jpg');
          const candStatus = await checkUrl(cand);
          if (candStatus === 200) {
            targetCover = cand;
            status = 200;
            break;
          }
        }
      }
    }

    if (targetCover && targetCover !== alb.cover) {
      console.log(`[FIXED] Album "${alb.name}" (${alb.artist}):\n  OLD: ${alb.cover}\n  NEW: ${targetCover} (status: ${status})`);
      await Album.updateOne({ _id: alb._id }, { $set: { cover: targetCover } });
      updatedCount++;

      // Update tracks belonging to this album
      if (alb.trackIds && alb.trackIds.length > 0) {
        const objIds = alb.trackIds.map(id => {
          try { return new mongoose.Types.ObjectId(id); } catch(e) { return id; }
        });
        await Track.updateMany(
          { _id: { $in: objIds } },
          { $set: { cover: targetCover, album: alb.name } }
        );
      }
      await Track.updateMany(
        { album: alb.name, artist: alb.artist },
        { $set: { cover: targetCover } }
      );
    } else {
      console.log(`[OK] Album "${alb.name}" (${alb.artist}) status ${status}`);
    }
  }

  // 3. Update Artist profiles
  console.log('\nUpdating Artist profile avatars & verified statuses...');
  for (const [artistName, avatarUrl] of Object.entries(ARTIST_AVATARS)) {
    const aStatus = await checkUrl(avatarUrl);
    if (aStatus === 200) {
      await Artist.updateMany(
        { name: new RegExp(`^${artistName}$`, 'i') },
        { $set: { avatar: avatarUrl, imageUrl: avatarUrl, cover: avatarUrl, isVerified: true } }
      );
      console.log(`✓ Updated artist profile "${artistName}" with verified avatar (200 OK)`);
    }
  }

  console.log(`\n🎉 Finished! Updated ${updatedCount} albums with verified high-res artwork.`);
  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
