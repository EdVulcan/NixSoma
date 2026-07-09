# OpenClaw Trusted Work-View Session Contract Plan

Updated: 2026-07-10

## Active Slice

Identity-upgrade bridge: trusted AI work-view session contract, helper
readiness recommendation, explicit Observer recovery bridge, and operator action
result evidence.

This slice moves OpenClaw from a plain Level 1 user-space work-view readback
toward Level 2 trusted session/work-view behavior by making the AI-owned work
view boundary explicit in the existing session, browser, screen-sense, core, and
Observer state flow.

It does not create a root daemon, a desktop-wide capture path, a nested
compositor, a live provider path, or a new readiness-only phase.

## Real Capability

The existing work-view routes now carry a shared `trustedSession` contract:

```text
kind: openclaw-trusted-session-work-view-contract
identityLevel: level_2_trusted_session_work_view
boundary.workViewScope: ai_owned_work_view_only
operatorGates.reveal: explicit_operator_action
boundary.rootRequired: false
boundary.desktopWideCapture: false
boundary.hostMutation: false
helperReadiness.state: ready | prepared_hidden | needs_prepare | degraded
recoveryRecommendation.action: none | prepare_work_view | reveal_work_view
```

The helper readiness portion makes the contract actionable without adding a new
execution path. A visible work view reports `ready` with no recovery action. A
prepared hidden work view recommends `/work-view/reveal`. A missing or degraded
browser-runtime-backed work view recommends `/work-view/prepare`. All recovery
recommendations remain user-space, Observer-visible, and root-free.

Observer now exposes a single explicit recovery bridge:

```text
Run Recommended Work View Action
```

The bridge reads `trustedSession.recoveryRecommendation` from `/work-view/state`
and maps only whitelisted actions to existing user-space endpoints:

```text
prepare_work_view -> POST /work-view/prepare
reveal_work_view -> POST /work-view/reveal
hide_work_view -> POST /work-view/hide
none -> no mutation
```

It does not call arbitrary endpoints returned by the service contract.

Every work-view prepare/reveal/hide call now records `lastOperatorAction` in the
existing work-view state. The record includes:

```text
action
source
recommendedAction
endpoint
previous status/visibility/mode/helper/browser/URL
next status/visibility/mode/helper/browser/URL
rootRequired: false
hostMutation: false
operatorVisible: true
```

This makes recovery action results visible through `/work-view/state` and
`/phase-3/background-work-view` without adding another evidence endpoint.

The contract is emitted through:

```text
GET /work-view/state
GET /session/state
GET /browser/capture
GET /screen/current
GET /phase-3/background-work-view
Observer work-view and screen panels
```

## Evidence

Runtime contract builder:

```text
packages/shared-utils/src/work-view-trust.mjs
packages/shared-utils/test/work-view-trust.test.mjs
```

Service propagation:

```text
services/openclaw-session-manager/src/server.mjs
services/openclaw-browser-runtime/src/server.mjs
services/openclaw-screen-sense/src/server.mjs
services/openclaw-core/src/phase3-work-view-builders.mjs
```

Observer visibility:

```text
apps/observer-ui/src/client-script-refreshers-runtime.mjs
apps/observer-ui/src/client-script-refreshers-mvp-phases.mjs
apps/observer-ui/src/client-script-runtime-actions.mjs
apps/observer-ui/src/client-script-runtime-bindings.mjs
apps/observer-ui/src/observer-panels-operations.mjs
services/openclaw-session-manager/src/server.mjs
```

Targeted milestone coverage:

```text
openclaw-ai-work-view-capture
observer-openclaw-ai-work-view-capture
openclaw-ai-work-view-capture-summary
observer-openclaw-ai-work-view-capture-summary
openclaw-phase-3-background-work-view
observer-openclaw-phase-3-background-work-view
```

## Deferred

The following remain intentionally deferred:

```text
single authoritative session identity across session-manager and browser-runtime
desktop-wide GNOME/Wayland capture
session helper process or sidecar installation
root/system daemon or polkit integration
nested compositor or graphics-stack-native workspace
host mutation and input execution beyond existing governed user-space paths
provider egress or credential access
automatic recovery execution; the contract recommends existing operator actions
unreviewed endpoint invocation from recommendation payloads
```

## Next Slice

The next high-density identity-upgrade slice should make the work-view recovery
result useful for task/workbench continuity without expanding into a new
readiness chain:

```text
AI work-view recovery result attachment to task/workbench state
```

That should reuse the existing task attachment or operator state paths. The
useful increment is connecting a visible work-view recovery result to the task
or workbench that needed it, not creating another standalone status route.
