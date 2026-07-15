# OpenClaw Native Engineering Capability Runtime Work-View Bind Plan

Updated: 2026-07-15

## Active Slice

Expose the existing operator-reviewed engineering-task to trusted work-view
binding through the common `POST /capabilities/invoke` runtime.

Identity alignment: Level 2, trusted session/work-view component.

## Demonstrated Gap

The dedicated work-view bind route already closed the unbound-task gap, but a
capability consumer could not request that same operator action through the
normal capability policy, invocation ledger, and capability-event path. A
second implementation would allow route and capability binding semantics to
drift.

## Implemented Behavior

The registry now exposes:

```text
act.openclaw.engineering_context.work_view_bind
```

The capability and the dedicated route share
`executeNativeEngineeringWorkViewBind`. The operation requires an existing
task, accepts `params.confirm: true` as the explicit operator confirmation,
re-reads the session-manager authority immediately before mutation, rejects
stale session/work-view identities unless `params.rebind: true` is explicit,
and delegates task mutation to the existing task-manager owner.

The response is compact and preserves the task's execution status. A blocked
confirmation, unavailable authority, or stale binding is returned as bounded
readback and is recorded as an attempted capability invocation; it does not
mutate task state. A successful bind emits the existing `task.work_view_bound`
event and does not prepare a browser, dispatch an action, create a task or
approval, call a provider, or transfer lease/page payloads.

## Governance

```text
normal capability policy, invocation ledger, and capability events
explicit operator confirmation required by the bind operation
session-manager remains the authoritative work-view owner
task-manager remains the sole task-binding mutation owner
stale identity fails closed; explicit rebind is required for replacement
task status and execution phase remain unchanged
no browser/work-view action dispatch or automatic recovery
no lease id, active URL, capture payload, credential, or provider egress
```

## Evidence

Runtime:

```text
services/openclaw-core/src/native-engineering-work-view-bind-operation.mjs
services/openclaw-core/src/native-engineering-work-view-bind-routes.mjs
services/openclaw-core/src/capability-runtime-work-view.mjs
services/openclaw-core/src/capability-runtime.mjs
services/openclaw-core/src/plan-builder.mjs
services/openclaw-core/src/capability-descriptors.mjs
```

Tests and real checks:

```text
services/openclaw-core/test/capability-runtime.test.mjs
services/openclaw-core/test/route-handlers.test.mjs
nix/scripts/dev-openclaw-native-engineering-context-packet-common-check.sh
openclaw-native-engineering-context-packet-pair-batch-reuse
```

The common capability tests cover missing confirmation, successful bind,
status preservation, stale binding rejection, task-manager mutation ownership,
and summary-level payload exclusion. The existing core/Observer context-packet
pair now invokes one real capability bind and keeps the dedicated route for
the following idempotent/stale-rebind evidence.

## Deferred

```text
automatic task binding or rebinding
automatic recovery after session/helper authority loss
browser action dispatch and work-view navigation from engineering bind
desktop-wide capture, root/system daemon ownership
provider egress, credential reads, ACPX/Codex live process execution
```

## Next Smallest Capability

Keep this binding bridge bounded. Select the next Level 2 capability only from
a demonstrated work-view/session-helper gap; do not add another bind variant,
readiness endpoint, or provider/action bridge without a concrete operator
workflow that it closes.
