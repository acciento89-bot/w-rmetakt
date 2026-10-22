"""Create one fresh test-only signing key; never inspect or reuse a release key."""
import pathlib,subprocess

def create_disposable_key(folder:pathlib.Path)->pathlib.Path:
 folder.mkdir(mode=0o700,parents=False,exist_ok=False)
 key=folder/'debug.keystore'
 subprocess.run(['keytool','-genkeypair','-noprompt','-keystore',str(key),'-storetype','PKCS12','-storepass','android','-keypass','android','-alias','androiddebugkey','-keyalg','RSA','-keysize','2048','-sigalg','SHA256withRSA','-validity','1','-dname','CN=Own Disposable Native QA'],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
 key.chmod(0o600);return key
