import urllib.request
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

BASE = 'https://rivo-m.duckdns.org'

def fetch_json(endpoint):
    req = urllib.request.Request(f'{BASE}{endpoint}', headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode('utf-8'))

print("=== 1. VERIFY APP VERSION ===")
v_data = fetch_json('/api/app/version')
print(f"Version: {v_data.get('version')}, Android Build: {v_data.get('platforms', {}).get('android', {}).get('build')}, iOS Build: {v_data.get('platforms', {}).get('ios', {}).get('build')}")
assert v_data.get('version') == '1.8.8'
assert v_data.get('platforms', {}).get('android', {}).get('build') == 57
assert v_data.get('platforms', {}).get('ios', {}).get('build') == 57

print("\n=== 2. VERIFY ALBUMS API ===")
alb_data = fetch_json('/api/albums')
albums = alb_data.get('albums', [])
print(f"Total Albums: {len(albums)}")
assert len(albums) > 0
for a in albums[:5]:
    name = a.get('name') or a.get('title')
    t_count = a.get('trackCount')
    assert t_count is not None and t_count > 0, f"Album {name} has invalid trackCount: {t_count}"
    print(f"Album: {name} | Artist: {a.get('artist')} | Songs: {t_count} | Cover: {bool(a.get('cover'))}")

first_id = albums[0].get('id') or albums[0].get('_id')
alb_detail = fetch_json(f'/api/albums/{first_id}')
assert alb_detail.get('success') is True
detail_album = alb_detail.get('album', {})
print(f"Album Detail ID {first_id}: title={detail_album.get('title')}, trackCount={detail_album.get('trackCount')}, tracks_len={len(alb_detail.get('tracks', []))}")
assert len(alb_detail.get('tracks', [])) > 0

print("\n=== 3. VERIFY ARTISTS API ===")
art_data = fetch_json('/api/artists')
artists = art_data.get('artists', [])
print(f"Total Artists: {len(artists)}")
names = [a.get('name') for a in artists]
print("Top 10 Artists:")
for a in artists[:10]:
    print(f"Artist: {a.get('name')} | Songs: {a.get('trackCount')} | Albums: {a.get('albumCount')} | Cover: {bool(a.get('avatar') or a.get('image'))}")

# Check that Quran reciters appear as real artists and NOT 'القرآن الكريم' or 'قرآن كريم '
assert 'القرآن الكريم' not in names, "'القرآن الكريم' should not be an artist name"
assert 'قرآن كريم ' not in names, "'قرآن كريم ' should not be an artist name"
assert any('عفاسي' in n for n in names), "Alafasy should appear in artists"
assert any('حصري' in n for n in names), "Hussary should appear in artists"
assert any('منشاوي' in n for n in names), "Minshawi should appear in artists"
assert any('دوسري' in n for n in names), "Dossari should appear in artists"

afasy_art = next(a for a in artists if 'عفاسي' in a.get('name', ''))
print(f"Alafasy artist: {afasy_art.get('name')}, Songs: {afasy_art.get('trackCount')}, Cover: {bool(afasy_art.get('avatar'))}")
assert afasy_art.get('trackCount') == 114

hussary_art = next(a for a in artists if 'حصري' in a.get('name', ''))
print(f"Hussary artist: {hussary_art.get('name')}, Songs: {hussary_art.get('trackCount')}, Cover: {bool(hussary_art.get('avatar'))}")
assert hussary_art.get('trackCount') == 114

print("\n=== 4. VERIFY DOWNLOAD ARTIFACTS ===")
for path in ['/downloads/Rivo-v1.8.8.apk', '/downloads/Rivo-v1.8.8.ipa', '/downloads/Rivo.apk', '/downloads/Rivo.ipa']:
    req = urllib.request.Request(f'{BASE}{path}', headers={'User-Agent': 'Mozilla/5.0'}, method='HEAD')
    with urllib.request.urlopen(req) as resp:
        cl = resp.headers.get('Content-Length')
        print(f"File {path}: HTTP {resp.status}, Size {cl} bytes")
        assert resp.status == 200
        assert int(cl) > 1000000

print("\nALL PRODUCTION CHECKS PASSED SUCCESSFULLY!")
