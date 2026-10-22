import importlib.util,pathlib,unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('prepare_unsigned',ROOT/'prepare_unsigned.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class UnsignedTemplate(unittest.TestCase):
 def template(self,line='            signingConfig signingConfigs.debug'):
  return '    buildTypes {\n        debug {\n            signingConfig signingConfigs.debug\n        }\n        release {\n            // Generated template\n'+line+'\n            minifyEnabled false\n        }\n    }\n'
 def test_actual_default_release_debug_identity_removed_without_touching_debug(self):
  before=self.template();after=m.prepare(before);self.assertEqual(after,before.replace('// Generated template\n            signingConfig signingConfigs.debug','// Generated template\n            signingConfig null'));self.assertEqual(after.count('signingConfig signingConfigs.debug'),1)
 def test_second_application_is_stable(self):
  after=m.prepare(self.template());self.assertEqual(m.prepare(after),after)
 def test_unknown_existing_release_identity_is_never_removed(self):
  with self.assertRaises(ValueError):m.prepare(self.template('            signingConfig signingConfigs.production'))
 def test_missing_or_duplicate_release_block_fails_closed(self):
  for s in ['nothing',self.template()+self.template()]:
   with self.assertRaises(ValueError):m.prepare(s)
 def test_ambiguous_release_signing_fails_closed(self):
  with self.assertRaises(ValueError):m.prepare(self.template('            signingConfig signingConfigs.debug\n            signingConfig signingConfigs.production'))
if __name__=='__main__':unittest.main()
