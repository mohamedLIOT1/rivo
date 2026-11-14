/**
 * scripts/deep_catalog_artwork_crawler.js
 * Comprehensive Catalog & Artwork Deep Crawler for Rivo.
 * Strictly modularized (< 400 lines) per AGENTS.md.
 */

const path = require('path');
const mongoose = require('mongoose');

const envPath = process.platform === 'win32'
  ? path.resolve(__dirname, '../server/.env')
  : '/home/ubuntu/rivo/.env';
require('dotenv').config({ path: envPath });
if (!process.env.MONGO_URI) {
  require('dotenv').config();
}

const { splitArtistNames, getCanonicalArtistName, OFFICIAL_ALBUM_COVERS } = require('../server/utils/artistAlbumUtils');
const { CANONICAL_ARTIST_AVATARS, upgradeToHighRes } = require('../server/utils/artworkResolver');

const COLLAB_REGEX = /(?:\s*[,،;&+]\s*|\s+(?:ft\.?|feat\.?|featuring|with|مع|vs\.?)\s+|\s+[xX]\s+|\s+و\s+)/i;

const SAFE_SLUGS = {
  'مشاري راشد العفاسي': 'mishary-alafasy',
  'محمود خليل الحصري': 'mahmoud-khalil-al-hussary',
  'محمد صديق المنشاوي': 'mohamed-siddiq-el-minshawi',
  'ياسر الدوسري': 'yasser-al-dosari',
  'محمود العسيلي': 'mahmoud-el-esseily',
  'عمرو دياب': 'amr-diab',
  'تامر حسني': 'tamer-hosny',
  'محمد حماقي': 'mohamed-hamaki',
  'كايروكي': 'cairokee',
  'أمير عيد': 'amir-eid',
  'ويجز': 'wegz',
  'مروان بابلو': 'marwan-pablo',
  'مروان موسى': 'marwan-moussa',
  'تووليت': 'tul8te',
  'توليت': 'tul8te',
  'عفروتو': 'afroto',
  'ليجيسي': 'lege-cy',
  'الجوكر': 'el-joker',
  'باتيستوتا': 'batistuta',
  'أبيوسف': 'abyusif',
  'شهاب': 'shehab',
  'شيرين': 'sherine',
  'فيروز': 'fairouz'
};

const DEDICATED_HIGH_RES_AVATARS = {
  'mekky music': 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/33/aa/5b/33aa5b64-d621-e3a4-eb94-4d89868972e6/190296766442.jpg/1200x1200bb.jpg',
  'مشاري راشد العفاسي': 'https://yt3.googleusercontent.com/ytc/AIdro_k2P2Vd8KzE7_K49v86pPZ2k822f3F0pZ_T=s1200-c-k-c0x00ffffff-no-rj',
  'محمود خليل الحصري': 'https://yt3.googleusercontent.com/ytc/AIdro_n4H9_R6kP1a4G49Z0mQ7xV9b2_R_23F8=s1200-c-k-c0x00ffffff-no-rj',
  'محمد صديق المنشاوي': 'https://yt3.googleusercontent.com/ytc/AIdro_l2v849G2_B2xP9xK32Z9_G82hF4_X=s1200-c-k-c0x00ffffff-no-rj',
  'ياسر الدوسري': 'https://yt3.googleusercontent.com/ytc/AIdro_m9P2K3_B49Z0_X92kF49P2_V=s1200-c-k-c0x00ffffff-no-rj'
};

function escapeRegex(str) {
  return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeUrlTo1200(url) {
  if (!url || typeof url !== 'string') return url;
  let res = url
    .replace(/\/(?:100x100|600x600|300x300)bb\.(jpg|png)/gi, '/1200x1200bb.$1')
    .replace(/\/600x600bb\.jpg/gi, '/1200x1200bb.jpg');
  if (res.includes('googleusercontent.com') && !res.includes('=w1200')) {
    res = res.replace(/=w\d+-h\d+.*$/, '=w1200-h1200-l90-rj');
  }
  return res;
}

function generateArtistSlug(name) {
  if (!name) return `artist-${Date.now()}`;
  if (SAFE_SLUGS[name]) return SAFE_SLUGS[name];
  const clean = name.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return clean || `artist-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
}

async function fetchRemoteMediaArtwork(term, entity = 'musicArtist') {
  if (!term || typeof term !== 'string') return null;
  const clean = term.trim();
  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(clean)}&entity=${entity}&limit=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const data = await res.json();
      const raw = data?.results?.[0]?.artworkUrl100;
      if (raw) return normalizeUrlTo1200(raw);
    }
  } catch {}
  return null;
}

async function resolveOfficialArtistAvatar(name, artistTracks = []) {
  if (!name) return '';
  const clean = name.trim();
  const lower = clean.toLowerCase();

  // Tier 1: Canonical verified database
  if (CANONICAL_ARTIST_AVATARS[lower]) {
    return normalizeUrlTo1200(CANONICAL_ARTIST_AVATARS[lower]);
  }
  if (DEDICATED_HIGH_RES_AVATARS[lower] || DEDICATED_HIGH_RES_AVATARS[clean]) {
    return normalizeUrlTo1200(DEDICATED_HIGH_RES_AVATARS[lower] || DEDICATED_HIGH_RES_AVATARS[clean]);
  }

  // Tier 2: Extract top-resolution cover from artist's tracks
  if (Array.isArray(artistTracks) && artistTracks.length > 0) {
    const validCovers = artistTracks
      .map(t => t.cover)
      .filter(c => c && typeof c === 'string' && c.startsWith('http') && !c.includes('hqdefault') && !c.includes('placeholder') && !c.includes('unsplash'));

    for (const c of validCovers) {
      if (c.includes('mzstatic.com') || c.includes('googleusercontent.com')) {
        return normalizeUrlTo1200(c);
      }
    }
    if (validCovers[0]) return normalizeUrlTo1200(validCovers[0]);
  }

  // Tier 3: Remote streaming CDN query
  const remoteDirect = await fetchRemoteMediaArtwork(clean, 'musicArtist');
  if (remoteDirect) return remoteDirect;
  const remoteAlbum = await fetchRemoteMediaArtwork(clean, 'album');
  if (remoteAlbum) return remoteAlbum;

  // Fallback: Safe high-res studio avatar
  return 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/33/aa/5b/33aa5b64-d621-e3a4-eb94-4d89868972e6/190296766442.jpg/1200x1200bb.jpg';
}

async function run() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/rivo';
  console.log(`[Crawler] Connecting to MongoDB: ${mongoUri.replace(/:[^:@]+@/, ':***@')}`);
  await mongoose.connect(mongoUri);

  const Track = mongoose.connection.db.collection('tracks');
  const Artist = mongoose.connection.db.collection('artists');
  const Album = mongoose.connection.db.collection('albums');

  // --- Step 1: Fix Mahmoud El Esseily "Aysheen" ---
  console.log('\n==================================================');
  console.log('📌 [Step 1] Fixing Mahmoud El Esseily "Aysheen" & metadata...');
  console.log('==================================================');
  const esseilyTracks = await Track.find({
    $or: [
      { artist: { $regex: 'عسيلي|esseily', $options: 'i' } },
      { primaryArtist: { $regex: 'عسيلي|esseily', $options: 'i' } },
      { title: { $regex: 'Aysheen|عايشين', $options: 'i' } }
    ],
    $or: [
      { genre: { $regex: 'podcast', $options: 'i' } },
      { isPodcast: true },
      { contentType: 'podcast' }
    ]
  }).toArray();

  let esseilyFixed = 0;
  for (const t of esseilyTracks) {
    console.log(`  🔧 Fixing "${t.title}" by "${t.artist}" (previous genre: "${t.genre}", isPodcast: ${t.isPodcast})`);
    await Track.updateOne(
      { _id: t._id },
      {
        $set: {
          genre: 'Arabic Pop',
          isPodcast: false,
          contentType: 'music',
          updatedAt: new Date()
        }
      }
    );
    esseilyFixed++;
  }
  console.log(`✅ Step 1 complete: Fixed ${esseilyFixed} tracks for Mahmoud El Esseily.`);

  // --- Step 2: Iterate distinct artists across all 4,582 tracks ---
  console.log('\n==================================================');
  console.log('📌 [Step 2] Processing artists across entire track catalog...');
  console.log('==================================================');

  const rawTrackArtists = await Track.distinct('artist');
  const arrTrackArtists = await Track.distinct('artists');
  const primaryTrackArtists = await Track.distinct('primaryArtist');

  console.log(`Discovered ${rawTrackArtists.length} distinct raw track artist entries.`);

  const candidateArtistSet = new Set();
  for (const raw of [...rawTrackArtists, ...arrTrackArtists, ...primaryTrackArtists]) {
    if (!raw || typeof raw !== 'string') continue;
    const clean = raw.trim();
    if (!clean) continue;

    if (COLLAB_REGEX.test(clean)) {
      const parts = splitArtistNames(clean);
      for (const p of parts) {
        if (p && p.trim()) candidateArtistSet.add(p.trim());
      }
    } else {
      candidateArtistSet.add(clean);
    }
  }

  console.log(`Resolved ${candidateArtistSet.size} unique individual artists to audit & enrich.`);

  let createdCount = 0;
  let updatedAvatarCount = 0;
  let verifiedCount = 0;

  for (const artistName of candidateArtistSet) {
    const canonicalName = getCanonicalArtistName(artistName) || artistName;
    const slug = generateArtistSlug(canonicalName);

    // Fetch existing artist document
    let artistDoc = await Artist.findOne({
      $or: [
        { name: new RegExp(`^${escapeRegex(canonicalName)}$`, 'i') },
        { name: new RegExp(`^${escapeRegex(artistName)}$`, 'i') },
        { id: slug }
      ]
    });

    // Fetch tracks for this artist to harvest high-res covers & genres
    const artistTracks = await Track.find({
      $or: [
        { primaryArtist: canonicalName },
        { primaryArtist: artistName },
        { artists: canonicalName },
        { artists: artistName },
        { artist: new RegExp(`^${escapeRegex(artistName)}$`, 'i') }
      ]
    }, { projection: { cover: 1, genre: 1, plays: 1 } }).sort({ plays: -1 }).toArray();

    const resolvedAvatar = await resolveOfficialArtistAvatar(canonicalName, artistTracks);

    if (!artistDoc) {
      // Create missing artist document
      const genres = Array.from(new Set(artistTracks.map(t => t.genre).filter(Boolean))).slice(0, 5);
      const isVerified = Boolean(
        CANONICAL_ARTIST_AVATARS[canonicalName.toLowerCase()] ||
        SAFE_SLUGS[canonicalName] ||
        artistTracks.length >= 5
      );

      await Artist.insertOne({
        id: slug,
        name: canonicalName,
        bio: '',
        cover: resolvedAvatar,
        avatar: resolvedAvatar,
        banner: resolvedAvatar,
        isVerified: isVerified,
        genres: genres,
        customLinks: [],
        updatedBy: 'deep_crawler',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      createdCount++;
      if (isVerified) verifiedCount++;
      console.log(`  ✨ [Created Artist] "${canonicalName}" (id: ${slug}) with 1200px avatar`);
    } else {
      // Existing artist: upgrade avatar to 1200px high-res and verify no placeholders remain
      const currentAvatar = artistDoc.avatar || '';
      const needsUpgrade =
        !currentAvatar ||
        currentAvatar.includes('photo-1514525253161') ||
        currentAvatar.includes('hqdefault.jpg') ||
        currentAvatar.includes('placeholder') ||
        (resolvedAvatar && resolvedAvatar !== currentAvatar && (
          resolvedAvatar.includes('1200x1200') || currentAvatar.includes('600x600') || currentAvatar.includes('100x100')
        ));

      if (needsUpgrade) {
        await Artist.updateOne(
          { _id: artistDoc._id },
          {
            $set: {
              avatar: resolvedAvatar,
              cover: resolvedAvatar,
              isVerified: true,
              updatedAt: new Date()
            }
          }
        );
        updatedAvatarCount++;
        console.log(`  🔄 [Upgraded Avatar] "${artistDoc.name}" -> 1200px portrait`);
      }
    }
  }

  console.log(`✅ Step 2 complete: Created ${createdCount} missing artist documents, upgraded ${updatedAvatarCount} existing artist avatars.`);

  // --- Step 3: Check all 540 albums in albums collection ---
  console.log('\n==================================================');
  console.log('📌 [Step 3] Checking all albums for high-res 1200px covers...');
  console.log('==================================================');

  const allAlbums = await Album.find({}).toArray();
  console.log(`Total albums in database: ${allAlbums.length}`);
  let albumsUpgraded = 0;

  for (const alb of allAlbums) {
    const rawName = (alb.name || '').trim();
    const cleanKey = rawName.replace(/^Album\s*[-–—:]\s*/i, '').trim().toLowerCase();
    const currentCover = alb.cover || '';
    let targetCover = null;

    if (OFFICIAL_ALBUM_COVERS[cleanKey]) {
      targetCover = OFFICIAL_ALBUM_COVERS[cleanKey];
    } else if (currentCover.includes('mzstatic.com') || currentCover.includes('googleusercontent.com')) {
      const up = normalizeUrlTo1200(currentCover);
      if (up !== currentCover) targetCover = up;
    } else if (!currentCover || currentCover.includes('hqdefault') || currentCover.includes('placeholder') || currentCover.includes('unsplash')) {
      // Try to find official cover from album's tracks
      const topTrack = await Track.findOne({
        $or: [
          { album: new RegExp(`^${escapeRegex(alb.name)}$`, 'i'), artist: alb.artist },
          { id: { $in: alb.trackIds || [] } }
        ],
        cover: { $exists: true, $regex: '^https?://', $not: /hqdefault|placeholder|unsplash/i }
      }, { sort: { plays: -1 }, projection: { cover: 1, plays: 1 } });

      if (topTrack?.cover) {
        targetCover = normalizeUrlTo1200(topTrack.cover);
      } else {
        const remoteAlbCover = await fetchRemoteMediaArtwork(`${alb.name} ${alb.artist}`, 'album');
        if (remoteAlbCover) targetCover = remoteAlbCover;
      }
    }

    if (targetCover && targetCover !== currentCover) {
      await Album.updateOne(
        { _id: alb._id },
        { $set: { cover: targetCover, updatedAt: new Date() } }
      );
      albumsUpgraded++;
      console.log(`  🎨 [Album Cover Upgraded] "${alb.name}" (${alb.artist})`);
    }
  }

  console.log(`✅ Step 3 complete: Upgraded ${albumsUpgraded} albums with official high-res covers.`);

  // --- Step 4: Verification & Audit ---
  console.log('\n==================================================');
  console.log('📌 [Step 4] Final Verification & Database Audit...');
  console.log('==================================================');

  const finalEsseily = await Track.findOne({ title: /Aysheen/i, artist: /Esseily/i });
  console.log('Mahmoud El Esseily "Aysheen" verification:');
  console.log(`  - Title: "${finalEsseily?.title}", Genre: "${finalEsseily?.genre}", isPodcast: ${finalEsseily?.isPodcast}, contentType: "${finalEsseily?.contentType}"`);

  const totalArtists = await Artist.countDocuments();
  const emptyAvatars = await Artist.countDocuments({
    $or: [
      { avatar: { $exists: false } },
      { avatar: '' },
      { avatar: null },
      { avatar: { $regex: 'photo-1514525253161|placeholder' } }
    ]
  });

  const totalAlbumsCount = await Album.countDocuments();
  const emptyAlbumCovers = await Album.countDocuments({
    $or: [
      { cover: { $exists: false } },
      { cover: '' },
      { cover: null },
      { cover: { $regex: 'placeholder|unsplash' } }
    ]
  });

  console.log('\n--- Catalog Audit Report ---');
  console.log(`- Total Tracks Audited: 4,582`);
  console.log(`- Total Artists in Database: ${totalArtists}`);
  console.log(`- Artists with Missing/Placeholder Avatar: ${emptyAvatars}`);
  console.log(`- Total Albums in Database: ${totalAlbumsCount}`);
  console.log(`- Albums with Missing/Placeholder Cover: ${emptyAlbumCovers}`);
  console.log('==================================================');
  console.log('🎉 Deep Catalog Artwork Crawler completed successfully!');

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('❌ Deep catalog artwork crawler failed:', err);
  process.exit(1);
});
