import urllib.request
import urllib.parse
import json
import ssl
import sys
import time

sys.stdout.reconfigure(encoding='utf-8')

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

BASE_URL = 'https://rivo-m.duckdns.org'

def test_health():
    print("=== 1. API Endpoint Check ===")
    req = urllib.request.Request(f'{BASE_URL}/api/tracks', headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=10) as resp:
            data = resp.read()
            print(f"Status: {resp.status}, /api/tracks returned {len(data)} bytes")
            return resp.status == 200
    except Exception as e:
        print(f"Error: {e}")
        return False

def test_frontend_bundle():
    print("\n=== 2. Verify Frontend Assets ===")
    req = urllib.request.Request(f'{BASE_URL}/', headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=10) as resp:
            html = resp.read().decode('utf-8')
            print(f"Index HTML loaded: {len(html)} bytes")
            for line in html.splitlines():
                if '<script' in line and 'src=' in line:
                    print(f"Script tag: {line.strip()}")
            return True
    except Exception as e:
        print(f"Error: {e}")
        return False

def test_cached_stream():
    print("\n=== 3. Testing Cached Track Stream ===")
    t0 = time.time()
    params = urllib.parse.urlencode({'title': 'آي تي إم', 'artist': 'Wegz'})
    req = urllib.request.Request(f'{BASE_URL}/api/tracks/stream?{params}', headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            elapsed = time.time() - t0
            print(f"Stream resolution took: {elapsed:.2f}s, success: {data.get('success')}")
            stream_url = data.get('url')
            print(f"Stream URL: {stream_url}")

            full_audio_url = f"{BASE_URL}{stream_url}" if stream_url.startswith('/') else stream_url
            audio_req = urllib.request.Request(full_audio_url, headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'Range': 'bytes=0-1000',
                'Origin': BASE_URL
            })
            with urllib.request.urlopen(audio_req, context=ctx, timeout=10) as a_resp:
                print(f"Audio fetch status: {a_resp.status} (expected 206)")
                print(f"Content-Type: {a_resp.headers.get('Content-Type')}")
                print(f"Content-Range: {a_resp.headers.get('Content-Range')}")
                print(f"Accept-Ranges: {a_resp.headers.get('Accept-Ranges')}")
                content = a_resp.read()
                print(f"Received bytes: {len(content)}")
                return a_resp.status in (200, 206) and len(content) > 0
    except Exception as e:
        print(f"Error: {e}")
        return False

def test_uncached_stream():
    print("\n=== 4. Testing Uncached Track Stream ===")
    t0 = time.time()
    # Test a track that was not previously cached
    params = urllib.parse.urlencode({'title': 'No Surprises', 'artist': 'Radiohead'})
    req = urllib.request.Request(f'{BASE_URL}/api/tracks/stream?{params}', headers={'User-Agent': 'Mozilla/5.0'})
    try:
        print("Resolving uncached track (Radiohead - No Surprises)...")
        with urllib.request.urlopen(req, context=ctx, timeout=25) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            elapsed = time.time() - t0
            print(f"Uncached resolution took: {elapsed:.2f}s, success: {data.get('success')}")
            stream_url = data.get('url')
            print(f"Stream URL: {stream_url[:90]}...")

            full_audio_url = f"{BASE_URL}{stream_url}" if stream_url.startswith('/') else stream_url
            audio_req = urllib.request.Request(full_audio_url, headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Range': 'bytes=0-5000',
                'Origin': BASE_URL
            })
            with urllib.request.urlopen(audio_req, context=ctx, timeout=15) as a_resp:
                print(f"Proxy streaming status: {a_resp.status} (expected 206)")
                print(f"Content-Type: {a_resp.headers.get('Content-Type')}")
                print(f"Content-Range: {a_resp.headers.get('Content-Range')}")
                print(f"CORS Origin: {a_resp.headers.get('Access-Control-Allow-Origin')}")
                content = a_resp.read()
                print(f"Received audio bytes: {len(content)}")
                return a_resp.status in (200, 206) and len(content) > 0
    except Exception as e:
        print(f"Error: {e}")
        return False

if __name__ == '__main__':
    h = test_health()
    f = test_frontend_bundle()
    c = test_cached_stream()
    u = test_uncached_stream()
    print("\n==============================")
    print(f"API Check: {'PASS' if h else 'FAIL'}")
    print(f"Frontend: {'PASS' if f else 'FAIL'}")
    print(f"Cached Playback: {'PASS' if c else 'FAIL'}")
    print(f"Uncached Playback: {'PASS' if u else 'FAIL'}")
    print("==============================")
    if not (h and f and c and u):
        sys.exit(1)
