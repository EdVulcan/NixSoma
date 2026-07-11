# OpenClaw Native Engineering Microcompact Projection Plan

Updated: 2026-07-11

## Active Slice

Bounded in-memory microcompact context projection.

This slice advances the existing read-only savings estimate into an actual
OpenClaw-native context transformation. It accepts a caller-owned structured
message copy and returns a transformed copy suitable for later context
assembly. It never mutates task state, command transcripts, event logs, or the
caller's message objects.

Identity alignment: Level 1, stable user-space control plane.

## Endpoint

```text
POST /plugins/native-adapter/engineering-microcompact/projection
registry: openclaw-native-engineering-microcompact-projection-v0
capability: act.openclaw.engineering_context.microcompact_projection
```

## Implemented Behavior

The projection:

```text
accepts at most 100 structured messages and 500,000 text characters
protects the configured number of recent assistant turns
protects explicitly marked verification and recovery evidence
replaces only large historical toolResult text blocks
preserves message, tool, call, and non-text structural metadata
returns compacted/reclaimed character counts
publishes a summary-only audit event with no input or output content
fails closed with HTTP 503 when that audit event cannot be persisted
```

The route is a real transformation, not an estimate. The existing evidence
route remains useful for inspecting command-transcript savings before a caller
assembles messages.

## Governance

```text
no input-object mutation
no persisted transcript or log mutation
no task or approval creation
no command execution
no provider call or network egress
no credential read
no raw input/output content in audit events
service-user migration repairs ownership of the existing event JSONL
```

No approval is required because the operation transforms an ephemeral request
copy and has no durable or external effect.

## Evidence

Implementation:

```text
services/openclaw-core/src/native-engineering-microcompact-projection.mjs
services/openclaw-core/src/native-engineering-context-routes.mjs
```

Focused tests:

```text
services/openclaw-core/test/native-engineering-microcompact-projection.test.mjs
services/openclaw-core/test/native-engineering-context-routes.test.mjs
services/openclaw-core/test/route-handlers.test.mjs
```

The tests prove historical compaction, recent-turn protection, verification
evidence protection, immutable input, input bounds, method rejection, and
summary-only audit payloads.

## Deferred

```text
automatic use in provider requests
provider calls and network egress
persisted transcript rewriting
silent removal of current verification or recovery evidence
unbounded message/context inputs
```

## Next Slice

The cohesive local context assembly follow-up is complete:

```text
OPENCLAW_NATIVE_ENGINEERING_CONTEXT_PACKET_PLAN.md
```

It combines bounded task/transcript evidence, credential-like redaction,
verification/recovery summaries, and this projection without provider use. Do
not add another projection/evidence route or reactivate the historical
provider-wrapper chain solely to consume it.
