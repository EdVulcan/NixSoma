# OpenClaw Trusted Work-View Session Contract Plan

Updated: 2026-07-11

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

The matched lease now mediates real AI-owned browser input and click actions:

```text
screen-sense trusted state
-> screen-act derives the bounded current lease
-> browser-runtime compares it with its authoritative session lease
-> mutate browser input/click state only when the lease matches
```

The existing screen-act result carries
`openclaw-trusted-work-view-action-mediation-v0` with required, accepted,
status, session, lease, and match evidence. A session-manager-owned browser
returns HTTP 409 before mutation when an action omits or mismatches the lease.
Browser-local fallback remains compatible when no session-manager authority is
present.

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
`running_after_approval` with bounded PID and heartbeat evidence.

The contract carries the Level 2 sidecar lifecycle and keeps process start or
reconnect disabled until an explicit task approval. It names the helper's future
capture/action/recovery responsibilities. The current runtime uses a bounded
current-user Unix socket for heartbeat, capture, and action transport. No
installation or root/system daemon is used.

The materialized lifecycle task exposes the approved bounded start action on the
same route group:

```text
POST /work-view/trusted-sidecar/lifecycle-tasks/:taskId/start-probe
```

Before approval the probe returns `blocked_before_approval` with HTTP 409 and
records that no process was started, no root/system daemon is required, no
desktop-wide capture is used, no host mutation occurs, and no provider egress is
performed. After the operator approves the lifecycle task, the same action
starts one detached user-session process and returns `running_after_approval`
with its PID and socket heartbeat. Its sanitized environment contains only the
socket path, non-secret lifecycle task/approval ids, and bounded timing values;
it contains no lease, session, credential, or provider material. The process
uses only the allowlisted loopback browser-runtime origin after authority bind,
requires no installation or root authority, and exits through the task-scoped
`/stop` action. Start, reconnect, and stop are recorded on the existing
lifecycle task and consolidated into `/phase-3/operator-interrupt-controls`.

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
POST /work-view/trusted-sidecar/lifecycle-tasks/:taskId/stop
Observer work-view and screen panels
```

## Operator Takeover Action Authority

The trusted helper lease now carries an explicit `actionAuthority` state. The
existing operator controls close the user-sovereignty loop without adding a new
public readiness route:

```text
POST /control/takeover
-> session-manager suspends the current helper action authority
-> browser-runtime stores the suspended lease
-> screen-act blocks before browser mutation
-> browser-runtime rejects even a directly submitted matching old lease

POST /control/resume
-> session-manager issues a new lease id
-> browser-runtime explicitly rebinds the new lease
-> the paused task returns to queued only after rebind succeeds
-> browser input/click can continue with the new lease
```

The internal user-space propagation routes are
`/work-view/helper-authority/suspend`,
`/work-view/helper-authority/resume`, and
`/browser/trusted-helper-lease`. They do not start an external process, mutate
the host, capture the desktop, read credentials, or perform provider egress.
The existing Phase 3 controls readback and Observer panel expose runtime status,
action authority, suspension state, and current lease id.

## User-Space Sidecar Pilot

The approved lifecycle task now owns a real bounded process:

```text
core lifecycle task + approved approval id
-> session-manager lifecycle supervisor
-> minimal detached user-session Node process with a mode-0600 Unix socket
-> ready/heartbeat messages update the authoritative helper lease
-> work-view state and Observer show PID, supervisor status, and heartbeat count
-> authority disconnect clears binding/capture but leaves the process fail-closed
-> explicit task-scoped stop terminates the process and records stopped readback
```

The supervisor does not inherit the parent credential environment. The process
has no general filesystem, provider, desktop-capture, or host-mutation
implementation; its only network scope is the allowlisted loopback browser
runtime. Authority disconnect clears binding and capture immediately, and a
bounded reconnect timeout prevents an indefinite unattached process.

## Fail-Closed Liveness And Recovery

The supervisor now owns a heartbeat deadline as well as process exit handling.
Unexpected exit or heartbeat timeout records `lastSidecarFailure`, suspends the
authoritative helper action lease, synchronizes the suspended lease into
browser-runtime, and exposes `restart_approved_trusted_sidecar` through the
trusted-session recovery recommendation. Matching stale leases are rejected by
browser-runtime while the sidecar is unavailable.

There is no automatic restart or reconnect. Reusing the existing approved
lifecycle start action reconnects a surviving user-session process, or launches
a replacement after process failure, rotates and rebinds the helper lease, and
only then restores browser action authority. Explicit stop also suspends action
authority, so stopping the heartbeat process cannot leave AI actions enabled.

## Sidecar-Owned Bounded Capture

On approved start, the sidecar itself reads `/browser/capture` from an
allowlisted loopback-only browser-runtime origin. It projects the response to
session id, bounded title/URL, tab count, visible-text block count, and capture
time. It does not retain visible text, recent input, click details, browser
payloads, screenshots, or desktop-wide data. The bounded observation is carried
through the existing lifecycle task and Observer readback.

The sidecar refreshes this projection at a bounded one-second interval with a
single in-flight request. Each observation carries a monotonic sequence and the
supervisor derives `fresh`, `stale`, or `missing` from a three-second freshness
budget. The milestone proves a browser update advances the observation sequence
without retaining the updated input text.

Screen-sense now preserves the session-manager helper runtime instead of
reconstructing only browser lease metadata. When a sidecar lifecycle is active,
screen-act requires the sidecar to be running with a fresh capture observation
for the authoritative session before forwarding browser input/click. Stale,
missing, or cross-session observations block before browser mutation. The
legacy helper-lease path remains compatible until a sidecar lifecycle is
activated.

For an active lifecycle, screen-act now sends bounded keyboard-type or click
envelopes to session-manager, which forwards them over the bounded user-session
socket. The sidecar rechecks its local capture freshness and session identity,
then performs the loopback browser-runtime request with the current helper
lease. Browser-runtime remains the final lease validator, while the resulting
mediation is returned through the existing screen-act audit event and action
state. Unsupported hotkey/window-focus actions are not added to this transport.

## Evidence

Runtime contract builder:

```text
packages/shared-utils/src/work-view-trust.mjs
packages/shared-utils/test/work-view-trust.test.mjs
services/openclaw-session-manager/src/trusted-work-view-helper-runtime.mjs
services/openclaw-session-manager/src/trusted-work-view-sidecar-channel.mjs
services/openclaw-session-manager/src/trusted-work-view-sidecar-supervisor.mjs
services/openclaw-session-manager/src/trusted-work-view-sidecar.mjs
services/openclaw-session-manager/test/trusted-work-view-helper-runtime.test.mjs
services/openclaw-session-manager/test/trusted-work-view-sidecar-supervisor.test.mjs
```

Service propagation:

```text
services/openclaw-session-manager/src/server.mjs
services/openclaw-browser-runtime/src/server.mjs
services/openclaw-screen-act/src/trusted-work-view-action-mediation.mjs
services/openclaw-screen-act/src/server.mjs
services/openclaw-screen-sense/src/server.mjs
services/openclaw-core/src/phase3-work-view-builders.mjs
services/openclaw-core/src/work-view-authority-continuity.mjs
services/openclaw-core/src/browser-task-action-contract.mjs
services/openclaw-core/src/task-recovery.mjs
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

Session-manager restart recovery is now part of the same Level 2 lifecycle:

```text
approved sidecar start
-> synchronously persist compact task/approval/status intent
-> session-manager stops and the sidecar clears authority/capture but survives
-> restart projects prior running intent as recovery_required
-> browser-runtime suspends the surviving old lease before session-manager listens
-> no reconnect or action is performed automatically
-> work-view prepare establishes a new session lease
-> the existing approved lifecycle task explicitly reconnects the same PID
```

The persisted record excludes lease values, capture payloads, input text,
credentials, and provider material. Observer renders the recovery-required and
automatic-restart fields through the existing work-view panel.

## Deferred

The following remain intentionally deferred:

```text
desktop-wide GNOME/Wayland capture
sidecar installation or login-session persistence
root/system daemon or polkit integration
nested compositor or graphics-stack-native workspace
host mutation and input execution beyond existing governed user-space paths
provider egress or credential access
automatic recovery execution; the contract recommends existing operator actions
unreviewed endpoint invocation from recommendation payloads
trusted-lease mediation for keyboard hotkey/window-focus paths that do not yet
mutate browser-runtime state
automatic sidecar restart after crash or heartbeat timeout; recovery remains an
explicit approved operator action
automatic task or sidecar restart after session authority loss; recovery remains
an explicit operator action using the existing approved lifecycle and task
recovery routes
sidecar login auto-start or persistence beyond the bounded reconnect timeout;
the approved sidecar remains runtime-scoped and self-terminates if no authority
reconnects
```

## Next Slice

The approved user-space sidecar now owns heartbeat, fail-closed liveness,
continuously refreshed bounded capture, bounded browser input/click transport,
and explicit recovery across session-manager and browser-runtime restarts.
Browser-runtime loss marks the capture source `recovery_required`, blocks
screen-act before dispatch, recommends the existing `prepare_work_view`
operator action, and resumes capture and IPC actions on the same sidecar after
prepare. The next real work-view action is also complete:

```text
bounded browser navigation/new-tab request
-> derive the current trusted helper lease
-> require a fresh same-session sidecar capture
-> transport the request through sidecar IPC
-> mutate only the AI-owned browser runtime
-> refresh bounded capture and expose the result in Observer/audit
```

This action is now complete. HTTP(S) URLs are bounded to 2048 characters,
embedded credentials and non-network schemes are rejected, browser-runtime
requires the current trusted lease, and Observer exposes an `Open New Tab`
control. The real milestone proves the tab count and active URL changed and a
newer sidecar capture observed the result.

The capability is also available to autonomous browser tasks:

```text
browser task action kind browser.new_tab
-> planner capability mapping
-> task-executor screen-act route selection
-> existing lease/capture/sidecar transport
-> task action evidence includes the bounded effect summary
```

This autonomous bridge is now complete. Planner and executor share one
production action descriptor for capability and screen-act route selection,
task evidence retains the compact sidecar effect, and verifier URL selection
prefers the post-action bounded observation over stale session metadata. The
real milestone completes a planned browser task whose `browser.new_tab` action
is observed at the requested URL.

The next Level 2 slice should address interrupted long-running work rather than
add another navigation variant:

```text
in-flight browser task
-> capture source becomes unavailable
-> action fails closed with recoverable evidence
-> operator/runtime restores the bounded work view
-> existing task recovery retries from fresh observation
-> completion evidence links both interruption and recovered action
```

This action-level recovery is now complete. The executor recognizes only the
three sidecar capture interruption reasons, invokes the existing bounded
`prepare_work_view` action once, retries the original action once, and records
the first result, recovery reason, prepare result, and retry result in task
evidence. Unrelated failures are not retried. Production-shape tests prove the
executor dependency sequence; the real Phase 3 milestone separately proves the
same capture failure, prepare recovery, and post-recovery sidecar action states
without adding a fault-injection endpoint.

The next Level 2 slice should preserve task continuity when the authority
service itself restarts during work:

```text
active browser task
-> session-manager process exits and sidecar clears authority but survives
-> core records a recoverable authority interruption
-> session-manager returns as recovery_required
-> approved sidecar and fresh session are explicitly restored
-> the existing task recovery chain continues from fresh observation
```

This authority-interruption slice is now complete. Session-manager dependency
failures at prepare, reveal, bounded capture recovery, verification-state read,
or completion hide are classified without swallowing unrelated errors. Core
persists a failed task with `work-view-authority-recovery-evidence`; after the
operator restores the session and approved sidecar, the existing recovery route
preserves the browser plan and the existing execute route runs only unfinished
action steps. Completed side-effecting steps are not replayed. The real Phase 3
milestone stops session-manager while the sidecar survives fail-closed, creates
the interrupted task, restores authority explicitly, and proves the recovered
`browser.new_tab` completes through `trusted-sidecar-ipc` with linked task ids.

The next smallest continuity gap is a Level 1/Level 2 exit-gate behavior across
core process restart:

```text
persisted active browser task
-> core process exits and returns
-> startup reconciliation records an explicit recoverable interruption
-> the trusted work-view state remains inspectable
-> operator recovers the task
-> only unfinished planned actions execute
```

This should reuse task persistence, recovery, trusted work-view state, and the
existing Phase 3 milestone family rather than add another readiness endpoint.
Root/system daemon work, desktop-wide capture, graphics-stack integration,
broader input, automatic restart, and provider egress remain deferred.

This core-restart exit gate is now complete. Startup reconciliation converts
only persisted `running` browser rule plans into `core-runtime-recovery-evidence`;
queued and intentionally paused tasks keep their state. No task is automatically
executed. The existing recovery route preserves completed action steps and the
real Phase 3 milestone proves the recovered pending new-tab action uses the
still-running trusted sidecar after core returns. Observer's existing task
history and selected-task recovery controls render the evidence and
recommendation without a new panel.

The next real Level 2 architecture step should make the sidecar a stable
user-session component rather than add more browser actions:

```text
approved user-space sidecar
-> authority disconnect immediately suspends action capability
-> sidecar retains no usable lease while disconnected
-> restarted session-manager establishes a fresh work-view session
-> explicit approved reconnect binds the sidecar to the fresh lease
-> bounded capture and actions resume with linked lifecycle evidence
```

This must remain user-space and fail closed. It must not become a root/system
daemon, automatic action restart, login installation, desktop-wide capture, or
provider route.

This independent ownership and reconnect slice is now complete. The detached
sidecar accepts one bounded current-user socket authority, retains no lease in
its environment or reconnect state, clears session/capture immediately when the
authority socket closes, and exits after a bounded reconnect timeout. A new
session-manager cannot resume actions merely by starting; it must prepare a new
work view and reuse the existing approved lifecycle action. The real milestone
proves the same PID reconnects under a fresh session/lease while the stale lease
remains rejected. Observer shows user-session ownership, connection, and
reconnect state through the existing Phase 3 panels.

The next real Level 2 reliability slice should prove sidecar process failure,
not authority failure:

```text
running user-session sidecar process exits unexpectedly
-> helper action authority is suspended and recovery_required is visible
-> no replacement starts automatically
-> existing approved lifecycle action starts one replacement PID
-> fresh capture and trusted actions resume under a rotated lease
```

This process-failure replacement slice is now complete. Only a lifecycle
`/stop` request is treated as normal termination; SIGTERM, unexpected exit, and
heartbeat loss suspend helper action authority and record recovery. The real
Phase 3 milestone kills the running sidecar PID, proves actions remain blocked
with `automaticRestart:false`, then reuses the approved lifecycle action to
start a different PID with fresh capture and trusted action evidence.

The final Level 2 runtime-ownership step should replace ad hoc process spawning
with a declarative, non-enabled-by-default `systemd --user` unit contract:

```text
approved lifecycle action
-> explicitly start or connect to the user service instance
-> keep socket/session/lease binding governed by the existing supervisor
-> explicit stop disables the runtime instance
-> no login auto-start, root unit, or action auto-resume
```

This is user-session packaging, not Level 3 hostd work. It must preserve the
same approval, fail-closed disconnect, bounded reconnect, audit, and Observer
contracts before Level 2 can be considered ready to exit.

The declarative unit contract is now materialized by
`services.openclaw.trustedSidecarUserUnit.enable` and enabled in the desktop-body
profile. It defines `openclaw-trusted-sidecar@.service` without `wantedBy`, with
`Restart=no`, a per-instance `%t/openclaw-sidecars/%i.env`, current-user umask,
no-new-privileges, protected system/home paths, and only Unix/loopback address
families. The existing `body-config` milestone performs a real `nix eval` of
these fields. No service is installed, enabled, started, or connected by this
slice, and the runtime still uses the validated direct-spawn fallback.

The next smallest real Level 2 slice is the approved launcher bridge:

```text
existing approved sidecar lifecycle start
-> write one bounded current-user instance environment file
-> invoke the fixed systemd --user template instance
-> connect through the existing deterministic socket contract
-> retain direct spawn only as explicit development fallback
-> explicit lifecycle stop stops the same user unit instance
```

This bridge must expose launcher mode and unit instance in existing lifecycle
readback, must not pass lease/session/credential values through the environment,
and must not auto-enable or auto-restart the unit.

The approved launcher bridge is now complete. The existing lifecycle start
writes one mode-0600 allowlisted environment file for the fixed `primary`
instance, invokes `openclaw-trusted-sidecar@primary.service` through the current
user manager, and then binds session/lease/browser authority only over the
existing Unix socket. The environment contains lifecycle task/approval IDs,
socket path, and bounded timing controls; it contains no session, lease,
credential, provider, or browser-runtime URL. Explicit lifecycle stop stops the
same unit and removes the environment file. `direct-spawn` remains available
only when development startup selects it explicitly.

The existing Phase 3 milestone temporarily materializes and cleans up the fixed
user unit on the VM, proves actual `systemd --user` start/stop, same-PID
session-manager reconnect, no automatic process replacement, explicit
different-PID replacement, capture/action continuity, and Observer readback.
The Nix unit also grants its strict sandbox write access only to
`%t/openclaw-sidecars`, which real execution proved is required for the bounded
Unix socket.

The VM proof runs session-manager in the current user session. The Nix body
skeleton still defines its main services at system scope, so wiring a selected
desktop user's session-manager deployment to that user's manager remains a
separate deployment concern. No UID is hardcoded and no root-to-user-manager
proxy is introduced by this slice.

The next smallest real Level 2 slice is bounded AI-owned browser workspace
continuity across browser-runtime restart. The browser runtime is currently
in-memory, so stable work-view ownership should persist only bounded tab and
active-URL/session intent, restore it without action authority, require the
existing prepare/lease rebind before actions resume, and expose recovery through
the existing Observer surface. Lease values, input text, click data, capture
payloads, credentials, provider data, and automatic action replay remain
deferred.

That bounded workspace-continuity slice is now complete. Browser runtime writes
one mode-0600, size-bounded atomic intent containing at most 32 normalized tabs,
active URL/title, profile, and compact session identity. Startup restores those
tabs with `running:false`, no process ID, no helper lease, no interaction data,
and `automaticActionReplay:false`. The existing prepare route binds a fresh
lease, preserves the restored tabs, and projects
`rebound_after_explicit_prepare` through the sidecar capture and existing
Observer panel.

The real Phase 3 milestone now kills browser-runtime after eight tabs exist,
proves all eight return before prepare while actions remain unavailable, then
explicitly prepares the work view and continues governed input/new-tab actions.
The persisted JSON is also inspected to prove it contains no lease, input,
click, capture, process ID, or known interaction text.

The next real Level 2 slice should replace the simulated browser process behind
the same contract with a real local AI-owned browser engine adapter. The
current runtime still assigns a synthetic browser PID and derives title, tabs,
and capture from its in-memory model. Use a proven browser automation engine,
launch one bounded user-space profile, prove one HTTP(S) navigation and compact
capture, and keep the existing lease/sidecar/Observer/recovery contracts. Do not
expand to desktop-wide capture, arbitrary executable launch, automatic action
replay, root ownership, or a parallel browser API.

That first real-engine slice is now complete. `puppeteer-core` controls a
NixOS-managed Firefox executable without downloading a hidden browser. The
existing open, new-tab, input, click, capture, lease, sidecar, and Observer
contracts now support `firefox` mode, return the real browser process PID and
real page title/URL/tab metadata, and fail closed on engine disconnect. The
AI-owned profile is ephemeral: it is cleared before launch, on disconnect, and
on service shutdown, while durable tab continuity remains in the separate
bounded workspace intent.

The existing `openclaw-ai-work-view-capture` milestone starts a loopback HTML
fixture, prepares the work view through session-manager, launches the current
NixOS Firefox through Puppeteer, performs lease-mediated input/click, and proves
real engine metadata in browser capture and screen-sense. It also proves no
profile or Firefox process remains after shutdown. `dev-up` keeps `simulated`
as an explicit development fallback; the Nix module exposes a pinned Firefox
package and only adds it to the service closure in `firefox` mode.

The next Level 2 deployment slice is to place session-manager and browser-runtime
in the same selected login-user manager as the trusted sidecar, so the desktop
profile can select the real engine without running a browser from a root system
service. This must be a declarative component ownership move, not duplicate
system and user instances, a hardcoded UID, `--no-sandbox`, or a root proxy.

That deployment slice is now complete. The body module partitions enabled
components before emitting units: names selected by
`services.openclaw.componentOwnership.user` exist only in
`systemd.user.services`, and all other enabled names exist only in
`systemd.services`. User-owned components use `%S/openclaw` and `%L/openclaw`,
retain only same-scope unit dependencies, and are wanted by and part of
`graphical-session.target`. No UID, username, root-to-user proxy, or browser
sandbox bypass is present.

The desktop profile places only session-manager and browser-runtime in the
login-user manager and defaults browser-runtime to the fixed NixOS Firefox
package. Nix assertions reject a root-owned Firefox runtime and reject a
system-unit repair delegation aimed at a user-owned browser. The existing
`body-config` milestone evaluates the real generated units and proves the two
names are absent from the system manager, present in the user manager, use
per-user state/profile paths, retain session-manager -> browser-runtime
ordering, and resolve the Nix Firefox executable. Existing Phase 3 and capture
milestones continue to prove approval, recovery, Observer, and real-engine
behavior without changing ports or public routes.

The next real Level 2 gap is visual capture rather than more ownership
readiness. The current Firefox adapter reads real page and process metadata,
but `/browser/capture` still synthesizes its readable snapshot from runtime
state rather than acquiring a bounded browser pixel frame. Add AI-owned-page
capture behind the existing route and trust contract, with strict dimensions,
byte limits, freshness, cleanup, and no desktop-wide source. Do not add a
parallel capture API, arbitrary filesystem output, root ownership, or a new
readiness milestone.

That bounded visual-capture slice is now complete. The Firefox adapter acquires
only the active AI-owned page at a fixed `960x540` viewport as JPEG, rejects
frames larger than 256 KiB, caches a frame for at most two seconds, and
invalidates it after navigation, input, or click. The frame contract carries a
SHA-256 digest, sequence, dimensions, byte count, active page URL, freshness,
and explicit `desktopWideCapture:false` / `persisted:false` evidence. No image
file is written and simulated mode fails closed with no image data.

The existing `/browser/capture` and `/screen/current` routes carry the bounded
data URL for the current Observer view. Work-view summaries, capture metadata,
sidecar polling, and persisted `screen.updated` audit events carry metadata
only. Runtime-state text remains explicitly labeled
`ocrSource:runtime_state_projection`; this slice does not claim that OCR was
derived from pixels. The Observer Snapshot Preview renders the validated frame
inside its existing panel and removes the image when unavailable.

The existing real Firefox milestone decodes the returned JPEG, verifies its
magic bytes, dimensions, byte limit, digest, active-page URL, freshness, and
screen-sense projection, then proves the metadata query and persisted event log
contain no data URL. Unit coverage also proves cache invalidation and
fail-closed oversized/tampered frame handling.

The next real Level 2 slice is visual-frame-grounded action mediation. The
sidecar should trigger a bounded frame capture without receiving image bytes,
carry only the fresh frame digest/sequence in its observation, bind that compact
provenance to the next trusted input/click/navigation result, and refresh the
frame after mutation. Do not persist image data, make OCR claims, add a new
capture route, or create a readiness-only milestone.

That visual grounding slice is now complete. In real-engine mode the sidecar's
existing metadata capture triggers the bounded screenshot but receives only
validated frame metadata. Its observation carries the active-page digest,
frame sequence, dimensions, byte count, URL, and freshness with
`dataExposed:false`. A trusted action requires a fresh pre-action frame, then
forces one post-mutation refresh and returns
`openclaw-trusted-work-view-visual-action-grounding-v0` with compact before and
after references. Simulated development mode remains explicit and reports
`simulated_not_required` rather than pretending pixels exist.

The browser adapter uses a mutation epoch so a screenshot that overlaps
navigation/input/click cannot overwrite the invalidated cache. If an action is
accepted but post-action capture is unavailable, the result records
`post_action_frame_unverified` without turning the completed side effect into a
retryable failure. Core's browser action contract strips any frame data again
before attaching grounding to task evidence.

The real Firefox milestone proves an approved sidecar-grounded navigation
changes frame URL and SHA-256, then proves an autonomous browser task retains
the advancing pre/post sequence in `eye-hand-action-evidence`. The Phase 3
milestone proves simulated fallback and recovery remain compatible, and the
Observer Last Action panel exposes compact grounding status. Audit and task
payloads remain free of image data.

The next Level 2 product gap is bounded semantic target observation inside the
AI-owned page. Add a read-only inventory of visible interactive elements tied
to the current frame digest/sequence, with strict item/text/bounds limits and no
input values, arbitrary page script, mutation, or desktop capture. Reuse the
existing capture/screen/Observer lane; semantic click/type execution remains a
later governed action.
