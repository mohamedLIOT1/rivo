require('dotenv').config();
const mongoose = require('mongoose');
const { Track } = require('../server/models');

async function fixRagea() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');
  
  const query = {
    $or: [
      { title: { $regex: /^ragea$/i }, artist: { $regex: /amr diab|عمرو دياب/i } },
      { title: { $regex: /راجع/i }, artist: { $regex: /amr diab|عمرو دياب/i } }
    ]
  };
  
  const before = await Track.find(query).lean();
  console.log('Before update:');
  for (const t of before) {
    console.log(`- ID: ${t._id}, Title: "${t.title}", Artist: "${t.artist}", Duration: ${t.duration}, AudioUrl: ${t.audioUrl}`);
  }
  
  const updateResult = await Track.updateMany(query, {
    $set: {
      audioUrl: 'https://www.youtube.com/watch?v=OU1CJ3-TIGc',
      duration: 209,
      youtubeId: 'OU1CJ3-TIGc'
    }
  });
  console.log('Update result:', updateResult);
  
  const after = await Track.find(query).lean();
  console.log('After update:');
  for (const t of after) {
    console.log(`- ID: ${t._id}, Title: "${t.title}", Artist: "${t.artist}", Duration: ${t.duration}, AudioUrl: ${t.audioUrl}`);
  }
  
  process.exit(0);
}

fixRagea().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
