from gradio_client import Client

try:
    c = Client("teamup-tech/BS-RoFormer")
    print(c.view_api())
except Exception as e:
    print(e)
