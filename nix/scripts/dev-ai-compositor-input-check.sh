#!/usr/bin/env bash
set -euo pipefail

CORE_URL="${OPENCLAW_CORE_URL:-http://127.0.0.1:4100}"
SESSION_MANAGER_URL="${OPENCLAW_SESSION_MANAGER_URL:-http://127.0.0.1:4102}"
SCREEN_SENSE_URL="${OPENCLAW_SCREEN_SENSE_URL:-http://127.0.0.1:4104}"
RUNTIME_DIR="${XDG_RUNTIME_DIR:?XDG_RUNTIME_DIR is required}/nixsoma-ai-graphical-session"
INPUT_DIR="$RUNTIME_DIR/input"
export OPENCLAW_OPERATOR_TOKEN_FILE="${OPENCLAW_OPERATOR_TOKEN_FILE:-$XDG_RUNTIME_DIR/nixsoma/operator-token}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"

tmp_dir="$(mktemp -d)"
cleanup() {
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

declare -A user_restart_baseline=()
declare -A system_restart_baseline=()

[[ -s "$OPENCLAW_OPERATOR_TOKEN_FILE" ]]
for unit in nixsoma-ai-graphical-session.service openclaw-session-manager.service openclaw-browser-runtime.service; do
  [[ "$(systemctl --user is-active "$unit")" == "active" ]]
  user_restart_baseline["$unit"]="$(systemctl --user show "$unit" -p NRestarts --value)"
done
for unit in openclaw-core.service openclaw-screen-act.service openclaw-screen-sense.service; do
  [[ "$(systemctl is-active "$unit")" == "active" ]]
  system_restart_baseline["$unit"]="$(systemctl show "$unit" -p NRestarts --value)"
done

[[ "$(stat -c '%a:%u:%F' "$INPUT_DIR")" == "700:$(id -u):directory" ]]
[[ "$(stat -c '%a:%u:%F' "$INPUT_DIR/control.sock")" == "600:$(id -u):socket" ]]
[[ "$(find "$INPUT_DIR" -mindepth 1 -maxdepth 1 -printf '%f\n')" == "control.sock" ]]

node - "$INPUT_DIR/control.sock" <<'NODE'
const net = require("node:net");
const socketPath = process.argv[2];
const socket = net.createConnection({ path: socketPath });
let received = 0;
const timeout = setTimeout(() => {
  socket.destroy(new Error("unauthorized peer was not rejected promptly"));
}, 1_000);
socket.on("connect", () => {
  socket.end(`1 ${"a".repeat(32)} ${"b".repeat(64)} 1 1 1\n`, "ascii");
});
socket.on("data", (chunk) => { received += chunk.length; });
socket.on("close", () => {
  clearTimeout(timeout);
  if (received !== 0) throw new Error("ordinary same-user peer received an input receipt");
});
socket.on("error", (error) => {
  clearTimeout(timeout);
  if (!["ECONNRESET", "EPIPE"].includes(error.code)) throw error;
});
NODE
grep -Eq "NixSoma input authority rejected an unauthorized peer" "$RUNTIME_DIR/weston.log"

curl -fsS "$SESSION_MANAGER_URL/work-view/state" > "$tmp_dir/before-state.json"
curl -fsS "$SESSION_MANAGER_URL/work-view/compositor-frame" > "$tmp_dir/frame.json"

node - "$tmp_dir/frame.json" "$tmp_dir/invoke.json" <<'NODE'
const fs = require("node:fs");
const frame = JSON.parse(fs.readFileSync(process.argv[2], "utf8")).frame;
if (!frame?.available || !frame.fresh) throw new Error("fresh native frame is unavailable");
const compositorFrame = Object.fromEntries([
  "registry", "socketName", "width", "height", "sha256", "sequence", "capturedAt",
].map((key) => [key, frame[key]]));
fs.writeFileSync(process.argv[3], JSON.stringify({
  capabilityId: "act.screen.pointer_keyboard",
  operation: "mouse.click",
  params: {
    x: 740,
    y: 22,
    button: "left",
    compositorFrame,
  },
}));
NODE

start_ms="$(date +%s%3N)"
post_json "$CORE_URL/capabilities/invoke" "$(<"$tmp_dir/invoke.json")" > "$tmp_dir/result.json"
finish_ms="$(date +%s%3N)"

curl -fsS "$SESSION_MANAGER_URL/work-view/state" > "$tmp_dir/after-state.json"
curl -fsS -X POST "$SCREEN_SENSE_URL/screen/refresh" > "$tmp_dir/screen.json"

node - "$tmp_dir" "$((finish_ms - start_ms))" <<'NODE'
const fs = require("node:fs");
const path = require("node:path");
const directory = process.argv[2];
const durationMs = Number(process.argv[3]);
const read = (name) => JSON.parse(fs.readFileSync(path.join(directory, name), "utf8"));
const before = read("before-state.json");
const captured = read("frame.json");
const result = read("result.json");
const after = read("after-state.json");
const screen = read("screen.json");
const frame = captured.frame ?? {};
const input = after.workView?.aiGraphicalSession?.compositorInput ?? {};
const boundary = after.workView?.aiGraphicalSession?.boundary ?? {};

if (before.workView?.aiGraphicalSession?.browserAttachment?.attached !== true
  || before.workView?.trustedSession?.helperRuntime?.status !== "active"
  || before.workView?.trustedSession?.helperRuntime?.actionAuthority !== "active"
  || before.workView?.trustedSession?.helperRuntime?.leaseMatched !== true) {
  throw new Error(`trusted native work view is not active: ${JSON.stringify(before.workView)}`);
}
if (result.ok !== true
  || result.invoked !== true
  || result.result?.action?.result !== "executed-ai-compositor"
  || result.result?.action?.mediation?.accepted !== true
  || result.result?.action?.mediation?.transport !== "ai-compositor-native"
  || result.result?.action?.mediation?.visualGrounding?.frameMatched !== true
  || result.result?.action?.mediation?.visualGrounding?.frameFresh !== true
  || result.result?.action?.mediation?.visualGrounding?.receiptMatched !== true
  || result.result?.action?.mediation?.visualGrounding?.sequenceAdvanced !== true
  || result.result?.governance?.compositorNativeExecuted !== true
  || result.result?.governance?.currentFrameBound !== true) {
  throw new Error(`governed compositor input failed: ${JSON.stringify(result)}`);
}
if (input.registry !== "nixsoma-ai-compositor-input-v0"
  || input.status !== "executed"
  || input.socketName !== "nixsoma-ai-0"
  || input.frame?.sha256 !== frame.sha256
  || input.frame?.sequence !== frame.sequence
  || input.postFrame?.sequence <= frame.sequence
  || input.postFrame?.sha256 === frame.sha256
  || input.frameMatched !== true
  || input.frameFresh !== true
  || input.leaseMatched !== true
  || input.receiptMatched !== true
  || input.sequenceAdvanced !== true
  || input.imageDataRetained !== false
  || input.persisted !== false
  || input.desktopWideInput !== false
  || input.parentDisplayConnected !== false
  || input.rootRequired !== false
  || input.hostMutation !== false
  || boundary.inputAuthority !== true
  || boundary.inputScope !== "ai_owned_nested_output_only"
  || boundary.arbitraryInputDevice !== false
  || boundary.desktopWideInput !== false) {
  throw new Error(`native input evidence is incomplete: ${JSON.stringify({ input, boundary })}`);
}
if (screen.screen?.aiGraphicalSession?.compositorInput?.requestId !== input.requestId
  || JSON.stringify(after).includes("data:image/png")
  || JSON.stringify(screen).includes("data:image/png")) {
  throw new Error("native input metadata projection leaked pixels or lost the receipt");
}

console.log(JSON.stringify({
  registry: input.registry,
  operation: input.operation,
  coordinates: `${input.x},${input.y}`,
  frameSequence: input.frame.sequence,
  postFrameSequence: input.postFrame.sequence,
  visualChange: input.postFrame.sha256 !== input.frame.sha256,
  durationMs,
  transport: result.result.action.mediation.transport,
  leaseMatched: input.leaseMatched,
  receiptMatched: input.receiptMatched,
  desktopWideInput: input.desktopWideInput,
  parentDisplayConnected: input.parentDisplayConnected,
  rootRequired: input.rootRequired,
  hostMutation: input.hostMutation,
}, null, 2));
NODE

[[ "$(find "$INPUT_DIR" -mindepth 1 -maxdepth 1 -printf '%f\n')" == "control.sock" ]]
grep -Eq "NixSoma fixed-output input authority is ready" "$RUNTIME_DIR/weston.log"
grep -Eq "NixSoma input authority executed request [a-f0-9]{32}" "$RUNTIME_DIR/weston.log"

for unit in nixsoma-ai-graphical-session.service openclaw-session-manager.service openclaw-browser-runtime.service; do
  [[ "$(systemctl --user is-active "$unit")" == "active" ]]
  [[ "$(systemctl --user show "$unit" -p NRestarts --value)" == "${user_restart_baseline[$unit]}" ]]
done
for unit in openclaw-core.service openclaw-screen-act.service openclaw-screen-sense.service; do
  [[ "$(systemctl is-active "$unit")" == "active" ]]
  [[ "$(systemctl show "$unit" -p NRestarts --value)" == "${system_restart_baseline[$unit]}" ]]
done
