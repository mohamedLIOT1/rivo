const mongoose = require('mongoose');
require('dotenv').config({ path: '/home/ubuntu/rivo/.env' });

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const collAlbums = mongoose.connection.collection('albums');
  const collPlaylists = mongoose.connection.collection('playlists');

  const allPlaylists = await collPlaylists.find().toArray();
  const playlistNames = new Set(allPlaylists.map(p => (p.name || '').trim().toLowerCase()));

  console.log('User Playlist names in DB:');
  allPlaylists.forEach(p => console.log(`- "${p.name}" (tracks: ${p.trackIds?.length || 0})`));

  const allAlbums = await collAlbums.find().toArray();
  console.log(`\nScanning ${allAlbums.length} albums to detect and remove user playlists...`);

  let removed = 0;
  for (const alb of allAlbums) {
    const albName = (alb.name || '').trim().toLowerCase();
    // Check if album name is in user playlists or is known user crate
    const isUserPlaylist = playlistNames.has(albName) || 
                           albName === 'peter parker' || 
                           albName.startsWith('mix') || 
                           albName.startsWith('nv.') || 
                           albName.startsWith('mdi_') || 
                           albName === 'b.b';

    if (isUserPlaylist) {
      console.log(`❌ Removing invalid album that is a user playlist: "${alb.name}" (_id: ${alb._id})`);
      await collAlbums.deleteOne({ _id: alb._id });
      removed++;
    }
  }

  console.log(`\nTotal invalid albums removed: ${removed}`);
  const remaining = await collAlbums.countDocuments();
  console.log(`Remaining official albums in DB: ${remaining}`);

  await mongoose.disconnect();
}

main().catch(console.error);
