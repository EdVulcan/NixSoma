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
temporary_file="$(mktemp)"
cleanup() {
  rm -f "$html_file" "$client_file" "$capture_file" "$temporary_file"
}
trap cleanup EXIT

curl --silent --fail "$OBSERVER_URL/" >"$html_file"
curl --silent --fail "$OBSERVER_URL/client-v5.js" >"$client_file"

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

node - <<'EOF' "$html_file" "$client_file" "$capture_file"
const fs = require("node:fs");
const html = fs.readFileSync(process.argv[2], "utf8");
const client = fs.readFileSync(process.argv[3], "utf8");
const capture = JSON.parse(fs.readFileSync(process.argv[4], "utf8"));

for (const token of [
  "Kernel File Open Attempts",
  "kernel-file-open-events",
  "kernel-file-open-status",
  "kernel-file-open-available",
  "kernel-file-open-event-count",
  "kernel-file-open-unique-comm-count",
  "kernel-file-open-unique-flag-count",
  "kernel-file-open-unique-pid-count",
  "kernel-file-open-unique-uid-count",
  "kernel-file-open-continuity-status",
  "kernel-file-open-capture-sequence",
  "kernel-file-open-activity",
  "kernel-file-open-new-comm-count",
  "kernel-file-open-readback-json",
  "kernel-file-open-json",
]) {
  if (!html.includes(token)) throw new Error("Observer HTML missing " + token);
}
for (const token of [
  "/system/kernel/file-open-events",
  "refreshKernelFileOpenEvents",
  "kernelFileOpenStatus",
  "kernelFileOpenAvailable",
  "kernelFileOpenEventCount",
  "kernelFileOpenUniqueCommCount",
  "kernelFileOpenUniqueFlagCount",
  "kernelFileOpenUniquePidCount",
  "kernelFileOpenUniqueUidCount",
  "kernelFileOpenContinuityStatus",
  "kernelFileOpenCaptureSequence",
  "kernelFileOpenActivity",
  "kernelFileOpenNewCommCount",
  "kernelFileOpenReadbackJson",
]) {
  if (!client.includes(token)) throw new Error("Observer client missing " + token);
}
if (capture.registry !== "openclaw-kernel-file-open-v0"
  || capture.status !== "captured"
  || capture.available !== true
  || capture.readback?.registry !== "openclaw-kernel-file-open-readback-v0"
  || capture.readback?.persisted !== false
  || capture.readback?.pathCaptured !== false
  || capture.readback?.filenameCaptured !== false
  || capture.readback?.contentCaptured !== false
  || capture.readback?.resultCaptured !== false
  || capture.source?.flagsCaptured !== true
  || capture.source?.modeCaptured !== true
  || !capture.events?.some((event) => ["cat", "bash", "touch"].includes(event.comm))) {
  throw new Error("Observer should expose real bounded file-open events: " + JSON.stringify(capture));
}
const forbiddenFields = new Set(["path", "filename", "content", "inode", "mount", "result", "returnValue"]);
function assertNoForbiddenFields(value, path = "$") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoForbiddenFields(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value)) {
    if (forbiddenFields.has(key)) throw new Error(`forbidden file field leaked into Observer evidence at ${path}.${key}`);
    assertNoForbiddenFields(nested, `${path}.${key}`);
  }
}
assertNoForbiddenFields(capture);

console.log(JSON.stringify({
  observerOpenClawKernelFileOpenCapture: {
    status: "passed",
    panel: "Kernel File Open Attempts",
    registry: capture.registry,
    transport: capture.source.transport,
    tracepoint: capture.source.tracepoint,
    eventCount: capture.eventCount,
    uniqueCommCount: capture.readback.uniqueCommCount,
    uniqueFlagCount: capture.readback.uniqueFlagCount,
    continuityStatus: capture.readback.continuity.status,
    pathCaptured: false,
    contentCaptured: false,
    persisted: false,
  },
}, null, 2));
EOF
