"""Consume only the exact successful same-repository main-owned signed candidate."""
import hashlib,json,os,pathlib,re,subprocess,zipfile
from artifact_source import assert_same_product
repo='acciento89-bot/w-rmetakt';run=os.environ['SOURCE_RUN_ID'];artifact=os.environ['SOURCE_ARTIFACT_ID'];digest=os.environ['SOURCE_ARTIFACT_DIGEST']
assert os.environ['GITHUB_REPOSITORY']==repo and run.isdecimal()and artifact.isdecimal()and re.fullmatch('sha256:[0-9a-f]{64}',digest)
def api(path):return json.loads(subprocess.check_output(['gh','api',f'repos/{repo}/'+path]))
r=api('actions/runs/'+run);a=api('actions/artifacts/'+artifact);sha=r['head_sha'];assert re.fullmatch('[0-9a-f]{40}',sha)
assert r['head_branch']=='main'and r['status']=='completed'and r['conclusion']=='success'and r['path']=='.github/workflows/android-quality-update-sign.yml'
assert a['name']=='WaermeTakt-1.2.0-6-central-signed-aab'and not a['expired']and a['digest']==digest and str(a['workflow_run']['id'])==run and a['workflow_run']['head_sha']==sha
assert_same_product(pathlib.Path.cwd(),sha,os.environ['GITHUB_SHA'])
archive=pathlib.Path(os.environ['RUNNER_TEMP'])/'signed-candidate.zip'
with archive.open('xb')as f:subprocess.run(['gh','api',f'repos/{repo}/actions/artifacts/{artifact}/zip'],stdout=f,check=True)
with archive.open('rb')as f:assert hashlib.file_digest(f,'sha256').hexdigest()==digest.removeprefix('sha256:')
folder=pathlib.Path('candidate');folder.mkdir(mode=0o700)
with zipfile.ZipFile(archive)as z:
 expected={'app-release.aab','app-release.aab.sha256','provenance.json','payload.json','upload-certificate.txt','metadata.sha256'}
 assert set(z.namelist())==expected and len(z.namelist())==len(expected)
 for member in z.infolist():
  assert member.file_size<(512*1024*1024 if member.filename=='app-release.aab'else 4*1024*1024)
  with z.open(member)as src,(folder/member.filename).open('xb')as dst:
   while chunk:=src.read(1024*1024):dst.write(chunk)
p=json.loads((folder/'provenance.json').read_text());assert p['GITHUB_SHA']==p['SOURCE_COMMIT']==sha and str(p['GITHUB_RUN_ID'])==run and p['GITHUB_REPOSITORY']==repo and p['PACKAGE_NAME']=='de.kamilunavo.waermetakt'and p['VERSION_CODE']=='6'and p['VERSION_NAME']=='1.2.0'
assert hashlib.sha256((folder/'app-release.aab').read_bytes()).hexdigest()==(folder/'app-release.aab.sha256').read_text().split()[0]
print('Exact successful main signed artifact and native product source bound')
