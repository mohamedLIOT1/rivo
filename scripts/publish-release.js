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
  const version = pkg.version || '1.5.8';
  const tag = `v${version}`;
  const releaseName = `Rivo v${version}`;
  const releaseBody = `## Rivo v${version} Update

### What's Changed
- **Album Detail Modal:** Clicking any album card now opens an authentic brutalist album modal with full tracklist, Play All, and Shuffle, rather than auto-playing.
- **Jam Room Hooks Fix:** Resolved React hook order violation that previously crashed the app when tapping the Jam room button.
- **Search Artists & Albums:** Added native Artists and Albums discovery sections with dedicated category filter pills (ALL, SONGS, ARTISTS, ALBUMS).
- **Stream Audio Resilience:** Updated audio stream resolver to prevent player buffering stalls and prioritize proxy streaming.
- **Android App Icon Sync:** Updated all Android mipmap launcher icons and background colors to perfectly match the iPhone Rivo emblem.
- **Website Playlist Cover Upload:** Fixed playlist cover photo updates with direct multipart uploads and image fallback resilience.
`;

  const rootFiles = fs.readdirSync(path.resolve(__dirname, '..'));
  const apkFileName = rootFiles.find(f => f.endsWith('.apk') && f.includes(version)) ||
                     rootFiles.find(f => f.endsWith('.apk') && f.includes('1.5.')) ||
                     rootFiles.find(f => f.endsWith('.apk'));
  const apkPath = apkFileName ? path.resolve(__dirname, '..', apkFileName) : null;
  const apkBytes = apkPath && fs.existsSync(apkPath) ? fs.readFileSync(apkPath) : null;
  if (apkBytes) {
    console.log(`Loaded APK from ${apkPath} (${apkBytes.length} bytes)`);
  }

  const ipaFileName = rootFiles.find(f => f.endsWith('.ipa') && f.includes(version)) ||
                     rootFiles.find(f => f.endsWith('.ipa') && f.includes('1.5.')) ||
                     rootFiles.find(f => f.endsWith('.ipa'));
  const ipaPath = ipaFileName ? path.resolve(__dirname, '..', ipaFileName) : null;
  const ipaBytes = ipaPath && fs.existsSync(ipaPath) ? fs.readFileSync(ipaPath) : null;
  if (ipaBytes) {
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
