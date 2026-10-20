import subprocess
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

KEY = r"C:\Users\mohamed\Downloads\my-bot-key.pem"
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

import json
import re

def get_current_version():
    pkg_path = os.path.join(BASE_DIR, 'package.json')
    with open(pkg_path, 'r', encoding='utf-8') as f:
        pkg = json.load(f)
        return pkg.get('version', '1.9.3')

def main():
    version = get_current_version()
    print(f"=== Deploying v{version} to Production Server ===")
    
    # 1. Upload server files
    server_files = [
        ("server/models/User.js", f"{REMOTE_DIR}/server/models/User.js"),
        ("server/routes/tracks.js", f"{REMOTE_DIR}/server/routes/tracks.js"),
        ("server/routes/albums.js", f"{REMOTE_DIR}/server/routes/albums.js"),
        ("server/routes/artists.js", f"{REMOTE_DIR}/server/routes/artists.js"),
        ("server/routes/playlists.js", f"{REMOTE_DIR}/server/routes/playlists.js"),
        ("server/routes/chat.js", f"{REMOTE_DIR}/server/routes/chat.js"),
        ("server/routes/ai.js", f"{REMOTE_DIR}/server/routes/ai.js"),
        ("server/utils/helpers.js", f"{REMOTE_DIR}/server/utils/helpers.js"),
        ("server/sockets/index.js", f"{REMOTE_DIR}/server/sockets/index.js"),
        ("server/discordActivity.js", f"{REMOTE_DIR}/server/discordActivity.js"),
        ("server/index.js", f"{REMOTE_DIR}/server/index.js"),
    ]
    for local_rel, remote in server_files:
        local = os.path.join(BASE_DIR, local_rel)
        if not upload_file(local, remote):
            sys.exit(1)

    # 2. Upload APK, IPA & EXE downloads and bot assets
    download_files = [
        (f"public/downloads/Rivo-v{version}.apk", f"{REMOTE_DIR}/public/downloads/Rivo-v{version}.apk"),
        (f"public/downloads/Rivo-v{version}.ipa", f"{REMOTE_DIR}/public/downloads/Rivo-v{version}.ipa"),
        (f"public/downloads/Rivo-v{version}.exe", f"{REMOTE_DIR}/public/downloads/Rivo-v{version}.exe"),
        ("public/downloads/Rivo.apk", f"{REMOTE_DIR}/public/downloads/Rivo.apk"),
        ("public/downloads/Rivo.ipa", f"{REMOTE_DIR}/public/downloads/Rivo.ipa"),
        ("public/downloads/Rivo.exe", f"{REMOTE_DIR}/public/downloads/Rivo.exe"),
        ("public/assets/rivo-bot.png", f"{REMOTE_DIR}/public/assets/rivo-bot.png"),
        ("public/rivo-bot.png", f"{REMOTE_DIR}/public/rivo-bot.png"),
    ]
    for local_rel, remote in download_files:
        local = os.path.join(BASE_DIR, local_rel)
        if os.path.exists(local):
            upload_file(local, remote)

    print("Replicating binary releases on remote server...")
    run_ssh(
        f"cp -f {REMOTE_DIR}/public/downloads/Rivo-v{version}.apk {REMOTE_DIR}/public/downloads/Rivo.apk 2>/dev/null || true && "
        f"cp -f {REMOTE_DIR}/public/downloads/Rivo-v{version}.ipa {REMOTE_DIR}/public/downloads/Rivo.ipa 2>/dev/null || true && "
        f"cp -f {REMOTE_DIR}/public/downloads/Rivo-v{version}.exe {REMOTE_DIR}/public/downloads/Rivo.exe 2>/dev/null || true && "
        f"mkdir -p {REMOTE_DIR}/dist/downloads && "
        f"cp -f {REMOTE_DIR}/public/downloads/Rivo-v{version}.apk {REMOTE_DIR}/dist/downloads/ 2>/dev/null || true && "
        f"cp -f {REMOTE_DIR}/public/downloads/Rivo-v{version}.ipa {REMOTE_DIR}/dist/downloads/ 2>/dev/null || true && "
        f"cp -f {REMOTE_DIR}/public/downloads/Rivo-v{version}.exe {REMOTE_DIR}/dist/downloads/ 2>/dev/null || true && "
        f"cp -f {REMOTE_DIR}/public/downloads/Rivo.apk {REMOTE_DIR}/dist/downloads/Rivo.apk 2>/dev/null || true && "
        f"cp -f {REMOTE_DIR}/public/downloads/Rivo.ipa {REMOTE_DIR}/dist/downloads/Rivo.ipa 2>/dev/null || true && "
        f"cp -f {REMOTE_DIR}/public/downloads/Rivo.exe {REMOTE_DIR}/dist/downloads/Rivo.exe 2>/dev/null || true"
    )

    # 3. Create dist archive and upload (excluding heavy downloads directory)
    dist_dir = os.path.join(BASE_DIR, 'dist')
    tar_path = os.path.join(BASE_DIR, f'dist_v{version.replace(".", "")}.tar.gz')
    print("Archiving web dist (excluding downloads)...", flush=True)
    import tarfile

    def filter_downloads(tarinfo):
        if 'downloads' in tarinfo.name:
            return None
        return tarinfo

    with tarfile.open(tar_path, "w:gz") as tar:
        tar.add(dist_dir, arcname="dist", filter=filter_downloads)

    tar_filename = os.path.basename(tar_path)
    print(f"Uploading dist archive ({os.path.getsize(tar_path)} bytes)...")
    upload_file(tar_path, f"{REMOTE_DIR}/{tar_filename}")
    run_ssh(f"cd {REMOTE_DIR} && tar -xzf {tar_filename} && rm {tar_filename}")
    if os.path.exists(tar_path):
        os.remove(tar_path)

    # 4. Restart PM2 & Broadcast update
    print("Restarting PM2 backend...")
    run_ssh("pm2 restart rivo")
    print("Broadcasting update...")
    run_ssh("curl -s http://localhost:5000/api/app/broadcast-update || true")
    print("=== Deployment Complete! ===")

if __name__ == '__main__':
    main()
