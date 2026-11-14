/**
 * Multi-Tier High-Resolution Artwork Resolver
 * Fetches canonical high-res avatars & covers from:
 * 1. Hardcoded High-Res Canonical Database
 * 2. High-Res Media CDN (1000x1000 / 600x600)
 * 3. Existing Album & Track Cover Harvest
 * Strictly modularized (< 400 lines) per AGENTS.md.
 */

const { Track, Artist, Album } = require('../models');

// Built-in verified high-resolution portraits for core catalog artists (1200px prioritized)
const CANONICAL_ARTIST_AVATARS = {
  'amr diab': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/69/2f/b0/692fb07e-6ab9-467a-01f4-f12ec0a39a41/194660835758.jpg/1200x1200bb.jpg',
  'tamer hosny': 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/91/ba/6d/91ba6de9-d79a-daca-e5e3-d5d13e1bb000/3615933755032.jpg/1200x1200bb.jpg',
  'cairokee': 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/46/81/82/468182bd-6914-bf7d-2f4a-4cb4bd5175cd/196925215671.jpg/1200x1200bb.jpg',
  'mohamed hamaki': 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/33/aa/5b/33aa5b64-d621-e3a4-eb94-4d89868972e6/190296766442.jpg/1200x1200bb.jpg',
  'marwan pablo': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/25/99/06/25990612-bcc8-f286-57ea-c7cdb0aabe75/198588228821.jpg/1200x1200bb.jpg',
  'wegz': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/da/6b/6a/da6b6a17-8118-9b3b-b92e-7f1854ddea68/199538601800.jpg/1200x1200bb.jpg',
  'lege-cy': 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/3d/be/1a/3dbe1ae5-a9c0-ff0c-d8ea-3b87692cadeb/6221216529510_cover.png/1200x1200bb.jpg',
  'el joker': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/0f/07/c7/0f07c79e-9717-bcc0-471b-32963e4f4bbf/6221117179777.jpg/1200x1200bb.jpg',
  'tul8te': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/91/92/51/91925187-578f-ef47-bb71-c035616b23d9/198588806296.jpg/1200x1200bb.jpg',
  'sherine': 'https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/bf/f4/bc/bff4bce9-14a0-5696-6ae8-0051871a2dd6/3617056073114_cover.jpg/1200x1200bb.jpg',
  'fairouz': 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/b8/b6/2a/b8b62a1a-3e3e-4629-873b-eb061c4bb6c9/cover.jpg/1200x1200bb.jpg',
  'radiohead': 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/1f/2c/8b/1f2c8bd3-07cb-17fe-f1f0-0fa415392e62/634904078385.png/1200x1200bb.jpg',
  'ahmed mounib': 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/b2/8e/58/b28e58f2-2b62-e1d2-0448-4e892c2a04e5/cover.jpg/1200x1200bb.jpg',
  'abyusif': 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/a4/96/60/a496603a-028c-0f9c-70fc-e68b377b5a19/cover.jpg/1200x1200bb.jpg',
  'lil baba': 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/44/e0/f8/44e0f8f8-b30a-9d0a-b33a-d68a9b9a68bc/cover.jpg/1200x1200bb.jpg',
  'tamer ashour': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/75/a6/3c/75a63c60-1b4b-3902-f5ec-0c4857ce576f/3617226805912_cover.jpg/1200x1200bb.jpg',
  'marwan moussa': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/b2/77/a5/b277a527-2d33-a3be-6c49-7eaea3ed056f/6221117202772.jpg/1200x1200bb.jpg',
  'karim osama': 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/a9/37/d1/a937d11d-2856-11f8-f404-5f11181f8f30/cover.jpg/1200x1200bb.jpg',
  'husayn': 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/7e/a7/62/7ea76251-2895-c2d6-bca1-744005bca406/cover.jpg/1200x1200bb.jpg',
  'deemz': 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/e0/ba/0b/e0ba0bc5-9c59-ba13-e574-8b01c3bf7ec8/cover.jpg/1200x1200bb.jpg',
  'teefo': 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/eb/54/2e/eb542e58-4508-3dc8-eb1a-c529ba0e3eb4/cover.jpg/1200x1200bb.jpg',
  'hassan': 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/5a/08/94/5a089456-e9ea-1c25-bb35-5e60803cbe49/cover.jpg/1200x1200bb.jpg',
  'mandou': 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/6b/ba/f8/6bbaf878-3a83-a0e2-632b-a19b33a01a35/cover.jpg/1200x1200bb.jpg',
  'wezza montaser': 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/7c/4f/59/7c4f5945-b461-9f93-5ebf-a18dcf9e1d89/cover.jpg/1200x1200bb.jpg',
  'xander ghost': 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/b0/02/76/b0027663-8a39-cce6-d183-b77a07ea9941/cover.jpg/1200x1200bb.jpg',
  'mohamed adawya': 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/6e/c3/82/6ec38294-bba9-7157-1906-8d5c41460340/cover.jpg/1200x1200bb.jpg',
  'sharmoofers': 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/1f/ee/48/1fee4862-5813-fdf4-7db4-686be9e120f2/cover.jpg/1200x1200bb.jpg',
  'double zuksh': 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/1c/6c/fb/1c6cfb99-31e7-29cb-d130-1b777a80b06d/cover.jpg/1200x1200bb.jpg',
  'mahmoud el esseily': 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/13/f7/a6/13f7a634-8bba-c148-52fb-5e26b158097b/cover.jpg/1200x1200bb.jpg',
  'محمود العسيلي': 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/13/f7/a6/13f7a634-8bba-c148-52fb-5e26b158097b/cover.jpg/1200x1200bb.jpg',
  'amir eid': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/ad/83/7f/ad837f70-04a2-b985-2e0b-dbeaf1f2c5c2/196872351095.jpg/1200x1200bb.jpg',
  'afroto': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/ed/ff/43/edff43d4-c78b-4102-b30f-99fc8e0d8632/6221117176493.jpg/1200x1200bb.jpg',
  'shehab': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/69/17/7a/69177aa3-e5aa-132e-e78a-729b157f0596/3617057225521_cover.jpg/1200x1200bb.jpg',
  'batistuta': 'https://is1-ssl.mzstatic.com/image/thumb/Music114/v4/24/9b/bd/249bbdd3-5fcb-d6ea-5603-4106e745371a/Mazalat.jpg/1200x1200bb.jpg',
  'fl ex': 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/a7/25/1c/a7251cf9-c226-5a7b-e230-c6b94738ba24/cover.jpg/1200x1200bb.jpg',
  'mousv': 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/e1/19/4d/e1194d2f-3520-f821-4d59-cfd39bb9fe6d/El_Sahaba.jpg/1200x1200bb.jpg',
  'wingii': 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/74/7d/4b/747d4b33-c554-039a-2e43-b0733c88a15e/cover.jpg/1200x1200bb.jpg',
  'dizzytooskinny': 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/45/c6/37/45c637d7-8bb3-e725-242d-a7ce6028f450/6221117133441.jpg/1200x1200bb.jpg',
  'mohamed mounir': 'https://is1-ssl.mzstatic.com/image/thumb/Music/v4/1f/ff/b1/1fffb134-4cdb-b8e5-3d43-198269899a61/2000_Mohammed_Mounir_-_Fi_3eshq_El_Banat.jpg/1200x1200bb.jpg',
  'hamza namira': 'https://is1-ssl.mzstatic.com/image/thumb/Music114/v4/1d/17/a8/1d17a8be-6fc8-4482-5947-2b6febd66e43/Mawloud_Sanat_80.jpg/1200x1200bb.jpg',
  'mohammed saeed': 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/63/a5/7d/63a57dfd-d4a9-e08b-188b-9888163ca8a8/6221117157478.jpg/1200x1200bb.jpg',
  'hussain al jassmi': 'https://is1-ssl.mzstatic.com/image/thumb/Music114/v4/09/18/f7/0918f7b3-7ece-5b84-5fd8-3c3a82512fd7/dj.cnkdpviu.jpg/1200x1200bb.jpg',
  'essam sasa': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/4a/bc/40/4abc40e6-5c56-6dd4-e0c8-fbff7647895e/cover.jpg/1200x1200bb.jpg',
  'muslim': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/64/7b/d2/647bd2bf-8263-95c5-236b-cb7ec1ba881e/cover.jpg/1200x1200bb.jpg',
  'bahaa sultan': 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/05/cf/42/05cf42c4-2794-814c-47bc-e6966f39b699/cover.jpg/1200x1200bb.jpg',
  'ziad zaza': 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/71/34/09/71340989-18ba-ca24-2c1b-2633010ee32d/cover.jpg/1200x1200bb.jpg',
  'abo el anwar': 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/21/df/ce/21dfce70-4d37-29ea-0309-847e634794ad/cover.jpg/1200x1200bb.jpg',
  '3enba': 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/09/ce/a8/09cea8c5-da21-f153-625d-24757c9170a4/cover.jpg/1200x1200bb.jpg',
  'al shami': 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/33/aa/04/33aa0449-33aa-45c1-32e7-01368146740c/cover.jpg/1200x1200bb.jpg',
  'mahmoud el leithy': 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/d5/43/45/d54345eb-cfcf-db2d-a1c0-0f8bc3775f0b/cover.jpg/1200x1200bb.jpg',
  'ramy sabry': 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/2c/86/0e/2c860ec8-3481-9b16-46b0-13f6396f44d8/cover.jpg/1200x1200bb.jpg',
  'angham': 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/2d/c8/f5/2dc8f5df-4d67-4d9f-a451-b844ca8d10b7/cover.jpg/1200x1200bb.jpg',
  'asala': 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/c3/84/d3/c384d360-3fa6-b18a-9213-90d56ee255e2/cover.jpg/1200x1200bb.jpg',
  'elissa': 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/71/24/f6/7124f6f8-9a48-d3db-4e7a-c187bc954fa0/cover.jpg/1200x1200bb.jpg',
  'nancy ajram': 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/76/87/49/7687498c-84cb-32a3-2c1b-b4618765275e/cover.jpg/1200x1200bb.jpg',
  'wael jassar': 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/d8/52/66/d85266e7-142f-410a-4da2-2b22bb8baea0/cover.jpg/1200x1200bb.jpg'
};

function upgradeToHighRes(url) {
  if (!url || typeof url !== 'string') return url;
  return url
    .replace(/\/(?:100x100|600x600|300x300)bb\.(jpg|png)/gi, '/1200x1200bb.$1')
    .replace(/\/600x600bb\.jpg/gi, '/1200x1200bb.jpg');
}

/**
 * Fetch high-res artist portrait from remote streaming CDNs
 */
async function fetchRemoteArtistImage(artistName) {
  if (!artistName || typeof artistName !== 'string') return null;
  const clean = artistName.trim();
  const lower = clean.toLowerCase();

  // Tier 1: Canonical verified map
  if (CANONICAL_ARTIST_AVATARS[lower]) {
    return upgradeToHighRes(CANONICAL_ARTIST_AVATARS[lower]);
  }

  // Tier 2: Public Media CDNs
  try {
    const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(clean)}&entity=musicArtist&limit=1`;
    const res = await fetch(itunesUrl, { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const data = await res.json();
      if (data?.results?.[0]?.artistLinkUrl) {
        const albRes = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(clean)}&entity=album&limit=1`, { signal: AbortSignal.timeout(3000) });
        if (albRes.ok) {
          const albData = await albRes.json();
          const rawCover = albData?.results?.[0]?.artworkUrl100;
          if (rawCover) {
            return upgradeToHighRes(rawCover);
          }
        }
      }
    }
  } catch {}

  // Tier 3: Public Audio API fallback
  try {
    const dzRes = await fetch(`https://api.deezer.com/search/artist?q=${encodeURIComponent(clean)}&limit=1`, { signal: AbortSignal.timeout(4000) });
    if (dzRes.ok) {
      const dzData = await dzRes.json();
      const pic = dzData?.data?.[0]?.picture_xl || dzData?.data?.[0]?.picture_big || dzData?.data?.[0]?.picture_medium;
      if (pic && typeof pic === 'string' && pic.startsWith('http')) {
        return pic;
      }
    }
  } catch {}

  return null;
}

/**
 * Resolves high-resolution avatar for an artist with local DB fallback
 */
async function resolveArtistArtwork(artistName) {
  if (!artistName) return '';
  const clean = artistName.trim();
  const lower = clean.toLowerCase();

  if (CANONICAL_ARTIST_AVATARS[lower]) {
    return CANONICAL_ARTIST_AVATARS[lower];
  }

  // Check Artist model first
  try {
    const existing = await Artist.findOne({
      $or: [
        { id: lower },
        { name: new RegExp(`^${clean}$`, 'i') }
      ]
    }).lean();

    if (existing?.avatar && !existing.avatar.includes('photo-1514525253161') && !existing.avatar.includes('hqdefault')) {
      return existing.avatar;
    }
  } catch {}

  // Try Remote CDNs
  const remoteImg = await fetchRemoteArtistImage(clean);
  if (remoteImg) return remoteImg;

  // Fallback to highest played track cover for this artist
  try {
    const topTrack = await Track.findOne({
      $or: [
        { primaryArtist: clean },
        { artists: clean },
        { artist: new RegExp(clean, 'i') }
      ],
      cover: { $exists: true, $ne: '' }
    }).sort({ plays: -1 }).lean();

    if (topTrack?.cover) return topTrack.cover;
  } catch {}

  return 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80';
}

/**
 * Bulk backfill missing or generic artist avatars in MongoDB
 */
async function bulkBackfillMissingArtistArtwork() {
  console.log('[ArtworkResolver] Starting bulk artist artwork backfill...');
  const artists = await Artist.find({}).lean();
  let updatedCount = 0;

  for (const art of artists) {
    const isMissing = !art.avatar || !art.avatar.trim() ||
      art.avatar.includes('photo-1514525253161') ||
      art.avatar.includes('hqdefault.jpg');

    if (isMissing || CANONICAL_ARTIST_AVATARS[art.name.toLowerCase().trim()]) {
      const resolved = await resolveArtistArtwork(art.name);
      if (resolved && resolved !== art.avatar) {
        await Artist.updateOne(
          { _id: art._id },
          { $set: { avatar: resolved, cover: resolved, updatedAt: new Date() } }
        );
        updatedCount++;
      }
    }
  }

  console.log(`[ArtworkResolver] Backfill complete. Updated ${updatedCount} artists.`);
  return updatedCount;
}

module.exports = {
  CANONICAL_ARTIST_AVATARS,
  upgradeToHighRes,
  resolveArtistArtwork,
  fetchRemoteArtistImage,
  bulkBackfillMissingArtistArtwork
};
