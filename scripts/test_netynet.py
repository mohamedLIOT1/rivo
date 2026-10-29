from gradio_client import Client

try:
    c = Client("netynet/bs_roformer_uvr")
    print("API:", c.view_api())
except Exception as e:
    print("Error:", e)
