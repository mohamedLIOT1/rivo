from gradio_client import Client

for space in ["samx81/Mel-Band-Roformer", "teamup-tech/BS-RoFormer", "csukuangfj/music-source-separation"]:
    try:
        c = Client(space)
        print(f"Space {space} is OK!")
    except Exception as e:
        print(f"Space {space} error: {e}")
