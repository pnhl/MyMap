"""Fail closed on release provenance, manifest, permissions and embedded JS parity."""
import argparse, hashlib, json, os, pathlib, plistlib, re, subprocess, tempfile, zipfile, sys
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parent))
from artifact_checks import dex_startup, native_libraries, classify_dev_strings, embedded_inputs, archive_dev_strings
from provider_secrets import scan_path
ROOT = pathlib.Path(__file__).resolve().parent.parent
RELEASE = json.loads((ROOT / 'release.json').read_text())
ANDROID_NS = '{http://schemas.android.com/apk/res/android}'

def require(value, message):
    if not value: raise ValueError(message)

def command(args):
    return subprocess.check_output(args, text=True, stderr=subprocess.STDOUT)

def verify_provenance(path,inputs,commit):
    if not commit:return
    sidecar=pathlib.Path(str(path)+'.provenance.json')
    require(sidecar.exists(),'Missing artifact provenance sidecar: '+path.name)
    value=json.loads(sidecar.read_text())
    for key in ['commit','lockfileSha256','inputsFingerprint','publicConfigFingerprint']:
        require(value.get(key)==inputs[key],'Provenance disagrees with embedded inputs: '+key)

def android_tool(name):
    if os.environ.get(name.upper()): return os.environ[name.upper()]
    sdk = os.environ.get('ANDROID_HOME') or os.environ.get('ANDROID_SDK_ROOT')
    if not sdk and os.name == 'nt': sdk = str(pathlib.Path(os.environ['LOCALAPPDATA']) / 'Android/Sdk')
    candidates = sorted(pathlib.Path(sdk or '/missing').glob('build-tools/*/' + name + ('.exe' if os.name == 'nt' and name in ('aapt2','zipalign') else '.bat' if os.name == 'nt' else '')), reverse=True)
    require(candidates, 'Set ANDROID_HOME or ' + name.upper())
    return str(candidates[0])

def apk_backup_rules(path, manifest, archive):
    # AAPT2 shortens packaged paths (e.g. res/F3.xml). Resolve the named
    # resource and its manifest reference rather than assuming its ZIP path.
    resources = command([android_tool('aapt2'), 'dump', 'resources', str(path)])
    for rule, attribute in [('mymap_backup_rules', 'fullBackupContent'), ('mymap_data_extraction_rules', 'dataExtractionRules')]:
        match = re.search(r'\bresource (0x[0-9a-fA-F]+) (?:[\w.]+:)?xml/' + rule + r'\s*\n([\s\S]*?)(?=\n\s*resource 0x|\Z)', resources)
        require(match, 'Missing packaged backup resource: ' + rule)
        require(re.search(r'android:' + attribute + r'[^\n=]*=@' + re.escape(match[1]) + r'\b', manifest), 'Manifest does not reference backup resource: ' + rule)
        filenames = set(re.findall(r'\(file\) (res/[^\s]+\.xml)\s+type=XML', match[2]))
        require(filenames, 'Backup resource has no XML file: ' + rule)
        for filename in filenames:
            require(filename in archive.namelist(), 'Missing packaged backup rule: ' + rule)
            rules = command([android_tool('aapt2'), 'dump', 'xmltree', str(path), '--file', filename])
            require('exclude' in rules and all(domain in rules for domain in ['database','sharedpref','root','file','external']), 'Backup rule does not exclude private data: ' + rule)

def apk(path, store, commit=None):
    credentials=scan_path(path)
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
    with zipfile.ZipFile(path) as archive:
        inputs=embedded_inputs(archive.read('assets/mymap-release-inputs.json'),RELEASE,commit)
    if store=='amazon' and inputs['flags'].get('adm'):allowed|=set(policy['adm'])
    require(not permissions - allowed, 'Unexpected permissions: ' + ', '.join(sorted(permissions - allowed)))
    require('3940256099942544~' not in tree, 'Google sample AdMob app ID in release')
    if store == 'amazon':
        for component in ['RNGoogleSignin', 'GoogleMobileAdsInitProvider', 'MobileAdsInitProvider', 'ExpoFirebaseMessagingService', 'FirebaseMessagingService', 'FirebaseInstanceIdReceiver', 'FirebaseMessagingRegistrar', 'FirebaseMessagingKtxRegistrar', 'MyMapCarService']:
            require(component not in tree, 'Amazon contains Google-only component: ' + component)
        require(not any('car.app' in p or 'aicore' in p.lower() or 'AD_ID' in p for p in permissions), 'Amazon Google-only permissions')
    if store=='play':require('com.google.android.gms.ads.APPLICATION_ID' in tree, 'Android release lacks AdMob application ID')
    signature = command([android_tool('apksigner'), 'verify', '--verbose', '--print-certs', str(path)])
    require('CN=Android Debug' not in signature, 'APK uses the Android debug signing certificate')
    cert = re.search(r'Signer #1 certificate SHA-256 digest: ([a-fA-F0-9]+)', signature)
    require(cert, 'APK lacks a verifiable signer certificate')
    with zipfile.ZipFile(path) as archive:
        bundle = archive.read('assets/index.android.bundle')
        require(bundle.startswith(bytes.fromhex('c61fbc03c103191f')),'Android release lacks Hermes bytecode')
        inputs=embedded_inputs(archive.read('assets/mymap-release-inputs.json'),RELEASE,commit)
        dex=dex_startup(archive);abis=native_libraries(archive);dev=archive_dev_strings(archive)
        apk_backup_rules(path, tree, archive)
    command([android_tool('zipalign'),'-c','-P','16','4',str(path)])
    verify_provenance(path,inputs,commit)
    return {'store':store, 'file':path.name, 'sha256':hashlib.sha256(path.read_bytes()).hexdigest(), 'jsSha256':hashlib.sha256(bundle).hexdigest(), 'signerSha256':cert.group(1).lower(), 'permissions':sorted(permissions),'inputs':inputs,'abis':abis,'startup':dex,'devStrings':dev,'providerCredentials':credentials}

def ipa(path, unsigned=False, commit=None):
    credentials=scan_path(path)
    with zipfile.ZipFile(path) as archive:
        names = archive.namelist()
        require(not any(n.endswith('.debug.dylib') or pathlib.PurePosixPath(n).name == '__preview.dylib' for n in names), 'Debug/preview dylib in IPA')
        main = next((n for n in names if re.match(r'^Payload/[^/]+\.app/Info.plist$', n)), None)
        require(main, 'IPA has no main Info.plist')
        plists = [n for n in names if re.search(r'\.(?:app|appex)/Info\.plist$',n)]
        for name in plists:
            info = plistlib.loads(archive.read(name))
            require(info.get('CFBundleShortVersionString') == RELEASE['version'] and str(info.get('CFBundleVersion')) == str(RELEASE['build']), 'iOS target version mismatch: ' + name)
        info = plistlib.loads(archive.read(main))
        require(info.get('CFBundleIdentifier') == RELEASE['applicationId'], 'Wrong iOS bundle ID')
        for key in ['NSCameraUsageDescription','NSMicrophoneUsageDescription','NSPhotoLibraryUsageDescription','NSLocationWhenInUseUsageDescription','NSLocationAlwaysUsageDescription','NSLocationAlwaysAndWhenInUseUsageDescription','NSMotionUsageDescription','NSFaceIDUsageDescription']:
            value = info.get(key, '')
            require('MyMap' in value and any(ord(c) > 127 for c in value), 'Missing Vietnamese usage description: ' + key)
        require(set(info.get('UIBackgroundModes', [])) == {'location','audio','processing','remote-notification'}, 'Unexpected iOS background modes')
        require(re.fullmatch(r'ca-app-pub-\d{16}~\d{10}',info.get('GADApplicationIdentifier','')) and '3940256099942544' not in info['GADApplicationIdentifier'], 'iOS release must use real AdMob application ID')
        require(unsigned or any(n.endswith('/embedded.mobileprovision') for n in names), 'Signed IPA lacks provisioning profile')
        inputs=embedded_inputs(json.dumps(info.get('MyMapReleaseInputs',{})),RELEASE,commit)
        if inputs['flags'].get('watch'):require(any('/Watch/' in n and n.endswith('.app/Info.plist') for n in plists),'Watch target missing from IPA')
        if inputs['flags'].get('widgets'):require(any('/PlugIns/' in n and n.endswith('.appex/Info.plist') for n in plists),'Widget target missing from IPA')
        dev=archive_dev_strings(archive)
    verify_provenance(path,inputs,commit)
    signature_verified=False
    if not unsigned and sys.platform=='darwin':
        with tempfile.TemporaryDirectory(prefix='mymap-ipa-') as temporary:
            root=pathlib.Path(temporary)
            with zipfile.ZipFile(path) as archive:
                require(all((root/n).resolve().is_relative_to(root.resolve()) for n in archive.namelist()), 'Unsafe IPA archive path')
                archive.extractall(root)
                for member in archive.infolist():
                    target=root/member.filename
                    if target.is_file():target.chmod((member.external_attr>>16)&0o777 or 0o644)
            app=root/pathlib.PurePosixPath(main).parent
            command(['codesign','--verify','--deep','--strict',str(app)])
            for name in plists:
                target=root/pathlib.PurePosixPath(name).parent
                # Framework Info.plists are not app/extension targets.
                if target.suffix not in ('.app','.appex'):continue
                target_info=plistlib.loads((target/'Info.plist').read_bytes())
                require((target/'embedded.mobileprovision').exists(),'Missing per-target provisioning: '+target.name)
                profile=subprocess.check_output(['security','cms','-D','-i',str(target/'embedded.mobileprovision')],stderr=subprocess.DEVNULL)
                decoded_profile=plistlib.loads(profile);entitlements=decoded_profile.get('Entitlements',{})
                signed=plistlib.loads(subprocess.check_output(['codesign','-d','--entitlements',':-',str(target)],stderr=subprocess.DEVNULL))
                require(not entitlements.get('get-task-allow',False) and not signed.get('get-task-allow',False),'iOS development entitlement')
                require(not decoded_profile.get('ProvisionedDevices') and not decoded_profile.get('ProvisionsAllDevices'),'iOS store artifact requires App Store distribution profiles')
                require(entitlements.get('application-identifier','').endswith('.'+target_info['CFBundleIdentifier']),'iOS profile target mismatch')
                require(set(signed.get('com.apple.security.application-groups',[]))<=set(entitlements.get('com.apple.security.application-groups',[])),'App group missing from provisioning')
                if target.suffix=='.appex':require('group.com.pnhl.vibecoding' in signed.get('com.apple.security.application-groups',[]),'Widget lacks shared app group')
            signature_verified=True
        pathlib.Path(str(path)+'.signature-verification.json').write_text(json.dumps({'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'commit':inputs['commit'],'signatureVerified':True,'targets':plists}))
    elif not unsigned:
        proof=pathlib.Path(str(path)+'.signature-verification.json')
        if proof.exists():
            value=json.loads(proof.read_text())
            require(value.get('sha256')==hashlib.sha256(path.read_bytes()).hexdigest() and value.get('commit')==inputs['commit'] and value.get('targets')==plists and value.get('signatureVerified') is True,'Invalid macOS signature verification proof')
            signature_verified=True
    if commit and not unsigned:require(signature_verified,'Signed IPA needs macOS signing verification or its matching proof')
    return {'store':'ios-unsigned' if unsigned else 'ios', 'file':path.name, 'sha256':hashlib.sha256(path.read_bytes()).hexdigest(), 'unsigned':unsigned, 'signatureVerified':signature_verified,'inputs':inputs,'devStrings':dev,'providerCredentials':credentials}

def wear_apk(path):
    credentials=scan_path(path)
    badging=command([android_tool('aapt2'),'dump','badging',str(path)])
    match=re.search(r"package: name='([^']+)' versionCode='(\d+)' versionName='([^']+)'",badging)
    require(match and match.groups()==(RELEASE['applicationId'],str(RELEASE['build']),RELEASE['version']),'Wear version/package mismatch')
    permissions=set(re.findall(r"uses-permission(?:-sdk-\d+)?: name='([^']+)'",badging))
    require(permissions=={'android.permission.VIBRATE'},'Unexpected Wear permissions')
    tree=command([android_tool('aapt2'),'dump','xmltree',str(path),'--file','AndroidManifest.xml'])
    require('application-debuggable' not in badging and re.search(r'android:allowBackup.*(?:0x0\b|false)',tree),'Unsafe Wear release flags')
    signature=command([android_tool('apksigner'),'verify','--verbose','--print-certs',str(path)])
    require('CN=Android Debug' not in signature,'Wear uses a debug signing certificate')
    cert=re.search(r'Signer #1 certificate SHA-256 digest: ([a-fA-F0-9]+)',signature);require(cert,'Missing Wear signer')
    return {'store':'wear','file':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'signerSha256':cert.group(1).lower(),'providerCredentials':credentials}

def aab(path, commit=None):
    credentials=scan_path(path)
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
    signing = command(['jarsigner','-verify',str(path)])
    require('jar verified.' in signing and 'jar is unsigned' not in signing.lower(), 'AAB is unsigned or its JAR signature is invalid')
    bundle_config=command(['java','-jar',jar,'dump','config','--bundle='+str(path)])
    require('PAGE_ALIGNMENT_16K' in bundle_config,'AAB does not request 16 KB page alignment')
    with zipfile.ZipFile(path) as archive:
        bundle=archive.read('base/assets/index.android.bundle')
        require(bundle.startswith(bytes.fromhex('c61fbc03c103191f')),'AAB release lacks Hermes bytecode')
        for rule in ['mymap_backup_rules','mymap_data_extraction_rules']:
            require('base/res/xml/'+rule+'.xml' in archive.namelist(),'AAB missing backup rules: '+rule)
        inputs=embedded_inputs(archive.read('base/assets/mymap-release-inputs.json'),RELEASE,commit)
        dex=dex_startup(archive,'base/dex/');abis=native_libraries(archive,'base/lib/');dev=archive_dev_strings(archive)
    verify_provenance(path,inputs,commit)
    return {'store':'play-aab','file':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'jsSha256':hashlib.sha256(bundle).hexdigest(),'inputs':inputs,'startup':dex,'abis':abis,'devStrings':dev,'providerCredentials':credentials}

def main():
    p=argparse.ArgumentParser();p.add_argument('--ios',type=pathlib.Path);p.add_argument('--ios-unsigned',type=pathlib.Path);p.add_argument('--play',type=pathlib.Path);p.add_argument('--amazon',type=pathlib.Path);p.add_argument('--wear',type=pathlib.Path);p.add_argument('--aab',type=pathlib.Path);p.add_argument('--unsigned',action='store_true');p.add_argument('--commit');p.add_argument('--complete',action='store_true');args=p.parse_args()
    require(any([args.ios,args.play,args.amazon,args.aab,args.wear]), 'Provide at least one artifact')
    if args.complete: require(args.ios and args.ios_unsigned and args.play and args.amazon and args.aab and args.commit, 'Complete release requires five artifacts and source commit')
    result=[]
    if args.ios: result.append(ipa(args.ios,args.unsigned,args.commit))
    if args.ios_unsigned: result.append(ipa(args.ios_unsigned,True,args.commit))
    if args.play: result.append(apk(args.play,'play',args.commit))
    if args.amazon: result.append(apk(args.amazon,'amazon',args.commit))
    if args.aab: result.append(aab(args.aab,args.commit))
    if args.wear: result.append(wear_apk(args.wear))
    if args.complete:require(next(r for r in result if r['store']=='ios')['signatureVerified'],'Complete release needs macOS per-target signing verification proof')
    hashes={r['jsSha256'] for r in result if 'jsSha256' in r};require(len(hashes)<=1,'Android/Amazon/AAB embedded JS bundles differ')
    # Google phone and Wear must match for Data Layer. Amazon may use its own signing identity.
    signers={r['signerSha256'] for r in result if r['store'] in ('play','wear')};require(len(signers)<=1,'Google phone and Wear signing certificates differ')
    fingerprints={r['inputs']['inputsFingerprint'] for r in result if 'inputs' in r};require(len(fingerprints)<=1,'Release inputs differ between artifacts')
    output={'version':RELEASE['version'],'build':RELEASE['build'],'commit':args.commit,'artifacts':result}
    print(json.dumps(output,indent=2));(ROOT/'dist/releases').mkdir(parents=True,exist_ok=True);(ROOT/'dist/releases/verification.json').write_text(json.dumps(output,indent=2))
if __name__=='__main__':
    try: main()
    except (ValueError,subprocess.CalledProcessError,KeyError,StopIteration,zipfile.BadZipFile) as e:
        print('Release verification failed:', e);raise SystemExit(1)
