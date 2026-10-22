import importlib.util,pathlib,sqlite3,tempfile,unittest,json,copy
spec=importlib.util.spec_from_file_location('contract',pathlib.Path(__file__).resolve().parents[1]/'fixture_contract.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class FixtureContract(unittest.TestCase):
 def db(self):
  c=sqlite3.connect(':memory:');c.executescript('CREATE TABLE measurements(id TEXT PRIMARY KEY, measured_at TEXT, phase TEXT, electricity_kwh REAL, heat_kwh REAL, outside_c REAL, room_c REAL, compressor_starts INTEGER, flow_c REAL, return_c REAL, compressor_hours REAL, hot_water_kwh REAL);CREATE TABLE experiments(id TEXT PRIMARY KEY,setting TEXT,previous_value TEXT,new_value TEXT,unit TEXT,duration_days INTEGER,started_at TEXT,status TEXT);CREATE TABLE app_state(key TEXT PRIMARY KEY,value TEXT);');c.execute("INSERT INTO experiments VALUES ('ordinary','heatingCurve','0.6','0.5','',7,'2026-10-22T00:00:00.000Z','active')");c.execute("INSERT INTO measurements VALUES ('ordinary-m','2026-10-22T00:00:00.000Z','after',5.1,18.4,4.2,21,8,35,29,6.2,3)");c.execute("INSERT INTO app_state VALUES ('pro_entitlement','false')");c.commit();return c
 def test_historical_fixture_is_additive_and_retains_every_ordinary_row(self):
  c=self.db();before=m.snapshot(c);m.seed(c);after=m.snapshot(c);m.validate_seed(before,after);self.assertEqual(len(after['measurements']),9);self.assertEqual(len(after['experiments']),2);self.assertEqual(before['app_state'],after['app_state'])
 def test_fixture_refuses_existing_golden_without_overwrite(self):
  c=self.db();m.seed(c);before=m.snapshot(c)
  with self.assertRaises(ValueError):m.seed(c)
  self.assertEqual(before,m.snapshot(c))
 def test_missing_or_premium_baseline_is_rejected(self):
  for kind in ['missing','premium']:
   c=self.db();c.execute('DELETE FROM measurements'if kind=='missing'else"UPDATE app_state SET value='true' WHERE key='pro_entitlement'");c.commit()
   with self.assertRaises(ValueError):m.seed(c)
 def test_review_must_target_exact_historical_windows_and_reason(self):
  c=self.db();before=m.snapshot(c);m.seed(c);seeded=m.snapshot(c);r={'schemaVersion':1,'experimentId':m.GOLDEN,'beforeStart':'2026-10-01','beforeEnd':'2026-10-04','afterStart':'2026-10-05','afterEnd':'2026-10-08','exclusions':[{'phase':'after','date':'2026-10-08','reason':'QA meter check'}]};c.execute('INSERT INTO app_state VALUES (?,?)',('quality_review_v1:'+m.GOLDEN,json.dumps(r)));c.commit();m.validate_final(before,seeded,m.snapshot(c))
  r['afterEnd']='2026-02-30';c.execute('UPDATE app_state SET value=? WHERE key=?',(json.dumps(r),'quality_review_v1:'+m.GOLDEN));c.commit()
  with self.assertRaises(AssertionError):m.validate_final(before,seeded,m.snapshot(c))
 def test_native_review_cannot_change_any_raw_row_or_entitlement(self):
  c=self.db();before=m.snapshot(c);m.seed(c);seeded=m.snapshot(c);bad=copy.deepcopy(seeded);bad['measurements'][0]['electricity_kwh']=999
  with self.assertRaises(AssertionError):m.validate_final(before,seeded,bad)
if __name__=='__main__':unittest.main()
