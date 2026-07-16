# OpenClaw Native Engineering Capability Runtime Browser Action Plan

Updated: 2026-07-16

## Active Slice

Close the declared/runtime gap for the existing `act.browser.open` capability
by exposing one explicit `browser.new_tab` action through the common
`POST /capabilities/invoke` policy, invocation, and event path.

Identity alignment: Level 2, trusted session/work-view component.

## Demonstrated Gap

The capability registry and rule planner already described `act.browser.open`,
and Observer already offered an Open New Tab control, but the common runtime
had no handler for that descriptor. A caller therefore had to bypass the
common capability audit path and call screen-act directly.

## Implemented Behavior

The common runtime now accepts only:

```text
capabilityId: act.browser.open
operation: browser.new_tab
params.url: bounded HTTP(S) URL without credentials
```

It sends only the normalized URL to the existing
`openclaw-screen-act /act/browser/new-tab` owner. Screen-act remains
responsible for fresh screen context, trusted lease validation, sidecar
mediation, browser-runtime dispatch, and visual grounding.

The result and persisted invocation summary retain only operation, acceptance,
mediation status, lease match, transport, and bounded grounding state. They do
not retain the URL, page content, visual bytes, selectors, or browser payload.

Observer's existing Open New Tab control now uses this capability path, so the
visible operator workflow and API caller share the same policy and audit chain.

## Governance

```text
existing screen-act remains the sole action owner
fresh screen context and trusted lease remain required by that owner
operation and policy intent are bound to browser.new_tab
URL is limited to HTTP(S) without credentials
no selector, page script, desktop capture, or input value is accepted
no task or approval is created by this bridge
browser network navigation remains explicit and is not provider egress
no automatic dispatch is triggered by observation or recommendation
```

## Evidence

Focused unit and runtime tests cover operation binding, URL validation,
screen-act delegation, compact result projection, and negative payload checks.
The existing Core and Observer capability-invoke milestones execute the bridge
after an explicit work-view prepare/reveal and verify the audited operation,
trusted owner result, and absence of navigation URL from invocation evidence.

## Deferred

Pointer/keyboard capability invocation beyond the explicit `keyboard.type` and
bounded left-click bridges remains on the existing task/screen-act paths until
a separate operator workflow justifies another common runtime bridge. Semantic
target selection, arbitrary selectors, page scripts, automatic actions, provider
egress, root/system daemon work, and desktop-wide capture remain unchanged and
deferred.

## Next Smallest Capability

Select the next common runtime action only from a demonstrated operator gap;
do not turn this single browser navigation bridge into a generic action proxy.
