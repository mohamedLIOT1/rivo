const mongoose = require('/home/ubuntu/rivo/server/node_modules/mongoose');
mongoose.connect('mongodb://localhost:27017/rivo').then(async () => {
  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
  const users = await User.find({ 'playlists.name': /peter/i }).lean();
  for (const u of users) {
    for (const pl of (u.playlists || [])) {
      if (/peter/i.test(pl.name)) {
        console.log('Playlist:', pl.name, 'id:', pl.id, '_id:', pl._id);
        console.log('trackIds:', pl.trackIds);
        console.log('tracks:', JSON.stringify(pl.tracks, null, 2));
      }
    }
  }
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
