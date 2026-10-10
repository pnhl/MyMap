import json,plistlib,re,sys,zipfile
with zipfile.ZipFile(sys.argv[1]) as archive:
    if sys.argv[1].endswith('.ipa'):
        name=next(n for n in archive.namelist() if re.fullmatch(r'Payload/[^/]+\.app/Info.plist',n))
        inputs=plistlib.loads(archive.read(name))['MyMapReleaseInputs']
    else:
        name='base/assets/mymap-release-inputs.json' if sys.argv[1].endswith('.aab') else 'assets/mymap-release-inputs.json'
        inputs=json.loads(archive.read(name))
print(json.dumps(inputs))
