#!/usr/bin/env bash
set -euo pipefail

CORE_URL="${OPENCLAW_INSTALLED_CORE_URL:-http://127.0.0.1:4100}"
SERVICE="openclaw-system-sense.service"

kernel_environment="$(systemctl show "$SERVICE" --property=Environment --value)"
ambient_capabilities="$(systemctl show "$SERVICE" --property=AmbientCapabilities --value)"
bounding_capabilities="$(systemctl show "$SERVICE" --property=CapabilityBoundingSet --value)"
if [[ "$kernel_environment" != *"OPENCLAW_KERNEL_FILE_CAPTURE_ENABLED=1"* \
  || "$kernel_environment" != *"OPENCLAW_KERNEL_FILE_PROBE=/nix/store/"* \
  || "${ambient_capabilities,,}" != *"cap_bpf"* \
  || "${ambient_capabilities,,}" != *"cap_perfmon"* \
  || "${bounding_capabilities,,}" != *"cap_bpf"* \
  || "${bounding_capabilities,,}" != *"cap_perfmon"* ]]; then
  echo "installed system-sense has not enabled the bounded file-open eBPF capture capability" >&2
  exit 65
fi

systemctl is-active --quiet openclaw-core.service "$SERVICE"
curl --silent --fail "$CORE_URL/health" >/dev/null

capture_file="$(mktemp)"
temporary_file="$(mktemp)"
cleanup() {
  rm -f "$capture_file" "$temporary_file"
}
trap cleanup EXIT

(
  for _ in $(seq 1 20); do
    : >"$temporary_file"
    /run/current-system/sw/bin/cat "$temporary_file" >/dev/null
    sleep 0.1
  done
) &
generator_pid=$!
curl --silent --fail \
  "$CORE_URL/proxy/system-sense/system/kernel/file-open-events" \
  >"$capture_file"
wait "$generator_pid"

node - <<'EOF' "$capture_file"
const fs = require("node:fs");

const capture = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const expectedFields = ["timestampNs", "pid", "uid", "comm", "flags", "mode"];
if (capture.ok !== true
  || capture.registry !== "openclaw-kernel-file-open-v0"
  || capture.mode !== "read_only"
  || capture.enabled !== true
  || capture.available !== true
  || capture.captureOk !== true
  || capture.status !== "captured"
  || !Array.isArray(capture.events)
  || capture.eventCount !== capture.events.length
  || capture.eventCount < 1) {
  throw new Error("kernel file-open capture should return real bounded events: " + JSON.stringify(capture));
}
if (capture.source?.transport !== "libbpf_ring_buffer"
  || capture.source?.attachment !== "fentry"
  || capture.source?.tracepoint !== "do_sys_openat2"
  || JSON.stringify(capture.source?.fields) !== JSON.stringify(expectedFields)
  || capture.source?.flagsCaptured !== true
  || capture.source?.modeCaptured !== true
  || capture.source?.pathCaptured !== false
  || capture.source?.filenameCaptured !== false
  || capture.source?.contentCaptured !== false
  || capture.source?.inodeCaptured !== false
  || capture.source?.mountCaptured !== false
  || capture.source?.resultCaptured !== false
  || capture.source?.persisted !== false
  || capture.source?.policyExecution !== false) {
  throw new Error("kernel file-open source contract is not bounded: " + JSON.stringify(capture.source));
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
    || typeof event.flags !== "string"
    || !/^(?:0|[1-9]\d*)$/.test(event.flags)
    || typeof event.mode !== "string"
    || !/^(?:0|[1-9]\d*)$/.test(event.mode)) {
    throw new Error("kernel file-open event violated the metadata contract: " + JSON.stringify(event));
  }
}
if (!capture.events.some((event) => ["cat", "bash", "touch"].includes(event.comm))) {
  throw new Error("kernel file-open capture did not observe a validation process: " + JSON.stringify(capture.events));
}
if (capture.readback?.registry !== "openclaw-kernel-file-open-readback-v0"
  || capture.readback?.mode !== "bounded_in_memory_summary"
  || capture.readback?.persisted !== false
  || capture.readback?.uniqueCommCount < 1
  || capture.readback?.uniqueFlagCount < 1
  || capture.readback?.continuity?.registry !== "openclaw-kernel-file-open-continuity-v0"
  || !["baseline", "compared"].includes(capture.readback?.continuity?.status)
  || !Number.isInteger(capture.readback?.continuity?.captureSequence)
  || capture.readback.continuity.captureSequence < 1
  || capture.readback.continuity.currentActivity !== "file_open_attempts_observed"
  || capture.readback?.pathCaptured !== false
  || capture.readback?.filenameCaptured !== false
  || capture.readback?.contentCaptured !== false
  || capture.readback?.inodeCaptured !== false
  || capture.readback?.mountCaptured !== false
  || capture.readback?.resultCaptured !== false) {
  throw new Error("kernel file-open readback violated its bounded contract: " + JSON.stringify(capture.readback));
}
const forbiddenFields = new Set(["path", "filename", "content", "inode", "mount", "result", "returnValue"]);
function assertNoForbiddenFields(value, path = "$") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoForbiddenFields(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value)) {
    if (forbiddenFields.has(key)) throw new Error(`forbidden file field leaked at ${path}.${key}`);
    assertNoForbiddenFields(nested, `${path}.${key}`);
  }
}
assertNoForbiddenFields(capture);

console.log(JSON.stringify({
  openclawKernelFileOpenCapture: {
    status: "passed",
    registry: capture.registry,
    transport: capture.source.transport,
    tracepoint: capture.source.tracepoint,
    eventCount: capture.eventCount,
    uniqueCommCount: capture.readback.uniqueCommCount,
    uniqueFlagCount: capture.readback.uniqueFlagCount,
    continuityStatus: capture.readback.continuity.status,
    observedValidationProcess: true,
    pathCaptured: false,
    contentCaptured: false,
    persisted: false,
  },
}, null, 2));
EOF
