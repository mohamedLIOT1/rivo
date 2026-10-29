import time
from gradio_client import Client, handle_file

print("1. Testing hugging-apps/bs-roformer-leap-audio-separator...")
t0 = time.time()
try:
    c = Client("hugging-apps/bs-roformer-leap-audio-separator")
    job = c.submit(
        audio_file=handle_file("/tmp/test_sep/sine.wav"),
        variant='Standard — Vocals',
        api_name='/separate'
    )
    res = job.result(timeout=45)
    print(f"SUCCESS on bs-roformer in {time.time()-t0:.1f}s:", res)
except Exception as e:
    print(f"Error on bs-roformer: {e}")

print("\n2. Testing csukuangfj/music-source-separation...")
t0 = time.time()
try:
    c = Client("csukuangfj/music-source-separation")
    job = c.submit(
        in_filename=handle_file("/tmp/test_sep/sine.wav"),
        api_name='/process_uploaded_file'
    )
    res = job.result(timeout=45)
    print(f"SUCCESS on csukuangfj in {time.time()-t0:.1f}s:", res)
except Exception as e:
    print(f"Error on csukuangfj: {e}")
