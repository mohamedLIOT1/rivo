/**
 * Album CRUD handlers for Admin creation and updates
 * Modularized (< 400 lines).
 */

const mongoose = require('mongoose');
const { Album, Track } = require('../../models');
const { classifyGenre } = require('../../utils/genreClassifier');
const {
  escapeRegex,
  isQuranContent,
  detectQuranReciter
} = require('../../utils/helpers');

async function createAlbumHandler(req, res, { invalidateAlbumsCache }) {
  invalidateAlbumsCache();
  try {
    const { name, artist, cover, linkUrl, releaseDate, genre, trackIds = [], isQuran = false, description = '' } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Album name is required' });
    }
    if (!artist || !artist.trim()) {
      return res.status(400).json({ success: false, error: 'Artist name is required' });
    }

    const cleanName = name.trim();
    const cleanArtist = artist.trim();
    const cleanTrackIds = Array.isArray(trackIds) ? trackIds.map(String) : [];

    if (isQuran || isQuranContent(cleanName, cleanArtist, cleanName, genre, description) || detectQuranReciter(cleanName, cleanArtist, cleanName)) {
      return res.status(400).json({ success: false, error: 'Quran recitations belong in Rivo Quran system and cannot be created as music albums' });
    }

    if (cleanTrackIds.length <= 1) {
      return res.status(400).json({ success: false, error: 'Single-track releases (1 track) cannot be created as music albums' });
    }

    const releaseType = cleanTrackIds.length <= 6 ? 'ep' : 'album';

    const newAlbum = new Album({
      id: `album-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      name: cleanName,
      artist: cleanArtist,
      cover: cover ? cover.trim() : 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600',
      linkUrl: linkUrl ? linkUrl.trim() : '',
      trackIds: cleanTrackIds,
      releaseDate: releaseDate ? releaseDate.trim() : '',
      genre: classifyGenre({ title: name, artist, genre, description }).genre,
      releaseType,
      trackCount: cleanTrackIds.length,
      isAlbum: true,
      isSystem: true,
      isPublic: true,
      isQuran: false,
      description: description ? description.trim() : '',
      source: 'admin_upload',
      createdBy: req.user?.id || req.user?.name || 'admin'
    });

    await newAlbum.save();

    if (cleanTrackIds.length > 0) {
      await Track.updateMany(
        { _id: { $in: cleanTrackIds } },
        { $set: { album: cleanName } }
      ).catch(() => {});
    }

    const io = req.app.get('io') || req.io;
    if (io) io.emit('album:created', newAlbum);
    res.json({ success: true, album: newAlbum });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

async function updateAlbumHandler(req, res, { invalidateAlbumsCache }) {
  invalidateAlbumsCache();
  try {
    const albumId = req.params.id;
    const { name, artist, cover, linkUrl, releaseDate, genre, trackIds } = req.body;
    const album = await Album.findOne({ $or: [{ id: albumId }, { _id: mongoose.isValidObjectId(albumId) ? albumId : null }] });
    if (!album) return res.status(404).json({ success: false, error: 'Album not found' });
    if (album.isQuran || album.genre === 'Holy Quran' || album.genre === 'Quran' || isQuranContent(album.name, album.artist)) {
      return res.status(404).json({ success: false, error: 'Quran recitation is not accessible via music albums API' });
    }

    const oldName = album.name;
    if (name) album.name = name.trim();
    if (artist) album.artist = artist.trim();
    if (cover !== undefined) album.cover = cover.trim();
    if (linkUrl !== undefined) album.linkUrl = linkUrl.trim();
    if (releaseDate !== undefined) album.releaseDate = releaseDate;
    if (genre !== undefined) album.genre = genre;
    if (Array.isArray(trackIds)) album.trackIds = trackIds;

    await album.save();

    if (name && oldName && name.trim().toLowerCase() !== oldName.trim().toLowerCase()) {
      await Track.updateMany(
        { album: { $regex: new RegExp(`^${escapeRegex(oldName)}$`, 'i') } },
        { $set: { album: name.trim() } }
      ).catch(() => {});
    }

    const io = req.app.get('io') || req.io;
    if (io) io.emit('album:updated', album);
    res.json({ success: true, album });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

module.exports = {
  createAlbumHandler,
  updateAlbumHandler
};
