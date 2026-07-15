# OpenClaw Native Engineering Capability Runtime Work-View Control Plan

Updated: 2026-07-15

## Active Slice

Expose the existing allowlisted trusted work-view prepare, reveal, and hide
owner actions through the common `POST /capabilities/invoke` runtime.

Identity alignment: Level 2, trusted session/work-view component.

## Demonstrated Gap

The capability registry already described `act.work_view.control`, and the
Observer recovery path already used the session-manager owner routes, but the
common capability runtime had no dispatch for that descriptor. A capability
caller therefore could read the new observation sensor through the governed
policy/ledger/event path but could not carry an explicit decision to the
existing work-view owner through that same path.

## Implemented Behavior

The runtime now accepts one canonical allowlisted operation:

```text
work_view.prepare
work_view.reveal
work_view.hide
```

The canonical operation is also the policy intent and invocation-ledger intent,
so an approval/audit record cannot describe one work-view action while the
owner executes another.

It maps those operations only to the existing session-manager routes:

```text
POST /work-view/prepare
POST /work-view/reveal
POST /work-view/hide
```

The request builder keeps the action source and recommended action fixed to the
runtime contract, bounds display targets and HTTP(S) entry URLs, rejects URL
credentials, and never forwards an arbitrary route or caller-supplied action
metadata. The response projects only work-view status, visibility, mode,
helper/browser status, and recovery action. Session ids, leases, URLs, browser
responses, capture payloads, and page content stay out of the result and
invocation summary.

## Governance

```text
normal capability policy decision, invocation ledger, and capability events
explicit operation allowlist required
session-manager remains the only work-view state/action owner
work-view state mutation is explicit and is never automatic from observation
prepare/reveal retain the existing browser navigation behavior
provider egress and credential access remain disabled
no task creation, approval creation, arbitrary endpoint route, or ACPX process
```

Browser navigation is deliberately reported as an existing owner behavior for
prepare/reveal. It is distinct from provider egress and is still subject to the
existing HTTP(S) browser/work-view route validation.

## Evidence

Runtime and tests:

```text
services/openclaw-core/src/capability-runtime-work-view.mjs
services/openclaw-core/src/capability-runtime.mjs
services/openclaw-core/test/capability-runtime.test.mjs
```

Real core and Observer checks reuse the existing capability-invoke service pair:

```text
nix/scripts/dev-capability-invoke-check.sh
nix/scripts/dev-observer-capability-invoke-check.sh
```

They prepare the existing bounded work view, invoke a reveal through the common
runtime, and assert the fixed owner action plus compact payload-free readback.

## Deferred

```text
automatic recovery from an observation result
automatic task binding or rebinding
browser action families beyond the existing work-view controls
raw visual frames, page text, semantic target items, selectors, or input values
provider egress, credential reads, root/system daemon work, and desktop capture
```

## Next Smallest Capability

The observation-to-owner handoff is now available for an explicit caller. Use
it only where an existing operator decision needs the work-view control; do not
add another browser action variant or make observation trigger actions
automatically.
