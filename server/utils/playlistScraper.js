const axios = require('axios');
const { parseDurationFromLabel } = require('./trackMetadataUtils');

async function scrapePlaylistOrAlbum(url) {
  let title = 'Imported Collection';
  let cover = 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600';
  let artist = '';
  let rawItems = [];
  let isAlbum = false;

  const isSpotifyAlbum = url.includes('spotify.com/album') || url.includes('spotify:album');
  const isSpotifyPlaylist = url.includes('spotify.com/playlist') || url.includes('spotify:playlist');
  isAlbum = isSpotifyAlbum;

  if (isSpotifyPlaylist || isSpotifyAlbum) {
    const match = isSpotifyAlbum
      ? (url.match(/album\/([a-zA-Z0-9]+)/) || url.match(/spotify:album:([a-zA-Z0-9]+)/))
      : (url.match(/playlist\/([a-zA-Z0-9]+)/) || url.match(/spotify:playlist:([a-zA-Z0-9]+)/));
    const entityId = match ? match[1] : null;

    if (!entityId) throw new Error(`Invalid Spotify ${isSpotifyAlbum ? 'album' : 'playlist'} link`);

    try {
      const embedType = isSpotifyAlbum ? 'album' : 'playlist';
      const embedRes = await axios.get(`https://open.spotify.com/embed/${embedType}/${entityId}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        timeout: 10000
      });

      const html = embedRes.data;
      const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([^<]+)<\/script>/);
      if (nextDataMatch) {
        const parsed = JSON.parse(nextDataMatch[1]);
        const entity = parsed?.props?.pageProps?.state?.data?.entity;
        if (entity) {
          title = entity.name || title;
          if (entity.coverArt?.sources?.[0]?.url) cover = entity.coverArt.sources[0].url;

          artist = entity.subtitle || entity.artists?.[0]?.name || '';
          const defaultArtist = artist || 'Artist';
          const trackList = entity.trackList || [];
          rawItems = trackList.map(t => ({
            title: t.title || t.name,
            artist: t.subtitle || t.artists?.[0]?.name || defaultArtist,
            duration: Math.round((t.duration || 180000) / 1000)
          }));
        }
      }
    } catch (err) {
      console.warn('Spotify embed fetch failed:', err.message);
    }
  } else if (url.includes('youtube.com/playlist') || url.includes('list=')) {
    const match = url.match(/list=([a-zA-Z0-9_-]+)/);
    const listId = match ? match[1] : null;
    if (!listId) throw new Error('Invalid YouTube playlist link');

    try {
      const ytRes = await axios.get(`https://www.youtube.com/playlist?list=${listId}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        timeout: 12000
      });
      const html = ytRes.data;

      const isValidYouTubeVideoId = (id) => typeof id === 'string' && /^[a-zA-Z0-9_-]{11}$/.test(id) && !id.startsWith('PL');

      const extractYTVideos = (node, dest = []) => {
        if (!node || typeof node !== 'object') return dest;
        if (node.lockupViewModel && node.lockupViewModel.contentId) {
          const vm = node.lockupViewModel;
          const videoId = vm.contentId;
          if (!isValidYouTubeVideoId(videoId)) return dest;
          const vTitle = vm.metadata?.lockupMetadataViewModel?.title?.content || 'Unknown Track';
          const metadataRows = vm.metadata?.lockupMetadataViewModel?.metadata?.contentMetadataViewModel?.metadataRows || [];
          const author = metadataRows[0]?.metadataParts?.[0]?.text?.content || 'Artist';
          const duration = parseDurationFromLabel(vm.rendererContext?.accessibilityContext?.label);
          const vCover = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
          dest.push({
            title: vTitle,
            artist: author,
            videoId,
            duration,
            cover: vCover,
            audioUrl: `https://www.youtube.com/watch?v=${videoId}`
          });
        } else if (node.playlistVideoRenderer && node.playlistVideoRenderer.videoId) {
          const p = node.playlistVideoRenderer;
          const videoId = p.videoId;
          if (!isValidYouTubeVideoId(videoId)) return dest;
          const vTitle = p.title?.runs?.[0]?.text || p.title?.simpleText || 'Unknown Track';
          const author = p.shortBylineText?.runs?.[0]?.text || 'Artist';
          const duration = p.lengthSeconds ? parseInt(p.lengthSeconds, 10) : 200;
          const vCover = p.thumbnail?.thumbnails?.slice(-1)?.[0]?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
          dest.push({
            title: vTitle,
            artist: author,
            videoId,
            duration,
            cover: vCover,
            audioUrl: `https://www.youtube.com/watch?v=${videoId}`
          });
        } else if (Array.isArray(node)) {
          for (const el of node) extractYTVideos(el, dest);
        } else {
          for (const k of Object.keys(node)) {
            if (k !== 'lockupViewModel' && k !== 'playlistVideoRenderer') {
              extractYTVideos(node[k], dest);
            }
          }
        }
        return dest;
      };

      const findYTContinuationToken = (node) => {
        if (!node || typeof node !== 'object') return null;
        if (node.continuationItemRenderer) {
          const tok = node.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token;
          if (tok) return tok;
        }
        if (node.continuationCommand && node.continuationCommand.token) {
          return node.continuationCommand.token;
        }
        if (Array.isArray(node)) {
          for (const el of node) {
            const tok = findYTContinuationToken(el);
            if (tok) return tok;
          }
        } else {
          for (const k of Object.keys(node)) {
            const tok = findYTContinuationToken(node[k]);
            if (tok) return tok;
          }
        }
        return null;
      };

      const initialDataMatch = html.match(/var ytInitialData = ({.*?});<\/script>/s) || html.match(/ytInitialData\s*=\s*({.+?});/);
      if (initialDataMatch) {
        try {
          const data = JSON.parse(initialDataMatch[1]);
          const headerTitle = data?.metadata?.playlistMetadataRenderer?.title || data?.header?.playlistHeaderRenderer?.title?.simpleText;
          if (headerTitle) title = headerTitle;

          const headerOwner = data?.header?.playlistHeaderRenderer?.ownerText?.runs?.[0]?.text;
          if (headerOwner) artist = headerOwner;

          extractYTVideos(data, rawItems);
          let continuationToken = findYTContinuationToken(data);

          const apiKeyMatch = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/) || html.match(/"innertubeApiKey":"([^"]+)"/i) || html.match(/"key":"(AIza[^"]+)"/);
          const apiKey = apiKeyMatch ? apiKeyMatch[1] : null;
          const clientVersionMatch = html.match(/"INNERTUBE_CONTEXT_CLIENT_VERSION":"([^"]+)"/) || html.match(/"clientVersion":"([^"]+)"/);
          const clientVersion = clientVersionMatch ? clientVersionMatch[1] : '2.20240101.00.00';

          let pageCount = 0;
          const MAX_PAGES = 30;

          while (continuationToken && apiKey && pageCount < MAX_PAGES) {
            pageCount++;
            try {
              const contRes = await axios.post(
                `https://www.youtube.com/youtubei/v1/browse?key=${apiKey}`,
                {
                  context: {
                    client: {
                      clientName: 'WEB',
                      clientVersion: clientVersion,
                      hl: 'en',
                      gl: 'US'
                    }
                  },
                  continuation: continuationToken
                },
                {
                  headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Content-Type': 'application/json'
                  },
                  timeout: 10000
                }
              );

              const contData = contRes.data;
              const prevLen = rawItems.length;
              extractYTVideos(contData, rawItems);
              continuationToken = findYTContinuationToken(contData);

              if (rawItems.length === prevLen) {
                break;
              }
            } catch (pageErr) {
              break;
            }
          }

          const seenVids = new Set();
          rawItems = rawItems.filter(item => {
            if (!item.videoId || !isValidYouTubeVideoId(item.videoId)) return false;
            if (seenVids.has(item.videoId)) return false;
            seenVids.add(item.videoId);
            return true;
          });
        } catch (e) {}
      }

      if (title === 'Imported Collection') {
        const titleMatch = html.match(/<title>([^<]+)<\/title>/);
        if (titleMatch) {
          title = titleMatch[1].replace(' - YouTube', '').trim();
        }
      }

      if (rawItems.length > 0 && rawItems[0].cover) {
        cover = rawItems[0].cover;
      }
    } catch (err) {
      if (err.response?.status === 404) {
        throw new Error('YouTube playlist not found (404). Please verify the link is complete and the playlist is public.');
      }
      throw err;
    }
  } else if (url.includes('music.apple.com')) {
    try {
      const appleRes = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 10000
      });
      const html = appleRes.data;
      const titleMatch = html.match(/<title>([^<]+)<\/title>/);
      if (titleMatch) {
        title = titleMatch[1].replace(' - Apple Music', '').trim();
      }
    } catch (err) {}
  }

  if (!artist && rawItems.length > 0) {
    const artistCounts = {};
    rawItems.forEach(item => {
      if (item.artist && item.artist !== 'Artist') {
        artistCounts[item.artist] = (artistCounts[item.artist] || 0) + 1;
      }
    });
    const sorted = Object.entries(artistCounts).sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0) artist = sorted[0][0];
  }

  return { title, cover, artist, isAlbum, items: rawItems };
}

module.exports = {
  scrapePlaylistOrAlbum
};
