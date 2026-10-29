import urllib.request, json

for q in ["uvr5", "roformer", "music-source-separation"]:
    url = f"https://huggingface.co/api/spaces?search={q}&limit=20"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())
            print(f"=== {q} ===")
            for item in data:
                sid = item.get('id')
                likes = item.get('likes', 0)
                sdk = item.get('sdk')
                print(f"  {sid} (likes: {likes}, sdk: {sdk})")
    except Exception as e:
        print("Error:", e)
