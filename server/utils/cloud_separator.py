import sys
import os
import time
import shutil

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

    print(f"[CloudSeparator] Starting ZeroGPU cloud separation for: {input_audio}")
    t0 = time.time()

    from gradio_client import Client, handle_file

    # List of running ZeroGPU spaces to try in order
    spaces = [
        "TheStinger/UVR5_UI",
        "MohamedRashad/Audio-Separator",
        "NeoPy/UVR5-UI"
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
            print(f"[CloudSeparator] Failed on {space_id}: {e}")
            last_error = e
            continue

    print(f"[CloudSeparator] All cloud spaces failed. Last error: {last_error}")
    sys.exit(2)

if __name__ == "__main__":
    main()
