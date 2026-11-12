const https = require('https');

async function testSearch(artist, album) {
  return new Promise(resolve => {
    const term = `${artist} ${album}`;
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=album&country=EG&limit=5`;
    https.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          console.log(`\nSearch "${term}": found ${json.resultCount} results`);
          for (const r of (json.results || []).slice(0, 3)) {
            console.log(`  - ${r.collectionName} by ${r.artistName} (ID: ${r.collectionId}, tracks: ${r.trackCount}, year: ${r.releaseDate?.slice(0,4)})`);
          }
          resolve(json.results);
        } catch (e) {
          console.error(e);
          resolve([]);
        }
      });
    }).on('error', () => resolve([]));
  });
}

async function main() {
  await testSearch('Amr Diab', 'معدي الناس');
  await testSearch('Amr Diab', 'أحلى و أحلى');
  await testSearch('Amr Diab', 'علم قلبي');
  await testSearch('Taylor Swift', 'reputation');
  await testSearch('Ziad Zaza', 'بالينى');
  await testSearch('Marwan Pablo', 'Barbary');
}

main();
