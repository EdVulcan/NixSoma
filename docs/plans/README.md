# NixSoma Plans Directory

Updated: 2026-07-28

This directory contains current decision records and historical milestone
evidence. It is not a queue ordered by phase number. Use
[`docs/README.md`](../README.md) for the current source, validation, deployment,
and route baseline.

## Active Decision Records

Only these documents should guide current route selection:

| Document | Decision owned |
| --- | --- |
| [`../OPENCLAW_FORWARD_WORK_DIRECTIVE.md`](../OPENCLAW_FORWARD_WORK_DIRECTIVE.md) | Mainline selection, anti-nesting rules, current physical-host boundary, and next real capability. |
| [`../architecture/OPENCLAW_SYSTEM_IDENTITY_UPGRADE_PATH.md`](../architecture/OPENCLAW_SYSTEM_IDENTITY_UPGRADE_PATH.md) | Level 1-4 identity progression and maturity baseline. |
| [`OPENCLAW_NATIVE_ENGINEERING_TOOL_SURFACE_PLAN.md`](./OPENCLAW_NATIVE_ENGINEERING_TOOL_SURFACE_PLAN.md) | Governed Level 1 engineering capability frontier. |
| [`OPENCLAW_TRUSTED_WORK_VIEW_SESSION_CONTRACT_PLAN.md`](./OPENCLAW_TRUSTED_WORK_VIEW_SESSION_CONTRACT_PLAN.md) | Bounded Level 2 browser/work-view contract. |
| [`OPENCLAW_INTERNAL_SERVICE_IDENTITY_PLAN.md`](./OPENCLAW_INTERNAL_SERVICE_IDENTITY_PLAN.md) | Operator identity, per-service credentials, and execution grants. |
| [`OPENCLAW_DBUS_NATIVE_SYSTEMD_CONTROL_PLAN.md`](./OPENCLAW_DBUS_NATIVE_SYSTEMD_CONTROL_PLAN.md) | Fixed Level 3 restart owners, bounded journal diagnosis, resource-pressure sensing, and declarative cgroup envelopes. |
| [`OPENCLAW_SYSTEMD_INCIDENT_AI_HANDOFF_PLAN.md`](./OPENCLAW_SYSTEMD_INCIDENT_AI_HANDOFF_PLAN.md) | Exact request-bound, guidance-only AI diagnosis from a compact terminal repair receipt. |
| [`OPENCLAW_SYSTEMD_INCIDENT_EXPERIENCE_MEMORY_PLAN.md`](./OPENCLAW_SYSTEMD_INCIDENT_EXPERIENCE_MEMORY_PLAN.md) | Local target-specific outcome absorption and advisory recall from verified incident receipts. |
| [`OPENCLAW_SYSTEMD_INCIDENT_LEARNED_PROVIDER_CONTEXT_PLAN.md`](./OPENCLAW_SYSTEMD_INCIDENT_LEARNED_PROVIDER_CONTEXT_PLAN.md) | Up to three matching-target learned patterns inside the existing exact approved diagnosis request. |
| [`OPENCLAW_SYSTEMD_INCIDENT_REVIEWED_ACTION_PLAN.md`](./OPENCLAW_SYSTEMD_INCIDENT_REVIEWED_ACTION_PLAN.md) | Reviewed read-only opening of the exact incident receipt and recovery evidence bound to provider guidance. |
| [`OPENCLAW_SYSTEMD_INCIDENT_REVIEWED_REFRESH_PLAN.md`](./OPENCLAW_SYSTEMD_INCIDENT_REVIEWED_REFRESH_PLAN.md) | Reviewed same-unit refresh of existing health, fixed-unit inventory, and bounded journal evidence. |
| [`OPENCLAW_SYSTEMD_INCIDENT_OBSERVATION_RECEIPT_PLAN.md`](./OPENCLAW_SYSTEMD_INCIDENT_OBSERVATION_RECEIPT_PLAN.md) | Compact hash-bound evidence from the reviewed same-unit observation refresh. |
| [`OPENCLAW_SYSTEMD_OBSERVATION_AI_HANDOFF_PLAN.md`](./OPENCLAW_SYSTEMD_OBSERVATION_AI_HANDOFF_PLAN.md) | Exact approval-bound AI diagnosis and reviewed readback from the compact observation receipt. |
| [`OPENCLAW_FIXED_UNIT_INCIDENT_SCHEDULER_PLAN.md`](./OPENCLAW_FIXED_UNIT_INCIDENT_SCHEDULER_PLAN.md) | Periodic local observation and restart-safe deduplicated incident tasks for fixed units. |
| [`OPENCLAW_PHASE_D_DECLARATIVE_EVOLUTION_CANDIDATE_PLAN.md`](./OPENCLAW_PHASE_D_DECLARATIVE_EVOLUTION_CANDIDATE_PLAN.md) | Declarative-evolution evidence and deferred activation boundary. |
| [`OPENCLAW_EXPERT_REVIEW_OPTIMIZATION_PLAN.md`](./OPENCLAW_EXPERT_REVIEW_OPTIMIZATION_PLAN.md) | Measured validation, runtime, and review debt that blocks the mainline. |

The kernel whitepaper remains the long-horizon authority:
[`KERNEL_LEVEL_EVOLUTION_WHITEPAPER.md`](../architecture/KERNEL_LEVEL_EVOLUTION_WHITEPAPER.md).

## Current Route

Completed capability families must not be reopened for another wrapper,
readiness marker, readback mirror, or horizontal variant. The completed Level 3
diagnosis route is:

```text
bound Event Hub audit-log memory and retention
-> combine body health with bounded journal diagnosis
-> reuse the existing fixed restart owner
-> verify post-repair health
-> expose task and Observer evidence
-> project the compact terminal receipt through the approved DeepSeek handoff
-> return one transient structured recommendation
-> retain and recall one bounded local matching-target incident pattern
-> bind up to three prior matching patterns into the approved diagnosis request
-> review provider guidance and open the exact bound incident evidence
-> review provider guidance and refresh same-unit read-only observation
-> persist one compact hash-bound local observation receipt
-> create one exact approval-bound diagnosis from that receipt
-> review the exact observation task without recursive refresh
-> periodically observe the three fixed hostd targets locally
-> create one compact completed task per new failure fingerprint
-> automatically bind the current incident to the existing local repair draft
-> create one completed triage evidence task without approval or execution
-> automatically promote that triage into one pending fixed-target repair approval
-> require explicit operator approval or denial
-> after approval, reserve and dispatch that exact task once through Executor
-> preserve the existing post-repair health and incident receipt
-> fail a non-terminal dispatch reservation closed after Core restart
```

This route advances the Level 3 body loop without widening hostd authority and
without introducing a new provider response schema. The deployed baseline is
proven through non-mutating health, auth, scheduler, and Observer probes, and
automatic local triage, pending repair promotion, approval-triggered one-shot
dispatch, and fail-closed restart reconciliation are deployed in generation
`/nix/store/yzjwwp67apgv4rrzpm3g2gz12bqkq7vj-nixos-system-nixos-26.05.4808.569d57850992`.
Non-mutating health, auth, scheduler, live-closure, and Observer probes passed;
the first post-switch tick observed all fixed targets healthy without changing
task or approval counts. Freeze this lane and select a distinct concrete
whitepaper capability. Real hostd mutation, generation rollback, arbitrary
systemd control, desktop-wide capture, and automatic provider egress remain
deferred.

The bounded resource-pressure route and its declarative envelope are complete
in source. The native inventory and Observer retain the fixed read-only
telemetry and four-sample trend. The desktop Nix profile adds independent
`openclaw-body.slice` and `openclaw-session.slice` envelopes, each with 1.5 GiB
`MemoryHigh`, 3 GiB `MemoryMax`, and `TasksMax=1024`; hostd and credential
initializers remain excluded. Physical-host generation `9bbc00da...` is now
deployed and read-only probed. It also preconfigures the fixed DeepSeek
endpoint/model with live egress disabled and no secret dependency. Current
generation `6dm12j7...` delivers the root-only API key through Core
`LoadCredential` and has completed one request-bound, explicitly approved real
advisory call. Both slices and all assigned services remain active; health,
restart-count, auth, failed-unit, and warning journal probes passed. Freeze the
resource and provider-transport lanes. Do not synthesize memory pressure on the
only physical host. The bounded standing advisory policy is now complete in
source and validated through the common capability runtime. It cannot accept a
caller prompt/model/context, create a task or approval, execute a recommendation,
or mutate the host. Generation `czq8arvh...` now deploys it, and one real
459-token call returned `observe_current_screen` without changing task or
approval counts. Audit and persistent hashes matched, and service health stayed
green. Freeze this lane and select a distinct whitepaper capability instead of
opening another readiness phase or provider-call surface.

The selected active route is now Level 4 graphical identity:

```text
login-user systemd owner
-> isolated Weston headless compositor
-> fixed nixsoma-ai-0 Wayland socket
-> existing session resource envelope
-> session-manager ownership/health evidence
-> Observer readback with explicit negative authority
-> physical-host coexistence proof with GNOME wayland-0 (complete)
-> AI-owned browser attachment (complete)
-> compositor-native bounded read-only frame (complete)
-> current-frame-bound native left click (complete and physically proven)
-> bounded AI-owned output projection (complete and physically proven)
-> minimal compositor-owned surface inventory (complete and physically proven)
-> fixed Nix-managed Workbench start/stop (complete and physically proven)
-> exact current-surface activation through kiosk shell (complete, deployed, and physically proven)
-> one current-frame- and active-surface-bound vertical scroll step (complete, deployed, and physically proven)
-> one explicit provider-decided no-op or existing scroll step (complete, deployed, and physically proven)
```

The current source stops before desktop takeover, desktop-wide observation,
parent-display access, arbitrary input devices, root, or host mutation. Firefox
retains only the existing browser-runtime network scope. Native input remains
limited to one frame-bound left click and one fixed-center, active-surface-bound
vertical step on `nixsoma-ai-0`; the projection is operator-authenticated,
explicitly selected, no-store, and browser-memory-only. Do not reopen the
completed provider or Level 2 action lanes or add horizontal axes, generic
gestures, repeated input, or projection variants.

Generation `kxv2ypwp...` completed the coexistence proof with a current-user
`0700` nested runtime/socket, no parent display environment or DRM handle, about
14 MiB memory, one task, zero restarts, unchanged GNOME PID, and unchanged
`wayland-0`. Session-manager reports `ready` and Observer serves the bounded
Level 4 readback. Browser attachment was selected as the next vertical step.

The attachment implementation was source-validated before deployment. Browser-runtime owns a
fixed nested-Wayland binding, validates the compositor socket before launch,
starts the existing Nix Firefox headed with a credential-free child environment,
and returns compact attachment through existing state. Session-manager and
Observer reuse the existing Level 4 readback. A real isolated Puppeteer probe
opened and closed a nested page without changing GNOME. A reviewed generation
switch and live proof then exercised the existing Level 2 capture, lease, action,
audit, and recovery path.

Generation `pkhlbmqx...` completed the browser deployment proof: headed Firefox is a
client of `nixsoma-ai-0`, screen-sense retained fresh bounded visual/semantic
evidence, and a lease-bound new-tab produced a new observed page identity.
GNOME stayed on `wayland-0`, no parent/control environment reached Firefox, and
the existing browser network scope was not widened. That deployment selected
bounded read-only compositor-native frame acquisition for the AI-owned output,
not another browser action or evidence wrapper.

Generation `v3d2plnz...` completes the next vertical step. Weston authorizes
only its fixed compositor-launched screenshooter client; session-manager returns
one transient hash-bound 1280x720 PNG under the existing 256 KiB ceiling and
deletes the runtime file before completing the response. Screen-sense and
Observer receive metadata only, Firefox cannot read the capture directory, and
the real frame differs from the 960x540 Puppeteer page frame. Freeze capture
variants. The next route is compositor-native input constrained to
`nixsoma-ai-0` and a current native frame, not GNOME, provider work, or another
readiness wrapper.

That fourth vertical slice is now implemented and source-validated. The common
screen pointer capability carries an optional fresh compositor-frame binding
through the existing Core grant and screen-act owner. Session-manager is the
authoritative lease/frame gate and sends one fixed click request over a
current-user mode-0600 Unix socket. Weston accepts only the exact
session-manager peer and its user-unit cgroup, then returns a request/frame/
coordinate-bound receipt; a new compositor frame supplies post-action proof.
Generation `mncd0bfp...` replaced `v3d2plnz...` and completed the physical stop
gate. A real click at `740,22` advanced native frame 1 to 2 in 239 ms, changed
the visual hash, and matched the Core grant, active lease, and Weston receipt.
The check also proved an ordinary same-UID peer receives no receipt, retained no
pixels, added no runtime directory entries, produced no warning journal, and
caused no restart counter increase. Freeze native input and select bounded
projection of the AI-owned output.

That fifth vertical slice is now deployed and physically proven. One
operator-protected Core GET reuses session-manager's current compositor frame,
revalidates the fixed socket, freshness, dimensions, PNG bytes, digest, and
negative authority, then returns a no-store envelope. Observer adds a separate
`AI Workspace` tab and requests only while authenticated, visible, and selected;
it validates the frame again in browser memory and clears the image source on
mode switch, hide, sign-out, or auth loss. Pixels never enter service state,
events, browser storage, or durable artifacts. Focused tests are 52/52, all 942
workspace tests and typecheck pass, body-config built the new store packages,
and generation `ll14clw2...` references those closures. Native frame and
input regressions returned a distinct 1280x720 PNG and advanced frame sequence
6 to 7 with matching authority. The projection gate rejected anonymous capture,
rendered the full native image in real Firefox, cleared it on mode switch and
sign-out, retained only metadata, and left runtime storage empty. Services,
restart counters, failed-unit checks, and warning journals stayed clean. Freeze
this lane before selecting the next vertical Level 4 behavior.

That next vertical behavior is now complete in active generation `vymmz8c3...`.
Weston atomically publishes at most 16 numeric surface/PID/dimension/activation
records from `nixsoma-ai-0`; it does not publish title, app-id, pixels, or
parent-display authority. A static non-autostarting `nixsoma-ai-workbench`
user unit runs only the fixed Nix terminal/status shell. Core operator identity
and a single-use execution grant protect the session-manager start/stop owner,
which requires durable audit and reconciles the unit against its matching
surface. Real Observer controls proved 0 -> 1 -> 0 surfaces, matching PID,
anonymous rejection, and cleanup while every service remained healthy. Freeze
generic lifecycle and inventory variants; any continuation must add bounded
product behavior through these owners, not arbitrary process/window launch.

The next bounded behavior is now complete in active generation
`7ycsdd61...`. A session-local Weston patch registers one versioned kiosk-shell
activation API, and frame-authority delegates the exact numeric target instead
of attempting to mutate shell state. Core binds `surfaceId + inventorySequence`
into its existing single-use session-manager grant; session-manager requires
durable audit, fresh pre-frame, peer receipt, newer activated inventory, and a
post-frame. Observer provides one numeric selector. Native, candidate user-plane,
and normal production checks switched fixture 2 -> Workbench 4, changed both
frames, rejected anonymous direct mutation, and cleaned surface count back to
zero. All nine health endpoints remain green with zero relevant restarts and no
failed units or warning journals. Freeze this lane. The selected next Level 4
behavior is one bounded current-frame- and active-surface-bound vertical scroll
step through the existing pointer owner.

That selected behavior is now deployed in `b6qjcbfc...`. The existing
pointer capability accepts only one fixed-center `up` or `down` wheel step and
binds it to the exact current compositor frame, active numeric surface, and
inventory sequence. The request remains single-use and audit-first through
Core, screen-act, session-manager, and the authenticated Weston socket; caller
coordinates, deltas, counts, axes, gestures, keyboard, and generic window or
process control remain absent. A real candidate Observer gate scrolled fixture
surface 2 in both directions with matching receipts and changed post-frames,
rejected anonymous direct scroll, and restored production healthy. Browser
Runtime now follows isolated-compositor restarts through `PartOf`, closing the
stale attachment that an earlier gate exposed. The normal production gate then
repeated both directions, durable audit, anonymous rejection, and the complete
surface lifecycle with all nine health endpoints green. Freeze scroll variants.
The selected next capability is one explicit, schema-bound provider decision
over the current isolated workspace that can execute at most one existing
low-risk scroll action before stopping and verifying.

That selected capability is now complete in source, deployed in generation
`6k51pmrglb...`, and physically proven. `act.ai.workspace.single_step` accepts only an authenticated
explicit confirmation. Core generates a structural context from current helper,
browser, frame, inventory, and sole-active-surface readiness; it sends no pixels,
frame hashes, PIDs, titles, app-ids, URLs, paths, credentials, or caller prompt.
The fixed DeepSeek response contract allows only `no_op`, `scroll_up`, or
`scroll_down`. Core refreshes the owner state after the provider response and
reuses the existing frame/surface-bound `mouse.scroll` grant at most once.

This source shares the standing advisory single-flight, cooldown, daily calls,
and conservative token budget. Provider reason text remains transient, while
durable summaries retain hashes, action/status, and execution facts. All 991
workspace tests, typecheck, and the store-native body check pass. The separate
`dev-ai-workspace-single-step-live-check.sh` gate used real DeepSeek to select
`scroll_down`, executed exactly once on fixture surface 17, matched current
frame/surface evidence and durable egress/action/completion audit, then restored
the surface inventory to the browser-only baseline. All nine health endpoints
remained green with no failed units, restarts, or warning journals.

Freeze that ninth deployed checkpoint. Its selected continuation is now also
deployed. Screen Sense obtains a metadata-only Browser capture and
projects at most 12 visible role/name/disabled/bounds items. Core accepts it only
when its local Browser PID matches the sole active Weston surface, removes PIDs,
frame hashes, URLs, input values, selectors, target ids, page script, and pixels
from provider context, then recaptures after the provider response. Changed
surface, inventory, scene-content, or semantic-frame evidence stops before
screen-act; `no_op` performs no action and scrolling remains single-step.

All 1005 workspace tests, typecheck, the 811-entry registry/script audits,
Windows path budget, and store-native body check pass. Initial generation
`7j28vnll8...` reached the physical gate without consuming a DeepSeek call and
exposed that metadata mode returned only the semantic summary. Explicit
`semantic=items` now preserves no-pixel capture and existing defaults. Active
generation `jricbfds...` references Browser Runtime `ha9syr...` and Screen Sense
`amkk77...`. The real gate bound one semantic item, received DeepSeek `no_op`,
contacted no actuator, matched durable egress/completion audit, and kept all
nine health endpoints green.

Freeze the deployed tenth slice. Its selected continuation now exists as an
eleventh source candidate: the provider may return `click_item` with one
1-based scene-item ordinal; Core recaptures and Screen Act privately resolves
that ordinal to the existing current frame-bound semantic-click owner, executes
once, and performs a local post-action capture. Target ids/selectors remain
inside the actuator chain. Pixels/OCR, keyboard, text input, repeated loops,
arbitrary process/window control, root, and host mutation remain excluded.
Deployment and physical provider proof are still pending.
The source candidate passes 1016 workspace tests, typecheck, exact body closure,
811-entry registry/script audits, and Windows path budget. Physical generation
`lb3mif3b...` is built but not switched.

## Completed Capability Evidence

The following plan families are retained because they describe implemented
contracts or are referenced by milestone scripts:

- Enhanced-source gap audit and native read/search/edit/write/verify/recovery.
- Engineering planning, todo, workbench restoration, and microcompact context.
- LSP lifecycle, bounded symbol requests, target selection, and verification
  recovery.
- Trusted work-view association, control, semantic action, and recovery.
- Provider context packets, explicit DeepSeek handoff, and structured plan
  recommendation.
- Plugin runtime refresh and ACPX/Codex compatibility contracts.
- Phase A Nix-store packaging, Phase B fixed systemd control, Phase C eBPF
  observation, and Phase D declarative-evolution evidence.

Their `Next Slice` sections record historical decisions. They do not override
the current route above.

## Historical Migration Records

These remain useful source evidence but are not active next-work instructions:

| Document | Historical role |
| --- | --- |
| [`OPENCLAW_ENHANCED_SOURCE_MIGRATION_BRIEF.md`](./OPENCLAW_ENHANCED_SOURCE_MIGRATION_BRIEF.md) | Preserved enhanced-source inventory and migration constraints. |
| [`OPENCLAW_ENHANCED_SOURCE_GAP_AUDIT.md`](./OPENCLAW_ENHANCED_SOURCE_GAP_AUDIT.md) | Completed capability classification and migration evidence. |
| [`OPENCLAW_SOURCE_INTEGRATION_STAGE_PLAN.md`](./OPENCLAW_SOURCE_INTEGRATION_STAGE_PLAN.md) | Earlier source-integration stage log. |
| [`OPENCLAW_POST_MVP_PLAN.md`](./OPENCLAW_POST_MVP_PLAN.md) | Earlier post-MVP route selection. |

## Numbered Phase Plans

`OPENCLAW_PHASE_*_PLAN.md` files are retained because milestone scripts and
runtime evidence still reference them. They are historical check fixtures, not
the live roadmap. Do not delete, rename, or move them until every dependent
registry and script has migrated.

## Plan Creation Rule

- Prefer updating an active decision record.
- Create a plan only for a real capability with a distinct owner and proof.
- Do not create a numbered plan for documentation cleanup, readiness wording,
  or another mirror of existing evidence.
- State `delivered`, `evidence`, `deferred`, and `next real capability` at
  closure.
- Move completed guidance into historical evidence by changing the index, not
  by deleting referenced files.
