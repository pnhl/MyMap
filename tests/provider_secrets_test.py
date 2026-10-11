import io,pathlib,sys,tempfile,unittest,zipfile,importlib.util,subprocess
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parent.parent/'scripts'))
from provider_secrets import credential_categories,archive_provider_secrets,scan_stream,CHUNK,scan_path

class ProviderCredentialChecks(unittest.TestCase):
    def test_each_provider_credential_url_and_obsolete_variable_fails(self):
        for domain,key in [('tiles.stadiamaps.com','api_key'),('api.tomtom.com','key'),('graphhopper.com','key'),('graph.mapillary.com','access_token'),('api.cesium.com','access_token')]:
            with self.subTest(domain=domain):
                data=('https://'+domain+'/tiles?'+key+'='+'synthetic-private-fixture').encode()
                self.assertIn('provider-url-credential',credential_categories(data))
                self.assertIn('provider-url-credential',credential_categories(data.replace(b'=',b'%3D').replace(b'?',b'%3F')))
        self.assertIn('obsolete-public-provider-variable',credential_categories(('EXPO_PUBLIC_'+'GRAPHHOPPER_KEY').encode()))

    def test_hermes_native_utf16_and_chunk_boundaries_are_scanned(self):
        token='MLY'+'|'+('synthetic'*2)+'|'+('private-fixture'*2)
        for encoding in ['utf8','utf-16-le','utf-16-be']:
            self.assertIn('mapillary-access-token',credential_categories(b'\xff'+token.encode(encoding)))
        data=b'\xff'*(CHUNK-10)+token.encode()+b'\x00'
        self.assertIn('mapillary-access-token',scan_stream(io.BytesIO(data)))

    def test_opaque_keys_and_jwt_fail_but_public_identifiers_and_hashes_pass(self):
        synthetic='aB3dE6gH9jK2mN5pQ8sT1vW4yZ7cF0iL'
        self.assertIn('opaque-provider-key',credential_categories(synthetic.encode()))
        jwt='eyJ'+('a'*20)+'.'+('b'*30)+'.'+('c'*30)
        self.assertIn('embedded-jwt',credential_categories(jwt.encode()))
        public=b'ca-app-pub-9161074667002246~7998118867 sb_publishable_fixture https://gateway.example.test/route https://tile.openstreetmap.org/{z}/{x}/{y}.png '+b'a'*64+b' 86eaacdfdc01437498123bf9389513ae'
        self.assertEqual(credential_categories(public),[])

    def test_every_archive_member_and_nested_archive_is_scanned_without_value_in_error(self):
        for name in ['assets/index.android.bundle','classes.dex','lib/arm64-v8a/a.so','res/raw/unknown.bin','Payload/MyMap.app/MyMap']:
            with self.subTest(name=name),tempfile.TemporaryDirectory() as folder:
                path=pathlib.Path(folder)/'fixture.apk'
                with zipfile.ZipFile(path,'w')as archive:archive.writestr(name,b'https://api.tomtom.com/route?key='+b'synthetic-private-fixture')
                with self.assertRaisesRegex(ValueError,'Provider credential')as error:scan_path(path)
                self.assertNotIn('synthetic-private-fixture',str(error.exception));self.assertNotIn(name,str(error.exception))
        inner=io.BytesIO()
        with zipfile.ZipFile(inner,'w')as archive:archive.writestr('unknown',b'https://graphhopper.com/route?key='+b'synthetic-private-fixture')
        outer=io.BytesIO()
        with zipfile.ZipFile(outer,'w')as archive:archive.writestr('assets/nested.zip',inner.getvalue())
        with zipfile.ZipFile(outer)as archive:
            with self.assertRaises(ValueError):archive_provider_secrets(archive)

    def test_clean_bundle_and_empty_archive_are_not_reported_as_credentials(self):
        with tempfile.TemporaryDirectory()as folder:
            path=pathlib.Path(folder)/'main.jsbundle';path.write_bytes(b'const gateway="https://gateway.example.test";')
            self.assertEqual(scan_path(path)['providerCredentials'],0)

    def test_native_verifiers_reject_credentials_before_running_signing_tools(self):
        spec=importlib.util.spec_from_file_location('verify_proxy',pathlib.Path(__file__).resolve().parent.parent/'scripts/verify-artifacts.py')
        verify=importlib.util.module_from_spec(spec);spec.loader.exec_module(verify)
        with tempfile.TemporaryDirectory()as folder:
            path=pathlib.Path(folder)/'fixture.zip'
            with zipfile.ZipFile(path,'w')as archive:archive.writestr('unknown.bin',b'https://api.tomtom.com/route?key='+b'synthetic-private-fixture')
            for action in [lambda:verify.apk(path,'play'),lambda:verify.apk(path,'amazon'),lambda:verify.aab(path),lambda:verify.ipa(path,True),lambda:verify.wear_apk(path)]:
                with self.assertRaisesRegex(ValueError,'Provider credential'):action()
            result=subprocess.run([sys.executable,'scripts/scan-provider-secrets.py',str(path)],capture_output=True,text=True)
            self.assertEqual(result.returncode,1)
            self.assertNotIn('synthetic-private-fixture',result.stdout+result.stderr)
if __name__=='__main__':unittest.main()
