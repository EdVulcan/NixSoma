#!/usr/bin/env bash
set -euo pipefail

CORE_URL="${OPENCLAW_CORE_URL:-http://127.0.0.1:4100}"
EVENT_HUB_URL="${OPENCLAW_EVENT_HUB_URL:-http://127.0.0.1:4101}"
SESSION_MANAGER_URL="${OPENCLAW_SESSION_MANAGER_URL:-http://127.0.0.1:4102}"
OBSERVER_URL="${OPENCLAW_OBSERVER_URL:-http://127.0.0.1:4170}"
RUNTIME_DIR="$XDG_RUNTIME_DIR/nixsoma-ai-graphical-session"
CAPTURE_DIR="$RUNTIME_DIR/capture"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"
openclaw_use_deployed_operator_token
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-ai-workspace-local-ocr-workbench-helper.sh"
export OPENCLAW_POST_JSON_FAILURE="${OPENCLAW_POST_JSON_FAILURE:-fail-with-body}"

stage() {
  printf 'AI workspace local OCR live gate: %s\n' "$1" >&2
}

tmp_dir="$(mktemp -d)"
workbench_requested=0
cleanup() {
  local status="$?"
  if (( workbench_requested )); then
    post_json "$CORE_URL/capabilities/invoke" \
      '{"capabilityId":"act.work_view.control","operation":"work_view.application.stop","params":{}}' \
      >/dev/null 2>&1 || true
  fi
  rm -rf "$tmp_dir"
  return "$status"
}
trap cleanup EXIT

stage "checking deployed services and local OCR configuration"
[[ -s "$OPENCLAW_OPERATOR_TOKEN_FILE" ]]
for unit in \
  openclaw-core.service \
  openclaw-event-hub.service \
  openclaw-screen-sense.service \
  openclaw-screen-act.service \
  openclaw-system-sense.service \
  openclaw-system-heal.service \
  observer-ui.service
do
  [[ "$(systemctl is-active "$unit")" == "active" ]]
done
for unit in \
  nixsoma-ai-graphical-session.service \
  openclaw-session-manager.service \
  openclaw-browser-runtime.service
do
  [[ "$(systemctl --user is-active "$unit")" == "active" ]]
done
session_environment="$(systemctl --user show openclaw-session-manager.service -p Environment --value)"
[[ "$session_environment" == *"OPENCLAW_AI_LOCAL_OCR_ENABLED=1"* ]]
tesseract_path="$(tr ' ' '\n' <<<"$session_environment" | sed -n 's/^OPENCLAW_AI_LOCAL_OCR_TESSERACT_PATH=//p' | head -n 1)"
[[ "$tesseract_path" == /nix/store/*/bin/tesseract ]]
[[ -x "$tesseract_path" ]]
[[ -z "$(find "$CAPTURE_DIR" -mindepth 1 -maxdepth 1 -print -quit)" ]]

stage "starting the governed fixed local Workbench"
workbench_requested=1
read -r surface_id _ < <(openclaw_start_local_ocr_workbench "$tmp_dir")

start_time="$(date -Is)"
stage "requesting one authenticated read-only local OCR observation"
ocr_json="$(post_json "$CORE_URL/capabilities/invoke" \
  '{"capabilityId":"sense.ai.workspace.local_ocr","params":{"confirm":true}}')"

stage "verifying transient text, compact audit, and no plaintext state"
curl -fsS "$CORE_URL/capabilities/invocations" > "$tmp_dir/invocations.json"
curl -fsS "$EVENT_HUB_URL/events/audit?limit=300" > "$tmp_dir/events.json"
curl -fsS "$SESSION_MANAGER_URL/work-view/state" > "$tmp_dir/after-state.json"
curl -fsS "$OBSERVER_URL/client.js" > "$tmp_dir/observer-client.js"
journalctl --since "$start_time" \
  -u openclaw-core.service \
  -u openclaw-event-hub.service \
  -u observer-ui.service \
  --no-pager > "$tmp_dir/system-journal.txt"
journalctl --user --since "$start_time" \
  -u openclaw-session-manager.service \
  -u nixsoma-ai-graphical-session.service \
  -u nixsoma-ai-workbench.service \
  --no-pager > "$tmp_dir/user-journal.txt"

node - \
  "$surface_id" \
  "$tmp_dir/invocations.json" \
  "$tmp_dir/events.json" \
  "$tmp_dir/after-state.json" \
  "$tmp_dir/observer-client.js" \
  "$tmp_dir/system-journal.txt" \
  "$tmp_dir/user-journal.txt" \
  "$HOME/.local/state/openclaw" \
  "$HOME/.local/share/openclaw" \
  "$HOME/.cache/openclaw" 3< <(printf '%s' "$ocr_json") <<'NODE'
const fs = require("node:fs");
const path = require("node:path");

const [
  expectedSurfaceText,
  invocationsPath,
  eventsPath,
  statePath,
  observerPath,
  systemJournalPath,
  userJournalPath,
  ...persistentRoots
] = process.argv.slice(2);
const response = JSON.parse(fs.readFileSync(3, "utf8"));
const result = response.result ?? {};
const governance = result.governance ?? {};
const items = Array.isArray(result.items) ? result.items : [];
const expectedSurface = Number(expectedSurfaceText);
const validBounds = (bounds) => Number.isInteger(bounds?.x)
  && Number.isInteger(bounds?.y)
  && Number.isInteger(bounds?.width)
  && Number.isInteger(bounds?.height)
  && bounds.x >= 0
  && bounds.y >= 0
  && bounds.width > 0
  && bounds.height > 0
  && bounds.x + bounds.width <= 1280
  && bounds.y + bounds.height <= 720;
const validItem = (item, index) => item?.ordinal === index + 1
  && typeof item.text === "string"
  && item.text.length > 0
  && item.text.length <= 160
  && typeof item.confidence === "number"
  && item.confidence >= 0
  && item.confidence <= 1
  && validBounds(item.bounds);
const recognizedWorkbench = items.some((item) => /nixsoma|workbench|compositor|authority/iu.test(item.text));
if (response.invoked !== true
  || result.registry !== "nixsoma-ai-workspace-local-ocr-v0"
  || result.status !== "observed"
  || result.frame?.registry !== "nixsoma-ai-compositor-frame-v0"
  || result.frame?.socketName !== "nixsoma-ai-0"
  || result.frame?.width !== 1280
  || result.frame?.height !== 720
  || !/^[a-f0-9]{64}$/u.test(result.frame?.sha256 ?? "")
  || !/^[a-f0-9]{64}$/u.test(result.sceneContentSha256 ?? "")
  || result.surface?.surfaceId !== expectedSurface
  || result.itemCount !== items.length
  || items.length < 1
  || items.length > 64
  || !items.every(validItem)
  || result.characterCount !== items.reduce((total, item) => total + item.text.length, 0)
  || result.characterCount > 4096
  || !recognizedWorkbench
  || governance.localOcr !== true
  || governance.providerCalled !== false
  || governance.networkEgress !== false
  || governance.pixelsProviderEgress !== false
  || governance.maximumProviderCalls !== 0
  || governance.maximumActions !== 0
  || governance.actionExecuted !== false
  || governance.taskMutated !== false
  || governance.automaticContinuation !== false
  || governance.textTransient !== true
  || governance.textPersisted !== false
  || governance.browserStorage !== false
  || governance.parentDisplayConnected !== false
  || governance.desktopWideCapture !== false
  || governance.processLaunchExpanded !== false
  || governance.mutatesHost !== false
  || Object.prototype.hasOwnProperty.call(result.frame ?? {}, "dataUrl")) {
  throw new Error("local OCR physical result is invalid");
}

const invocations = JSON.parse(fs.readFileSync(invocationsPath, "utf8"));
const events = JSON.parse(fs.readFileSync(eventsPath, "utf8"));
const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
const observer = fs.readFileSync(observerPath, "utf8");
const invocation = invocations.items?.find((entry) => entry.id === response.invocation?.id);
const sessionEvent = events.items?.find((event) =>
  event.type === "screen.updated"
  && event.payload?.action === "ai-local-ocr-observed"
  && event.payload?.localOcr?.sceneContentSha256 === result.sceneContentSha256);
const capabilityEvent = events.items?.find((event) =>
  event.type === "capability.invoked"
  && event.payload?.invocation?.id === response.invocation?.id);
if (invocation?.summary?.kind !== "ai.workspace.local_ocr"
  || invocation.summary.sceneContentHash !== result.sceneContentSha256
  || invocation.summary.itemCount !== items.length
  || invocation.summary.maximumProviderCalls !== 0
  || invocation.summary.maximumActions !== 0
  || invocation.summary.textExposedInTransientResult !== true
  || invocation.summary.textPersisted !== false
  || sessionEvent?.payload?.localOcr?.textExposed !== false
  || sessionEvent.payload.localOcr.textPersisted !== false
  || capabilityEvent?.payload?.summary?.sceneContentHash !== result.sceneContentSha256
  || !observer.includes("sense.ai.workspace.local_ocr")
  || !observer.includes("nixsoma-ai-workspace-local-ocr-v0")
  || !observer.includes("ai-workspace-local-ocr-output")
  || JSON.stringify(state).includes("data:image/png")) {
  throw new Error("local OCR compact readback evidence is incomplete");
}

const canary = items
  .map((item) => item.text)
  .filter((text) => text.length >= 8 && /nixsoma|workbench|compositor|authority/iu.test(text))
  .sort((left, right) => right.length - left.length)[0];
if (!canary) throw new Error("local OCR did not return a stable Workbench canary");
const durablePayloads = [
  JSON.stringify(invocation),
  JSON.stringify(sessionEvent),
  JSON.stringify(capabilityEvent),
  JSON.stringify(state),
  fs.readFileSync(systemJournalPath, "utf8"),
  fs.readFileSync(userJournalPath, "utf8"),
];
function scanRoot(root, remaining = { bytes: 8 * 1024 * 1024 }) {
  if (!fs.existsSync(root) || remaining.bytes <= 0) return false;
  const stats = fs.lstatSync(root);
  if (stats.isSymbolicLink()) return false;
  if (stats.isDirectory()) {
    return fs.readdirSync(root).some((entry) => scanRoot(path.join(root, entry), remaining));
  }
  if (!stats.isFile() || stats.size > 1024 * 1024 || stats.size > remaining.bytes) return false;
  remaining.bytes -= stats.size;
  return fs.readFileSync(root).includes(Buffer.from(canary, "utf8"));
}
if (durablePayloads.some((payload) => payload.includes(canary))
  || persistentRoots.some((root) => scanRoot(root))) {
  throw new Error("recognized OCR canary entered durable state");
}

console.log(JSON.stringify({
  registry: result.registry,
  surfaceId: result.surface.surfaceId,
  frameSequence: result.frame.sequence,
  frameContentHash: result.frame.sha256,
  sceneContentHash: result.sceneContentSha256,
  itemCount: result.itemCount,
  characterCount: result.characterCount,
  recognizedWorkbench: true,
  providerCallCount: 0,
  actionCount: 0,
  textPersisted: false,
  pixelsProviderEgress: false,
  browserStorage: false,
}, null, 2));
NODE

[[ -z "$(find "$CAPTURE_DIR" -mindepth 1 -maxdepth 1 -print -quit)" ]]
if pgrep -f "$tesseract_path stdin stdout" >/dev/null 2>&1; then
  printf 'Tesseract process remained after bounded OCR completion.\n' >&2
  exit 1
fi

stage "checking post-observation service health"
for url in \
  http://127.0.0.1:4100/health \
  http://127.0.0.1:4101/health \
  http://127.0.0.1:4102/health \
  http://127.0.0.1:4103/health \
  http://127.0.0.1:4104/health \
  http://127.0.0.1:4105/health \
  http://127.0.0.1:4106/health \
  http://127.0.0.1:4107/health \
  http://127.0.0.1:4170/health
do
  curl -fsS "$url" >/dev/null
done
