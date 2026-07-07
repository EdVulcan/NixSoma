#!/usr/bin/env bash
# Experimental GNOME/Wayland whole-desktop capture adapter.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-wait-helper.sh"

TMP_DIR="${OPENCLAW_CAPTURE_TMP_DIR:-/tmp/openclaw-capture}"
SCREENSHOT_PATH="${OPENCLAW_CAPTURE_SCREENSHOT_PATH:-$TMP_DIR/frame.png}"
OCR_TEXT_PATH="${OPENCLAW_CAPTURE_OCR_TEXT_PATH:-$TMP_DIR/ocr.txt}"
WINDOW_TITLE_OVERRIDE="${OPENCLAW_CAPTURE_WINDOW_TITLE:-}"
WINDOW_PID_OVERRIDE="${OPENCLAW_CAPTURE_WINDOW_PID:-0}"
SOURCE_NAME="${OPENCLAW_CAPTURE_SOURCE_NAME:-linux-desktop}"
SESSION_TYPE="${XDG_SESSION_TYPE:-unknown}"
DESKTOP_ENV="${XDG_CURRENT_DESKTOP:-unknown}"

mkdir -p "$TMP_DIR"

trim() {
  sed 's/^[[:space:]]*//;s/[[:space:]]*$//'
}

capture_source="$SOURCE_NAME"
focused_window_title=""
focused_window_pid="$WINDOW_PID_OVERRIDE"
window_list_json="[]"
screenshot_status="not_attempted"
gnome_eval_status="not_attempted"
capture_attempts=()
gnome_focused_title_result=""

record_capture_attempt() {
  capture_attempts+=("$1")
}

has_file_payload() {
  local path="$1"
  [[ -f "$path" && -s "$path" ]]
}

capture_with_portal() {
  if ! command -v gdbus >/dev/null 2>&1; then
    record_capture_attempt "portal:gdbus_missing"
    return 1
  fi

  local monitor_log="$TMP_DIR/portal-monitor.log"
  local token="openclaw$(date +%s%N)"
  local monitor_pid=""
  local reply=""
  local handle=""
  local portal_result=""

  rm -f "$SCREENSHOT_PATH" "$monitor_log"
  : > "$monitor_log"

  gdbus monitor --session --dest org.freedesktop.portal.Desktop >"$monitor_log" 2>&1 &
  monitor_pid=$!
  openclaw_wait_interval 0.2

  reply="$(
    gdbus call --session \
      --dest org.freedesktop.portal.Desktop \
      --object-path /org/freedesktop/portal/desktop \
      --method org.freedesktop.portal.Screenshot.Screenshot \
      "" \
      "{'handle_token': <'${token}'>, 'interactive': <false>, 'modal': <false>}" 2>/dev/null || true
  )"

  handle="$(
    printf '%s\n' "$reply" \
      | sed -n "s/^(objectpath '\(.*\)'[,]*)$/\1/p" \
      | head -n 1
  )"

  if [[ -z "$handle" ]]; then
    screenshot_status="portal_call_failed"
    if [[ -n "$reply" ]]; then
      record_capture_attempt "portal:call_failed:reply=$(printf '%s' "$reply" | tr ' ' '_' | tr -d '\n')"
    else
      record_capture_attempt "portal:call_failed:no_reply"
    fi
    [[ -n "$monitor_pid" ]] && kill "$monitor_pid" >/dev/null 2>&1 || true
    return 1
  fi

  local attempts=0
  while (( attempts < 100 )); do
    portal_result="$(
      python3 - "$monitor_log" "$token" "$handle" <<'PY'
import json
import re
import sys
from pathlib import Path

log_path = Path(sys.argv[1])
token = sys.argv[2]
handle = sys.argv[3]
text = log_path.read_text(encoding="utf-8", errors="ignore")

matches = []
for line in text.splitlines():
    if "org.freedesktop.portal.Request.Response" not in line:
        continue
    if handle and handle in line:
        matches.append(line)
    elif token and token in line:
        matches.append(line)

if not matches:
    sys.exit(1)

line = matches[-1]
response_match = re.search(r"Response\s*\((\d+),", line)
uri_match = re.search(r"'uri': <'([^']+)'>", line)

payload = {
    "response": int(response_match.group(1)) if response_match else None,
    "uri": uri_match.group(1) if uri_match else None,
    "raw": line,
}
print(json.dumps(payload, ensure_ascii=False))
PY
    )"

    if [[ -n "$portal_result" ]]; then
      break
    fi

    openclaw_wait_interval 0.2
    attempts=$((attempts + 1))
  done

  [[ -n "$monitor_pid" ]] && kill "$monitor_pid" >/dev/null 2>&1 || true

  if [[ -z "$portal_result" ]]; then
    screenshot_status="portal_timeout"
    record_capture_attempt "portal:timeout"
    return 1
  fi

  local response_code=""
  local screenshot_uri=""
  response_code="$(python3 -c "import json,sys; data=json.loads(sys.argv[1]); print('' if data.get('response') is None else data['response'])" "$portal_result")"
  screenshot_uri="$(python3 -c "import json,sys; data=json.loads(sys.argv[1]); print(data.get('uri') or '')" "$portal_result")"

  if [[ "$response_code" != "0" ]]; then
    screenshot_status="portal_response_${response_code}"
    record_capture_attempt "portal:response_${response_code}"
    return 1
  fi

  if [[ -z "$screenshot_uri" ]]; then
    screenshot_status="portal_missing_uri"
    record_capture_attempt "portal:missing_uri"
    return 1
  fi

  local screenshot_file=""
  screenshot_file="$(python3 -c "import sys, urllib.parse; uri=sys.argv[1]; print(urllib.parse.unquote(uri[7:]) if uri.startswith('file://') else '')" "$screenshot_uri")"

  if [[ -z "$screenshot_file" || ! -f "$screenshot_file" ]]; then
    screenshot_status="portal_missing_file"
    record_capture_attempt "portal:missing_file"
    return 1
  fi

  cp "$screenshot_file" "$SCREENSHOT_PATH" >/dev/null 2>&1 || true
  if has_file_payload "$SCREENSHOT_PATH"; then
    capture_source="linux-portal"
    screenshot_status="captured"
    record_capture_attempt "portal:captured"
    return 0
  fi

  screenshot_status="portal_copy_failed"
  record_capture_attempt "portal:copy_failed"
  return 1
}

capture_with_gnome_shell_dbus() {
  if ! command -v gdbus >/dev/null 2>&1; then
    return 1
  fi

  rm -f "$SCREENSHOT_PATH"

  local reply
  reply="$(
    gdbus call --session \
      --dest org.gnome.Shell.Screenshot \
      --object-path /org/gnome/Shell/Screenshot \
      --method org.gnome.Shell.Screenshot.Screenshot \
      false false "$SCREENSHOT_PATH" 2>/dev/null || true
  )"

  if has_file_payload "$SCREENSHOT_PATH"; then
    capture_source="linux-gnome-shell-dbus"
    screenshot_status="captured"
    record_capture_attempt "gnome_shell_dbus:captured"
    return 0
  fi

  if [[ -n "$reply" ]]; then
    screenshot_status="dbus_no_file"
    record_capture_attempt "gnome_shell_dbus:dbus_no_file"
  else
    screenshot_status="dbus_unavailable"
    record_capture_attempt "gnome_shell_dbus:dbus_unavailable"
  fi

  return 1
}

capture_with_tool() {
  if [[ "$SESSION_TYPE" == "wayland" ]] && capture_with_portal; then
    return
  fi

  if [[ "$DESKTOP_ENV" == *GNOME* ]] && capture_with_gnome_shell_dbus; then
    return
  fi

  if command -v grim >/dev/null 2>&1; then
    rm -f "$SCREENSHOT_PATH"
    grim "$SCREENSHOT_PATH" >/dev/null 2>&1 || true
    if has_file_payload "$SCREENSHOT_PATH"; then
      capture_source="linux-grim"
      screenshot_status="captured"
      record_capture_attempt "grim:captured"
      return
    fi
    screenshot_status="grim_failed"
    record_capture_attempt "grim:failed"
  fi

  if command -v gnome-screenshot >/dev/null 2>&1; then
    rm -f "$SCREENSHOT_PATH"
    gnome-screenshot -f "$SCREENSHOT_PATH" >/dev/null 2>&1 || true
    if has_file_payload "$SCREENSHOT_PATH"; then
      capture_source="linux-gnome-screenshot"
      screenshot_status="captured"
      record_capture_attempt "gnome_screenshot:captured"
      return
    fi
    screenshot_status="gnome_screenshot_failed"
    record_capture_attempt "gnome_screenshot:failed"
  fi

  if command -v import >/dev/null 2>&1; then
    rm -f "$SCREENSHOT_PATH"
    import -window root "$SCREENSHOT_PATH" >/dev/null 2>&1 || true
    if has_file_payload "$SCREENSHOT_PATH"; then
      capture_source="linux-imagemagick"
      screenshot_status="captured"
      record_capture_attempt "import:captured"
      return
    fi
    screenshot_status="imagemagick_failed"
    record_capture_attempt "import:failed"
  fi

  screenshot_status="no_capture_tool_succeeded"
  if [[ ${#capture_attempts[@]} -gt 0 ]]; then
    screenshot_status="${screenshot_status} ($(IFS=', '; echo "${capture_attempts[*]}"))"
  fi
}

read_gnome_focused_title() {
  if ! command -v gdbus >/dev/null 2>&1; then
    gnome_eval_status="gdbus_missing"
    return 1
  fi

  local reply
  reply="$(
    gdbus call --session \
    --dest org.gnome.Shell \
    --object-path /org/gnome/Shell \
    --method org.gnome.Shell.Eval \
    "global.display.focus_window ? global.display.focus_window.get_title() : ''" 2>/dev/null || true
  )"

  if [[ "$reply" == "(true,"* ]]; then
    gnome_eval_status="ok"
  else
    gnome_eval_status="eval_disabled_or_unavailable"
  fi

  gnome_focused_title_result="$(
    printf '%s\n' "$reply" \
      | sed -n "s/^(true, '\(.*\)')$/\1/p" \
      | head -n 1
  )"

  if [[ -n "$gnome_focused_title_result" ]]; then
    return 0
  fi

  return 1
}

read_gnome_window_list() {
  if ! command -v gdbus >/dev/null 2>&1; then
    return 1
  fi

  gdbus call --session \
    --dest org.gnome.Shell \
    --object-path /org/gnome/Shell \
    --method org.gnome.Shell.Eval \
    "JSON.stringify(global.get_window_actors().map(a => ({ title: a.meta_window ? a.meta_window.get_title() : '' })).filter(w => w.title))" 2>/dev/null \
    | sed -n "s/^(true, '\(.*\)')$/\1/p" \
    | sed "s/\\\\'/'/g" \
    | head -n 1
}

read_x11_focused_title() {
  if command -v xdotool >/dev/null 2>&1; then
    xdotool getwindowfocus getwindowname 2>/dev/null | head -n 1
    return 0
  fi

  if command -v wmctrl >/dev/null 2>&1; then
    wmctrl -lp 2>/dev/null | head -n 1 | cut -d' ' -f5-
    return 0
  fi

  return 1
}

read_x11_window_list() {
  if command -v wmctrl >/dev/null 2>&1; then
    wmctrl -lp 2>/dev/null | python3 - <<'PY'
import json
import sys

items = []
for line in sys.stdin:
    parts = line.strip().split(None, 4)
    if len(parts) < 5:
        continue
    pid = None
    try:
        pid = int(parts[2])
    except ValueError:
        pid = None
    items.append({"title": parts[4], "pid": pid})

print(json.dumps(items, ensure_ascii=False))
PY
    return 0
  fi

  return 1
}

capture_with_tool

if [[ -n "$WINDOW_TITLE_OVERRIDE" ]]; then
  focused_window_title="$WINDOW_TITLE_OVERRIDE"
elif [[ "$DESKTOP_ENV" == *GNOME* ]]; then
  if read_gnome_focused_title; then
    focused_window_title="$(printf '%s' "$gnome_focused_title_result" | trim)"
  fi
else
  focused_window_title="$(read_x11_focused_title | trim || true)"
fi

if [[ -z "$focused_window_title" ]]; then
  focused_window_title="Linux Work View"
fi

if [[ "$DESKTOP_ENV" == *GNOME* ]]; then
  window_list_json="$(read_gnome_window_list || true)"
fi

if [[ -z "$window_list_json" || "$window_list_json" == "[]" ]]; then
  window_list_json="$(read_x11_window_list || true)"
fi

if [[ -z "$window_list_json" ]]; then
  window_list_json="[]"
fi

if command -v tesseract >/dev/null 2>&1 && [[ -f "$SCREENSHOT_PATH" ]]; then
  tesseract "$SCREENSHOT_PATH" stdout >"$OCR_TEXT_PATH" 2>/dev/null || true
fi

export OPENCLAW_CAPTURE_SOURCE_NAME="$capture_source"
export OPENCLAW_CAPTURE_WINDOW_TITLE="$focused_window_title"
export OPENCLAW_CAPTURE_WINDOW_PID="$focused_window_pid"
export OPENCLAW_CAPTURE_SCREENSHOT_PATH="$SCREENSHOT_PATH"
export OPENCLAW_CAPTURE_OCR_TEXT_PATH="$OCR_TEXT_PATH"
export OPENCLAW_CAPTURE_WINDOW_LIST_JSON="$window_list_json"
export OPENCLAW_CAPTURE_SCREENSHOT_STATUS="$screenshot_status"
export OPENCLAW_CAPTURE_GNOME_EVAL_STATUS="$gnome_eval_status"

python3 - <<'PY'
import json
import os
from pathlib import Path

source = os.environ.get("OPENCLAW_CAPTURE_SOURCE_NAME", "linux-desktop")
title = os.environ.get("OPENCLAW_CAPTURE_WINDOW_TITLE", "Linux Work View")
pid_raw = os.environ.get("OPENCLAW_CAPTURE_WINDOW_PID", "0")
snapshot_path = os.environ.get("OPENCLAW_CAPTURE_SCREENSHOT_PATH", "")
ocr_path = os.environ.get("OPENCLAW_CAPTURE_OCR_TEXT_PATH", "")
window_list_raw = os.environ.get("OPENCLAW_CAPTURE_WINDOW_LIST_JSON", "[]")
session_type = os.environ.get("XDG_SESSION_TYPE", "unknown")
desktop_env = os.environ.get("XDG_CURRENT_DESKTOP", "unknown")
screenshot_status = os.environ.get("OPENCLAW_CAPTURE_SCREENSHOT_STATUS", "unknown")
gnome_eval_status = os.environ.get("OPENCLAW_CAPTURE_GNOME_EVAL_STATUS", "unknown")

try:
    pid = int(pid_raw)
except ValueError:
    pid = 0

try:
    window_list = json.loads(window_list_raw)
    if not isinstance(window_list, list):
        window_list = []
except json.JSONDecodeError:
    window_list = []

snapshot_text = (
    f"OpenClaw Linux capture adapter\n"
    f"Desktop: {desktop_env}\n"
    f"Session: {session_type}\n"
    f"Screenshot: {screenshot_status}\n"
    f"GNOME Eval: {gnome_eval_status}"
)
ocr_blocks = []

if ocr_path and Path(ocr_path).exists():
    snapshot_text = Path(ocr_path).read_text(encoding="utf-8", errors="ignore")
    for line in snapshot_text.splitlines():
        line = line.strip()
        if line:
            ocr_blocks.append({"text": line, "confidence": 0.9})
elif snapshot_path and Path(snapshot_path).exists():
    snapshot_text = f"Screenshot captured at {snapshot_path}\nDesktop: {desktop_env}\nSession: {session_type}"
else:
    snapshot_path = None

focused_window = {
    "title": title,
    "pid": pid if pid > 0 else None,
}

if not window_list:
    window_list = [focused_window]

payload = {
    "source": source,
    "snapshotPath": snapshot_path or None,
    "snapshotText": snapshot_text,
    "focusedWindow": focused_window,
    "windowList": window_list,
    "ocrBlocks": ocr_blocks,
}

print(json.dumps(payload, ensure_ascii=False, indent=2))
PY
