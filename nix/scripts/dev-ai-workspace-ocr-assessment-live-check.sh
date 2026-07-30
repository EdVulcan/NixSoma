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
AUTHORITY_URL="${NIXSOMA_AI_OCR_ASSESSMENT_AUTHORITY_URL:-https://example.org/}"
TASK_GOAL="${NIXSOMA_AI_OCR_ASSESSMENT_TASK_GOAL:-Determine whether the main NixSoma workbench heading is visible}"
EXPECTED_OUTCOME="${NIXSOMA_AI_OCR_ASSESSMENT_EXPECTED_OUTCOME:-complete}"
RUNTIME_DIR="$XDG_RUNTIME_DIR/nixsoma-ai-graphical-session"
CAPTURE_DIR="$RUNTIME_DIR/capture"

if [[ ! "$EXPECTED_OUTCOME" =~ ^(complete|incomplete|blocked|unknown)$ ]]; then
  printf 'Unsupported NIXSOMA_AI_OCR_ASSESSMENT_EXPECTED_OUTCOME: %s\n' "$EXPECTED_OUTCOME" >&2
  exit 64
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"
openclaw_use_deployed_operator_token
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-ai-workspace-local-ocr-workbench-helper.sh"
export OPENCLAW_POST_JSON_FAILURE="${OPENCLAW_POST_JSON_FAILURE:-fail-with-body}"

stage() {
  printf 'AI workspace OCR assessment live gate: %s\n' "$1" >&2
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
    for name in prepare authority start activate task bind task-before assessment task-after; do
      if [[ -s "$tmp_dir/$name.json" ]]; then
        printf 'AI workspace OCR assessment failed response (%s.json):\n' "$name" >&2
        sed -n '1,120p' "$tmp_dir/$name.json" >&2
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

stage "starting and activating the governed fixed local Workbench"
workbench_requested=1
read -r surface_id _ < <(openclaw_start_local_ocr_workbench "$tmp_dir")

start_time="$(date -Is)"
stage "selecting one transient local OCR canary without filesystem storage"
ocr_probe_json="$(post_json "$CORE_URL/capabilities/invoke" \
  '{"capabilityId":"sense.ai.workspace.local_ocr","params":{"confirm":true}}')"
canary="$(node - 3< <(printf '%s' "$ocr_probe_json") <<'NODE'
const fs = require("node:fs");
const response = JSON.parse(fs.readFileSync(3, "utf8"));
const items = response.result?.items ?? [];
const canary = items
  .map((item) => item?.text)
  .filter((text) => typeof text === "string"
    && text.length >= 12
    && /compositor|authority|bounded/iu.test(text))
  .sort((left, right) => right.length - left.length)[0];
if (!canary) process.exit(1);
process.stdout.write(canary);
NODE
)"

stage "creating and binding one reviewed OCR assessment task"
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

stage "requesting one task-bound provider assessment over bounded OCR text"
assessment_payload="$(node -e '
  console.log(JSON.stringify({
    capabilityId: "sense.ai.workspace.ocr_assessment",
    taskId: process.argv[1],
    params: { confirm: true },
  }));
' "$task_id")"
assessment_json="$(post_json "$CORE_URL/capabilities/invoke" "$assessment_payload")"
printf '%s' "$assessment_json" > "$tmp_dir/assessment.json"

curl -fsS "$CORE_URL/tasks/$task_id" > "$tmp_dir/task-after.json"
curl -fsS "$EVENT_HUB_URL/events/audit?limit=500" > "$tmp_dir/events.json"
curl -fsS "$CORE_URL/capabilities/invocations?limit=100" > "$tmp_dir/invocations.json"
curl -fsS "$SESSION_MANAGER_URL/work-view/state" > "$tmp_dir/state-after.json"
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

stage "verifying task/OCR rebinding, compact audit, and no local plaintext state"
node - \
  "$tmp_dir" \
  "$task_id" \
  "$surface_id" \
  "$EXPECTED_OUTCOME" \
  "$HOME/.local/state/openclaw" \
  "$HOME/.local/share/openclaw" \
  "$HOME/.cache/openclaw" \
  3< <(printf '%s' "$assessment_json") \
  4< <(printf '%s' "$canary") <<'NODE'
const fs = require("node:fs");
const path = require("node:path");

const [directory, taskId, surfaceIdText, expectedOutcome, ...persistentRoots] =
  process.argv.slice(2);
const response = JSON.parse(fs.readFileSync(3, "utf8"));
const canary = fs.readFileSync(4, "utf8");
const read = (name) => JSON.parse(fs.readFileSync(path.join(directory, name), "utf8"));
const result = response.result ?? {};
const assessment = result.assessment ?? {};
const evidence = result.evidence ?? {};
const governance = result.governance ?? {};
const before = read("task-before.json").task ?? {};
const after = read("task-after.json").task ?? {};
const events = read("events.json").items ?? [];
const invocations = read("invocations.json").items ?? [];
const state = read("state-after.json");
const observer = fs.readFileSync(path.join(directory, "observer-client.js"), "utf8");
const hash = (value) => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
const egress = events.find((event) =>
  event.type === "cloud_provider.ai_workspace_ocr_assessment_egress_authorized"
    && event.payload?.taskId === taskId
    && event.payload?.contextContentHash === evidence.contextContentHash
    && event.payload?.requestContentHash === evidence.requestContentHash
    && event.payload?.ocrBindingHash === evidence.ocrBindingHash);
const completed = events.find((event) =>
  event.type === "ai_workspace.ocr_assessment_completed"
    && event.payload?.taskId === taskId
    && event.payload?.contextContentHash === evidence.contextContentHash
    && event.payload?.responseContentHash === evidence.responseContentHash
    && event.payload?.ocrBindingHash === evidence.ocrBindingHash);
const initialOcr = events.find((event) =>
  event.type === "screen.updated"
    && event.payload?.action === "ai-local-ocr-observed"
    && event.payload?.localOcr?.sceneContentSha256 === evidence.ocrSceneContentHash);
const verificationOcr = events.find((event) =>
  event.type === "screen.updated"
    && event.payload?.action === "ai-local-ocr-observed"
    && event.payload?.localOcr?.sceneContentSha256 === evidence.verificationOcrSceneContentHash);
const invocation = invocations.find((item) =>
  item.id === response.invocation?.id
    && item.summary?.kind === "ai.workspace.ocr_assessment"
    && item.summary?.taskId === taskId);
const actionAudit = events.find((event) =>
  event.payload?.taskId === taskId
    && (event.type === "ai_workspace.single_step_action_authorized"
      || event.type === "ai_workspace.single_step_completed"));

if (response.invoked !== true
  || result.registry !== "nixsoma-ai-workspace-ocr-assessment-v0"
  || result.status !== "assessed"
  || assessment.outcome !== expectedOutcome
  || typeof assessment.confidence !== "number"
  || assessment.confidence < 0
  || assessment.confidence > 1
  || !hash(evidence.contextContentHash)
  || !hash(evidence.requestContentHash)
  || !hash(evidence.responseContentHash)
  || !hash(evidence.frameContentHash)
  || !hash(evidence.ocrSceneContentHash)
  || !hash(evidence.ocrBindingHash)
  || !hash(evidence.verificationFrameContentHash)
  || !hash(evidence.verificationOcrSceneContentHash)
  || evidence.taskId !== taskId
  || evidence.surfaceId !== Number(surfaceIdText)
  || !Number.isInteger(evidence.frameSequence)
  || !Number.isInteger(evidence.verificationFrameSequence)
  || evidence.verificationFrameSequence <= evidence.frameSequence
  || !Number.isInteger(evidence.ocrItemCount)
  || evidence.ocrItemCount < 1
  || evidence.ocrItemCount > 24
  || !Number.isInteger(evidence.ocrCharacterCount)
  || evidence.ocrCharacterCount < 1
  || evidence.ocrCharacterCount > 1200
  || evidence.completionAudit !== true
  || governance.providerCalled !== true
  || governance.maximumProviderCalls !== 1
  || governance.maximumActions !== 0
  || governance.actionExecuted !== false
  || governance.taskMutated !== false
  || governance.automaticContinuation !== false
  || governance.localOcrBound !== true
  || governance.localOcrRevalidated !== true
  || governance.currentActiveSurfaceBound !== true
  || governance.taskObjectiveBound !== true
  || governance.taskObjectiveProviderEgress !== true
  || governance.rawTaskGoalProviderEgress !== false
  || governance.ocrTextProviderEgress !== true
  || governance.ocrTextPersistedLocally !== false
  || governance.pixelsProviderEgress !== false
  || governance.browserApiUsed !== false
  || governance.renderedTextMayContainVisibleUrlsOrValues !== true
  || governance.providerRetentionControlledExternally !== true
  || governance.createsTask !== false
  || governance.createsApproval !== false
  || governance.mutatesHost !== false
  || Object.prototype.hasOwnProperty.call(result, "items")
  || !egress
  || egress.payload.ocrTextEgress !== true
  || egress.payload.ocrTextPersistedLocally !== false
  || egress.payload.pixelsEgress !== false
  || egress.payload.frameHashEgress !== false
  || !completed
  || completed.payload.ocrTextPersistedLocally !== false
  || completed.payload.pixelsProviderEgress !== false
  || !initialOcr
  || !verificationOcr
  || initialOcr.id === verificationOcr.id
  || !invocation
  || invocation.summary.ocrTextProviderEgress !== true
  || invocation.summary.ocrTextPersistedLocally !== false
  || invocation.summary.pixelsProviderEgress !== false
  || actionAudit
  || before.id !== taskId
  || after.id !== taskId
  || before.status !== after.status
  || before.updatedAt !== after.updatedAt
  || !observer.includes("sense.ai.workspace.ocr_assessment")
  || !observer.includes("nixsoma-ai-workspace-ocr-assessment-v0")
  || !observer.includes("ocr-assess-ai-workspace-button")) {
  throw new Error(`OCR assessment evidence invalid: ${JSON.stringify({
    result, egress, completed, initialOcr, verificationOcr, invocation, before, after,
  })}`);
}

const durablePayloads = [
  JSON.stringify(result),
  JSON.stringify(egress),
  JSON.stringify(completed),
  JSON.stringify(initialOcr),
  JSON.stringify(verificationOcr),
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
  return fs.readFileSync(root).includes(Buffer.from(canary, "utf8"));
}
if (durablePayloads.some((payload) => payload.includes(canary))
  || persistentRoots.some((root) => scanRoot(root))) {
  throw new Error("provider-bound OCR canary entered local durable state");
}

console.log(JSON.stringify({
  registry: result.registry,
  taskId,
  outcome: assessment.outcome,
  confidence: assessment.confidence,
  surfaceId: evidence.surfaceId,
  frameSequence: evidence.frameSequence,
  verificationFrameSequence: evidence.verificationFrameSequence,
  ocrItemCount: evidence.ocrItemCount,
  ocrCharacterCount: evidence.ocrCharacterCount,
  providerCallCount: 1,
  localOcrObservationCountMinimum: 2,
  actionCount: 0,
  taskMutated: false,
  completionAudit: true,
  ocrTextProviderEgress: true,
  ocrTextPersistedLocally: false,
  pixelsProviderEgress: false,
  providerRetentionControlledExternally: true,
}, null, 2));
NODE

[[ -z "$(find "$CAPTURE_DIR" -mindepth 1 -maxdepth 1 -print -quit)" ]]
if pgrep -f "$tesseract_path stdin stdout" >/dev/null 2>&1; then
  printf 'Tesseract process remained after bounded OCR assessment.\n' >&2
  exit 1
fi

stage "checking post-assessment service health"
for url in "$CORE_URL" "$EVENT_HUB_URL" "$SESSION_MANAGER_URL" "$BROWSER_RUNTIME_URL" \
  "$SCREEN_SENSE_URL" "$SCREEN_ACT_URL" "$SYSTEM_SENSE_URL" "$SYSTEM_HEAL_URL" "$OBSERVER_URL"
do
  curl -fsS "$url/health" >/dev/null
done
