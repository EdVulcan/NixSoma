# OpenClaw Native Engineering Work-View Association Plan

Updated: 2026-07-14

## Active Slice

Compact trusted work-view association in the existing local engineering
context packet.

Identity alignment: Level 2, trusted session/work-view component.

## Demonstrated Gap

Native engineering tasks and the trusted AI work-view already had separate
operator readbacks. A task could be selected in the Engineering Loop panel,
while session-manager separately reported the authoritative work-view,
helper authority, and browser lease alignment. There was no bounded readback
that told the operator or a local context consumer whether the selected task
was unbound, stale, authority-blocked, or bound to the current work view.

## Implemented Behavior

The existing explicit `Build Context Packet` action may request:

```text
includeWorkView: true
```

Core then reads the existing session-manager `/work-view/state` owner and
adds a compact association through:

```text
registry: openclaw-native-engineering-work-view-association-v0
mode: compact_trusted_work_view_task_association
```

The readback contains only task status, work-view status and id, session
presence/status, helper authority state, lease-match boolean, recovery action,
and a derived binding status. It distinguishes at least:

```text
work_view_observed
task_unbound
stale_session_binding
stale_work_view_binding
authority_not_ready
bound
work_view_state_unavailable
```

The association is also represented as a protected summary message in the
packet so a later local context consumer can reason about the boundary without
receiving a lease, active URL, capture payload, or arbitrary endpoint value.
Observer renders the work-view id, binding status, and action-authority state
alongside the existing packet summary.

Task work-view attachment now retains the owner-provided `workViewId` beside
the existing session binding, allowing the readback to detect a stale view
rather than treating a session-only attachment as fully bound.

## Governance

```text
explicit packet request only
read-only session-manager service read
no task/work-view mutation
no action dispatch or automatic bind
no lease id or active URL exposure
no capture payload or browser content exposure
no task or approval creation
no provider call or external network egress
```

If session-manager is unavailable, packet assembly remains available and
returns `work_view_state_unavailable` rather than inventing authority.

## Evidence

Implementation:

```text
services/openclaw-core/src/native-engineering-work-view-association.mjs
services/openclaw-core/src/native-engineering-context-packet.mjs
services/openclaw-core/src/native-engineering-context-routes.mjs
services/openclaw-core/src/task-manager.mjs
```

Tests and milestone:

```text
services/openclaw-core/test/native-engineering-work-view-association.test.mjs
services/openclaw-core/test/native-engineering-context-packet.test.mjs
services/openclaw-core/test/native-engineering-context-routes.test.mjs
nix/scripts/dev-openclaw-native-engineering-context-packet-common-check.sh
observer-openclaw-native-engineering-context-packet
```

## Deferred

```text
automatic task binding or action replay
new browser action variants
lease value transfer to engineering tasks or providers
desktop-wide capture
root/system daemon ownership
provider egress or ACPX/Codex live process execution
```

## Next Smallest Capability

Use the resulting Observer state to determine whether an explicit
operator-reviewed bind action is needed for a real task workflow. Any future
bind must re-read the authoritative session-manager state, reject stale task
or session identity, and remain separate from action execution and automatic
recovery.
