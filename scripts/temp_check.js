const mongoose = require('./server/node_modules/mongoose');
mongoose.connect('mongodb://localhost:27017/rivo').then(async () => {
  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
  const users = await User.find({}).lean();
  for (const u of users) {
    console.log('User:', u.name, 'Email:', u.email);
    for (const pl of (u.playlists || [])) {
      console.log('  Playlist:', pl.name, 'id:', pl.id, '_id:', pl._id, 'isPublic:', pl.isPublic, 'Tracks:', pl.trackIds || pl.tracks);
    }
  }
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
