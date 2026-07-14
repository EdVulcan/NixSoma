# OpenClaw Native Engineering Work-View Bind Plan

Updated: 2026-07-14

## Active Slice

Explicit operator-reviewed binding of one existing native engineering task to
the current trusted AI work view.

Identity alignment: Level 2, trusted session/work-view component.

## Demonstrated Gap

The context packet association could classify a task as unbound, stale, or
authority-blocked, but there was no operator action that could close the
unbound state. The existing `/tasks/:id/attach-work-view` route is an executor
attachment path: it accepts caller-provided work-view metadata and changes the
task to `running`. It is not appropriate for binding a completed or queued
engineering task for context use.

## Implemented Behavior

Observer exposes a `Bind Task to Work View` control beside the existing packet
action. It calls:

```text
POST /plugins/native-adapter/engineering-context/work-view/bind
registry: openclaw-native-engineering-work-view-bind-v0
```

The route requires `confirm: true`, reads the current
session-manager `/work-view/state`, and accepts a bind only when:

```text
session is running
session identity is authoritative
helper action authority is active
helper lease match is true
the task has no conflicting session or work-view binding
```

The task receives the authoritative session/work-view metadata and a compact
operator-reviewed binding record. Its existing status is preserved, no browser
or work-view action is dispatched, and repeated binding to the same current
identity is idempotent. A stale session or work-view binding is rejected rather
than silently replaced. The mutation emits the existing event stream through
`task.work_view_bound` without pretending the execution phase changed.

## Governance

```text
explicit operator confirmation required
authoritative session-manager state is re-read immediately before mutation
task metadata mutation only
task status and execution are unchanged
no automatic bind, recovery, or action replay
no lease id, active URL, capture payload, or credential value in bind readback
no task or approval creation
no provider call or external network egress
```

## Evidence

Implementation:

```text
services/openclaw-core/src/native-engineering-work-view-binding.mjs
services/openclaw-core/src/native-engineering-work-view-bind-routes.mjs
services/openclaw-core/src/task-manager.mjs
services/openclaw-core/src/route-handlers.mjs
apps/observer-ui/src/observer-panels-engineering-context.mjs
apps/observer-ui/src/client-script-refreshers-engineering-context.mjs
```

Tests and milestone:

```text
services/openclaw-core/test/native-engineering-work-view-binding.test.mjs
services/openclaw-core/test/route-handlers.test.mjs
nix/scripts/dev-openclaw-native-engineering-context-packet-common-check.sh
openclaw-native-engineering-context-packet
observer-openclaw-native-engineering-context-packet
```

The existing context-packet core/Observer pair now prepares a real local
work-view, binds a completed fixture task, verifies the compact bind readback,
and confirms that task execution was not started.

## Deferred

```text
automatic task binding
automatic rebinding after session restart or authority loss
browser action dispatch and work-view navigation
lease value transfer to engineering tasks or providers
desktop-wide capture
root/system daemon ownership
provider egress or ACPX/Codex live process execution
```

## Next Smallest Capability

Use the bound task in a real operator context workflow only if the Observer
readback shows a concrete missing association or recovery decision. Do not add
another bind variant or a readiness-only endpoint; authority loss must continue
through the existing fail-closed recovery paths.
