import sys,pathlib,unittest,struct,zipfile,io
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parent.parent/'scripts'))
from artifact_checks import elf_alignment,dex_startup,classify_dev_strings,embedded_inputs
class BinaryChecks(unittest.TestCase):
 def test_elf_64_bit_requires_16kb_load_segments(self):
  b=bytearray(120);b[:6]=b'\x7fELF\x02\x01';struct.pack_into('<Q',b,32,64);struct.pack_into('<HH',b,54,56,1);struct.pack_into('<I',b,64,1);struct.pack_into('<Q',b,112,16384)
  elf_alignment(b,'lib/arm64-v8a/libtest.so');struct.pack_into('<Q',b,112,4096)
  with self.assertRaisesRegex(ValueError,'16 KB'):elf_alignment(b,'lib/arm64-v8a/libtest.so')
 def test_dex_string_reference_does_not_pass_as_class_definition(self):
  data=io.BytesIO()
  with zipfile.ZipFile(data,'w') as archive:archive.writestr('assets/string.txt',b'Llivekit/org/jni_zero/JniInit;')
  with zipfile.ZipFile(data) as archive:
   with self.assertRaisesRegex(ValueError,'class definition'):dex_startup(archive)
 def test_framework_constants_and_spotube_are_preserved_but_active_dev_route_fails(self):
  counts=classify_dev_strings(b'localhost:8081 ws://127.0.0.1:9999/ws 10.0.2.2')
  self.assertEqual(counts['spotubeLoopback'],1);self.assertEqual(counts['frameworkConstants'],2)
  with self.assertRaisesRegex(ValueError,'development route'):classify_dev_strings(b'new WebSocket("ws://localhost:8081/debugger-proxy")')
