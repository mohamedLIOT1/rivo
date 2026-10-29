import sys, time
from gradio_client import Client, handle_file

spaces_to_test = [
    ("csukuangfj/music-source-separation", None),
    ("Eddycrack864/UVR5-UI", "/mdxnet_separator"),
    ("iamuddeshya/UVR5_UI", "/mdxnet_separator"),
    ("qtzmusic/UVR5_UI", "/mdxnet_separator"),
    ("hugging-apps/bs-roformer-leap-audio-separator", None),
]

for space, api in spaces_to_test:
    try:
        t0 = time.time()
        print(f"Connecting to {space}...")
        c = Client(space)
        print(f"Loaded {space} in {time.time()-t0:.1f}s")
        if api:
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
                api_name=api
            )
            res = job.result(timeout=30)
            print(f"SUCCESS on {space}: {res}")
    except Exception as e:
        print(f"Error {space}: {e}")
