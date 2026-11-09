import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from deploy_production import run_ssh

conf_content = '''--extractor-args "youtubepot-bgutilhttp:base_url=http://127.0.0.1:4416"
--extractor-args "youtube:player-client=web"
--cookies /home/ubuntu/rivo/cookies.txt
'''

run_ssh(f"cat << 'EOF' > /home/ubuntu/yt-dlp.conf\n{conf_content}EOF")

res = run_ssh("yt-dlp -g -f 'ba/b' 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'")
print("Direct yt-dlp test result:\n", res.stdout)
if res.stderr:
    print("Direct yt-dlp stderr:\n", res.stderr)
