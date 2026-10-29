import time
import os
import shutil
import subprocess
from gradio_client import Client, handle_file

print('Converting Mafesh Mane3 to clean WAV...')
m4a_path = '/home/ubuntu/rivo/uploads/audio-cache/tvs07IkIJYY.m4a'
wav_path = '/tmp/mafesh_mane3.wav'
subprocess.run(['ffmpeg', '-y', '-i', m4a_path, '-ar', '44100', '-ac', '2', wav_path], check=True)

print('Connecting to B3XN/UVR5_UI...')
t0 = time.time()
c = Client('B3XN/UVR5_UI')

print('Submitting Mafesh Mane3 to Kim_Vocal_2.onnx...')
job = c.submit(
    audio=handle_file(wav_path),
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

res = job.result(timeout=180)
print(f'Done in {time.time()-t0:.1f}s!')
print('Result:', res)
vocal_file = res[0] if isinstance(res, (list, tuple)) else res
if vocal_file and os.path.exists(vocal_file):
    target = '/home/ubuntu/rivo/uploads/stems/vocal_6ab6b39ac0d36fb4cc1136ae.mp3'
    shutil.copyfile(vocal_file, target)
    print(f'Successfully created {target}! Size: {os.path.getsize(target)} bytes')
    # Link other aliases
    aliases = ['6aad8de0a3d7013ad9c77612', '6ae1093d00c578dfdadf7b4f', 'tvs07IkIJYY']
    for a in aliases:
        dest = f'/home/ubuntu/rivo/uploads/stems/vocal_{a}.mp3'
        try:
            shutil.copyfile(target, dest)
            print(f'Linked alias: {dest}')
        except Exception as e:
            print(f'Alias err: {e}')
