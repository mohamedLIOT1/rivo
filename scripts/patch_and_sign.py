import zipfile
import plistlib
import json
import shutil
import subprocess
import os
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HERMESC = os.path.join(BASE_DIR, 'node_modules', 'react-native', 'sdks', 'hermesc', 'win64-bin', 'hermesc.exe')
ZIPALIGN = r"C:\Users\mohamed\AppData\Local\Android\Sdk\build-tools\34.0.0\zipalign.exe"
APKSIGNER = r"C:\Users\mohamed\AppData\Local\Android\Sdk\build-tools\34.0.0\apksigner.bat"
KEYSTORE = os.path.join(BASE_DIR, 'android', 'app', 'debug.keystore')

def patch_ios():
    ios_raw = os.path.join(BASE_DIR, 'ios_main.jsbundle')
    if not os.path.exists(ios_raw):
        print(f"iOS raw bundle not found: {ios_raw}")
        return False
    
    hermes_out = os.path.join(BASE_DIR, 'ios_main.hermes.bundle')
    print("1. Compiling iOS bundle to Hermes Bytecode v96...")
    cmd = [HERMESC, '-emit-binary', '-out', hermes_out, '-O', ios_raw]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print(f"Hermes compilation failed: {res.stderr}")
        return False
    
    with open(hermes_out, 'rb') as f:
        hermes_bytes = f.read()
    print(f"Compiled Hermes bundle ({len(hermes_bytes)} bytes)")

    src_ipa = os.path.join(BASE_DIR, 'public', 'downloads', 'Rivo-v1.7.5.ipa')
    out_ipa = os.path.join(BASE_DIR, 'public', 'downloads', 'Rivo-v1.8.5.ipa')
    legacy_ipa = os.path.join(BASE_DIR, 'public', 'downloads', 'Rivo-v1.8.4.ipa')
    generic_ipa = os.path.join(BASE_DIR, 'public', 'downloads', 'Rivo.ipa')
    dist_ipa = os.path.join(BASE_DIR, 'dist', 'downloads', 'Rivo-v1.8.5.ipa')
    dist_legacy_ipa = os.path.join(BASE_DIR, 'dist', 'downloads', 'Rivo-v1.8.4.ipa')
    dist_gen_ipa = os.path.join(BASE_DIR, 'dist', 'downloads', 'Rivo.ipa')

    os.makedirs(os.path.dirname(out_ipa), exist_ok=True)
    os.makedirs(os.path.dirname(dist_ipa), exist_ok=True)

    temp_ipa = out_ipa + '.tmp'
    print("2. Repacking genuine Apple ZIP IPA...")
    with zipfile.ZipFile(src_ipa, 'r') as zin:
        with zipfile.ZipFile(temp_ipa, 'w', compression=zipfile.ZIP_DEFLATED) as zout:
            for item in zin.infolist():
                filename = item.filename
                if filename == 'Payload/Rivo.app/main.jsbundle':
                    zout.writestr(item, hermes_bytes)
                elif filename == 'Payload/Rivo.app/Info.plist':
                    plist_obj = plistlib.loads(zin.read(filename))
                    plist_obj['CFBundleShortVersionString'] = '1.8.5'
                    plist_obj['CFBundleVersion'] = '54'
                    zout.writestr(item, plistlib.dumps(plist_obj, fmt=plistlib.FMT_BINARY))
                elif filename == 'Payload/Rivo.app/EXConstants.bundle/app.config':
                    cfg = json.loads(zin.read(filename).decode('utf-8'))
                    cfg['version'] = '1.8.5'
                    if 'ios' in cfg:
                        cfg['ios']['buildNumber'] = '54'
                    zout.writestr(item, json.dumps(cfg).encode('utf-8'))
                else:
                    zout.writestr(item, zin.read(filename))

    if os.path.exists(out_ipa):
        os.remove(out_ipa)
    os.rename(temp_ipa, out_ipa)
    shutil.copyfile(out_ipa, generic_ipa)
    shutil.copyfile(out_ipa, legacy_ipa)
    shutil.copyfile(out_ipa, dist_ipa)
    shutil.copyfile(out_ipa, dist_legacy_ipa)
    shutil.copyfile(out_ipa, dist_gen_ipa)
    print(f"iOS IPA ready ({os.path.getsize(out_ipa)} bytes)")
    return True

def patch_android():
    android_raw = os.path.join(BASE_DIR, 'android_main.jsbundle')
    if not os.path.exists(android_raw):
        print(f"Android raw bundle not found: {android_raw}")
        return False

    with open(android_raw, 'rb') as f:
        bundle_bytes = f.read()

    base_apk = os.path.join(BASE_DIR, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk')
    out_apk = os.path.join(BASE_DIR, 'public', 'downloads', 'Rivo-v1.8.5.apk')
    legacy_apk = os.path.join(BASE_DIR, 'public', 'downloads', 'Rivo-v1.8.4.apk')
    generic_apk = os.path.join(BASE_DIR, 'public', 'downloads', 'Rivo.apk')
    dist_apk = os.path.join(BASE_DIR, 'dist', 'downloads', 'Rivo-v1.8.5.apk')
    dist_legacy_apk = os.path.join(BASE_DIR, 'dist', 'downloads', 'Rivo-v1.8.4.apk')
    dist_gen_apk = os.path.join(BASE_DIR, 'dist', 'downloads', 'Rivo.apk')

    os.makedirs(os.path.dirname(out_apk), exist_ok=True)
    os.makedirs(os.path.dirname(dist_apk), exist_ok=True)

    temp_apk = out_apk + '.unsigned.apk'
    print("1. Injecting updated bundle into clean APK base...")
    with zipfile.ZipFile(base_apk, 'r') as zin:
        with zipfile.ZipFile(temp_apk, 'w', compression=zipfile.ZIP_DEFLATED) as zout:
            for item in zin.infolist():
                if item.filename.startswith('META-INF/'):
                    continue  # Strip old signatures before re-signing
                elif item.filename == 'assets/index.android.bundle':
                    zout.writestr(item, bundle_bytes)
                elif item.filename == 'AndroidManifest.xml':
                    manifest_bytes = bytearray(zin.read(item.filename))
                    old_str1 = '1.7.8'.encode('utf-16le')
                    old_str2 = '1.7.9'.encode('utf-16le')
                    old_str3 = '1.8.0'.encode('utf-16le')
                    old_str4 = '1.8.1'.encode('utf-16le')
                    old_str5 = '1.8.2'.encode('utf-16le')
                    old_str6 = '1.8.3'.encode('utf-16le')
                    old_str7 = '1.8.4'.encode('utf-16le')
                    new_str = '1.8.5'.encode('utf-16le')
                    if old_str7 in manifest_bytes:
                        manifest_bytes = manifest_bytes.replace(old_str7, new_str)
                    elif old_str6 in manifest_bytes:
                        manifest_bytes = manifest_bytes.replace(old_str6, new_str)
                    elif old_str5 in manifest_bytes:
                        manifest_bytes = manifest_bytes.replace(old_str5, new_str)
                    elif old_str4 in manifest_bytes:
                        manifest_bytes = manifest_bytes.replace(old_str4, new_str)
                    elif old_str3 in manifest_bytes:
                        manifest_bytes = manifest_bytes.replace(old_str3, new_str)
                    elif old_str2 in manifest_bytes:
                        manifest_bytes = manifest_bytes.replace(old_str2, new_str)
                    elif old_str1 in manifest_bytes:
                        manifest_bytes = manifest_bytes.replace(old_str1, new_str)
                    old_code1 = b'\x08\x00\x00\x10\x2f\x00\x00\x00'  # versionCode 47
                    old_code2 = b'\x08\x00\x00\x10\x30\x00\x00\x00'  # versionCode 48
                    old_code3 = b'\x08\x00\x00\x10\x31\x00\x00\x00'  # versionCode 49
                    old_code4 = b'\x08\x00\x00\x10\x32\x00\x00\x00'  # versionCode 50
                    old_code5 = b'\x08\x00\x00\x10\x33\x00\x00\x00'  # versionCode 51
                    old_code6 = b'\x08\x00\x00\x10\x34\x00\x00\x00'  # versionCode 52
                    old_code7 = b'\x08\x00\x00\x10\x35\x00\x00\x00'  # versionCode 53
                    new_code = b'\x08\x00\x00\x10\x36\x00\x00\x00'   # versionCode 54
                    if old_code7 in manifest_bytes:
                        manifest_bytes = manifest_bytes.replace(old_code7, new_code)
                    elif old_code6 in manifest_bytes:
                        manifest_bytes = manifest_bytes.replace(old_code6, new_code)
                    elif old_code5 in manifest_bytes:
                        manifest_bytes = manifest_bytes.replace(old_code5, new_code)
                    elif old_code4 in manifest_bytes:
                        manifest_bytes = manifest_bytes.replace(old_code4, new_code)
                    elif old_code3 in manifest_bytes:
                        manifest_bytes = manifest_bytes.replace(old_code3, new_code)
                    elif old_code2 in manifest_bytes:
                        manifest_bytes = manifest_bytes.replace(old_code2, new_code)
                    elif old_code1 in manifest_bytes:
                        manifest_bytes = manifest_bytes.replace(old_code1, new_code)
                    zout.writestr(item, manifest_bytes)
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

    align_verify_cmd = [ZIPALIGN, '-c', '-v', '4', out_apk]
    align_verify_res = subprocess.run(align_verify_cmd, capture_output=True, text=True)
    if 'Verification succesful' not in align_verify_res.stdout:
        print(f"Zipalign verification failed!")
        return False
    print("Zipalign verification successful!")

    shutil.copyfile(out_apk, generic_apk)
    shutil.copyfile(out_apk, legacy_apk)
    shutil.copyfile(out_apk, dist_apk)
    shutil.copyfile(out_apk, dist_legacy_apk)
    shutil.copyfile(out_apk, dist_gen_apk)
    print(f"Android APK signed and verified ({os.path.getsize(out_apk)} bytes)")
    return True

if __name__ == '__main__':
    mode = sys.argv[1] if len(sys.argv) > 1 else 'all'
    if mode in ('ios', 'all'):
        patch_ios()
    if mode in ('android', 'all'):
        patch_android()
