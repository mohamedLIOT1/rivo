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
  const tag = 'v1.5.5';
  const releaseName = 'Rivo v1.5.5';
  const releaseBody = `## Rivo v1.5.5 Update

### What's Changed
- **Audio Seek & Notification Sync:** Fixed audio seek jitter where moving forward/backward briefly falsely paused the app and affected Android system media notifications.
- **Intelligent Song Popularity & Interleaving:** Overhauled the Home and Web "Top Listened" / "Most Popular" sections with smart scoring and artist diversity interleaving so all top charts feature diverse hits rather than just newly uploaded tracks in bulk.
- **Categorized Hamburger Menu:** Reorganized the top tools menu into clear, distinct categories (COMMUNITY & LIVE, LIBRARY & STATS, PREFERENCES).
- **Aligned Bottom Navigation:** Updated mobile tab order (Home, Search, Library, Quran, Vault) to mirror the web platform.
- **Clean Terminology:** Replaced confusing and cyberpunk terms (Citizen identity, Password cipher, Tapes, Crates, Sonic Dispensary) with standard, modern music streaming terms across mobile and web interfaces.
- **Profile Screen Simplification:** Removed redundant duplicated tool sections for a clean, streamlined profile.
`;

  const apkPath = path.resolve(__dirname, '../Rivo-v1.5.5.apk');
  const apkBytes = fs.readFileSync(apkPath);
  console.log(`Loaded APK from ${apkPath} (${apkBytes.length} bytes)`);

  const repos = ['mohamedLIOT1/rivo', 'mohamedLIOT1/liofy'];

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

    // 2. Upload assets: Rivo-v1.5.5.apk and app-release.apk
    const assetsToUpload = [
      { name: 'Rivo-v1.5.5.apk', data: apkBytes },
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
