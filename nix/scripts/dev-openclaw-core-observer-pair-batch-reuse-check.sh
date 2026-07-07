#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT_BASE="${OPENCLAW_CORE_OBSERVER_PAIR_BATCH_PORT_BASE:-26800}"

# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-core-observer-pair-runner.sh"

PAIR_ROWS=(
  "phase59|dev-openclaw-cloud-consciousness-live-provider-real-launch-execution-preflight-common-check.sh|PHASE59_PORT_BASE|PHASE59_OBSERVER_CHECK|openclaw-cloud-consciousness-live-provider-real-launch-execution-preflight"
  "phase60|dev-openclaw-cloud-consciousness-live-provider-credential-value-access-gate-common-check.sh|PHASE60_PORT_BASE|PHASE60_OBSERVER_CHECK|openclaw-cloud-consciousness-live-provider-credential-value-access-gate"
  "phase61|dev-openclaw-cloud-consciousness-live-provider-endpoint-network-egress-gate-common-check.sh|PHASE61_PORT_BASE|PHASE61_OBSERVER_CHECK|openclaw-cloud-consciousness-live-provider-endpoint-network-egress-gate"
  "phase62|dev-openclaw-cloud-consciousness-live-provider-egress-execution-route-task-preflight-common-check.sh|PHASE62_PORT_BASE|PHASE62_OBSERVER_CHECK|openclaw-cloud-consciousness-live-provider-egress-execution-route-task-preflight"
  "phase63|dev-openclaw-cloud-consciousness-live-provider-egress-execution-task-shell-common-check.sh|PHASE63_PORT_BASE|PHASE63_OBSERVER_CHECK|openclaw-cloud-consciousness-live-provider-egress-execution-task-shell"
  "phase64|dev-openclaw-cloud-consciousness-live-provider-egress-execution-approved-deferred-common-check.sh|PHASE64_PORT_BASE|PHASE64_OBSERVER_CHECK|openclaw-cloud-consciousness-live-provider-egress-execution-approved-deferred"
)

cleanup() {
  local index=0
  local row
  for row in "${PAIR_ROWS[@]}"; do
    IFS="|" read -r label _script _port_var _observer_var _public_check <<< "$row"
    openclaw_core_observer_pair_down "core-observer-pair-$label-$$" "$((PORT_BASE + (index * 100)))"
    index=$((index + 1))
  done
}
trap cleanup EXIT

PAIR_LABELS=()
PAIR_PUBLIC_CHECKS=()
PAIR_PORT_BASES=()

index=0
for row in "${PAIR_ROWS[@]}"; do
  IFS="|" read -r label script_name port_var observer_var public_check <<< "$row"
  pair_port_base="$((PORT_BASE + (index * 100)))"
  PAIR_LABELS+=("$label")
  PAIR_PUBLIC_CHECKS+=("$public_check")
  PAIR_PORT_BASES+=("$pair_port_base")

  OPENCLAW_CORE_OBSERVER_PAIR_RUN_ID="core-observer-pair-$label-$$" \
    openclaw_run_core_observer_pair \
      "$label" \
      "$SCRIPT_DIR/$script_name" \
      "$port_var" \
      "$observer_var" \
      "$pair_port_base"

  index=$((index + 1))
done

node - <<'NODE' "$PORT_BASE" "${PAIR_LABELS[*]}" "${PAIR_PUBLIC_CHECKS[*]}" "${PAIR_PORT_BASES[*]}"
const [portBaseRaw, labelsRaw, checksRaw, portBasesRaw] = process.argv.slice(2);
const labels = labelsRaw.split(/\s+/).filter(Boolean);
const representativePairs = checksRaw.split(/\s+/).filter(Boolean);
const portBases = portBasesRaw.split(/\s+/).filter(Boolean).map((value) => Number.parseInt(value, 10));
console.log(JSON.stringify({
  openclawCoreObserverPairBatchReuse: {
    status: "passed",
    pairCount: labels.length,
    coreChecks: labels.length,
    observerChecks: labels.length,
    serviceLifecycle: "one per core-observer pair",
    batchShape: "table-driven-compatible-pairs",
    labels,
    representativePairs,
    portBase: Number.parseInt(portBaseRaw, 10),
    portBases,
  },
}, null, 2));
NODE
