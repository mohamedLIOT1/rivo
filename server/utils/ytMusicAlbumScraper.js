const axios = require('axios');

const YTM_BASE_URL = 'https://music.youtube.com/youtubei/v1';
const YTM_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
  'Content-Type': 'application/json'
};
const YTM_CONTEXT = {
  client: { clientName: 'WEB_REMIX', clientVersion: '1.20240101.01.00', hl: 'en', gl: 'US' }
};

function extractText(obj) {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;
  if (obj.simpleText) return obj.simpleText;
  if (Array.isArray(obj.runs)) return obj.runs.map(r => r.text || '').join('');
  return '';
}

function parseDuration(timeStr) {
  if (typeof timeStr === 'number') return Math.round(timeStr);
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const parts = timeStr.trim().split(':').map(p => parseInt(p, 10));
  if (parts.some(isNaN)) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts.length === 1 ? parts[0] : 0;
}

function cleanArtworkUrl(url, targetSize = 1200) {
  if (!url || typeof url !== 'string') return '';
  if (url.includes('googleusercontent.com')) {
    return url.replace(/=w\d+-h\d+[^=]*$/, `=w${targetSize}-h${targetSize}-l90-rj`)
              .replace(/=s\d+[^=]*$/, `=s${targetSize}-c-k-c0x00ffffff-no-rj`);
  }
  if (url.includes('i.ytimg.com/vi/')) {
    return url.replace(/\/hqdefault\.jpg|\/mqdefault\.jpg|\/default\.jpg/, '/maxresdefault.jpg');
  }
  return url;
}

async function resolveBrowseIdFromUrl(input) {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (trimmed.startsWith('MPREb_')) return trimmed;

  const mpreMatch = trimmed.match(/MPREb_[a-zA-Z0-9_-]+/);
  if (mpreMatch) return mpreMatch[0];

  const listMatch = trimmed.match(/list=([a-zA-Z0-9_-]+)/);
  const playlistId = listMatch ? listMatch[1] : (trimmed.startsWith('OLAK5uy_') ? trimmed : null);

  if (playlistId) {
    try {
      const pageRes = await axios.get(`https://music.youtube.com/playlist?list=${playlistId}`, {
        headers: YTM_HEADERS,
        timeout: 10000
      });
      const m = pageRes.data.match(/MPREb_[a-zA-Z0-9_-]+/);
      if (m) return m[0];
    } catch {}
    return `VL${playlistId}`;
  }
  return trimmed;
}

function extractTracksFromShelf(shelf, fallbackCover, fallbackArtist) {
  const tracks = [];
  const contents = shelf?.contents || [];

  for (let i = 0; i < contents.length; i++) {
    const r = contents[i].musicResponsiveListItemRenderer;
    if (!r) continue;

    const trackNumber = parseInt(extractText(r.index), 10) || (tracks.length + 1);
    const titleCol = r.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer;
    const title = extractText(titleCol?.text) || `Track ${trackNumber}`;

    const artistCol = r.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer;
    const trackArtist = extractText(artistCol?.text) || fallbackArtist || 'Unknown Artist';
    const durCol = r.fixedColumns?.[0]?.musicResponsiveListItemFixedColumnRenderer;
    const duration = parseDuration(extractText(durCol?.text));

    const videoId = r.playlistItemData?.videoId ||
      r.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint?.videoId ||
      titleCol?.text?.runs?.[0]?.navigationEndpoint?.watchEndpoint?.videoId;

    if (!videoId || videoId.length !== 11) continue;

    const thumb = r.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)?.[0]?.url;
    const trackCover = thumb ? cleanArtworkUrl(thumb) : fallbackCover;

    tracks.push({
      trackNumber,
      title: title.trim(),
      artist: trackArtist.trim(),
      duration,
      videoId,
      audioUrl: `https://www.youtube.com/watch?v=${videoId}`,
      cover: trackCover
    });
  }
  return tracks;
}

async function scrapeYtMusicAlbum(urlOrId) {
  const browseId = await resolveBrowseIdFromUrl(urlOrId);
  if (!browseId) throw new Error(`Unable to resolve YouTube Music album ID from: "${urlOrId}"`);

  const res = await axios.post(`${YTM_BASE_URL}/browse`, {
    context: YTM_CONTEXT,
    browseId
  }, { headers: YTM_HEADERS, timeout: 15000 });

  const data = res.data;
  let header = null;

  const tabContents = data?.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents ||
                      data?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents || [];

  for (const c of tabContents) {
    if (c.musicResponsiveHeaderRenderer) {
      header = c.musicResponsiveHeaderRenderer;
      break;
    }
  }
  if (!header && data?.header?.musicDetailHeaderRenderer) header = data.header.musicDetailHeaderRenderer;

  const albumTitle = extractText(header?.title) || 'Unknown Album';
  const subtitle = extractText(header?.subtitle);
  const artistName = extractText(header?.straplineTextOne) ||
    extractText(header?.subtitle?.runs?.find(r => r.navigationEndpoint?.browseEndpoint?.browseId?.startsWith('UC'))) ||
    'Unknown Artist';

  const rawThumb = header?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)?.[0]?.url ||
                   header?.thumbnail?.croppedSquareThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)?.[0]?.url;
  const albumCover = rawThumb ? cleanArtworkUrl(rawThumb, 1200) : '';

  const yearMatch = subtitle.match(/\b(19\d\d|20\d\d)\b/);
  const year = yearMatch ? yearMatch[1] : '';

  let releaseType = 'album';
  const lowerSub = subtitle.toLowerCase();
  if (lowerSub.includes('ep') || lowerSub.includes(' e.p.')) releaseType = 'ep';
  else if (lowerSub.includes('single')) releaseType = 'single';

  const secondaryList = data?.contents?.twoColumnBrowseResultsRenderer?.secondaryContents?.sectionListRenderer?.contents || tabContents;
  let tracks = [];
  let continuationToken = null;

  for (const sec of secondaryList) {
    const shelf = sec.musicShelfRenderer || sec.musicPlaylistShelfRenderer;
    if (shelf && shelf.contents) {
      tracks.push(...extractTracksFromShelf(shelf, albumCover, artistName));
      continuationToken = shelf.continuations?.[0]?.nextContinuationData?.continuation ||
                          shelf.continuations?.[0]?.reloadContinuationData?.continuation;
      break;
    }
  }

  let pages = 0;
  while (continuationToken && pages < 10) {
    pages++;
    try {
      const contRes = await axios.post(`${YTM_BASE_URL}/browse?continuation=${continuationToken}`, {
        context: YTM_CONTEXT
      }, { headers: YTM_HEADERS, timeout: 10000 });
      const contShelf = contRes.data?.continuationContents?.musicShelfContinuation ||
                        contRes.data?.continuationContents?.musicPlaylistShelfContinuation;
      if (!contShelf) break;
      const moreTracks = extractTracksFromShelf(contShelf, albumCover, artistName);
      if (moreTracks.length === 0) break;
      tracks.push(...moreTracks);
      continuationToken = contShelf.continuations?.[0]?.nextContinuationData?.continuation;
    } catch {
      break;
    }
  }

  if (tracks.length === 1 && releaseType === 'album') {
    releaseType = 'single';
  } else if (tracks.length > 1 && tracks.length <= 6 && releaseType === 'album' && lowerSub.includes('ep')) {
    releaseType = 'ep';
  }

  return {
    id: browseId,
    browseId,
    title: albumTitle.trim(),
    artist: artistName.trim(),
    year,
    releaseDate: year,
    releaseType,
    cover: albumCover,
    trackCount: tracks.length,
    tracks
  };
}

async function searchYtMusicArtist(artistQuery) {
  const res = await axios.post(`${YTM_BASE_URL}/search`, {
    context: YTM_CONTEXT,
    query: artistQuery
  }, { headers: YTM_HEADERS, timeout: 12000 });

  const sections = res.data?.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents || [];
  for (const sec of sections) {
    if (sec.musicCardShelfRenderer) {
      const card = sec.musicCardShelfRenderer;
      const name = extractText(card.title);
      const browseId = card.title?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId;
      if (browseId && browseId.startsWith('UC')) return { name: name.trim(), browseId };
    }
    if (sec.musicShelfRenderer) {
      for (const item of (sec.musicShelfRenderer.contents || [])) {
        const nav = item.musicResponsiveListItemRenderer?.navigationEndpoint?.browseEndpoint;
        if (nav?.browseId?.startsWith('UC')) {
          const name = extractText(item.musicResponsiveListItemRenderer?.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text);
          return { name: name.trim(), browseId: nav.browseId };
        }
      }
    }
  }
  return null;
}

function parseTwoRowItems(items, defaultType = 'album') {
  const releases = [];
  for (const it of items) {
    const r = it.musicTwoRowItemRenderer;
    if (!r) continue;
    const title = extractText(r.title);
    const subtitle = extractText(r.subtitle);
    const browseId = r.navigationEndpoint?.browseEndpoint?.browseId;
    if (!browseId) continue;

    const yearMatch = subtitle.match(/\b(19\d\d|20\d\d)\b/);
    const year = yearMatch ? yearMatch[1] : '';

    let releaseType = defaultType;
    const lowerSub = subtitle.toLowerCase();
    if (lowerSub.includes('single')) releaseType = 'single';
    else if (lowerSub.includes('ep') || lowerSub.includes(' e.p.')) releaseType = 'ep';
    else if (lowerSub.includes('album')) releaseType = 'album';

    const thumb = r.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)?.[0]?.url;
    releases.push({
      title: title.trim(),
      subtitle,
      year,
      releaseType,
      browseId,
      cover: thumb ? cleanArtworkUrl(thumb, 1200) : ''
    });
  }
  return releases;
}

async function fetchMoreReleases(moreBrowseId, moreParams, defaultType) {
  try {
    const res = await axios.post(`${YTM_BASE_URL}/browse`, {
      context: YTM_CONTEXT,
      browseId: moreBrowseId,
      params: moreParams
    }, { headers: YTM_HEADERS, timeout: 12000 });

    const sec = res.data?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents || [];
    const items = [];
    for (const s of sec) {
      const grid = s.gridRenderer || s.musicShelfRenderer;
      items.push(...(grid?.items || grid?.contents || []));
    }
    return parseTwoRowItems(items, defaultType);
  } catch {
    return [];
  }
}

async function getArtistOfficialDiscography(artistNameOrBrowseId) {
  let browseId = artistNameOrBrowseId;
  let artistName = artistNameOrBrowseId;

  if (!browseId.startsWith('UC')) {
    const searchRes = await searchYtMusicArtist(artistNameOrBrowseId);
    if (!searchRes) throw new Error(`Could not find YouTube Music artist for: "${artistNameOrBrowseId}"`);
    browseId = searchRes.browseId;
    artistName = searchRes.name;
  }

  const res = await axios.post(`${YTM_BASE_URL}/browse`, {
    context: YTM_CONTEXT,
    browseId
  }, { headers: YTM_HEADERS, timeout: 15000 });

  const sections = res.data?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents || [];
  const albums = [];
  const eps = [];
  const singles = [];

  for (const sec of sections) {
    const shelf = sec.musicCarouselShelfRenderer || sec.musicShelfRenderer;
    if (!shelf) continue;

    const title = extractText(shelf.header?.musicCarouselShelfBasicHeaderRenderer?.title) || extractText(shelf.title);
    const moreBrowseId = shelf.header?.musicCarouselShelfBasicHeaderRenderer?.moreContentButton?.buttonRenderer?.navigationEndpoint?.browseEndpoint?.browseId;
    const moreParams = shelf.header?.musicCarouselShelfBasicHeaderRenderer?.moreContentButton?.buttonRenderer?.navigationEndpoint?.browseEndpoint?.params;

    if (title === 'Albums') {
      let albumItems = (moreBrowseId && moreParams) ? await fetchMoreReleases(moreBrowseId, moreParams, 'album') : [];
      if (albumItems.length === 0) albumItems = parseTwoRowItems(shelf.contents || [], 'album');
      albums.push(...albumItems);
    } else if (title === 'Singles & EPs') {
      let seItems = (moreBrowseId && moreParams) ? await fetchMoreReleases(moreBrowseId, moreParams, 'single') : [];
      if (seItems.length === 0) seItems = parseTwoRowItems(shelf.contents || [], 'single');
      for (const item of seItems) {
        if (item.releaseType === 'ep') eps.push(item);
        else singles.push(item);
      }
    }
  }

  const dedup = (arr) => {
    const seen = new Set();
    return arr.filter(item => !seen.has(item.browseId) && seen.add(item.browseId));
  };

  return {
    artist: artistName,
    artistBrowseId: browseId,
    albums: dedup(albums),
    eps: dedup(eps),
    singles: dedup(singles)
  };
}

module.exports = {
  scrapeYtMusicAlbum,
  searchYtMusicArtist,
  getArtistOfficialDiscography,
  parseDuration,
  cleanArtworkUrl,
  resolveBrowseIdFromUrl
};
