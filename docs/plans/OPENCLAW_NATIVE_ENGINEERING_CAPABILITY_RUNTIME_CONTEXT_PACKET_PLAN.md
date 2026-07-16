# OpenClaw Native Engineering Capability Runtime Context Packet Plan

Updated: 2026-07-16

## Active Slice

Expose the existing local Engineering Context Packet through the common
`POST /capabilities/invoke` runtime.

Identity alignment: Level 1, stable user-space control plane.

## Demonstrated Gap

The packet owner already assembled bounded task/transcript, verification,
recovery, work-view, and plan/todo context with redaction and microcompact
protection. Its dedicated route and Observer control were governed, but a local
capability consumer could not request the same packet through the common policy,
invocation ledger, and capability-event path.

## Implemented Behavior

The registry now exposes:

```text
sense.openclaw.engineering_context.packet
```

The existing packet route and capability share one assembly helper. The common
capability supports the existing bounded task/source selectors, work-view and
plan/todo flags, output limits, and microcompact parameters. It publishes the
same summary-only `native_engineering.context_packet_built` audit event before
the standard `capability.invoked` event. Observer's packet builder now uses
this common path and unwraps only the transient result for local rendering.

The existing work-view bind control also uses
`act.openclaw.engineering_context.work_view_bind` through the common path,
keeping `taskId`, `confirm:true`, and the explicit stale-binding `rebind` flag
bound to the existing operator-reviewed owner.

The response may contain the bounded transient packet messages required by the
local context consumer. Invocation history and event evidence retain only
counts, redaction/compaction, source, and governance summaries; command output,
packet messages, credentials, URLs, and page payloads are not persisted there.

## Governance

```text
audit-only local capability
existing policy decision, invocation ledger, and capability events
shared packet owner preserves redaction, output, and microcompact bounds
explicit source task must exist and remains read-only
work-view/plan-todo selectors remain explicit
no task mutation, approval creation, command execution, or provider call
no credential-store read, provider egress, or packet artifact persistence
```

## Evidence

Runtime:

```text
services/openclaw-core/src/native-engineering-context-packet-assembly.mjs
services/openclaw-core/src/capability-runtime-engineering-context.mjs
services/openclaw-core/src/capability-runtime.mjs
services/openclaw-core/src/native-engineering-context-routes.mjs
```

Tests and real checks:

```text
services/openclaw-core/test/capability-runtime.test.mjs
services/openclaw-core/test/native-engineering-context-routes.test.mjs
apps/observer-ui/test/client-script-engineering-context.test.mjs
nix/scripts/dev-capability-invoke-check.sh
nix/scripts/dev-observer-capability-invoke-check.sh
openclaw-native-engineering-context-packet-pair-batch-reuse
```

## Deferred

```text
automatic packet persistence or transcript rewriting
automatic task/recovery/approval/execution creation
provider SDK loading, provider calls, and credential access
raw visual/page payload transfer
```

## Next Smallest Capability

Keep packet assembly local and transient. Use its existing explicit provider
handoff or operator review paths when selected; do not create an automatic
packet-to-provider or packet-to-action bridge.
