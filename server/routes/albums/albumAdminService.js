/**
 * Album Admin Operations (Import from Link, Cascading Deletion & Cleanup)
 * Strictly modularized (< 400 lines).
 */

const mongoose = require('mongoose');
const { Album, Track, User } = require('../../models');
const { classifyGenre } = require('../../utils/genreClassifier');
const {
  scrapePlaylistOrAlbum,
  isQuranContent,
  detectQuranReciter,
  searchYouTubeId,
  fetchTrackCover,
  escapeRegex
} = require('../../utils/helpers');

async function handleImportAlbum(req, res, { invalidateAlbumsCache }) {
  invalidateAlbumsCache();
  try {
    const { url, name, artist, cover, releaseDate, genre, isQuran, description } = req.body;
    if (!url || !url.trim()) {
      return res.status(400).json({ success: false, error: 'A valid Spotify album or YouTube playlist link is required' });
    }

    const cleanUrl = url.trim();
    let scraped;
    try {
      scraped = await scrapePlaylistOrAlbum(cleanUrl);
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message || 'Failed to scrape album link' });
    }

    if (!scraped || !scraped.items || scraped.items.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Could not extract tracks from the provided link. Please ensure it is a public Spotify album or YouTube playlist.' 
      });
    }

    const albumName = (name && name.trim()) || scraped.title || 'Imported Album';
    const albumArtist = (artist && artist.trim()) || scraped.artist || 'Unknown Artist';
    const albumCover = (cover && cover.trim()) || scraped.cover || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600';
    const finalIsQuran = Boolean(
      isQuran !== undefined 
        ? isQuran 
        : isQuranContent(albumName, albumArtist, '', '') || scraped.items.every(t => isQuranContent(t.title, t.artist || albumArtist))
    );
    const detectedAlbumReciter = finalIsQuran ? detectQuranReciter(albumName, albumArtist, '', '') : null;

    const trackIds = [];
    const createdTracks = [];
    const tracksToInsert = [];

    for (const item of scraped.items) {
      try {
        const duration = item.duration || 180;
        const ytId = item.videoId || (item.audioUrl ? null : await searchYouTubeId(`${item.artist || albumArtist} - ${item.title}`));
        let trackCover = item.cover || (item.videoId ? `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg` : null);
        if (!trackCover && !item.videoId) trackCover = await fetchTrackCover(item.title, item.artist || albumArtist);
        if (!trackCover && ytId) trackCover = `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`;
        if (!trackCover) trackCover = albumCover;

        const audioUrl = item.audioUrl || (ytId ? `https://www.youtube.com/watch?v=${ytId}` : '');
        let trackArtist = (item.artist && item.artist !== 'Artist') ? item.artist : albumArtist;
        const itemIsQuran = Boolean(finalIsQuran || isQuranContent(item.title, trackArtist, albumName, ''));
        if (itemIsQuran) {
          const itemReciter = detectQuranReciter(item.title, trackArtist, albumName) || detectedAlbumReciter;
          if (itemReciter) {
            trackArtist = itemReciter;
          }
        }

        tracksToInsert.push({
          title: item.title,
          artist: trackArtist,
          album: albumName,
          cover: trackCover,
          audioUrl,
          duration,
          genre: itemIsQuran ? 'Holy Quran' : classifyGenre({ title: item.title, artist: trackArtist, album: albumName, genre }).genre,
          source: item.videoId ? 'YouTube' : 'Spotify',
          isQuran: itemIsQuran
        });
      } catch (itemErr) {
        console.warn('Track import item error:', itemErr.message);
      }
    }

    if (mongoose.connection.readyState === 1 && tracksToInsert.length > 0) {
      const trulyNewTracks = [];
      for (const t of tracksToInsert) {
        let existing = null;
        if (t.audioUrl && t.audioUrl.length > 10) {
          existing = await Track.findOne({ audioUrl: t.audioUrl }).lean();
        }
        if (!existing && t.title && t.artist) {
          existing = await Track.findOne({
            title: new RegExp(`^${escapeRegex(t.title)}$`, 'i'),
            artist: new RegExp(`^${escapeRegex(t.artist)}$`, 'i')
          }).lean();
        }
        if (existing) {
          const tid = String(existing._id);
          trackIds.push(tid);
          createdTracks.push({
            id: tid,
            _id: tid,
            ...existing
          });
        } else {
          trulyNewTracks.push(t);
        }
      }

      if (trulyNewTracks.length > 0) {
        try {
          const inserted = await Track.insertMany(trulyNewTracks, { ordered: false });
          for (const t of inserted) {
            const tid = String(t._id);
            trackIds.push(tid);
            createdTracks.push({
              id: tid,
              _id: tid,
              title: t.title,
              artist: t.artist,
              album: t.album,
              cover: t.cover,
              audioUrl: t.audioUrl,
              duration: t.duration,
              genre: t.genre,
              source: t.source,
              isQuran: t.isQuran
            });
          }
        } catch (insertErr) {
          if (insertErr.insertedDocs && insertErr.insertedDocs.length > 0) {
            for (const t of insertErr.insertedDocs) {
              const tid = String(t._id);
              trackIds.push(tid);
              createdTracks.push({
                id: tid,
                _id: tid,
                title: t.title,
                artist: t.artist,
                album: t.album,
                cover: t.cover,
                audioUrl: t.audioUrl,
                duration: t.duration,
                genre: t.genre,
                source: t.source,
                isQuran: t.isQuran
              });
            }
          }
        }
      }
    }

    if (createdTracks.length === 0) {
      for (const t of tracksToInsert) {
        const tid = `track-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
        trackIds.push(tid);
        createdTracks.push({ id: tid, _id: tid, ...t });
      }
    }

    const newAlbum = new Album({
      id: `album-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      name: albumName,
      artist: albumArtist,
      cover: albumCover,
      trackIds: trackIds,
      releaseDate: releaseDate ? releaseDate.trim() : new Date().getFullYear().toString(),
      genre: finalIsQuran ? 'Holy Quran' : classifyGenre({ title: albumName, artist: albumArtist, genre, description }).genre,
      isAlbum: true,
      isSystem: true,
      isPublic: true,
      isQuran: finalIsQuran,
      description: description ? description.trim() : '',
      source: 'link_import',
      createdBy: req.user?.id || req.user?.name || 'admin'
    });

    await newAlbum.save();

    const io = req.app.get('io') || req.io;
    if (io) io.emit('album:created', newAlbum);
    res.json({
      success: true,
      album: newAlbum,
      tracks: createdTracks
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

async function handleDeleteAlbum(req, res, { invalidateAlbumsCache }) {
  invalidateAlbumsCache();
  try {
    const albumId = req.params.id;
    const deleteTracks = req.body?.deleteTracks !== false;

    let album = await Album.findOne({
      $or: [
        { id: albumId },
        ...(mongoose.isValidObjectId(albumId) ? [{ _id: albumId }] : [])
      ]
    });

    let albumName = album?.name;
    let trackIds = album?.trackIds ? [...album.trackIds] : [];

    if (!album) {
      const decoded = decodeURIComponent(albumId);
      const candidateName = albumId.startsWith('album-')
        ? decodeURIComponent(albumId.replace(/^album-/, '').replace(/-/g, ' '))
        : decoded;

      album = await Album.findOne({
        $or: [
          { name: { $regex: new RegExp(`^${escapeRegex(candidateName)}$`, 'i') } },
          { name: { $regex: new RegExp(`^${escapeRegex(decoded)}$`, 'i') } }
        ]
      });
      if (album) {
        albumName = album.name;
        trackIds = album.trackIds ? [...album.trackIds] : [];
      } else {
        albumName = candidateName;
      }
    }

    const albumDeleteFilter = {
      $or: [
        { id: albumId },
        ...(mongoose.isValidObjectId(albumId) ? [{ _id: albumId }] : []),
        ...(album?._id ? [{ _id: album._id }] : []),
        ...(albumName ? [{ name: { $regex: new RegExp(`^${escapeRegex(albumName)}$`, 'i') } }] : [])
      ]
    };

    const matchingAlbums = await Album.find(albumDeleteFilter).lean();
    for (const a of matchingAlbums) {
      if (Array.isArray(a.trackIds)) {
        trackIds.push(...a.trackIds);
      }
    }
    trackIds = Array.from(new Set(trackIds.map(String)));

    const trackQueries = [];
    if (trackIds.length > 0) {
      trackQueries.push({ _id: { $in: trackIds } });
    }
    if (albumName) {
      trackQueries.push({
        album: { $regex: new RegExp(`^${escapeRegex(albumName)}$`, 'i') }
      });
    }

    let deletedTrackIds = [];
    if (trackQueries.length > 0) {
      const associatedTracks = await Track.find({ $or: trackQueries }).lean();
      deletedTrackIds = associatedTracks.map(t => String(t._id || t.id));

      if (deleteTracks) {
        if (deletedTrackIds.length > 0) {
          await Track.deleteMany({ _id: { $in: deletedTrackIds } });

          const users = await User.find({
            $or: [
              { likedTrackIds: { $in: deletedTrackIds } },
              { 'playlists.trackIds': { $in: deletedTrackIds } }
            ]
          });

          for (const u of users) {
            let changed = false;
            if (u.likedTrackIds && u.likedTrackIds.length > 0) {
              const prevLen = u.likedTrackIds.length;
              u.likedTrackIds = u.likedTrackIds.filter(id => !deletedTrackIds.includes(String(id)));
              if (u.likedTrackIds.length !== prevLen) changed = true;
            }
            if (u.playlists && u.playlists.length > 0) {
              for (const pl of u.playlists) {
                if (pl.trackIds && pl.trackIds.length > 0) {
                  const prevLen = pl.trackIds.length;
                  pl.trackIds = pl.trackIds.filter(id => !deletedTrackIds.includes(String(id)));
                  if (pl.trackIds.length !== prevLen) changed = true;
                }
              }
            }
            if (changed) {
              await u.save();
            }
          }

          const io = req.app.get('io') || req.io;
          if (io) {
            deletedTrackIds.forEach(tId => {
              io.emit('track:deleted', { id: tId });
            });
          }
        }
      } else {
        if (deletedTrackIds.length > 0) {
          await Track.updateMany(
            { _id: { $in: deletedTrackIds } },
            { $set: { album: '' } }
          );
        }
      }
    }

    await Album.deleteMany(albumDeleteFilter);

    const io = req.app.get('io') || req.io;
    if (io) io.emit('album:deleted', { id: albumId, albumName, deletedTrackIds });
    res.json({ success: true, deletedTrackIds, albumName });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

module.exports = {
  handleImportAlbum,
  handleDeleteAlbum
};
