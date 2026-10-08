import json
try:
    with open('/root/fivemModes/api/data/codes.json', 'r') as f:
        json.load(f)
    print("JSON is valid")
except Exception as e:
    print(f"JSON Error: {e}")
