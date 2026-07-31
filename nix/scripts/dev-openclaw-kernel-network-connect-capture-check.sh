#!/usr/bin/env bash
set -euo pipefail

CORE_URL="${OPENCLAW_INSTALLED_CORE_URL:-http://127.0.0.1:4100}"
SERVICE="openclaw-system-sense.service"

kernel_environment="$(systemctl show "$SERVICE" --property=Environment --value)"
ambient_capabilities="$(systemctl show "$SERVICE" --property=AmbientCapabilities --value)"
bounding_capabilities="$(systemctl show "$SERVICE" --property=CapabilityBoundingSet --value)"
if [[ "$kernel_environment" != *"OPENCLAW_KERNEL_NETWORK_CAPTURE_ENABLED=1"* \
  || "$kernel_environment" != *"OPENCLAW_KERNEL_NETWORK_PROBE=/nix/store/"* \
  || "${ambient_capabilities,,}" != *"cap_bpf"* \
  || "${ambient_capabilities,,}" != *"cap_perfmon"* \
  || "${bounding_capabilities,,}" != *"cap_bpf"* \
  || "${bounding_capabilities,,}" != *"cap_perfmon"* ]]; then
  echo "installed system-sense has not enabled the bounded network eBPF capture capability" >&2
  exit 65
fi

systemctl is-active --quiet openclaw-core.service "$SERVICE"
curl --silent --fail "$CORE_URL/health" >/dev/null

capture_file="$(mktemp)"
cleanup() {
  rm -f "$capture_file"
}
trap cleanup EXIT

(
  for _ in $(seq 1 20); do
    curl --silent --fail "$CORE_URL/health" >/dev/null
    sleep 0.1
  done
) &
generator_pid=$!
curl --silent --fail \
  "$CORE_URL/proxy/system-sense/system/kernel/network-connect-events" \
  >"$capture_file"
wait "$generator_pid"

node - <<'EOF' "$capture_file"
const fs = require("node:fs");

const capture = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const expectedFields = ["timestampNs", "pid", "uid", "comm", "family", "addressLength"];
if (capture.ok !== true
  || capture.registry !== "openclaw-kernel-network-connect-v0"
  || capture.mode !== "read_only"
  || capture.enabled !== true
  || capture.available !== true
  || capture.captureOk !== true
  || capture.status !== "captured"
  || !Array.isArray(capture.events)
  || capture.eventCount !== capture.events.length
  || capture.eventCount < 1) {
  throw new Error("kernel network-connect capture should return real bounded events: " + JSON.stringify(capture));
}
if (capture.source?.transport !== "libbpf_ring_buffer"
  || capture.source?.attachment !== "fentry"
  || capture.source?.tracepoint !== "__sys_connect"
  || capture.source?.familyCaptured !== true
  || JSON.stringify(capture.source?.fields) !== JSON.stringify(expectedFields)
  || capture.source?.destinationCaptured !== false
  || capture.source?.portCaptured !== false
  || capture.source?.addressBytesCaptured !== false
  || capture.source?.networkPayloadCaptured !== false
  || capture.source?.persisted !== false
  || capture.source?.policyExecution !== false) {
  throw new Error("kernel network-connect source contract is not bounded: " + JSON.stringify(capture.source));
}
for (const event of capture.events) {
  if (JSON.stringify(Object.keys(event).sort()) !== JSON.stringify(expectedFields.slice().sort())
    || typeof event.timestampNs !== "string"
    || !/^\d+$/.test(event.timestampNs)
    || !Number.isInteger(event.pid)
    || event.pid < 1
    || !Number.isInteger(event.uid)
    || event.uid < 0
    || typeof event.comm !== "string"
    || event.comm.length < 1
    || event.comm.length > 15
    || !Number.isInteger(event.family)
    || event.family < 0
    || event.family > 65535
    || !Number.isInteger(event.addressLength)
    || event.addressLength < 0
    || event.addressLength > 65535) {
    throw new Error("kernel network-connect event violated the metadata contract: " + JSON.stringify(event));
  }
}
if (!capture.events.some((event) => event.comm === "curl")) {
  throw new Error("kernel network-connect capture did not observe the validation curl process: " + JSON.stringify(capture.events));
}
if (!capture.events.some((event) => event.family > 0)) {
  throw new Error("kernel network-connect capture did not prove sockaddr family readback");
}
if (capture.readback?.registry !== "openclaw-kernel-network-connect-readback-v0"
  || capture.readback?.mode !== "bounded_in_memory_summary"
  || capture.readback?.persisted !== false
  || capture.readback?.uniqueCommCount < 1
  || capture.readback?.uniqueFamilyCount < 1
  || !capture.readback?.commCounts?.some((entry) => entry.comm === "curl")
  || capture.readback?.continuity?.registry !== "openclaw-kernel-network-connect-continuity-v0"
  || !["first_capture", "continued"].includes(capture.readback?.continuity?.status)
  || !Number.isInteger(capture.readback?.continuity?.captureSequence)
  || capture.readback.continuity.captureSequence < 1
  || capture.readback.continuity.currentActivity !== "connect_attempts_observed"
  || capture.readback?.destinationCaptured !== false
  || capture.readback?.portCaptured !== false
  || capture.readback?.networkPayloadCaptured !== false) {
  throw new Error("kernel network-connect readback violated its bounded contract: " + JSON.stringify(capture.readback));
}
const serialised = JSON.stringify(capture);
if (serialised.includes("127.0.0.1") || serialised.includes("4100") || serialised.includes("4106")) {
  throw new Error("network destination or port leaked into kernel connect evidence");
}

console.log(JSON.stringify({
  openclawKernelNetworkConnectCapture: {
    status: "passed",
    registry: capture.registry,
    transport: capture.source.transport,
    tracepoint: capture.source.tracepoint,
    eventCount: capture.eventCount,
    uniqueCommCount: capture.readback.uniqueCommCount,
    uniqueFamilyCount: capture.readback.uniqueFamilyCount,
    readbackRegistry: capture.readback.registry,
    continuityStatus: capture.readback.continuity.status,
    captureSequence: capture.readback.continuity.captureSequence,
    observedValidationProcess: true,
    destinationCaptured: capture.source.destinationCaptured,
    portCaptured: capture.source.portCaptured,
    networkPayloadCaptured: capture.source.networkPayloadCaptured,
    persisted: capture.source.persisted,
  },
}, null, 2));
EOF
