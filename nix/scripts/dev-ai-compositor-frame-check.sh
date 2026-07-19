#!/usr/bin/env bash
set -euo pipefail

SESSION_MANAGER_URL="${OPENCLAW_SESSION_MANAGER_URL:-http://127.0.0.1:4102}"
BROWSER_RUNTIME_URL="${OPENCLAW_BROWSER_RUNTIME_URL:-http://127.0.0.1:4103}"
SCREEN_SENSE_URL="${OPENCLAW_SCREEN_SENSE_URL:-http://127.0.0.1:4104}"
OBSERVER_URL="${OPENCLAW_OBSERVER_URL:-http://127.0.0.1:4170}"
RUNTIME_DIR="${XDG_RUNTIME_DIR:?XDG_RUNTIME_DIR is required}/nixsoma-ai-graphical-session"
CAPTURE_DIR="$RUNTIME_DIR/capture"

tmp_dir="$(mktemp -d)"
cleanup() {
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

for unit in \
  nixsoma-ai-graphical-session.service \
  openclaw-session-manager.service \
  openclaw-browser-runtime.service
do
  [[ "$(systemctl --user is-active "$unit")" == "active" ]]
  [[ "$(systemctl --user show "$unit" -p NRestarts --value)" == "0" ]]
done

[[ "$(stat -c '%a:%u:%F' "$RUNTIME_DIR")" == "700:$(id -u):directory" ]]
[[ "$(stat -c '%a:%u:%F' "$CAPTURE_DIR")" == "700:$(id -u):directory" ]]
[[ "$(stat -c '%a:%u:%F' "$RUNTIME_DIR/nixsoma-ai-0")" == "700:$(id -u):socket" ]]
[[ -z "$(find "$CAPTURE_DIR" -mindepth 1 -maxdepth 1 -print -quit)" ]]

curl -fsS "$SESSION_MANAGER_URL/work-view/state" > "$tmp_dir/before.json"
curl -fsS "$BROWSER_RUNTIME_URL/browser/capture" > "$tmp_dir/browser.json"

start_ms="$(date +%s%3N)"
curl -fsS "$SESSION_MANAGER_URL/work-view/compositor-frame" > "$tmp_dir/compositor.json"
finish_ms="$(date +%s%3N)"

curl -fsS "$SESSION_MANAGER_URL/work-view/state" > "$tmp_dir/after.json"
curl -fsS -X POST "$SCREEN_SENSE_URL/screen/refresh" > "$tmp_dir/screen.json"
curl -fsS "$OBSERVER_URL/client.js" > "$tmp_dir/observer-client.js"

node - "$tmp_dir" "$((finish_ms - start_ms))" <<'NODE'
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const directory = process.argv[2];
const durationMs = Number(process.argv[3]);
const read = (name) => JSON.parse(fs.readFileSync(path.join(directory, name), "utf8"));
const before = read("before.json");
const captured = read("compositor.json");
const after = read("after.json");
const browser = read("browser.json");
const screen = read("screen.json");
const frame = captured.frame ?? {};
const beforeGraphical = before.workView?.aiGraphicalSession ?? {};
const afterGraphical = after.workView?.aiGraphicalSession ?? {};
const browserFrame = browser.capture?.visualFrame ?? {};
const screenGraphical = screen.screen?.aiGraphicalSession ?? {};

if (beforeGraphical.status !== "ready"
  || beforeGraphical.browserAttachment?.status !== "attached"
  || beforeGraphical.socket?.name !== "nixsoma-ai-0") {
  throw new Error(`nested Firefox is not ready: ${JSON.stringify(beforeGraphical)}`);
}
if (!captured.ok
  || frame.registry !== "nixsoma-ai-compositor-frame-v0"
  || frame.available !== true
  || frame.sourceScope !== "ai_owned_nested_output_only"
  || frame.captureApi !== "weston_output_capture_v1"
  || frame.socketName !== "nixsoma-ai-0"
  || frame.width !== 1280
  || frame.height !== 720
  || frame.byteLength <= 0
  || frame.byteLength > 256 * 1024
  || frame.browserScreenshotApi !== false
  || frame.desktopWideCapture !== false
  || frame.parentDisplayConnected !== false
  || frame.inputAuthority !== false
  || frame.persisted !== false
  || frame.dataExposed !== true) {
  throw new Error(`compositor frame contract failed: ${JSON.stringify(frame)}`);
}
const prefix = "data:image/png;base64,";
if (!frame.dataUrl?.startsWith(prefix)) throw new Error("compositor frame is not PNG data");
const bytes = Buffer.from(frame.dataUrl.slice(prefix.length), "base64");
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
if (!bytes.subarray(0, 8).equals(png)
  || bytes.length !== frame.byteLength
  || crypto.createHash("sha256").update(bytes).digest("hex") !== frame.sha256) {
  throw new Error("compositor frame bytes are not hash-bound PNG data");
}
if (browserFrame.width !== 960
  || browserFrame.height !== 540
  || browserFrame.mediaType !== "image/jpeg"
  || browserFrame.sourceScope !== "ai_owned_active_page_only"
  || browserFrame.sha256 === frame.sha256) {
  throw new Error("compositor frame was not distinguished from browser screenshot capture");
}
if (afterGraphical.compositorFrame?.sha256 !== frame.sha256
  || afterGraphical.compositorFrame?.dataExposed !== false
  || afterGraphical.boundary?.readsPixels !== true
  || afterGraphical.boundary?.inputAuthority !== false
  || screenGraphical.compositorFrame?.sha256 !== frame.sha256
  || JSON.stringify(after).includes("data:image/")
  || JSON.stringify(screen).includes("data:image/png")) {
  throw new Error("metadata projection leaked or lost compositor frame evidence");
}

console.log(JSON.stringify({
  registry: frame.registry,
  dimensions: `${frame.width}x${frame.height}`,
  byteLength: frame.byteLength,
  sha256: frame.sha256,
  durationMs,
  browserFrameSha256: browserFrame.sha256,
  browserScreenshotApi: false,
  desktopWideCapture: false,
  inputAuthority: false,
  persisted: false,
}, null, 2));
NODE

[[ -z "$(find "$CAPTURE_DIR" -mindepth 1 -maxdepth 1 -print -quit)" ]]
grep -Eq "NixSoma fixed output capture authority is ready" "$RUNTIME_DIR/weston.log"
grep -Eq "launching '.*/weston-screenshooter'" "$RUNTIME_DIR/weston.log"
if grep -Eq "unauthorized" "$RUNTIME_DIR/weston.log"; then
  echo "Weston rejected the compositor-owned capture client." >&2
  exit 1
fi

browser_pid="$(systemctl --user show openclaw-browser-runtime.service -p MainPID --value)"
browser_capture_path="/proc/$browser_pid/root$CAPTURE_DIR"
if ls -A "$browser_capture_path" >/dev/null 2>&1; then
  echo "Browser runtime can read the compositor capture directory." >&2
  exit 1
fi

grep -Eq "AI Compositor Frame" "$tmp_dir/observer-client.js"
[[ -z "$(systemctl --failed --no-legend --plain)" ]]
[[ -z "$(systemctl --user --failed --no-legend --plain)" ]]
