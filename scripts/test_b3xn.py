import sys
from gradio_client import Client

print("Testing B3XN/UVR5_UI...")
try:
    c = Client('B3XN/UVR5_UI')
    print("Loaded B3XN successfully! Endpoints:")
    print(c.view_api())
except Exception as e:
    print("Error:", e)
