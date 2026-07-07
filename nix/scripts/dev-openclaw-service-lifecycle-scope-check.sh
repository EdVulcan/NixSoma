#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ARTIFACT_DIR="$REPO_ROOT/.artifacts"

BASE_A="${OPENCLAW_LIFECYCLE_SCOPE_BASE_A:-28100}"
BASE_B="${OPENCLAW_LIFECYCLE_SCOPE_BASE_B:-$((BASE_A + 100))}"
BASE_DEFAULT="${OPENCLAW_LIFECYCLE_SCOPE_BASE_DEFAULT:-$((BASE_A + 200))}"
RUN_A="lifecycle-scope-a-$$"
RUN_B="lifecycle-scope-b-$$"

run_scoped_env() {
  local run_id="$1"
  local base="$2"
  shift 2
  env -u OPENCLAW_DEV_STATE_FILE \
    OPENCLAW_DEV_RUN_ID="$run_id" \
    OPENCLAW_CORE_PORT="$base" \
    OPENCLAW_EVENT_HUB_PORT="$((base + 1))" \
    OPENCLAW_SESSION_MANAGER_PORT="$((base + 2))" \
    OPENCLAW_BROWSER_RUNTIME_PORT="$((base + 3))" \
    OPENCLAW_SCREEN_SENSE_PORT="$((base + 4))" \
    OPENCLAW_SCREEN_ACT_PORT="$((base + 5))" \
    OPENCLAW_SYSTEM_SENSE_PORT="$((base + 6))" \
    OPENCLAW_SYSTEM_HEAL_PORT="$((base + 7))" \
    OBSERVER_UI_PORT="$((base + 8))" \
    OPENCLAW_CORE_STATE_FILE="$ARTIFACT_DIR/openclaw-core-$run_id.json" \
    OPENCLAW_SYSTEM_HEAL_STATE_FILE="$ARTIFACT_DIR/openclaw-system-heal-$run_id.json" \
    OPENCLAW_EVENT_LOG_FILE="$ARTIFACT_DIR/openclaw-events-$run_id.jsonl" \
    "$@"
}

run_default_env() {
  local base="$1"
  shift
  env -u OPENCLAW_DEV_RUN_ID -u OPENCLAW_DEV_STATE_FILE \
    OPENCLAW_CORE_PORT="$base" \
    OPENCLAW_EVENT_HUB_PORT="$((base + 1))" \
    OPENCLAW_SESSION_MANAGER_PORT="$((base + 2))" \
    OPENCLAW_BROWSER_RUNTIME_PORT="$((base + 3))" \
    OPENCLAW_SCREEN_SENSE_PORT="$((base + 4))" \
    OPENCLAW_SCREEN_ACT_PORT="$((base + 5))" \
    OPENCLAW_SYSTEM_SENSE_PORT="$((base + 6))" \
    OPENCLAW_SYSTEM_HEAL_PORT="$((base + 7))" \
    OBSERVER_UI_PORT="$((base + 8))" \
    OPENCLAW_CORE_STATE_FILE="$ARTIFACT_DIR/openclaw-core-lifecycle-default.json" \
    OPENCLAW_SYSTEM_HEAL_STATE_FILE="$ARTIFACT_DIR/openclaw-system-heal-lifecycle-default.json" \
    OPENCLAW_EVENT_LOG_FILE="$ARTIFACT_DIR/openclaw-events-lifecycle-default.jsonl" \
    "$@"
}

cleanup() {
  run_scoped_env "$RUN_A" "$BASE_A" bash "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
  run_scoped_env "$RUN_B" "$BASE_B" bash "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
  run_default_env "$BASE_DEFAULT" bash "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

assert_state_file() {
  local state_file="$1"
  local label="$2"
  if [[ ! -f "$state_file" ]]; then
    echo "Missing $label state file: $state_file" >&2
    exit 1
  fi
  awk -F $'\t' -v label="$label" '
    NF >= 4 && $2 ~ /^[0-9]+$/ { count += 1 }
    END {
      if (count != 9) {
        printf("Expected 9 managed service pids in %s state file, got %d\n", label, count) > "/dev/stderr";
        exit 1;
      }
    }
  ' "$state_file"
}

cleanup
rm -f \
  "$ARTIFACT_DIR/dev-services-unix-$RUN_A.tsv" \
  "$ARTIFACT_DIR/dev-services-unix-$RUN_B.tsv" \
  "$ARTIFACT_DIR/dev-services-unix.tsv"

run_scoped_env "$RUN_A" "$BASE_A" bash "$SCRIPT_DIR/dev-up.sh" >/dev/null
run_scoped_env "$RUN_B" "$BASE_B" bash "$SCRIPT_DIR/dev-up.sh" >/dev/null

assert_state_file "$ARTIFACT_DIR/dev-services-unix-$RUN_A.tsv" "$RUN_A"
assert_state_file "$ARTIFACT_DIR/dev-services-unix-$RUN_B.tsv" "$RUN_B"

run_scoped_env "$RUN_A" "$BASE_A" bash "$SCRIPT_DIR/dev-down.sh" >/dev/null

scope_b_health="$(curl --silent --fail "http://127.0.0.1:$BASE_B/health")"
node - <<'NODE' "$scope_b_health" "$BASE_B"
const health = JSON.parse(process.argv[2]);
const expectedPort = Number.parseInt(process.argv[3], 10);
if (!health.ok || health.port !== expectedPort) {
  throw new Error(`scoped service was stopped by another run: ${JSON.stringify(health)}`);
}
NODE

run_scoped_env "$RUN_B" "$BASE_B" bash "$SCRIPT_DIR/dev-down.sh" >/dev/null

run_default_env "$BASE_DEFAULT" bash "$SCRIPT_DIR/dev-up.sh" >/dev/null
assert_state_file "$ARTIFACT_DIR/dev-services-unix.tsv" "legacy"
if [[ ! -f "$ARTIFACT_DIR/openclaw-core.pid" || ! -f "$ARTIFACT_DIR/openclaw-core.log" ]]; then
  echo "Default lifecycle mode did not preserve legacy openclaw-core pid/log files." >&2
  exit 1
fi
run_default_env "$BASE_DEFAULT" bash "$SCRIPT_DIR/dev-down.sh" >/dev/null

node - <<'NODE' "$RUN_A" "$BASE_A" "$RUN_B" "$BASE_B" "$BASE_DEFAULT"
const [runA, baseA, runB, baseB, baseDefault] = process.argv.slice(2);
console.log(JSON.stringify({
  openclawServiceLifecycleScope: {
    status: "passed",
    scopedRuns: [
      { runId: runA, corePort: Number.parseInt(baseA, 10) },
      { runId: runB, corePort: Number.parseInt(baseB, 10), remainedHealthyAfterFirstRunStopped: true },
    ],
    legacyCompatibility: {
      stateFile: ".artifacts/dev-services-unix.tsv",
      pidFile: ".artifacts/openclaw-core.pid",
      logFile: ".artifacts/openclaw-core.log",
      corePort: Number.parseInt(baseDefault, 10),
    },
  },
}, null, 2));
NODE
