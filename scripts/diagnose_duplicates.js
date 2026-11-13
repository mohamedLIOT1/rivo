const dns = require('dns');
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch {}

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { Album, Track } = require('../server/models');

async function inspectDuplicates() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to MongoDB Atlas.');

  // Find albums by Amir Eid / أمير عيد / Cairokee
  const amirEidAlbums = await Album.find({
    artist: { $regex: /Amir Eid|أمير عيد/i }
  });
  console.log(`\nAmir Eid Albums in DB (${amirEidAlbums.length}):`);
  amirEidAlbums.forEach(a => console.log(' -', a._id.toString(), '|', a.name || a.title, '| artist:', a.artist, '| tracks:', a.trackCount || a.tracks?.length));

  // Find albums by Marwan Pablo
  const pabloAlbums = await Album.find({
    artist: { $regex: /Pablo|بابلو/i }
  });
  console.log(`\nMarwan Pablo Albums in DB (${pabloAlbums.length}):`);
  pabloAlbums.forEach(a => console.log(' -', a._id.toString(), '|', a.name || a.title, '| artist:', a.artist, '| tracks:', a.trackCount || a.tracks?.length));

  // Find all duplicate albums
  const allAlbums = await Album.find().select('name title artist trackCount tracks releaseType cover id');
  const groupMap = new Map();
  for (const alb of allAlbums) {
    const rawTitle = alb.name || alb.title || '';
    const normArtist = (alb.artist || '').toLowerCase().trim();
    const normTitle = rawTitle.toLowerCase()
      .replace(/[\(\[\{].*?[\)\]\}]/g, '')
      .replace(/[^\p{L}\p{N}]/gu, '')
      .trim();
    const key = normArtist + ':::' + normTitle;
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key).push(alb);
  }

  const duplicateAlbums = [];
  for (const [key, list] of groupMap.entries()) {
    if (list.length > 1) {
      duplicateAlbums.push({
        key,
        count: list.length,
        items: list.map(x => ({ id: x._id.toString(), customId: x.id, name: x.name || x.title, artist: x.artist, tracks: x.trackCount || x.tracks?.length }))
      });
    }
  }

  console.log('\n======================================================');
  console.log(`Total duplicate album clusters found: ${duplicateAlbums.length}`);
  console.log('======================================================');
  console.log('Duplicate Album Clusters:', JSON.stringify(duplicateAlbums, null, 2));

  // Track duplicates check
  const duplicateTracks = await Track.aggregate([
    {
      $group: {
        _id: { artist: { $toLower: '$artist' }, title: { $toLower: '$title' } },
        count: { $sum: 1 },
        ids: { $push: '$_id' },
        albums: { $push: '$album' }
      }
    },
    { $match: { count: { $gt: 1 } } },
    { $sort: { count: -1 } }
  ]);

  console.log(`\nTotal duplicate track clusters found: ${duplicateTracks.length}`);
  if (duplicateTracks.length > 0) {
    console.log('Sample duplicate tracks (top 10):', JSON.stringify(duplicateTracks.slice(0, 10), null, 2));
  }

  await mongoose.disconnect();
}

inspectDuplicates().catch(console.error);
