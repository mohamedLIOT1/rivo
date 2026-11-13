const dns = require('dns');
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch {}

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { Track, Album } = require('../server/models');

async function inspectTelegram() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to MongoDB Atlas.');

  // 1. Tracks with cloudStorage.provider === 'telegram'
  const telegramTracks = await Track.find({ 'cloudStorage.provider': 'telegram' }).select('_id title artist cloudStorage audioUrl vocalAudioUrl');
  console.log(`Tracks with cloudStorage.provider === 'telegram': ${telegramTracks.length}`);

  // 2. Tracks with audioUrl containing telegram
  const audioUrlTelegram = await Track.find({ audioUrl: /telegram|t\.me/i }).select('_id title artist audioUrl cloudStorage');
  console.log(`Tracks with audioUrl matching telegram: ${audioUrlTelegram.length}`);

  // 3. Tracks with vocalAudioUrl or stem storage on telegram
  const vocalTelegram = await Track.find({
    $or: [
      { vocalAudioUrl: /telegram|t\.me/i },
      { 'cloudStorage.vocalFileId': { $exists: true } },
      { 'cloudStorage.instrumentalFileId': { $exists: true } },
      { 'vocalCloudStorage.provider': 'telegram' }
    ]
  });
  console.log(`Tracks with vocal / stem on telegram: ${vocalTelegram.length}`);

  // 4. Distinct messageIds or fileIds
  const messageIds = new Set();
  const fileIds = new Set();
  for (const t of telegramTracks) {
    if (t.cloudStorage?.messageId) messageIds.add(t.cloudStorage.messageId);
    if (t.cloudStorage?.fileId) fileIds.add(t.cloudStorage.fileId);
  }
  console.log(`Distinct messageIds in DB: ${messageIds.size}`);
  console.log(`Distinct fileIds in DB: ${fileIds.size}`);

  // 5. Look for any other collections with telegram
  const collections = await mongoose.connection.db.listCollections().toArray();
  console.log('Collections in DB:', collections.map(c => c.name));

  // Check if any deleted tracks log or backup exists
  for (const col of collections) {
    if (col.name.includes('log') || col.name.includes('history') || col.name.includes('deleted') || col.name.includes('migration')) {
      const cnt = await mongoose.connection.db.collection(col.name).countDocuments();
      console.log(`Collection ${col.name}: ${cnt} documents`);
    }
  }

  await mongoose.disconnect();
}

inspectTelegram().catch(console.error);
