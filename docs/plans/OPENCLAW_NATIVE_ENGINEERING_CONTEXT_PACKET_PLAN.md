# OpenClaw Native Engineering Context Packet Plan

Updated: 2026-07-11

## Active Slice

Local governed engineering context assembly.

This slice gives OpenClaw a cohesive local owner for preparing model-ready
engineering context without invoking a provider. It combines bounded command
transcripts, task summaries, verification summary, recovery summary, output
redaction, and the native microcompact projection into one packet.

Identity alignment: Level 1, stable user-space control plane.

## Endpoint

```text
POST /plugins/native-adapter/engineering-context/packet
registry: openclaw-native-engineering-context-packet-v0
capability: sense.openclaw.engineering_context.packet
```

Optional request fields select an existing task, transcript count, per-record
output limit, microcompact threshold, and recent assistant-turn protection.

## Implemented Behavior

The packet owner:

```text
reads the existing command transcript ledger and task map
reuses existing verification and recovery builders
orders selected command evidence chronologically
adds bounded task goal/status/outcome summaries
caps stdout/stderr per record
redacts password/token/secret/api-key/credential, Bearer, and sk-* patterns
applies the native in-memory microcompact projection
marks verification and recovery summaries as protected evidence
persists a summary-only audit event before returning packet content
fails closed with HTTP 503 when audit persistence is unavailable
```

## Governance

```text
local context assembly only
no credential-store read
no task, transcript, or event-content mutation
no task or approval creation
no command execution
no provider SDK or provider call
no network egress
no raw packet content in audit events
```

The packet may contain bounded local command output because its purpose is to
prepare useful engineering context. Credential-like output is redacted first,
and callers can scope the packet to one task.

## Evidence

Implementation:

```text
services/openclaw-core/src/native-engineering-context-packet.mjs
services/openclaw-core/src/native-engineering-context-routes.mjs
```

Tests:

```text
services/openclaw-core/test/native-engineering-context-packet.test.mjs
services/openclaw-core/test/native-engineering-context-routes.test.mjs
services/openclaw-core/test/route-handlers.test.mjs
```

Tests prove task filtering, output bounds, credential-like redaction,
microcompaction, verification/recovery protection, no provider/network flags,
and summary-only audit publication.

## Deferred

```text
automatic provider request creation
credential value access
provider SDK loading or network egress
automatic packet persistence
automatic task execution or recovery
unbounded transcript/output inclusion
```

## Next Slice

The next provider-related step may consume this packet only when an explicit
provider/API integration route is selected. Until then, improve the packet only
for a concrete local engineering workflow gap; do not resume the historical
Phase 59-136 wrapper chain.
