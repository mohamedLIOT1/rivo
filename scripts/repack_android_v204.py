import zipfile
import shutil
import subprocess
import os
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def find_build_tool(tool_name):
    candidates = [
        os.path.join(os.environ.get('LOCALAPPDATA', ''), 'Android', 'Sdk', 'build-tools', '36.0.0', tool_name),
        os.path.join(os.environ.get('LOCALAPPDATA', ''), 'Android', 'Sdk', 'build-tools', '35.0.0', tool_name),
        os.path.join(os.environ.get('LOCALAPPDATA', ''), 'Android', 'Sdk', 'build-tools', '34.0.0', tool_name),
        os.path.join(r"C:\Users\mohamed\AppData\Local\Android\Sdk\build-tools\36.0.0", tool_name),
        os.path.join(r"C:\Users\mohamed\AppData\Local\Android\Sdk\build-tools\34.0.0", tool_name),
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    return tool_name

ZIPALIGN = find_build_tool('zipalign.exe')
APKSIGNER = find_build_tool('apksigner.bat')
KEYSTORE = os.path.join(BASE_DIR, 'android', 'app', 'debug.keystore')

def repack_android():
    bundle_file = os.path.join(BASE_DIR, 'public', 'downloads', 'ota', 'index.android.bundle')
    if not os.path.exists(bundle_file):
        print(f"Error: Bundle file not found: {bundle_file}")
        sys.exit(1)

    with open(bundle_file, 'rb') as f:
        bundle_bytes = f.read()

    base_apk = os.path.join(BASE_DIR, 'public', 'downloads', 'Rivo.apk')
    if not os.path.exists(base_apk):
        print(f"Error: Base APK not found: {base_apk}")
        sys.exit(1)

    out_apk = os.path.join(BASE_DIR, 'public', 'downloads', 'Rivo-v2.0.4.apk')
    generic_apk = os.path.join(BASE_DIR, 'public', 'downloads', 'Rivo.apk')
    dist_dir = os.path.join(BASE_DIR, 'dist', 'downloads')
    os.makedirs(dist_dir, exist_ok=True)
    dist_out_apk = os.path.join(dist_dir, 'Rivo-v2.0.4.apk')
    dist_generic_apk = os.path.join(dist_dir, 'Rivo.apk')

    temp_apk = out_apk + '.unsigned.apk'
    print(f"1. Injecting updated bundle into clean APK base ({os.path.basename(base_apk)})...")
    with zipfile.ZipFile(base_apk, 'r') as zin:
        with zipfile.ZipFile(temp_apk, 'w', compression=zipfile.ZIP_DEFLATED) as zout:
            for item in zin.infolist():
                if item.filename.startswith('META-INF/'):
                    continue  # Strip old signatures before re-signing
                elif item.filename == 'assets/index.android.bundle':
                    zout.writestr(item, bundle_bytes)
                else:
                    zout.writestr(item, zin.read(item.filename))

    aligned_apk = out_apk + '.aligned.apk'
    print("2. Running zipalign (4-byte alignment & 4K page-alignment)...")
    if os.path.exists(aligned_apk):
        os.remove(aligned_apk)
    zipalign_cmd = [ZIPALIGN, '-f', '-p', '4', temp_apk, aligned_apk]
    zipalign_res = subprocess.run(zipalign_cmd, capture_output=True, text=True)
    if zipalign_res.returncode != 0:
        print(f"zipalign failed: {zipalign_res.stderr}")
        return False
    if os.path.exists(temp_apk):
        os.remove(temp_apk)

    print("3. Re-signing APK with apksigner (v1, v2 & v3 schemes)...")
    if os.path.exists(out_apk):
        os.remove(out_apk)
    shutil.copyfile(aligned_apk, out_apk)
    os.remove(aligned_apk)

    sign_cmd = [
        APKSIGNER, 'sign',
        '--ks', KEYSTORE,
        '--ks-pass', 'pass:android',
        '--ks-key-alias', 'androiddebugkey',
        '--key-pass', 'pass:android',
        out_apk
    ]
    sign_res = subprocess.run(sign_cmd, capture_output=True, text=True)
    if sign_res.returncode != 0:
        print(f"Signing failed: {sign_res.stderr}")
        return False

    verify_cmd = [APKSIGNER, 'verify', '-v', out_apk]
    verify_res = subprocess.run(verify_cmd, capture_output=True, text=True)
    if 'Verifies' not in verify_res.stdout:
        print(f"Verification failed: {verify_res.stderr} / {verify_res.stdout}")
        return False

    shutil.copyfile(out_apk, generic_apk)
    shutil.copyfile(out_apk, dist_out_apk)
    shutil.copyfile(out_apk, dist_generic_apk)
    size_mb = os.path.getsize(out_apk) / (1024 * 1024)
    print(f"\nSUCCESS: Android APK ready ({size_mb:.2f} MB)")
    print(f"Generated: {out_apk}")
    print(f"Copied to: {generic_apk}")
    print(f"Copied to: {dist_out_apk}")
    print(f"Copied to: {dist_generic_apk}")
    return True

if __name__ == '__main__':
    repack_android()
