const fs = require('fs');
const path = require('path');
const cp = require('child_process');

function getGitHubToken() {
  return new Promise((resolve, reject) => {
    const p = cp.spawn('git', ['credential', 'fill']);
    p.stdin.write('protocol=https\nhost=github.com\n\n');
    let out = '';
    p.stdout.on('data', d => out += d);
    p.on('close', code => {
      const lines = out.split('\n');
      const passLine = lines.find(l => l.startsWith('password='));
      if (passLine) {
        resolve(passLine.slice(9).trim());
      } else {
        reject(new Error('GitHub token not found via git credential fill'));
      }
    });
  });
}

async function publish() {
  const token = await getGitHubToken();
  const tag = 'v1.5.6';
  const releaseName = 'Rivo v1.5.6';
  const releaseBody = `## Rivo v1.5.6 Update

### What's Changed
- **Jam Session UI & Full Functionality:** Redesigned Jam Room to match web design with complete socket event support. Users can host/create a Jam, join via code, copy room code, sync audio, and manage the shared queue (+ Add song search, reorder, remove) and participants (Host badge, transfer host, disconnect listener).
- **Real Platform Listening Stats & Leaderboard:** Replaced static dummy cards with live platform leaderboard from \`/api/stats/leaderboard\`. Displays Top Listener of the Week hero card, user's real listening time (weekly and total), real community rank, and full ranked leaderboard.
- **Admin Console Overhaul:** Upgraded admin screen to mirror web panel with 5 distinct tabs (Songs, Accounts, Albums, Artists, Playlists). Allows searching across all songs with filters (All / Songs / Quran), play and delete songs, and user role promotion/demotion.
- **Media Notification Time Reset Fix:** Resolved Android media notification position bug where moving to the next track kept the seekbar stuck at the end of the previous track.
`;

  const apkPath = path.resolve(__dirname, '../Rivo-v1.5.6.apk');
  const apkBytes = fs.readFileSync(apkPath);
  console.log(`Loaded APK from ${apkPath} (${apkBytes.length} bytes)`);

  const repos = ['mohamedLIOT1/rivo'];

  for (const repo of repos) {
    console.log(`\n=== Processing repo: ${repo} ===`);
    const headers = {
      'User-Agent': 'Rivo-Release-Uploader',
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json'
    };

    // 1. Check if release already exists
    let release;
    const getRes = await fetch(`https://api.github.com/repos/${repo}/releases/tags/${tag}`, { headers });
    if (getRes.ok) {
      release = await getRes.json();
      console.log(`Found existing release: ID ${release.id}`);
    } else {
      console.log(`Creating new release for ${tag}...`);
      const createRes = await fetch(`https://api.github.com/repos/${repo}/releases`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tag_name: tag,
          name: releaseName,
          body: releaseBody,
          draft: false,
          prerelease: false
        })
      });
      if (!createRes.ok) {
        const errText = await createRes.text();
        console.error(`Failed to create release on ${repo}: ${errText}`);
        continue;
      }
      release = await createRes.json();
      console.log(`Created release ID: ${release.id}`);
    }

    // 2. Upload assets: Rivo-v1.5.6.apk and app-release.apk
    const assetsToUpload = [
      { name: 'Rivo-v1.5.6.apk', data: apkBytes },
      { name: 'app-release.apk', data: apkBytes }
    ];

    for (const asset of assetsToUpload) {
      // Check if asset already exists in release
      const existingAsset = (release.assets || []).find(a => a.name === asset.name);
      if (existingAsset) {
        console.log(`Asset ${asset.name} already exists (ID ${existingAsset.id}), deleting old asset...`);
        await fetch(`https://api.github.com/repos/${repo}/releases/assets/${existingAsset.id}`, {
          method: 'DELETE',
          headers
        });
      }

      console.log(`Uploading ${asset.name} to ${repo}...`);
      const uploadUrl = `https://uploads.github.com/repos/${repo}/releases/${release.id}/assets?name=${encodeURIComponent(asset.name)}`;
      const uploadRes = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/vnd.android.package-archive',
          'Content-Length': String(asset.data.length)
        },
        body: asset.data
      });

      if (uploadRes.ok) {
        const uploaded = await uploadRes.json();
        console.log(`Successfully uploaded ${asset.name} (Download URL: ${uploaded.browser_download_url})`);
      } else {
        const errText = await uploadRes.text();
        console.error(`Failed to upload ${asset.name}: ${errText}`);
      }
    }
  }

  console.log('\nAll release tasks completed successfully!');
}

publish().catch(err => {
  console.error('Fatal error during publish:', err);
  process.exit(1);
});
