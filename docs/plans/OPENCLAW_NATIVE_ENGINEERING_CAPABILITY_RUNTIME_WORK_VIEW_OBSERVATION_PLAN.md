# OpenClaw Native Engineering Capability Runtime Work-View Observation Plan

Updated: 2026-07-15

## Active Slice

Expose the existing bounded trusted work-view observation projection through
the common `POST /capabilities/invoke` runtime.

Identity alignment: Level 2, trusted session/work-view component.

## Demonstrated Gap

The Engineering Context Packet already read the session-manager-owned trusted
work view when explicitly requested, but the common capability registry had no
Level 2 sensor for that state. A local capability consumer therefore had to
bypass the normal capability policy, invocation ledger, and capability event
path to inspect whether a bound work view was authoritative and observable.

## Implemented Behavior

The registry now exposes:

```text
sense.openclaw.engineering_context.work_view_observation
```

The capability reads the existing session-manager `/work-view/state` contract
and reuses `buildNativeEngineeringWorkViewAssociation` with observation
enabled. It returns only compact task binding, authority, recovery, capture
freshness, frame provenance, and semantic-target count metadata.

The capability does not create a second capture implementation or action
route. The existing session-manager, browser-runtime, sidecar, and context
packet owners remain authoritative.

## Governance

```text
audit-only local capability
existing policy decision is recorded before dispatch
existing capability invocation ledger and events are used
session-manager is the only state owner read
conflicting envelope and parameter task ids are rejected before policy dispatch
no task or work-view mutation
no action dispatch, task creation, or approval creation
no lease id, active URL, pixel/data URL, target item, selector, or input value
no provider call, credential access, or external network egress
```

## Evidence

Runtime:

```text
services/openclaw-core/src/capability-descriptors.mjs
services/openclaw-core/src/capability-runtime-work-view.mjs
services/openclaw-core/src/capability-runtime.mjs
```

Focused and real checks:

```text
services/openclaw-core/test/capability-runtime.test.mjs
capability-invoke
observer-capability-invoke
```

The real capability checks prepare the existing bounded work view, invoke the
sensor through `/capabilities/invoke`, and assert that response and persisted
invocation summaries contain no trusted-session or page payload values.

## Deferred

```text
automatic work-view preparation or recovery
automatic task binding or rebinding
browser or screen action dispatch
raw visual frames, page text, semantic target items, selectors, and input values
provider egress, credential access, root/system daemon work, and desktop capture
```

## Next Smallest Capability

The observation-to-owner handoff is now documented in
`OPENCLAW_NATIVE_ENGINEERING_CAPABILITY_RUNTIME_WORK_VIEW_CONTROL_PLAN.md`.
Use that existing allowlisted control only for an explicit operator decision;
do not add a second capture route, another browser action variant, or automatic
recovery from observation metadata.
