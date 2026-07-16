# OpenClaw Native Engineering Capability Runtime Screen Action Plan

Updated: 2026-07-16

## Active Slice

Close the declared/runtime gap for the existing `act.screen.pointer_keyboard`
capability by exposing one explicit `keyboard.type` action through the common
`POST /capabilities/invoke` policy, invocation, and event path.

Identity alignment: Level 2, trusted session/work-view component.

## Demonstrated Gap

The capability registry and browser task contract already declared the
screen-act pointer/keyboard owner, and Observer already offered a Simulate Type
control. That control bypassed the common capability audit path and called
screen-act directly.

## Implemented Behavior

The common runtime now accepts only:

```text
capabilityId: act.screen.pointer_keyboard
operation: keyboard.type
params.text: bounded string up to 2000 characters
```

It sends only the transient text to the existing
`openclaw-screen-act /act/keyboard/type` owner. Screen-act remains responsible
for fresh screen context, trusted lease validation, sidecar mediation, browser
runtime dispatch, and write-only input redaction.

The result and persisted invocation summary retain only operation, acceptance,
mediation status, lease match, and bounded grounding state. They do not retain
the input value, selectors, page content, visual bytes, or browser payload.

Observer's existing Simulate Type control now uses this capability path, so the
visible operator workflow and API caller share the same policy and audit chain.

## Governance

```text
existing screen-act remains the sole action owner
fresh screen context and trusted lease remain required by that owner
operation and policy intent are bound to keyboard.type
input is write-only and is not persisted in common invocation evidence
semantic targets, selectors, page scripts, hotkeys, and pointer coordinates are rejected
no task or approval is created by this bridge
no automatic dispatch is triggered by observation or recommendation
provider egress and external provider contact remain disabled
```

## Evidence

Focused unit and runtime tests cover operation binding, input bounds, rejection
of semantic-target parameters, screen-act delegation, compact result
projection, owner contract matching, and negative input-payload checks. The
existing Core and Observer capability-invoke milestones execute the bridge and
verify that transient input is absent from invocation evidence.

## Deferred

`mouse.click`, `keyboard.hotkey`, semantic click/type common invocation,
arbitrary selectors, page scripts, automatic actions, provider egress, root or
system daemon work, and desktop-wide capture remain on their existing governed
paths or explicitly deferred.

## Next Smallest Capability

Select the next common runtime action only from a demonstrated operator gap;
do not turn this explicit input bridge into a generic pointer/keyboard proxy.
