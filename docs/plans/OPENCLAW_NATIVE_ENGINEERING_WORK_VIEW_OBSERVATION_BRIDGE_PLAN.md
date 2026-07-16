# OpenClaw Native Engineering Work-View Observation Bridge Plan

Updated: 2026-07-14

## Active Slice

Bounded AI-owned work-view observation metadata in the existing native
Engineering Context Packet.

Identity alignment: Level 2, trusted session/work-view component.

## Demonstrated Gap

The context packet could report the selected task's work-view identity,
authority, lease match, and recovery action, but it could not tell a local
context consumer whether the AI-owned page observation was available and fresh.
That made a bound task look equally actionable when its capture source was
ready, stale, or recovering.

## Implemented Behavior

The existing explicit packet request may add:

```json
{ "includeWorkView": true, "includeWorkViewObservation": true }
```

The existing work-view association now returns a compact observation summary:

```text
openclaw-native-engineering-work-view-observation-v0
capture status and freshness
capture sequence and bounded age
visual-frame availability, digest, dimensions, byte length, and scope
semantic-target availability, count, digest, and frame reference
negative input/selector/item/payload exposure flags
```

Observer renders capture status/freshness and semantic-target count in the
existing Engineering Context Packet panel. The same summary is protected in
the existing local packet message so a later local context consumer can decide
whether the work view is observable before an explicitly governed action.

## Governance

```text
explicit packet request only
read-only session-manager state
no new endpoint or task type
no pixel/data URL or page URL transfer
no visible page text or semantic target item transfer
no input value or selector exposure
no task/work-view mutation
no action dispatch or automatic recovery
no provider call or external network egress
```

Frame digests and bounded dimensions are provenance only. The existing
session-manager sidecar remains responsible for loopback capture freshness and
the existing browser/lease contracts remain the authority for actions.

## Evidence

Runtime:

```text
services/openclaw-core/src/native-engineering-work-view-association.mjs
services/openclaw-core/src/native-engineering-work-view-action-decision.mjs
services/openclaw-core/src/native-engineering-context-routes.mjs
services/openclaw-core/src/native-engineering-context-packet.mjs
```

Observer:

```text
apps/observer-ui/src/observer-panels-engineering-context.mjs
apps/observer-ui/src/client-script-config-dom-engineering-context.mjs
apps/observer-ui/src/client-script-renderers-engineering-context.mjs
apps/observer-ui/src/client-script-refreshers-engineering-context.mjs
```

Validation:

```text
services/openclaw-core/test/native-engineering-work-view-association.test.mjs
services/openclaw-core/test/native-engineering-work-view-action-decision.test.mjs
services/openclaw-core/test/native-engineering-context-packet.test.mjs
services/openclaw-core/test/native-engineering-context-routes.test.mjs
apps/observer-ui/test/client-script-engineering-context.test.mjs
nix/scripts/dev-openclaw-native-engineering-context-packet-common-check.sh
openclaw-native-engineering-context-packet-pair-batch-reuse
```

## Deferred

```text
raw visual frame or data URL in engineering context
page URL, page text, or semantic target item transfer
automatic action selection or dispatch from observation metadata
long-lived LSP pools and ACPX/Codex live process execution
provider egress, credentials, root/system daemon work, and desktop-wide capture
```

## Readiness Decision Follow-Up Complete

The existing work-view association now derives
`openclaw-native-engineering-work-view-action-decision-v0`. It reports whether
the operator may enter bounded semantic target selection using only task
binding, authority, capture freshness, visual-frame provenance, and semantic
inventory/frame consistency. The decision never selects a target or dispatches
an action, and it exposes no target items, selectors, URLs, pixels, lease
values, or input data.

## Next Smallest Capability

Use this decision at the existing browser semantic-action handoff for one
operator-approved semantic click. The runtime owner must revalidate the
frame-scoped target reference and visual grounding immediately before dispatch;
do not add a second capture route or use the decision for automatic action
dispatch.
