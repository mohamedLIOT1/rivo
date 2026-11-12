const http = require('http');

function search(query) {
  return new Promise((resolve) => {
    http.get(`http://127.0.0.1:3000/api/tracks/search?q=${encodeURIComponent(query)}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch(e) {
          resolve({ error: e.message, raw: data.slice(0, 200) });
        }
      });
    }).on('error', err => resolve({ error: err.message }));
  });
}

async function run() {
  console.log('--- Testing Search: ليجيسي ---');
  const res1 = await search('ليجيسي');
  console.log('Result count:', (res1.tracks || []).length);
  if (res1.tracks && res1.tracks.length > 0) {
    console.log('Top result 1:', res1.tracks[0].title, 'by', res1.tracks[0].artist);
    if (res1.tracks[1]) console.log('Top result 2:', res1.tracks[1].title, 'by', res1.tracks[1].artist);
  }

  console.log('\n--- Testing Search: النيه ---');
  const res2 = await search('النيه');
  console.log('Result count:', (res2.tracks || []).length);
  if (res2.tracks && res2.tracks.length > 0) {
    console.log('Top result 1:', res2.tracks[0].title, 'by', res2.tracks[0].artist);
    if (res2.tracks[1]) console.log('Top result 2:', res2.tracks[1].title, 'by', res2.tracks[1].artist);
  }
}

run();
