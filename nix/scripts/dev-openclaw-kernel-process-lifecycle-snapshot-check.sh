#!/usr/bin/env bash
set -euo pipefail

CORE_URL="${OPENCLAW_INSTALLED_CORE_URL:-http://127.0.0.1:4100}"
SERVICE="openclaw-system-sense.service"

environment="$(systemctl show "$SERVICE" --property=Environment --value)"
ambient="$(systemctl show "$SERVICE" --property=AmbientCapabilities --value)"
bounding="$(systemctl show "$SERVICE" --property=CapabilityBoundingSet --value)"
for token in \
  OPENCLAW_KERNEL_EVENT_CAPTURE_ENABLED=1 \
  OPENCLAW_KERNEL_PROCESS_EXIT_CAPTURE_ENABLED=1; do
  [[ "$environment" == *"$token"* ]] || { echo "installed system-sense is missing $token" >&2; exit 65; }
done
for capability in cap_bpf cap_perfmon; do
  [[ "${ambient,,}" == *"$capability"* && "${bounding,,}" == *"$capability"* ]] \
    || { echo "installed system-sense is missing $capability" >&2; exit 65; }
done

systemctl is-active --quiet openclaw-core.service "$SERVICE"
curl --silent --fail "$CORE_URL/health" >/dev/null

snapshot_file="$(mktemp)"
cleanup() { rm -f "$snapshot_file"; }
trap cleanup EXIT

(
  for _ in $(seq 1 24); do
    /run/current-system/sw/bin/true
    /run/current-system/sw/bin/sleep 0.01
    sleep 0.03
  done
) &
generator_pid=$!
curl --silent --fail \
  "$CORE_URL/proxy/system-sense/system/kernel/process-lifecycle-snapshot" \
  >"$snapshot_file"
wait "$generator_pid"

node - <<'EOF' "$snapshot_file"
const fs = require("node:fs");
const snapshot = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
if (snapshot.ok !== true
  || snapshot.registry !== "openclaw-kernel-process-lifecycle-snapshot-v0"
  || snapshot.mode !== "explicit_bounded_read_only"
  || snapshot.status !== "complete"
  || snapshot.laneCount !== 2
  || snapshot.availableLaneCount !== 2
  || !Number.isInteger(snapshot.eventCount)
  || snapshot.eventCount < 2) {
  throw new Error("process lifecycle snapshot was not complete: " + JSON.stringify(snapshot));
}
for (const [name, registry] of Object.entries({
  processExec: "openclaw-kernel-process-exec-v0",
  processExit: "openclaw-kernel-process-exit-v0",
})) {
  const lane = snapshot.lanes?.[name];
  if (lane?.registry !== registry || lane.status !== "captured" || lane.available !== true
    || !Number.isInteger(lane.eventCount) || lane.eventCount < 1
    || lane.rawEventsIncluded !== false || lane.processNamesIncluded !== false
    || lane.continuity?.captureSequence < 1) {
    throw new Error(`process lifecycle lane ${name} was invalid: ${JSON.stringify(lane)}`);
  }
}
const boundary = snapshot.boundary ?? {};
for (const key of [
  "rawEventsIncluded", "processNamesIncluded", "pidValuesIncluded", "uidValuesIncluded",
  "executableIdentityIncluded", "persisted", "automaticRepeat", "providerActivity",
  "browserActivity", "policyExecution", "hostMutation",
]) {
  if (boundary[key] !== false) throw new Error(`process lifecycle boundary ${key} widened`);
}
if (boundary.simultaneousCapture !== true || boundary.singleFlight !== true) {
  throw new Error("process lifecycle did not prove simultaneous single-flight capture");
}
const forbidden = new Set(["events", "comm", "pid", "uid", "executable", "executableIdentity"]);
function reject(value, location = "$") {
  if (Array.isArray(value)) return value.forEach((item, index) => reject(item, `${location}[${index}]`));
  if (!value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value)) {
    if (forbidden.has(key)) throw new Error(`raw process metadata leaked at ${location}.${key}`);
    reject(nested, `${location}.${key}`);
  }
}
reject(snapshot);
console.log(JSON.stringify({
  openclawKernelProcessLifecycleSnapshot: {
    status: "passed",
    registry: snapshot.registry,
    eventCount: snapshot.eventCount,
    processExecEvents: snapshot.lanes.processExec.eventCount,
    processExitEvents: snapshot.lanes.processExit.eventCount,
    rawEventsIncluded: false,
    persisted: false,
    automaticRepeat: false,
    hostMutation: false,
  },
}, null, 2));
EOF
