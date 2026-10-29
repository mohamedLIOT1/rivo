import time
import subprocess
from gradio_client import Client, handle_file

# Create 30s clip of mafesh mane3
subprocess.run(['ffmpeg', '-y', '-i', '/home/ubuntu/rivo/uploads/audio-cache/tvs07IkIJYY.m4a', '-t', '30', '-ar', '44100', '-ac', '2', '/tmp/test30s.wav'], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

c = Client('B3XN/UVR5_UI')

print("Testing B3XN with denoise=False...")
t0 = time.time()
job = c.submit(
    audio=handle_file('/tmp/test30s.wav'),
    model='Kim_Vocal_2.onnx',
    out_format='mp3',
    hop_length=1024,
    segment_size=256,
    denoise=False,
    overlap=0.25,
    batch_size=1,
    norm_thresh=0.9,
    amp_thresh=0.7,
    single_stem='Vocals',
    api_name='/mdxnet_separator'
)
res = job.result(timeout=120)
print(f"denoise=False SUCCESS in {time.time()-t0:.1f}s: {res}")
