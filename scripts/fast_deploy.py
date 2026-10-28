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

    # 1. Package dist/ into a small tar.gz
    dist_tar = os.path.join(BASE_DIR, 'dist.tar.gz')
    dist_dir = os.path.join(BASE_DIR, 'dist')
    print("Compressing dist/...")
    with tarfile.open(dist_tar, "w:gz") as tar:
        for root, dirs, files in os.walk(dist_dir):
            for file in files:
                p = os.path.join(root, file)
                rel = os.path.relpath(p, dist_dir)
                tar.add(p, arcname=rel)

    # 2. Upload small server & config files
    upload_file(dist_tar, f"{REMOTE_DIR}/dist.tar.gz")
    upload_file(os.path.join(BASE_DIR, 'package.json'), f"{REMOTE_DIR}/package.json")
    upload_file(os.path.join(BASE_DIR, 'server/index.js'), f"{REMOTE_DIR}/server/index.js")
    upload_file(os.path.join(BASE_DIR, 'server/ota-manifest.json'), f"{REMOTE_DIR}/server/ota-manifest.json")
    upload_file(os.path.join(BASE_DIR, 'public/downloads/windows-update.json'), f"{REMOTE_DIR}/public/downloads/windows-update.json")
    upload_file(os.path.join(BASE_DIR, 'public/downloads/ota/index.android.bundle'), f"{REMOTE_DIR}/public/downloads/ota/index.android.bundle")

    # 3. Remote commands: unpack dist, fast curl binaries from github, update symlinks, restart PM2
    remote_script = f"""
set -e
mkdir -p {REMOTE_DIR}/dist {REMOTE_DIR}/public/downloads/ota
tar -xzf {REMOTE_DIR}/dist.tar.gz -C {REMOTE_DIR}/dist/
rm -f {REMOTE_DIR}/dist.tar.gz

echo "Curling release binaries from GitHub Release v{version}..."
cd {REMOTE_DIR}/public/downloads
curl -sL -o Rivo-v{version}.apk "https://github.com/mohamedLIOT1/rivo/releases/download/v{version}/Rivo-v{version}.apk"
cp -f Rivo-v{version}.apk Rivo.apk

curl -sL -o Rivo-v{version}.ipa "https://github.com/mohamedLIOT1/rivo/releases/download/v{version}/Rivo-v{version}.ipa"
cp -f Rivo-v{version}.ipa Rivo.ipa

curl -sL -o Rivo-v{version}.exe "https://github.com/mohamedLIOT1/rivo/releases/download/v{version}/Rivo-v{version}.exe"
cp -f Rivo-v{version}.exe Rivo.exe

# Sync to dist/downloads
mkdir -p {REMOTE_DIR}/dist/downloads/ota
cp -f Rivo-v{version}.apk {REMOTE_DIR}/dist/downloads/
cp -f Rivo.apk {REMOTE_DIR}/dist/downloads/
cp -f Rivo-v{version}.ipa {REMOTE_DIR}/dist/downloads/
cp -f Rivo.ipa {REMOTE_DIR}/dist/downloads/
cp -f Rivo-v{version}.exe {REMOTE_DIR}/dist/downloads/
cp -f Rivo.exe {REMOTE_DIR}/dist/downloads/
cp -f windows-update.json {REMOTE_DIR}/dist/downloads/
cp -f ota/index.android.bundle {REMOTE_DIR}/dist/downloads/ota/

# Restart PM2
pm2 restart rivo
pm2 status rivo
ls -lh {REMOTE_DIR}/public/downloads/Rivo*
"""
    res = run_ssh(remote_script)
    if res.returncode == 0:
        print("\n✅ PRODUCTION FAST DEPLOY COMPLETE!")
    else:
        print("\n❌ DEPLOY ENCOUNTERED AN ISSUE")

if __name__ == '__main__':
    main()
