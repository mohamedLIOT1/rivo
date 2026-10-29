from gradio_client import Client

for space in ["hugging-apps/bs-roformer-leap-audio-separator", "csukuangfj/music-source-separation"]:
    try:
        c = Client(space)
        print(f"=== {space} API ===")
        print(c.view_api())
    except Exception as e:
        print("Error:", e)
