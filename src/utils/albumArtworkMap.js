import { API_BASE_URL } from '../config';
import { normalizeCoverUrl } from './coverUtils';

export const OFFICIAL_ALBUM_COVERS = {
  // Cairokee
  'roma': 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/46/81/82/468182bd-6914-bf7d-2f4a-4cb4bd5175cd/196925215671.jpg/600x600bb.jpg',
  'supernova': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/7f/a0/00/7fa00086-e72c-191b-6547-e8992f774a9a/885288056853.jpg/600x600bb.jpg',
  'nas w nas': 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/64/78/b1/6478b176-8977-c2fb-bacd-761567625b00/196925011204.jpg/600x600bb.jpg',
  'noaata beida': 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/e9/de/11/e9de11f3-be73-e0df-b4ff-72dd702476e3/196626997326.jpg/600x600bb.jpg',
  'the ugly ducklings': 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/17/21/ff/1721ffa2-9895-8c92-43af-eaebd0a31cc6/3615938009819.png/600x600bb.jpg',
  'ابناء البطة السوداء': 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/17/21/ff/1721ffa2-9895-8c92-43af-eaebd0a31cc6/3615938009819.png/600x600bb.jpg',
  'كايروكي من الاستوديو': 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/2b/37/92/2b37929b-6df4-0a3e-24c4-5401eb70b5fe/196626954855.jpg/600x600bb.jpg',
  'classics, vol. 1': 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/8a/22/95/8a2295a7-e3ba-5b30-1e07-cf3c372c07cc/cover.jpg/600x600bb.jpg',
  'classics': 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/8a/22/95/8a2295a7-e3ba-5b30-1e07-cf3c372c07cc/cover.jpg/600x600bb.jpg',
  'لما بنتولد': 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/d8/46/06/d846063d-1cbd-f455-1287-5370cc305292/artwork.jpg/600x600bb.jpg',
  'roxi': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/ad/83/7f/ad837f70-04a2-b985-2e0b-dbeaf1f2c5c2/196872351095.jpg/600x600bb.jpg',
  'rivo': 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/6a/71/f3/6a71f3e3-b9c0-a08d-a782-4fead92c8ed6/cover.jpg/600x600bb.jpg',
  'ريفو': 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/6a/71/f3/6a71f3e3-b9c0-a08d-a782-4fead92c8ed6/cover.jpg/600x600bb.jpg',
  'shoft kalam': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/01/c4/31/01c43187-da8b-fc50-b68e-2e71cd1d7c85/885288123609.jpg/600x600bb.jpg',

  // Lege-Cy
  'placebo': 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/3d/be/1a/3dbe1ae5-a9c0-ff0c-d8ea-3b87692cadeb/6221216529510_cover.png/600x600bb.jpg',
  'plan-b': 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/ef/28/e0/ef28e07b-c631-8981-55f4-a8979a433fc5/6221216496775_cover.jpg/600x600bb.jpg',
  'agzakhana': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/65/7c/94/657c9473-c77e-601c-9bbc-4540ecc2c08b/6221216496768_Artwork.jpg/600x600bb.jpg',
  'bgd': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/0a/1c/f8/0a1cf858-7be3-fbd4-910c-b339dc1e5f6d/6221216719980_Artwork.png/600x600bb.jpg',
  '191-181': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/4b/3b/74/4b3b7438-50f4-1555-fec5-cc40ed9d74a7/6221216496751_Artwork.jpg/600x600bb.jpg',
  '6 shohour': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/71/a2/1d/71a21d7d-a877-2513-eed7-727a5d88b77c/199350839948.jpg/600x600bb.jpg',
  'no problema': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/45/36/32/453632e0-9b7b-f51d-12ac-64651815b6df/6221216496690_Artwork.jpg/600x600bb.jpg',

  // El Joker
  'talatini': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/0f/07/c7/0f07c79e-9717-bcc0-471b-32963e4f4bbf/6221117179777.jpg/600x600bb.jpg',
  'تلاتيني': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/0f/07/c7/0f07c79e-9717-bcc0-471b-32963e4f4bbf/6221117179777.jpg/600x600bb.jpg',

  // Marwan Moussa
  'matador': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/b2/77/a5/b277a527-2d33-a3be-6c49-7eaea3ed056f/6221117202772.jpg/600x600bb.jpg',
  'ماتادور': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/b2/77/a5/b277a527-2d33-a3be-6c49-7eaea3ed056f/6221117202772.jpg/600x600bb.jpg',
  'florida': 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/c5/1e/ca/c51eca2c-ce64-b28e-99dc-33db91eab6a6/Florida.jpg/600x600bb.jpg',

  // Wegz
  'aqareb': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/da/6b/6a/da6b6a17-8118-9b3b-b92e-7f1854ddea68/199538601800.jpg/600x600bb.jpg',
  'aqareb (side b)': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/72/f3/d6/72f3d6c8-f17d-fe79-ba17-5781a4a4bc87/199806555736.jpg/600x600bb.jpg',
  'gadwal el darb': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/0b/4b/83/0b4b83d4-e6c2-e172-970e-e58d68e02397/199066748190.jpg/600x600bb.jpg',

  // Amr Diab
  'sahran': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/69/2f/b0/692fb07e-6ab9-467a-01f4-f12ec0a39a41/194660835758.jpg/600x600bb.jpg',
  'سهران': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/69/2f/b0/692fb07e-6ab9-467a-01f4-f12ec0a39a41/194660835758.jpg/600x600bb.jpg',
  'kol hayaty': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/53/72/e3/5372e3cc-173f-c5ed-88ac-d19ab6b381e8/5061028762894.jpg/600x600bb.jpg',
  'كل حياتي': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/53/72/e3/5372e3cc-173f-c5ed-88ac-d19ab6b381e8/5061028762894.jpg/600x600bb.jpg',
  'makanak': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/61/e2/77/61e2774e-d949-c7cc-01e0-ac9930c78f68/019771240652.jpg/600x600bb.jpg',
  'مكانك': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/61/e2/77/61e2774e-d949-c7cc-01e0-ac9930c78f68/019771240652.jpg/600x600bb.jpg',
  'ya ana ya la': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/6b/fa/d0/6bfad002-1f1c-046a-2d4d-a932841e00a5/3616842369259.jpg/600x600bb.jpg',
  'يا انا يا لا': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/6b/fa/d0/6bfad002-1f1c-046a-2d4d-a932841e00a5/3616842369259.jpg/600x600bb.jpg',
  'tamally maak': 'https://is1-ssl.mzstatic.com/image/thumb/Music69/v4/31/4d/d4/314dd42d-3246-e7a3-107a-3d521fa9a7e2/dj.iiicnpub.jpg/600x600bb.jpg',
  'تملي معاك': 'https://is1-ssl.mzstatic.com/image/thumb/Music69/v4/31/4d/d4/314dd42d-3246-e7a3-107a-3d521fa9a7e2/dj.iiicnpub.jpg/600x600bb.jpg',
  'amarain': 'https://is1-ssl.mzstatic.com/image/thumb/Music6/v4/b9/56/14/b956146c-ca00-7619-d521-d002b61ad1a6/dj.vlndmiyw.jpg/600x600bb.jpg',
  'قمرين': 'https://is1-ssl.mzstatic.com/image/thumb/Music6/v4/b9/56/14/b956146c-ca00-7619-d521-d002b61ad1a6/dj.vlndmiyw.jpg/600x600bb.jpg',

  // Marwan Pablo
  'ctrl - ep': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/25/99/06/25990612-bcc8-f286-57ea-c7cdb0aabe75/198588228821.jpg/600x600bb.jpg',
  'the last piece of art': 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/ea/d7/bc/ead7bc49-c2bb-e21a-23df-a2ff41034953/197190080810.jpg/600x600bb.jpg',
  'meaddy el nas': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/d2/e1/97/d2e19759-e749-749a-a439-1e310ac89f14/889502763589.jpg/600x600bb.jpg',
  'معدي الناس': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/d2/e1/97/d2e19759-e749-749a-a439-1e310ac89f14/889502763589.jpg/600x600bb.jpg',
  'ahla w ahla': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/a8/81/9f/a8819f9f-99f8-eb28-6a73-fcae47843bc8/3616842352848.jpg/600x600bb.jpg',
  'أحلى وأحلى': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/a8/81/9f/a8819f9f-99f8-eb28-6a73-fcae47843bc8/3616842352848.jpg/600x600bb.jpg',
  'eish beshoak': 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/91/ba/6d/91ba6de9-d79a-daca-e5e3-d5d13e1bb000/3615933755032.jpg/600x600bb.jpg',
  'عيش بشوقك': 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/91/ba/6d/91ba6de9-d79a-daca-e5e3-d5d13e1bb000/3615933755032.jpg/600x600bb.jpg',
  'tegy nrahan': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/06/8a/28/068a2851-1901-3808-b3c4-46b8a7c055f4/3616843830031_cover.jpg/600x600bb.jpg',
  'تيجي نتراهن': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/06/8a/28/068a2851-1901-3808-b3c4-46b8a7c055f4/3616843830031_cover.jpg/600x600bb.jpg',
  'ayam': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/75/a6/3c/75a63c60-1b4b-3902-f5ec-0c4857ce576f/3617226805912_cover.jpg/600x600bb.jpg',
  'أيام': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/75/a6/3c/75a63c60-1b4b-3902-f5ec-0c4857ce576f/3617226805912_cover.jpg/600x600bb.jpg'
};

export function getAlbumArtwork(albumOrName, fallbackCover = '') {
  let cover = (typeof albumOrName === 'object' && (albumOrName?.cover || albumOrName?.coverUrl))
    ? (albumOrName.cover || albumOrName.coverUrl)
    : fallbackCover;

  if (cover && typeof cover === 'string') {
    if (cover.startsWith('/')) {
      cover = `${API_BASE_URL}${cover}`;
    }
  }

  if (cover && typeof cover === 'string' && cover.startsWith('http') && !cover.includes('hqdefault.jpg') && !cover.includes('i.ytimg.com/vi/')) {
    return normalizeCoverUrl(cover);
  }
  const name = typeof albumOrName === 'string' ? albumOrName : (albumOrName?.name || albumOrName?.title || '');
  const cleanKey = name.replace(/^Album\s*[-–—:]\s*/i, '').trim().toLowerCase();
  if (OFFICIAL_ALBUM_COVERS[cleanKey]) {
    return normalizeCoverUrl(OFFICIAL_ALBUM_COVERS[cleanKey]);
  }
  for (const [key, val] of Object.entries(OFFICIAL_ALBUM_COVERS)) {
    if (cleanKey.includes(key) || key.includes(cleanKey)) {
      return normalizeCoverUrl(val);
    }
  }
  if (cover && typeof cover === 'string' && cover.trim().length > 0) {
    return normalizeCoverUrl(cover);
  }
  return 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80';
}
