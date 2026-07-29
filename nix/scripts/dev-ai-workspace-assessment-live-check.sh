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
export OPENCLAW_OPERATOR_TOKEN_FILE="${OPENCLAW_OPERATOR_TOKEN_FILE:-${XDG_RUNTIME_DIR:?XDG_RUNTIME_DIR is required}/nixsoma/operator-token}"
TARGET_URL="${NIXSOMA_AI_ASSESSMENT_URL:-https://httpbingo.org/forms/post}"
TASK_GOAL="${NIXSOMA_AI_ASSESSMENT_TASK_GOAL:-Determine whether the Customer name textbox is visible}"
EXPECTED_OUTCOME="${NIXSOMA_AI_ASSESSMENT_EXPECTED_OUTCOME:-complete}"
ACCEPT_COMPLETE="${NIXSOMA_AI_ASSESSMENT_ACCEPT_COMPLETE:-0}"
REVIEWED_CYCLE="${NIXSOMA_AI_ASSESSMENT_REVIEWED_CYCLE:-0}"

if [[ ! "$EXPECTED_OUTCOME" =~ ^(complete|incomplete|blocked|unknown)$ ]]; then
  printf 'Unsupported NIXSOMA_AI_ASSESSMENT_EXPECTED_OUTCOME: %s\n' "$EXPECTED_OUTCOME" >&2
  exit 64
fi
if [[ "$ACCEPT_COMPLETE" != "0" && "$ACCEPT_COMPLETE" != "1" ]]; then
  printf 'Unsupported NIXSOMA_AI_ASSESSMENT_ACCEPT_COMPLETE: %s\n' "$ACCEPT_COMPLETE" >&2
  exit 64
fi
if [[ "$REVIEWED_CYCLE" != "0" && "$REVIEWED_CYCLE" != "1" ]]; then
  printf 'Unsupported NIXSOMA_AI_ASSESSMENT_REVIEWED_CYCLE: %s\n' "$REVIEWED_CYCLE" >&2
  exit 64
fi
if [[ "$ACCEPT_COMPLETE" == "1" && "$EXPECTED_OUTCOME" != "complete" ]]; then
  printf 'Assessment acceptance requires NIXSOMA_AI_ASSESSMENT_EXPECTED_OUTCOME=complete.\n' >&2
  exit 64
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"
export OPENCLAW_POST_JSON_FAILURE="${OPENCLAW_POST_JSON_FAILURE:-fail-with-body}"

stage() {
  printf 'AI workspace assessment live gate: %s\n' "$1" >&2
}

tmp_dir="$(mktemp -d)"
cleanup() {
  local status="$?"
  if (( status != 0 )); then
    for name in prepare navigate activate task bind assessment accept task-before task-after task-accepted; do
      if [[ -s "$tmp_dir/$name.json" ]]; then
        printf 'AI workspace assessment failed response (%s.json):\n' "$name" >&2
        sed -n '1,120p' "$tmp_dir/$name.json" >&2
      fi
    done
  fi
  rm -rf "$tmp_dir"
  return "$status"
}
trap cleanup EXIT

stage "checking deployed services and operator credential"
[[ -s "$OPENCLAW_OPERATOR_TOKEN_FILE" ]]
for unit in openclaw-core.service openclaw-event-hub.service openclaw-screen-sense.service openclaw-screen-act.service; do
  [[ "$(systemctl is-active "$unit")" == "active" ]]
done
for unit in nixsoma-ai-graphical-session.service openclaw-session-manager.service openclaw-browser-runtime.service; do
  [[ "$(systemctl --user is-active "$unit")" == "active" ]]
done

stage "preparing current work-view authority"
post_json "$CORE_URL/capabilities/invoke" \
  '{"capabilityId":"act.work_view.control","operation":"work_view.prepare","params":{"displayTarget":"workspace-2"}}' \
  > "$tmp_dir/prepare.json"

stage "opening the public assessment form through the governed browser owner"
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
    const textboxVisible = scene.items?.some((item) => item.role === "textbox"
      && /customer name/iu.test(item.name ?? ""));
    process.exit(state.status === "prepared"
      && state.helperRuntime?.actionAuthority === "active"
      && state.helperRuntime?.leaseMatched === true
      && browser.running === true
      && browser.activeUrl === expectedUrl
      && scene.available === true
      && textboxVisible
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
  const textboxVisible = scene.items?.some((item) => item.role === "textbox"
    && /customer name/iu.test(item.name ?? ""));
  if (matches.length !== 1 || !Number.isInteger(inventory.sequence) || !textboxVisible) process.exit(1);
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

for _ in $(seq 1 120); do
  curl -fsS "$SESSION_MANAGER_URL/work-view/state" > "$tmp_dir/active-state.json"
  curl -fsS "$SCREEN_SENSE_URL/screen/semantic-scene" > "$tmp_dir/active-scene.json"
  if node -e '
    const fs = require("node:fs");
    const state = JSON.parse(fs.readFileSync(process.argv[1], "utf8")).workView ?? {};
    const scene = JSON.parse(fs.readFileSync(process.argv[2], "utf8")).scene ?? {};
    const active = state.aiGraphicalSession?.surfaceInventory?.surfaces
      ?.filter((surface) => surface.activated === true) ?? [];
    process.exit(active.length === 1 && active[0].pid === scene.browserPid ? 0 : 1);
  ' "$tmp_dir/active-state.json" "$tmp_dir/active-scene.json"; then
    break
  fi
  sleep 0.1
done

stage "creating and binding one reviewed assessment task"
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

if [[ "$REVIEWED_CYCLE" == "1" ]]; then
  assessment_capability="act.ai.workspace.reviewed_cycle"
  stage "requesting one task-bound reviewed run and assessment cycle"
else
  assessment_capability="sense.ai.workspace.assessment"
  stage "requesting one task-bound read-only assessment"
fi
assessment_payload="$(node -e '
  console.log(JSON.stringify({
    capabilityId: process.argv[2],
    taskId: process.argv[1],
    params: { confirm: true },
  }));
' "$task_id" "$assessment_capability")"
post_json "$CORE_URL/capabilities/invoke" "$assessment_payload" > "$tmp_dir/assessment.json"
curl -fsS "$CORE_URL/tasks/$task_id" > "$tmp_dir/task-after.json"
curl -fsS "$EVENT_HUB_URL/events/audit?limit=400" > "$tmp_dir/events.json"
curl -fsS "$CORE_URL/capabilities/invocations?limit=100" > "$tmp_dir/invocations.json"

stage "checking post-assessment service health"
for url in "$CORE_URL" "$EVENT_HUB_URL" "$SESSION_MANAGER_URL" "$BROWSER_RUNTIME_URL" \
  "$SCREEN_SENSE_URL" "$SCREEN_ACT_URL" "$SYSTEM_SENSE_URL" "$SYSTEM_HEAL_URL" "$OBSERVER_URL"; do
  curl -fsS "$url/health" > /dev/null
done

stage "verifying task binding, durable audit, and zero mutation"
node - "$tmp_dir" "$task_id" "$TASK_GOAL" "$EXPECTED_OUTCOME" "$REVIEWED_CYCLE" <<'NODE'
const fs = require("node:fs");
const path = require("node:path");
const directory = process.argv[2];
const taskId = process.argv[3];
const taskGoal = process.argv[4];
const expectedOutcome = process.argv[5];
const reviewedCycle = process.argv[6] === "1";
const read = (name) => JSON.parse(fs.readFileSync(path.join(directory, name), "utf8"));
const response = read("assessment.json");
const outerResult = response.result ?? {};
const result = reviewedCycle ? outerResult.assessment ?? {} : outerResult;
const evidence = result.evidence ?? {};
const governance = result.governance ?? {};
const cycleEvidence = outerResult.evidence ?? {};
const cycleGovernance = outerResult.governance ?? {};
const run = reviewedCycle ? outerResult.run ?? {} : null;
const runEvidence = run?.evidence ?? {};
const steps = run?.steps ?? [];
const events = read("events.json").items ?? [];
const invocations = read("invocations.json").items ?? [];
const before = read("task-before.json").task ?? {};
const after = read("task-after.json").task ?? {};
const hash = (value) => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
const egress = events.find((event) =>
  event.type === "cloud_provider.ai_workspace_assessment_egress_authorized"
    && event.payload?.taskId === taskId
    && event.payload?.contextContentHash === evidence.contextContentHash
    && event.payload?.requestContentHash === evidence.requestContentHash);
const completed = events.find((event) =>
  event.type === "ai_workspace.assessment_completed"
    && event.payload?.taskId === taskId
    && event.payload?.contextContentHash === evidence.contextContentHash
    && event.payload?.responseContentHash === evidence.responseContentHash);
const actionAudit = events.find((event) =>
  event.payload?.taskId === taskId
    && (event.type === "ai_workspace.single_step_action_authorized"
      || event.type === "ai_workspace.single_step_completed"));
const runCompleted = events.find((event) =>
  event.type === "ai_workspace.bounded_run_completed"
    && event.payload?.steps?.[0]?.taskId === taskId);
const assessmentContinuation = events.find((event) =>
  event.type === "ai_workspace.reviewed_cycle_assessment_authorized"
    && event.payload?.taskId === taskId);
const cycleCompleted = events.find((event) =>
  event.type === "ai_workspace.reviewed_cycle_completed"
    && event.payload?.taskId === taskId);
const expectedInvocationKind = reviewedCycle
  ? "ai.workspace.reviewed_cycle"
  : "ai.workspace.assessment";
const invocation = invocations.find((item) => item.summary?.kind === expectedInvocationKind
  && item.summary?.taskId === taskId
  && (reviewedCycle
    ? item.summary?.assessment?.responseContentHash === evidence.responseContentHash
    : item.summary?.responseContentHash === evidence.responseContentHash));
const durable = JSON.stringify({
  egress,
  completed,
  runCompleted,
  assessmentContinuation,
  cycleCompleted,
  invocationSummary: invocation?.summary,
});

const assessmentValid = result.registry === "nixsoma-ai-workspace-task-assessment-v0"
  && result.status === "assessed"
  && result.assessment?.outcome === expectedOutcome
  && typeof result.assessment?.confidence === "number"
  && result.assessment.confidence >= 0
  && result.assessment.confidence <= 1
  && hash(evidence.contextContentHash)
  && hash(evidence.requestContentHash)
  && hash(evidence.responseContentHash)
  && hash(evidence.sceneContentHash)
  && hash(evidence.objectiveContentHash)
  && hash(evidence.taskVersionHash)
  && evidence.taskId === taskId
  && evidence.completionAudit === true
  && governance.providerCalled === true
  && governance.maximumProviderCalls === 1
  && governance.maximumActions === 0
  && governance.actionExecuted === false
  && governance.taskMutated === false
  && governance.automaticContinuation === false
  && governance.semanticSceneBound === true
  && governance.currentBrowserSurfaceBound === true
  && governance.taskObjectiveBound === true
  && governance.taskObjectiveProviderEgress === true
  && governance.rawTaskGoalProviderEgress === false
  && governance.pixelsProviderEgress === false
  && governance.urlsProviderEgress === false
  && governance.inputValuesProviderEgress === false
  && governance.createsTask === false
  && governance.createsApproval === false
  && governance.mutatesHost === false;
const directValid = !reviewedCycle
  || (outerResult.registry === "nixsoma-ai-workspace-reviewed-cycle-v0"
    && outerResult.status === "assessed"
    && run.registry === "nixsoma-ai-workspace-bounded-run-v0"
    && steps.length >= 1
    && steps.length <= 2
    && steps[0].status !== "local_fallback"
    && steps.every((step) => step.providerCalled === true
      && step.completionAudit === true
      && step.taskId === taskId
      && step.objectiveContentHash === evidence.objectiveContentHash
      && step.taskVersionHash === evidence.taskVersionHash)
    && runEvidence.runCompletionAudit === true
    && runEvidence.outcomeUnknown === false
    && cycleEvidence.taskId === taskId
    && cycleEvidence.objectiveContentHash === evidence.objectiveContentHash
    && cycleEvidence.taskVersionHash === evidence.taskVersionHash
    && cycleEvidence.providerCallCount === runEvidence.providerCallCount + 1
    && cycleEvidence.providerCallCount >= 2
    && cycleEvidence.providerCallCount <= 3
    && cycleEvidence.actionCount === runEvidence.actionCount
    && cycleEvidence.runCompletionAudit === true
    && cycleEvidence.assessmentContinuationAudit === true
    && cycleEvidence.assessmentCompletionAudit === true
    && cycleEvidence.cycleCompletionAudit === true
    && cycleEvidence.assessmentReceiptEligible === (expectedOutcome === "complete")
    && cycleEvidence.outcomeUnknown === false
    && cycleGovernance.maximumProviderCalls === 3
    && cycleGovernance.maximumActions === 2
    && cycleGovernance.taskMutated === false
    && cycleGovernance.automaticTaskCompletion === false
    && cycleGovernance.requiresOperatorAcceptance === true
    && cycleGovernance.providerTriggeredCompletion === false
    && cycleGovernance.mutatesHost === false
    && runCompleted
    && assessmentContinuation
    && cycleCompleted
    && actionAudit?.type === "ai_workspace.single_step_completed"
    && invocation?.summary?.cycleCompletionAudit === true
    && invocation?.summary?.assessmentReceiptEligible === (expectedOutcome === "complete")
    && invocation?.summary?.assessment?.responseContentHash === evidence.responseContentHash);

if (response.invoked !== true
  || !assessmentValid
  || !directValid
  || !egress
  || !completed
  || !invocation
  || (!reviewedCycle && actionAudit)
  || before.id !== taskId
  || after.id !== taskId
  || before.status !== after.status
  || before.updatedAt !== after.updatedAt
  || durable.includes(taskGoal)
  || durable.includes('"reason"')
  || durable.includes("targetId")
  || durable.includes("selector")) {
  throw new Error(`assessment evidence invalid: ${JSON.stringify({ outerResult, egress, completed, runCompleted, assessmentContinuation, cycleCompleted, invocation, before, after })}`);
}

console.log(JSON.stringify({
  registry: outerResult.registry,
  taskId,
  outcome: result.assessment.outcome,
  confidence: result.assessment.confidence,
  sceneItemCount: evidence.sceneItemCount,
  providerCallCount: reviewedCycle ? cycleEvidence.providerCallCount : 1,
  actionCount: reviewedCycle ? cycleEvidence.actionCount : 0,
  runCompletionAudit: reviewedCycle ? cycleEvidence.runCompletionAudit : null,
  assessmentContinuationAudit: reviewedCycle
    ? cycleEvidence.assessmentContinuationAudit
    : null,
  completionAudit: evidence.completionAudit,
  cycleCompletionAudit: reviewedCycle ? cycleEvidence.cycleCompletionAudit : null,
  taskMutated: governance.taskMutated,
  automaticContinuation: reviewedCycle ? null : governance.automaticContinuation,
  automaticTaskCompletion: reviewedCycle
    ? cycleGovernance.automaticTaskCompletion
    : null,
  requiresOperatorAcceptance: reviewedCycle
    ? cycleGovernance.requiresOperatorAcceptance
    : null,
  providerReasonPersisted: false,
}, null, 2));
NODE

if [[ "$ACCEPT_COMPLETE" == "1" ]]; then
  stage "accepting the exact verified complete assessment"
  acceptance_payload="$(node -e '
    const fs = require("node:fs");
    const response = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    const outerResult = response.result ?? {};
    const result = outerResult.registry === "nixsoma-ai-workspace-reviewed-cycle-v0"
      ? outerResult.assessment ?? {}
      : outerResult;
    const evidence = result.evidence ?? {};
    if (response.invoked !== true
      || result.status !== "assessed"
      || result.assessment?.outcome !== "complete"
      || typeof response.invocation?.id !== "string") process.exit(1);
    console.log(JSON.stringify({
      capabilityId: "act.ai.workspace.accept_assessment",
      taskId: process.argv[2],
      params: {
        confirm: true,
        assessmentInvocationId: response.invocation.id,
        objectiveContentHash: evidence.objectiveContentHash,
        taskVersionHash: evidence.taskVersionHash,
        responseContentHash: evidence.responseContentHash,
        sceneContentHash: evidence.sceneContentHash,
      },
    }));
  ' "$tmp_dir/assessment.json" "$task_id")"
  post_json "$CORE_URL/capabilities/invoke" "$acceptance_payload" > "$tmp_dir/accept.json"
  curl -fsS "$CORE_URL/tasks/$task_id" > "$tmp_dir/task-accepted.json"
  curl -fsS "$EVENT_HUB_URL/events/audit?limit=400" > "$tmp_dir/events-accepted.json"
  curl -fsS "$CORE_URL/capabilities/invocations?limit=100" > "$tmp_dir/invocations-accepted.json"
  curl -fsS "$OBSERVER_URL/client-v5.js" > "$tmp_dir/observer-client.js"
  for token in 'act.ai.workspace.accept_assessment' \
    'nixsoma-ai-workspace-assessment-acceptance-v0' \
    'accept-ai-workspace-assessment-button' \
    'act.ai.workspace.reviewed_cycle' \
    'run-ai-workspace-reviewed-cycle-button'; do
    grep -Fq -- "$token" "$tmp_dir/observer-client.js"
  done

  stage "checking post-acceptance service health"
  for url in "$CORE_URL" "$EVENT_HUB_URL" "$SESSION_MANAGER_URL" "$BROWSER_RUNTIME_URL" \
    "$SCREEN_SENSE_URL" "$SCREEN_ACT_URL" "$SYSTEM_SENSE_URL" "$SYSTEM_HEAL_URL" "$OBSERVER_URL"; do
    curl -fsS "$url/health" > /dev/null
  done

  stage "verifying explicit acceptance, durable audit, and task closure"
  node - "$tmp_dir" "$task_id" "$TASK_GOAL" <<'NODE'
const fs = require("node:fs");
const path = require("node:path");
const directory = process.argv[2];
const taskId = process.argv[3];
const taskGoal = process.argv[4];
const read = (name) => JSON.parse(fs.readFileSync(path.join(directory, name), "utf8"));
const assessmentResponse = read("assessment.json");
const assessmentOuter = assessmentResponse.result ?? {};
const assessment = assessmentOuter.registry === "nixsoma-ai-workspace-reviewed-cycle-v0"
  ? assessmentOuter.assessment ?? {}
  : assessmentOuter;
const assessmentEvidence = assessment.evidence ?? {};
const response = read("accept.json");
const result = response.result ?? {};
const evidence = result.evidence ?? {};
const governance = result.governance ?? {};
const task = read("task-accepted.json").task ?? {};
const events = read("events-accepted.json").items ?? [];
const invocations = read("invocations-accepted.json").items ?? [];
const acceptanceAudit = events.find((event) =>
  event.type === "ai_workspace.assessment_acceptance_authorized"
    && event.payload?.taskId === taskId
    && event.payload?.assessmentInvocationId === assessmentResponse.invocation?.id
    && event.payload?.taskVersionHash === assessmentEvidence.taskVersionHash);
const completionEvent = events.find((event) =>
  event.type === "task.completed"
    && event.payload?.task?.id === taskId
    && event.payload?.assessmentAcceptance?.assessmentInvocationId
      === assessmentResponse.invocation?.id);
const invocation = invocations.find((item) =>
  item.summary?.kind === "ai.workspace.assessment_acceptance"
    && item.summary?.taskId === taskId
    && item.summary?.assessmentInvocationId === assessmentResponse.invocation?.id);
const taskAcceptance = task.outcome?.details?.assessmentAcceptance ?? {};
const providerEgress = events.filter((event) =>
  event.type === "cloud_provider.ai_workspace_assessment_egress_authorized"
    && event.payload?.taskId === taskId);
const boundedReceipt = JSON.stringify({
  acceptanceAudit,
  invocationSummary: invocation?.summary,
  taskAcceptance,
});

if (response.invoked !== true
  || result.registry !== "nixsoma-ai-workspace-assessment-acceptance-v0"
  || result.status !== "accepted"
  || result.task?.id !== taskId
  || result.task?.status !== "completed"
  || evidence.taskId !== taskId
  || evidence.assessmentInvocationId !== assessmentResponse.invocation?.id
  || evidence.outcome !== "complete"
  || evidence.objectiveContentHash !== assessmentEvidence.objectiveContentHash
  || evidence.taskVersionHash !== assessmentEvidence.taskVersionHash
  || evidence.responseContentHash !== assessmentEvidence.responseContentHash
  || evidence.sceneContentHash !== assessmentEvidence.sceneContentHash
  || evidence.requiredAudit !== true
  || evidence.taskCompleted !== true
  || governance.explicitOperatorConfirmation !== true
  || governance.providerCalled !== false
  || governance.providerTriggeredCompletion !== false
  || governance.maximumActions !== 0
  || governance.actionExecuted !== false
  || governance.automaticContinuation !== false
  || governance.mutatesTask !== true
  || governance.mutatesHost !== false
  || task.status !== "completed"
  || task.executionPhase !== "completed"
  || task.closedAt !== task.updatedAt
  || taskAcceptance.registry !== result.registry
  || taskAcceptance.assessmentInvocationId !== assessmentResponse.invocation?.id
  || taskAcceptance.taskVersionHash !== assessmentEvidence.taskVersionHash
  || taskAcceptance.providerTriggeredCompletion !== false
  || !acceptanceAudit
  || !completionEvent
  || !invocation
  || invocation.summary?.requiredAudit !== true
  || invocation.summary?.taskCompleted !== true
  || invocation.summary?.providerTriggeredCompletion !== false
  || providerEgress.length !== 1
  || boundedReceipt.includes(taskGoal)
  || JSON.stringify(taskAcceptance).includes('"reason"')) {
  throw new Error(`assessment acceptance evidence invalid: ${JSON.stringify({ result, task, acceptanceAudit, completionEvent, invocation, providerEgress })}`);
}

console.log(JSON.stringify({
  registry: result.registry,
  taskId,
  assessmentInvocationId: evidence.assessmentInvocationId,
  outcome: evidence.outcome,
  taskStatus: task.status,
  providerCallCount: 0,
  actionCount: 0,
  requiredAudit: evidence.requiredAudit,
  explicitOperatorConfirmation: governance.explicitOperatorConfirmation,
  providerTriggeredCompletion: governance.providerTriggeredCompletion,
  automaticContinuation: governance.automaticContinuation,
  providerReasonPersisted: false,
}, null, 2));
NODE
fi
