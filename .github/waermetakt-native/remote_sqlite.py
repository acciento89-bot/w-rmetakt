"""Validated shell commands only for the owned emulator's exact installed QA SQLite file."""
import re,shlex
REMOTE_FIXTURE='/data/local/tmp/waermetakt-quality-owned-fixture.db'
def checked(path):
 if not re.fullmatch(r'/data/user/0/de\.kamilunavo\.waermetakt/(?:files/SQLite|databases)/waermetakt\.db',path):raise ValueError('Only exact owned app SQLite path permitted')
 return path
def presence(path,suffix=''):
 checked(path)
 if suffix not in ['', '-wal', '-shm']:raise ValueError('Only exact SQLite sidecars permitted')
 path+=suffix
 return ['shell',f'test -f {shlex.quote(path)} && echo PRESENT || echo ABSENT']
def install_fixture(path):
 checked(path)
 # adb shell flattens arguments; pass one remote-shell program, never an unquoted nested sh -c.
 return ['shell',f'cat {shlex.quote(REMOTE_FIXTURE)} > {shlex.quote(path)} && rm -f {shlex.quote(path+"-wal")} {shlex.quote(path+"-shm")} {shlex.quote(REMOTE_FIXTURE)}']
