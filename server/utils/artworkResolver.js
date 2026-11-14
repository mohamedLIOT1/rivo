/**
 * Multi-Tier High-Resolution Artwork Resolver
 * Fetches canonical high-res avatars & covers from:
 * 1. Hardcoded High-Res Canonical Database
 * 2. High-Res Media CDN (1000x1000 / 600x600)
 * 3. Existing Album & Track Cover Harvest
 * Strictly modularized (< 400 lines) per AGENTS.md.
 */

const { Track, Artist, Album } = require('../models');

// Built-in verified high-resolution portraits for core catalog artists
const CANONICAL_ARTIST_AVATARS = {
  'amr diab': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/69/2f/b0/692fb07e-6ab9-467a-01f4-f12ec0a39a41/194660835758.jpg/600x600bb.jpg',
  'tamer hosny': 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/91/ba/6d/91ba6de9-d79a-daca-e5e3-d5d13e1bb000/3615933755032.jpg/600x600bb.jpg',
  'cairokee': 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/46/81/82/468182bd-6914-bf7d-2f4a-4cb4bd5175cd/196925215671.jpg/600x600bb.jpg',
  'mohamed hamaki': 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/33/aa/5b/33aa5b64-d621-e3a4-eb94-4d89868972e6/190296766442.jpg/600x600bb.jpg',
  'marwan pablo': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/25/99/06/25990612-bcc8-f286-57ea-c7cdb0aabe75/198588228821.jpg/600x600bb.jpg',
  'wegz': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/da/6b/6a/da6b6a17-8118-9b3b-b92e-7f1854ddea68/199538601800.jpg/600x600bb.jpg',
  'lege-cy': 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/3d/be/1a/3dbe1ae5-a9c0-ff0c-d8ea-3b87692cadeb/6221216529510_cover.png/600x600bb.jpg',
  'el joker': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/0f/07/c7/0f07c79e-9717-bcc0-471b-32963e4f4bbf/6221117179777.jpg/600x600bb.jpg',
  'tul8te': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/91/92/51/91925187-578f-ef47-bb71-c035616b23d9/198588806296.jpg/600x600bb.jpg',
  'sherine': 'https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/bf/f4/bc/bff4bce9-14a0-5696-6ae8-0051871a2dd6/3617056073114_cover.jpg/600x600bb.jpg',
  'fairouz': 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/b8/b6/2a/b8b62a1a-3e3e-4629-873b-eb061c4bb6c9/cover.jpg/600x600bb.jpg',
  'radiohead': 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/1f/2c/8b/1f2c8bd3-07cb-17fe-f1f0-0fa415392e62/634904078385.png/600x600bb.jpg',
  'ahmed mounib': 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/b2/8e/58/b28e58f2-2b62-e1d2-0448-4e892c2a04e5/cover.jpg/600x600bb.jpg',
  'abyusif': 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/a4/96/60/a496603a-028c-0f9c-70fc-e68b377b5a19/cover.jpg/600x600bb.jpg',
  'lil baba': 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/44/e0/f8/44e0f8f8-b30a-9d0a-b33a-d68a9b9a68bc/cover.jpg/600x600bb.jpg',
  'tamer ashour': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/75/a6/3c/75a63c60-1b4b-3902-f5ec-0c4857ce576f/3617226805912_cover.jpg/600x600bb.jpg',
  'marwan moussa': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/b2/77/a5/b277a527-2d33-a3be-6c49-7eaea3ed056f/6221117202772.jpg/600x600bb.jpg',
  'karim osama': 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/a9/37/d1/a937d11d-2856-11f8-f404-5f11181f8f30/cover.jpg/600x600bb.jpg',
  'husayn': 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/7e/a7/62/7ea76251-2895-c2d6-bca1-744005bca406/cover.jpg/600x600bb.jpg',
  'deemz': 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/e0/ba/0b/e0ba0bc5-9c59-ba13-e574-8b01c3bf7ec8/cover.jpg/600x600bb.jpg',
  'teefo': 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/eb/54/2e/eb542e58-4508-3dc8-eb1a-c529ba0e3eb4/cover.jpg/600x600bb.jpg',
  'hassan': 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/5a/08/94/5a089456-e9ea-1c25-bb35-5e60803cbe49/cover.jpg/600x600bb.jpg',
  'mandou': 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/6b/ba/f8/6bbaf878-3a83-a0e2-632b-a19b33a01a35/cover.jpg/600x600bb.jpg',
  'wezza montaser': 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/7c/4f/59/7c4f5945-b461-9f93-5ebf-a18dcf9e1d89/cover.jpg/600x600bb.jpg',
  'xander ghost': 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/b0/02/76/b0027663-8a39-cce6-d183-b77a07ea9941/cover.jpg/600x600bb.jpg',
  'mohamed adawya': 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/6e/c3/82/6ec38294-bba9-7157-1906-8d5c41460340/cover.jpg/600x600bb.jpg',
  'sharmoofers': 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/1f/ee/48/1fee4862-5813-fdf4-7db4-686be9e120f2/cover.jpg/600x600bb.jpg',
  'double zuksh': 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/1c/6c/fb/1c6cfb99-31e7-29cb-d130-1b777a80b06d/cover.jpg/600x600bb.jpg'
};

/**
 * Fetch high-res artist portrait from remote streaming CDNs
 */
async function fetchRemoteArtistImage(artistName) {
  if (!artistName || typeof artistName !== 'string') return null;
  const clean = artistName.trim();
  const lower = clean.toLowerCase();

  // Tier 1: Canonical verified map
  if (CANONICAL_ARTIST_AVATARS[lower]) {
    return CANONICAL_ARTIST_AVATARS[lower];
  }

  // Tier 2: Public Media CDNs
  try {
    const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(clean)}&entity=musicArtist&limit=1`;
    const res = await fetch(itunesUrl, { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const data = await res.json();
      if (data?.results?.[0]?.artistLinkUrl) {
        // Find album artwork if artist direct image is not on itunes
        const albRes = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(clean)}&entity=album&limit=1`, { signal: AbortSignal.timeout(3000) });
        if (albRes.ok) {
          const albData = await albRes.json();
          const rawCover = albData?.results?.[0]?.artworkUrl100;
          if (rawCover) {
            return rawCover.replace('100x100bb', '600x600bb');
          }
        }
      }
    }
  } catch {}

  // Tier 3: Deezer public API fallback
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
  resolveArtistArtwork,
  fetchRemoteArtistImage,
  bulkBackfillMissingArtistArtwork
};
