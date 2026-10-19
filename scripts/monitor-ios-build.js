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
      const line = out.split('\n').find(l => l.startsWith('password='));
      if (line) resolve(line.slice(9).trim());
      else reject(new Error('No token found'));
    });
  });
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function monitor() {
  const token = await getGitHubToken();
  const repo = 'WhooAre-you/Rivo';
  const tag = 'v1.5.7';
  const runId = process.argv[2] || '38467137734';

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'iOS-Monitor'
  };

  console.log(`Monitoring GitHub Actions Run ID: ${runId} for repo: ${repo}...`);

  let run = null;
  while (true) {
    try {
      const res = await fetch(`https://api.github.com/repos/${repo}/actions/runs/${runId}`, { headers });
      if (res.ok) {
        run = await res.json();
        console.log(`[${new Date().toLocaleTimeString()}] Status: ${run.status}, Conclusion: ${run.conclusion || 'in_progress'}`);
        if (run.status === 'completed') {
          break;
        }
      } else {
        console.log(`Failed to fetch run: ${res.status}`);
      }
    } catch (e) {
      console.log(`Fetch error: ${e.message}`);
    }
    await sleep(20000);
  }

  if (run.conclusion !== 'success') {
    console.error(`Workflow completed with status: ${run.conclusion}`);
    process.exit(1);
  }

  console.log('\nWorkflow succeeded! Fetching artifacts...');
  const artRes = await fetch(`https://api.github.com/repos/${repo}/actions/runs/${runId}/artifacts`, { headers });
  const artData = await artRes.json();
  const artifact = (artData.artifacts || []).find(a => a.name.includes('IPA') || a.name.includes('ipa'));

  if (!artifact) {
    console.error('No IPA artifact found in run!');
    return;
  }

  console.log(`Found IPA artifact: ${artifact.name} (${artifact.size_in_bytes} bytes). Downloading...`);
  const zipRes = await fetch(artifact.archive_download_url, { headers });
  if (!zipRes.ok) {
    console.error(`Failed to download artifact zip: ${zipRes.status}`);
    return;
  }

  const zipBuffer = Buffer.from(await zipRes.arrayBuffer());
  const tempZipPath = path.resolve(__dirname, '../temp-ipa.zip');
  fs.writeFileSync(tempZipPath, zipBuffer);
  console.log(`Saved artifact zip to ${tempZipPath} (${zipBuffer.length} bytes)`);

  // Extract using PowerShell
  console.log('Extracting IPA from zip...');
  cp.execSync(`powershell -Command "Expand-Archive -Force -Path '${tempZipPath}' -DestinationPath '${path.resolve(__dirname, '..')}'"`);
  if (fs.existsSync(tempZipPath)) fs.unlinkSync(tempZipPath);

  // Check extracted files
  const rootDir = path.resolve(__dirname, '..');
  const files = fs.readdirSync(rootDir);
  const ipaFile = files.find(f => f.endsWith('.ipa') && f.includes('1.5.7')) || files.find(f => f.endsWith('.ipa'));

  if (!ipaFile) {
    console.error('No .ipa file found after extraction!');
    return;
  }

  const srcIpaPath = path.join(rootDir, ipaFile);
  const v157IpaPath = path.join(rootDir, 'Rivo-v1.5.7.ipa');
  const rivoIpaPath = path.join(rootDir, 'Rivo.ipa');
  const pubDir = path.join(rootDir, 'public/downloads');

  if (srcIpaPath !== v157IpaPath) {
    fs.copyFileSync(srcIpaPath, v157IpaPath);
  }
  fs.copyFileSync(v157IpaPath, rivoIpaPath);

  if (fs.existsSync(pubDir)) {
    fs.copyFileSync(v157IpaPath, path.join(pubDir, 'Rivo-v1.5.7.ipa'));
    fs.copyFileSync(v157IpaPath, path.join(pubDir, 'Rivo.ipa'));
  }

  console.log(`IPA files ready:\n- ${v157IpaPath}\n- ${rivoIpaPath}`);

  // Now ensure it is uploaded to release v1.5.7
  console.log('\nChecking GitHub Release v1.5.7...');
  const relRes = await fetch(`https://api.github.com/repos/${repo}/releases/tags/${tag}`, { headers });
  if (relRes.ok) {
    const release = await relRes.json();
    const existingIpa = (release.assets || []).find(a => a.name === 'Rivo-v1.5.7.ipa');
    if (existingIpa) {
      console.log(`Rivo-v1.5.7.ipa is already attached to release v1.5.7 (ID: ${existingIpa.id})`);
    } else {
      console.log('Uploading Rivo-v1.5.7.ipa to release...');
      const ipaBytes = fs.readFileSync(v157IpaPath);
      const uploadUrl = `https://uploads.github.com/repos/${repo}/releases/${release.id}/assets?name=Rivo-v1.5.7.ipa`;
      const upRes = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/octet-stream',
          'Content-Length': String(ipaBytes.length)
        },
        body: ipaBytes
      });
      if (upRes.ok) {
        console.log('Successfully uploaded Rivo-v1.5.7.ipa to release!');
      } else {
        console.error('Failed to upload IPA:', await upRes.text());
      }
    }
  }

  console.log('\n=== All iOS build & release steps finished successfully! ===');
}

monitor().catch(err => {
  console.error('Monitor error:', err);
  process.exit(1);
});
