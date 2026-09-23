import requests, json
try:
    resp = requests.post("http://127.0.0.1:8000/api/graph/analyze", json={
        "text": "Subhash Chandra moves NCLAT against NCLT stay on alienation of assets in 6.5 crore repayment plan. Justice Yogesh Khanna and Barun Mitra heard the matter.",
        "title": "Test Story"
    }, timeout=15)
    print("Status:", resp.status_code)
    if resp.status_code == 200:
        d = resp.json()
        print("Nodes:", [n["label"] for n in d.get("nodes", [])])
        print("Edges:", len(d.get("edges", [])))
except Exception as e:
    print("Error:", e)
