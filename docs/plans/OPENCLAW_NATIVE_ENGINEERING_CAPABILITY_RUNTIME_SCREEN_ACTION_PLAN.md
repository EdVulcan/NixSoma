# OpenClaw Native Engineering Capability Runtime Screen Action Plan

Updated: 2026-07-16

## Active Slice

Close the declared/runtime gap for the existing `act.screen.pointer_keyboard`
capability by exposing two explicit screen actions through the common
`POST /capabilities/invoke` policy, invocation, and event path.

Identity alignment: Level 2, trusted session/work-view component.

## Demonstrated Gap

The capability registry and browser task contract already declared the
screen-act pointer/keyboard owner, and Observer already offered Simulate Type
and Simulate Click controls. Those controls bypassed the common capability audit
path and called screen-act directly.

## Implemented Behavior

The common runtime now accepts only these two explicit operations:

```text
capabilityId: act.screen.pointer_keyboard
operation: keyboard.type
params.text: bounded string up to 2000 characters

capabilityId: act.screen.pointer_keyboard
operation: mouse.click
params.x: integer from 0 through 959
params.y: integer from 0 through 539
params.button: left only
```

It sends only the bounded operation payload to the existing screen-act owner.
Screen-act remains responsible for fresh screen context, trusted lease
validation, sidecar mediation, browser runtime dispatch, and write-only input
redaction.

The result and persisted invocation summary retain only operation, acceptance,
mediation status, lease match, and bounded grounding state. They do not retain
the input value, click coordinates, selectors, page content, visual bytes, or
browser payload.

Observer's existing Simulate Type and Simulate Click controls now use this
capability path, so the visible operator workflow and API caller share the same
policy and audit chain.

## Governance

```text
existing screen-act remains the sole action owner
fresh screen context and trusted lease remain required by that owner
operation and policy intent are bound to keyboard.type or mouse.click
input is write-only and is not persisted in common invocation evidence
click coordinates are bounded and only the left button is accepted
semantic targets, selectors, page scripts, and hotkeys are rejected
no task or approval is created by this bridge
no automatic dispatch is triggered by observation or recommendation
provider egress and external provider contact remain disabled
```

## Evidence

Focused unit and runtime tests cover operation binding, input and coordinate
bounds, rejection of semantic-target parameters, screen-act delegation, compact
result projection, owner contract matching, and negative payload checks. The
existing Core and Observer capability-invoke milestones execute both bridges
and verify that transient input and click coordinates are absent from
invocation evidence.

## Deferred

`keyboard.hotkey`, semantic click/type common invocation, arbitrary selectors,
page scripts, automatic actions, provider egress, root or system daemon work,
and desktop-wide capture remain on their existing governed paths or explicitly
deferred.

## Next Smallest Capability

Select the next common runtime action only from a demonstrated operator gap;
do not turn this explicit input bridge into a generic pointer/keyboard proxy.
