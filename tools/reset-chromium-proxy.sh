#!/usr/bin/env bash
# Reset stuck Chromium/Chrome/Brave proxy in the user profile.
# Close ALL browser windows before running.

set -euo pipefail

PREFS=""
if [[ $# -ge 1 && -f "$1" ]]; then
  PREFS="$1"
else
  CANDIDATES=(
    "${HOME}/.config/google-chrome/Default/Preferences"
    "${HOME}/.config/chromium/Default/Preferences"
    "${HOME}/.config/BraveSoftware/Brave-Browser/Default/Preferences"
    "${HOME}/.config/microsoft-edge/Default/Preferences"
  )
  for c in "${CANDIDATES[@]}"; do
    if [[ -f "$c" ]]; then
      PREFS="$c"
      break
    fi
  done
fi

if pgrep -x chrome >/dev/null 2>&1 || pgrep -x chromium >/dev/null 2>&1 || pgrep -x brave >/dev/null 2>&1; then
  echo "Browser is still running. Close it completely, then run this script again."
  exit 1
fi

if [[ -z "$PREFS" || ! -f "$PREFS" ]]; then
  echo "No browser Preferences file found. Pass the absolute path to Preferences as argument."
  exit 1
fi

python3 - "$PREFS" << 'PY'
import json, shutil, sys
path = sys.argv[1]
shutil.copy(path, path + ".bak-killswitch-proxy-reset")
with open(path, encoding="utf-8") as f:
    prefs = json.load(f)
old = prefs.get("proxy", {})
prefs["proxy"] = {"mode": "system"}
with open(path, "w", encoding="utf-8") as f:
    json.dump(prefs, f, ensure_ascii=False, separators=(",", ":"))
print("Target Preferences:", path)
print("Previous proxy:", old)
print("Updated proxy to system (follow OS settings). Backup:", path + ".bak-killswitch-proxy-reset")
PY
