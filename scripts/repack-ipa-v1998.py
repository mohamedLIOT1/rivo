import zipfile
import plistlib
import json
import shutil
import os

base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src_ipa = os.path.join(base_dir, 'public', 'downloads', 'Rivo.ipa')
out_ipa = os.path.join(base_dir, 'public', 'downloads', 'Rivo-v1.9.9.8.ipa')
dist_out_ipa = os.path.join(base_dir, 'dist', 'downloads', 'Rivo-v1.9.9.8.ipa')
generic_ipa = os.path.join(base_dir, 'public', 'downloads', 'Rivo.ipa')
dist_generic_ipa = os.path.join(base_dir, 'dist', 'downloads', 'Rivo.ipa')

os.makedirs(os.path.join(base_dir, 'dist', 'downloads'), exist_ok=True)
os.makedirs(os.path.join(base_dir, 'public', 'downloads'), exist_ok=True)

version = '1.9.9.8'
build_num = '91'
temp_ipa = out_ipa + '.tmp'

print(f"Repacking IPA for v{version} (Build {build_num})...")

with zipfile.ZipFile(src_ipa, 'r') as zin:
    with zipfile.ZipFile(temp_ipa, 'w', compression=zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            filename = item.filename
            if filename == 'Payload/Rivo.app/Info.plist':
                plist_obj = plistlib.loads(zin.read(filename))
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
shutil.copyfile(out_ipa, dist_out_ipa)
shutil.copyfile(out_ipa, generic_ipa)
shutil.copyfile(out_ipa, dist_generic_ipa)

print(f"Successfully created: {out_ipa} ({os.path.getsize(out_ipa)} bytes)")
print(f"Copied to: {dist_out_ipa}")

# Also ensure Rivo-v1.9.9.8.apk and Rivo-v1.9.9.8.exe exist
src_apk = os.path.join(base_dir, 'public', 'downloads', 'Rivo.apk')
out_apk = os.path.join(base_dir, 'public', 'downloads', 'Rivo-v1.9.9.8.apk')
dist_out_apk = os.path.join(base_dir, 'dist', 'downloads', 'Rivo-v1.9.9.8.apk')

if os.path.exists(src_apk):
    shutil.copyfile(src_apk, out_apk)
    shutil.copyfile(src_apk, dist_out_apk)
    print(f"Created: {out_apk} ({os.path.getsize(out_apk)} bytes)")

src_exe = os.path.join(base_dir, 'public', 'downloads', 'Rivo.exe')
out_exe = os.path.join(base_dir, 'public', 'downloads', 'Rivo-v1.9.9.8.exe')
dist_out_exe = os.path.join(base_dir, 'dist', 'downloads', 'Rivo-v1.9.9.8.exe')

if os.path.exists(src_exe):
    shutil.copyfile(src_exe, out_exe)
    shutil.copyfile(src_exe, dist_out_exe)
    print(f"Created: {out_exe} ({os.path.getsize(out_exe)} bytes)")
