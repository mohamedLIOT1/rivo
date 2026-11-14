/**
 * Canonical Artist Avatars & Verified Artwork Dictionary
 * Instant 0ms resolution for core catalog artists and reciters.
 * Strictly modularized (< 400 lines) per AGENTS.md.
 */

import { getCanonicalArtistName } from './artistUtils';
import { CANONICAL_RECITERS } from './canonicalRecitersData';

export const CANONICAL_ARTIST_AVATARS = {
  // Amr Diab
  'amr diab': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/69/2f/b0/692fb07e-6ab9-467a-01f4-f12ec0a39a41/194660835758.jpg/600x600bb.jpg',
  'عمرو دياب': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/69/2f/b0/692fb07e-6ab9-467a-01f4-f12ec0a39a41/194660835758.jpg/600x600bb.jpg',
  'الهضبة': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/69/2f/b0/692fb07e-6ab9-467a-01f4-f12ec0a39a41/194660835758.jpg/600x600bb.jpg',
  'elhadaba': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/69/2f/b0/692fb07e-6ab9-467a-01f4-f12ec0a39a41/194660835758.jpg/600x600bb.jpg',

  // Tamer Hosny
  'tamer hosny': 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/91/ba/6d/91ba6de9-d79a-daca-e5e3-d5d13e1bb000/3615933755032.jpg/600x600bb.jpg',
  'تامر حسني': 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/91/ba/6d/91ba6de9-d79a-daca-e5e3-d5d13e1bb000/3615933755032.jpg/600x600bb.jpg',
  'tamer hosni': 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/91/ba/6d/91ba6de9-d79a-daca-e5e3-d5d13e1bb000/3615933755032.jpg/600x600bb.jpg',

  // Cairokee & Amir Eid
  'cairokee': 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/46/81/82/468182bd-6914-bf7d-2f4a-4cb4bd5175cd/196925215671.jpg/600x600bb.jpg',
  'كايروكي': 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/46/81/82/468182bd-6914-bf7d-2f4a-4cb4bd5175cd/196925215671.jpg/600x600bb.jpg',
  'amir eid': 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/46/81/82/468182bd-6914-bf7d-2f4a-4cb4bd5175cd/196925215671.jpg/600x600bb.jpg',
  'أمير عيد': 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/46/81/82/468182bd-6914-bf7d-2f4a-4cb4bd5175cd/196925215671.jpg/600x600bb.jpg',

  // Mohamed Hamaki
  'mohamed hamaki': 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/33/aa/5b/33aa5b64-d621-e3a4-eb94-4d89868972e6/190296766442.jpg/600x600bb.jpg',
  'محمد حماقي': 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/33/aa/5b/33aa5b64-d621-e3a4-eb94-4d89868972e6/190296766442.jpg/600x600bb.jpg',
  'hamaki': 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/33/aa/5b/33aa5b64-d621-e3a4-eb94-4d89868972e6/190296766442.jpg/600x600bb.jpg',
  'حماقي': 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/33/aa/5b/33aa5b64-d621-e3a4-eb94-4d89868972e6/190296766442.jpg/600x600bb.jpg',

  // Marwan Pablo
  'marwan pablo': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/25/99/06/25990612-bcc8-f286-57ea-c7cdb0aabe75/198588228821.jpg/600x600bb.jpg',
  'مروان بابلو': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/25/99/06/25990612-bcc8-f286-57ea-c7cdb0aabe75/198588228821.jpg/600x600bb.jpg',
  'pablo': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/25/99/06/25990612-bcc8-f286-57ea-c7cdb0aabe75/198588228821.jpg/600x600bb.jpg',

  // Wegz
  'wegz': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/da/6b/6a/da6b6a17-8118-9b3b-b92e-7f1854ddea68/199538601800.jpg/600x600bb.jpg',
  'ويجز': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/da/6b/6a/da6b6a17-8118-9b3b-b92e-7f1854ddea68/199538601800.jpg/600x600bb.jpg',

  // Lege-Cy
  'lege-cy': 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/3d/be/1a/3dbe1ae5-a9c0-ff0c-d8ea-3b87692cadeb/6221216529510_cover.png/600x600bb.jpg',
  'ليجيسي': 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/3d/be/1a/3dbe1ae5-a9c0-ff0c-d8ea-3b87692cadeb/6221216529510_cover.png/600x600bb.jpg',
  'ليجي': 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/3d/be/1a/3dbe1ae5-a9c0-ff0c-d8ea-3b87692cadeb/6221216529510_cover.png/600x600bb.jpg',

  // El Joker
  'el joker': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/0f/07/c7/0f07c79e-9717-bcc0-471b-32963e4f4bbf/6221117179777.jpg/600x600bb.jpg',
  'الجوكر': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/0f/07/c7/0f07c79e-9717-bcc0-471b-32963e4f4bbf/6221117179777.jpg/600x600bb.jpg',

  // Tul8te
  'tul8te': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/91/92/51/91925187-578f-ef47-bb71-c035616b23d9/198588806296.jpg/600x600bb.jpg',
  'توليت': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/91/92/51/91925187-578f-ef47-bb71-c035616b23d9/198588806296.jpg/600x600bb.jpg',
  'تو ليت': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/91/92/51/91925187-578f-ef47-bb71-c035616b23d9/198588806296.jpg/600x600bb.jpg',

  // Sherine
  'sherine': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/f9/29/9b/f9299b39-c73d-13e1-c684-b1e8a87cfe1e/3664216111270.png/600x600bb.jpg',
  'شيرين': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/f9/29/9b/f9299b39-c73d-13e1-c684-b1e8a87cfe1e/3664216111270.png/600x600bb.jpg',
  'شيرين عبد الوهاب': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/f9/29/9b/f9299b39-c73d-13e1-c684-b1e8a87cfe1e/3664216111270.png/600x600bb.jpg',
  'sherin': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/f9/29/9b/f9299b39-c73d-13e1-c684-b1e8a87cfe1e/3664216111270.png/600x600bb.jpg',

  // Angham
  'angham': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/33/ca/48/33ca489f-c5e6-7450-f0c4-228769396dc7/1614067.jpg/600x600bb.jpg',
  'أنغام': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/33/ca/48/33ca489f-c5e6-7450-f0c4-228769396dc7/1614067.jpg/600x600bb.jpg',
  'انغام': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/33/ca/48/33ca489f-c5e6-7450-f0c4-228769396dc7/1614067.jpg/600x600bb.jpg',

  // Mohamed Mounir
  'mohamed mounir': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/61/a7/50/61a7500b-3372-9fe8-4f55-2584e4a31602/cover.jpg/600x600bb.jpg',
  'محمد منير': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/61/a7/50/61a7500b-3372-9fe8-4f55-2584e4a31602/cover.jpg/600x600bb.jpg',
  'منير': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/61/a7/50/61a7500b-3372-9fe8-4f55-2584e4a31602/cover.jpg/600x600bb.jpg',
  'الكينج': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/61/a7/50/61a7500b-3372-9fe8-4f55-2584e4a31602/cover.jpg/600x600bb.jpg',

  // Abo El Anwar
  'abo el anwar': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/34/7a/60/347a600c-ef6d-252e-2a29-4814136bf8b7/cover.jpg/600x600bb.jpg',
  'أبو الانوار': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/34/7a/60/347a600c-ef6d-252e-2a29-4814136bf8b7/cover.jpg/600x600bb.jpg',
  'ابو الانوار': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/34/7a/60/347a600c-ef6d-252e-2a29-4814136bf8b7/cover.jpg/600x600bb.jpg',
  'أبو الأنوار': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/34/7a/60/347a600c-ef6d-252e-2a29-4814136bf8b7/cover.jpg/600x600bb.jpg',

  // Fairouz
  'fairouz': 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/b8/b6/2a/b8b62a1a-3e3e-4629-873b-eb061c4bb6c9/cover.jpg/600x600bb.jpg',
  'فيروز': 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/b8/b6/2a/b8b62a1a-3e3e-4629-873b-eb061c4bb6c9/cover.jpg/600x600bb.jpg',

  // Drake
  'drake': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/8c/d7/30/8cd73004-2d53-e7e4-bf7a-d4915422e261/196874972977.jpg/600x600bb.jpg',

  // Kendrick Lamar
  'kendrick lamar': 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/94/28/36/94283609-93bb-db1c-e997-44e82c157e90/00602567261216.rgb.jpg/600x600bb.jpg',

  // Radiohead
  'radiohead': 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/1f/2c/8b/1f2c8bd3-07cb-17fe-f1f0-0fa415392e62/634904078385.png/600x600bb.jpg',

  // Ahmed Mounib
  'ahmed mounib': 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/b2/8e/58/b28e58f2-2b62-e1d2-0448-4e892c2a04e5/cover.jpg/600x600bb.jpg',
  'أحمد منيب': 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/b2/8e/58/b28e58f2-2b62-e1d2-0448-4e892c2a04e5/cover.jpg/600x600bb.jpg',

  // Abyusif
  'abyusif': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/69/f9/aa/69f9aa09-d6b1-3893-a4d7-6f359e65c9dc/0.jpg/600x600bb.jpg',
  'أبيوسف': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/69/f9/aa/69f9aa09-d6b1-3893-a4d7-6f359e65c9dc/0.jpg/600x600bb.jpg',

  // Lil Baba
  'lil baba': 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/44/e0/f8/44e0f8f8-b30a-9d0a-b33a-d68a9b9a68bc/cover.jpg/600x600bb.jpg',
  'ليل بابا': 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/44/e0/f8/44e0f8f8-b30a-9d0a-b33a-d68a9b9a68bc/cover.jpg/600x600bb.jpg',

  // Tamer Ashour
  'tamer ashour': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/75/a6/3c/75a63c60-1b4b-3902-f5ec-0c4857ce576f/3617226805912_cover.jpg/600x600bb.jpg',
  'تامر عاشور': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/75/a6/3c/75a63c60-1b4b-3902-f5ec-0c4857ce576f/3617226805912_cover.jpg/600x600bb.jpg',

  // Marwan Moussa
  'marwan moussa': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/b2/77/a5/b277a527-2d33-a3be-6c49-7eaea3ed056f/6221117202772.jpg/600x600bb.jpg',
  'مروان موسى': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/b2/77/a5/b277a527-2d33-a3be-6c49-7eaea3ed056f/6221117202772.jpg/600x600bb.jpg',

  // Karim Osama
  'karim osama': 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/a9/37/d1/a937d11d-2856-11f8-f404-5f11181f8f30/cover.jpg/600x600bb.jpg',
  'كريم أسامة': 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/a9/37/d1/a937d11d-2856-11f8-f404-5f11181f8f30/cover.jpg/600x600bb.jpg',

  // Husayn
  'husayn': 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/7e/a7/62/7ea76251-2895-c2d6-bca1-744005bca406/cover.jpg/600x600bb.jpg',
  'حسين': 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/7e/a7/62/7ea76251-2895-c2d6-bca1-744005bca406/cover.jpg/600x600bb.jpg',

  // Deemz
  'deemz': 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/e0/ba/0b/e0ba0bc5-9c59-ba13-e574-8b01c3bf7ec8/cover.jpg/600x600bb.jpg',
  'ديمز': 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/e0/ba/0b/e0ba0bc5-9c59-ba13-e574-8b01c3bf7ec8/cover.jpg/600x600bb.jpg',

  // Teefo
  'teefo': 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/eb/54/2e/eb542e58-4508-3dc8-eb1a-c529ba0e3eb4/cover.jpg/600x600bb.jpg',
  'تيفو': 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/eb/54/2e/eb542e58-4508-3dc8-eb1a-c529ba0e3eb4/cover.jpg/600x600bb.jpg',

  // Hassan
  'hassan': 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/5a/08/94/5a089456-e9ea-1c25-bb35-5e60803cbe49/cover.jpg/600x600bb.jpg',
  'حسن': 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/5a/08/94/5a089456-e9ea-1c25-bb35-5e60803cbe49/cover.jpg/600x600bb.jpg',

  // Mandou
  'mandou': 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/6b/ba/f8/6bbaf878-3a83-a0e2-632b-a19b33a01a35/cover.jpg/600x600bb.jpg',
  'ماندو': 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/6b/ba/f8/6bbaf878-3a83-a0e2-632b-a19b33a01a35/cover.jpg/600x600bb.jpg',

  // Wezza Montaser
  'wezza montaser': 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/7c/4f/59/7c4f5945-b461-9f93-5ebf-a18dcf9e1d89/cover.jpg/600x600bb.jpg',
  'وزة منتصر': 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/7c/4f/59/7c4f5945-b461-9f93-5ebf-a18dcf9e1d89/cover.jpg/600x600bb.jpg',

  // Xander Ghost
  'xander ghost': 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/b0/02/76/b0027663-8a39-cce6-d183-b77a07ea9941/cover.jpg/600x600bb.jpg',

  // Mohamed Adawya
  'mohamed adawya': 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/6e/c3/82/6ec38294-bba9-7157-1906-8d5c41460340/cover.jpg/600x600bb.jpg',
  'محمد عدوية': 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/6e/c3/82/6ec38294-bba9-7157-1906-8d5c41460340/cover.jpg/600x600bb.jpg',

  // Sharmoofers
  'sharmoofers': 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/1f/ee/48/1fee4862-5813-fdf4-7db4-686be9e120f2/cover.jpg/600x600bb.jpg',
  'شارموفرز': 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/1f/ee/48/1fee4862-5813-fdf4-7db4-686be9e120f2/cover.jpg/600x600bb.jpg',

  // Double Zuksh
  'double zuksh': 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/1c/6c/fb/1c6cfb99-31e7-29cb-d130-1b777a80b06d/cover.jpg/600x600bb.jpg',
  'دبل زوكش': 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/1c/6c/fb/1c6cfb99-31e7-29cb-d130-1b777a80b06d/cover.jpg/600x600bb.jpg'
};

/**
 * Resolves verified artist portrait in 0ms synchronously from memory cache
 * @param {string} artistName
 * @returns {string|null} verified cover/avatar URL
 */
export function getCanonicalArtistAvatar(artistName) {
  if (!artistName || typeof artistName !== 'string') return null;
  const clean = artistName.trim().toLowerCase();

  // 1. Direct match in canonical dictionary
  if (CANONICAL_ARTIST_AVATARS[clean]) {
    return CANONICAL_ARTIST_AVATARS[clean];
  }

  // 2. Canonical alias match (e.g. from Arabic or alternative spellings)
  const canonical = getCanonicalArtistName(artistName);
  if (canonical) {
    const canonicalLower = canonical.toLowerCase();
    if (CANONICAL_ARTIST_AVATARS[canonicalLower]) {
      return CANONICAL_ARTIST_AVATARS[canonicalLower];
    }
  }

  // 3. Check Canonical Quran Reciters
  if (Array.isArray(CANONICAL_RECITERS)) {
    for (const reciter of CANONICAL_RECITERS) {
      if (
        reciter.name.toLowerCase() === clean ||
        reciter.name.toLowerCase().includes(clean) ||
        clean.includes(reciter.name.toLowerCase()) ||
        (Array.isArray(reciter.aliases) && reciter.aliases.some(a => a.toLowerCase() === clean || clean.includes(a.toLowerCase())))
      ) {
        if (reciter.cover) return reciter.cover;
      }
    }
  }

  return null;
}
