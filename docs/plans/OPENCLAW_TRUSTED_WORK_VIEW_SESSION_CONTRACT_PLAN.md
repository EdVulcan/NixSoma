# OpenClaw Trusted Work-View Session Contract Plan

Updated: 2026-07-10

## Active Slice

Identity-upgrade bridge: trusted AI work-view session contract, session-manager
owned in-process helper lease, helper readiness recommendation, explicit
Observer recovery bridge, and operator action result evidence.

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
sessionIdentity.status: authoritative | local_fallback | divergent | pending_authority
sessionIdentity.authority: openclaw-session-manager
helperRuntime.registry: openclaw-trusted-work-view-helper-runtime-v0
helperRuntime.owner: openclaw-session-manager
helperRuntime.mode: in_process_session_helper
helperRuntime.status: inactive | awaiting_browser | active | degraded | divergent
helperRuntime.leaseMatched: true | false
```

Session-manager now owns a real user-space helper lease for every prepared AI
work-view session. It rotates the lease when a new session starts, heartbeats it
on work-view actions, sends the compact lease to browser-runtime during
`/browser/open`, and records whether browser-runtime observed the same session
and lease. The shared trust contract marks the helper runtime `active` only when
the authoritative session id, browser session id, lease id, and browser lease id
match.

This is an in-process Level 2 runtime owner, not the future external sidecar.
It starts no extra process and performs no installation, root action,
desktop-wide capture, host mutation, or provider egress. Divergence is visible
and degrades trust; it is not silently repaired.

The helper readiness portion makes the contract actionable without adding a new
execution path. A visible work view reports `ready` with no recovery action. A
prepared hidden work view recommends `/work-view/reveal`. A missing or degraded
browser-runtime-backed work view recommends `/work-view/prepare`. All recovery
recommendations remain user-space, Observer-visible, and root-free.

The contract now carries an explicit `sessionIdentity` block. Session-manager
is the authority for prepared/revealed work views and passes its session id into
browser-runtime when opening the AI-owned work view. Browser, screen, Phase 3,
and Observer readbacks report whether browser-runtime is matched, pending, or
divergent from that authority. This makes Level 2 work-view identity auditable
without introducing a sidecar process, daemon, root boundary, or desktop-wide
capture. Divergence degrades helper readiness and recommends the existing
`prepare_work_view` operator action; it does not automatically reset the
browser, start a sidecar, mutate the host, or call an arbitrary endpoint.

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

Observer also exposes the trusted sidecar lifecycle probe through the same
Controls surface:

```text
Run Sidecar Start Probe
```

The control resolves the latest sidecar lifecycle task through
`/phase-3/operator-interrupt-controls` and calls the existing
`/work-view/trusted-sidecar/lifecycle-tasks/:taskId/start-probe` route. It
intentionally accepts the pre-approval HTTP 409 response as a valid readback so
the operator can see `blocked_before_approval`; after manual approval it reads
`deferred_after_approval`. Both states preserve `processStarted: false`, no
root/system daemon requirement, no desktop-wide capture, no host mutation, and
no provider egress.

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
starting a helper process. Each probe is recorded on the existing lifecycle task
and consolidated into `/phase-3/operator-interrupt-controls`, so the Observer
Phase 3 controls panel can show the latest task, approval, probe status, and
non-execution flags without a new evidence endpoint.

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
GET /phase-3/operator-interrupt-controls
POST /work-view/trusted-sidecar/lifecycle-tasks
POST /work-view/trusted-sidecar/lifecycle-tasks/:taskId/start-probe
Observer work-view and screen panels
```

## Evidence

Runtime contract builder:

```text
packages/shared-utils/src/work-view-trust.mjs
packages/shared-utils/test/work-view-trust.test.mjs
services/openclaw-session-manager/src/trusted-work-view-helper-runtime.mjs
services/openclaw-session-manager/test/trusted-work-view-helper-runtime.test.mjs
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
desktop-wide GNOME/Wayland capture
external session helper process or sidecar installation
root/system daemon or polkit integration
nested compositor or graphics-stack-native workspace
host mutation and input execution beyond existing governed user-space paths
provider egress or credential access
automatic recovery execution; the contract recommends existing operator actions
unreviewed endpoint invocation from recommendation payloads
actual external trusted sidecar process start after approval
lease enforcement on browser input/click actions; the current slice binds and
observes the work-view open/capture session only
```

## Next Slice

The next high-density identity-upgrade slice should carry the matched helper
lease into the existing browser action mediation path:

```text
trusted helper lease -> screen-act/browser input and click mediation
```

It should reject mismatched session-manager leases for AI-owned browser actions,
reuse existing screen-act/browser routes and milestones, and preserve explicit
operator takeover. It should not add another readiness-only milestone. External
process start, installation, root/system daemon work, desktop-wide capture, and
provider egress remain deferred.
