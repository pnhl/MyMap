import importlib.util, pathlib, plistlib, tempfile, unittest, zipfile, json
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
        with zipfile.ZipFile(apk,'w') as archive:
            archive.writestr('assets/index.android.bundle',bytes.fromhex('c61fbc03c103191f')+b'shared-bundle')
            archive.writestr('assets/mymap-release-inputs.json',json.dumps({**verify.RELEASE,'commit':'a'*40,'lockfileSha256':'a'*64,'publicConfigFingerprint':'b'*64,'inputsFingerprint':'c'*64,'flags':{'testAds':False}}))
            for rule in ['mymap_backup_rules','mymap_data_extraction_rules']:archive.writestr('res/xml/'+rule+'.xml',b'fixture')
        badging=f"package: name='{verify.RELEASE['applicationId']}' versionCode='{verify.RELEASE['build']}' versionName='{verify.RELEASE['version']}'"
        manifest='android:allowBackup=false android:dataExtractionRules '+extra
        if app_id:manifest+=' com.google.android.gms.ads.APPLICATION_ID ca-app-pub-9161074667002246~7998118867'
        def command(args):
            if args[0]=='apksigner':return 'Signer #1 certificate SHA-256 digest: '+'a'*64
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

if __name__=='__main__':unittest.main()
