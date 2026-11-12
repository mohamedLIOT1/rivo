import sys
from gradio_client import Client
try:
    c = Client("TheStinger/UVR5_UI")
    api = c.view_api(return_format="dict")
    ep = api.get('named_endpoints', {}).get('/mdxnet_separator', {})
    print("PARAMETERS:")
    for param in ep.get('parameters', []):
        print(param.get('parameter_name'), param.get('type'), param.get('parameter_has_default'), param.get('parameter_default'))
    print("RETURNS:")
    for ret in ep.get('returns', []):
        print(ret.get('label'), ret.get('type'))
except Exception as e:
    print("Error:", e)
