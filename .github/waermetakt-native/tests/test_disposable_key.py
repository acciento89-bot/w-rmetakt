import importlib.util,pathlib,tempfile,unittest,subprocess
p=pathlib.Path(__file__).resolve().parents[1]/'disposable_key.py';s=importlib.util.spec_from_file_location('key',p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
class OwnKeyTests(unittest.TestCase):
 def test_actual_keytool_creates_only_scoped_disposable_key(self):
  with tempfile.TemporaryDirectory()as d:
   folder=pathlib.Path(d)/'own-native-signing';key=m.create_disposable_key(folder)
   self.assertEqual(key.parent,folder);self.assertTrue(key.is_file())
   subprocess.run(['keytool','-list','-keystore',str(key),'-storepass','android','-alias','androiddebugkey'],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 def test_existing_directory_and_bytes_are_never_reused_or_replaced(self):
  with tempfile.TemporaryDirectory()as d:
   folder=pathlib.Path(d)/'own-native-signing';folder.mkdir();key=folder/'debug.keystore';key.write_bytes(b'preserve existing')
   with self.assertRaises(FileExistsError):m.create_disposable_key(folder)
   self.assertEqual(key.read_bytes(),b'preserve existing')
