const fs = require('fs');
const path = require('path');
const cp = require('child_process');

function getGitHubToken() {
  if (process.env.GITHUB_TOKEN) return Promise.resolve(process.env.GITHUB_TOKEN);
  return new Promise((resolve) => {
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
        reject(new Error('GitHub token not found'));
      }
    });
  });
}

async function publish() {
  const token = await getGitHubToken();
  const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8'));
  const version = pkg.version || '1.9.9.8';
  const tag = `v${version}`;
  const releaseName = `Rivo v${version} (Beta)`;
    const releaseBody = `## Rivo v${version} (Mobile v2.0.8 • Desktop v2.0.1)

### 🎛️ Spotify-Grade DJ Mix Engine
- Dual-buffer sample-accurate Web Audio API playback engine with hardware clock synchronization.
- Equal Power volume curves & BiquadFilter sweeps (High-pass bass cutoff on track A, Low-pass open on track B).
- Seamless playback from IndexedDB Blob URLs completely resolving CORS & network latency.

### 🛡️ Mix Download Gate & Auto-Sync
- Smart Download Gate modal detecting un-downloaded tracks in Mix playlists.
- Instant estimation of download size and batch download trigger before playback.
- Consent-based auto-sync: newly added songs to consented mix playlists are automatically downloaded offline.

### 📱 Library & Player Mix Indicators
- Dedicated "YOUR MIXES" section in Library with status badges and un-downloaded song counters.
- MiniPlayer "MIX MODE" pill and upcoming track countdown timer.
- FullPlayer "COMING UP NEXT (DJ MIX)" widget with one-tap instant 8s crossfade preview.

### 🚀 Instant OTA & Cross-Platform Releases
- Instant OTA fast update published for Android devices.
- Re-signed genuine Android APK (v2.0.8, Build 102) with v1/v2/v3/v4 signature schemes.
- Hermes-compiled iOS IPA (v2.0.8, Build 102).
- Desktop Release (v2.0.1).
`;

  const searchDirs = [
    path.resolve(__dirname, '../public/downloads'),
    path.resolve(__dirname, '../dist/downloads'),
    path.resolve(__dirname, '..')
  ];

  let apkPath = null;
  let ipaPath = null;
  let exePath = null;

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
    if (!exePath) {
      const match = files.find(f => f.endsWith('.exe') && (f.includes('2.0.1') || f.includes(version))) ||
                    files.find(f => f === 'Rivo.exe');
      if (match) exePath = path.join(dir, match);
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

  const exeBytes = exePath && fs.existsSync(exePath) ? fs.readFileSync(exePath) : null;
  if (exeBytes) {
    console.log(`Loaded EXE from ${exePath} (${exeBytes.length} bytes)`);
  }

  const repos = ['mohamedLIOT1/Rivo'];

  for (const repo of repos) {
    console.log(`\n=== Processing repo: ${repo} ===`);
    const headers = {
      'User-Agent': 'Rivo-Release-Uploader',
      'Authorization': `token ${token}`,
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
          prerelease: true
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
    }
    if (ipaBytes) {
      assetsToUpload.push({ name: `Rivo-v${version}.ipa`, data: ipaBytes, mime: 'application/octet-stream' });
    }
    if (exeBytes) {
      assetsToUpload.push({ name: `Rivo-v2.0.1.exe`, data: exeBytes, mime: 'application/vnd.microsoft.portable-executable' });
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
