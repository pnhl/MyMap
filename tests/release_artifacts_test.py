import importlib.util, pathlib, plistlib, tempfile, unittest, zipfile
spec=importlib.util.spec_from_file_location('verify',pathlib.Path(__file__).resolve().parent.parent/'scripts/verify-artifacts.py');verify=importlib.util.module_from_spec(spec);spec.loader.exec_module(verify)
class IpaValidation(unittest.TestCase):
    def fixture(self,changes=None,extra=None):
        info={'CFBundleIdentifier':verify.RELEASE['applicationId'],'CFBundleShortVersionString':verify.RELEASE['version'],'CFBundleVersion':str(verify.RELEASE['build']),'UIBackgroundModes':['location','audio','processing'],'GADApplicationIdentifier':'ca-app-pub-1234567890123456~1234567890'}
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
        with self.assertRaisesRegex(ValueError,'Development endpoint'):verify.ipa(self.fixture(extra={'Payload/MyMap.app/main.jsbundle':b'http://localhost:8081'}),True)
if __name__=='__main__':unittest.main()
