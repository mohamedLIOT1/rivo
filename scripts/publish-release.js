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
  const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8'));
  const version = pkg.version || '1.6.0';
  const tag = `v${version}`;
  const releaseName = `Rivo v${version}`;
  const releaseBody = `## Rivo v${version} Release Notes

### What's New in v${version}
- **Offline Folder Import Auto-Enrichment:** Importing audio directories on Android now parses full ID3v2 tags (embedded album art up to 3MB, USLT synchronized & unsynchronized lyrics, artist, title, album) and strips audio bitrate/rip suffixes.
- **Scan Offline Vault Upgrade:** Tapping SCAN in the offline vault automatically enriches existing imported songs that lacked album art or embedded lyrics.
- **60fps Silky Smooth Queue Dragging:** Virtualized queue reordering on Android with zero layout reflows, isolated item memoization, and throttled auto-scroller.
- **Auto-Sync Lyrics for Local Tracks:** Playing local/downloaded tracks while online automatically queries matching lyrics and caches them permanently to the offline vault.
`;

  const searchDirs = [
    path.resolve(__dirname, '../public/downloads'),
    path.resolve(__dirname, '../dist/downloads'),
    path.resolve(__dirname, '..')
  ];

  let apkPath = null;
  let ipaPath = null;

  for (const dir of searchDirs) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir);
    if (!apkPath) {
      const match = files.find(f => f.endsWith('.apk') && f.includes(version)) ||
                    files.find(f => f === 'Rivo.apk');
      if (match) apkPath = path.join(dir, match);
    }
    if (!ipaPath) {
      const match = files.find(f => f.endsWith('.ipa') && f.includes(version)) ||
                    files.find(f => f === 'Rivo.ipa');
      if (match) ipaPath = path.join(dir, match);
    }
  }

  const apkBytes = apkPath && fs.existsSync(apkPath) ? fs.readFileSync(apkPath) : null;
  if (apkBytes) {
    console.log(`Loaded APK from ${apkPath} (${apkBytes.length} bytes)`);
  }

  const ipaBytes = ipaPath && fs.existsSync(ipaPath) ? fs.readFileSync(ipaPath) : null;
  if (ipaBytes) {
    console.log(`Loaded IPA from ${ipaPath} (${ipaBytes.length} bytes)`);
  }

  const repos = ['WhooAre-you/Rivo'];

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

    // 2. Upload assets: APK and IPA
    const assetsToUpload = [];
    if (apkBytes) {
      assetsToUpload.push({ name: `Rivo-v${version}.apk`, data: apkBytes, mime: 'application/vnd.android.package-archive' });
      assetsToUpload.push({ name: 'app-release.apk', data: apkBytes, mime: 'application/vnd.android.package-archive' });
      assetsToUpload.push({ name: 'Rivo.apk', data: apkBytes, mime: 'application/vnd.android.package-archive' });
    }
    if (ipaBytes) {
      assetsToUpload.push({ name: `Rivo-v${version}.ipa`, data: ipaBytes, mime: 'application/octet-stream' });
      assetsToUpload.push({ name: 'Rivo.ipa', data: ipaBytes, mime: 'application/octet-stream' });
    }

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
          'Content-Type': asset.mime || 'application/octet-stream',
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
