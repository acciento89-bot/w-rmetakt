"""One owned API35 device, actual Release UI, explicitly declared historical QA fixture."""
import datetime,hashlib,io,json,os,pathlib,re,shutil,sqlite3,subprocess,tarfile,tempfile
from fixture_contract import snapshot,seed,validate_seed,validate_final
APP='de.kamilunavo.waermetakt';HOST=APP+'qa'
FRAMES=['01-ordinary-experiment','02-ordinary-measurement','03-all-selected-golden','04-invalid-date-blocked','05-reasoned-comparison','06-cold-reviewed','07-wide-review','08-original-analysis-retained']
NATIVE_FILES={n+e for n in FRAMES for e in ['.png','.xml']};OPTIONAL_FILES={'failure-screen.png','failure-screen.xml'}
GENERIC_FILES={'result.json','source-commit.txt','build.log','host-build.log','root-mode.txt','installed-identity.txt','database-inventory.txt','preflight-anr.txt','final-anr.txt','window.txt','logcat.txt','final-screen.png','emulator-stop.txt','avd-delete.txt','remaining-avds.txt','remaining-devices.txt','cleanup.json','cleanup-failed.txt','fixture-values.json','fixture-manifest.json'}|{f'phase{i}-{n}'for i in range(1,4)for n in ['values.json','waermetakt.db','waermetakt.db-wal','waermetakt.db-shm','instrumentation.txt']}
def reject_anr(data):
 if re.search(rb'ANR in|Application Not Responding|com.android.systemui|com.google.android.apps.nexuslauncher',data,re.I):raise RuntimeError('Observed system/launcher ANR; no dismissal')
def reject_anr_window(data):
 assert re.search(rb'Window\{[^}]+\}',data),'Actual window inventory required'
 assert not re.search(rb'ANR in|Application Not Responding|isn.t responding',data,re.I),'Observed ANR window'
def run():
 runtime=pathlib.Path(os.environ['RUNNER_TEMP']).resolve();proof=runtime/'waermetakt-native-acceptance/waermetakt';assert not proof.is_symlink() and not proof.parent.is_symlink();proof.mkdir(parents=True,exist_ok=True,mode=0o700)
 result={'status':'STARTED','package':APP,'version':'1.1.0(5)','realTransactions':False,'fixtureRecordsInjected':True,'fixtureScope':'Separate named qa-quality-golden experiment and eight Oct1..8 historical rows only in this workflow-owned emulator; ordinary free UI experiment/measurement and entitlements retained unchanged'};validated=False
 def call(args,timeout=20):
  p=subprocess.run(['adb','-s','emulator-5554',*args],stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=timeout)
  if p.returncode:raise RuntimeError('Owned adb command failed: '+args[0])
  return p.stdout
 def owned():assert call(['shell','getprop','ro.build.version.sdk']).strip()==b'35' and call(['shell','getprop','ro.kernel.qemu']).strip()==b'1','Only owned API35 emulator'
 def snap(index):
  call(['shell','am','force-stop',APP]);inventory=call(['shell','find','/data/user/0/'+APP,'-maxdepth','5','-type','f','-name','waermetakt.db']).decode().strip().splitlines();assert len(inventory)==1
  path=inventory[0];assert re.fullmatch('/data/user/0/de\\.kamilunavo\\.waermetakt/(?:files/SQLite|databases)/waermetakt\\.db',path),'Unexpected installed SQLite location';(proof/'database-inventory.txt').write_text(path+'\n')
  for suffix in ['','-wal','-shm']:
   exists=call(['shell','sh','-c',f'test -f {path+suffix} && echo PRESENT || echo ABSENT']).strip()
   if exists==b'PRESENT':
    data=call(['exec-out','cat',path+suffix]);assert len(data)<4_000_000;(proof/f'phase{index}-waermetakt.db{suffix}').write_bytes(data)
  c=sqlite3.connect(proof/f'phase{index}-waermetakt.db');c.execute('PRAGMA query_only=ON');v=snapshot(c);c.close();(proof/f'phase{index}-values.json').write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n');return path,v
 def instrument(method,index):
  data=call(['shell','am','instrument','-w','-r','-e','class',HOST+'.QualityNativeTest#'+method,HOST+'.test/androidx.test.runner.AndroidJUnitRunner'],720);(proof/f'phase{index}-instrumentation.txt').write_bytes(data)
  assert b'OK (1 test)'in data and not any(x in data for x in [b'FAILURES',b'INSTRUMENTATION_FAILED',b'Process crashed']),'Actual native scenario failed: '+method
 try:
  owned();anr=call(['shell','dumpsys','activity','lastanr']);(proof/'preflight-anr.txt').write_bytes(anr);reject_anr(anr);validated=True
  (proof/'root-mode.txt').write_bytes(call(['root']));call(['wait-for-device'],30);owned();assert call(['shell','id','-u']).strip()==b'0'
  apks=[pathlib.Path('candidate/universal.apk'),pathlib.Path('.github/waermetakt-native/host/app/build/outputs/apk/debug/app-debug.apk'),pathlib.Path('.github/waermetakt-native/host/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk')];result['apkSha256']={str(p):hashlib.sha256(p.read_bytes()).hexdigest()for p in apks}
  for apk in apks:call(['install','-r',str(apk)],180)
  identity=call(['shell','dumpsys','package',APP]);(proof/'installed-identity.txt').write_bytes(identity);assert re.search(rb'\bversionCode=5(?=\s|$)',identity)and re.search(rb'\bversionName=1\.1\.0(?=\s|$)',identity)
  for forbidden in [b'ALLOW_BACKUP',b'android.permission.RECORD_AUDIO',b'android.permission.SYSTEM_ALERT_WINDOW',b'android.permission.READ_EXTERNAL_STORAGE',b'android.permission.WRITE_EXTERNAL_STORAGE',b'com.google.android.gms.permission.AD_ID']:assert forbidden not in identity,'Unexpected backup/permission: '+forbidden.decode()
  instrument('ordinaryFreeExperimentAndMeasurement',1);path,before=snap(1)
  # Only this fresh workflow-owned AOSP image is modified; fixture code is never shipped.
  with tempfile.TemporaryDirectory(dir=runtime,prefix='waermetakt-explicit-fixture-')as temp:
   db=pathlib.Path(temp)/'waermetakt.db';src=sqlite3.connect(proof/'phase1-waermetakt.db');dst=sqlite3.connect(db);src.backup(dst);src.close();seed(dst);fixture=snapshot(dst);dst.execute('PRAGMA wal_checkpoint(TRUNCATE)');dst.execute('PRAGMA journal_mode=DELETE');dst.close()
   (proof/'fixture-values.json').write_text(json.dumps(fixture,ensure_ascii=False,indent=2)+'\n');(proof/'fixture-manifest.json').write_text(json.dumps({'workflowOwnedOnly':True,'shippingFixtureFeature':False,'measurementCount':8,'experiment':'qa-quality-golden','ordinaryRecordsPreserved':True})+'\n')
   owned();remote='/data/local/tmp/waermetakt-quality-owned-fixture.db';call(['push',str(db),remote]);call(['shell','sh','-c',f'cat {remote} > {path} && rm -f {path}-wal {path}-shm {remote}'])
  instrument('reviewHistoricalFixtureWithoutChangingRawReadings',2);_,reviewed=snap(2);validate_final(before,fixture,reviewed)
  instrument('coldReviewAndResponsiveLayout',3);_,cold=snap(3);validate_final(before,fixture,cold);assert reviewed==cold,'Cold reopen changed stored review or original values'
  result.update(status='PASSED',actualStoredEvidence={f'phase{i}-values.json':hashlib.sha256((proof/f'phase{i}-values.json').read_bytes()).hexdigest()for i in range(1,4)})
 except BaseException as e:result.update(status='FAILED',error=str(e))
 finally:
  if validated:
   for name,args in [('final-screen.png',['exec-out','screencap','-p']),('window.txt',['shell','dumpsys','window','windows']),('logcat.txt',['logcat','-d','-t','1500']),('final-anr.txt',['shell','dumpsys','activity','lastanr'])]:
    try:(proof/name).write_bytes(call(args))
    except BaseException as e:result.setdefault('diagnostics',{})[name]=type(e).__name__
   try:
    reject_anr((proof/'final-anr.txt').read_bytes());reject_anr_window((proof/'window.txt').read_bytes());packed=call(['exec-out','run-as',HOST,'tar','-cf','-','-C','files','native-proof']);assert len(packed)<40*1024*1024;found=set()
    with tarfile.open(fileobj=io.BytesIO(packed))as t:
     for member in t.getmembers():
      if member.isdir():continue
      p=pathlib.PurePosixPath(member.name);assert member.isfile()and p.parent==pathlib.PurePosixPath('native-proof')and p.name in NATIVE_FILES|OPTIONAL_FILES and p.name not in found and member.size<8*1024*1024;found.add(p.name);(proof/p.name).write_bytes(t.extractfile(member).read())
    if result['status']=='PASSED':assert found==NATIVE_FILES,'Incomplete actual UI proof'
   except BaseException as e:
    result.setdefault('diagnostics',{})['nativeProof']=str(e)
    if result['status']=='PASSED':result.update(status='FAILED',error='Incomplete or invalid actual evidence')
  result['finishedUTC']=datetime.datetime.now(datetime.timezone.utc).isoformat();(proof/'result.json').write_text(json.dumps(result,indent=2)+'\n')
 return result
if __name__=='__main__':
 os.umask(0o077);r=run();print(json.dumps({'status':r['status'],'evidence':'bounded encrypted own synthetic records only'}));raise SystemExit(0 if r['status']=='PASSED'else 1)
