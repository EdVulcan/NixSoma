#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT_BASE="${OPENCLAW_NATIVE_ENGINEERING_CONTEXT_PACKET_PAIR_BATCH_PORT_BASE:-26900}"
RUN_ID="${OPENCLAW_NATIVE_ENGINEERING_CONTEXT_PACKET_PAIR_BATCH_RUN_ID:-native-engineering-context-pair-$$}"

# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-core-observer-pair-runner.sh"

cleanup() {
  openclaw_core_observer_pair_down "$RUN_ID" "$PORT_BASE"
}
trap cleanup EXIT

OPENCLAW_CORE_OBSERVER_PAIR_RUN_ID="$RUN_ID" \
  openclaw_run_core_observer_pair \
    "native-engineering-context-packet" \
    "$SCRIPT_DIR/dev-openclaw-native-engineering-context-packet-common-check.sh" \
    "OPENCLAW_CORE_PORT" \
    "OPENCLAW_CONTEXT_PACKET_OBSERVER_CHECK" \
    "$PORT_BASE" \
    "OPENCLAW_CONTEXT_PACKET_CHECK_KIND=openclaw-native-engineering-context-packet" \
    "OPENCLAW_CONTEXT_PACKET_PAIR_RESET_SESSION=true"

node - <<'NODE' "$PORT_BASE" "$RUN_ID"
const [portBase, runId] = process.argv.slice(2);
console.log(JSON.stringify({
  openclawNativeEngineeringContextPacketPairBatchReuse: {
    status: "passed",
    coreChecks: 1,
    observerChecks: 1,
    servicesStartedOnce: true,
    serviceLifecycle: "one reusable scoped service lifecycle",
    runId,
    portBase: Number.parseInt(portBase, 10),
    stateReset: "observer_session_restart_before_recovery_assertions",
  },
}, null, 2));
NODE
