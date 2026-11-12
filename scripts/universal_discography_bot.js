const mongoose = require('mongoose');
const axios = require('axios');
require('dotenv').config({ path: '/home/ubuntu/rivo/.env' });

const { getCanonicalArtistName } = require('../server/utils/artistAlbumUtils');
const { Album, Track, Playlist } = require('../server/models');

// Verified HD 1200x1200bb Apple Music CDN Artwork
const CANONICAL_ALBUM_COVERS = {
  'talatini': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/21/df/b8/21dfb8ce-a9ea-722d-2fe4-d2c679a781d4/cover.jpg/1200x1200bb.jpg',
  'تلاتيني': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/21/df/b8/21dfb8ce-a9ea-722d-2fe4-d2c679a781d4/cover.jpg/1200x1200bb.jpg',
  'matador': 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/2c/31/54/2c31548e-cfbe-639a-7c2a-89a19c629e46/195497282647.jpg/1200x1200bb.jpg',
  'ماتادور': 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/2c/31/54/2c31548e-cfbe-639a-7c2a-89a19c629e46/195497282647.jpg/1200x1200bb.jpg',
  'supernova': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/7f/a0/00/7fa00086-e72c-191b-6547-e8992f774a9a/885288056853.jpg/1200x1200bb.jpg',
  'roma': 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/46/81/82/468182bd-6914-bf7d-2f4a-4cb4bd5175cd/196925215671.jpg/1200x1200bb.jpg',
  'noaata beida': 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/e9/de/11/e9de11f3-be73-e0df-b4ff-72dd702476e3/196626997326.jpg/1200x1200bb.jpg',
  'the ugly ducklings': 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/17/21/ff/1721ffa2-9895-8c92-43af-eaebd0a31cc6/3615938009819.png/1200x1200bb.jpg',
  'ابناء البطة السوداء': 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/17/21/ff/1721ffa2-9895-8c92-43af-eaebd0a31cc6/3615938009819.png/1200x1200bb.jpg',
  'nas w nas': 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/64/78/b1/6478b176-8977-c2fb-bacd-761567625b00/196925011204.jpg/1200x1200bb.jpg',
  'placebo': 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/3d/be/1a/3dbe1ae5-a9c0-ff0c-d8ea-3b87692cadeb/6221216529510_cover.png/1200x1200bb.jpg',
  'plan-b': 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/ef/28/e0/ef28e07b-c631-8981-55f4-a8979a433fc5/6221216496775_cover.jpg/1200x1200bb.jpg',
  'agzakhana': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/65/7c/94/657c9473-c77e-601c-9bbc-4540ecc2c08b/6221216496768_Artwork.jpg/1200x1200bb.jpg',
  'bgd': 'https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/b8/01/5e/b8015e1f-13a8-44d4-20b1-ce3cb6ea861a/196626466989.jpg/1200x1200bb.jpg',
  '191-181': 'https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/3b/b1/68/3bb16886-f404-54c2-9e20-7f2cb09e13f4/196925008549.jpg/1200x1200bb.jpg',
  'florida': 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/4a/1c/91/4a1c91d3-45fe-515c-3f1f-df436f521bb3/195497478057.jpg/1200x1200bb.jpg',
  'aqareb': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/33/f0/ec/33f0ece3-d007-4cdd-03b7-de6dfaa1442b/199806680476.jpg/1200x1200bb.jpg',
  'sahran': 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/11/49/a2/1149a2a7-5c55-bfa3-0c46-f94e9f90cf05/859737402638_Cover.jpg/1200x1200bb.jpg',
  'سهران': 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/11/49/a2/1149a2a7-5c55-bfa3-0c46-f94e9f90cf05/859737402638_Cover.jpg/1200x1200bb.jpg',
  'kol hayaty': 'https://is1-ssl.mzstatic.com/image/thumb/Music118/v4/64/08/df/6408df48-f62f-0d92-29fc-4c4dbb9bcae7/859727400347_Cover.jpg/1200x1200bb.jpg',
  'كل حياتي': 'https://is1-ssl.mzstatic.com/image/thumb/Music118/v4/64/08/df/6408df48-f62f-0d92-29fc-4c4dbb9bcae7/859727400347_Cover.jpg/1200x1200bb.jpg',
  'meaddy el nas': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/d2/e1/97/d2e19759-e749-749a-a439-1e310ac89f14/889502763589.jpg/1200x1200bb.jpg',
  'معدي الناس': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/d2/e1/97/d2e19759-e749-749a-a439-1e310ac89f14/889502763589.jpg/1200x1200bb.jpg',
  'ahla w ahla': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/a8/81/9f/a8819f9f-99f8-eb28-6a73-fcae47843bc8/3616842352848.jpg/1200x1200bb.jpg',
  'أحلى وأحلى': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/a8/81/9f/a8819f9f-99f8-eb28-6a73-fcae47843bc8/3616842352848.jpg/1200x1200bb.jpg',
  'eish beshoak': 'https://is1-ssl.mzstatic.com/image/thumb/Music118/v4/15/d5/43/15d54341-26ec-8be5-61be-d7f4be2b8ee3/3615934057869.png/1200x1200bb.jpg',
  'عيش بشوقك': 'https://is1-ssl.mzstatic.com/image/thumb/Music118/v4/15/d5/43/15d54341-26ec-8be5-61be-d7f4be2b8ee3/3615934057869.png/1200x1200bb.jpg',
  'khallik foulazy': 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/b4/d9/31/b4d9319e-e4a8-4221-ce16-7eebe39695be/3616553818961.jpg/1200x1200bb.jpg',
  'خليك فولاذي': 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/b4/d9/31/b4d9319e-e4a8-4221-ce16-7eebe39695be/3616553818961.jpg/1200x1200bb.jpg',
  'ashamgy': 'https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/37/10/7c/37107c11-9a70-8b1d-fc30-c322d7ba59eb/3616848805362.jpg/1200x1200bb.jpg',
  'عشأنجي': 'https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/37/10/7c/37107c11-9a70-8b1d-fc30-c322d7ba59eb/3616848805362.jpg/1200x1200bb.jpg',
  'tegy nrahan': 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/7c/4f/7b/7c4f7b49-bdf3-85f2-95f2-6c39bb2f9746/3616843477816.jpg/1200x1200bb.jpg',
  'تيجي نتراهن': 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/7c/4f/7b/7c4f7b49-bdf3-85f2-95f2-6c39bb2f9746/3616843477816.jpg/1200x1200bb.jpg',
  'ayam': 'https://is1-ssl.mzstatic.com/image/thumb/Music128/v4/6c/0e/41/6c0e4171-897b-bb68-ea48-fbf5272a2754/859730591025_Cover.jpg/1200x1200bb.jpg',
  'أيام': 'https://is1-ssl.mzstatic.com/image/thumb/Music128/v4/6c/0e/41/6c0e4171-897b-bb68-ea48-fbf5272a2754/859730591025_Cover.jpg/1200x1200bb.jpg'
};

async function fetchItunesAlbum(artistName, albumName) {
  try {
    const q = encodeURIComponent(`${artistName} ${albumName}`);
    const res = await axios.get(`https://itunes.apple.com/search?term=${q}&entity=album&limit=5`, { timeout: 8000 });
    if (res.data?.results?.length > 0) {
      const match = res.data.results[0];
      return {
        name: match.collectionName,
        cover: match.artworkUrl100 ? match.artworkUrl100.replace('100x100bb', '1200x1200bb') : null,
        year: match.releaseDate ? new Date(match.releaseDate).getFullYear() : null,
        genre: match.primaryGenreName
      };
    }
  } catch {}
  return null;
}

function cleanTitleForComparison(title) {
  if (!title) return '';
  return title
    .toLowerCase()
    .replace(/\s*[\(\[\{].*?[\)\]\}]\s*/g, ' ') // remove parentheses content
    .replace(/official\s*(?:music)?\s*video|فيديو\s*كليب|الكليب\s*الرسمي|كليب/gi, '')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .trim()
    .replace(/\s+/g, ' ');
}

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('[DiscographyBot] Connected to MongoDB.');

  // Clean up any stray album without real id
  await Album.deleteMany({ $or: [{ id: null }, { id: { $exists: false } }, { id: 'undefined' }] });

  // ==========================================
  // STEP 1: Fix Album Artwork in MongoDB
  // ==========================================
  console.log('\n--- Step 1: Fixing Canonical Album Covers in MongoDB ---');
  const allAlbums = await Album.find();
  for (const alb of allAlbums) {
    const rawName = (alb.name || '').trim();
    const cleanKey = rawName.replace(/^Album\s*[-–—:]\s*/i, '').trim().toLowerCase();
    const targetCover = CANONICAL_ALBUM_COVERS[cleanKey];

    if (targetCover && alb.cover !== targetCover) {
      console.log(`[Cover Update] "${alb.name}" -> ${targetCover}`);
      alb.cover = targetCover;
      await alb.save();

      // Sync tracks inside this album
      if (alb.trackIds && alb.trackIds.length > 0) {
        await Track.updateMany(
          { _id: { $in: alb.trackIds } },
          { $set: { cover: targetCover, album: alb.name } }
        );
      }
    }
  }

  // ==========================================
  // STEP 2: Link 3ASH to TALATINI (El Joker)
  // ==========================================
  console.log('\n--- Step 2: Ensuring 3ASH is in TALATINI ---');
  const talatiniAlbum = await Album.findOne({ name: /TALATINI/i, artist: /Joker|الجوكر/i });
  const ayeshTrack = await Track.findOne({ title: /^3ASH$/i, artist: /Joker|الجوكر/i });
  if (talatiniAlbum && ayeshTrack) {
    const trackIdStr = String(ayeshTrack._id);
    if (!talatiniAlbum.trackIds.map(String).includes(trackIdStr)) {
      talatiniAlbum.trackIds.push(ayeshTrack._id);
      await talatiniAlbum.save();
      console.log(`[3ASH] Added 3ASH (${ayeshTrack._id}) to TALATINI album.`);
    }
    await Track.updateOne({ _id: ayeshTrack._id }, {
      $set: {
        album: 'TALATINI',
        cover: talatiniAlbum.cover
      }
    });
    console.log(`[3ASH] Updated 3ASH track record with TALATINI album & cover.`);
  }

  // ==========================================
  // STEP 3: Remove Video Clip Duplicates
  // ==========================================
  console.log('\n--- Step 3: Detecting & Deduplicating Video Clip Tracks ---');
  const nonQuranTracks = await Track.find({
    isQuran: { $ne: true },
    contentType: { $ne: 'quran' },
    genre: { $not: /quran|قرآن/i }
  }).lean();

  const tracksByArtist = {};
  for (const t of nonQuranTracks) {
    const cArtist = getCanonicalArtistName(t.artist) || t.artist || 'Unknown';
    if (!tracksByArtist[cArtist]) tracksByArtist[cArtist] = [];
    tracksByArtist[cArtist].push(t);
  }

  let deletedDups = 0;
  for (const [artist, tList] of Object.entries(tracksByArtist)) {
    if (tList.length < 2) continue;

    // Separate tracks that have explicit clip keywords vs clean ones
    const isClip = (t) => /official\s*(?:music)?\s*video|فيديو\s*كليب|الكليب\s*الرسمي|\bكليب\b|video clip/i.test(t.title || '');
    const isCleanAudio = (t) => !isClip(t);

    const clips = tList.filter(isClip);
    const cleans = tList.filter(isCleanAudio);

    for (const clip of clips) {
      const clipCleanTitle = cleanTitleForComparison(clip.title);
      if (!clipCleanTitle || clipCleanTitle.length < 3) continue;

      // Find if there is a clean audio version with the same base title and similar duration
      const match = cleans.find(c => {
        const cCleanTitle = cleanTitleForComparison(c.title);
        const titleMatch = (clipCleanTitle === cCleanTitle) || 
                           (clipCleanTitle.includes(cCleanTitle) && cCleanTitle.length > 4) ||
                           (cCleanTitle.includes(clipCleanTitle) && clipCleanTitle.length > 4);
        const durDiff = Math.abs((clip.duration || 0) - (c.duration || 0));
        return titleMatch && (durDiff <= 25 || !clip.duration || !c.duration);
      });

      if (match && String(clip._id) !== String(match._id)) {
        console.log(`[Duplicate Clip Found] Clip: "${clip.title}" (${clip._id}) -> Keeping Clean: "${match.title}" (${match._id})`);

        // Replace references in playlists
        await Playlist.updateMany(
          { trackIds: clip._id },
          { $set: { "trackIds.$[elem]": match._id } },
          { arrayFilters: [{ elem: clip._id }] }
        );

        // Remove clip from albums
        await Album.updateMany(
          { trackIds: clip._id },
          { $pull: { trackIds: clip._id } }
        );

        // Delete the duplicate clip track
        await Track.deleteOne({ _id: clip._id });
        deletedDups++;
      }
    }
  }
  console.log(`[Deduplication Complete] Removed ${deletedDups} redundant video clip tracks.`);

  // ==========================================
  // STEP 4: Group Remaining Tracks into Official Albums
  // ==========================================
  console.log('\n--- Step 4: Grouping Artist Tracks into Official Albums ---');
  const targetArtists = ['Amr Diab', 'Tamer Hosny', 'Wegz', 'Marwan Pablo', 'Tamer Ashour', 'Sherine', 'Mohamed Hamaki', 'Cairokee', 'Lege-Cy', 'El Joker'];

  for (const tArtist of targetArtists) {
    const artistTracks = await Track.find({
      $or: [
        { artist: new RegExp(tArtist, 'i') },
        { artist: { $in: [tArtist, getCanonicalArtistName(tArtist)] } }
      ],
      isQuran: { $ne: true }
    });

    console.log(`\nArtist [${tArtist}]: ${artistTracks.length} tracks.`);

    // Group tracks by album field or search iTunes
    for (const track of artistTracks) {
      if (!track.album || ['youtube', 'single', 'singles', 'unknown', ''].includes(track.album.toLowerCase())) {
        // Search iTunes for this track to discover its official album
        try {
          const q = encodeURIComponent(`${tArtist} ${cleanTitleForComparison(track.title)}`);
          const res = await axios.get(`https://itunes.apple.com/search?term=${q}&entity=song&limit=3`, { timeout: 6000 });
          if (res.data?.results?.length > 0) {
            const best = res.data.results[0];
            const albumName = best.collectionName;
            const albumCover = best.artworkUrl100 ? best.artworkUrl100.replace('100x100bb', '1200x1200bb') : null;
            const releaseYear = best.releaseDate ? new Date(best.releaseDate).getFullYear() : null;

            if (albumName && !albumName.toLowerCase().includes('single') && albumCover) {
              console.log(`  -> Track "${track.title}" belongs to Album "${albumName}" (${releaseYear})`);
              track.album = albumName;
              track.cover = albumCover;
              await track.save();

              // Create or update Album document
              let alb = await Album.findOne({ 
                name: { $regex: new RegExp(`^${albumName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
                artist: { $regex: new RegExp(`^${tArtist.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
              });
              if (!alb) {
                const uniqueId = `album-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
                alb = new Album({
                  id: uniqueId,
                  name: albumName,
                  artist: tArtist,
                  cover: albumCover,
                  releaseDate: releaseYear ? String(releaseYear) : '',
                  trackIds: [String(track._id)],
                  isAlbum: true,
                  isSystem: true,
                  isPublic: true,
                  source: 'itunes_discography',
                  createdAt: new Date()
                });
                await alb.save();
                console.log(`  ⭐ Created new Album: "${albumName}" for ${tArtist} (id: ${uniqueId})`);
              } else {
                if (!alb.trackIds.map(String).includes(String(track._id))) {
                  alb.trackIds.push(String(track._id));
                  await alb.save();
                }
              }
            }
          }
        } catch {}
      } else {
        // Track already has an album name -> Ensure Album document exists and has HD cover
        const albumName = track.album.trim();
        let alb = await Album.findOne({ 
          name: { $regex: new RegExp(`^${albumName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
          artist: { $regex: new RegExp(`^${tArtist.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
        });
        const cleanKey = albumName.toLowerCase();
        const officialCover = CANONICAL_ALBUM_COVERS[cleanKey] || track.cover;

        if (!alb) {
          const uniqueId = `album-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
          alb = new Album({
            id: uniqueId,
            name: albumName,
            artist: tArtist,
            cover: officialCover,
            trackIds: [String(track._id)],
            isAlbum: true,
            isSystem: true,
            isPublic: true,
            source: 'track_album_sync',
            createdAt: new Date()
          });
          await alb.save();
          console.log(`  ⭐ Created Album document: "${albumName}" for ${tArtist} (id: ${uniqueId})`);
        } else {
          let dirty = false;
          if (!alb.trackIds.map(String).includes(String(track._id))) {
            alb.trackIds.push(String(track._id));
            dirty = true;
          }
          if (officialCover && alb.cover !== officialCover) {
            alb.cover = officialCover;
            dirty = true;
          }
          if (dirty) await alb.save();
        }
      }
    }
  }

  const finalAlbums = await Album.countDocuments();
  console.log(`\n========================================`);
  console.log(`Total Official Albums in MongoDB: ${finalAlbums}`);
  console.log(`========================================`);

  await mongoose.disconnect();
}

run().catch(console.error);
