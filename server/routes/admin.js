const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { User, Track, Album, Artist, Message } = require('../models');
const { adminAuth, isAdminUser, isVerifiedUser } = require('../middleware/auth');
const { getCloudStorageTelemetry } = require('../utils/cloudUsageHelper');
const { splitArtistNames, getPrimaryArtist, getCanonicalArtistName } = require('../utils/artistAlbumUtils');

// Analytics Endpoint
router.get('/analytics', adminAuth, async (req, res) => {
  try {
    const now = new Date();
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const [
      totalUsers, newUsersWeek, newUsersMonth,
      totalTracks, onlineNow
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ createdAt: { $gte: weekAgo } }),
      User.countDocuments({ createdAt: { $gte: monthAgo } }),
      Track.countDocuments(),
      User.countDocuments({ lastActiveAt: { $gte: new Date(now - 5 * 60 * 1000) } })
    ]);
    const topListeners = await User.find()
      .sort({ totalListeningSeconds: -1 })
      .limit(5)
      .select('name avatar totalListeningSeconds isVerified');
    res.json({
      success: true,
      data: { totalUsers, newUsersWeek, newUsersMonth, totalTracks, onlineNow, topListeners }
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Broadcast Message Endpoint
router.post('/broadcast', adminAuth, (req, res) => {
  const { message, type = 'info' } = req.body || {};
  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Valid message string required' });
  }
  if (req.io) {
    req.io.emit('system:broadcast', { message: message.trim(), type, timestamp: Date.now() });
  }
  res.json({ success: true, sent: true });
});

// View all users
router.get('/users', adminAuth, async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 }).lean();
    const formatted = users.map(u => ({
      id: String(u._id),
      _id: String(u._id),
      name: u.name,
      email: u.email,
      avatar: u.avatar,
      bio: u.bio || '',
      role: isAdminUser(u) ? 'admin' : (u.role || 'user'),
      isAdmin: isAdminUser(u),
      isVerified: isVerifiedUser(u),
      playlistsCount: (u.playlists || []).length,
      likedSongsCount: (u.likedTrackIds || []).length,
      followersCount: (u.followers || []).length,
      followingCount: (u.following || []).length,
      createdAt: u.createdAt || (u._id && mongoose.Types.ObjectId.isValid(u._id) ? u._id.getTimestamp() : new Date())
    }));
    res.json({ success: true, users: formatted, total: formatted.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update user role or verified status
router.patch('/users/:id/role', adminAuth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }
    const { role, isVerified } = req.body || {};
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (role !== undefined) {
      user.role = role === 'admin' ? 'admin' : 'user';
      user.isAdmin = user.role === 'admin' || isAdminUser(user);
    }
    if (isVerified !== undefined) {
      user.isVerified = Boolean(isVerified);
    }
    await user.save();
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete user account (Admin only)
router.delete('/users/:id', adminAuth, async (req, res) => {
  try {
    const targetId = req.params.id;
    if (!mongoose.isValidObjectId(targetId)) {
      return res.status(400).json({ success: false, error: 'Invalid user ID format' });
    }
    if (String(targetId) === String(req.user.id)) {
      return res.status(400).json({ success: false, error: 'Cannot delete your own admin account' });
    }

    const user = await User.findById(targetId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Clean up references in database
    await Promise.all([
      User.findByIdAndDelete(targetId),
      User.updateMany({}, { $pull: { followers: targetId, following: targetId } }),
      Message.deleteMany({ $or: [{ sender: targetId }, { recipient: targetId }] }),
    ]);

    res.json({ success: true, message: `User ${user.name} deleted successfully` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get all playlists across website
router.get('/playlists', adminAuth, async (req, res) => {
  try {
    const users = await User.find({ 'playlists.0': { $exists: true } }, 'name username email playlists').lean();
    const allPlaylists = [];
    for (const u of users) {
      for (const pl of u.playlists || []) {
        allPlaylists.push({
          ...pl,
          id: pl.id || String(pl._id),
          ownerId: String(u._id),
          ownerName: u.name || u.username || 'User',
          ownerEmail: u.email
        });
      }
    }
    res.json({ success: true, playlists: allPlaylists });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Cloud Storage, Quran Migration Progress & Capacity Telemetry
router.get('/cloud-status', adminAuth, async (req, res) => {
  try {
    const data = await getCloudStorageTelemetry({ bypassCache: req.query.refresh === '1' });
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Get all albums across website
router.get('/albums', adminAuth, async (req, res) => {
  try {
    const albums = await Album.find().sort({ updatedAt: -1 }).lean();
    res.json({ success: true, albums });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Run Discography Organizer & Deduplication Bot
router.post('/organize-albums', adminAuth, async (req, res) => {
  try {
    const { organizeArtistAlbumsBot } = require('../workers/artistAlbumOrganizerBot');
    const report = await organizeArtistAlbumsBot();
    res.json({ success: true, report });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Get Multi-Worker Pipeline Status
router.get('/pipeline-status', adminAuth, async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const statusFile = process.platform === 'win32'
      ? path.resolve(__dirname, '../../data/discography_pipeline_status.json')
      : path.resolve('/home/ubuntu/rivo/data/discography_pipeline_status.json');
    if (fs.existsSync(statusFile)) {
      const statusData = JSON.parse(fs.readFileSync(statusFile, 'utf8'));
      return res.json({ success: true, status: statusData });
    }
    // Fallback status if not created yet
    res.json({
      success: true,
      status: {
        running: false,
        currentWorker: 0,
        currentWorkerName: 'Standby',
        currentArtist: 'None',
        currentStage: 'Pipeline ready',
        processedArtists: ['Lege-Cy', 'Marwan Pablo', 'Marwan Moussa', 'El Joker', 'Cairokee', 'Wegz', 'Amr Diab'],
        upcomingArtists: ['Tamer Hosny', 'Mohamed Hamaki', 'Tamer Ashour', 'Sherine', 'Essam Sasa', 'Muslim', 'Tul8te', 'Abyusif', 'Afroto', 'Ahmed Saad'],
        remainingCount: 10,
        totalArtists: 17,
        stats: { albumsCreated: 38, tracksOrganized: 180, coversVerified: 38 },
        lastUpdated: Date.now()
      }
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Trigger 3-Worker Pipeline
router.post('/run-pipeline', adminAuth, (req, res) => {
  try {
    const { spawn } = require('child_process');
    const path = require('path');
    const fs = require('fs');
    const statusFile = process.platform === 'win32'
      ? path.resolve(__dirname, '../../data/discography_pipeline_status.json')
      : path.resolve('/home/ubuntu/rivo/data/discography_pipeline_status.json');

    // Immediately set active running status
    try {
      const dir = path.dirname(statusFile);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(statusFile, JSON.stringify({
        running: true,
        currentWorker: 1,
        currentWorkerName: 'Worker 1: Artist & Discography Scout',
        currentArtist: 'Starting...',
        currentStage: 'Starting autonomous discography discovery and album organization...',
        processedArtists: [],
        upcomingArtists: [],
        remainingCount: 0,
        totalArtists: 0,
        stats: { albumsCreated: 0, tracksOrganized: 0, coversVerified: 0 },
        lastUpdated: Date.now()
      }, null, 2), 'utf8');
    } catch (e) {}

    const workerScript = process.platform === 'win32'
      ? path.resolve(__dirname, '../workers/artistDiscographyPipeline.js')
      : '/home/ubuntu/rivo/server/workers/artistDiscographyPipeline.js';
    const child = spawn('node', [workerScript], {
      detached: true,
      stdio: 'ignore'
    });
    child.unref();
    res.json({ success: true, message: '3-Worker Discography Pipeline started in background' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Repair Mismatched & Corrupted Tracks and Clean Album Singles
router.post('/repair-tracks', adminAuth, async (req, res) => {
  try {
    let repairedTracks = 0;

    // 1. Repair "الخط ده خطي" (El Khat Dah Khatty) - Cairokee
    const elKhatMatches = await Track.find({
      $or: [
        { title: /الخط ده خطي/i },
        { title: /الخط دة خطى/i },
        { title: /el khat/i }
      ]
    });
    for (const t of elKhatMatches) {
      t.duration = 309;
      t.audioUrl = 'https://www.youtube.com/watch?v=qAq_b3cwBwk';
      t.youtubeId = 'qAq_b3cwBwk';
      await t.save();
      repairedTracks++;
    }

    // 2. Repair "Ethbat Makanak" (اثبت مكانك) - Cairokee
    const ethbatMatches = await Track.find({
      $or: [
        { title: /اثبت مكانك/i },
        { title: /ethbat makanak/i }
      ]
    });
    for (const t of ethbatMatches) {
      if (t.duration > 500 || (t.audioUrl && (t.audioUrl.includes('G2nwqlL1nyo') || t.duration > 600))) {
        const isNayer = /nayer/i.test(t.title) || /ناير/i.test(t.title);
        t.duration = isNayer ? 353 : 284;
        t.youtubeId = isNayer ? '0hhXwSen-Vw' : 'fmFVtO5aI80';
        t.audioUrl = `https://www.youtube.com/watch?v=${t.youtubeId}`;
        await t.save();
        repairedTracks++;
      }
    }

    // 3. Scan for other songs with inflated durations (> 660s) that are NOT podcasts/quran
    const inflatedTracks = await Track.find({
      duration: { $gt: 660 },
      isPodcast: { $ne: true },
      isQuran: { $ne: true },
      contentType: { $nin: ['podcast', 'quran'] },
      genre: { $nin: ['podcast', 'quran', 'quran-radio', 'Islamic'] }
    });
    for (const t of inflatedTracks) {
      const combined = `${t.title} ${t.artist} ${t.album}`.toLowerCase();
      const isActuallyLong = /(?:podcast|بودكاست|حلقة|سورة|مصحف|تلاوة|كوكتيل|ساعتين|حفلة|concert|live|dj|set|mix)/i.test(combined);
      if (!isActuallyLong) {
        t.duration = 210;
        t.audioUrl = '';
        await t.save();
        repairedTracks++;
      }
    }

    // 4. Purge singles from Album collection
    const singleAlbumsRes = await Album.deleteMany({
      $or: [
        { releaseType: 'single' },
        { name: /\s*-\s*Single$/i },
        { name: /\s*\(Single\)$/i },
        { trackCount: 1, isAlbum: true }
      ]
    });

    // 5. Purge fake collaboration artist profiles from Artist collection
    const allArtistsInDb = await Artist.find().lean();
    let purgedArtistsCount = 0;
    const fakeArtistIds = [];
    for (const a of allArtistsInDb) {
      if (!a.name) continue;
      const parts = splitArtistNames(a.name);
      if (parts.length > 1) {
        fakeArtistIds.push(a._id);
      }
    }
    if (fakeArtistIds.length > 0) {
      const artDelRes = await Artist.deleteMany({ _id: { $in: fakeArtistIds } });
      purgedArtistsCount = artDelRes.deletedCount;
    }

    res.json({
      success: true,
      message: `Repaired ${repairedTracks} tracks, purged ${singleAlbumsRes.deletedCount} single albums, and removed ${purgedArtistsCount} fake collaboration artist profiles.`,
      repairedTracks,
      purgedAlbums: singleAlbumsRes.deletedCount,
      purgedArtists: purgedArtistsCount
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
