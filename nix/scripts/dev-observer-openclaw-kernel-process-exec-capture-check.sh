#!/usr/bin/env bash
set -euo pipefail

CORE_URL="${OPENCLAW_INSTALLED_CORE_URL:-http://127.0.0.1:4100}"
OBSERVER_URL="${OPENCLAW_INSTALLED_OBSERVER_URL:-http://127.0.0.1:4170}"
SERVICE="openclaw-system-sense.service"

systemctl is-active --quiet openclaw-core.service "$SERVICE" observer-ui.service
curl --silent --fail "$CORE_URL/health" >/dev/null
curl --silent --fail "$OBSERVER_URL/health" >/dev/null

html_file="$(mktemp)"
client_file="$(mktemp)"
capture_file="$(mktemp)"
cleanup() {
  rm -f "$html_file" "$client_file" "$capture_file"
}
trap cleanup EXIT

curl --silent --fail "$OBSERVER_URL/" >"$html_file"
curl --silent --fail "$OBSERVER_URL/client-v5.js" >"$client_file"

(
  sleep 0.2
  for _ in 1 2 3 4 5 6 7 8; do
    /usr/bin/true
  done
) &
generator_pid=$!
curl --silent --fail \
  "$CORE_URL/proxy/system-sense/system/kernel/process-exec-events" \
  >"$capture_file"
wait "$generator_pid"

node - <<'EOF' "$html_file" "$client_file" "$capture_file"
const fs = require("node:fs");
const html = fs.readFileSync(process.argv[2], "utf8");
const client = fs.readFileSync(process.argv[3], "utf8");
const capture = JSON.parse(fs.readFileSync(process.argv[4], "utf8"));

for (const token of [
  "Kernel Process Events",
  "kernel-process-exec-events",
  "kernel-process-exec-status",
  "kernel-process-exec-available",
  "kernel-process-exec-event-count",
  "kernel-process-exec-json",
]) {
  if (!html.includes(token)) {
    throw new Error(`Observer HTML missing ${token}`);
  }
}
for (const token of [
  "/system/kernel/process-exec-events",
  "refreshKernelProcessExecEvents",
  "kernelProcessExecStatus",
  "kernelProcessExecAvailable",
  "kernelProcessExecEventCount",
  "libbpf_ring_buffer",
]) {
  if (!client.includes(token)) {
    throw new Error(`Observer client missing ${token}`);
  }
}
if (capture.ok !== true
  || capture.registry !== "openclaw-kernel-process-exec-v0"
  || capture.status !== "captured"
  || capture.available !== true
  || capture.source?.transport !== "libbpf_ring_buffer"
  || capture.source?.tracepoint !== "sched_process_exec"
  || capture.source?.persisted !== false
  || !capture.events?.some((event) => event.comm === "true")) {
  throw new Error(`Observer source should expose real bounded kernel events: ${JSON.stringify(capture)}`);
}

console.log(JSON.stringify({
  observerOpenClawKernelProcessExecCapture: {
    status: "passed",
    panel: "Kernel Process Events",
    registry: capture.registry,
    transport: capture.source.transport,
    tracepoint: capture.source.tracepoint,
    eventCount: capture.eventCount,
    observedValidationProcess: true,
  },
}, null, 2));
EOF
