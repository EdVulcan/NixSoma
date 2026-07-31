#!/usr/bin/env bash
set -euo pipefail

CORE_URL="${OPENCLAW_INSTALLED_CORE_URL:-http://127.0.0.1:4100}"
SERVICE="openclaw-system-sense.service"

environment="$(systemctl show "$SERVICE" --property=Environment --value)"
ambient="$(systemctl show "$SERVICE" --property=AmbientCapabilities --value)"
bounding="$(systemctl show "$SERVICE" --property=CapabilityBoundingSet --value)"
for token in \
  OPENCLAW_KERNEL_EVENT_CAPTURE_ENABLED=1 \
  OPENCLAW_KERNEL_NETWORK_CAPTURE_ENABLED=1 \
  OPENCLAW_KERNEL_FILE_CAPTURE_ENABLED=1; do
  [[ "$environment" == *"$token"* ]] || { echo "installed system-sense is missing $token" >&2; exit 65; }
done
for capability in cap_bpf cap_perfmon; do
  [[ "${ambient,,}" == *"$capability"* && "${bounding,,}" == *"$capability"* ]] \
    || { echo "installed system-sense is missing $capability" >&2; exit 65; }
done

systemctl is-active --quiet openclaw-core.service "$SERVICE"
curl --silent --fail "$CORE_URL/health" >/dev/null

snapshot_file="$(mktemp)"
temporary_file="$(mktemp)"
cleanup() { rm -f "$snapshot_file" "$temporary_file"; }
trap cleanup EXIT

(
  for _ in $(seq 1 24); do
    /run/current-system/sw/bin/true
    curl --silent --fail "$CORE_URL/health" >/dev/null
    : >"$temporary_file"
    /run/current-system/sw/bin/cat "$temporary_file" >/dev/null
    sleep 0.05
  done
) &
generator_pid=$!
curl --silent --fail \
  "$CORE_URL/proxy/system-sense/system/kernel/activity-snapshot" \
  >"$snapshot_file"
wait "$generator_pid"

node - <<'EOF' "$snapshot_file"
const fs = require("node:fs");
const snapshot = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
if (snapshot.ok !== true
  || snapshot.registry !== "openclaw-kernel-activity-snapshot-v0"
  || snapshot.mode !== "explicit_bounded_read_only"
  || snapshot.status !== "complete"
  || snapshot.laneCount !== 3
  || snapshot.availableLaneCount !== 3
  || !Number.isInteger(snapshot.eventCount)
  || snapshot.eventCount < 3) {
  throw new Error("kernel activity snapshot was not complete: " + JSON.stringify(snapshot));
}
const expected = {
  processExec: "openclaw-kernel-process-exec-v0",
  networkConnect: "openclaw-kernel-network-connect-v0",
  fileOpen: "openclaw-kernel-file-open-v0",
};
for (const [laneName, registry] of Object.entries(expected)) {
  const lane = snapshot.lanes?.[laneName];
  if (lane?.registry !== registry || lane.status !== "captured" || lane.available !== true
    || !Number.isInteger(lane.eventCount) || lane.eventCount < 1
    || lane.rawEventsIncluded !== false
    || lane.continuity?.captureSequence < 1) {
    throw new Error(`kernel activity lane ${laneName} was invalid: ${JSON.stringify(lane)}`);
  }
}
const boundary = snapshot.boundary ?? {};
for (const key of [
  "rawEventsIncluded", "commNamesIncluded", "executableIdentityIncluded",
  "networkDestinationIncluded", "networkPortIncluded", "networkPayloadIncluded",
  "filePathIncluded", "fileNameIncluded", "fileContentIncluded", "fileResultIncluded",
  "persisted", "automaticRepeat", "providerActivity", "browserActivity",
  "policyExecution", "hostMutation",
]) {
  if (boundary[key] !== false) throw new Error(`kernel activity boundary ${key} widened`);
}
if (boundary.simultaneousCapture !== true || boundary.singleFlight !== true) {
  throw new Error("kernel activity snapshot did not prove simultaneous single-flight capture");
}
const forbidden = new Set([
  "events", "comm", "commCounts", "newCommNames", "entries", "executableIdentity",
  "destination", "address", "port", "payload", "family", "familyCounts",
  "path", "filename", "content", "inode", "mount", "result", "returnValue",
  "flags", "flagCounts",
]);
function reject(value, location = "$") {
  if (Array.isArray(value)) return value.forEach((item, index) => reject(item, `${location}[${index}]`));
  if (!value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value)) {
    if (forbidden.has(key)) throw new Error(`raw kernel metadata leaked at ${location}.${key}`);
    reject(nested, `${location}.${key}`);
  }
}
reject(snapshot);
if (Object.hasOwn(snapshot.lanes?.fileOpen ?? {}, "mode")) {
  throw new Error("file mode metadata leaked at $.lanes.fileOpen.mode");
}
console.log(JSON.stringify({
  openclawKernelActivitySnapshot: {
    status: "passed",
    registry: snapshot.registry,
    eventCount: snapshot.eventCount,
    processExecEvents: snapshot.lanes.processExec.eventCount,
    networkConnectEvents: snapshot.lanes.networkConnect.eventCount,
    fileOpenEvents: snapshot.lanes.fileOpen.eventCount,
    rawEventsIncluded: false,
    persisted: false,
    automaticRepeat: false,
    hostMutation: false,
  },
}, null, 2));
EOF
