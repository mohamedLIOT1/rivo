const key = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
fetch('https://www.youtube.com/youtubei/v1/search?key=' + key, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    context: { client: { clientName: 'WEB', clientVersion: '2.20240101.00.00' } },
    query: '"Amr Diab" "Ragea"'
  })
}).then(r => r.json()).then(data => {
  const contents = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents || [];
  for (const c of contents) {
    const vr = c?.videoRenderer;
    if (vr) {
      console.log('Video:', vr.videoId, '| Title:', vr.title?.runs?.[0]?.text, '| Duration:', vr.lengthText?.simpleText, '| Channel:', vr.ownerText?.runs?.[0]?.text);
    }
  }
}).catch(console.error);
