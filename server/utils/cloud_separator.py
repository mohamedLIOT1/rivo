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

    print(f"[CloudSeparator] Starting studio-grade vocal purification for: {input_audio}")
    t0 = time.time()
    
    work_dir = os.path.join(os.path.dirname(os.path.abspath(output_mp3)), "tmp_proc")
    os.makedirs(work_dir, exist_ok=True)
    pid = os.getpid()

    from gradio_client import Client, handle_file

    print_progress(10, "Connecting to neural isolation engine...")
    try:
        client = Client("csukuangfj/music-source-separation", token=token)
        print_progress(30, "Separating vocal & instrumental stems via Neural Net...")
        job = client.submit(
            in_filename=handle_file(input_audio),
            api_name='/process_uploaded_file'
        )
        result = job.result(timeout=100)
        raw_vocals = result[0]
        raw_accomp = result[1]
        print(f"[DEBUG] Raw stems extracted in {time.time()-t0:.1f}s")
    except Exception as e:
        print(f"Error during neural separation: {e}")
        sys.exit(1)

    # Step 2: High-Precision Spectral Gating via noisereduce
    print_progress(65, "Eliminating instrumental bleed via spectral gating...")
    temp_gated_wav = os.path.join(work_dir, f"gated_{pid}.wav")
    try:
        import soundfile as sf
        import numpy as np
        import noisereduce as nr

        t1 = time.time()
        v_data, sr = sf.read(raw_vocals)
        a_data, _ = sf.read(raw_accomp)

        prop = 0.85  # High-strength instrumental cancellation
        if len(v_data.shape) > 1 and v_data.shape[1] == 2:
            clean_l = nr.reduce_noise(y=v_data[:, 0], y_noise=a_data[:, 0], sr=sr, prop_decrease=prop, stationary=False, n_jobs=1)
            clean_r = nr.reduce_noise(y=v_data[:, 1], y_noise=a_data[:, 1], sr=sr, prop_decrease=prop, stationary=False, n_jobs=1)
            v_clean = np.column_stack([clean_l, clean_r])
        else:
            v_clean = nr.reduce_noise(y=v_data, y_noise=a_data, sr=sr, prop_decrease=prop, stationary=False, n_jobs=1)

        sf.write(temp_gated_wav, v_clean, sr, subtype='PCM_16')
        print(f"[DEBUG] Spectral gating finished in {time.time()-t1:.1f}s")
        filter_input = temp_gated_wav
    except Exception as nr_err:
        print(f"[WARN] Spectral gating fallback: {nr_err}")
        filter_input = raw_vocals

    # Step 3: Studio Acoustic Filter & Noise Gate via FFmpeg
    # highpass=f=85 cuts sub-bass / 808 thuds / low rumble
    # lowpass=f=12500 cuts cymbal sizzle / splash
    # agate: downward audio gate mutes any quiet background bleed between vocal phrases
    print_progress(88, "Applying dynamic audio gate & bandpass purification...")
    t2 = time.time()
    os.makedirs(os.path.dirname(os.path.abspath(output_mp3)), exist_ok=True)
    
    filter_chain = "highpass=f=85,lowpass=f=12500,agate=threshold=-32dB:ratio=2.5:attack=12:release=120,volume=1.2"
    conv_cmd = [
        "ffmpeg", "-y", "-i", filter_input,
        "-af", filter_chain,
        "-c:a", "libmp3lame", "-b:a", "256k",
        output_mp3
    ]
    subprocess.run(conv_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
    print(f"[DEBUG] FFmpeg filter finished in {time.time()-t2:.1f}s")

    # Clean intermediate files
    try:
        if os.path.exists(temp_gated_wav):
            os.remove(temp_gated_wav)
    except:
        pass

    print_progress(100, "Vocal purification complete!")
    print(f"[CloudSeparator] Output ready: {output_mp3} ({os.path.getsize(output_mp3)} bytes, {time.time()-t0:.1f}s)")

if __name__ == '__main__':
    main()
