# OpenClaw Native Engineering Context Provider Source Task Plan

Updated: 2026-07-15

## Active Slice

Explicit source-task selection for the existing approved provider context
handoff.

Identity alignment: Level 1 engineering control plane at the Level 1 to Level 2
work-view/provider boundary.

## Demonstrated Gap

The provider egress executor owns the live provider task, but the context packet
was also forced to use that same task id. A provider task therefore could not
consume the preceding source-command, verification, edit, or workbench task
that contained the engineering evidence the operator intended to review.

## Implemented Behavior

The existing context request keeps `taskId` for the provider egress task and
may explicitly add:

```json
{
  "taskId": "<approved-egress-task-id>",
  "sourceTaskId": "<existing-engineering-evidence-task-id>"
}
```

Materialization then:

```text
keeps the egress task as the execution and approval owner
requires the source task to exist in the local task map
builds transcript, verification, recovery, work-view, and plan/todo evidence
from the selected source task
records executionTaskId and sourceTaskId in compact handoff evidence
rechecks the complete materialized provider request through the existing hash
binding before credential read or network egress
```

When `sourceTaskId` is absent, the existing same-task behavior remains the
default. A missing source task fails closed. The source task is read-only in
this path; it is not rebound, resumed, mutated, or automatically executed.

The existing local Engineering Context Packet route now exposes the same
selection boundary for operator use. Observer provides a separate source-task
input, shows the effective source task in packet readback, and offers an
explicit `Use Task Detail ID` shortcut. It sends `taskId` and `sourceTaskId`
separately; work-view binding continues to use only the Task Detail ID, and
building the packet still performs no task, approval, command, provider, or
network mutation.

## Governance

```text
explicit sourceTaskId required for cross-task context
provider egress approval remains attached to the egress task
explicit cross-task source identity and request content are covered by the
approval binding
context content remains transient
no automatic task/approval/action creation
no provider call during materialization
no credential-store read during context assembly
```

The source task id is bounded metadata. Its task goal, command output, plan,
and recovery content remain subject to the existing output bounds,
credential-like redaction, microcompact protection, and provider message size
limit.

## Evidence

Runtime:

```text
services/openclaw-core/src/cloud-live-provider-runtime-context-packet.mjs
services/openclaw-core/src/cloud-live-provider-runtime-live-execution.mjs
services/openclaw-core/src/cloud-live-provider-network-sender.mjs
services/openclaw-core/src/cloud-live-provider-runtime-credential-egress-gate-builders.mjs
```

Tests:

```text
services/openclaw-core/test/cloud-live-provider-runtime-context-packet.test.mjs
services/openclaw-core/test/cloud-live-provider-runtime-live-execution.test.mjs
services/openclaw-core/test/cloud-live-provider-network-sender.test.mjs
services/openclaw-core/test/cloud-live-provider-runtime-credential-egress-gate-builders.test.mjs
services/openclaw-core/test/task-executor.test.mjs
```

The production-shape materializer test proves a provider task consumes a
separate source task, preserves both ids, includes the source transcript, and
rejects an unknown source. Existing live execution tests prove only compact
source/egress provenance is retained.

The local packet route and Observer tests additionally prove independent
execution/source ids, source-only transcript selection, unknown-source
fail-closed behavior, source readback, and the explicit shortcut. The existing
packet core/Observer batch check exercises the same route against real local
services.

The approval-binding follow-up now retains an explicitly selected
`contextPacket.sourceTaskId` in the redacted binding hash. A changed source is
rejected before the sender runs, even when the replacement happens to produce
the same bounded context hash. The existing Phase 63 and Phase 64 core HTTP
fixtures submit that source selection through the egress task route and assert
the serialized binding; they still prove no credential read, endpoint contact,
network egress, or provider response.

## Deferred

```text
automatic source-task selection
automatic provider task creation or approval
automatic source-task mutation or recovery
provider transcript persistence
raw visual/page payload transfer
ACPX/Codex live process execution and long-lived LSP pools
```

## Next Smallest Capability

Keep source selection explicit and bounded. Do not add automatic source-task
inference, source-task mutation, or provider-task creation. Continue on the
selected Level 2 trusted work-view/session-helper route only after its runtime
owner and authority boundary are explicit.
