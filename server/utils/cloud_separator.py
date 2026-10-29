import sys
import os
import time
import shutil
import subprocess

# Enable UTF-8 output
sys.stdout.reconfigure(encoding='utf-8')

def print_progress(percent, msg):
    print(f"[PROGRESS] {percent}% {msg}", flush=True)

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

    print(f"[CloudSeparator] Starting studio-grade Kim_Vocal_2 isolation for: {input_audio}")
    t0 = time.time()

    from gradio_client import Client, handle_file

    spaces_config = [
        {
            "space": "TheStinger/UVR5_UI",
            "type": "uvr5",
            "model": "Kim_Vocal_2.onnx",
            "timeout": 75
        },
        {
            "space": "itsalboushi/UVR5_UI",
            "type": "uvr5",
            "model": "Kim_Vocal_2.onnx",
            "timeout": 75
        },
        {
            "space": "NeoPy/UVR5-UI",
            "type": "uvr5",
            "model": "Kim_Vocal_2.onnx",
            "timeout": 75
        },
        {
            "space": "teamup-tech/BS-RoFormer",
            "type": "bs_roformer",
            "model": "BS-RoFormer",
            "timeout": 90
        }
    ]

    success = False
    last_error = None

    for cfg in spaces_config:
        space_id = cfg["space"]
        space_type = cfg["type"]
        model_name = cfg["model"]
        space_timeout = cfg["timeout"]

        try:
            print_progress(15, f"Connecting to GPU cloud ({model_name})...")
            print(f"[CloudSeparator] Connecting to {space_id}...")
            client = Client(space_id, token=token)

            print_progress(40, f"Isolating pure vocals with {model_name}...")
            print(f"[CloudSeparator] Submitting audio to {space_id} ({model_name})...")

            if space_type == "uvr5":
                job = client.submit(
                    audio=handle_file(input_audio),
                    model=model_name,
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
            else:
                job = client.submit(
                    input_0=handle_file(input_audio),
                    api_name='/process'
                )

            result = job.result(timeout=space_timeout)
            vocal_stem = result[0] if isinstance(result, (list, tuple)) else result

            if vocal_stem and os.path.exists(vocal_stem) and os.path.getsize(vocal_stem) > 10000:
                print_progress(92, "Mastering 320kbps Studio Acapella...")
                os.makedirs(os.path.dirname(os.path.abspath(output_mp3)), exist_ok=True)

                # Convert to high-bitrate clean MP3
                conv_cmd = [
                    "ffmpeg", "-y", "-i", vocal_stem,
                    "-c:a", "libmp3lame", "-b:a", "320k",
                    output_mp3
                ]
                subprocess.run(conv_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)

                print_progress(100, f"Studio Acapella ready ({model_name})!")
                print(f"[CloudSeparator] Success with {model_name} via {space_id} in {time.time()-t0:.1f}s -> {output_mp3}")
                success = True
                break
            else:
                raise RuntimeError(f"Output stem invalid or missing: {vocal_stem}")

        except Exception as e:
            print(f"[CloudSeparator] Failed on {space_id}: {e}")
            last_error = e

    if not success:
        print(f"Error: All neural vocal spaces failed. Last error: {last_error}")
        sys.exit(1)

if __name__ == '__main__':
    main()
