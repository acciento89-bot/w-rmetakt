"""Installable APK re-signed only with the owned disposable debug key; verify every DEX and asset."""
import hashlib,pathlib,subprocess,os,zipfile
from disposable_key import create_disposable_key
folder=pathlib.Path('candidate');tool=pathlib.Path(os.environ['RUNNER_TEMP'])/'bundletool.jar';ks=create_disposable_key(pathlib.Path(os.environ['RUNNER_TEMP'])/'waermetakt-owned-qa-signing')
subprocess.run(['java','-jar',str(tool),'build-apks','--bundle='+str(folder/'app-release.aab'),'--output='+str(folder/'candidate.apks'),'--mode=universal','--ks='+str(ks),'--ks-pass=pass:android','--ks-key-alias=androiddebugkey','--key-pass=pass:android'],check=True,stdout=subprocess.DEVNULL)
with zipfile.ZipFile(folder/'candidate.apks')as z:
 with z.open('universal.apk')as src,(folder/'universal.apk').open('xb')as dst:
  while chunk:=src.read(1024*1024):dst.write(chunk)
with zipfile.ZipFile(folder/'app-release.aab')as source,zipfile.ZipFile(folder/'universal.apk')as apk:
 dex=[n for n in source.namelist()if n.startswith('base/dex/')and n.endswith('.dex')];assets=[n for n in source.namelist()if n.startswith('base/assets/')and not n.endswith('/')]
 assert dex and assets
 for name in dex+assets:
  target=name.replace('base/dex/','',1)if name in dex else name.removeprefix('base/')
  assert source.read(name)==apk.read(target),'Actual shipping DEX/asset mismatch: '+name
print('Derived QA APK contains exactly the signed candidate DEX and assets')
