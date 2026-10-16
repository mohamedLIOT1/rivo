const express = require('express');
const router = express.Router();
const { Artist, Track, Album } = require('../models');
const { adminAuth } = require('../middleware/auth');
const {
  getCanonicalArtistName,
  getArtistAliases,
  escapeRegex
} = require('../utils/helpers');

// Get all artists with track & album counts
router.get('/', async (req, res) => {
  try {
    const allTracks = await Track.find({}, 'artist album cover plays').lean();
    const allAlbums = await Album.find().lean();

    const artistMap = {};
    for (const t of allTracks) {
      if (!t.artist) continue;
      const canonical = getCanonicalArtistName(t.artist);
      const key = canonical.toLowerCase();
      if (!artistMap[key]) {
        artistMap[key] = {
          id: key,
          name: canonical,
          avatar: t.cover,
          trackCount: 0,
          albumCount: 0,
          totalPlays: 0,
          albums: []
        };
      }
      artistMap[key].trackCount++;
      artistMap[key].totalPlays += (Number(t.plays) || 0);
      if (!artistMap[key].avatar && t.cover) artistMap[key].avatar = t.cover;
    }

    for (const a of allAlbums) {
      if (!a.artist) continue;
      const canonical = getCanonicalArtistName(a.artist);
      const key = canonical.toLowerCase();
      if (artistMap[key]) {
        artistMap[key].albumCount++;
        artistMap[key].albums.push(a);
      }
    }

    const artists = Object.values(artistMap).sort((a, b) => b.trackCount - a.trackCount);
    res.json({ success: true, artists });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Get Artist Profile by Name
router.get('/:name', async (req, res) => {
  try {
    const rawName = decodeURIComponent(req.params.name).trim();
    const canonicalName = getCanonicalArtistName(rawName);
    const aliases = getArtistAliases(rawName);
    const allNames = Array.from(new Set([rawName, canonicalName, ...aliases]));
    const pattern = allNames.map(escapeRegex).join('|');
    const regex = new RegExp(`^(?:${pattern})$`, 'i');

    const [tracks, albums, artistDoc] = await Promise.all([
      Track.find({ artist: { $regex: regex } }).sort({ plays: -1 }).lean(),
      Album.find({ artist: { $regex: regex } }).sort({ createdAt: -1 }).lean(),
      Artist.findOne({ name: { $regex: regex } }).lean()
    ]);

    const formattedTracks = tracks.map(t => ({
      id: String(t._id),
      _id: String(t._id),
      ...t
    }));

    const artistData = {
      id: canonicalName.toLowerCase().replace(/[^a-z0-9_-]/g, '-'),
      name: artistDoc?.name || canonicalName,
      avatar: artistDoc?.cover || artistDoc?.avatar || tracks[0]?.cover || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600',
      cover: artistDoc?.cover || tracks[0]?.cover || '',
      banner: artistDoc?.banner || '',
      bio: artistDoc?.bio || '',
      isVerified: Boolean(artistDoc?.isVerified),
      aliases,
      trackCount: tracks.length,
      albumCount: albums.length,
      totalPlays: tracks.reduce((sum, t) => sum + (Number(t.plays) || 0), 0),
      tracks: formattedTracks,
      albums
    };

    res.json({ success: true, artist: artistData });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Admin: Edit / Update Artist Profile
router.put('/:name', adminAuth, async (req, res) => {
  try {
    const rawName = decodeURIComponent(req.params.name).trim();
    const { name, bio, cover, banner, isVerified, customLinks } = req.body;
    const newName = (name || rawName).trim();
    const artistId = newName.toLowerCase().replace(/[^a-z0-9_-]/g, '-');

    const updated = await Artist.findOneAndUpdate(
      { name: { $regex: new RegExp(`^${escapeRegex(rawName)}$`, 'i') } },
      {
        $set: {
          id: artistId,
          name: newName,
          bio: bio !== undefined ? bio : '',
          cover: cover || '',
          banner: banner || '',
          isVerified: isVerified !== undefined ? Boolean(isVerified) : false,
          customLinks: customLinks || [],
          updatedBy: req.user?.name || 'admin'
        }
      },
      { upsert: true, new: true }
    );

    if (name && rawName.toLowerCase() !== newName.toLowerCase()) {
      await Track.updateMany(
        { artist: { $regex: new RegExp(`^${escapeRegex(rawName)}$`, 'i') } },
        { $set: { artist: newName } }
      ).catch(() => {});
      await Album.updateMany(
        { artist: { $regex: new RegExp(`^${escapeRegex(rawName)}$`, 'i') } },
        { $set: { artist: newName } }
      ).catch(() => {});
    }

    const io = req.app.get('io') || req.io;
    if (io) io.emit('artist:updated', updated);
    res.json({ success: true, artist: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
