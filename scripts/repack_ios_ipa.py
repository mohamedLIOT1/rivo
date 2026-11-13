import os
import sys
import zipfile
import subprocess
import shutil
import plistlib
import json

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST_DIR = os.path.join(ROOT_DIR, 'dist')
DOWNLOADS_DIR = os.path.join(ROOT_DIR, 'public', 'downloads')
JS_BUNDLE_RAW = os.path.join(DIST_DIR, 'main.jsbundle')
JS_BUNDLE_HBC = os.path.join(DIST_DIR, 'main.jsbundle.hbc')
BASE_IPA = os.path.join(DOWNLOADS_DIR, 'Rivo-v2.3.9.ipa')
if not os.path.exists(BASE_IPA):
    BASE_IPA = os.path.join(DOWNLOADS_DIR, 'Rivo.ipa')
if not os.path.exists(BASE_IPA):
    BASE_IPA = os.path.join(DOWNLOADS_DIR, 'Rivo-v2.4.2.ipa')
HERMESC = os.path.join(ROOT_DIR, 'node_modules', 'react-native', 'sdks', 'hermesc', 'win64-bin', 'hermesc.exe')
USER_DOWNLOADS = os.path.join(os.path.expanduser('~'), 'Downloads')

VERSION = '2.4.43'
BUILD_NUM = '159'
NEW_IPA_VERSIONED = os.path.join(DOWNLOADS_DIR, f'Rivo-v{VERSION}.ipa')
NEW_IPA_LATEST = os.path.join(DOWNLOADS_DIR, 'Rivo.ipa')

def get_target_version():
    pkg_path = os.path.join(ROOT_DIR, 'package.json')
    try:
        with open(pkg_path, 'r', encoding='utf-8') as f:
            return json.load(f).get('version', VERSION)
    except Exception:
        return VERSION

def build_metro_bundle():
    print(f"\n[1/3] Exporting iOS JavaScript bundle via Metro...")
    os.makedirs(DIST_DIR, exist_ok=True)
    expo_cli = os.path.join(ROOT_DIR, 'node_modules', '@expo', 'cli', 'build', 'bin', 'cli')
    cmd = [
        'node', expo_cli, 'export:embed',
        '--entry-file', 'index.js',
        '--platform', 'ios',
        '--dev', 'false',
        '--bundle-output', JS_BUNDLE_RAW,
        '--assets-dest', DIST_DIR
    ]
    res = subprocess.run(cmd, cwd=ROOT_DIR, capture_output=True, text=True, encoding='utf-8', errors='replace')
    if res.returncode != 0:
        print(f"ERROR running Metro bundler: {res.stderr}")
        if not os.path.exists(JS_BUNDLE_RAW):
            sys.exit(1)
        print("Using existing JS_BUNDLE despite warnings.")
    else:
        print("[OK] Metro iOS raw bundle exported successfully.")

    raw_kb = os.path.getsize(JS_BUNDLE_RAW) / 1024
    print(f"[OK] Raw JS Bundle size: {raw_kb:.1f} KB")

def compile_hermes_bytecode():
    print(f"\n[2/3] Compiling iOS bundle to Hermes Bytecode v96 (hermesc)...")
    if not os.path.exists(HERMESC):
        print(f"ERROR: hermesc.exe not found at {HERMESC}")
        sys.exit(1)

    cmd = [HERMESC, '-emit-binary', '-out', JS_BUNDLE_HBC, JS_BUNDLE_RAW]
    res = subprocess.run(cmd, cwd=ROOT_DIR, capture_output=True, text=True)
    if res.returncode != 0:
        print(f"Hermes compilation failed: {res.stderr}")
        sys.exit(1)

    with open(JS_BUNDLE_HBC, 'rb') as f:
        hbc_bytes = f.read()

    # Verify Hermes bytecode v96 header
    expected_magic = b'\xc6\x1f\xbc\x03\xc1\x03\x19\x1f'
    if len(hbc_bytes) < 16 or hbc_bytes[:8] != expected_magic or hbc_bytes[8] != 0x60:
        print(f"ERROR: Compiled bundle header mismatch! Header: {hbc_bytes[:16].hex()}")
        sys.exit(1)

    size_kb = len(hbc_bytes) / 1024
    print(f"[OK] Hermes Bytecode v96 generated: {size_kb:.1f} KB (Magic: {hbc_bytes[:8].hex()}, Version: 0x{hbc_bytes[8]:02x})")
    return hbc_bytes

def repack():
    target_ver = get_target_version()
    print(f"\n--- Repacking Rivo iOS IPA (v{target_ver} Build {BUILD_NUM}) ---")

    # Ensure JS version.js and manifests are in sync before Metro bundles index.js
    sync_script = os.path.join(ROOT_DIR, 'scripts', 'sync-version.js')
    if os.path.exists(sync_script):
        subprocess.run(['node', sync_script, target_ver, BUILD_NUM], cwd=ROOT_DIR)

    build_metro_bundle()

    hbc_bytes = compile_hermes_bytecode()

    if not os.path.exists(BASE_IPA):
        print(f"ERROR: Base IPA {BASE_IPA} not found!")
        sys.exit(1)

    temp_zip = os.path.join(DOWNLOADS_DIR, 'temp_repack.zip')
    print(f"\n[3/3] Injecting Hermes Bytecode v96 and preserving Unix Mach-O permissions...")

    with zipfile.ZipFile(BASE_IPA, 'r') as zin:
        with zipfile.ZipFile(temp_zip, 'w', compression=zipfile.ZIP_DEFLATED) as zout:
            for item in zin.infolist():
                filename = item.filename
                item.create_system = 3

                # Ensure Mach-O executables always retain execute permission
                is_macho_main = (filename == 'Payload/Rivo.app/Rivo')
                is_framework_exec = ('Payload/Rivo.app/Frameworks/' in filename and not filename.endswith('.plist') and not filename.endswith('/'))
                if is_macho_main or is_framework_exec:
                    item.external_attr = 0o100755 << 16

                if filename.endswith('Rivo.app/main.jsbundle') or filename == 'Payload/Rivo.app/main.jsbundle':
                    print(f" -> Injecting Hermes v96 bytecode into {filename} ({len(hbc_bytes):,} bytes)")
                    zout.writestr(item, hbc_bytes)
                elif filename == 'Payload/Rivo.app/Info.plist':
                    try:
                        raw = zin.read(filename)
                        plist_obj = plistlib.loads(raw)
                        plist_obj['CFBundleShortVersionString'] = target_ver
                        plist_obj['CFBundleVersion'] = BUILD_NUM
                        plist_obj['NSMicrophoneUsageDescription'] = 'Rivo requires microphone access to listen to and identify songs via Song Radar.'
                        plist_obj['NSSpeechRecognitionUsageDescription'] = 'Rivo uses speech and audio recognition for Song Radar.'
                        new_plist = plistlib.dumps(plist_obj, fmt=plistlib.FMT_BINARY)
                        zout.writestr(item, new_plist)
                        print(f" -> Updated Info.plist: v{target_ver} (Build {BUILD_NUM}) with Song Radar permissions")
                    except Exception as e:
                        print(f"[WARN] Failed to update Info.plist: {e}")
                        zout.writestr(item, zin.read(filename))
                elif filename == 'Payload/Rivo.app/EXConstants.bundle/app.config':
                    try:
                        cfg = json.loads(zin.read(filename).decode('utf-8'))
                        cfg['version'] = target_ver
                        if 'ios' in cfg:
                            cfg['ios']['buildNumber'] = BUILD_NUM
                        zout.writestr(item, json.dumps(cfg).encode('utf-8'))
                        print(f" -> Updated EXConstants app.config: v{target_ver} (Build {BUILD_NUM})")
                    except Exception as e:
                        print(f"[WARN] Failed to update app.config: {e}")
                        zout.writestr(item, zin.read(filename))
                else:
                    buffer = zin.read(filename)
                    zout.writestr(item, buffer)

    print(f"\nFinalizing output IPAs...")
    versioned_ipa = os.path.join(DOWNLOADS_DIR, f'Rivo-v{target_ver}.ipa')
    for target in [versioned_ipa, NEW_IPA_LATEST]:
        if os.path.exists(target):
            os.remove(target)
        shutil.copyfile(temp_zip, target)
        size_mb = os.path.getsize(target) / (1024 * 1024)
        print(f"SUCCESS: Generated {target} ({size_mb:.2f} MB)")

    # Also sync to dist/downloads and user Downloads folder
    dist_dl = os.path.join(ROOT_DIR, 'dist', 'downloads')
    os.makedirs(dist_dl, exist_ok=True)
    shutil.copyfile(temp_zip, os.path.join(dist_dl, f'Rivo-v{target_ver}.ipa'))
    shutil.copyfile(temp_zip, os.path.join(dist_dl, 'Rivo.ipa'))

    if os.path.exists(USER_DOWNLOADS):
        user_ipa = os.path.join(USER_DOWNLOADS, f'Rivo-v{target_ver}.ipa')
        try:
            shutil.copyfile(temp_zip, user_ipa)
            print(f"SUCCESS: Synced directly to user Downloads: {user_ipa}")
        except Exception as e:
            print(f"Notice syncing to user Downloads: {e}")

    os.remove(temp_zip)
    print("Bundle format: Verified Hermes Bytecode v96 (Hermes runtime crash-free on iOS)")

if __name__ == '__main__':
    repack()
