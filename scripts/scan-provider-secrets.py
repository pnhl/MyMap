"""Post-build gate for Metro/Hermes bundles and APK/AAB/IPA/native directories."""
import argparse, json, pathlib, sys, zipfile
from provider_secrets import scan_path

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('paths',nargs='+',type=pathlib.Path)
    args=parser.parse_args();count=0
    for path in args.paths:
        if not path.exists(): raise ValueError('Credential scan input is missing')
        files=sorted(p for p in path.rglob('*') if p.is_file()) if path.is_dir() else [path]
        if not files: raise ValueError('Credential scan input contains no files')
        for file in files: count+=scan_path(file)['scannedFiles']
    print(json.dumps({'scannedFiles':count,'providerCredentials':0}))
if __name__=='__main__':
    try: main()
    except (ValueError,OSError,zipfile.BadZipFile):
        # No exception string: filesystem names or decoders may contain values.
        print('Provider credential scan FAILED. Remove public provider keys and credential-bearing URLs; findings are suppressed.',file=sys.stderr)
        sys.exit(1)
