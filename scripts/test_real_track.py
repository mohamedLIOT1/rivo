import time
from gradio_client import Client, handle_file

print("Testing csukuangfj on full track FKqniWkaiA4.m4a (159 seconds)...")
t0 = time.time()
try:
    c = Client("csukuangfj/music-source-separation")
    job = c.submit(
        in_filename=handle_file("/home/ubuntu/rivo/uploads/audio-cache/FKqniWkaiA4.m4a"),
        api_name='/process_uploaded_file'
    )
    res = job.result(timeout=120)
    print(f"SUCCESS on csukuangfj in {time.time()-t0:.1f}s:", res)
except Exception as e:
    print(f"Error: {e}")
