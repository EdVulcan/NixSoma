#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ARTIFACT_DIR="$REPO_ROOT/.artifacts/milestone-check"

mkdir -p "$ARTIFACT_DIR"

checks=(
  "body-config|dev-body-config-check.sh|NixOS body module, profiles, and systemd service skeleton"
  "state-settling|dev-state-settling-check.sh|Session/browser/screen first-frame settling"
  "task-workbench|dev-task-workbench-check.sh|Task lifecycle, recovery, history, and work view coordination"
  "task-executor|dev-task-executor-check.sh|Executor verification, failed checks, manual and auto recovery"
  "persistence|dev-persistence-check.sh|Core task state persistence and recovery chains"
  "planner|dev-planner-check.sh|Rule planner plan-only and planned execution flows"
  "operator-loop|dev-operator-loop-check.sh|Operator step/run queue consumption and persistence"
  "operator-control|dev-operator-control-check.sh|Operator state, dry-run, pause gate, and resume control"
  "policy|dev-policy-check.sh|Policy governance, audit, and cross-boundary execution gate"
  "sovereign-body-policy|dev-sovereign-body-policy-check.sh|Sovereign body autonomy for body-internal capability governance"
  "sovereign-command-execute|dev-sovereign-command-execute-check.sh|Sovereign body execution of allowlisted system commands"
  "sovereign-command-chain|dev-sovereign-command-chain-check.sh|Sovereign body command chains with persisted transcripts"
  "sovereign-command-branch|dev-sovereign-command-branch-check.sh|Sovereign body command branching from previous transcripts"
  "sovereign-command-recovery|dev-sovereign-command-recovery-check.sh|Sovereign body command recovery from non-zero exit codes"
  "sovereign-command-ledger|dev-sovereign-command-ledger-check.sh|Sovereign body command transcript ledger and restart recovery"
  "sovereign-maintenance|dev-sovereign-maintenance-check.sh|Sovereign body autonomous maintenance through conservative heal runs"
  "sovereign-maintenance-scheduler|dev-sovereign-maintenance-scheduler-check.sh|Sovereign body maintenance policy, ticks, and scheduler persistence"
  "sovereign-filesystem-write|dev-sovereign-filesystem-write-check.sh|Sovereign body bounded filesystem text writes"
  "sovereign-filesystem-workspace|dev-sovereign-filesystem-workspace-check.sh|Sovereign body filesystem workspace creation chain"
  "sovereign-filesystem-append|dev-sovereign-filesystem-append-check.sh|Sovereign body bounded filesystem text appends"
  "sovereign-filesystem-ledger|dev-sovereign-filesystem-ledger-check.sh|Sovereign body filesystem change ledger and restart recovery"
  "sovereign-filesystem-read-text|dev-sovereign-filesystem-read-text-check.sh|Sovereign body bounded filesystem text readback"
  "sovereign-filesystem-read-ledger|dev-sovereign-filesystem-read-ledger-check.sh|Sovereign body filesystem read access ledger and restart recovery"
  "approval|dev-approval-check.sh|Approval inbox, user decisions, and operator approval gate"
  "capability|dev-capability-check.sh|Body capability registry, risks, health, and approval boundaries"
  "capability-planner|dev-capability-planner-check.sh|Capability-aware planning with risk and governance metadata"
  "capability-invoke|dev-capability-invoke-check.sh|Policy-governed capability invocation through core"
  "capability-history|dev-capability-history-check.sh|Persistent capability invocation history and restart recovery"
  "capability-operator|dev-capability-operator-check.sh|Operator execution through governed capability invocation"
  "capability-approval-operator|dev-capability-approval-operator-check.sh|Operator waits for user approval before high-risk capability execution"
  "event-audit|dev-event-audit-check.sh|Durable event audit ledger, filters, summary, and restart recovery"
  "system-capability|dev-system-capability-check.sh|Conservative filesystem, process, and command dry-run capabilities"
  "system-sense|dev-system-sense-check.sh|Real body vitals, service latency, resources, and alerts"
  "system-heal|dev-system-heal-check.sh|Conservative diagnosis, repair plan, autofix, and heal history"
  "openclaw-workspace-detect|dev-openclaw-workspace-detect-check.sh|Read-only detection of configured OpenClaw workspaces"
  "openclaw-real-workspace-profile|dev-openclaw-real-workspace-profile-check.sh|Read-only profile of the real OpenClaw source workspace"
  "openclaw-source-migration-map|dev-openclaw-source-migration-map-check.sh|Read-only migration candidate map for OpenClaw source capabilities"
  "openclaw-source-migration-plan|dev-openclaw-source-migration-plan-check.sh|Plan-only first-wave migration draft for OpenClaw source capabilities"
  "openclaw-plugin-sdk-contract-review|dev-openclaw-plugin-sdk-contract-review-check.sh|Read-only contract review draft for the OpenClaw plugin SDK"
  "openclaw-plugin-sdk-source-review-scope|dev-openclaw-plugin-sdk-source-review-scope-check.sh|Plan-only source review scope for the OpenClaw plugin SDK"
  "openclaw-plugin-sdk-source-content-review|dev-openclaw-plugin-sdk-source-content-review-check.sh|Scoped source content review for the OpenClaw plugin SDK"
  "openclaw-plugin-sdk-native-contract-tests|dev-openclaw-plugin-sdk-native-contract-tests-check.sh|Native contract tests derived from OpenClaw plugin SDK source signals"
  "openclaw-native-plugin-sdk-contract-implementation|dev-openclaw-native-plugin-sdk-contract-implementation-check.sh|Native OpenClaw plugin SDK contract implementation slots"
  "openclaw-tool-catalog|dev-openclaw-tool-catalog-check.sh|Read-only native absorption of the enhanced OpenClaw tool catalog"
  "openclaw-plugin-manifest-map|dev-openclaw-plugin-manifest-map-check.sh|Read-only native absorption of enhanced OpenClaw extension plugin manifests"
  "openclaw-plugin-capability-plan|dev-openclaw-plugin-capability-plan-check.sh|Manifest-derived native OpenClaw plugin capability planning"
  "openclaw-plugin-candidate-contract-tests|dev-openclaw-plugin-candidate-contract-tests-check.sh|Native adapter contract tests for a selected enhanced OpenClaw plugin candidate"
  "openclaw-plugin-search-web-adapter-contract|dev-openclaw-plugin-search-web-adapter-contract-check.sh|Native search/web adapter contract shell for enhanced OpenClaw plugin candidates"
  "openclaw-plugin-search-web-adapter-task|dev-openclaw-plugin-search-web-adapter-task-check.sh|Approval-gated native search/web adapter task materialization"
  "openclaw-plugin-search-web-adapter-denial-recovery|dev-openclaw-plugin-search-web-adapter-denial-recovery-check.sh|Denial and fresh-approval recovery for native search/web adapter tasks"
  "openclaw-plugin-search-web-adapter-runtime-preflight|dev-openclaw-plugin-search-web-adapter-runtime-preflight-check.sh|Runtime preflight envelope for native search/web adapter invocation"
  "openclaw-plugin-search-web-adapter-runtime-activation-plan|dev-openclaw-plugin-search-web-adapter-runtime-activation-plan-check.sh|Plan-only runtime activation gates for native search/web adapter invocation"
  "openclaw-native-plugin-contract|dev-openclaw-native-plugin-contract-check.sh|Native OpenClaw plugin and capability contract skeleton"
  "openclaw-native-plugin-registry|dev-openclaw-native-plugin-registry-check.sh|Native OpenClaw plugin contract registry"
  "openclaw-formal-integration-readiness|dev-openclaw-formal-integration-readiness-check.sh|Governed readiness gate for formal OpenClaw source integration"
  "openclaw-native-plugin-adapter|dev-openclaw-native-plugin-adapter-check.sh|Native OpenClaw plugin adapter shell for manifest profiling"
  "openclaw-native-tool-catalog-adapter|dev-openclaw-native-tool-catalog-adapter-check.sh|Native adapter invocation for read-only OpenClaw tool catalog queries"
  "openclaw-native-workspace-semantic-index|dev-openclaw-native-workspace-semantic-index-check.sh|Native read-only semantic index for enhanced OpenClaw workspace files"
  "openclaw-native-workspace-symbol-lookup|dev-openclaw-native-workspace-symbol-lookup-check.sh|Governed read-only executable symbol lookup for enhanced OpenClaw workspace files"
  "openclaw-native-workspace-text-write|dev-openclaw-native-workspace-text-write-check.sh|Approval-gated native OpenClaw workspace text write adapter"
  "openclaw-native-workspace-patch-apply|dev-openclaw-native-workspace-patch-apply-check.sh|Diff-preview approval-gated native OpenClaw workspace patch adapter"
  "openclaw-native-workspace-multi-patch|dev-openclaw-native-workspace-multi-patch-check.sh|Multi-hunk diff-preview approval-gated native OpenClaw workspace patch adapter"
  "openclaw-native-workspace-patch-validation|dev-openclaw-native-workspace-patch-validation-check.sh|Structured validation for native OpenClaw workspace patch safety"
  "openclaw-native-workspace-structured-edit|dev-openclaw-native-workspace-structured-edit-check.sh|Structured line-edit proposal support for native OpenClaw workspace patches"
  "openclaw-native-workspace-edit-proposal|dev-openclaw-native-workspace-edit-proposal-check.sh|Proposal envelope metadata for native OpenClaw workspace edits"
  "openclaw-source-derived-edit-proposal|dev-openclaw-source-derived-edit-proposal-check.sh|Source-derived proposal envelopes from enhanced OpenClaw tool signals"
  "openclaw-workspace-edit-target-selection|dev-openclaw-workspace-edit-target-selection-check.sh|Bounded real OpenClaw workspace target selection for source-derived edit proposals"
  "openclaw-prompt-semantics-edit-plan|dev-openclaw-prompt-semantics-edit-plan-check.sh|Prompt/tool semantics-derived edit intent and expected checks for OpenClaw workspace proposals"
  "openclaw-rationale-check-bundle|dev-openclaw-rationale-check-bundle-check.sh|Structured rationale, check, and risk bundles for source-derived OpenClaw edit proposals"
  "openclaw-source-authored-edit-task|dev-openclaw-source-authored-edit-task-check.sh|Approval-gated source-authored OpenClaw edit task entrypoint"
  "openclaw-source-integration-regression|dev-openclaw-source-integration-regression-check.sh|Focused regression for the enhanced OpenClaw source-authored edit integration chain"
  "openclaw-source-command-proposals|dev-openclaw-source-command-proposals-check.sh|Read-only enhanced OpenClaw source-derived shell/process command proposals"
  "openclaw-source-command-plan|dev-openclaw-source-command-plan-check.sh|Plan-only enhanced OpenClaw source-derived shell/process command drafts"
  "openclaw-source-command-task|dev-openclaw-source-command-task-check.sh|Approval-gated enhanced OpenClaw source-derived shell/process command task materialization"
  "openclaw-source-command-execute|dev-openclaw-source-command-execute-check.sh|Approved enhanced OpenClaw source-derived shell/process command execution"
  "openclaw-source-command-denial-recovery|dev-openclaw-source-command-denial-recovery-check.sh|Denial and fresh-approval recovery for enhanced OpenClaw source-derived commands"
  "openclaw-source-command-hardening|dev-openclaw-source-command-hardening-check.sh|Approval expiry, duplicate clicks, duplicate recovery, and recovery chains for enhanced OpenClaw source-derived commands"
  "openclaw-source-command-persistence|dev-openclaw-source-command-persistence-check.sh|Restart persistence for enhanced OpenClaw source-derived command recovery chains"
  "openclaw-source-command-regression|dev-openclaw-source-command-regression-check.sh|Focused regression for the enhanced OpenClaw source-derived command integration chain"
  "openclaw-native-plugin-invoke-plan|dev-openclaw-native-plugin-invoke-plan-check.sh|Plan-only approval gate for native OpenClaw plugin invocation"
  "openclaw-native-plugin-invoke-task|dev-openclaw-native-plugin-invoke-task-check.sh|Approval-gated task materialization for native OpenClaw plugin invocation"
  "openclaw-native-plugin-invoke-deferred|dev-openclaw-native-plugin-invoke-deferred-check.sh|Runtime-adapter deferred execution boundary for approved native OpenClaw plugin invocation"
  "openclaw-native-plugin-runtime-preflight|dev-openclaw-native-plugin-runtime-preflight-check.sh|Runtime preflight envelope for native OpenClaw plugin invocation"
  "openclaw-native-plugin-runtime-activation-plan|dev-openclaw-native-plugin-runtime-activation-plan-check.sh|Plan-only runtime activation gates for native OpenClaw plugin invocation"
  "openclaw-workspace-command-proposals|dev-openclaw-workspace-command-proposals-check.sh|Proposal-only command shapes for detected OpenClaw workspaces"
  "openclaw-workspace-command-plan|dev-openclaw-workspace-command-plan-check.sh|Plan-only execution drafts for OpenClaw workspace command proposals"
  "openclaw-workspace-command-task|dev-openclaw-workspace-command-task-check.sh|Approval-gated task materialization for OpenClaw workspace commands"
  "openclaw-workspace-command-execute|dev-openclaw-workspace-command-execute-check.sh|Approved execution of allowlisted OpenClaw workspace commands"
  "openclaw-workspace-command-failure|dev-openclaw-workspace-command-failure-check.sh|Failure capture for approved OpenClaw workspace commands"
  "openclaw-workspace-command-denial|dev-openclaw-workspace-command-denial-check.sh|Denial safety for approval-gated OpenClaw workspace commands"
  "openclaw-workspace-command-denial-recovery|dev-openclaw-workspace-command-denial-recovery-check.sh|Recovery of denied OpenClaw workspace commands behind fresh approval"
  "openclaw-workspace-command-hardening|dev-openclaw-workspace-command-hardening-check.sh|Approval expiry, duplicate clicks, duplicate recovery, and recovery chains"
  "openclaw-workspace-command-recovery|dev-openclaw-workspace-command-recovery-check.sh|Recovery of failed OpenClaw workspace commands behind fresh approval"
  "openclaw-workspace-command-recovery-persistence|dev-openclaw-workspace-command-recovery-persistence-check.sh|Restart persistence for recovered OpenClaw workspace command chains"
  "observer-capability-plan|dev-observer-capability-plan-check.sh|Observer visibility for capability-aware plan metadata"
  "observer-capability-invoke|dev-observer-capability-invoke-check.sh|Observer controls for policy-governed capability invocation"
  "observer-capability-history|dev-observer-capability-history-check.sh|Observer visibility for persistent capability invocation history"
  "observer-command-transcript|dev-observer-command-transcript-check.sh|Observer visibility for sovereign command transcripts"
  "observer-command-ledger|dev-observer-command-ledger-check.sh|Observer visibility for sovereign command transcript ledger"
  "observer-sovereign-maintenance|dev-observer-sovereign-maintenance-check.sh|Observer visibility for sovereign maintenance policy, ticks, and runs"
  "observer-sovereign-maintenance-control|dev-observer-sovereign-maintenance-control-check.sh|Observer controls for sovereign maintenance ticks"
  "observer-filesystem-ledger|dev-observer-filesystem-ledger-check.sh|Observer visibility for sovereign filesystem change ledger"
  "observer-filesystem-read-ledger|dev-observer-filesystem-read-ledger-check.sh|Observer visibility for sovereign filesystem read access ledger"
  "observer-workspace-detect|dev-observer-workspace-detect-check.sh|Observer visibility for read-only OpenClaw workspace detection"
  "observer-openclaw-source-migration-map|dev-observer-openclaw-source-migration-map-check.sh|Observer visibility for OpenClaw source migration candidates"
  "observer-openclaw-source-migration-plan|dev-observer-openclaw-source-migration-plan-check.sh|Observer visibility for plan-only OpenClaw source migration drafts"
  "observer-openclaw-plugin-sdk-contract-review|dev-observer-openclaw-plugin-sdk-contract-review-check.sh|Observer visibility for OpenClaw plugin SDK contract reviews"
  "observer-openclaw-plugin-sdk-source-review-scope|dev-observer-openclaw-plugin-sdk-source-review-scope-check.sh|Observer visibility for OpenClaw plugin SDK source review scopes"
  "observer-openclaw-plugin-sdk-source-content-review|dev-observer-openclaw-plugin-sdk-source-content-review-check.sh|Observer visibility for OpenClaw plugin SDK source content reviews"
  "observer-openclaw-plugin-sdk-native-contract-tests|dev-observer-openclaw-plugin-sdk-native-contract-tests-check.sh|Observer visibility for OpenClaw plugin SDK native contract tests"
  "observer-openclaw-native-plugin-sdk-contract-implementation|dev-observer-openclaw-native-plugin-sdk-contract-implementation-check.sh|Observer visibility for native OpenClaw plugin SDK contract implementation"
  "observer-openclaw-tool-catalog|dev-observer-openclaw-tool-catalog-check.sh|Observer visibility for read-only enhanced OpenClaw tool catalog absorption"
  "observer-openclaw-plugin-manifest-map|dev-observer-openclaw-plugin-manifest-map-check.sh|Observer visibility for read-only enhanced OpenClaw extension plugin manifests"
  "observer-openclaw-plugin-capability-plan|dev-observer-openclaw-plugin-capability-plan-check.sh|Observer visibility for manifest-derived native OpenClaw plugin capability planning"
  "observer-openclaw-plugin-candidate-contract-tests|dev-observer-openclaw-plugin-candidate-contract-tests-check.sh|Observer visibility for selected enhanced OpenClaw plugin candidate contract tests"
  "observer-openclaw-plugin-search-web-adapter-contract|dev-observer-openclaw-plugin-search-web-adapter-contract-check.sh|Observer visibility for native search/web adapter contract shell"
  "observer-openclaw-plugin-search-web-adapter-task|dev-observer-openclaw-plugin-search-web-adapter-task-check.sh|Observer controls for approval-gated native search/web adapter tasks"
  "observer-openclaw-plugin-search-web-adapter-denial-recovery|dev-observer-openclaw-plugin-search-web-adapter-denial-recovery-check.sh|Observer visibility for denied and recovered native search/web adapter tasks"
  "observer-openclaw-plugin-search-web-adapter-runtime-preflight|dev-observer-openclaw-plugin-search-web-adapter-runtime-preflight-check.sh|Observer visibility for native search/web adapter runtime preflight envelopes"
  "observer-openclaw-plugin-search-web-adapter-runtime-activation-plan|dev-observer-openclaw-plugin-search-web-adapter-runtime-activation-plan-check.sh|Observer visibility for native search/web adapter runtime activation gates"
  "observer-openclaw-native-plugin-contract|dev-observer-openclaw-native-plugin-contract-check.sh|Observer visibility for native OpenClaw plugin contracts"
  "observer-openclaw-formal-integration-readiness|dev-observer-openclaw-formal-integration-readiness-check.sh|Observer visibility for formal OpenClaw integration readiness"
  "observer-openclaw-native-plugin-adapter|dev-observer-openclaw-native-plugin-adapter-check.sh|Observer visibility for native OpenClaw plugin adapter shell"
  "observer-openclaw-native-tool-catalog-adapter|dev-observer-openclaw-native-tool-catalog-adapter-check.sh|Observer visibility for native OpenClaw tool catalog adapter invocation"
  "observer-openclaw-native-workspace-semantic-index|dev-observer-openclaw-native-workspace-semantic-index-check.sh|Observer visibility for native OpenClaw workspace semantic index"
  "observer-openclaw-native-workspace-symbol-lookup|dev-observer-openclaw-native-workspace-symbol-lookup-check.sh|Observer visibility for governed native OpenClaw workspace symbol lookup"
  "observer-openclaw-native-workspace-text-write|dev-observer-openclaw-native-workspace-text-write-check.sh|Observer controls for approval-gated native OpenClaw workspace text writes"
  "observer-openclaw-native-workspace-patch-apply|dev-observer-openclaw-native-workspace-patch-apply-check.sh|Observer controls for diff-preview approval-gated native OpenClaw workspace patches"
  "observer-openclaw-native-workspace-multi-patch|dev-observer-openclaw-native-workspace-multi-patch-check.sh|Observer controls for multi-hunk diff-preview approval-gated native OpenClaw workspace patches"
  "observer-openclaw-native-workspace-patch-validation|dev-observer-openclaw-native-workspace-patch-validation-check.sh|Observer visibility for native OpenClaw workspace patch validation safety"
  "observer-openclaw-native-workspace-structured-edit|dev-observer-openclaw-native-workspace-structured-edit-check.sh|Observer visibility for structured line-edit native OpenClaw workspace patches"
  "observer-openclaw-native-workspace-edit-proposal|dev-observer-openclaw-native-workspace-edit-proposal-check.sh|Observer visibility for native OpenClaw workspace edit proposal envelopes"
  "observer-openclaw-source-derived-edit-proposal|dev-observer-openclaw-source-derived-edit-proposal-check.sh|Observer visibility for source-derived OpenClaw edit proposal envelopes"
  "observer-openclaw-workspace-edit-target-selection|dev-observer-openclaw-workspace-edit-target-selection-check.sh|Observer visibility for bounded OpenClaw workspace edit target selection"
  "observer-openclaw-prompt-semantics-edit-plan|dev-observer-openclaw-prompt-semantics-edit-plan-check.sh|Observer visibility for prompt/tool semantics-derived edit plans"
  "observer-openclaw-rationale-check-bundle|dev-observer-openclaw-rationale-check-bundle-check.sh|Observer visibility for source-derived OpenClaw rationale, check, and risk bundles"
  "observer-openclaw-source-authored-edit-task|dev-observer-openclaw-source-authored-edit-task-check.sh|Observer controls for approval-gated source-authored OpenClaw edit tasks"
  "observer-openclaw-source-integration-regression|dev-observer-openclaw-source-integration-regression-check.sh|Observer focused regression for the enhanced OpenClaw source-authored edit integration chain"
  "observer-openclaw-source-command-proposals|dev-observer-openclaw-source-command-proposals-check.sh|Observer visibility for enhanced OpenClaw source-derived shell/process command proposals"
  "observer-openclaw-source-command-plan|dev-observer-openclaw-source-command-plan-check.sh|Observer visibility for enhanced OpenClaw source-derived shell/process command plans"
  "observer-openclaw-source-command-task|dev-observer-openclaw-source-command-task-check.sh|Observer controls for approval-gated enhanced OpenClaw source-derived command tasks"
  "observer-openclaw-source-command-execute|dev-observer-openclaw-source-command-execute-check.sh|Observer visibility for approved enhanced OpenClaw source-derived command execution"
  "observer-openclaw-source-command-denial-recovery|dev-observer-openclaw-source-command-denial-recovery-check.sh|Observer visibility for denied and recovered enhanced OpenClaw source-derived commands"
  "observer-openclaw-source-command-hardening|dev-observer-openclaw-source-command-hardening-check.sh|Observer visibility for hardened enhanced OpenClaw source-derived command recovery chains"
  "observer-openclaw-source-command-persistence|dev-observer-openclaw-source-command-persistence-check.sh|Observer visibility for persisted enhanced OpenClaw source-derived command recovery chains"
  "observer-openclaw-source-command-regression|dev-observer-openclaw-source-command-regression-check.sh|Observer focused regression for the enhanced OpenClaw source-derived command integration chain"
  "observer-openclaw-native-plugin-invoke-plan|dev-observer-openclaw-native-plugin-invoke-plan-check.sh|Observer visibility for native OpenClaw plugin invocation plans"
  "observer-openclaw-native-plugin-invoke-task|dev-observer-openclaw-native-plugin-invoke-task-check.sh|Observer controls for native OpenClaw plugin invocation task materialization"
  "observer-openclaw-native-plugin-invoke-deferred|dev-observer-openclaw-native-plugin-invoke-deferred-check.sh|Observer visibility for runtime-adapter deferred native OpenClaw plugin invocation"
  "observer-openclaw-native-plugin-runtime-preflight|dev-observer-openclaw-native-plugin-runtime-preflight-check.sh|Observer visibility for native OpenClaw plugin runtime preflight envelopes"
  "observer-openclaw-native-plugin-runtime-activation-plan|dev-observer-openclaw-native-plugin-runtime-activation-plan-check.sh|Observer visibility for native OpenClaw plugin runtime activation gates"
  "observer-workspace-command-proposals|dev-observer-workspace-command-proposals-check.sh|Observer visibility for OpenClaw workspace command proposals"
  "observer-workspace-command-plan|dev-observer-workspace-command-plan-check.sh|Observer visibility for OpenClaw workspace command plan drafts"
  "observer-workspace-command-task|dev-observer-workspace-command-task-check.sh|Observer controls for approval-gated OpenClaw workspace command tasks"
  "observer-workspace-command-execute|dev-observer-workspace-command-execute-check.sh|Observer controls and visibility for approved OpenClaw workspace command execution"
  "observer-workspace-command-failure|dev-observer-workspace-command-failure-check.sh|Observer visibility for failed OpenClaw workspace command execution"
  "observer-workspace-command-denial|dev-observer-workspace-command-denial-check.sh|Observer visibility for denied OpenClaw workspace command approvals"
  "observer-workspace-command-denial-recovery|dev-observer-workspace-command-denial-recovery-check.sh|Observer visibility for recovered denied OpenClaw workspace commands"
  "observer-workspace-command-denial-recovery-persistence|dev-observer-workspace-command-denial-recovery-persistence-check.sh|Observer visibility for recovered denied OpenClaw workspace command chains across restarts"
  "observer-workspace-command-recovery|dev-observer-workspace-command-recovery-check.sh|Observer controls and visibility for recovered OpenClaw workspace commands"
  "observer-workspace-command-recovery-persistence|dev-observer-workspace-command-recovery-persistence-check.sh|Observer visibility for recovered OpenClaw workspace command chains across restarts"
  "observer-operator|dev-observer-operator-check.sh|Observer UI planner/operator controls and API wiring"
)

selected_filter="${OPENCLAW_MILESTONE_CHECKS:-}"
started_at="$(date -Iseconds)"
passed=0
failed=0
summary_json="$ARTIFACT_DIR/summary.json"

should_run_check() {
  local name="$1"
  if [[ -z "$selected_filter" ]]; then
    return 0
  fi

  local item=""
  IFS="," read -ra selected_items <<<"$selected_filter"
  for item in "${selected_items[@]}"; do
    item="${item#"${item%%[![:space:]]*}"}"
    item="${item%"${item##*[![:space:]]}"}"
    if [[ "$item" == "$name" ]]; then
      return 0
    fi
  done
  return 1
}

json_escape() {
  node -e 'process.stdout.write(JSON.stringify(process.argv[1]))' "$1"
}

results_json=""

echo "OpenClaw milestone check started at $started_at"
echo "Logs: $ARTIFACT_DIR"
if [[ -n "$selected_filter" ]]; then
  echo "Selected checks: $selected_filter"
fi
echo

for entry in "${checks[@]}"; do
  IFS="|" read -r name script description <<<"$entry"
  if ! should_run_check "$name"; then
    continue
  fi

  log_file="$ARTIFACT_DIR/$name.log"
  start_seconds="$SECONDS"
  echo "==> [$name] $description"

  if bash "$SCRIPT_DIR/$script" >"$log_file" 2>&1; then
    duration=$((SECONDS - start_seconds))
    passed=$((passed + 1))
    echo "    PASS (${duration}s)"
    result="{\"name\":$(json_escape "$name"),\"status\":\"passed\",\"durationSeconds\":$duration,\"log\":$(json_escape "$log_file")}"
  else
    status=$?
    duration=$((SECONDS - start_seconds))
    failed=$((failed + 1))
    echo "    FAIL (${duration}s, exit $status)"
    echo "    Last log lines:"
    tail -n 60 "$log_file" | sed 's/^/      /'
    result="{\"name\":$(json_escape "$name"),\"status\":\"failed\",\"durationSeconds\":$duration,\"exitCode\":$status,\"log\":$(json_escape "$log_file")}"
  fi

  if [[ -z "$results_json" ]]; then
    results_json="$result"
  else
    results_json="$results_json,$result"
  fi
  echo
done

finished_at="$(date -Iseconds)"
total=$((passed + failed))
if (( total == 0 )); then
  echo "No milestone checks matched OPENCLAW_MILESTONE_CHECKS='$selected_filter'." >&2
  exit 1
fi

cat >"$summary_json" <<EOF
{
  "startedAt": "$started_at",
  "finishedAt": "$finished_at",
  "total": $total,
  "passed": $passed,
  "failed": $failed,
  "results": [$results_json]
}
EOF

cat "$summary_json"
echo

if (( failed > 0 )); then
  echo "Milestone check failed. Summary: $summary_json" >&2
  exit 1
fi

echo "Milestone check passed. Summary: $summary_json"
