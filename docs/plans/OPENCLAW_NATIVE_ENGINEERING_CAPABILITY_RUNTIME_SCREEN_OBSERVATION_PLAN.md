# OpenClaw Native Capability Runtime Screen Observation Plan

Updated: 2026-07-16

## Active Slice

Expose the existing `openclaw-screen-sense` owner through the common
`POST /capabilities/invoke` path as `sense.screen.observe`.

Identity alignment: Level 2, trusted session/work-view component.

## Demonstrated Gap

`sense.screen.observe` was already present in the capability registry and in
capability-aware browser plans, but its descriptor pointed to the removed
`/screen/state` path and the common runtime had no screen-sense backend. A
caller could therefore plan a screen observation without being able to invoke
the declared capability through the normal policy, invocation, and event path.

## Implemented Behavior

The runtime calls the existing screen-sense `/screen/current` owner and
projects a bounded structural observation:

```text
readiness and allowlisted capture metadata
focused-window/window-count presence metadata
OCR block count without OCR text
visual-frame availability and dimensions without bytes
semantic-target count without target items
trusted work-view status, visibility, and tab-count metadata
```

The response is transient. The invocation ledger and capability events retain
only the compact result summary. The descriptor now points to the real
`/screen/current` owner route.

## Governance

```text
local body-internal audit-only capability
normal capability policy evaluation is recorded before dispatch
existing screen-sense remains the only screen-state owner
no screen mutation, task creation, approval creation, or action dispatch
no focused-window titles, window titles, OCR text, snapshot text, or active URL
no session id, lease id, visual-frame bytes, semantic-target items, or selectors
no provider call, credential access, or external network egress
explicit raw-payload request flags fail closed before owner dispatch
```

## Evidence

Runtime:

```text
services/openclaw-core/src/capability-runtime-screen.mjs
services/openclaw-core/src/capability-runtime.mjs
services/openclaw-core/src/capability-descriptors.mjs
```

Focused and common-runtime tests:

```text
services/openclaw-core/test/capability-runtime-screen.test.mjs
services/openclaw-core/test/capability-runtime.test.mjs
```

Real Core and Observer evidence reuses:

```text
nix/scripts/dev-capability-invoke-check.sh
nix/scripts/dev-observer-capability-invoke-check.sh
```

## Observer Operation

The existing Observer Body Capabilities panel now exposes an explicit
`Invoke Screen Observation` control. It reuses the common capability
invocation readback and sends only the fixed `sense.screen.observe` request;
the control does not add a second screen route or expose raw screen payloads.
The real Observer check asserts the HTML control, client request mapping,
event binding, and bounded service response together.

## Deferred

```text
raw visual-frame bytes, screenshot data, page text, OCR text, and target items
desktop-wide capture or compositor integration
screen mutation, browser action dispatch, and automatic recovery
provider egress, credential access, root/system daemon work
```

## Next Route

Carry this bounded observation into the existing trusted work-view/action
mediation only when a concrete operator action requires it. Do not add another
screen endpoint, selector surface, or readiness wrapper.
