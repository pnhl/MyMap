import hashlib, importlib.util, pathlib, plistlib, struct, tempfile, unittest, zipfile, json
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('verify',pathlib.Path(__file__).resolve().parent.parent/'scripts/verify-artifacts.py');verify=importlib.util.module_from_spec(spec);spec.loader.exec_module(verify)
class IpaValidation(unittest.TestCase):
    def fixture(self,changes=None,extra=None):
        inputs={**verify.RELEASE,'commit':'a'*40,'lockfileSha256':'a'*64,'publicConfigFingerprint':'b'*64,'inputsFingerprint':'c'*64,'flags':{'testAds':False}}
        info={'CFBundleIdentifier':verify.RELEASE['applicationId'],'CFBundleShortVersionString':verify.RELEASE['version'],'CFBundleVersion':str(verify.RELEASE['build']),'UIBackgroundModes':['location','audio','processing','remote-notification'],'GADApplicationIdentifier':'ca-app-pub-1234567890123456~1234567890','MyMapReleaseInputs':inputs}
        for key in ['NSCameraUsageDescription','NSMicrophoneUsageDescription','NSPhotoLibraryUsageDescription','NSLocationWhenInUseUsageDescription','NSLocationAlwaysUsageDescription','NSLocationAlwaysAndWhenInUseUsageDescription','NSMotionUsageDescription','NSFaceIDUsageDescription']:info[key]='MyMap dùng chức năng này khi bạn yêu cầu.'
        info.update(changes or {});folder=tempfile.TemporaryDirectory();self.addCleanup(folder.cleanup);path=pathlib.Path(folder.name)/'app.ipa'
        with zipfile.ZipFile(path,'w')as z:
            z.writestr('Payload/MyMap.app/Info.plist',plistlib.dumps(info))
            for name,data in (extra or {}).items():z.writestr(name,data)
        return path
    def test_unsigned_does_not_pass_as_signed(self):
        with self.assertRaisesRegex(ValueError,'provisioning'):verify.ipa(self.fixture())
        self.assertTrue(verify.ipa(self.fixture(),True)['unsigned'])
    def test_widget_preview_and_debug_dylibs_fail(self):
        for suffix in ['ExpoWidgetsTarget.debug.dylib','__preview.dylib']:
            with self.subTest(suffix=suffix),self.assertRaisesRegex(ValueError,'Debug/preview'):verify.ipa(self.fixture(extra={'Payload/MyMap.app/PlugIns/Widget.appex/'+suffix:b''}),True)
    def test_real_ads_and_vietnamese_purpose_required(self):
        for change in [{'GADApplicationIdentifier':'ca-app-pub-3940256099942544~1458002511'},{'NSLocationAlwaysUsageDescription':'Allow location access'}]:
            with self.subTest(change=change),self.assertRaises(ValueError):verify.ipa(self.fixture(change),True)
    def test_extension_version_and_dev_endpoints_fail(self):
        extension={'CFBundleShortVersionString':verify.RELEASE['version'],'CFBundleVersion':'23'}
        with self.assertRaisesRegex(ValueError,'target version'):verify.ipa(self.fixture(extra={'Payload/MyMap.app/PlugIns/Widget.appex/Info.plist':plistlib.dumps(extension)}),True)
        with self.assertRaisesRegex(ValueError,'development route'):verify.ipa(self.fixture(extra={'Payload/MyMap.app/main.jsbundle':b'fetch("http://localhost:8081/index.bundle")'}),True)
class AmazonAdMobValidation(unittest.TestCase):
    def validate(self, extra='', app_id=True):
        folder=tempfile.TemporaryDirectory();self.addCleanup(folder.cleanup);apk=pathlib.Path(folder.name)/'amazon.apk'
        header=bytearray(128);header[:8]=bytes.fromhex('c61fbc03c103191f')
        struct.pack_into('<I',header,8,98);struct.pack_into('<I',header,32,160);struct.pack_into('<I',header,40,1)
        bundle=bytes(header)+b'\x00'*12;bundle+=hashlib.sha1(bundle).digest()
        with zipfile.ZipFile(apk,'w') as archive:
            archive.writestr('assets/index.android.bundle',bundle)
            archive.writestr('assets/mymap-release-inputs.json',json.dumps({**verify.RELEASE,'commit':'a'*40,'lockfileSha256':'a'*64,'publicConfigFingerprint':'b'*64,'inputsFingerprint':'c'*64,'flags':{'testAds':False}}))
            for rule in ['mymap_backup_rules','mymap_data_extraction_rules']:archive.writestr('res/xml/'+rule+'.xml',b'fixture')
        badging=f"package: name='{verify.RELEASE['applicationId']}' versionCode='{verify.RELEASE['build']}' versionName='{verify.RELEASE['version']}'"
        manifest='android:allowBackup=false\nandroid:fullBackupContent(0x010104eb)=@0x7f16000a\nandroid:dataExtractionRules(0x0101063e)=@0x7f16000b\n'+extra
        if app_id:manifest+=' com.google.android.gms.ads.APPLICATION_ID ca-app-pub-9161074667002246~7998118867'
        def command(args):
            if args[0]=='apksigner':return 'Signer #1 certificate SHA-256 digest: '+'a'*64
            if 'resources' in args:return 'resource 0x7f16000a xml/mymap_backup_rules\n  () (file) res/xml/mymap_backup_rules.xml type=XML\nresource 0x7f16000b xml/mymap_data_extraction_rules\n  () (file) res/xml/mymap_data_extraction_rules.xml type=XML\n'
            if 'res/xml/' in ' '.join(args):return 'exclude database sharedpref root file external'
            return badging if 'badging' in args else manifest
        with patch.object(verify,'android_tool',side_effect=lambda name:name),patch.object(verify,'command',side_effect=command),patch.object(verify,'dex_startup',return_value=[]),patch.object(verify,'native_libraries',return_value=['arm64-v8a']):
            return verify.apk(apk,'amazon')
    def test_amazon_disables_ads_by_default(self):
        self.assertEqual(self.validate()['store'],'amazon')
        self.assertEqual(self.validate(app_id=False)['store'],'amazon')
    def test_amazon_rejects_fcm_and_mobile_ads_initializer(self):
        with self.assertRaisesRegex(ValueError,'Google-only component'):self.validate('FirebaseMessagingService')
        with self.assertRaisesRegex(ValueError,'Google-only component'):self.validate('GoogleMobileAdsInitProvider')

class OptimizedBackupRules(unittest.TestCase):
    def validate(self, manifest=None, rules=None, omit_file=False):
        folder=tempfile.TemporaryDirectory();self.addCleanup(folder.cleanup);apk=pathlib.Path(folder.name)/'optimized.apk'
        with zipfile.ZipFile(apk,'w') as archive:
            archive.writestr('res/F3.xml',b'fixture')
            if not omit_file:archive.writestr('res/Bd.xml',b'fixture')
        resources='resource 0x7f16000a xml/mymap_backup_rules\n  () (file) res/F3.xml type=XML\nresource 0x7f16000b xml/mymap_data_extraction_rules\n  () (file) res/Bd.xml type=XML\n'
        manifest=manifest if manifest is not None else 'android:fullBackupContent(0x010104eb)=@0x7f16000a\nandroid:dataExtractionRules(0x0101063e)=@0x7f16000b\n'
        def command(args):return resources if 'resources' in args else rules if rules is not None else 'exclude database sharedpref root file external'
        with zipfile.ZipFile(apk) as archive,patch.object(verify,'android_tool',return_value='aapt2'),patch.object(verify,'command',side_effect=command):verify.apk_backup_rules(apk,manifest,archive)
    def test_accepts_shortened_paths_referenced_by_manifest(self):self.validate()
    def test_rejects_unreferenced_or_missing_backup_xml(self):
        with self.assertRaisesRegex(ValueError,'Manifest does not reference'):self.validate(manifest='android:fullBackupContent=@0x7f160099')
        with self.assertRaisesRegex(ValueError,'Missing packaged backup rule'):self.validate(omit_file=True)
    def test_rejects_backup_rules_without_private_data_exclusions(self):
        with self.assertRaisesRegex(ValueError,'does not exclude private data'):self.validate(rules='exclude database')

if __name__=='__main__':unittest.main()
