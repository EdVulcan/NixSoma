#!/usr/bin/env bash
set -euo pipefail

CORE_URL="${OPENCLAW_CORE_URL:-http://127.0.0.1:4100}"
EVENT_HUB_URL="${OPENCLAW_EVENT_HUB_URL:-http://127.0.0.1:4101}"
SESSION_MANAGER_URL="${OPENCLAW_SESSION_MANAGER_URL:-http://127.0.0.1:4102}"
SCREEN_ACT_URL="${OPENCLAW_SCREEN_ACT_URL:-http://127.0.0.1:4105}"
OBSERVER_URL="${OPENCLAW_OBSERVER_URL:-http://127.0.0.1:4170}"
export OPENCLAW_OPERATOR_TOKEN_FILE="${OPENCLAW_OPERATOR_TOKEN_FILE:-${XDG_RUNTIME_DIR:?XDG_RUNTIME_DIR is required}/nixsoma/operator-token}"
AUTHORITY_URL="${NIXSOMA_AI_OCR_TYPE_AUTHORITY_URL:-https://example.org/}"
# Six distinct OCR-friendly letters are enough to bind this single physical run.
CANARY="${NIXSOMA_AI_OCR_TYPE_CANARY:-$(date +%H%M%S | tr '0123456789' 'ABCDEFGHJK')}"
TASK_GOAL="Type exact text \"$CANARY\" into the active surface"
RUNTIME_DIR="$XDG_RUNTIME_DIR/nixsoma-ai-graphical-session"
CAPTURE_DIR="$RUNTIME_DIR/capture"
WORKBENCH_ACTION_MARKER="$RUNTIME_DIR/workbench-action/acknowledged"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-ai-workspace-local-ocr-workbench-helper.sh"
export OPENCLAW_POST_JSON_FAILURE="${OPENCLAW_POST_JSON_FAILURE:-fail-with-body}"

stage() {
  printf 'AI workspace OCR type live gate: %s\n' "$1" >&2
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
    for name in prepare start activate task bind task-before type task-after state-after events invocations action-state stop; do
      if [[ -s "$tmp_dir/$name.json" ]]; then
        printf 'AI workspace OCR type failed response (%s.json):\n' "$name" >&2
        sed -n '1,160p' "$tmp_dir/$name.json" >&2
      fi
    done
  fi
  rm -rf "$tmp_dir"
  return "$status"
}
trap cleanup EXIT

stage "checking deployed services, operator credential, and local OCR configuration"
[[ -s "$OPENCLAW_OPERATOR_TOKEN_FILE" ]]
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

stage "preparing current work-view authority and fixed Workbench surface"
prepare_payload="$(node -e '
  console.log(JSON.stringify({
    capabilityId: "act.work_view.control",
    operation: "work_view.prepare",
    params: { displayTarget: "workspace-2", entryUrl: process.argv[1] },
  }));
' "$AUTHORITY_URL")"
post_json "$CORE_URL/capabilities/invoke" "$prepare_payload" > "$tmp_dir/prepare.json"
workbench_requested=1
read -r surface_id _ < <(openclaw_start_local_ocr_workbench "$tmp_dir")
[[ ! -e "$WORKBENCH_ACTION_MARKER" ]]

stage "confirming the canary is absent before provider egress"
pre_ocr_json="$(post_json "$CORE_URL/capabilities/invoke" \
  '{"capabilityId":"sense.ai.workspace.local_ocr","params":{"confirm":true}}')"
node -e '
  const response = JSON.parse(process.argv[1]);
  const canary = process.argv[2].toLowerCase();
  const text = (response.result?.items ?? []).map((item) => item.text).join(" ").toLowerCase();
  if (response.result?.registry !== "nixsoma-ai-workspace-local-ocr-v0"
    || text.includes(canary)) process.exit(1);
' "$pre_ocr_json" "$CANARY"

stage "creating and binding one exact reviewed OCR type task"
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
stage "requesting one task-bound provider decision and native opcode-5 type"
type_payload="$(node -e '
  console.log(JSON.stringify({
    capabilityId: "act.ai.workspace.ocr_type",
    taskId: process.argv[1],
    params: { confirm: true },
  }));
' "$task_id")"
type_json="$(post_json "$CORE_URL/capabilities/invoke" "$type_payload")"
printf '%s' "$type_json" > "$tmp_dir/type.json"

stage "confirming the newer transient visual effect with bounded local OCR"
post_ocr_json="$(post_json "$CORE_URL/capabilities/invoke" \
  '{"capabilityId":"sense.ai.workspace.local_ocr","params":{"confirm":true}}')"
printf '%s' "$post_ocr_json" > "$tmp_dir/post-ocr.json"
curl -fsS "$CORE_URL/tasks/$task_id" > "$tmp_dir/task-after.json"
curl -fsS "$EVENT_HUB_URL/events/audit?limit=700" > "$tmp_dir/events.json"
curl -fsS "$CORE_URL/capabilities/invocations?limit=180" > "$tmp_dir/invocations.json"
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
  -u nixsoma-ai-workbench.service \
  --no-pager > "$tmp_dir/user-journal.txt"

stage "verifying exact objective binding, opcode-5 receipt, audit, and no evidence plaintext"
node - \
  "$tmp_dir" \
  "$task_id" \
  "$surface_id" \
  "$CANARY" \
  3< <(printf '%s' "$type_json") <<'NODE'
const fs = require("node:fs");
const path = require("node:path");

const [directory, taskId, surfaceIdText, canary] = process.argv.slice(2);
const response = JSON.parse(fs.readFileSync(3, "utf8"));
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
const actionState = read("action-state.json");
const html = fs.readFileSync(path.join(directory, "observer.html"), "utf8");
const client = fs.readFileSync(path.join(directory, "observer-client.js"), "utf8");
const systemJournal = fs.readFileSync(path.join(directory, "system-journal.txt"), "utf8");
const userJournal = fs.readFileSync(path.join(directory, "user-journal.txt"), "utf8");
const surfaceId = Number(surfaceIdText);
const hash = (value) => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
const validInputEvidence = (value) => value?.registry === "openclaw-write-only-input-evidence-v0"
  && value.charCount === canary.length
  && value.byteLength === canary.length
  && value.maxChars === 32
  && value.truncated === false
  && value.textExposed === false
  && value.persisted === false;
const egress = events.find((event) =>
  event.type === "cloud_provider.ai_workspace_ocr_type_egress_authorized"
    && event.payload?.taskId === taskId
    && event.payload?.contextContentHash === evidence.contextContentHash
    && event.payload?.requestContentHash === evidence.requestContentHash);
const authorized = events.find((event) =>
  event.type === "ai_workspace.ocr_type_action_authorized"
    && event.payload?.taskId === taskId
    && event.payload?.surfaceId === surfaceId);
const completed = events.find((event) =>
  event.type === "ai_workspace.ocr_type_completed"
    && event.payload?.taskId === taskId
    && event.payload?.status === "executed"
    && event.payload?.postActionFrameContentHash === evidence.postActionFrameContentHash);
const requested = events.find((event) =>
  event.type === "screen.updated"
    && event.payload?.action === "ai-compositor-input-requested"
    && event.payload?.executionGrant?.taskId === taskId
    && event.payload?.input?.operation === "keyboard_type"
    && event.payload?.input?.inputCharCount === canary.length);
const executed = events.find((event) =>
  event.type === "screen.updated"
    && event.payload?.action === "ai-compositor-input-executed"
    && event.payload?.executionGrant?.taskId === taskId
    && event.payload?.input?.operation === "keyboard_type"
    && event.payload?.input?.receiptMatched === true);
const invocation = invocations.find((item) =>
  item.id === response.invocation?.id
    && item.summary?.kind === "ai.workspace.ocr_type"
    && item.summary?.taskId === taskId);
const ocrEvents = events.filter((event) =>
  event.type === "screen.updated"
    && event.payload?.action === "ai-local-ocr-observed"
    && [evidence.ocrSceneContentHash, evidence.verificationOcrSceneContentHash,
      evidence.postActionOcrSceneContentHash]
      .includes(event.payload?.localOcr?.sceneContentSha256));
const postText = (postOcr.items ?? []).map((item) => item?.text ?? "").join(" ");

const checks = [
  ["invoked", response.invoked === true],
  ["registry", result.registry === "nixsoma-ai-workspace-ocr-type-v0"],
  ["status", result.status === "executed"],
  ["decision", decision.actionId === "type_text"],
  ["decision_evidence", validInputEvidence(decision.inputEvidence)],
  ["action", action.actionId === "type_text" && action.executed === true],
  ["action_evidence", validInputEvidence(action.inputEvidence)],
  ["evidence_input", validInputEvidence(evidence.inputEvidence)],
  ["surface", action.surfaceId === surfaceId && Number.isInteger(action.inventorySequence)],
  ["hashes", [evidence.contextContentHash, evidence.requestContentHash,
    evidence.responseContentHash, evidence.frameContentHash, evidence.ocrSceneContentHash,
    evidence.ocrBindingHash, evidence.verificationFrameContentHash,
    evidence.verificationOcrSceneContentHash, evidence.postActionFrameContentHash,
    evidence.postActionOcrSceneContentHash].every(hash)],
  ["sequences", Number.isInteger(evidence.frameSequence)
    && evidence.verificationFrameSequence > evidence.frameSequence
    && evidence.postActionFrameSequence > evidence.verificationFrameSequence],
  ["receipt", evidence.actionExecuted === true && evidence.receiptMatched === true
    && evidence.frameChanged === true && evidence.postActionVerified === true
    && evidence.completionAudit === true],
  ["provider_budget", governance.providerCalled === true
    && governance.maximumProviderCalls === 1 && governance.maximumActions === 1],
  ["bindings", governance.localOcrBound === true
    && governance.localOcrRevalidated === true
    && governance.currentFrameBound === true
    && governance.currentActiveSurfaceBound === true
    && governance.taskObjectiveBound === true
    && governance.taskObjectiveInputBound === true],
  ["input_boundary", governance.providerGeneratedInput === true
    && governance.keyboardInput === true
    && governance.hotkeyInput === false
    && governance.enterKeyInput === false
    && governance.inputTextExposed === false
    && governance.inputTextPersisted === false
    && governance.arbitraryKeyboardInput === false],
  ["governance", governance.taskMutated === false
    && governance.automaticContinuation === false
    && governance.rawTaskGoalProviderEgress === false
    && governance.ocrTextPersistedLocally === false
    && governance.pixelsProviderEgress === false
    && governance.providerRetentionControlledExternally === true
    && governance.createsTask === false
    && governance.createsApproval === false
    && governance.parentDisplayConnected === false
    && governance.mutatesHost === false],
  ["egress", Boolean(egress)
    && egress.payload?.providerInputMustMatchTaskObjective === true
    && egress.payload?.inputTextPersistedLocally === false
    && egress.payload?.automaticRepeat === false],
  ["authorized", Boolean(authorized) && validInputEvidence(authorized.payload?.inputEvidence)],
  ["completed", Boolean(completed) && validInputEvidence(completed.payload?.inputEvidence)
    && completed.payload?.postActionVerified === true],
  ["opcode_5_request", Boolean(requested)
    && requested.payload?.input?.inputTextExposed === false
    && requested.payload?.input?.inputTextPersisted === false],
  ["opcode_5_receipt", Boolean(executed)
    && executed.payload?.input?.surfaceId === surfaceId
    && executed.payload?.input?.inputCharCount === canary.length
    && executed.payload?.input?.keyboardInput === true
    && executed.payload?.input?.hotkeyInput === false
    && executed.payload?.input?.enterKeyInput === false
    && executed.payload?.input?.automaticRepeat === false
    && executed.payload?.input?.postFrame?.sequence < evidence.postActionFrameSequence],
  ["owner_ocr", new Set(ocrEvents.map((event) =>
    event.payload.localOcr.sceneContentSha256)).size === 3],
  ["invocation", Boolean(invocation)
    && validInputEvidence(invocation.summary?.inputEvidence)
    && invocation.summary?.postActionVerified === true
    && invocation.summary?.arbitraryKeyboardInput === false],
  ["task_unchanged", before.id === taskId && after.id === taskId
    && before.goal === `Type exact text "${canary}" into the active surface`
    && after.goal === before.goal
    && after.status === before.status
    && after.updatedAt === before.updatedAt
    && after.outcome === before.outcome],
  ["post_ocr", postOcr.registry === "nixsoma-ai-workspace-local-ocr-v0"
    && postOcr.surface?.surfaceId === surfaceId
    && postText.toLowerCase().includes(canary.toLowerCase())],
  ["observer", html.includes('id="ocr-type-ai-workspace-button"')
    && client.includes('capabilityId: "act.ai.workspace.ocr_type"')
    && client.includes("nixsoma-ai-workspace-ocr-type-v0")],
  ["no_result_plaintext", !JSON.stringify(result).includes(canary)
    && !JSON.stringify(result).includes('"inputText"')],
];
const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name);
const durableEvidence = [
  JSON.stringify([egress, authorized, completed, requested, executed, ...ocrEvents]),
  JSON.stringify(invocations),
  JSON.stringify(state),
  JSON.stringify(actionState),
  systemJournal,
  userJournal,
];
if (durableEvidence.some((payload) => payload.includes(canary))) {
  failedChecks.push("plaintext_in_execution_evidence");
}
if (failedChecks.length > 0) {
  throw new Error(`OCR type evidence invalid: ${JSON.stringify({
    failedChecks, result, egress, authorized, completed, requested,
    executed, invocation, before, after, postText,
  })}`);
}

console.log(JSON.stringify({
  registry: result.registry,
  taskId,
  actionId: action.actionId,
  nativeOpcode: 5,
  surfaceId,
  inventorySequence: action.inventorySequence,
  inputCharCount: action.inputEvidence.charCount,
  providerCallCount: 1,
  ownerOcrObservationCount: 3,
  actionCount: 1,
  receiptMatched: true,
  postActionVerified: true,
  taskMutated: false,
  completionAudit: true,
  inputTextPersisted: false,
  hotkeyInput: false,
  enterKeyInput: false,
  automaticRepeat: false,
  providerRetentionControlledExternally: true,
}, null, 2));
NODE

[[ -z "$(find "$CAPTURE_DIR" -mindepth 1 -maxdepth 1 -print -quit)" ]]
if pgrep -f "$tesseract_path stdin stdout" >/dev/null 2>&1; then
  printf 'Tesseract process remained after bounded OCR type.\n' >&2
  exit 1
fi

stage "stopping the fixed Workbench and checking post-run service health"
post_json "$CORE_URL/capabilities/invoke" \
  '{"capabilityId":"act.work_view.control","operation":"work_view.application.stop","params":{}}' \
  > "$tmp_dir/stop.json"
workbench_requested=0
for _ in $(seq 1 100); do
  [[ "$(systemctl --user is-active nixsoma-ai-workbench.service)" == "inactive" ]] && break
  sleep 0.05
done
[[ "$(systemctl --user is-active nixsoma-ai-workbench.service)" == "inactive" ]]
[[ ! -e "$WORKBENCH_ACTION_MARKER" ]]
for endpoint in \
  "$CORE_URL/health" \
  "$EVENT_HUB_URL/health" \
  "$SESSION_MANAGER_URL/health" \
  "$SCREEN_ACT_URL/health" \
  "$OBSERVER_URL/health"
do
  curl -fsS "$endpoint" >/dev/null
done

stage "passed"
