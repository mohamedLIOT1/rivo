/**
 * Album Metadata Auto-Lookup Service (iTunes API & Link Scraper)
 * Modularized (< 400 lines).
 */

const axios = require('axios');
const { classifyGenre } = require('../../utils/genreClassifier');
const { scrapePlaylistOrAlbum } = require('../../utils/helpers');

async function handleAlbumLookup(req, res) {
  try {
    const { query, url } = req.query;
    if (!query && !url) {
      return res.status(400).json({ success: false, error: 'Query or URL is required' });
    }

    if (url && (url.includes('spotify.com') || url.includes('youtube.com') || url.includes('youtu.be') || url.includes('music.apple.com'))) {
      const scraped = await scrapePlaylistOrAlbum(url.trim());
      return res.json({
        success: true,
        name: scraped.title,
        artist: scraped.artist,
        cover: scraped.cover,
        releaseDate: scraped.releaseDate || new Date().getFullYear().toString(),
        genre: classifyGenre({ title: scraped.title, artist: scraped.artist, genre: scraped.genre }).genre,
        tracks: (scraped.items || []).map(t => ({
          title: t.title,
          artist: t.artist || scraped.artist,
          duration: t.duration || 180,
          cover: t.cover || scraped.cover
        }))
      });
    }

    const searchTerm = (query || '').trim();
    const itunesRes = await axios.get('https://itunes.apple.com/search', {
      params: {
        term: searchTerm,
        entity: 'album',
        limit: 5
      },
      timeout: 10000
    });

    const albumResult = itunesRes.data?.results?.[0];
    if (!albumResult) {
      return res.status(404).json({ success: false, error: 'No album metadata found for this search' });
    }

    let highResCover = albumResult.artworkUrl100 || '';
    if (highResCover) {
      highResCover = highResCover.replace(/\/\d+x\d+bb\./, '/1200x1200bb.');
    }

    const releaseYear = albumResult.releaseDate ? new Date(albumResult.releaseDate).getFullYear().toString() : new Date().getFullYear().toString();

    let tracks = [];
    try {
      const lookupRes = await axios.get('https://itunes.apple.com/lookup', {
        params: {
          id: albumResult.collectionId,
          entity: 'song'
        },
        timeout: 10000
      });
      const results = lookupRes.data?.results || [];
      tracks = results.filter(r => r.wrapperType === 'track').map(r => ({
        title: r.trackName,
        artist: r.artistName || albumResult.artistName,
        duration: Math.round((r.trackTimeMillis || 180000) / 1000),
        trackNumber: r.trackNumber,
        cover: highResCover
      }));
    } catch (lookupErr) {
      console.warn('iTunes album track lookup notice:', lookupErr.message);
    }

    return res.json({
      success: true,
      name: albumResult.collectionName,
      artist: albumResult.artistName,
      cover: highResCover,
      releaseDate: releaseYear,
      genre: classifyGenre({ title: albumResult.collectionName, artist: albumResult.artistName, genre: albumResult.primaryGenreName }).genre,
      trackCount: albumResult.trackCount,
      tracks
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || 'Album lookup failed' });
  }
}

module.exports = {
  handleAlbumLookup
};
