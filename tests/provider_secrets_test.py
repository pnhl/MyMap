import hashlib,io,json,pathlib,struct,sys,tempfile,unittest,zipfile,importlib.util,subprocess,xml.etree.ElementTree as ET
from unittest.mock import patch
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parent.parent/'scripts'))
from provider_secrets import credential_categories,archive_provider_secrets,scan_stream,CHUNK,scan_path
import provider_secrets

def hermes_fixture(values, *, extra_storage=b'', extra_binary=b'', version=98):
    storage=bytearray();entries=[];overflows=[]
    for value,utf16 in values:
        raw=value.encode('utf-16-le' if utf16 else 'utf8');offset=len(storage)
        size=len(raw)//(2 if utf16 else 1)
        storage.extend(raw)
        if size>=255:
            index=len(overflows);overflows.append((offset,size));offset=index;size=255
        entries.append((size<<24)|(offset<<1)|int(utf16))
    storage.extend(extra_storage)
    fields=[0]*20;fields[2]=1;fields[5]=len(entries);fields[6]=len(overflows);fields[7]=len(storage)
    tail=b'\x00'*12+b''.join(struct.pack('<I',e) for e in entries)+b''.join(struct.pack('<II',*e) for e in overflows)+bytes(storage)+extra_binary
    fields[0]=128+len(tail)+20
    body=bytes.fromhex('c61fbc03c103191f')+struct.pack('<I',version)+b'\x00'*20+struct.pack('<20I',*fields)+b'\x00'*16+tail
    return body+hashlib.sha1(body).digest()

class ProviderCredentialChecks(unittest.TestCase):
    def test_base64_certificate_and_signed_jar_digest_fragments_are_not_keys(self):
        synthetic=b'aB3dE6gH9jK2mN5pQ8sT1vW4yZ7cF0iL'
        self.assertEqual(credential_categories(b'SHA-256-Digest: abc/'+synthetic+b'+xyz='),[])
        self.assertIn('opaque-provider-key',credential_categories(b'key='+synthetic+b'&next=1'))
        self.assertIn('provider-url-credential',credential_categories(b'https://api.tomtom.com/route?key='+synthetic))

    def test_streaming_windows_do_not_truncate_longer_strings_into_opaque_keys(self):
        synthetic=b'aB3dE6gH9jK2mN5pQ8sT1vW4yZ7cF0iL'
        self.assertEqual(scan_stream(io.BytesIO(b'\xff'*(CHUNK-32)+synthetic+b'Q\x00')),[])
        prefix=b'\xff'*(CHUNK-provider_secrets.OVERLAP-1)
        data=prefix+b'Q'+synthetic+b'\x00'
        data+=b'\xff'*(CHUNK+10-len(data))
        self.assertEqual(scan_stream(io.BytesIO(data)),[])
        self.assertIn('opaque-provider-key',scan_stream(io.BytesIO(b'\xff'*(CHUNK-16)+synthetic+b'\x00')))

    def test_utf16_short_provider_url_keys_and_opaque_tokens_are_preserved(self):
        for text in ['https://api.tomtom.com/route?key=abcdefgh','EXPO_PUBLIC_'+'GRAPHHOPPER_KEY','aB3dE6gH9jK2mN5pQ8sT1vW4yZ7cF0iL']:
            for encoding in ['utf-16-le','utf-16-be']:
                self.assertTrue(credential_categories(b'\xff'+text.encode(encoding)))

    def test_exact_public_sdk_exception_never_suppresses_contextual_credentials(self):
        synthetic='aB3dE6gH9jK2mN5pQ8sT1vW4yZ7cF0iL'
        with patch.object(provider_secrets,'PUBLIC_SDK_OPAQUE_DIGESTS',{hashlib.sha256(synthetic.encode()).hexdigest()}):
            self.assertEqual(credential_categories(synthetic.encode()),[])
            self.assertIn('provider-url-credential',credential_categories(('https://api.tomtom.com/route?key='+synthetic).encode()))
            self.assertIn('labelled-provider-credential',credential_categories(('STADIA_KEY='+synthetic).encode()))
        self.assertIn('opaque-provider-key',credential_categories(synthetic.encode()))

    def test_public_sdk_policy_has_only_digests_and_pinned_verified_artifact_sources(self):
        root=pathlib.Path(__file__).resolve().parent.parent
        policy=json.loads((root/'config/public-sdk-credential-shapes.json').read_text())
        self.assertEqual(len(policy['opaqueSha256']),len(set(policy['opaqueSha256'])))
        for digest in policy['opaqueSha256']:self.assertRegex(digest,r'^[a-f0-9]{64}$')
        metadata=ET.parse(root/'config/native-locks/play/verification-metadata.xml')
        for element in metadata.iter():element.tag=element.tag.rsplit('}',1)[-1]
        for source in policy['upstreamArtifacts']:
            group,name,version=source['coordinate'].split(':')
            matches=[component for component in metadata.iter('component') if component.attrib=={'group':group,'name':name,'version':version}]
            self.assertEqual(len(matches),1)
            hashes={item.attrib['value'] for artifact in matches[0].findall('artifact') if artifact.attrib['name']==name+'-'+version+'.aar' for item in artifact.findall('sha256')}
            self.assertIn(source['aarSha256'],hashes)
            self.assertTrue(source.get('classes') or source.get('nativeLibraries'))
            self.assertTrue(all(item.startswith('com/google/android/gms/internal/ads/') and item.endswith('.class') for item in source.get('classes',[])))
            self.assertTrue(all(item=='jni/arm64-v8a/libmlkitcommonpipeline.so' for item in source.get('nativeLibraries',[])))

    def test_invalid_binary_bytes_do_not_join_fragments_into_a_key(self):
        synthetic=b'aB3dE6gH9jK2mN5pQ8sT1vW4yZ7cF0iL'
        self.assertIn('opaque-provider-key',credential_categories(synthetic))
        self.assertEqual(credential_categories(synthetic[:16]+b'\xff'+synthetic[16:]),[])

    def test_hermes_string_boundaries_do_not_join_public_url_and_unrelated_query(self):
        values=[('https://cesium.com/public.js',False),('?access_token=',False),('unrelated-public-label',False)]
        data=hermes_fixture(values)
        self.assertIn('provider-url-credential',credential_categories(data))
        self.assertEqual(scan_stream(io.BytesIO(data)),[])

    def test_hermes_real_strings_overflow_utf16_and_nonstring_bytes_still_fail(self):
        url='https://api.tomtom.com/route?key=synthetic-private-fixture'
        token='MLY|synthetic-fixture|synthetic-private-fixture'
        for values in [[(url,False)],[(token,True)],[('x'*300+url,False)],[(url,True)]]:
            with self.subTest(values=len(values)):
                self.assertTrue(scan_stream(io.BytesIO(hermes_fixture(values))))
        for kwargs in [{'extra_storage':url.encode()},{'extra_binary':url.encode()}]:
            self.assertIn('provider-url-credential',scan_stream(io.BytesIO(hermes_fixture([('public',False)],**kwargs))))
        with tempfile.TemporaryDirectory()as folder:
            path=pathlib.Path(folder)/'fixture.apk'
            with zipfile.ZipFile(path,'w')as archive:archive.writestr('unknown.bin',hermes_fixture([(url,False)]))
            with self.assertRaisesRegex(ValueError,'Provider credential'):scan_path(path)

    def test_hermes_unknown_version_truncation_integrity_and_bad_ranges_fail_closed(self):
        valid=hermes_fixture([('public',False)])
        bad_range=bytearray(valid[:-20]);struct.pack_into('<I',bad_range,140,(100<<1)|(6<<24))
        corrupt=valid[:-1]+bytes([valid[-1]^1])
        for data in [valid[:90],hermes_fixture([],version=99),corrupt,bytes(bad_range)+hashlib.sha1(bad_range).digest()]:
            with self.subTest(size=len(data)):
                with self.assertRaises(ValueError):scan_stream(io.BytesIO(data))

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
