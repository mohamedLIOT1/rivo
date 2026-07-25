const mongoose = require('mongoose');
const MONGO_URI = 'mongodb+srv://mohamedmustafat79_db_user:LiofyPass12345@cluster0.sr4ypsh.mongodb.net/liofy_db?retryWrites=true&w=majority';

async function check() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to DB');
    const tracks = await mongoose.connection.db.collection('tracks').find({}).limit(15).toArray();
    console.log('--- TRACKS SAMPLE ---');
    tracks.forEach(t => {
      console.log(`ID: ${t._id}, Title: ${t.title}, Source: ${t.source}, URL: ${t.audioUrl}`);
    });
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
check();
