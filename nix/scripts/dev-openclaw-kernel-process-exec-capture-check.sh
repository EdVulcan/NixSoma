#!/usr/bin/env bash
set -euo pipefail

CORE_URL="${OPENCLAW_INSTALLED_CORE_URL:-http://127.0.0.1:4100}"
SERVICE="openclaw-system-sense.service"

kernel_environment="$(systemctl show "$SERVICE" --property=Environment --value)"
ambient_capabilities="$(systemctl show "$SERVICE" --property=AmbientCapabilities --value)"
bounding_capabilities="$(systemctl show "$SERVICE" --property=CapabilityBoundingSet --value)"
if [[ "$kernel_environment" != *"OPENCLAW_KERNEL_EVENT_CAPTURE_ENABLED=1"* \
  || "$kernel_environment" != *"OPENCLAW_KERNEL_EVENT_PROBE=/nix/store/"* \
  || "${ambient_capabilities,,}" != *"cap_bpf"* \
  || "${ambient_capabilities,,}" != *"cap_perfmon"* \
  || "${bounding_capabilities,,}" != *"cap_bpf"* \
  || "${bounding_capabilities,,}" != *"cap_perfmon"* ]]; then
  echo "installed system-sense has not enabled the bounded eBPF capture capability" >&2
  exit 65
fi

systemctl is-active --quiet openclaw-core.service "$SERVICE"
curl --silent --fail "$CORE_URL/health" >/dev/null

capture_file="$(mktemp)"
true_binary="$(type -P true)"
if [[ -z "$true_binary" ]]; then
  echo "could not resolve an external true binary for process-exec validation" >&2
  exit 66
fi
cleanup() {
  rm -f "$capture_file"
}
trap cleanup EXIT

(
  for _ in $(seq 1 20); do
    "$true_binary"
    sleep 0.1
  done
) &
generator_pid=$!
curl --silent --fail \
  "$CORE_URL/proxy/system-sense/system/kernel/process-exec-events" \
  >"$capture_file"
wait "$generator_pid"

node - <<'EOF' "$capture_file"
const fs = require("node:fs");

const capture = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const expectedFields = ["timestampNs", "pid", "uid", "comm"];
const expectedExecutableIdentityFields = [...expectedFields, "executable"];
if (capture.ok !== true
  || capture.registry !== "openclaw-kernel-process-exec-v0"
  || capture.mode !== "read_only"
  || capture.enabled !== true
  || capture.available !== true
  || capture.captureOk !== true
  || capture.status !== "captured"
  || !Array.isArray(capture.events)
  || capture.eventCount !== capture.events.length
  || capture.eventCount < 1) {
  throw new Error(`kernel process-exec capture should return real bounded events: ${JSON.stringify(capture)}`);
}
if (capture.source?.transport !== "libbpf_ring_buffer"
  || capture.source?.tracepoint !== "sched_process_exec"
  || JSON.stringify(capture.source?.fields) !== JSON.stringify(expectedFields)
  || JSON.stringify(capture.source?.executableIdentityFields) !== JSON.stringify(expectedExecutableIdentityFields)
  || capture.source?.commandLineCaptured !== false
  || capture.source?.pathCaptured !== false
  || capture.source?.executableIdentityCaptured !== true
  || capture.source?.executableIdentityLimit !== 16
  || capture.source?.executableMaxLength !== 255
  || capture.source?.fileContentCaptured !== false
  || capture.source?.networkCaptured !== false
  || capture.source?.persisted !== false
  || capture.source?.policyExecution !== false) {
  throw new Error(`kernel process-exec source contract is not read-only and bounded: ${JSON.stringify(capture.source)}`);
}
for (const event of capture.events) {
  if (JSON.stringify(Object.keys(event).sort()) !== JSON.stringify(expectedFields.slice().sort())
    || typeof event.timestampNs !== "string"
    || !/^\d+$/.test(event.timestampNs)
    || !Number.isInteger(event.pid)
    || !Number.isInteger(event.uid)
    || typeof event.comm !== "string"
    || event.comm.length < 1
    || event.comm.length > 15) {
    throw new Error(`kernel process-exec event violated the four-field contract: ${JSON.stringify(event)}`);
  }
}
if (!capture.events.some((event) => event.comm === "true")) {
  throw new Error(`kernel process-exec capture did not observe the validation child process: ${JSON.stringify(capture.events)}`);
}
if (capture.readback?.registry !== "openclaw-kernel-process-exec-readback-v0"
  || capture.readback?.mode !== "bounded_in_memory_summary"
  || capture.readback?.persisted !== false
  || capture.readback?.uniqueCommCount < 1
  || !capture.readback?.commCounts?.some((entry) => entry.comm === "true")
  || capture.readback?.continuity?.registry !== "openclaw-kernel-process-exec-continuity-v0"
  || !["first_capture", "continued"].includes(capture.readback?.continuity?.status)
  || !Number.isInteger(capture.readback?.continuity?.captureSequence)
  || capture.readback.continuity.captureSequence < 1
  || capture.readback.continuity.currentActivity !== "events_observed"
  || capture.readback.continuity.persisted !== false
  || capture.readback.executableIdentity?.registry !== "openclaw-kernel-process-exec-executable-identity-v0"
  || capture.readback.executableIdentity?.mode !== "bounded_in_memory_executable_identity"
  || capture.readback.executableIdentity?.persisted !== false
  || capture.readback.executableIdentity?.identityCount < 1
  || !capture.readback.executableIdentity?.entries?.some((entry) => (
    entry.comm === "true" && typeof entry.executable === "string" && entry.executable.endsWith("/true")
  ))) {
  throw new Error(`kernel process-exec readback summary violated its bounded contract: ${JSON.stringify(capture.readback)}`);
}

console.log(JSON.stringify({
  openclawKernelProcessExecCapture: {
    status: "passed",
    registry: capture.registry,
    transport: capture.source.transport,
    tracepoint: capture.source.tracepoint,
    eventCount: capture.eventCount,
    uniqueCommCount: capture.readback.uniqueCommCount,
    readbackRegistry: capture.readback.registry,
    continuityStatus: capture.readback.continuity.status,
    captureSequence: capture.readback.continuity.captureSequence,
    observedValidationProcess: true,
    observedExecutableIdentity: capture.readback.executableIdentity.entries.find((entry) => entry.comm === "true")?.executable,
    commandLineCaptured: capture.source.commandLineCaptured,
    persisted: capture.source.persisted,
  },
}, null, 2));
EOF
