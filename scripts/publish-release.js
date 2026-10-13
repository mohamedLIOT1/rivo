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
  const tag = 'v1.5.7';
  const releaseName = 'Rivo v1.5.7';
  const releaseBody = `## Rivo v1.5.7 Update

### What's Changed
- **In-App 1-Click APK Auto-Updater & Installer:** Users no longer need to browse GitHub or download manually! The app detects new releases, shows a live download progress bar with written/total MBs, and automatically opens the native Android package installer.
- **Admin Panel Performance Fix:** Replaced heavy eager loading of all songs with smooth chunked pagination (Load More Songs / Load More Accounts), eliminating app freezing and UI lag.
- **Jam Session Smart Discovery & Modal Scroll Fix:** "Add Song" now surfaces intelligent recommendations mixing saved/liked tracks with randomized library tracks (plus a Shuffle button). The queue list has nested scrolling enabled and stays contained cleanly within the card box.
- **Jam Session Web <-> Native Live Playback & Stream Latency Sync:** Joining or tuning into a Jam session now auto-syncs playback time with latency compensation so the mobile client starts at the exact second matching web and host listeners.
- **Chat Overhaul:** Expanded message bubble width, fixed duplicate socket message echoes, added clean English read receipts ("Seen" with teal double checks), and added a 1-tap "JAM INVITE" card directly into the chat flow.
`;

  const apkPath = path.resolve(__dirname, '../Rivo-v1.5.7.apk');
  const apkBytes = fs.readFileSync(apkPath);
  console.log(`Loaded APK from ${apkPath} (${apkBytes.length} bytes)`);

  const ipaPath = path.resolve(__dirname, '../Rivo-v1.5.7.ipa');
  let ipaBytes = null;
  if (fs.existsSync(ipaPath)) {
    ipaBytes = fs.readFileSync(ipaPath);
    console.log(`Loaded IPA from ${ipaPath} (${ipaBytes.length} bytes)`);
  }

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

    // 2. Upload assets: APK and IPA
    const assetsToUpload = [
      { name: 'Rivo-v1.5.7.apk', data: apkBytes, mime: 'application/vnd.android.package-archive' },
      { name: 'app-release.apk', data: apkBytes, mime: 'application/vnd.android.package-archive' }
    ];
    if (ipaBytes) {
      assetsToUpload.push({ name: 'Rivo-v1.5.7.ipa', data: ipaBytes, mime: 'application/octet-stream' });
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
