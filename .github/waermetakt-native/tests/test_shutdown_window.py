"""Actual shell loop must accommodate the emulator's observed 20s graceful stop."""
import pathlib,subprocess,tempfile,unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
class ShutdownTests(unittest.TestCase):
 def test_owned_shutdown_remains_observed_until_actual_absence(self):
  source=(ROOT/'run-cloud.sh').read_text();start=source.index('  for attempt in ');end=source.index('\n  timeout 15s',start)
  loop=source[start:end]
  with tempfile.TemporaryDirectory() as d:
   script='''set -euo pipefail
serial=emulator-5554
COUNT_FILE="$1/count"
printf 0 > "$COUNT_FILE"
timeout() { shift; "$@"; }
sleep() { :; }
adb() { local n; n=$(cat "$COUNT_FILE"); n=$((n+1)); printf '%s' "$n" > "$COUNT_FILE"; printf 'List of devices attached\\n'; if (( n <= 20 )); then printf 'emulator-5554\\tdevice\\n'; fi; }
'''+loop+'''\ncount=$(cat "$COUNT_FILE"); [[ "$count" == 21 ]]\n'''
   p=subprocess.run(['bash','-c',script,'test',d],capture_output=True,timeout=5)
   self.assertEqual(0,p.returncode,p.stderr.decode())
