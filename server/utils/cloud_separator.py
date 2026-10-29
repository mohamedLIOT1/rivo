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

    configs = [
        {
            "space": "csukuangfj/music-source-separation",
            "type": "csukuangfj",
            "timeout": 90
        },
        {
            "space": "teamup-tech/BS-RoFormer",
            "type": "teamup",
            "timeout": 90
        },
        {
            "space": "B3XN/UVR5_UI",
            "type": "uvr5",
            "timeout": 120
        },
        {
            "space": "stdz/UVR5_UI",
            "type": "uvr5",
            "timeout": 120
        }
    ]

    last_error = None
    for cfg in configs:
        space_id = cfg["space"]
        space_type = cfg["type"]
        space_timeout = cfg["timeout"]

        try:
            print(f"[CloudSeparator] Connecting to space: {space_id}...")
            client = Client(space_id, token=token)

            print(f"[CloudSeparator] Submitting audio to {space_id} ({space_type})...")
            if space_type == "csukuangfj":
                job = client.submit(
                    in_filename=handle_file(input_audio),
                    api_name='/process_uploaded_file'
                )
            elif space_type == "teamup":
                job = client.submit(
                    input_0=handle_file(input_audio),
                    api_name='/process'
                )
            else:
                job = client.submit(
                    audio=handle_file(input_audio),
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

            result = job.result(timeout=space_timeout)
            vocal_stem = result[0] if isinstance(result, (list, tuple)) else result

            if vocal_stem and os.path.exists(vocal_stem) and os.path.getsize(vocal_stem) > 10000:
                os.makedirs(os.path.dirname(os.path.abspath(output_mp3)), exist_ok=True)
                # Ensure final output is high-bitrate MP3
                if vocal_stem.lower().endswith('.mp3'):
                    shutil.copyfile(vocal_stem, output_mp3)
                else:
                    conv_cmd = ["ffmpeg", "-y", "-i", vocal_stem, "-c:a", "libmp3lame", "-b:a", "256k", output_mp3]
                    subprocess.run(conv_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)

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
    sys.exit(2)

if __name__ == "__main__":
    main()
