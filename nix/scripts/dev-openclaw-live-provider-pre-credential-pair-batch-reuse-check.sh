#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MANIFEST_FILE="${OPENCLAW_LIVE_PROVIDER_PRE_CREDENTIAL_PAIR_MILESTONES_FILE:-$SCRIPT_DIR/openclaw-live-provider-pre-credential-pair-milestones.tsv}"
PORT_BASE="${OPENCLAW_LIVE_PROVIDER_PRE_CREDENTIAL_PAIR_BATCH_PORT_BASE:-29800}"

# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-core-observer-pair-runner.sh"

mapfile -t PAIR_ROWS < <(awk -F '\t' '$0 !~ /^#/ && NF { print }' "$MANIFEST_FILE")

cleanup() {
  local index=0
  local row
  local label
  for row in "${PAIR_ROWS[@]}"; do
    IFS=$'\t' read -r label _phase _public_check _observer_check _common_script _port_var _observer_var _extra_env <<< "$row"
    openclaw_core_observer_pair_down "pre-credential-pair-$label-$$" "$((PORT_BASE + (index * 100)))"
    index=$((index + 1))
  done
}
trap cleanup EXIT

PAIR_LABELS=()
PAIR_PUBLIC_CHECKS=()
PAIR_OBSERVER_CHECKS=()
PAIR_PORT_BASES=()

index=0
for row in "${PAIR_ROWS[@]}"; do
  IFS=$'\t' read -r label _phase public_check observer_check common_script port_var observer_var extra_env <<< "$row"
  pair_port_base="$((PORT_BASE + (index * 100)))"
  extra_env_args=()
  if [[ "$extra_env" != "-" ]]; then
    IFS="," read -r -a extra_env_args <<< "$extra_env"
  fi

  PAIR_LABELS+=("$label")
  PAIR_PUBLIC_CHECKS+=("$public_check")
  PAIR_OBSERVER_CHECKS+=("$observer_check")
  PAIR_PORT_BASES+=("$pair_port_base")

  OPENCLAW_CORE_OBSERVER_PAIR_RUN_ID="pre-credential-pair-$label-$$" \
    openclaw_run_core_observer_pair \
      "$label" \
      "$SCRIPT_DIR/$common_script" \
      "$port_var" \
      "$observer_var" \
      "$pair_port_base" \
      "${extra_env_args[@]}"

  index=$((index + 1))
done

node - <<'NODE' "$PORT_BASE" "${PAIR_LABELS[*]}" "${PAIR_PUBLIC_CHECKS[*]}" "${PAIR_OBSERVER_CHECKS[*]}" "${PAIR_PORT_BASES[*]}"
const [portBaseRaw, labelsRaw, coreChecksRaw, observerChecksRaw, portBasesRaw] = process.argv.slice(2);
const labels = labelsRaw.split(/\s+/).filter(Boolean);
const coreChecks = coreChecksRaw.split(/\s+/).filter(Boolean);
const observerChecks = observerChecksRaw.split(/\s+/).filter(Boolean);
const portBases = portBasesRaw.split(/\s+/).filter(Boolean).map((value) => Number.parseInt(value, 10));
console.log(JSON.stringify({
  openclawLiveProviderPreCredentialPairBatchReuse: {
    status: "passed",
    phaseRange: "24-57",
    pairCount: labels.length,
    coreChecks: coreChecks.length,
    observerChecks: observerChecks.length,
    serviceLifecycle: "one per core-observer pair",
    batchShape: "manifest-driven-compatible-pre-credential-pairs",
    labels,
    representativePairs: coreChecks,
    observerPairs: observerChecks,
    portBase: Number.parseInt(portBaseRaw, 10),
    portBases,
  },
}, null, 2));
NODE
