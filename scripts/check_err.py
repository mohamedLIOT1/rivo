import time
from gradio_client import Client, handle_file

for s in ['B3XN/UVR5_UI', 'stdz/UVR5_UI', 'fasooo/UVR5_UI']:
    try:
        print(f"Testing {s}...")
        c = Client(s)
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
        res = job.result(timeout=20)
        print(f"SUCCESS {s}: {res}")
    except Exception as e:
        print(f"ERROR {s}: {type(e).__name__}: {e}")
