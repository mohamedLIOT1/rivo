import subprocess
import os
import sys
import tarfile
import json
import argparse

sys.stdout.reconfigure(encoding='utf-8')

KEY = os.path.expanduser(r"~/.ssh/id_ed25519")
if not os.path.exists(KEY):
    alt_key = os.path.expanduser(r"~/Desktop/LightsailDefaultKey-eu-north-1.pem")
    if os.path.exists(alt_key):
        KEY = alt_key
    else:
        KEY = None

HOST = "ubuntu@172.31.5.43"
JUMP_HOST = "ubuntu@13.53.117.74"
REMOTE_DIR = "/home/ubuntu/rivo"
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def run_ssh(cmd):
    full_cmd = ["ssh", "-o", "StrictHostKeyChecking=no", "-o", "BatchMode=yes"]
    if KEY:
        full_cmd.extend(["-i", KEY])
    if JUMP_HOST:
        full_cmd.extend(["-J", JUMP_HOST])
    full_cmd.extend([HOST, cmd])
    print(f"[SSH] {cmd}", flush=True)
    res = subprocess.run(full_cmd, capture_output=True, text=True, encoding='utf-8', errors='replace', stdin=subprocess.DEVNULL)
    if res.returncode != 0:
        print(f"Error: {res.stderr.strip()}", flush=True)
    else:
        out = (res.stdout or '').strip()
        if out:
            print(f"Output:\n{out}", flush=True)
    return res

def upload_file(local_path, remote_path):
    cmd = ["scp", "-o", "StrictHostKeyChecking=no", "-o", "BatchMode=yes"]
    if KEY:
        cmd.extend(["-i", KEY])
    if JUMP_HOST:
        cmd.extend(["-J", JUMP_HOST])
    cmd.extend([local_path, f"{HOST}:{remote_path}"])
    print(f"[SCP] {os.path.basename(local_path)} -> {remote_path}", flush=True)
    res = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace', stdin=subprocess.DEVNULL)
    if res.returncode != 0:
        print(f"SCP Error: {res.stderr.strip()}", flush=True)
        return False
    return True

def get_current_version():
    pkg_path = os.path.join(BASE_DIR, 'package.json')
    try:
        with open(pkg_path, 'r', encoding='utf-8') as f:
            return json.load(f).get('version', '2.3.5')
    except Exception:
        return '2.3.5'

def sync_server():
    print("\n📦 [1/4] Packaging and syncing server/ code...", flush=True)
    server_dir = os.path.join(BASE_DIR, 'server')
    tar_path = os.path.join(BASE_DIR, 'server_sync.tar.gz')

    def filter_server(tarinfo):
        parts = tarinfo.name.replace('\\', '/').split('/')
        if any(ignored in parts for ignored in ['node_modules', '.cache', '__pycache__', 'uploads']):
            return None
        if tarinfo.name.endswith(('.mp3', '.m4a', '.wav', '.log', '.tmp')):
            return None
        return tarinfo

    with tarfile.open(tar_path, "w:gz") as tar:
        tar.add(server_dir, arcname="server", filter=filter_server)
        pkg_local = os.path.join(BASE_DIR, 'package.json')
        if os.path.exists(pkg_local):
            tar.add(pkg_local, arcname="package.json")

    tar_size = os.path.getsize(tar_path)
    print(f"Server archive created: {tar_size:,} bytes")
    uploaded = upload_file(tar_path, f"{REMOTE_DIR}/server_sync.tar.gz")
    if os.path.exists(tar_path):
        os.remove(tar_path)

    if not uploaded:
        print("❌ Failed to upload server archive!")
        sys.exit(1)

    extract_cmd = (
        f"mkdir -p {REMOTE_DIR}/server && "
        f"tar -xzf {REMOTE_DIR}/server_sync.tar.gz -C {REMOTE_DIR}/ && "
        f"rm -f {REMOTE_DIR}/server_sync.tar.gz"
    )
    res = run_ssh(extract_cmd)
    if res.returncode != 0:
        print("❌ Failed to extract server files on remote!")
        sys.exit(1)
    print("✅ Server code synchronized successfully.")

def build_and_sync_frontend(skip_build=False):
    print("\n🎨 [2/4] Building and syncing frontend dist...", flush=True)
    if not skip_build:
        print("Executing Vite build...")
        build_bin = "npm.cmd" if os.name == 'nt' else "npm"
        b_res = subprocess.run([build_bin, "run", "build"], cwd=BASE_DIR, shell=True)
        if b_res.returncode != 0:
            print("Trying direct vite executable...")
            vite_path = os.path.join(BASE_DIR, "node_modules", "vite", "bin", "vite.js")
            b_res = subprocess.run(["node", vite_path, "build"], cwd=BASE_DIR)
        if b_res.returncode != 0:
            print("❌ Frontend build failed! Aborting deployment.")
            sys.exit(1)
        print("✅ Frontend build completed successfully.")

    dist_dir = os.path.join(BASE_DIR, 'dist')
    if not os.path.isdir(dist_dir):
        print("❌ Dist directory does not exist! Aborting.")
        sys.exit(1)

    tar_path = os.path.join(BASE_DIR, 'dist_sync.tar.gz')
    print("Archiving dist/ (excluding heavy downloads)...")

    with tarfile.open(tar_path, "w:gz") as tar:
        for root, dirs, files in os.walk(dist_dir):
            if 'downloads' in root.replace('\\', '/'):
                continue
            for f in files:
                full_path = os.path.join(root, f)
                rel_path = os.path.relpath(full_path, dist_dir)
                tar.add(full_path, arcname=rel_path)

    tar_size = os.path.getsize(tar_path)
    print(f"Dist archive created: {tar_size:,} bytes")
    uploaded = upload_file(tar_path, f"{REMOTE_DIR}/dist_sync.tar.gz")
    if os.path.exists(tar_path):
        os.remove(tar_path)

    if not uploaded:
        print("❌ Failed to upload dist archive!")
        sys.exit(1)

    unpack_cmd = (
        f"mkdir -p {REMOTE_DIR}/dist /home/ubuntu/dist && "
        f"tar -xzf {REMOTE_DIR}/dist_sync.tar.gz -C {REMOTE_DIR}/dist/ && "
        f"rm -f {REMOTE_DIR}/dist_sync.tar.gz && "
        f"cp -rf {REMOTE_DIR}/dist/* /home/ubuntu/dist/ 2>/dev/null || true && "
        f"sudo cp -rf {REMOTE_DIR}/dist/* /var/www/html/ 2>/dev/null || true"
    )
    res = run_ssh(unpack_cmd)
    if res.returncode != 0:
        print("❌ Failed to unpack dist files on remote!")
        sys.exit(1)
    print("✅ Frontend dist synchronized successfully.")

def sync_assets_and_metadata():
    print("\n📄 [3/4] Syncing OTA bundles, IPAs & metadata...", flush=True)
    meta_files = [
        ("public/downloads/ota/index.android.bundle", f"{REMOTE_DIR}/public/downloads/ota/index.android.bundle"),
        ("server/ota-manifest.json", f"{REMOTE_DIR}/server/ota-manifest.json"),
        ("public/downloads/Rivo.ipa", f"{REMOTE_DIR}/public/downloads/Rivo.ipa"),
        ("public/downloads/Rivo-v2.4.41.ipa", f"{REMOTE_DIR}/public/downloads/Rivo-v2.4.41.ipa"),
        ("public/downloads/Rivo-v2.4.2.ipa", f"{REMOTE_DIR}/public/downloads/Rivo-v2.4.2.ipa"),
        ("public/downloads/Rivo.exe", f"{REMOTE_DIR}/public/downloads/Rivo.exe"),
        ("public/downloads/Rivo-v2.4.2.exe", f"{REMOTE_DIR}/public/downloads/Rivo-v2.4.2.exe"),
        ("public/downloads/Rivo.apk", f"{REMOTE_DIR}/public/downloads/Rivo.apk"),
        ("public/downloads/windows-update.json", f"{REMOTE_DIR}/public/downloads/windows-update.json"),
        ("public/rivo-bot.png", f"{REMOTE_DIR}/public/rivo-bot.png"),
        ("cookies.txt", f"{REMOTE_DIR}/cookies.txt"),
        ("cookies.txt", f"/home/ubuntu/cookies.txt"),
    ]
    for local_rel, remote_path in meta_files:
        p = os.path.join(BASE_DIR, local_rel)
        if os.path.exists(p):
            if p.endswith('.exe'):
                continue
            upload_file(p, remote_path)
    run_ssh(f"sudo cp -rf {REMOTE_DIR}/public/downloads/* /var/www/html/downloads/ 2>/dev/null || true")
    print("✅ Metadata and bundles synchronized.")

def restart_and_verify():
    print("\n⚡ [4/4] Reloading PM2 and verifying status...", flush=True)
    remote_cmd = (
        f"rm -f {REMOTE_DIR}/*.tar.gz /home/ubuntu/*.tar.gz 2>/dev/null || true; "
        f"pm2 reload rivo || pm2 restart rivo; "
        f"sleep 2; "
        f"curl -s http://localhost:5000/api/health 2>/dev/null || true; "
        f"pm2 status"
    )
    run_ssh(remote_cmd)
    print("✅ PM2 reloaded and verified.")

def main():
    parser = argparse.ArgumentParser(description="Deploy Rivo to Production Server")
    parser.add_argument("--server-only", action="store_true", help="Only sync server files and reload PM2")
    parser.add_argument("--dist-only", action="store_true", help="Only build and sync web dist")
    parser.add_argument("--skip-build", action="store_true", help="Skip Vite build (use existing dist)")
    parser.add_argument("--ota-only", action="store_true", help="Only sync OTA bundle and manifest")
    parser.add_argument("--quick", action="store_true", help="Quick sync server + web dist without heavy binaries")
    args = parser.parse_args()

    version = get_current_version()
    print("==================================================")
    print(f"🚀 Deploying Rivo v{version} to Production ({HOST})")
    print("==================================================")

    run_ssh(f"mkdir -p {REMOTE_DIR}/public/downloads/ota {REMOTE_DIR}/server {REMOTE_DIR}/dist /home/ubuntu/dist")

    if args.ota_only:
        print("\n🚀 [OTA] Syncing Android OTA bundle and manifest...", flush=True)
        upload_file(os.path.join(BASE_DIR, "public/downloads/ota/index.android.bundle"), f"{REMOTE_DIR}/public/downloads/ota/index.android.bundle")
        upload_file(os.path.join(BASE_DIR, "server/ota-manifest.json"), f"{REMOTE_DIR}/server/ota-manifest.json")
        restart_and_verify()
    elif args.quick:
        sync_server()
        build_and_sync_frontend(skip_build=args.skip_build)
        restart_and_verify()
    elif args.dist_only:
        build_and_sync_frontend(skip_build=args.skip_build)
    elif args.server_only:
        sync_server()
        sync_assets_and_metadata()
        restart_and_verify()
    else:
        sync_server()
        build_and_sync_frontend(skip_build=args.skip_build)
        sync_assets_and_metadata()
        restart_and_verify()

    print("\n🎉 Deployment completed successfully!")

if __name__ == '__main__':
    main()
