import subprocess
import os
import sys

KEY = os.path.expanduser(r"~/.ssh/id_ed25519")
if not os.path.exists(KEY):
    alt = os.path.expanduser(r"~/Desktop/LightsailDefaultKey-eu-north-1.pem")
    if os.path.exists(alt):
        KEY = alt
    else:
        KEY = None

HOST = "ubuntu@172.31.5.43"
JUMP_HOST = "ubuntu@13.53.117.74"

def run_ssh(cmd):
    full_cmd = ["ssh", "-o", "StrictHostKeyChecking=no", "-o", "BatchMode=yes"]
    if KEY:
        full_cmd.extend(["-i", KEY])
    if JUMP_HOST:
        full_cmd.extend(["-J", JUMP_HOST])
    full_cmd.extend([HOST, cmd])
    print(f"[SSH] {cmd}", flush=True)
    res = subprocess.run(full_cmd, capture_output=True, text=True, encoding='utf-8', errors='replace')
    print(f"Output: {res.stdout.strip()}")
    if res.returncode != 0:
        print(f"Error: {res.stderr.strip()}")
    return res

def upload(local_file, remote_file):
    cmd = ["scp", "-o", "StrictHostKeyChecking=no", "-o", "BatchMode=yes"]
    if KEY:
        cmd.extend(["-i", KEY])
    if JUMP_HOST:
        cmd.extend(["-J", JUMP_HOST])
    cmd.extend([local_file, f"{HOST}:{remote_file}"])
    print(f"[SCP] Uploading {local_file} -> {remote_file}...", flush=True)
    res = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace')
    if res.returncode != 0:
        print(f"SCP Error: {res.stderr.strip()}")
        return False
    print("SCP Success!")
    return True

local_exe = os.path.abspath(r"c:\Users\mohamed\Downloads\rivo-main\rivo-main\desktop-app\publish\Rivo.exe")
print(f"Local file size: {os.path.getsize(local_exe):,} bytes")

# Upload as Rivo_v2.4.1.exe on remote
if upload(local_exe, "/home/ubuntu/rivo/public/downloads/Rivo.exe"):
    run_ssh("cp -f /home/ubuntu/rivo/public/downloads/Rivo.exe /home/ubuntu/rivo/public/downloads/Rivo-v2.4.1.exe && "
            "sudo cp -f /home/ubuntu/rivo/public/downloads/Rivo.exe /var/www/html/downloads/Rivo.exe && "
            "sudo cp -f /home/ubuntu/rivo/public/downloads/Rivo.exe /var/www/html/downloads/Rivo-v2.4.1.exe && "
            "ls -la /home/ubuntu/rivo/public/downloads/Rivo*")
