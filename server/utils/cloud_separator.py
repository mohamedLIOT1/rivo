import sys
import os
import time
import shutil
import subprocess

# Enable UTF-8 output
sys.stdout.reconfigure(encoding='utf-8')

def main():
    if len(sys.argv) < 3:
        print("Usage: python cloud_separator.py <input_audio_path> <output_mp3_path>")
        sys.exit(1)

    input_audio = sys.argv[1]
    output_mp3 = sys.argv[2]
    token = os.environ.get("HF_TOKEN")

    if not os.path.exists(input_audio):
        print(f"Error: input file '{input_audio}' not found")
        sys.exit(1)

    print(f"[CloudSeparator] Starting vocal separation for: {input_audio}")
    t0 = time.time()

    from gradio_client import Client, handle_file

    # List of cloud UVR5 spaces to try in priority order:
    # 1. Fast GPU spaces (instant if token or quota available)
    # 2. Unlimited CPU-basic spaces (no ZeroGPU quota limit)
    spaces = [
        "TheStinger/UVR5_UI",
        "itsalboushi/UVR5_UI",
        "NeoPy/UVR5-UI",
        "B3XN/UVR5_UI",
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
        "fasooo/UVR5_UI"
    ]

    last_error = None
    for space_id in spaces:
        try:
            print(f"[CloudSeparator] Connecting to space: {space_id}...")
            client = Client(space_id, token=token)

            print(f"[CloudSeparator] Submitting job to {space_id} with Kim_Vocal_2.onnx...")
            result = client.predict(
                audio=handle_file(input_audio),
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

            # result is tuple: (vocal_path, inst_path)
            vocal_stem = result[0] if isinstance(result, (list, tuple)) else result
            if vocal_stem and os.path.exists(vocal_stem) and os.path.getsize(vocal_stem) > 10000:
                os.makedirs(os.path.dirname(os.path.abspath(output_mp3)), exist_ok=True)
                shutil.copyfile(vocal_stem, output_mp3)
                elapsed = time.time() - t0
                print(f"[CloudSeparator] SUCCESS on {space_id} in {elapsed:.1f}s -> {output_mp3}")
                sys.exit(0)
            else:
                raise Exception(f"Invalid output from {space_id}: {result}")

        except Exception as e:
            err_str = str(e)
            print(f"[CloudSeparator] Failed on {space_id}: {err_str}")
            last_error = e
            continue

    print(f"[CloudSeparator] All cloud spaces failed. Last error: {last_error}")

    # Fallback to local high-performance VR model if available on server
    vr_model = "/tmp/audio-separator-models/3_HP-Vocal-UVR.pth"
    if os.path.exists(vr_model):
        try:
            print(f"[CloudSeparator] Falling back to local VR architecture model: {vr_model}")
            out_dir = os.path.dirname(os.path.abspath(output_mp3))
            tmp_sep_dir = os.path.join(out_dir, f"tmp_vr_{int(time.time())}")
            os.makedirs(tmp_sep_dir, exist_ok=True)

            cmd = [
                "audio-separator",
                "-m", "3_HP-Vocal-UVR.pth",
                "--single_stem", "Vocals",
                "--output_format", "MP3",
                "--output_dir", tmp_sep_dir,
                input_audio
            ]
            subprocess.run(cmd, check=True, timeout=300)

            # Look for generated vocal file in tmp_sep_dir
            for f in os.listdir(tmp_sep_dir):
                if f.endswith(".mp3") and "Vocals" in f:
                    generated_vocal = os.path.join(tmp_sep_dir, f)
                    if os.path.getsize(generated_vocal) > 10000:
                        shutil.copyfile(generated_vocal, output_mp3)
                        shutil.rmtree(tmp_sep_dir, ignore_errors=True)
                        print(f"[CloudSeparator] SUCCESS via local VR model -> {output_mp3}")
                        sys.exit(0)
            shutil.rmtree(tmp_sep_dir, ignore_errors=True)
        except Exception as local_err:
            print(f"[CloudSeparator] Local VR separation fallback failed: {local_err}")

    sys.exit(2)

if __name__ == "__main__":
    main()
