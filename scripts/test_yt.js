const key = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';

const searchYouTubeClientSide = async (queryOrOptions, maybeOptions = {}) => {
  let query = '';
  let targetDuration = null;
  let artist = '';
  let title = '';

  if (queryOrOptions && typeof queryOrOptions === 'object') {
    query = queryOrOptions.query || '';
    targetDuration = Number(queryOrOptions.targetDuration || queryOrOptions.duration) || null;
    artist = queryOrOptions.artist || '';
    title = queryOrOptions.title || '';
  } else if (typeof queryOrOptions === 'string') {
    query = queryOrOptions.trim();
    if (typeof maybeOptions === 'number') {
      targetDuration = maybeOptions;
    } else if (maybeOptions && typeof maybeOptions === 'object') {
      targetDuration = Number(maybeOptions.targetDuration || maybeOptions.duration) || null;
      artist = maybeOptions.artist || '';
      title = maybeOptions.title || '';
    }
  }

  if (!query && !title && !artist) return null;

  let finalQuery = query;
  if (artist && title) {
    const cleanArt = String(artist).replace(/["']/g, ' ').trim();
    const cleanTit = String(title).replace(/["']/g, ' ').trim();
    finalQuery = `"${cleanArt}" "${cleanTit}"`;
  } else if (!finalQuery) {
    finalQuery = `${artist} ${title}`.trim();
  }

  if (finalQuery.endsWith(' music')) {
    finalQuery = finalQuery.replace(/\s+music$/i, '').trim();
  }

  try {
    const res = await fetch(`https://www.youtube.com/youtubei/v1/search?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'WEB',
            clientVersion: '2.20231201.00.00',
            hl: 'en',
            gl: 'US'
          }
        },
        query: finalQuery
      })
    });
    if (!res.ok) return null;
    const d = await res.json();
    const contents = d?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents || [];
    const candidates = contents
      .map(c => c.videoRenderer)
      .filter(v => v && v.videoId);

    if (candidates.length === 0) return null;

    const parseSec = (renderer) => {
      const durText = renderer.lengthText?.simpleText || renderer.lengthText?.runs?.[0]?.text || '';
      if (!durText) return 0;
      const parts = durText.split(':').map(p => parseInt(p, 10));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) return parts[0] * 60 + parts[1];
      if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) return parts[0] * 3600 + parts[1] * 60 + parts[2];
      return 0;
    };

    const normArtist = (artist || '').toLowerCase().trim();
    const normTitle = (title || '').toLowerCase().trim();

    let scoredCandidates = candidates.map(item => {
      const vidId = item.videoId;
      const durSec = parseSec(item);
      const candTitle = (item.title?.runs?.[0]?.text || '').toLowerCase();
      const candChannel = (item.ownerText?.runs?.[0]?.text || '').toLowerCase();

      let score = 0;
      let durationDiff = targetDuration && durSec > 0 ? Math.abs(durSec - targetDuration) : null;

      if (durationDiff !== null) {
        if (durationDiff <= 5) score += 40;
        else if (durationDiff <= 15) score += 25;
        else if (durationDiff <= 35) score += 10;
        else if (durationDiff > 60) score -= 100;
      }

      if (normTitle && candTitle.includes(normTitle)) score += 35;
      if (normArtist && (candTitle.includes(normArtist) || candChannel.includes(normArtist))) score += 30;

      if (candChannel.includes('topic') || candChannel.includes('official') || candChannel.includes('vevo')) score += 25;
      if (candTitle.includes('official audio') || candTitle.includes('official lyric') || candTitle.includes('official video')) score += 20;

      if (!normTitle.includes('mix') && (candTitle.includes('mix') || candTitle.includes('full album') || candTitle.includes('playlist'))) score -= 80;
      if (!normTitle.includes('live') && candTitle.includes('live') && !normTitle.includes('حفلة')) score -= 40;
      if (durSec > 900 && (!targetDuration || targetDuration < 900)) score -= 100;

      return {
        item,
        videoId: vidId,
        duration: durSec || null,
        title: item.title?.runs?.[0]?.text || '',
        channel: item.ownerText?.runs?.[0]?.text || '',
        score,
        durationDiff
      };
    });

    if (targetDuration) {
      const withinWindow = scoredCandidates.filter(c => c.duration && c.durationDiff !== null && c.durationDiff <= 60);
      if (withinWindow.length > 0) {
        scoredCandidates = withinWindow;
      }
    }

    scoredCandidates.sort((a, b) => b.score - a.score);
    const best = scoredCandidates[0];

    if (best) {
      return {
        videoId: best.videoId,
        duration: best.duration || targetDuration || null,
        title: best.title,
        channel: best.channel
      };
    }
  } catch (e) {}
  return null;
};

async function test() {
  console.log('Testing Amr Diab - Ragea (targetDuration: 209):');
  const res1 = await searchYouTubeClientSide({
    artist: 'Amr Diab',
    title: 'Ragea',
    targetDuration: 209
  });
  console.log('Result 1:', res1);

  console.log('\nTesting with only query "Amr Diab Ragea":');
  const res2 = await searchYouTubeClientSide('Amr Diab Ragea', { targetDuration: 209 });
  console.log('Result 2:', res2);
}

test().catch(console.error);
