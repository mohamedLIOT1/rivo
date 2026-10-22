import zipfile
import plistlib
import json
import shutil
import subprocess
import os
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HERMESC = os.path.join(BASE_DIR, 'node_modules', 'react-native', 'sdks', 'hermesc', 'win64-bin', 'hermesc.exe')

def build_ios_ipa():
    version = '1.9.8.8'
    build_num = '81'
    
    ios_raw = os.path.join(BASE_DIR, 'ios_main.jsbundle')
    if not os.path.exists(ios_raw):
        print(f"Error: {ios_raw} not found! Please run Metro bundle export first.")
        sys.exit(1)

    hermes_out = os.path.join(BASE_DIR, 'ios_main.hermes.bundle')
    print(f"1. Compiling iOS bundle with Hermes Bytecode v96...")
    cmd = [HERMESC, '-emit-binary', '-out', hermes_out, '-O', ios_raw]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print(f"Hermes compilation failed: {res.stderr}")
        sys.exit(1)

    with open(hermes_out, 'rb') as f:
        hermes_bytes = f.read()
    print(f"   Compiled Hermes bundle: {len(hermes_bytes)} bytes (Magic: {hermes_bytes[:4].hex()})")

    src_ipa = os.path.join(BASE_DIR, 'public', 'downloads', 'Rivo.ipa')
    if not os.path.exists(src_ipa):
        print(f"Error: Base IPA {src_ipa} not found!")
        sys.exit(1)

    out_ipa = os.path.join(BASE_DIR, 'public', 'downloads', f'Rivo-v{version}.ipa')
    generic_ipa = os.path.join(BASE_DIR, 'public', 'downloads', 'Rivo.ipa')
    dist_dir = os.path.join(BASE_DIR, 'dist', 'downloads')
    os.makedirs(dist_dir, exist_ok=True)
    dist_out_ipa = os.path.join(dist_dir, f'Rivo-v{version}.ipa')
    dist_generic_ipa = os.path.join(dist_dir, 'Rivo.ipa')

    temp_ipa = out_ipa + '.tmp'
    print(f"2. Injecting bundle into IPA archive for v{version} (Build {build_num})...")

    with zipfile.ZipFile(src_ipa, 'r') as zin:
        with zipfile.ZipFile(temp_ipa, 'w', compression=zipfile.ZIP_DEFLATED) as zout:
            for item in zin.infolist():
                filename = item.filename
                if filename == 'Payload/Rivo.app/main.jsbundle':
                    zout.writestr(item, hermes_bytes)
                    print("   - Injected Payload/Rivo.app/main.jsbundle")
                elif filename == 'Payload/Rivo.app/Info.plist':
                    plist_obj = plistlib.loads(zin.read(filename))
                    plist_obj['CFBundleShortVersionString'] = version
                    plist_obj['CFBundleVersion'] = build_num
                    zout.writestr(item, plistlib.dumps(plist_obj, fmt=plistlib.FMT_BINARY))
                    print(f"   - Updated Payload/Rivo.app/Info.plist to v{version} (Build {build_num})")
                elif filename == 'Payload/Rivo.app/EXConstants.bundle/app.config':
                    cfg = json.loads(zin.read(filename).decode('utf-8'))
                    cfg['version'] = version
                    if 'ios' in cfg:
                        cfg['ios']['buildNumber'] = build_num
                    zout.writestr(item, json.dumps(cfg).encode('utf-8'))
                    print(f"   - Updated Payload/Rivo.app/EXConstants.bundle/app.config to v{version} (Build {build_num})")
                else:
                    zout.writestr(item, zin.read(filename))

    if os.path.exists(out_ipa):
        os.remove(out_ipa)
    os.rename(temp_ipa, out_ipa)
    shutil.copyfile(out_ipa, generic_ipa)
    shutil.copyfile(out_ipa, dist_out_ipa)
    shutil.copyfile(out_ipa, dist_generic_ipa)

    size_mb = os.path.getsize(out_ipa) / (1024 * 1024)
    print(f"\nSUCCESS: Generated {out_ipa} ({size_mb:.2f} MB)")
    print(f"Copied to {generic_ipa}")
    print(f"Copied to {dist_out_ipa}")
    print(f"Copied to {dist_generic_ipa}")

if __name__ == '__main__':
    build_ios_ipa()
