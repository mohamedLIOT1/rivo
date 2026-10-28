const fs = require('fs');
const path = require('path');
const cp = require('child_process');

function getGitHubToken() {
  if (process.env.GITHUB_TOKEN) return Promise.resolve(process.env.GITHUB_TOKEN);
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
        reject(new Error('GitHub token not found'));
      }
    });
  });
}

async function publish() {
  const token = await getGitHubToken();
  const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8'));
  const version = pkg.version || '2.1.1';
  const tag = `v${version}`;
  const releaseName = `Rivo v${version} (Mobile & Desktop)`;
  const releaseBody = `## Rivo v${version} (Mobile & Desktop)

### 🎛️ Full Rivo DJ Automix & Transition Parity
- **7 Authentic DJ Curves**: Auto, Rise (tension sweep + drop), Blend (3-band sub bass swap), Wave (rhythmic low-pass), Melt (harmonic warp), Slam (instant downbeat snap), and Fade (equal-power).
- **Exact Cue-In & Cue-Out Points**: Full waveform cue selection with quick-jump presets (Radio Cut, Chorus, Drop Start, Skip Intro).
- **Independent Volume Trim & Speed Sync**: 50%-140% volume trim per deck and 0.85x-1.15x tempo control with instant BPM beat-matching.
- **Dual-Deck Auditioning**: Solo audition for Deck A mix-out and Deck B mix-in, plus complete live transition audition before saving.
- **Strict Holy Quran Safeguards**: The Mix mode and transition engine are completely disabled for Quran recitations, surahs, and Quran playlists.

### 📱 Release Assets
- **Android APK**: \`Rivo-v${version}.apk\` (Build 111, signed v1/v2/v3).
- **iOS IPA**: \`Rivo-v${version}.ipa\` (Build 111).
- **Windows EXE**: \`Rivo-v${version}.exe\` (v${version}).
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
      const match = files.find(f => f.endsWith('.exe') && f.includes(version)) ||
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

    // 2. Upload assets: APK, IPA, EXE
    const assetsToUpload = [];
    if (apkBytes) {
      assetsToUpload.push({ name: `Rivo-v${version}.apk`, data: apkBytes, mime: 'application/vnd.android.package-archive' });
      assetsToUpload.push({ name: 'Rivo.apk', data: apkBytes, mime: 'application/vnd.android.package-archive' });
    }
    if (ipaBytes) {
      assetsToUpload.push({ name: `Rivo-v${version}.ipa`, data: ipaBytes, mime: 'application/octet-stream' });
      assetsToUpload.push({ name: 'Rivo.ipa', data: ipaBytes, mime: 'application/octet-stream' });
    }
    if (exeBytes) {
      assetsToUpload.push({ name: `Rivo-v${version}.exe`, data: exeBytes, mime: 'application/vnd.microsoft.portable-executable' });
      assetsToUpload.push({ name: `Rivo.exe`, data: exeBytes, mime: 'application/vnd.microsoft.portable-executable' });
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
