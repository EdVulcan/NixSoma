#!/usr/bin/env bash
set -euo pipefail

CORE_URL="${OPENCLAW_CORE_URL:-http://127.0.0.1:4100}"
EVENT_HUB_URL="${OPENCLAW_EVENT_HUB_URL:-http://127.0.0.1:4101}"
SESSION_MANAGER_URL="${OPENCLAW_SESSION_MANAGER_URL:-http://127.0.0.1:4102}"
BROWSER_RUNTIME_URL="${OPENCLAW_BROWSER_RUNTIME_URL:-http://127.0.0.1:4103}"
SCREEN_SENSE_URL="${OPENCLAW_SCREEN_SENSE_URL:-http://127.0.0.1:4104}"
SCREEN_ACT_URL="${OPENCLAW_SCREEN_ACT_URL:-http://127.0.0.1:4105}"
SYSTEM_SENSE_URL="${OPENCLAW_SYSTEM_SENSE_URL:-http://127.0.0.1:4106}"
SYSTEM_HEAL_URL="${OPENCLAW_SYSTEM_HEAL_URL:-http://127.0.0.1:4107}"
OBSERVER_URL="${OPENCLAW_OBSERVER_URL:-http://127.0.0.1:4170}"
AUTHORITY_URL="${NIXSOMA_AI_OCR_CLICK_AUTHORITY_URL:-https://example.org/}"
TASK_GOAL="${NIXSOMA_AI_OCR_CLICK_TASK_GOAL:-}"
RUNTIME_DIR="$XDG_RUNTIME_DIR/nixsoma-ai-graphical-session"
CAPTURE_DIR="$RUNTIME_DIR/capture"
WORKBENCH_ACTION_MARKER="$RUNTIME_DIR/workbench-action/acknowledged"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"
openclaw_use_deployed_operator_token
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-ai-workspace-local-ocr-workbench-helper.sh"
export OPENCLAW_POST_JSON_FAILURE="${OPENCLAW_POST_JSON_FAILURE:-fail-with-body}"

stage() {
  printf 'AI workspace OCR click live gate: %s\n' "$1" >&2
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
  if (( status != 0 )); then
    for name in prepare authority start activate task bind task-before click task-after stop; do
      if [[ -s "$tmp_dir/$name.json" ]]; then
        printf 'AI workspace OCR click failed response (%s.json):\n' "$name" >&2
        sed -n '1,140p' "$tmp_dir/$name.json" >&2
      fi
    done
  fi
  rm -rf "$tmp_dir"
  return "$status"
}
trap cleanup EXIT

stage "checking deployed services, operator credential, and local OCR configuration"
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

stage "preparing current work-view authority through the governed browser owner"
prepare_payload="$(node -e '
  console.log(JSON.stringify({
    capabilityId: "act.work_view.control",
    operation: "work_view.prepare",
    params: { displayTarget: "workspace-2", entryUrl: process.argv[1] },
  }));
' "$AUTHORITY_URL")"
post_json "$CORE_URL/capabilities/invoke" "$prepare_payload" > "$tmp_dir/prepare.json"
curl -fsS "$SESSION_MANAGER_URL/work-view/state" > "$tmp_dir/authority.json"
node -e '
  const fs = require("node:fs");
  const state = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  const workView = state.workView ?? {};
  const helper = workView.trustedSession?.helperRuntime ?? workView.helperRuntime ?? {};
  if (state.session?.status !== "running"
    || state.session?.role !== "ai-work-view"
    || workView.status !== "prepared"
    || workView.trustedSession?.sessionIdentity?.status !== "authoritative"
    || helper.status !== "active"
    || helper.actionAuthority !== "active"
    || helper.leaseMatched !== true
    || workView.aiGraphicalSession?.ready !== true) process.exit(1);
' "$tmp_dir/authority.json"

stage "starting and activating the governed fixed one-action Workbench"
workbench_requested=1
read -r surface_id _ < <(openclaw_start_local_ocr_workbench "$tmp_dir")

stage "confirming the visible OCR action target before provider egress"
target_canary=""
for _ in $(seq 1 20); do
  ocr_probe_json="$(post_json "$CORE_URL/capabilities/invoke" \
    '{"capabilityId":"sense.ai.workspace.local_ocr","params":{"confirm":true}}')"
  if target_canary="$(node - 3< <(printf '%s' "$ocr_probe_json") <<'NODE'
const fs = require("node:fs");
const response = JSON.parse(fs.readFileSync(3, "utf8"));
const items = response.result?.items ?? [];
const confirmTargets = items.filter((item) => /^confirm\b/iu.test(item?.text?.trim() ?? ""));
const labelTargets = items.filter((item) => /^ocr action target:?$/iu.test(item?.text?.trim() ?? ""));
const target = confirmTargets.length === 1
  ? confirmTargets[0]
  : labelTargets.length === 1 ? labelTargets[0] : null;
if (!Number.isInteger(target?.ordinal)) process.exit(1);
process.stdout.write(target.text);
NODE
)"; then
    break
  fi
  sleep 0.1
done
[[ -n "$target_canary" ]]
if [[ -z "$TASK_GOAL" ]]; then
  TASK_GOAL="Click the OCR item whose text is exactly \"$target_canary\" once"
fi

stage "creating and binding one reviewed OCR click task"
task_payload="$(node -e '
  console.log(JSON.stringify({ goal: process.argv[1], type: "browser_task", workViewStrategy: "ai-work-view" }));
' "$TASK_GOAL")"
post_json "$CORE_URL/tasks" "$task_payload" > "$tmp_dir/task.json"
task_id="$(node -e '
  const fs = require("node:fs");
  const data = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  if (data.ok !== true || typeof data.task?.id !== "string") process.exit(1);
  process.stdout.write(data.task.id);
' "$tmp_dir/task.json")"
bind_payload="$(node -e '
  console.log(JSON.stringify({
    capabilityId: "act.openclaw.engineering_context.work_view_bind",
    taskId: process.argv[1],
    params: { taskId: process.argv[1], confirm: true },
  }));
' "$task_id")"
post_json "$CORE_URL/capabilities/invoke" "$bind_payload" > "$tmp_dir/bind.json"
curl -fsS "$CORE_URL/tasks/$task_id" > "$tmp_dir/task-before.json"

start_time="$(date -Is)"
stage "requesting one task-bound provider-selected OCR ordinal click"
click_payload="$(node -e '
  console.log(JSON.stringify({
    capabilityId: "act.ai.workspace.ocr_click",
    taskId: process.argv[1],
    params: { confirm: true },
  }));
' "$task_id")"
click_json="$(post_json "$CORE_URL/capabilities/invoke" "$click_payload")"
printf '%s' "$click_json" > "$tmp_dir/click.json"

stage "observing the fixed post-click Workbench state"
post_ocr_json="$(post_json "$CORE_URL/capabilities/invoke" \
  '{"capabilityId":"sense.ai.workspace.local_ocr","params":{"confirm":true}}')"
printf '%s' "$post_ocr_json" > "$tmp_dir/post-ocr.json"
curl -fsS "$CORE_URL/tasks/$task_id" > "$tmp_dir/task-after.json"
curl -fsS "$EVENT_HUB_URL/events/audit?limit=700" > "$tmp_dir/events.json"
curl -fsS "$CORE_URL/capabilities/invocations?limit=150" > "$tmp_dir/invocations.json"
curl -fsS "$SESSION_MANAGER_URL/work-view/state" > "$tmp_dir/state-after.json"
curl -fsS "$OBSERVER_URL/client.js" > "$tmp_dir/observer-client.js"
journalctl --since "$start_time" \
  -u openclaw-core.service \
  -u openclaw-event-hub.service \
  -u openclaw-screen-act.service \
  -u observer-ui.service \
  --no-pager > "$tmp_dir/system-journal.txt"
journalctl --user --since "$start_time" \
  -u openclaw-session-manager.service \
  -u nixsoma-ai-graphical-session.service \
  -u nixsoma-ai-workbench.service \
  --no-pager > "$tmp_dir/user-journal.txt"

stage "verifying same-surface receipt, newer OCR, durable audit, and zero task mutation"
node - \
  "$tmp_dir" \
  "$task_id" \
  "$surface_id" \
  "$HOME/.local/state/openclaw" \
  "$HOME/.local/share/openclaw" \
  "$HOME/.cache/openclaw" \
  3< <(printf '%s' "$click_json") \
  4< <(printf '%s' "$target_canary") <<'NODE'
const fs = require("node:fs");
const path = require("node:path");

const [directory, taskId, surfaceIdText, ...persistentRoots] = process.argv.slice(2);
const response = JSON.parse(fs.readFileSync(3, "utf8"));
const targetCanary = fs.readFileSync(4, "utf8");
const read = (name) => JSON.parse(fs.readFileSync(path.join(directory, name), "utf8"));
const result = response.result ?? {};
const decision = result.decision ?? {};
const action = result.action ?? {};
const evidence = result.evidence ?? {};
const governance = result.governance ?? {};
const before = read("task-before.json").task ?? {};
const after = read("task-after.json").task ?? {};
const postOcr = read("post-ocr.json").result ?? {};
const events = read("events.json").items ?? [];
const invocations = read("invocations.json").items ?? [];
const state = read("state-after.json");
const observer = fs.readFileSync(path.join(directory, "observer-client.js"), "utf8");
const hash = (value) => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
const egress = events.find((event) =>
  event.type === "cloud_provider.ai_workspace_ocr_click_egress_authorized"
    && event.payload?.taskId === taskId
    && event.payload?.contextContentHash === evidence.contextContentHash
    && event.payload?.requestContentHash === evidence.requestContentHash
    && event.payload?.ocrBindingHash === evidence.ocrBindingHash);
const authorized = events.find((event) =>
  event.type === "ai_workspace.ocr_click_action_authorized"
    && event.payload?.taskId === taskId
    && event.payload?.itemOrdinal === action.itemOrdinal
    && event.payload?.surfaceId === action.surfaceId);
const completed = events.find((event) =>
  event.type === "ai_workspace.ocr_click_completed"
    && event.payload?.taskId === taskId
    && event.payload?.status === "executed"
    && event.payload?.postActionFrameContentHash === evidence.postActionFrameContentHash);
const ocrEvents = events.filter((event) =>
  event.type === "screen.updated"
    && event.payload?.action === "ai-local-ocr-observed"
    && [evidence.ocrSceneContentHash, evidence.verificationOcrSceneContentHash,
      evidence.postActionOcrSceneContentHash]
      .includes(event.payload?.localOcr?.sceneContentSha256));
const inputRequested = events.find((event) =>
  event.type === "screen.updated"
    && event.payload?.action === "ai-compositor-input-requested"
    && event.payload?.executionGrant?.taskId === taskId
    && event.payload?.input?.operation === "pointer_click"
    && event.payload?.input?.surfaceId === Number(surfaceIdText));
const inputExecuted = events.find((event) =>
  event.type === "screen.updated"
    && event.payload?.action === "ai-compositor-input-executed"
    && event.payload?.executionGrant?.taskId === taskId
    && event.payload?.input?.operation === "pointer_click"
    && event.payload?.input?.receiptMatched === true
    && event.payload?.input?.inventoryMatched === true
    && event.payload?.input?.surfaceMatched === true);
const invocation = invocations.find((item) =>
  item.id === response.invocation?.id
    && item.summary?.kind === "ai.workspace.ocr_click"
    && item.summary?.taskId === taskId);
const postText = (postOcr.items ?? []).map((item) => item?.text ?? "").join("\n");

if (response.invoked !== true
  || result.registry !== "nixsoma-ai-workspace-ocr-click-v0"
  || result.status !== "executed"
  || decision.actionId !== "click_item"
  || !Number.isInteger(decision.itemOrdinal)
  || decision.itemOrdinal < 1
  || decision.itemOrdinal > 24
  || action.actionId !== "click_item"
  || action.itemOrdinal !== decision.itemOrdinal
  || action.executed !== true
  || action.surfaceId !== Number(surfaceIdText)
  || !Number.isInteger(action.inventorySequence)
  || !Number.isInteger(action.x)
  || !Number.isInteger(action.y)
  || action.x < 0 || action.x >= 1280 || action.y < 0 || action.y >= 720
  || !hash(evidence.contextContentHash)
  || !hash(evidence.requestContentHash)
  || !hash(evidence.responseContentHash)
  || !hash(evidence.frameContentHash)
  || !hash(evidence.ocrSceneContentHash)
  || !hash(evidence.ocrBindingHash)
  || !hash(evidence.verificationFrameContentHash)
  || !hash(evidence.verificationOcrSceneContentHash)
  || !hash(evidence.postActionFrameContentHash)
  || !hash(evidence.postActionOcrSceneContentHash)
  || evidence.taskId !== taskId
  || evidence.surfaceId !== Number(surfaceIdText)
  || !Number.isInteger(evidence.frameSequence)
  || !Number.isInteger(evidence.verificationFrameSequence)
  || !Number.isInteger(evidence.postActionFrameSequence)
  || evidence.verificationFrameSequence <= evidence.frameSequence
  || evidence.postActionFrameSequence <= evidence.verificationFrameSequence
  || evidence.actionExecuted !== true
  || evidence.receiptMatched !== true
  || evidence.frameChanged !== true
  || evidence.postActionVerified !== true
  || evidence.completionAudit !== true
  || governance.providerCalled !== true
  || governance.maximumProviderCalls !== 1
  || governance.maximumActions !== 1
  || governance.actionExecuted !== true
  || governance.taskMutated !== false
  || governance.automaticContinuation !== false
  || governance.localOcrBound !== true
  || governance.localOcrRevalidated !== true
  || governance.currentFrameBound !== true
  || governance.currentActiveSurfaceBound !== true
  || governance.ocrItemOrdinalBound !== true
  || governance.postActionVerified !== true
  || governance.taskObjectiveBound !== true
  || governance.taskObjectiveProviderEgress !== true
  || governance.rawTaskGoalProviderEgress !== false
  || governance.ocrTextProviderEgress !== true
  || governance.ocrTextPersistedLocally !== false
  || governance.pixelsProviderEgress !== false
  || governance.arbitraryPointerInput !== false
  || governance.browserApiUsed !== false
  || governance.renderedTextMayContainVisibleUrlsOrValues !== true
  || governance.providerRetentionControlledExternally !== true
  || governance.createsTask !== false
  || governance.createsApproval !== false
  || governance.mutatesHost !== false
  || Object.prototype.hasOwnProperty.call(result, "items")
  || Object.prototype.hasOwnProperty.call(decision, "reason")
  || !egress
  || egress.payload.maximumActions !== 1
  || egress.payload.providerCoordinatesAllowed !== false
  || egress.payload.ocrTextEgress !== true
  || egress.payload.ocrTextPersistedLocally !== false
  || egress.payload.pixelsEgress !== false
  || egress.payload.frameHashEgress !== false
  || !authorized
  || !completed
  || completed.payload.receiptMatched !== true
  || completed.payload.postActionVerified !== true
  || completed.payload.ocrTextPersistedLocally !== false
  || completed.payload.pixelsProviderEgress !== false
  || new Set(ocrEvents.map((event) => event.payload.localOcr.sceneContentSha256)).size !== 3
  || !inputRequested
  || inputRequested.payload.input.frameSha256 !== evidence.verificationFrameContentHash
  || !inputExecuted
  || inputExecuted.payload.input.surfaceId !== Number(surfaceIdText)
  || inputExecuted.payload.input.inventorySequence !== action.inventorySequence
  || !invocation
  || invocation.summary.actionExecuted !== true
  || invocation.summary.receiptMatched !== true
  || invocation.summary.postActionVerified !== true
  || invocation.summary.ocrTextPersistedLocally !== false
  || invocation.summary.pixelsProviderEgress !== false
  || invocation.summary.arbitraryPointerInput !== false
  || before.id !== taskId
  || after.id !== taskId
  || before.status !== after.status
  || before.updatedAt !== after.updatedAt
  || before.outcome !== after.outcome
  || !/ocr action completed|acknowledged/iu.test(postText)
  || postText.includes(targetCanary)
  || !observer.includes("act.ai.workspace.ocr_click")
  || !observer.includes("nixsoma-ai-workspace-ocr-click-v0")
  || !observer.includes("ocr-click-ai-workspace-button")) {
  throw new Error(`OCR click evidence invalid: ${JSON.stringify({
    result, egress, authorized, completed, ocrEvents, inputRequested,
    inputExecuted, invocation, before, after, postText,
  })}`);
}

const durablePayloads = [
  JSON.stringify(result),
  JSON.stringify(egress),
  JSON.stringify(authorized),
  JSON.stringify(completed),
  JSON.stringify(inputRequested),
  JSON.stringify(inputExecuted),
  JSON.stringify(invocation.summary),
  JSON.stringify(state),
  fs.readFileSync(path.join(directory, "system-journal.txt"), "utf8"),
  fs.readFileSync(path.join(directory, "user-journal.txt"), "utf8"),
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
  return fs.readFileSync(root).includes(Buffer.from(targetCanary, "utf8"));
}
if (durablePayloads.some((payload) => payload.includes(targetCanary))
  || persistentRoots.some((root) => scanRoot(root))) {
  throw new Error("provider-bound OCR target entered local durable state");
}

console.log(JSON.stringify({
  registry: result.registry,
  taskId,
  actionId: action.actionId,
  itemOrdinal: action.itemOrdinal,
  surfaceId: action.surfaceId,
  inventorySequence: action.inventorySequence,
  frameSequence: evidence.frameSequence,
  verificationFrameSequence: evidence.verificationFrameSequence,
  postActionFrameSequence: evidence.postActionFrameSequence,
  providerCallCount: 1,
  ownerOcrObservationCount: 3,
  actionCount: 1,
  receiptMatched: true,
  postActionVerified: true,
  taskMutated: false,
  completionAudit: true,
  ocrTextProviderEgress: true,
  ocrTextPersistedLocally: false,
  pixelsProviderEgress: false,
  arbitraryPointerInput: false,
  providerRetentionControlledExternally: true,
}, null, 2));
NODE

[[ -z "$(find "$CAPTURE_DIR" -mindepth 1 -maxdepth 1 -print -quit)" ]]
if pgrep -f "$tesseract_path stdin stdout" >/dev/null 2>&1; then
  printf 'Tesseract process remained after bounded OCR click.\n' >&2
  exit 1
fi

stage "stopping the governed Workbench and verifying volatile action cleanup"
post_json "$CORE_URL/capabilities/invoke" \
  '{"capabilityId":"act.work_view.control","operation":"work_view.application.stop","params":{}}' \
  > "$tmp_dir/stop.json"
node -e '
  const fs = require("node:fs");
  const response = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  const application = response.result?.application ?? {};
  if (response.ok !== true
    || response.invoked !== true
    || response.blocked !== false
    || response.result?.action !== "stop_ai_workbench"
    || application.status !== "stopped"
    || application.active !== false) process.exit(1);
' "$tmp_dir/stop.json"
workbench_requested=0
for _ in $(seq 1 120); do
  if [[ "$(systemctl --user is-active nixsoma-ai-workbench.service)" == "inactive" \
    && ! -e "$WORKBENCH_ACTION_MARKER" ]]; then
    break
  fi
  sleep 0.05
done
[[ "$(systemctl --user is-active nixsoma-ai-workbench.service)" == "inactive" ]]
[[ ! -e "$WORKBENCH_ACTION_MARKER" ]]

stage "checking post-click service health"
for url in "$CORE_URL" "$EVENT_HUB_URL" "$SESSION_MANAGER_URL" "$BROWSER_RUNTIME_URL" \
  "$SCREEN_SENSE_URL" "$SCREEN_ACT_URL" "$SYSTEM_SENSE_URL" "$SYSTEM_HEAL_URL" "$OBSERVER_URL"
do
  curl -fsS "$url/health" >/dev/null
done
