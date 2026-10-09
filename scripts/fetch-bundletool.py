import hashlib, pathlib, urllib.request
version='1.18.3'
expected='a099cfa1543f55593bc2ed16a70a7c67fe54b1747bb7301f37fdfd6d91028e29'
target=pathlib.Path(__file__).resolve().parent.parent/'.local/bundletool.jar'
target.parent.mkdir(parents=True,exist_ok=True)
if not target.exists() or hashlib.sha256(target.read_bytes()).hexdigest()!=expected:
    data=urllib.request.urlopen(f'https://github.com/google/bundletool/releases/download/{version}/bundletool-all-{version}.jar',timeout=120).read()
    if hashlib.sha256(data).hexdigest()!=expected: raise SystemExit('bundletool checksum mismatch')
    target.write_bytes(data)
print('Verified bundletool '+version)
