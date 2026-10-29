import time
from gradio_client import Client, handle_file

print("Starting B3XN test with 120s timeout...")
t0 = time.time()
c = Client("B3XN/UVR5_UI")
job = c.submit(
    audio=handle_file('/tmp/test5s.wav'),
    model='Kim_Vocal_2.onnx',
    out_format='mp3',
    hop_length=1024,
    segment_size=256,
    denoise=True,
    overlap=0.25,
    batch_size=1,
    norm_thresh=0.9,
    amp_thresh=0.7,
    single_stem='Vocals',
    api_name='/mdxnet_separator'
)
res = job.result(timeout=120)
print(f"SUCCESS in {time.time()-t0:.1f}s: {res}")
