import sys, time
from gradio_client import Client, handle_file

print("Testing submit to TheStinger/UVR5_UI...")
t0 = time.time()
try:
    c = Client("TheStinger/UVR5_UI")
    job = c.submit(
        audio=handle_file("/tmp/test_sep/sine.wav"),
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
    res = job.result(timeout=30)
    print("SUCCESS on TheStinger in", time.time() - t0, "s:", res)
except Exception as e:
    print("TheStinger failed:", e)

print("\nTesting submit to itsalboushi/UVR5_UI...")
t0 = time.time()
try:
    c = Client("itsalboushi/UVR5_UI")
    job = c.submit(
        audio=handle_file("/tmp/test_sep/sine.wav"),
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
    res = job.result(timeout=30)
    print("SUCCESS on itsalboushi in", time.time() - t0, "s:", res)
except Exception as e:
    print("itsalboushi failed:", e)
