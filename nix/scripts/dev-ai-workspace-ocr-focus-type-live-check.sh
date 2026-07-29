#!/usr/bin/env bash
set -euo pipefail

CORE_URL="${OPENCLAW_CORE_URL:-http://127.0.0.1:4100}"
EVENT_HUB_URL="${OPENCLAW_EVENT_HUB_URL:-http://127.0.0.1:4101}"
SESSION_MANAGER_URL="${OPENCLAW_SESSION_MANAGER_URL:-http://127.0.0.1:4102}"
BROWSER_RUNTIME_URL="${OPENCLAW_BROWSER_RUNTIME_URL:-http://127.0.0.1:4103}"
SCREEN_SENSE_URL="${OPENCLAW_SCREEN_SENSE_URL:-http://127.0.0.1:4104}"
SCREEN_ACT_URL="${OPENCLAW_SCREEN_ACT_URL:-http://127.0.0.1:4105}"
OBSERVER_URL="${OPENCLAW_OBSERVER_URL:-http://127.0.0.1:4170}"
export OPENCLAW_OPERATOR_TOKEN_FILE="${OPENCLAW_OPERATOR_TOKEN_FILE:-${XDG_RUNTIME_DIR:?XDG_RUNTIME_DIR is required}/nixsoma/operator-token}"
TARGET_URL="${NIXSOMA_AI_OCR_FOCUS_TYPE_URL:-https://httpbingo.org/forms/post}"
TARGET_SUBSTRING="${NIXSOMA_AI_OCR_FOCUS_TYPE_TARGET:-Customer}"
CANARY="${NIXSOMA_AI_OCR_FOCUS_TYPE_CANARY:-$(date +%H%M%S | tr '0123456789' 'ABCDEFGHJK')}"
TASK_GOAL="Focus the OCR item containing \"$TARGET_SUBSTRING\" and type exact text \"$CANARY\" into the active surface"
RUNTIME_DIR="$XDG_RUNTIME_DIR/nixsoma-ai-graphical-session"
CAPTURE_DIR="$RUNTIME_DIR/capture"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"
export OPENCLAW_POST_JSON_FAILURE="${OPENCLAW_POST_JSON_FAILURE:-fail-with-body}"

stage() {
  printf 'AI workspace OCR focus type live gate: %s\n' "$1" >&2
}

tmp_dir="$(mktemp -d)"
cleanup() {
  local status="$?"
  if (( status != 0 )); then
    for name in prepare navigate activate task bind task-before focus-type task-after post-ocr state-after events invocations action-state; do
      if [[ -s "$tmp_dir/$name.json" ]]; then
        printf 'AI workspace OCR focus type failed response (%s.json):\n' "$name" >&2
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
[[ "$TARGET_SUBSTRING" =~ ^[A-Za-z0-9\ .,_:-]{1,80}$ ]]
[[ "$CANARY" =~ ^[A-Z]{6}$ ]]
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

stage "preparing authority and opening the fixed public form through the governed browser"
post_json "$CORE_URL/capabilities/invoke" \
  '{"capabilityId":"act.work_view.control","operation":"work_view.prepare","params":{"displayTarget":"workspace-2"}}' \
  > "$tmp_dir/prepare.json"
navigate_payload="$(node -e '
  console.log(JSON.stringify({
    capabilityId: "act.browser.open",
    operation: "browser.new_tab",
    intent: "browser.new_tab",
    params: { url: process.argv[1] },
  }));
' "$TARGET_URL")"
post_json "$CORE_URL/capabilities/invoke" "$navigate_payload" > "$tmp_dir/navigate.json"

for _ in $(seq 1 120); do
  curl -fsS "$SESSION_MANAGER_URL/work-view/state" > "$tmp_dir/state.json"
  curl -fsS "$BROWSER_RUNTIME_URL/browser/state" > "$tmp_dir/browser.json"
  curl -fsS "$SCREEN_SENSE_URL/screen/semantic-scene" > "$tmp_dir/scene.json"
  if node -e '
    const fs = require("node:fs");
    const state = JSON.parse(fs.readFileSync(process.argv[1], "utf8")).workView ?? {};
    const browser = JSON.parse(fs.readFileSync(process.argv[2], "utf8")).browser ?? {};
    const scene = JSON.parse(fs.readFileSync(process.argv[3], "utf8")).scene ?? {};
    const expectedUrl = new URL(process.argv[4]).href;
    const surfaces = state.aiGraphicalSession?.surfaceInventory?.surfaces ?? [];
    const textbox = scene.items?.some((item) => item.role === "textbox"
      && /customer name/iu.test(item.name ?? ""));
    process.exit(state.status === "prepared"
      && state.helperRuntime?.actionAuthority === "active"
      && state.helperRuntime?.leaseMatched === true
      && browser.running === true
      && browser.activeUrl === expectedUrl
      && scene.available === true
      && textbox
      && surfaces.some((surface) => surface.pid === scene.browserPid) ? 0 : 1);
  ' "$tmp_dir/state.json" "$tmp_dir/browser.json" "$tmp_dir/scene.json" "$TARGET_URL"; then
    break
  fi
  sleep 0.1
done

read -r surface_id inventory_sequence active < <(node -e '
  const fs = require("node:fs");
  const state = JSON.parse(fs.readFileSync(process.argv[1], "utf8")).workView ?? {};
  const scene = JSON.parse(fs.readFileSync(process.argv[2], "utf8")).scene ?? {};
  const inventory = state.aiGraphicalSession?.surfaceInventory ?? {};
  const matches = inventory.surfaces?.filter((surface) => surface.pid === scene.browserPid) ?? [];
  if (matches.length !== 1 || !Number.isInteger(inventory.sequence)) process.exit(1);
  console.log(`${matches[0].surfaceId} ${inventory.sequence} ${matches[0].activated === true}`);
' "$tmp_dir/state.json" "$tmp_dir/scene.json")
if [[ "$active" != "true" ]]; then
  activation_payload="$(node -e '
    console.log(JSON.stringify({
      capabilityId: "act.work_view.control",
      operation: "work_view.surface.activate",
      params: { surfaceId: Number(process.argv[1]), inventorySequence: Number(process.argv[2]) },
    }));
  ' "$surface_id" "$inventory_sequence")"
  post_json "$CORE_URL/capabilities/invoke" "$activation_payload" > "$tmp_dir/activate.json"
fi

stage "confirming one OCR target region and an absent input canary"
target_ordinal=""
stable_projection_hash=""
stable_observation_count=0
for _ in $(seq 1 80); do
  pre_ocr_json="$(post_json "$CORE_URL/capabilities/invoke" \
    '{"capabilityId":"sense.ai.workspace.local_ocr","params":{"confirm":true}}')"
  if read -r candidate_ordinal candidate_projection_hash < <(node - "$TARGET_SUBSTRING" "$CANARY" 3< <(printf '%s' "$pre_ocr_json") <<'NODE'
const { createHash } = require("node:crypto");
const fs = require("node:fs");
const [target, canary] = process.argv.slice(2).map((value) => value.toLowerCase());
const response = JSON.parse(fs.readFileSync(3, "utf8"));
const result = response.result ?? {};
const items = result.items ?? [];
const providerItems = items.slice(0, 24);
const matches = providerItems.filter((item) =>
  (item?.text ?? "").toLowerCase().includes(target));
const allText = items.map((item) => item?.text ?? "").join(" ").toLowerCase();
if (result.registry !== "nixsoma-ai-workspace-local-ocr-v0"
  || matches.length !== 1
  || !Number.isInteger(matches[0].ordinal)
  || allText.includes(canary)) process.exit(1);
const projectionHash = createHash("sha256")
  .update(JSON.stringify(providerItems))
  .digest("hex");
console.log(`${matches[0].ordinal} ${projectionHash}`);
NODE
) && [[ "$candidate_ordinal" =~ ^[1-9][0-9]*$ ]]; then
    if [[ "$candidate_projection_hash" == "$stable_projection_hash" ]]; then
      ((stable_observation_count += 1))
    else
      stable_projection_hash="$candidate_projection_hash"
      stable_observation_count=1
    fi
    if (( stable_observation_count >= 3 )); then
      target_ordinal="$candidate_ordinal"
      break
    fi
  else
    stable_projection_hash=""
    stable_observation_count=0
  fi
  sleep 0.5
done
[[ "$target_ordinal" =~ ^[1-9][0-9]*$ ]]

stage "creating and binding one reviewed fixed focus-and-type task"
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
stage "requesting one provider decision and the fixed native click-then-type sequence"
focus_type_payload="$(node -e '
  console.log(JSON.stringify({
    capabilityId: "act.ai.workspace.ocr_focus_type",
    taskId: process.argv[1],
    params: { confirm: true },
  }));
' "$task_id")"
focus_type_json="$(post_json "$CORE_URL/capabilities/invoke" "$focus_type_payload")"
printf '%s' "$focus_type_json" > "$tmp_dir/focus-type.json"

stage "collecting final OCR, compact audits, and no-plaintext execution readbacks"
post_json "$CORE_URL/capabilities/invoke" \
  '{"capabilityId":"sense.ai.workspace.local_ocr","params":{"confirm":true}}' \
  > "$tmp_dir/post-ocr.json"
curl -fsS "$CORE_URL/tasks/$task_id" > "$tmp_dir/task-after.json"
curl -fsS "$EVENT_HUB_URL/events/audit?limit=1000" > "$tmp_dir/events.json"
curl -fsS "$CORE_URL/capabilities/invocations?limit=220" > "$tmp_dir/invocations.json"
curl -fsS "$SESSION_MANAGER_URL/work-view/state" > "$tmp_dir/state-after.json"
curl -fsS "$SCREEN_ACT_URL/act/state" > "$tmp_dir/action-state.json"
curl -fsS "$OBSERVER_URL/" > "$tmp_dir/observer.html"
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
  --no-pager > "$tmp_dir/user-journal.txt"

stage "verifying two receipts, final OCR, unchanged task, and bounded authority"
node - "$tmp_dir" "$task_id" "$surface_id" "$target_ordinal" "$CANARY" \
  3< <(printf '%s' "$focus_type_json") <<'NODE'
const fs = require("node:fs");
const path = require("node:path");

const [directory, taskId, surfaceIdText, targetOrdinalText, canary] = process.argv.slice(2);
const response = JSON.parse(fs.readFileSync(3, "utf8"));
const read = (name) => JSON.parse(fs.readFileSync(path.join(directory, name), "utf8"));
const result = response.result ?? {};
const decision = result.decision ?? {};
const actions = result.actions ?? [];
const focusAction = actions.find((action) => action?.actionId === "focus_item") ?? {};
const typeAction = actions.find((action) => action?.actionId === "type_text") ?? {};
const evidence = result.evidence ?? {};
const governance = result.governance ?? {};
const before = read("task-before.json").task ?? {};
const after = read("task-after.json").task ?? {};
const postOcr = read("post-ocr.json").result ?? {};
const events = read("events.json").items ?? [];
const invocations = read("invocations.json").items ?? [];
const state = read("state-after.json");
const actionState = read("action-state.json");
const html = fs.readFileSync(path.join(directory, "observer.html"), "utf8");
const client = fs.readFileSync(path.join(directory, "observer-client.js"), "utf8");
const systemJournal = fs.readFileSync(path.join(directory, "system-journal.txt"), "utf8");
const userJournal = fs.readFileSync(path.join(directory, "user-journal.txt"), "utf8");
const surfaceId = Number(surfaceIdText);
const targetOrdinal = Number(targetOrdinalText);
const hash = (value) => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
const inputEvidence = (value) => value?.registry === "openclaw-write-only-input-evidence-v0"
  && value.charCount === canary.length
  && value.byteLength === Buffer.byteLength(canary, "utf8")
  && value.maxChars === 32
  && value.truncated === false
  && value.textExposed === false
  && value.persisted === false;
const egress = events.find((event) =>
  event.type === "cloud_provider.ai_workspace_ocr_focus_type_egress_authorized"
    && event.payload?.taskId === taskId
    && event.payload?.contextContentHash === evidence.contextContentHash);
const focusAuthorized = events.find((event) =>
  event.type === "ai_workspace.ocr_focus_type_focus_authorized"
    && event.payload?.taskId === taskId
    && event.payload?.itemOrdinal === decision.itemOrdinal);
const typeAuthorized = events.find((event) =>
  event.type === "ai_workspace.ocr_focus_type_type_authorized"
    && event.payload?.taskId === taskId
    && event.payload?.itemOrdinal === decision.itemOrdinal);
const completed = events.find((event) =>
  event.type === "ai_workspace.ocr_focus_type_completed"
    && event.payload?.taskId === taskId
    && event.payload?.status === "executed"
    && event.payload?.actionCount === 2);
const inputEvents = events.filter((event) =>
  event.type === "screen.updated"
    && ["ai-compositor-input-requested", "ai-compositor-input-executed"]
      .includes(event.payload?.action)
    && event.payload?.executionGrant?.taskId === taskId);
const clickRequested = inputEvents.find((event) =>
  event.payload?.action === "ai-compositor-input-requested"
    && event.payload?.input?.operation === "pointer_click");
const clickExecuted = inputEvents.find((event) =>
  event.payload?.action === "ai-compositor-input-executed"
    && event.payload?.input?.operation === "pointer_click"
    && event.payload?.input?.receiptMatched === true);
const typeRequested = inputEvents.find((event) =>
  event.payload?.action === "ai-compositor-input-requested"
    && event.payload?.input?.operation === "keyboard_type"
    && event.payload?.input?.inputCharCount === canary.length);
const typeExecuted = inputEvents.find((event) =>
  event.payload?.action === "ai-compositor-input-executed"
    && event.payload?.input?.operation === "keyboard_type"
    && event.payload?.input?.receiptMatched === true
    && event.payload?.input?.inputCharCount === canary.length);
const invocation = invocations.find((item) =>
  item.id === response.invocation?.id
    && item.summary?.kind === "ai.workspace.ocr_focus_type"
    && item.summary?.taskId === taskId);
const postText = (postOcr.items ?? []).map((item) => item?.text ?? "").join(" ");
const executionProjection = {
  response,
  egress,
  focusAuthorized,
  typeAuthorized,
  completed,
  clickRequested,
  clickExecuted,
  typeRequested,
  typeExecuted,
  invocation,
  compositorInput: state.workView?.aiGraphicalSession?.compositorInput,
  actionState,
  systemJournal,
  userJournal,
};
const failedChecks = [];
const checks = [
  ["invoked", response.invoked === true],
  ["registry", result.registry === "nixsoma-ai-workspace-ocr-focus-type-v0"],
  ["status", result.status === "executed"],
  ["decision", decision.actionId === "focus_and_type"
    && Number.isInteger(decision.itemOrdinal)
    && decision.itemOrdinal >= 1
    && decision.itemOrdinal <= 24
    && inputEvidence(decision.inputEvidence)],
  ["actions", actions.length === 2
    && focusAction.index === 1
    && focusAction.itemOrdinal === decision.itemOrdinal
    && focusAction.executed === true
    && focusAction.surfaceId === surfaceId
    && typeAction.index === 2
    && typeAction.executed === true
    && typeAction.surfaceId === surfaceId
    && inputEvidence(typeAction.inputEvidence)],
  ["hashes", [
    evidence.contextContentHash,
    evidence.requestContentHash,
    evidence.responseContentHash,
    evidence.frameContentHash,
    evidence.ocrSceneContentHash,
    evidence.ocrBindingHash,
    evidence.verificationFrameContentHash,
    evidence.focusFrameContentHash,
    evidence.postActionFrameContentHash,
  ].every(hash)],
  ["sequences", Number.isInteger(evidence.frameSequence)
    && Number.isInteger(evidence.verificationFrameSequence)
    && Number.isInteger(evidence.focusFrameSequence)
    && Number.isInteger(evidence.postActionFrameSequence)
    && evidence.verificationFrameSequence > evidence.frameSequence
    && evidence.focusFrameSequence > evidence.verificationFrameSequence
    && evidence.postActionFrameSequence > evidence.focusFrameSequence],
  ["evidence", evidence.taskId === taskId
    && evidence.actionCount === 2
    && evidence.focusActionExecuted === true
    && evidence.focusActionVerified === true
    && evidence.typeActionExecuted === true
    && evidence.postActionVerified === true
    && evidence.outcomeUnknown === false
    && evidence.completionAudit === true
    && inputEvidence(evidence.inputEvidence)],
  ["governance", governance.providerCalled === true
    && governance.maximumProviderCalls === 1
    && governance.maximumActions === 2
    && governance.actionCount === 2
    && governance.fixedActionSequence === true
    && governance.localOcrBound === true
    && governance.localOcrRevalidated === true
    && governance.focusRevalidated === true
    && governance.currentFrameBound === true
    && governance.currentActiveSurfaceBound === true
    && governance.ocrItemOrdinalBound === true
    && governance.taskObjectiveInputBound === true
    && governance.providerGeneratedInput === true
    && governance.pointerInput === true
    && governance.keyboardInput === true
    && governance.hotkeyInput === false
    && governance.enterKeyInput === false
    && governance.automaticContinuation === false
    && governance.automaticRepeat === false
    && governance.inputTextExposed === false
    && governance.inputTextPersisted === false
    && governance.arbitraryPointerInput === false
    && governance.arbitraryKeyboardInput === false
    && governance.taskMutated === false
    && governance.mutatesHost === false],
  ["audits", Boolean(egress && focusAuthorized && typeAuthorized && completed)],
  ["native_events", Boolean(clickRequested && clickExecuted && typeRequested && typeExecuted)],
  ["invocation", invocation?.summary?.actionCount === 2
    && invocation.summary?.maximumActions === 2
    && invocation.summary?.focusActionVerified === true
    && invocation.summary?.postActionVerified === true],
  ["visual", postOcr.registry === "nixsoma-ai-workspace-local-ocr-v0"
    && postOcr.surface?.surfaceId === surfaceId
    && postText.toLowerCase().includes(canary.toLowerCase())],
  ["task_unchanged", before.id === after.id
    && before.goal === after.goal
    && before.status === after.status
    && before.updatedAt === after.updatedAt],
  ["observer", html.includes('id="ocr-focus-type-ai-workspace-button"')
    && client.includes("act.ai.workspace.ocr_focus_type")
    && client.includes("nixsoma-ai-workspace-ocr-focus-type-v0")],
  ["no_plaintext", !JSON.stringify(executionProjection).includes(canary)],
  ["preprobe_ordinal", Number.isInteger(targetOrdinal)
    && targetOrdinal >= 1
    && decision.itemOrdinal === targetOrdinal],
];
for (const [name, passed] of checks) if (!passed) failedChecks.push(name);
if (failedChecks.length > 0) {
  throw new Error(`OCR focus type evidence invalid: ${JSON.stringify({
    failedChecks, result, egress, focusAuthorized, typeAuthorized, completed,
    invocation, postText, before, after,
  })}`);
}
console.log(JSON.stringify({
  registry: result.registry,
  taskId,
  surfaceId,
  selectedItemOrdinal: decision.itemOrdinal,
  preprobeItemOrdinal: targetOrdinal,
  inputCharCount: evidence.inputEvidence.charCount,
  providerCallCount: 1,
  actionCount: 2,
  nativeOpcodes: [4, 5],
  ownerOcrObservationCount: 4,
  focusActionVerified: true,
  postActionVerified: true,
  taskMutated: false,
  completionAudit: true,
  executionEvidencePlaintext: false,
  enterKeyInput: false,
  automaticRepeat: false,
  providerRetentionControlledExternally: true,
}, null, 2));
NODE

[[ -z "$(find "$CAPTURE_DIR" -mindepth 1 -maxdepth 1 -print -quit)" ]]
if pgrep -f "$tesseract_path stdin stdout" >/dev/null 2>&1; then
  printf 'Tesseract process remained after bounded OCR focus type.\n' >&2
  exit 1
fi

stage "checking post-run service health"
for endpoint in \
  "$CORE_URL/health" \
  "$EVENT_HUB_URL/health" \
  "$SESSION_MANAGER_URL/health" \
  "$BROWSER_RUNTIME_URL/health" \
  "$SCREEN_SENSE_URL/health" \
  "$SCREEN_ACT_URL/health" \
  "$OBSERVER_URL/health"
do
  curl -fsS "$endpoint" >/dev/null
done

stage "passed"
