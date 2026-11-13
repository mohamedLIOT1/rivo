/**
 * scripts/set_permanent_artist_avatars.js
 * Scans all artists in MongoDB Atlas and locks permanent, high-res portrait URLs
 * in Artist.cover and Artist.avatar for all canonical and registered artists.
 */

const dns = require('dns');
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch {}

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const https = require('https');

const CANONICAL_AVATARS = {
  'Lege-Cy': 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/3d/be/1a/3dbe1ae5-a9c0-ff0c-d8ea-3b87692cadeb/6221216529510_cover.png/600x600bb.jpg',
  'Wegz': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/33/f0/ec/33f0ece3-d007-4cdd-03b7-de6dfaa1442b/199806680476.jpg/600x600bb.jpg',
  'Cairokee': 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/2b/37/92/2b37929b-6df4-0a3e-24c4-5401eb70b5fe/196626954855.jpg/600x600bb.jpg',
  'Marwan Pablo': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/25/99/06/25990612-bcc8-f286-57ea-c7cdb0aabe75/198588228821.jpg/600x600bb.jpg',
  'Marwan Moussa': 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/c5/1e/ca/c51eca2c-ce64-b28e-99dc-33db91eab6a6/Florida.jpg/600x600bb.jpg',
  'Amir Eid': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/ad/83/7f/ad837f70-04a2-b985-2e0b-dbeaf1f2c5c2/196872351095.jpg/600x600bb.jpg',
  'Amr Diab': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/69/2f/b0/692fb07e-6ab9-467a-01f4-f12ec0a39a41/194660835758.jpg/600x600bb.jpg',
  'Sherine': 'https://is1-ssl.mzstatic.com/image/thumb/Music114/v4/9d/7e/42/9d7e42a4-bb6a-17a3-8545-d7f3a75a3fdf/942835.jpg/600x600bb.jpg',
  'Mohamed Hamaki': 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/6e/00/b8/6e00b869-8f5e-937b-9579-7d100749488a/6224009178056.jpg/600x600bb.jpg',
  'Tul8te': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/2d/2f/73/2d2f739c-eb8c-fd9e-c67a-f7704d3fb66e/cover.jpg/600x600bb.jpg',
  'Batistuta': 'https://is1-ssl.mzstatic.com/image/thumb/Music114/v4/24/9b/bd/249bbdd3-5fcb-d6ea-5603-4106e745371a/Mazalat.jpg/600x600bb.jpg',
  'Abyusif': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/69/f9/aa/69f9aa09-d6b1-3893-a4d7-6f359e65c9dc/0.jpg/600x600bb.jpg',
  'El Joker': 'https://is1-ssl.mzstatic.com/image/thumb/Music118/v4/a2/0d/0c/a20d0cfb-45c5-14e3-cc55-70deba686539/8429006174478.jpg/600x600bb.jpg',
  'Afroto': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/ed/ff/43/edff43d4-c78b-4102-b30f-99fc8e0d8632/6221117176493.jpg/600x600bb.jpg',
  'Shehab': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/69/17/7a/69177aa3-e5aa-132e-e78a-729b157f0596/3617057225521_cover.jpg/600x600bb.jpg',
  'FL EX': 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/a7/25/1c/a7251cf9-c226-5a7b-e230-c6b94738ba24/cover.jpg/600x600bb.jpg',
  'Husayn': 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/61/9b/0a/619b0af7-199e-a706-a817-cceeb6b2d1aa/Akhro_Noor.jpg/600x600bb.jpg',
  'Karim Osama': 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/bb/67/4a/bb674ad2-ab78-2df4-e665-c418d0438931/6221216442703.png/600x600bb.jpg',
  'Mousv': 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/e1/19/4d/e1194d2f-3520-f821-4d59-cfd39bb9fe6d/El_Sahaba.jpg/600x600bb.jpg',
  'Wingii': 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/74/7d/4b/747d4b33-c554-039a-2e43-b0733c88a15e/cover.jpg/600x600bb.jpg',
  'DizzyTooSkinny': 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/45/c6/37/45c637d7-8bb3-e725-242d-a7ce6028f450/6221117133441.jpg/600x600bb.jpg',
  'Mohamed Mounir': 'https://is1-ssl.mzstatic.com/image/thumb/Music/v4/1f/ff/b1/1fffb134-4cdb-b8e5-3d43-198269899a61/2000_Mohammed_Mounir_-_Fi_3eshq_El_Banat.jpg/600x600bb.jpg',
  'Mousa Sam': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/a2/67/5b/a2675bc2-5196-57eb-ccc8-2d0731198e2a/cover.jpg/600x600bb.jpg',
  'Sharmoofers': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/c3/1e/cc/c31ecc3a-8bfc-1e64-1bf8-8495482f8b13/cover.jpg/600x600bb.jpg',
  'Massar Egbari': 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/d2/bb/30/d2bb30b0-42e2-1d9a-4746-cec860c11e1c/567088.jpg/600x600bb.jpg',
  'Double Zuksh': 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/57/0f/9f/570f9f9b-0728-57c7-0558-a32cc156d991/El_Melouk.jpg/600x600bb.jpg',
  'Hamza Namira': 'https://is1-ssl.mzstatic.com/image/thumb/Music114/v4/1d/17/a8/1d17a8be-6fc8-4482-5947-2b6febd66e43/Mawloud_Sanat_80.jpg/600x600bb.jpg',
  'Mohammed Saeed': 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/63/a5/7d/63a57dfd-d4a9-e08b-188b-9888163ca8a8/6221117157478.jpg/600x600bb.jpg',
  'Hussain Al Jassmi': 'https://is1-ssl.mzstatic.com/image/thumb/Music114/v4/09/18/f7/0918f7b3-7ece-5b84-5fd8-3c3a82512fd7/dj.cnkdpviu.jpg/600x600bb.jpg',
  'Teefo': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/43/e2/d0/43e2d0da-ec58-ccbd-6e2d-3731b80f03e6/615678165489.jpg/600x600bb.jpg',
  'Red Bull Sika': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/f8/24/b3/f824b3e3-09fa-5898-ca1d-7caa80456f81/6221117207173.jpg/600x600bb.jpg',
  'Hamo Bika': 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/4e/33/95/4e339536-0b7a-f149-578c-5e2c18240cfd/cover.jpg/600x600bb.jpg',
  'Hassan Shakosh': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/16/7e/fb/167efb50-0b17-ca63-9efd-37e66209e98d/198391705533.jpg/600x600bb.jpg',
  'Tamer Ashour': 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/ce/eb/eb/ceebebe4-43cb-b09e-7164-1da22e153bfe/cover.jpg/600x600bb.jpg',
  'Tamer Hosny': 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/a4/09/ce/a409ce2e-b615-5dc6-15f2-9598858a74b6/cover.jpg/600x600bb.jpg',
  'Essam Sasa': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/4a/bc/40/4abc40e6-5c56-6dd4-e0c8-fbff7647895e/cover.jpg/600x600bb.jpg',
  'Muslim': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/64/7b/d2/647bd2bf-8263-95c5-236b-cb7ec1ba881e/cover.jpg/600x600bb.jpg',
  'Bahaa Sultan': 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/05/cf/42/05cf42c4-2794-814c-47bc-e6966f39b699/cover.jpg/600x600bb.jpg',
  'Ziad Zaza': 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/71/34/09/71340989-18ba-ca24-2c1b-2633010ee32d/cover.jpg/600x600bb.jpg',
  'Abo El Anwar': 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/21/df/ce/21dfce70-4d37-29ea-0309-847e634794ad/cover.jpg/600x600bb.jpg',
  '3enba': 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/09/ce/a8/09cea8c5-da21-f153-625d-24757c9170a4/cover.jpg/600x600bb.jpg',
  'Santa': 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/01/be/18/01be18ae-ae84-8073-784f-4d6910609337/cover.jpg/600x600bb.jpg',
  'Al Shami': 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/33/aa/04/33aa0449-33aa-45c1-32e7-01368146740c/cover.jpg/600x600bb.jpg',
  'Mahmoud El Esseily': 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/13/f7/a6/13f7a634-8bba-c148-52fb-5e26b158097b/cover.jpg/600x600bb.jpg',
  'Mahmoud El Leithy': 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/d5/43/45/d54345eb-cfcf-db2d-a1c0-0f8bc3775f0b/cover.jpg/600x600bb.jpg',
  'Ramy Sabry': 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/2c/86/0e/2c860ec8-3481-9b16-46b0-13f6396f44d8/cover.jpg/600x600bb.jpg',
  'Angham': 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/2d/c8/f5/2dc8f5df-4d67-4d9f-a451-b844ca8d10b7/cover.jpg/600x600bb.jpg',
  'Asala': 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/c3/84/d3/c384d360-3fa6-b18a-9213-90d56ee255e2/cover.jpg/600x600bb.jpg',
  'Elissa': 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/71/24/f6/7124f6f8-9a48-d3db-4e7a-c187bc954fa0/cover.jpg/600x600bb.jpg',
  'Nancy Ajram': 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/76/87/49/7687498c-84cb-32a3-2c1b-b4618765275e/cover.jpg/600x600bb.jpg',
  'Wael Jassar': 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/d8/52/66/d85266e7-142f-410a-4da2-2b22bb8baea0/cover.jpg/600x600bb.jpg',
  'Kendrick Lamar': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/54/28/14/54281424-eece-0935-299d-fdd2ab403f92/24UM1IM28978.rgb.jpg/600x600bb.jpg',
  'Tame Impala': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/af/23/54/af235448-23b3-a3bf-0738-87f6c44a4bbc/5056556187486_cover.jpg/600x600bb.jpg',
  'Amr Mostafa': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/f8/24/b3/f824b3e3-09fa-5898-ca1d-7caa80456f81/6221117207173.jpg/600x600bb.jpg',
  'Nayer Nagui': 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/8a/22/95/8a2295a7-e3ba-5b30-1e07-cf3c372c07cc/cover.jpg/600x600bb.jpg',
  'Omar Keif': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/4b/b3/40/4bb340f4-37b5-6942-6b62-6184fa5f5537/3616848434470_cover.jpg/600x600bb.jpg',
  'مشاري راشد العفاسي': 'https://i.ytimg.com/vi/KWdjhyG9zn8/hqdefault.jpg',
  'محمود خليل الحصري': 'https://i.ytimg.com/vi/v0X8yFGidOo/hqdefault.jpg',
  'محمد صديق المنشاوي': 'https://i.ytimg.com/vi/0p_6cR05w_g/hqdefault.jpg',
  'ياسر الدوسري': 'https://i.ytimg.com/vi/J5jVf3rQ95w/hqdefault.jpg'
};

const SAFE_SLUGS = {
  'مشاري راشد العفاسي': 'mishary-alafasy',
  'محمود خليل الحصري': 'mahmoud-khalil-al-hussary',
  'محمد صديق المنشاوي': 'mohamed-siddiq-el-minshawi',
  'ياسر الدوسري': 'yasser-al-dosari'
};

function searchItunesArtwork(term) {
  return new Promise((resolve) => {
    try {
      const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&country=EG&limit=3`;
      https.get(url, (res) => {
        let raw = '';
        res.on('data', d => raw += d);
        res.on('end', () => {
          try {
            const data = JSON.parse(raw);
            const artwork = data.results?.[0]?.artworkUrl100?.replace('100x100bb', '600x600bb');
            resolve(artwork || null);
          } catch {
            resolve(null);
          }
        });
      }).on('error', () => resolve(null));
    } catch {
      resolve(null);
    }
  });
}

async function run() {
  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected.');

  const Artist = mongoose.connection.db.collection('artists');
  let lockedCount = 0;

  // 1. Set & Lock canonical artist portraits
  for (const [artistName, coverUrl] of Object.entries(CANONICAL_AVATARS)) {
    const existing = await Artist.findOne({
      name: new RegExp(`^${artistName.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i')
    });

    const slug = existing?.id || SAFE_SLUGS[artistName] || (
      artistName.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
    ) || `artist-${Date.now()}`;

    await Artist.updateOne(
      { name: new RegExp(`^${artistName.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') },
      {
        $set: {
          name: existing?.name || artistName,
          cover: coverUrl,
          avatar: coverUrl,
          isVerified: true
        },
        $setOnInsert: {
          id: slug
        }
      },
      { upsert: true }
    );
    lockedCount++;
    console.log(`[LOCKED] ${artistName} -> ${coverUrl.substring(0, 50)}...`);
  }

  // 2. Scan all remaining artists in MongoDB Atlas
  const allArtists = await Artist.find({}).toArray();
  console.log(`\nScanning all ${allArtists.length} registered artists...`);

  let scannedFixed = 0;
  for (const art of allArtists) {
    if (!art.name) continue;
    
    // If cover is set but avatar is empty, sync avatar
    if (art.cover && !art.avatar) {
      await Artist.updateOne({ _id: art._id }, { $set: { avatar: art.cover } });
      scannedFixed++;
      console.log(`[SYNCED AVATAR] ${art.name}`);
      continue;
    }

    // If both cover and avatar are missing
    if (!art.cover && !art.avatar) {
      const itunesImg = await searchItunesArtwork(art.name);
      if (itunesImg) {
        await Artist.updateOne({ _id: art._id }, { $set: { cover: itunesImg, avatar: itunesImg } });
        scannedFixed++;
        console.log(`[ENRICHED] ${art.name} -> ${itunesImg.substring(0, 50)}...`);
      }
    }
  }

  console.log(`\nDone! Successfully locked ${lockedCount} canonical artists and enriched ${scannedFixed} existing artist records.`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('Fatal error setting permanent artist avatars:', err);
  process.exit(1);
});
