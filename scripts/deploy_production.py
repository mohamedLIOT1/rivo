import subprocess
import os
import sys

KEY = r"C:\Users\mohamed\Downloads\my-bot-key.pem"
HOST = "ubuntu@rivo-m.duckdns.org"
REMOTE_DIR = "/home/ubuntu/rivo"
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def run_ssh(cmd):
    full_cmd = ["ssh", "-i", KEY, "-o", "StrictHostKeyChecking=no", "-o", "BatchMode=yes", HOST, cmd]
    print(f"[SSH] {cmd}", flush=True)
    res = subprocess.run(full_cmd, capture_output=True, text=True, encoding='utf-8', errors='replace')
    if res.returncode != 0:
        print(f"Error: {res.stderr}", flush=True)
    else:
        print(f"Output: {(res.stdout or '').strip()}", flush=True)
    return res

def upload_file(local_path, remote_path):
    cmd = ["scp", "-i", KEY, "-o", "StrictHostKeyChecking=no", "-o", "BatchMode=yes", local_path, f"{HOST}:{remote_path}"]
    print(f"[SCP] {os.path.basename(local_path)} -> {remote_path}", flush=True)
    res = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace')
    if res.returncode != 0:
        print(f"SCP Error: {res.stderr}", flush=True)
        return False
    return True

def main():
    print("=== Deploying v1.7.9 to Production Server ===")
    
    # 1. Upload server files
    server_files = [
        ("server/routes/tracks.js", f"{REMOTE_DIR}/server/routes/tracks.js"),
        ("server/routes/albums.js", f"{REMOTE_DIR}/server/routes/albums.js"),
        ("server/routes/artists.js", f"{REMOTE_DIR}/server/routes/artists.js"),
        ("server/routes/playlists.js", f"{REMOTE_DIR}/server/routes/playlists.js"),
        ("server/routes/ai.js", f"{REMOTE_DIR}/server/routes/ai.js"),
        ("server/index.js", f"{REMOTE_DIR}/server/index.js"),
    ]
    for local_rel, remote in server_files:
        local = os.path.join(BASE_DIR, local_rel)
        if not upload_file(local, remote):
            sys.exit(1)

    # 2. Upload APK & IPA downloads
    download_files = [
        ("public/downloads/Rivo-v1.7.9.apk", f"{REMOTE_DIR}/public/downloads/Rivo-v1.7.9.apk"),
        ("public/downloads/Rivo-v1.7.9.ipa", f"{REMOTE_DIR}/public/downloads/Rivo-v1.7.9.ipa"),
        ("public/downloads/Rivo.apk", f"{REMOTE_DIR}/public/downloads/Rivo.apk"),
        ("public/downloads/Rivo.ipa", f"{REMOTE_DIR}/public/downloads/Rivo.ipa"),
        ("public/downloads/Rivo-v1.7.8.apk", f"{REMOTE_DIR}/public/downloads/Rivo-v1.7.8.apk"),
        ("public/downloads/Rivo-v1.7.8.ipa", f"{REMOTE_DIR}/public/downloads/Rivo-v1.7.8.ipa"),
    ]
    for local_rel, remote in download_files:
        local = os.path.join(BASE_DIR, local_rel)
        if os.path.exists(local):
            upload_file(local, remote)

    # 3. Create dist archive and upload (excluding heavy downloads directory)
    dist_dir = os.path.join(BASE_DIR, 'dist')
    tar_path = os.path.join(BASE_DIR, 'dist_v179.tar.gz')
    print("Archiving web dist (excluding downloads)...", flush=True)
    import tarfile

    def filter_downloads(tarinfo):
        if 'downloads' in tarinfo.name:
            return None
        return tarinfo

    with tarfile.open(tar_path, "w:gz") as tar:
        tar.add(dist_dir, arcname="dist", filter=filter_downloads)

    print(f"Uploading dist archive ({os.path.getsize(tar_path)} bytes)...")
    upload_file(tar_path, f"{REMOTE_DIR}/dist_v179.tar.gz")
    run_ssh(f"cd {REMOTE_DIR} && tar -xzf dist_v179.tar.gz && rm dist_v179.tar.gz")
    if os.path.exists(tar_path):
        os.remove(tar_path)

    # 4. Restart PM2
    print("Restarting PM2 backend...")
    run_ssh("pm2 restart rivo")
    print("=== Deployment Complete! ===")

if __name__ == '__main__':
    main()
