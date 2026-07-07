#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
MANIFEST_FILE="${OPENCLAW_LIVE_PROVIDER_CREDENTIAL_VALUE_LOCAL_READ_ATTEMPT_MILESTONES_FILE:-$SCRIPT_DIR/openclaw-live-provider-credential-value-local-read-attempt-milestones.tsv}"
START_PHASE="${OPENCLAW_CREDENTIAL_VALUE_LOCAL_READ_ATTEMPT_BATCH_START_PHASE:-91}"
END_PHASE="${OPENCLAW_CREDENTIAL_VALUE_LOCAL_READ_ATTEMPT_BATCH_END_PHASE:-98}"
PORT_BASE="${OPENCLAW_CREDENTIAL_VALUE_LOCAL_READ_ATTEMPT_BATCH_PORT_BASE:-27800}"
RUN_ID="${OPENCLAW_CREDENTIAL_VALUE_LOCAL_READ_ATTEMPT_BATCH_RUN_ID:-credential-value-local-read-attempt-batch-$$}"

export OPENCLAW_MILESTONE_PREREQ_MODE="${OPENCLAW_MILESTONE_PREREQ_MODE:-fast}"
export OPENCLAW_DEV_RUN_ID="$RUN_ID"
export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-$PORT_BASE}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-$((PORT_BASE + 1))}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-$((PORT_BASE + 2))}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-$((PORT_BASE + 3))}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-$((PORT_BASE + 4))}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-$((PORT_BASE + 5))}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-$((PORT_BASE + 6))}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-$((PORT_BASE + 7))}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-$((PORT_BASE + 8))}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-credential-value-local-read-attempt-batch-$START_PHASE-$END_PHASE-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-credential-value-local-read-attempt-batch-$START_PHASE-$END_PHASE-check.json}"

if (( START_PHASE < 91 || END_PHASE > 98 || START_PHASE > END_PHASE )); then
  echo "Credential-value local-read-attempt batch phase range must be within 91..98 and non-empty: $START_PHASE..$END_PHASE" >&2
  exit 1
fi

phase_slug() {
  local phase="$1"
  awk -F '\t' -v phase="$phase" '
    $0 !~ /^#/ && NF >= 2 && $1 == phase { print $2; found = 1 }
    END { if (!found) exit 1 }
  ' "$MANIFEST_FILE"
}

run_dev_down() {
  OPENCLAW_DEV_SERVICES_KEEP_UP=false \
  OPENCLAW_DEV_SERVICES_ALREADY_UP=false \
  OPENCLAW_DEV_DOWN_FORCE=true \
    bash "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}

cleanup() {
  run_dev_down
}
trap cleanup EXIT

run_phase_common_check() {
  local phase="$1"
  local observer_check="$2"
  local already_up="$3"
  local slug
  local common_script
  local phase_env

  slug="$(phase_slug "$phase")"
  common_script="$SCRIPT_DIR/dev-$slug-common-check.sh"
  phase_env="PHASE$phase"

  if [[ ! -f "$common_script" ]]; then
    echo "Missing credential-value local-read-attempt common check for phase $phase: $common_script" >&2
    exit 1
  fi

  env \
    "${phase_env}_PORT_BASE=$PORT_BASE" \
    "${phase_env}_OBSERVER_CHECK=$observer_check" \
    OPENCLAW_DEV_SERVICES_KEEP_UP=true \
    OPENCLAW_DEV_SERVICES_ALREADY_UP="$already_up" \
    bash "$common_script"
}

run_dev_down
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp"

already_up=false
for phase in $(seq "$START_PHASE" "$END_PHASE"); do
  run_phase_common_check "$phase" false "$already_up"
  already_up=true
done

for phase in $(seq "$START_PHASE" "$END_PHASE"); do
  run_phase_common_check "$phase" true true
done

node - <<'NODE' "$START_PHASE" "$END_PHASE" "$RUN_ID" "$PORT_BASE"
const [startPhase, endPhase, runId, portBase] = process.argv.slice(2);
const start = Number.parseInt(startPhase, 10);
const end = Number.parseInt(endPhase, 10);
console.log(JSON.stringify({
  openclawCredentialValueLocalReadAttemptBatchReuse: {
    status: "passed",
    phaseRange: `${start}-${end}`,
    coreChecks: end - start + 1,
    observerChecks: end - start + 1,
    servicesStartedOnce: true,
    runId,
    corePort: Number.parseInt(portBase, 10),
  },
}, null, 2));
NODE
