#!/usr/bin/env bash
set -euo pipefail
[[ "${GITHUB_ACTIONS:-}" == true ]] || { echo 'Disposable hosted runner required'; exit 2; }
cd "$GITHUB_WORKSPACE"
proof="$RUNNER_TEMP/waermetakt-native-acceptance/waermetakt"
mkdir -p "$proof"
serial=emulator-5554
avd="WaermeTaktQualityAcceptance-35"
cleanup() {
  rc=$?; trap - EXIT; set +e
  timeout 10s adb -s "$serial" emu kill > "$proof/emulator-stop.txt" 2>&1
  for attempt in {1..45}; do
    if ! timeout 3s adb devices | grep -Fq "$serial"; then break; fi
    sleep 1
  done
  timeout 15s "$ANDROID_HOME/cmdline-tools/latest/bin/avdmanager" delete avd -n "$avd" > "$proof/avd-delete.txt" 2>&1
  timeout 10s "${ANDROID_SDK_ROOT:?}/emulator/emulator" -list-avds > "$proof/remaining-avds.txt" 2>&1
  avd_rc=$?
  timeout 5s adb devices > "$proof/remaining-devices.txt" 2>&1
  device_rc=$?
  python3 .github/waermetakt-native/verify_cleanup.py --proof "$proof" --avd "$avd" --serial "$serial" --avd-rc "$avd_rc" --device-rc "$device_rc"
  if [[ $? != 0 ]]; then echo 'Exact owned cloud device cleanup not verified' > "$proof/cleanup-failed.txt"; rc=1; fi
  exit "$rc"
}
trap cleanup EXIT
# Only prepare the disposable workflow-owned emulator, never a physical/shared device.
[[ "$(timeout 5s adb -s "$serial" shell getprop ro.build.version.sdk | tr -d '\r')" == 35 ]]
[[ "$(timeout 5s adb -s "$serial" shell getprop ro.kernel.qemu | tr -d '\r')" == 1 ]]
owned_devices="$(timeout 5s adb devices | awk 'NR>1 && NF {print $1}')"
[[ "$owned_devices" == "$serial" ]]
# The repository-established AOSP default image is used; no launcher or ANR is dismissed.
sleep 20
python3 .github/waermetakt-native/run_acceptance.py
