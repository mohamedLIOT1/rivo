import zipfile
import plistlib
import json
import shutil
import os
import sys

def repack():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    src_ipa = os.path.join(base_dir, 'public', 'downloads', 'Rivo-v1.7.5.ipa')
    out_ipa = os.path.join(base_dir, 'public', 'downloads', 'Rivo-v1.7.7.ipa')
    generic_ipa = os.path.join(base_dir, 'public', 'downloads', 'Rivo.ipa')
    bundle_file = os.path.join(base_dir, 'main.hermes.bundle')
    if not os.path.exists(bundle_file):
        bundle_file = os.path.join(base_dir, 'main.jsbundle')

    if not os.path.exists(src_ipa):
        print(f"Base IPA not found: {src_ipa}")
        sys.exit(1)

    if not os.path.exists(bundle_file):
        print(f"Bundle file not found: {bundle_file}")
        sys.exit(1)

    with open(bundle_file, 'rb') as f:
        new_bundle_bytes = f.read()

    temp_ipa = out_ipa + '.tmp'

    with zipfile.ZipFile(src_ipa, 'r') as zin:
        with zipfile.ZipFile(temp_ipa, 'w', compression=zipfile.ZIP_DEFLATED) as zout:
            for item in zin.infolist():
                filename = item.filename
                if filename == 'Payload/Rivo.app/main.jsbundle':
                    zout.writestr(item, new_bundle_bytes)
                    print(f"Injected new main.jsbundle ({len(new_bundle_bytes)} bytes)")
                elif filename == 'Payload/Rivo.app/Info.plist':
                    raw_plist = zin.read(filename)
                    plist_obj = plistlib.loads(raw_plist)
                    plist_obj['CFBundleShortVersionString'] = '1.7.7'
                    plist_obj['CFBundleVersion'] = '46'
                    new_plist_bytes = plistlib.dumps(plist_obj, fmt=plistlib.FMT_BINARY)
                    zout.writestr(item, new_plist_bytes)
                    print("Updated Info.plist to 1.7.7 (Build 46)")
                elif filename == 'Payload/Rivo.app/EXConstants.bundle/app.config':
                    cfg = json.loads(zin.read(filename).decode('utf-8'))
                    cfg['version'] = '1.7.7'
                    if 'ios' in cfg:
                        cfg['ios']['buildNumber'] = '46'
                    new_cfg_bytes = json.dumps(cfg).encode('utf-8')
                    zout.writestr(item, new_cfg_bytes)
                    print("Updated app.config to 1.7.7 (Build 46)")
                else:
                    zout.writestr(item, zin.read(filename))

    if os.path.exists(out_ipa):
        os.remove(out_ipa)
    os.rename(temp_ipa, out_ipa)
    shutil.copyfile(out_ipa, generic_ipa)

    print(f"Successfully generated genuine Apple ZIP IPA: {out_ipa} ({os.path.getsize(out_ipa)} bytes)")

if __name__ == '__main__':
    repack()
