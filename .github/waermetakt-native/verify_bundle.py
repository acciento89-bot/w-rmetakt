"""Independent actual certificate, manifest and payload verification before installation."""
import hashlib,json,os,pathlib,re,subprocess,xml.etree.ElementTree as ET,zipfile
folder=pathlib.Path('candidate');aab=folder/'app-release.aab';tool=pathlib.Path(os.environ['RUNNER_TEMP'])/'bundletool.jar'
def cmd(*args):return subprocess.check_output(args,stderr=subprocess.STDOUT).decode()
assert 'jar verified.'in cmd('jarsigner','-verify',str(aab))
cert=cmd('keytool','-J-Duser.language=en','-printcert','-jarfile',str(aab));actual=re.search(r'SHA256:\s*([0-9A-F:]+)',cert)[1].replace(':','');assert actual=='7985BD6B33711BACA7E6BA722C2B3870EBBC802F7DB4A7BC1206BDAE51C4D5D6'
cmd('java','-jar',str(tool),'validate','--bundle='+str(aab));xml=cmd('java','-jar',str(tool),'dump','manifest','--bundle='+str(aab));root=ET.fromstring(xml);ns='{http://schemas.android.com/apk/res/android}';assert root.get('package')=='de.kamilunavo.waermetakt'and root.get(ns+'versionCode')=='6'and root.get(ns+'versionName')=='1.2.0';assert root.find('application').get(ns+'allowBackup')=='false'
for forbidden in ['android.permission.RECORD_AUDIO','android.permission.SYSTEM_ALERT_WINDOW','android.permission.READ_EXTERNAL_STORAGE','android.permission.WRITE_EXTERNAL_STORAGE','com.google.android.gms.permission.AD_ID']:assert forbidden not in xml
signature=re.compile(r'META-INF/(?:MANIFEST\.MF|[^/]+\.(?:SF|RSA|DSA|EC)|SIG-[^/]+)$',re.I)
with zipfile.ZipFile(aab)as z:
 names=z.namelist();assert len(names)==len(set(names))and all(not n.startswith('/')and'..'not in n.split('/')for n in names)
 payload={n:hashlib.sha256(z.read(n)).hexdigest()for n in sorted(names)if not signature.fullmatch(n)}
 assert payload==json.loads((folder/'payload.json').read_text())
(folder/'actual-manifest.xml').write_text(xml);print('Actual central signer, exact version6, no backup/forbidden permissions and payload verified')
