import time
import subprocess
from gradio_client import Client, handle_file

# Create 5s test wav
subprocess.run(['ffmpeg', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=5', '-ar', '44100', '-ac', '2', '/tmp/test5s.wav'], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

spaces = [
    "DelinaresMassates/UVR5_UI",
    "stdz/UVR5_UI",
    "stdz/UVR5_UI_2",
    "DilshanIRU/UVR5_UI",
    "teogabriel/UVR5-UI",
    "Erickeee/UVR5_UI",
    "AZG1/UVR5_UI",
    "rhuanpagano/UVR5_UI",
    "DannyMiko/UVR5_UI",
    "Heisenbergerer/UVR5_UI",
    "Kremixes/UVR5_UI",
    "Iwidjwj/UVR5_UI",
    "fasooo/UVR5_UI",
    "TheStinger/UVR5_UI",
    "itsalboushi/UVR5_UI",
    "NeoPy/UVR5-UI",
    "B3XN/UVR5_UI"
]

print("Scanning spaces for instant response...")
for s in spaces:
    t0 = time.time()
    try:
        c = Client(s, download_files=False)
        # Check endpoint
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
        # Wait up to 15s
        res = job.result(timeout=15)
        print(f"✅ {s}: SUCCESS in {time.time()-t0:.1f}s -> {res}")
    except Exception as e:
        err = str(e)
        if "Timeout" in err or "timed out" in err:
            print(f"❌ {s}: TIMEOUT (>15s)")
        else:
            print(f"❌ {s}: {err[:80]}")
