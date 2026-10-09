"""Fail closed on release provenance, manifest, permissions and embedded JS parity."""
import argparse, hashlib, json, os, pathlib, plistlib, re, subprocess, tempfile, zipfile
ROOT = pathlib.Path(__file__).resolve().parent.parent
RELEASE = json.loads((ROOT / 'release.json').read_text())
ANDROID_NS = '{http://schemas.android.com/apk/res/android}'

def require(value, message):
    if not value: raise ValueError(message)

def command(args):
    return subprocess.check_output(args, text=True, stderr=subprocess.STDOUT)

def android_tool(name):
    if os.environ.get(name.upper()): return os.environ[name.upper()]
    sdk = os.environ.get('ANDROID_HOME') or os.environ.get('ANDROID_SDK_ROOT')
    if not sdk and os.name == 'nt': sdk = str(pathlib.Path(os.environ['LOCALAPPDATA']) / 'Android/Sdk')
    candidates = sorted(pathlib.Path(sdk or '/missing').glob('build-tools/*/' + name + ('.exe' if os.name == 'nt' and name == 'aapt2' else '.bat' if os.name == 'nt' else '')), reverse=True)
    require(candidates, 'Set ANDROID_HOME or ' + name.upper())
    return str(candidates[0])

def apk(path, store):
    aapt = android_tool('aapt2')
    badging = command([aapt, 'dump', 'badging', str(path)])
    match = re.search(r"package: name='([^']+)' versionCode='(\d+)' versionName='([^']+)'", badging)
    require(match and match.groups() == (RELEASE['applicationId'], str(RELEASE['build']), RELEASE['version']), 'APK version/package mismatch: ' + path.name)
    tree = command([aapt, 'dump', 'xmltree', str(path), '--file', 'AndroidManifest.xml'])
    require('application-debuggable' not in badging and not re.search(r'android:debuggable.*(?:0xffffffff|true)', tree), 'APK is debuggable')
    require(re.search(r'android:allowBackup.*(?:0x0\b|false)', tree), 'APK backup must be disabled')
    require('mymap_data_extraction_rules' in tree or 'android:dataExtractionRules' in tree, 'Missing device-transfer exclusion rules')
    permissions = set(re.findall(r"uses-permission(?:-sdk-\d+)?: name='([^']+)'", badging))
    policy = json.loads((ROOT / 'config/android-permissions.json').read_text())
    allowed = set(policy['common']) | set(policy[store]) | {RELEASE['applicationId'] + '.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION'}
    require(not permissions - allowed, 'Unexpected permissions: ' + ', '.join(sorted(permissions - allowed)))
    require('3940256099942544~' not in tree, 'Google sample AdMob app ID in release')
    if store == 'amazon':
        for component in ['RNGoogleSignin', 'GoogleMobileAdsInitProvider', 'ExpoFirebaseMessagingService', 'FirebaseMessagingService', 'FirebaseInstanceIdReceiver', 'MyMapCarService']:
            require(component not in tree, 'Amazon contains Google-only component: ' + component)
        require(not any('car.app' in p or 'aicore' in p.lower() or 'AD_ID' in p for p in permissions), 'Amazon Google-only permissions')
    else:
        require('com.google.android.gms.ads.APPLICATION_ID' in tree, 'Google release lacks AdMob application ID')
    command([android_tool('apksigner'), 'verify', '--verbose', str(path)])
    with zipfile.ZipFile(path) as archive:
        bundle = archive.read('assets/index.android.bundle')
    return {'store':store, 'file':path.name, 'sha256':hashlib.sha256(path.read_bytes()).hexdigest(), 'jsSha256':hashlib.sha256(bundle).hexdigest(), 'permissions':sorted(permissions)}

def ipa(path, unsigned=False):
    with zipfile.ZipFile(path) as archive:
        names = archive.namelist()
        require(not any(n.endswith('.debug.dylib') or pathlib.PurePosixPath(n).name == '__preview.dylib' for n in names), 'Debug/preview dylib in IPA')
        main = next((n for n in names if re.match(r'^Payload/[^/]+\.app/Info.plist$', n)), None)
        require(main, 'IPA has no main Info.plist')
        plists = [n for n in names if n.endswith('/Info.plist') and (n == main or '.appex/' in n or '/Watch/' in n)]
        for name in plists:
            info = plistlib.loads(archive.read(name))
            require(info.get('CFBundleShortVersionString') == RELEASE['version'] and str(info.get('CFBundleVersion')) == str(RELEASE['build']), 'iOS target version mismatch: ' + name)
        info = plistlib.loads(archive.read(main))
        require(info.get('CFBundleIdentifier') == RELEASE['applicationId'], 'Wrong iOS bundle ID')
        for key in ['NSCameraUsageDescription','NSMicrophoneUsageDescription','NSPhotoLibraryUsageDescription','NSLocationWhenInUseUsageDescription','NSLocationAlwaysUsageDescription','NSLocationAlwaysAndWhenInUseUsageDescription','NSMotionUsageDescription','NSFaceIDUsageDescription']:
            value = info.get(key, '')
            require('MyMap' in value and any(ord(c) > 127 for c in value), 'Missing Vietnamese usage description: ' + key)
        require(set(info.get('UIBackgroundModes', [])) == {'location','audio','processing'}, 'Unexpected iOS background modes')
        require(re.fullmatch(r'ca-app-pub-\d{16}~\d{10}',info.get('GADApplicationIdentifier','')) and '3940256099942544' not in info['GADApplicationIdentifier'], 'iOS release must use real AdMob application ID')
        require(unsigned or any(n.endswith('/embedded.mobileprovision') for n in names), 'Signed IPA lacks provisioning profile')
        require(not any(b'localhost:8081' in archive.read(n) or b'localhost:9999' in archive.read(n) or b'10.0.2.2' in archive.read(n) for n in names if n.endswith('.jsbundle')), 'Development endpoint in iOS JS bundle')
    return {'store':'ios', 'file':path.name, 'sha256':hashlib.sha256(path.read_bytes()).hexdigest(), 'unsigned':unsigned}

def aab(path):
    import xml.etree.ElementTree as ET
    jar = os.environ.get('BUNDLETOOL_JAR')
    require(jar, 'Set BUNDLETOOL_JAR to validate an AAB manifest')
    xml = command(['java', '-jar', jar, 'dump', 'manifest', '--bundle=' + str(path), '--module=base'])
    manifest = ET.fromstring(xml); app = manifest.find('application')
    require(manifest.attrib.get('package') == RELEASE['applicationId'] and manifest.attrib.get(ANDROID_NS+'versionName') == RELEASE['version'] and manifest.attrib.get(ANDROID_NS+'versionCode') == str(RELEASE['build']), 'AAB version mismatch')
    require(app is not None and app.attrib.get(ANDROID_NS+'debuggable','false') == 'false' and app.attrib.get(ANDROID_NS+'allowBackup') == 'false', 'Unsafe AAB application flags')
    permissions = {p.attrib[ANDROID_NS+'name'] for p in manifest.findall('uses-permission')}
    policy = json.loads((ROOT / 'config/android-permissions.json').read_text()); allowed=set(policy['common'])|set(policy['play'])|{RELEASE['applicationId']+'.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION'}
    require(not permissions-allowed, 'Unexpected AAB permissions: '+str(permissions-allowed))
    require('3940256099942544~' not in xml, 'Test ads in AAB')
    command(['jarsigner','-verify',str(path)])
    with zipfile.ZipFile(path) as archive: bundle=archive.read('base/assets/index.android.bundle')
    return {'store':'play-aab','file':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'jsSha256':hashlib.sha256(bundle).hexdigest()}

def main():
    p=argparse.ArgumentParser();p.add_argument('--ios',type=pathlib.Path);p.add_argument('--play',type=pathlib.Path);p.add_argument('--amazon',type=pathlib.Path);p.add_argument('--aab',type=pathlib.Path);p.add_argument('--unsigned',action='store_true');p.add_argument('--commit');p.add_argument('--complete',action='store_true');args=p.parse_args()
    require(any([args.ios,args.play,args.amazon,args.aab]), 'Provide at least one artifact')
    if args.complete: require(args.ios and args.play and args.amazon and args.aab and args.commit, 'Complete release requires all signed artifacts and source commit')
    result=[]
    if args.ios: result.append(ipa(args.ios,args.unsigned))
    if args.play: result.append(apk(args.play,'play'))
    if args.amazon: result.append(apk(args.amazon,'amazon'))
    if args.aab: result.append(aab(args.aab))
    hashes={r['jsSha256'] for r in result if 'jsSha256' in r};require(len(hashes)<=1,'Android/Amazon/AAB embedded JS bundles differ')
    output={'version':RELEASE['version'],'build':RELEASE['build'],'commit':args.commit,'artifacts':result}
    print(json.dumps(output,indent=2));(ROOT/'dist/releases').mkdir(parents=True,exist_ok=True);(ROOT/'dist/releases/verification.json').write_text(json.dumps(output,indent=2))
if __name__=='__main__':
    try: main()
    except (ValueError,subprocess.CalledProcessError,KeyError,StopIteration,zipfile.BadZipFile) as e:
        print('Release verification failed:', e);raise SystemExit(1)
