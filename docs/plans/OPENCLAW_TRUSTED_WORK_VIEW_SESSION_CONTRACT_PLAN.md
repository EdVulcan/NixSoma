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
sidecarContract.status: drafted_not_started
sidecarContract.lifecycleProposal.status: proposal_ready
sidecarContract.approvalTaskDraft.status: draft_ready
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

The contract also carries a future Level 2 sidecar draft. It names the helper's
capture/action/recovery/Observer responsibilities and explicitly records that no
process is started, no installation is required, and no root/system daemon is
used in this slice. The lifecycle proposal records the future approval gate and
keeps execution deferred. The approval task materialization creates an explicit
task and pending approval while keeping process start disabled.

The materialized lifecycle task now exposes a bounded start-probe readback on
the same route group:

```text
POST /work-view/trusted-sidecar/lifecycle-tasks/:taskId/start-probe
```

Before approval the probe returns `blocked_before_approval` with HTTP 409 and
records that no process was started, no root/system daemon is required, no
desktop-wide capture is used, no host mutation occurs, and no provider egress is
performed. After the operator approves the lifecycle task, the same probe
returns `deferred_after_approval` while preserving the same non-execution flags.
This proves the approval bridge and deferred execution boundary without
starting a helper process.

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

When an Observer work-view action runs while a task is selected, the existing
task phase update now carries a compact recovery attachment:

```text
details.workViewRecoveryAction
details.trustedSession.identityLevel
details.trustedSession.helperReadiness
details.trustedSession.recoveryRecommendation
details.trustedSession.sidecarContract.status
details.trustedSession.sidecarContract.lifecycleProposal.status
details.trustedSession.sidecarContract.approvalTaskDraft.status
```

This keeps task/workbench continuity tied to the same `/tasks/:id/phase` path
instead of adding a separate recovery-result route.

The contract is emitted through:

```text
GET /work-view/state
GET /session/state
GET /browser/capture
GET /screen/current
GET /phase-3/background-work-view
POST /work-view/trusted-sidecar/lifecycle-tasks
POST /work-view/trusted-sidecar/lifecycle-tasks/:taskId/start-probe
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
openclaw-phase-3-operator-interrupt-controls
observer-openclaw-phase-3-operator-interrupt-controls
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
actual trusted sidecar process start after approval
```

## Next Slice

The next high-density identity-upgrade slice should continue toward Level 2
session-helper preparation while keeping sidecar start disabled until a governed
runtime owner is selected:

```text
AI work-view trusted sidecar Observer recovery/readback consolidation
```

It should reuse existing `/work-view/state`, task phase attachments, and Phase 3
Observer panels to show the latest lifecycle task, approval status, start-probe
readback, and recovery recommendation in one operator-visible place. It should
not add another readiness-only milestone. Actual process start, installation,
root/system daemon work, and desktop-wide capture remain deferred.
