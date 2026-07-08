#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
MANIFEST_FILE="${OPENCLAW_LIVE_PROVIDER_PRE_CREDENTIAL_PAIR_MILESTONES_FILE:-$SCRIPT_DIR/openclaw-live-provider-pre-credential-pair-milestones.tsv}"
PORT_BASE="${OPENCLAW_LIVE_PROVIDER_PRE_CREDENTIAL_PAIR_BATCH_PORT_BASE:-29800}"
RUN_ID="${OPENCLAW_LIVE_PROVIDER_PRE_CREDENTIAL_PAIR_BATCH_RUN_ID:-pre-credential-pair-batch-$$}"

export OPENCLAW_DEV_RUN_ID="$RUN_ID"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/$RUN_ID-events.jsonl}"
export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-$PORT_BASE}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-$((PORT_BASE + 1))}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-$((PORT_BASE + 2))}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-$((PORT_BASE + 3))}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-$((PORT_BASE + 4))}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-$((PORT_BASE + 5))}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-$((PORT_BASE + 6))}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-$((PORT_BASE + 7))}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-$((PORT_BASE + 8))}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-pre-credential-pair-batch-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-pre-credential-pair-batch-check.json}"

mapfile -t PAIR_ROWS < <(awk -F '\t' '$0 !~ /^#/ && NF { print }' "$MANIFEST_FILE")

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

run_pair_common_check() {
  local row="$1"
  local observer_check="$2"
  local already_up="$3"
  local label
  local common_script
  local port_var
  local observer_var
  local extra_env
  local -a extra_env_args=()

  IFS=$'\t' read -r label _phase _public_check _observer_check common_script port_var observer_var extra_env _group <<< "$row"
  if [[ ! -f "$SCRIPT_DIR/$common_script" ]]; then
    echo "Missing pre-credential pair common check for $label: $SCRIPT_DIR/$common_script" >&2
    exit 1
  fi

  if [[ "$extra_env" != "-" ]]; then
    IFS="," read -r -a extra_env_args <<< "$extra_env"
  fi

  env \
    "$port_var=$PORT_BASE" \
    "$observer_var=$observer_check" \
    OPENCLAW_DEV_SERVICES_KEEP_UP=true \
    OPENCLAW_DEV_SERVICES_ALREADY_UP="$already_up" \
    "${extra_env_args[@]}" \
      bash "$SCRIPT_DIR/$common_script"
}

PAIR_LABELS=()
PAIR_PUBLIC_CHECKS=()
PAIR_OBSERVER_CHECKS=()
PAIR_GROUPS=()

for row in "${PAIR_ROWS[@]}"; do
  IFS=$'\t' read -r label _phase public_check observer_check _common_script _port_var _observer_var _extra_env group <<< "$row"
  PAIR_LABELS+=("$label")
  PAIR_PUBLIC_CHECKS+=("$public_check")
  PAIR_OBSERVER_CHECKS+=("$observer_check")
  if [[ " ${PAIR_GROUPS[*]} " != *" $group "* ]]; then
    PAIR_GROUPS+=("$group")
  fi
done

for group in "${PAIR_GROUPS[@]}"; do
  run_dev_down
  rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp"

  already_up=false
  for row in "${PAIR_ROWS[@]}"; do
    IFS=$'\t' read -r _label _phase _public_check _observer_check _common_script _port_var _observer_var _extra_env row_group <<< "$row"
    if [[ "$row_group" == "$group" ]]; then
      run_pair_common_check "$row" false "$already_up"
      already_up=true
    fi
  done

  for row in "${PAIR_ROWS[@]}"; do
    IFS=$'\t' read -r _label _phase _public_check _observer_check _common_script _port_var _observer_var _extra_env row_group <<< "$row"
    if [[ "$row_group" == "$group" ]]; then
      run_pair_common_check "$row" true true
    fi
  done
done

node - <<'NODE' "$PORT_BASE" "$RUN_ID" "${PAIR_LABELS[*]}" "${PAIR_PUBLIC_CHECKS[*]}" "${PAIR_OBSERVER_CHECKS[*]}" "${PAIR_GROUPS[*]}"
const [portBaseRaw, runId, labelsRaw, coreChecksRaw, observerChecksRaw, groupsRaw] = process.argv.slice(2);
const labels = labelsRaw.split(/\s+/).filter(Boolean);
const coreChecks = coreChecksRaw.split(/\s+/).filter(Boolean);
const observerChecks = observerChecksRaw.split(/\s+/).filter(Boolean);
const groups = groupsRaw.split(/\s+/).filter(Boolean);
console.log(JSON.stringify({
  openclawLiveProviderPreCredentialPairBatchReuse: {
    status: "passed",
    phaseRange: "24-57",
    pairCount: labels.length,
    coreChecks: coreChecks.length,
    observerChecks: observerChecks.length,
    groupCount: groups.length,
    serviceLifecycle: "one shared lifecycle per adjacent pre-credential capability group",
    batchShape: "manifest-driven-compatible-pre-credential-pairs",
    runId,
    groups,
    labels,
    representativePairs: coreChecks,
    observerPairs: observerChecks,
    portBase: Number.parseInt(portBaseRaw, 10),
  },
}, null, 2));
NODE
