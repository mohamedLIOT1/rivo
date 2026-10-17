import subprocess
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

KEY = r"C:\Users\mohamed\Downloads\my-bot-key.pem"
HOST = "ubuntu@rivo-m.duckdns.org"

def main():
    scp_cmd = ["scp", "-i", KEY, "-o", "StrictHostKeyChecking=no", "-o", "BatchMode=yes", "scripts/check_db.js", f"{HOST}:/home/ubuntu/rivo/check_db.js"]
    res = subprocess.run(scp_cmd, capture_output=True, text=True, encoding='utf-8')
    if res.returncode != 0:
        print("SCP failed:", res.stderr)
        return
    ssh_cmd = ["ssh", "-i", KEY, "-o", "StrictHostKeyChecking=no", "-o", "BatchMode=yes", HOST, "cd /home/ubuntu/rivo && node check_db.js"]
    res = subprocess.run(ssh_cmd, capture_output=True, text=True, encoding='utf-8')
    print("OUTPUT:\n", res.stdout)
    if res.stderr:
        print("STDERR:\n", res.stderr)

if __name__ == '__main__':
    main()
