import importlib.util,pathlib,tempfile,unittest,subprocess
spec=importlib.util.spec_from_file_location('remote',pathlib.Path(__file__).resolve().parents[1]/'remote_sqlite.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
DB='/data/user/0/de.kamilunavo.waermetakt/files/SQLite/waermetakt.db'
class RemoteShell(unittest.TestCase):
 def execute(self,args,temp):
  self.assertEqual(args[0],'shell');self.assertEqual(len(args),2)
  script=' '.join(args[1:]).replace(DB,str(temp/'actual.db')).replace(m.REMOTE_FIXTURE,str(temp/'fixture.db'))
  return subprocess.run(['/bin/sh','-c',script],capture_output=True,timeout=3)
 def test_present_and_absent_are_actual_shell_outcomes(self):
  with tempfile.TemporaryDirectory()as d:
   t=pathlib.Path(d);self.assertEqual(self.execute(m.presence(DB),t).stdout.strip(),b'ABSENT');(t/'actual.db').write_bytes(b'ordinary');self.assertEqual(self.execute(m.presence(DB),t).stdout.strip(),b'PRESENT')
 def test_fixture_replaces_exact_owned_file_and_only_its_sidecars(self):
  with tempfile.TemporaryDirectory()as d:
   t=pathlib.Path(d);(t/'actual.db').write_bytes(b'ordinary');(t/'fixture.db').write_bytes(b'explicit fixture');(t/'actual.db-wal').write_bytes(b'wal');(t/'actual.db-shm').write_bytes(b'shm');(t/'unrelated').write_bytes(b'preserve')
   r=self.execute(m.install_fixture(DB),t);self.assertEqual(r.returncode,0);self.assertEqual((t/'actual.db').read_bytes(),b'explicit fixture');self.assertFalse((t/'actual.db-wal').exists());self.assertFalse((t/'actual.db-shm').exists());self.assertFalse((t/'fixture.db').exists());self.assertEqual((t/'unrelated').read_bytes(),b'preserve')
 def test_foreign_or_injected_paths_are_rejected(self):
  for p in ['/data/user/0/other/files/SQLite/waermetakt.db',DB+';touch /tmp/bad',DB+'/../../x','']:
   with self.assertRaises(ValueError):m.install_fixture(p)
   with self.assertRaises(ValueError):m.presence(p)
if __name__=='__main__':unittest.main()
