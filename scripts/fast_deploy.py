import subprocess
import os
import sys
import tarfile
import json

sys.stdout.reconfigure(encoding='utf-8')

KEY = os.path.expanduser(r"~/.ssh/id_ed25519")
if not os.path.exists(KEY):
    alt_key = os.path.expanduser(r"~/Desktop/LightsailDefaultKey-eu-north-1.pem")
    if os.path.exists(alt_key):
        KEY = alt_key

HOST = "ubuntu@rivo-m.duckdns.org"
REMOTE_DIR = "/home/ubuntu/rivo"
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def run_ssh(cmd):
    full_cmd = ["ssh", "-i", KEY, "-o", "StrictHostKeyChecking=no", "-o", "BatchMode=yes", HOST, cmd]
    print(f"[SSH] {cmd}", flush=True)
    res = subprocess.run(full_cmd, capture_output=True, text=True, encoding='utf-8', errors='replace', stdin=subprocess.DEVNULL)
    if res.returncode != 0:
        print(f"Error: {res.stderr}", flush=True)
    else:
        print(f"Output: {(res.stdout or '').strip()}", flush=True)
    return res

def upload_file(local_path, remote_path):
    cmd = ["scp", "-i", KEY, "-o", "StrictHostKeyChecking=no", "-o", "BatchMode=yes", local_path, f"{HOST}:{remote_path}"]
    print(f"[SCP] {os.path.basename(local_path)} -> {remote_path}", flush=True)
    res = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace', stdin=subprocess.DEVNULL)
    if res.returncode != 0:
        print(f"SCP Error: {res.stderr}", flush=True)
        return False
    return True

def main():
    pkg_path = os.path.join(BASE_DIR, 'package.json')
    with open(pkg_path, 'r', encoding='utf-8') as f:
        version = json.load(f).get('version', '2.1.9')

    print(f"=== Fast Deploying v{version} to Production Server ===")

    # 0. Build fresh web bundle with Vite
    print("Building fresh web bundle with Vite...", flush=True)
    subprocess.run("node ./node_modules/vite/bin/vite.js build", shell=True, cwd=BASE_DIR, check=True)

    # 1. Package dist/ into a small tar.gz (excluding downloads)
    dist_tar = os.path.join(BASE_DIR, 'dist.tar.gz')
    dist_dir = os.path.join(BASE_DIR, 'dist')
    print("Compressing dist/...")
    with tarfile.open(dist_tar, "w:gz") as tar:
        for root, dirs, files in os.walk(dist_dir):
            if 'downloads' in root:
                continue
            for file in files:
                p = os.path.join(root, file)
                rel = os.path.relpath(p, dist_dir)
                tar.add(p, arcname=rel)

    # Pre-create remote directories
    run_ssh(f"mkdir -p {REMOTE_DIR}/server/routes {REMOTE_DIR}/server/utils {REMOTE_DIR}/uploads/stems")

    # 2. Upload small server & config files
    upload_file(dist_tar, f"{REMOTE_DIR}/dist.tar.gz")
    upload_file(os.path.join(BASE_DIR, 'server/routes/tracks.js'), f"{REMOTE_DIR}/server/routes/tracks.js")
    upload_file(os.path.join(BASE_DIR, 'server/routes/recognize.js'), f"{REMOTE_DIR}/server/routes/recognize.js")
    upload_file(os.path.join(BASE_DIR, 'server/package.json'), f"{REMOTE_DIR}/server/package.json")
    upload_file(os.path.join(BASE_DIR, 'server/utils/vocalSeparator.js'), f"{REMOTE_DIR}/server/utils/vocalSeparator.js")
    upload_file(os.path.join(BASE_DIR, 'server/utils/cloud_separator.py'), f"{REMOTE_DIR}/server/utils/cloud_separator.py")
    upload_file(os.path.join(BASE_DIR, 'server/utils/helpers.js'), f"{REMOTE_DIR}/server/utils/helpers.js")
    upload_file(os.path.join(BASE_DIR, 'package.json'), f"{REMOTE_DIR}/package.json")
    upload_file(os.path.join(BASE_DIR, 'server/index.js'), f"{REMOTE_DIR}/server/index.js")
    upload_file(os.path.join(BASE_DIR, 'server/ota-manifest.json'), f"{REMOTE_DIR}/server/ota-manifest.json")
    upload_file(os.path.join(BASE_DIR, 'public/downloads/windows-update.json'), f"{REMOTE_DIR}/public/downloads/windows-update.json")
    upload_file(os.path.join(BASE_DIR, 'public/downloads/ota/index.android.bundle'), f"{REMOTE_DIR}/public/downloads/ota/index.android.bundle")

    # 3. Remote commands: unpack dist, sync binaries, restart PM2
    remote_script = f"""
set -e
mkdir -p {REMOTE_DIR}/dist {REMOTE_DIR}/public/downloads/ota
tar -xzf {REMOTE_DIR}/dist.tar.gz -C {REMOTE_DIR}/dist/
rm -f {REMOTE_DIR}/dist.tar.gz

cd {REMOTE_DIR}/public/downloads
# If release binaries are not yet present, attempt safe download from GitHub release without corrupting existing files
if [ ! -f Rivo-v{version}.apk ]; then
    curl -sLf -o Rivo-v{version}.apk "https://github.com/mohamedLIOT1/rivo/releases/download/v{version}/Rivo-v{version}.apk" || true
fi
if [ -f Rivo-v{version}.apk ] && [ -s Rivo-v{version}.apk ]; then
    cp -f Rivo-v{version}.apk Rivo.apk
fi

if [ ! -f Rivo-v{version}.ipa ]; then
    curl -sLf -o Rivo-v{version}.ipa "https://github.com/mohamedLIOT1/rivo/releases/download/v{version}/Rivo-v{version}.ipa" || true
fi
if [ -f Rivo-v{version}.ipa ] && [ -s Rivo-v{version}.ipa ]; then
    cp -f Rivo-v{version}.ipa Rivo.ipa
fi

if [ ! -f Rivo-v{version}.exe ]; then
    curl -sLf -o Rivo-v{version}.exe "https://github.com/mohamedLIOT1/rivo/releases/download/v{version}/Rivo-v{version}.exe" || true
fi
if [ -f Rivo-v{version}.exe ] && [ -s Rivo-v{version}.exe ]; then
    cp -f Rivo-v{version}.exe Rivo.exe
fi

# Sync to dist/downloads
mkdir -p {REMOTE_DIR}/dist/downloads/ota
[ -f Rivo-v{version}.apk ] && cp -f Rivo-v{version}.apk {REMOTE_DIR}/dist/downloads/ || true
[ -f Rivo.apk ] && cp -f Rivo.apk {REMOTE_DIR}/dist/downloads/ || true
[ -f Rivo-v{version}.ipa ] && cp -f Rivo-v{version}.ipa {REMOTE_DIR}/dist/downloads/ || true
[ -f Rivo.ipa ] && cp -f Rivo.ipa {REMOTE_DIR}/dist/downloads/ || true
[ -f Rivo-v{version}.exe ] && cp -f Rivo-v{version}.exe {REMOTE_DIR}/dist/downloads/ || true
[ -f Rivo.exe ] && cp -f Rivo.exe {REMOTE_DIR}/dist/downloads/ || true
[ -f windows-update.json ] && cp -f windows-update.json {REMOTE_DIR}/dist/downloads/ || true
[ -f ota/index.android.bundle ] && cp -f ota/index.android.bundle {REMOTE_DIR}/dist/downloads/ota/ || true

# Also sync to /var/www/html if it exists
sudo cp -rf {REMOTE_DIR}/dist/* /var/www/html/ 2>/dev/null || true

# Restart PM2
pm2 restart rivo
pm2 status rivo
"""
    res = run_ssh(remote_script)
    if res.returncode == 0:
        print("\n✅ PRODUCTION FAST DEPLOY COMPLETE!")
    else:
        print("\n❌ DEPLOY ENCOUNTERED AN ISSUE")

if __name__ == '__main__':
    main()
