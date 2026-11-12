const https = require('https');
const http = require('http');

function checkUrl(url) {
  return new Promise((resolve) => {
    if (!url) return resolve(0);
    try {
      const u = new URL(url);
      const mod = u.protocol === 'https:' ? https : http;
      const req = mod.request(u, { method: 'HEAD', timeout: 5000 }, (res) => {
        resolve(res.statusCode);
      });
      req.on('error', () => resolve(0));
      req.on('timeout', () => { req.destroy(); resolve(408); });
      req.end();
    } catch(e) { resolve(0); }
  });
}

// Extract OFFICIAL_ALBUM_COVERS from ArtistScreen.jsx
const fs = require('fs');
const content = fs.readFileSync('src/screens/ArtistScreen.jsx', 'utf8');
const match = content.match(/export const OFFICIAL_ALBUM_COVERS = \{([\s\S]*?)\n\};/);
if (!match) {
  console.error('Could not find OFFICIAL_ALBUM_COVERS');
  process.exit(1);
}

const entries = match[1].split('\n')
  .map(line => line.trim())
  .filter(line => line && !line.startsWith('//') && line.includes(':'))
  .map(line => {
    const parts = line.split(':');
    const key = parts[0].trim().replace(/['"]/g, '');
    const val = parts.slice(1).join(':').trim().replace(/['",]/g, '');
    return { key, val };
  });

async function main() {
  console.log(`Checking ${entries.length} covers in OFFICIAL_ALBUM_COVERS...`);
  const broken = [];
  for (const entry of entries) {
    const status = await checkUrl(entry.val);
    if (status !== 200) {
      console.log(`❌ [${status}] ${entry.key}: ${entry.val}`);
      broken.push(entry);
    } else {
      console.log(`✅ [200] ${entry.key}`);
    }
  }
  console.log(`Finished. Total broken: ${broken.length}`);
}

main().catch(console.error);
