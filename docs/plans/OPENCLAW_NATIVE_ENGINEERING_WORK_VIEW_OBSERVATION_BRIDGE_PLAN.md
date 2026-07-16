# OpenClaw Native Engineering Work-View Observation Bridge Plan

Updated: 2026-07-16

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
services/openclaw-core/src/native-engineering-work-view-semantic-action-handoff.mjs
services/openclaw-core/src/task-executor.mjs
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
services/openclaw-core/test/native-engineering-work-view-semantic-action-handoff.test.mjs
services/openclaw-core/test/task-executor.test.mjs
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
unreviewed automatic target selection or dispatch from observation metadata
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

## Semantic Click Handoff Complete

The existing browser semantic-action handoff now consumes this decision for one
operator-reviewed `browser.semantic_click`. Core materialises the target from
the existing screen observation, re-reads the existing session-manager state,
and requires the task binding, active lease, fresh readiness capture, current
inventory digest/frame, current target presence, and visual frame to be
self-consistent before calling the existing `screen-act` route. The
session-manager observation is a bounded readiness snapshot; Core does not
require that cached snapshot to equal a newer `screen/current` frame. The
sidecar remains the final runtime owner and performs its own immediate capture,
reference/lease revalidation, and post-action visual grounding checks.

Stale or cross-source-mismatched evidence returns a failed task with compact
`semanticActionHandoff` evidence and suppresses automatic task recovery, so no
second action is dispatched. The handoff exposes no page payload, selector,
input value, or target item. No new endpoint, capture route, action family, or
semantic typing path was added.

## Next Smallest Capability

The existing real task/Firefox validation lane now proves this handoff: current
semantic click, stale reference rejection, Core task evidence, post-frame
grounding, and Observer/capture contracts all pass. The bounded Level 2 browser
eye-hand route is closed for this slice. Select the next identity-level
capability from the forward directive, not another readiness-only chain.
