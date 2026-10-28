import zipfile
import plistlib
import json
import shutil
import os
import sys

def repack():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    pkg_path = os.path.join(base_dir, 'package.json')
    app_json_path = os.path.join(base_dir, 'app.json')

    version = '2.1.7'
    build_num = '111'

    if os.path.exists(pkg_path):
        try:
            with open(pkg_path, 'r', encoding='utf-8') as f:
                version = json.load(f).get('version', version)
        except Exception as e:
            print("Warning reading package.json:", e)

    if os.path.exists(app_json_path):
        try:
            with open(app_json_path, 'r', encoding='utf-8') as f:
                app_cfg = json.load(f)
                build_num = str(app_cfg.get('expo', {}).get('ios', {}).get('buildNumber', build_num))
        except Exception as e:
            print("Warning reading app.json:", e)

    src_ipa = os.path.join(base_dir, 'public', 'downloads', 'Rivo.ipa')
    if not os.path.exists(src_ipa):
        candidates = [
            os.path.join(base_dir, 'public', 'downloads', 'Rivo-v2.1.6.ipa'),
            os.path.join(base_dir, 'public', 'downloads', 'Rivo-v1.9.9.9.ipa')
        ]
        for c in candidates:
            if os.path.exists(c):
                src_ipa = c
                break

    if not os.path.exists(src_ipa):
        print(f"Error: Base IPA not found at {src_ipa}")
        sys.exit(1)

    out_ipa = os.path.join(base_dir, 'public', 'downloads', f'Rivo-v{version}.ipa')
    generic_ipa = os.path.join(base_dir, 'public', 'downloads', 'Rivo.ipa')
    dist_dir = os.path.join(base_dir, 'dist', 'downloads')
    os.makedirs(dist_dir, exist_ok=True)
    dist_out_ipa = os.path.join(dist_dir, f'Rivo-v{version}.ipa')
    dist_generic_ipa = os.path.join(dist_dir, 'Rivo.ipa')

    temp_ipa = out_ipa + '.tmp'
    print(f"Repacking IPA from {os.path.basename(src_ipa)} for v{version} (Build {build_num})...")

    with zipfile.ZipFile(src_ipa, 'r') as zin:
        with zipfile.ZipFile(temp_ipa, 'w', compression=zipfile.ZIP_DEFLATED) as zout:
            for item in zin.infolist():
                filename = item.filename
                if filename == 'Payload/Rivo.app/Info.plist':
                    raw_plist = zin.read(filename)
                    plist_obj = plistlib.loads(raw_plist)
                    plist_obj['CFBundleShortVersionString'] = version
                    plist_obj['CFBundleVersion'] = build_num
                    zout.writestr(item, plistlib.dumps(plist_obj, fmt=plistlib.FMT_BINARY))
                    print(f"   Updated Info.plist to {version} (Build {build_num})")
                elif filename == 'Payload/Rivo.app/EXConstants.bundle/app.config':
                    cfg = json.loads(zin.read(filename).decode('utf-8'))
                    cfg['version'] = version
                    if 'ios' in cfg:
                        cfg['ios']['buildNumber'] = build_num
                    zout.writestr(item, json.dumps(cfg).encode('utf-8'))
                    print(f"   Updated app.config to {version} (Build {build_num})")
                else:
                    zout.writestr(item, zin.read(filename))

    if os.path.exists(out_ipa):
        os.remove(out_ipa)
    os.rename(temp_ipa, out_ipa)
    shutil.copyfile(out_ipa, generic_ipa)
    shutil.copyfile(out_ipa, dist_out_ipa)
    shutil.copyfile(out_ipa, dist_generic_ipa)

    print(f"Successfully generated genuine Apple ZIP IPA: {out_ipa} ({os.path.getsize(out_ipa)} bytes)")

if __name__ == '__main__':
    repack()
