# NixSoma Forward Work Directive

Updated: 2026-07-17

This is the active guidance document for continuing NixSoma development after
the Phase 136 checkpoint and the discovery that the locally optimized
`openclaw` source has not yet been preserved on GitHub or migrated into
NixSoma.

NixSoma is the public project and repository name. Existing `openclaw-*`
service names, `OPENCLAW_*` environment variables, protocol registries, and
systemd unit names remain compatibility contracts and are intentionally not
renamed in this branding change.

Use this document as the first stop for new agents. Historical phase plans and
milestone checks remain valuable evidence, but they must not be treated as an
automatic instruction to continue with Phase 137.

## Current Diagnosis

The project has not fundamentally drifted from the whitepaper:

- The NixOS body has a service skeleton and resident control plane.
- The AI work-view route exists through session, browser, screen-sense, and
  screen-act services.
- Body health, conservative self-heal, systemd repair, evidence ledgers, and
  Observer visibility exist.
- Memory, cloud-consciousness, provider-call, and result-envelope routes have
  strong governance evidence.
- The core and Observer have been decoupled significantly since the earlier
  giant-file phase.

The risk is local drift:

- Phase 59 through Phase 136 became too dominated by nested cloud-provider,
  credential, local-read, result-envelope, approved-deferred, and readiness
  gates.
- Some of those gates are valid sovereignty boundaries, but continuing that
  pattern mechanically would create more shell/checklist work than product
  capability.
- The locally enhanced `openclaw` source contains real Claude Code-grade
  engineering improvements that are not yet stored in GitHub and not yet
  integrated as native OpenClaw body capabilities.

## Governing Vision

The controlling architecture documents are:

```text
docs/architecture/OPENCLAW_SYSTEM_IDENTITY_UPGRADE_PATH.md
docs/architecture/KERNEL_LEVEL_EVOLUTION_WHITEPAPER.md
docs/plans/OPENCLAW_ENHANCED_SOURCE_MIGRATION_BRIEF.md
```

The identity route is:

```text
stable user-space control plane
-> trusted session/work-view component
-> controlled system-level body daemon
-> graphics-stack-native AI workspace
-> later kernel-level body nerves
```

Do not root-ify the whole system. Do not try to take over the full user desktop
as the main route. First make OpenClaw stable, observable, useful, and capable
inside its own body and work-view.

## Immediate Stop Rule

Do not continue with another generic cloud/provider/credential phase unless it
unlocks an actual live capability that has been explicitly selected after this
directive.

In particular, do not create a Phase 137 that only adds another:

```text
route
task shell
approved-deferred record
final-readiness preflight
readback wrapper
observer mirror
```

Those patterns are allowed only when they are the smallest necessary slice for a
new product capability.

## First Required Work: Use Preserved Enhanced Source

The optimized Windows-host `openclaw` source is now preserved on GitHub as a
source reference for migration.

```text
repository: https://github.com/EdVulcan/openclaw-enhanced-source
branch: main
commit: d90b253b0c03191613e45c36b1434078b8788bed
```

This repository is a reference source, not a dependency to wholesale import.

Original Windows source working tree:

```text
D:\OpenclawAndClaudecode\openclaw
```

Observed important source material:

```text
extensions/cc-tools/
src/agents/pi-embedded-runner/microcompact.ts
src/agents/pi-embedded-runner/run/attempt.ts
src/agents/pi-tools.ts
src/agents/system-prompt.ts
src/plugins/runtime/runtime-registry-loader.ts
src/plugins/runtime/runtime-registry-loader.test.ts
src/auto-reply/reply/commands-plugins.ts
src/auto-reply/reply/commands-plugins.test.ts
src/auto-reply/reply/commands-plugins.install.test.ts
extensions/acpx/src/codex-auth-bridge.ts
extensions/acpx/src/runtime-persistence.test.ts
ui/index.html
ui/src/styles/
HEARTBEAT.md
SOUL.md
TOOLS.md
gateway-architecture.html
```

Do not preserve accidental local state unless the human explicitly asks:

```text
.openclaw/workspace-state.json
help.txt
temp_test.txt
```

Preferred VM inspection command:

```bash
rm -rf /tmp/openclaw-enhanced-source
git clone https://github.com/EdVulcan/openclaw-enhanced-source.git /tmp/openclaw-enhanced-source
cd /tmp/openclaw-enhanced-source
git checkout d90b253b0c03191613e45c36b1434078b8788bed
```

Preservation note:

```text
The first push preserved the full enhanced-source branch history from the local
openclaw checkout. GitHub reported one large historical cache file warning:
.serena/cache/typescript/document_symbols.pkl is 83.22 MB. Do not treat that
cache file as migration material.
```

The next step is not more preservation. The next step is the gap audit.

## Second Required Work: Enhanced Source Gap Audit

After the enhanced source is preserved, perform a source-integration gap audit.
The audit must classify every enhanced capability as one of:

```text
absorbed
partially absorbed
not absorbed
should not migrate
requires source transfer
```

Minimum capability list:

```text
cc_read / precise file read
cc_edit / surgical string replacement
cc_write / controlled new-file or overwrite path
cc_glob and cc_grep / fast codebase navigation
cc_lsp / definition, references, hover
cc_verify / verification loop and command evidence
cc_plan_enter, cc_plan_exit, cc_todo_write / planning state
microcompact / in-memory old tool-result compaction
live plugin runtime refresh
ACPX/Codex bridge compatibility and persistence tests
engineering prompt semantics
operator-facing UI refinements
identity notes: HEARTBEAT, SOUL, TOOLS
```

The audit output should become a new document:

```text
docs/plans/OPENCLAW_ENHANCED_SOURCE_GAP_AUDIT.md
```

## Third Required Work: Select Real Capability Slices

After the audit, the recommended trunk is:

```text
Native governed engineering tool surface
```

The first slices should move in this order:

1. Read-only tool inventory and contract mapping.
2. Native governed read/search surface.
3. Surgical edit proposal with diff preview, not raw write.
4. Verification command evidence attached to task completion.
5. Observer visibility and recovery evidence.
6. Microcompact as context-management evidence, not hidden transcript mutation.
7. Live plugin runtime refresh as a governed lifecycle action.
8. Planning/todo evidence as visible task/workbench state, not hidden mode.
9. LSP availability, lifecycle evidence, governed process probes, lifecycle
   state, and initialize/shutdown handshake before any source-content transfer
   or symbol request.

Only after these are proven should the project continue deeper cloud-provider
execution work.

## Current Evidence-Based Frontier

The Level 1 native engineering route now has bounded read/search, proposal,
approval-gated edit/write, ledger, verification, recovery, LSP selected-target,
planning workbench, governed suggested-action creation, and compact linked task
readback. It also has a bounded microcompact transformation for caller-owned
in-memory message copies, with recent verification/recovery context protected
and no persisted transcript mutation. A local Engineering Context Packet now
assembles bounded task/transcript context with credential-like redaction and
protected verification/recovery summaries without provider use. Do not reopen completed LSP symbol-request slices or add another
standalone engineering evidence/readiness shell without a concrete operator gap.

The first Hermes-inspired experience-memory slice is now also implemented. Core
records a bounded advisory lesson automatically at task completion or failure,
persists only sanitized task type/phase/tokens/confidence/hash metadata, and
recalls at most four matching lessons into the existing Engineering Context
Packet. The recalled evidence is visible in Observer and remains guidance only:
it cannot create tasks, approvals, commands, actions, provider calls, or network
egress. The same recall now derives bounded completed/failed counts, completion
rate, latest outcome, and a safe next-action suggestion from matching terminal
history. This is experience absorption, not automatic code self-modification;
the pattern and suggestion remain advisory and cannot execute anything.

The first Level 2 observation-to-decision bridge and the existing Core semantic
action handoff are complete. The trusted work-view association requires task
binding, active authority, fresh capture, and visual/inventory frame provenance;
the approved semantic click and write-only semantic type paths then revalidate
the current frame through the existing browser action owner. Observer and
Context Packet retain only bounded reasons and recovery controls. Do not reopen
the completed browser eye-hand variants or add another action/readiness shell.

The planning workbench contract is now closed through the common capability
runtime as well as its dedicated routes. `sense.openclaw.engineering_context.plan_todo_evidence`
reads the existing bounded task/workbench builder, while
`act.openclaw.engineering_context.plan_todo_workbench_state` reuses the existing
revisioned core-state storage and requires `confirm: true`. Invocation summaries
retain only counts, revision, status, and governance flags; plan text and todo
descriptions remain transient. The existing core plan/todo check now proves
common capability read, unconfirmed blocking, confirmed revisioned storage, and
no task-status mutation.

The approved DeepSeek handoff and recommendation bridge are now bounded by the
existing egress task. Task creation records only a redacted binding containing
the allowlisted endpoint fingerprint, model, exact
`openclaw://credential/deepseek-api-key` reference, request hash, optional
context hash, explicit context source-task id, response contract, and egress
authorization flags. `/operator/step` rebuilds that binding and rejects any
mismatch before the credential or network sender runs. The sender rejects
non-DeepSeek credential references and HTTP redirects. Recommendations remain
review-only and cannot create a task, approval, execution, or provider egress
automatically.

The 2026-07-17 security review also closed the main control-plane bypasses that
must remain part of the active contract: capability execution now requires a
server-side task/step/intent/params approval binding with one-time reservation;
Core infrastructure forwarding is limited to explicit read-only routes with
query preservation; file operations use realpath and no-follow descriptors;
browser navigation rejects private destinations and the browser runtime uses an
internal bearer token whenever it is configured or binds beyond loopback; and
Event Hub ingress plus required system-sense audit writes fail closed. The
browser token must be passed to session-manager, screen-act, and the trusted
sidecar, while public browser state must never expose the helper lease. These
are boundary corrections for the existing Level 2 route, not a new provider
phase.

The actuator execution slice is now closed for the common capability path. Core
issues a short-lived, single-use execution grant to system-sense and screen-act,
and each approved capability step follows `reserve -> start -> commit` or
`abort`. Failed or rejected backend calls release the reservation; expired
pre-start reservations are released, while an interrupted running reservation
is failed closed and requires a new approved task after Core restart. The
approval binding is derived from capability metadata rather than a fixed list of
capability ids. Capabilities that only create a pending, approval-gated task are
kept as task-shell entry points; they do not claim direct mutation authority.
The real-service regression in `nix/scripts/dev-direct-actuator-grant-check.sh`
proves that unsigned system-sense and screen-act requests fail before mutation,
audience-swapped grants fail, single-use replay fails, target tampering fails,
and the approved Core path still writes through its signed grant.

The same approved handoff now accepts explicit `includeWorkView`,
`includeWorkViewObservation`, and `includePlanTodo` context selectors. It
reuses the existing local association and plan/todo builders, includes only
bounded summaries in the transient provider message, and carries their
materialized content through the existing request-hash binding. Raw page
payloads, URLs, pixels, target items, selectors, input values, lease ids, and
credentials remain excluded. The focused boundary is documented in
`docs/plans/OPENCLAW_NATIVE_ENGINEERING_CONTEXT_PROVIDER_HANDOFF_BRIDGE_PLAN.md`.

The handoff also accepts an explicit `sourceTaskId` so the approved provider
egress task can consume bounded evidence from an existing engineering task.
The source task must exist, remains read-only, and is never resumed or mutated;
the egress task remains the approval and execution owner. This continuity
boundary is documented in
`docs/plans/OPENCLAW_NATIVE_ENGINEERING_CONTEXT_PROVIDER_SOURCE_TASK_PLAN.md`.

The bounded provider-facing `engineering_plan_v0` product slice is now complete
on that same approved handoff. DeepSeek may return only a short plan summary and
up to eight todo items with no paths, URLs, credentials, or automatic-control
fields. The plan is transient in the operator result; Observer validates it and
can save a reviewed copy through the existing
`act.openclaw.engineering_context.plan_todo_workbench_state` capability only
after explicit confirmation. Durable provider evidence keeps only the contract,
counts, lengths, validity, and response hash. This advances the Level 1
cloud-consciousness/workbench loop without reopening the historical provider
phase ladder.

Evidence for this slice is in the engineering-plan contract and live-execution
tests, the provider handoff capability test, the Observer plan test, and the
existing Phase 63 egress task-shell check. Provider egress remains explicitly
operator-approved; the draft cannot create tasks or approvals, execute controls,
write files, or change the workspace by itself.

The next route was a concrete Level 2 trusted work-view/session-helper operator
gap selected from current bounded observation. That bounded route is now closed;
do not add another provider response schema, readiness marker, LSP variant, or
browser action family unless the evidence demonstrates a decision that the
existing owner and recovery controls cannot make. Continue with the next
separately justified Level 3 host capability.

The first concrete Level 2 gap selected from that route was the recovery
decision exposed by trusted work-view observation. It is now closed without a
new route: Observer maps `prepare_work_view`, `reveal_work_view`, and
`hide_work_view` through the existing `act.work_view.control` owner, maps
`resume_ai_action_authority` to the existing `/control/resume` task-control
path, and maps `restart_approved_trusted_sidecar` to the existing approved
sidecar `start-probe` path. The action remains explicit and operator initiated;
an unknown recommendation cannot choose an endpoint, replay a task, or bypass
the sidecar approval gate.

The next concrete Level 2 operator gap is now closed through the existing
Snapshot Preview and task planner. Observer filters the current screen
inventory to visible enabled named targets, lets the operator choose one, and
creates a queued rule-v1 `browser.semantic_click` task through `POST /tasks/plan`.
Only exact name/optional-role intent enters the plan; execution remains an
explicit Operator Step or Operator Run. Core re-materialises the target at
dispatch and the existing semantic handoff/sidecar revalidate lease,
inventory, frame, target presence, and visual grounding. No coordinate,
selector, page script, automatic dispatch, or new capability owner is added.

The current Level 1 follow-up closes a separate operator execution-consistency
gap in the existing browser task path. It is documented in
`docs/plans/OPENCLAW_NATIVE_ENGINEERING_OPERATOR_EXECUTION_BINDING_PLAN.md`.
Rule-v1 task creation stores a compact target/action-shape binding, and
`/operator/step` plus `/operator/run` recompute and validate it before
work-view preparation or screen-act. Target, action order/kind, and non-input
parameters must match; only bounded transient text may vary for write-only
input actions, and that text is excluded from the hash and persisted evidence.
An absent or stale binding fails closed. This is a Level 1 correction to an
existing execution path, not a new provider lane or another browser-action
variant. After this proof, return to the smallest real Level 2
work-view/session-helper capability.

The bounded native engineering read/search surface is also available through
the common `/capabilities/invoke` runtime. The capability registry now exposes
`sense.openclaw.engineering_tool.read`, `.glob`, and `.grep`; each dispatches to
the existing workspace-constrained native builder and records the normal policy,
invocation, and audit events. File bodies and search snippets remain transient
response data and are absent from persisted capability history. This bridge is
documented in
`docs/plans/OPENCLAW_NATIVE_ENGINEERING_CAPABILITY_RUNTIME_READ_SEARCH_PLAN.md`.
The existing Observer Read/Search panel now also requests those three bounded
results through the common capability runtime, while the dedicated native
adapter routes remain the detailed read-model owners. The panel adds no write,
command, LSP, task, approval, provider, or network authority.
It adds no task, approval, write, command, LSP, provider, or network authority.

The existing `cc_verify` verification-evidence builder is likewise available
through `sense.openclaw.engineering_tool.verify_evidence` in the common
`/capabilities/invoke` runtime. It reads only the existing governed command
transcript/task evidence, records the normal policy/invocation/audit path, and
keeps command execution, task creation, approvals, retries, mutation, and
provider egress disabled. This bridge is documented in
`docs/plans/OPENCLAW_NATIVE_ENGINEERING_CAPABILITY_RUNTIME_VERIFICATION_EVIDENCE_PLAN.md`.

The matching failed-verification recovery readback is now also available as
`sense.openclaw.engineering_tool.recovery_evidence`. It reuses the existing
verification and recovery builders through one bounded handler, keeps failure
previews transient, and records only compact counts and governance flags in the
common invocation/event path. Recovery recommendations remain operator review
only: the capability does not create recovery tasks or approvals, execute or
retry commands, mutate workspaces, or call a provider. The direct Observer
route and its real Core/Observer checks remain the read-model proof. Details are
in `docs/plans/OPENCLAW_NATIVE_ENGINEERING_RECOVERY_EVIDENCE_PLAN.md`.

The existing context-management lane is now also closed through the common
capability runtime. `sense.openclaw.engineering_context.microcompact_evidence`
reuses the bounded transcript/verification/recovery read models, while
`act.openclaw.engineering_context.microcompact_projection` reuses the
caller-owned in-memory projection and its summary-only audit event. Invocation
and event records retain only compact counts and governance flags; neither
capability mutates runtime messages, persisted logs, tasks, approvals, or
provider state. The direct Core/Observer microcompact checks now invoke both
common capabilities. Details are in
`docs/plans/OPENCLAW_NATIVE_ENGINEERING_MICROCOMPACT_EVIDENCE_PLAN.md`.

The existing fixed native plugin-registry refresh lifecycle is now also
available through the common capability runtime as
`sense.openclaw.plugin_runtime.refresh_evidence` and
`act.openclaw.plugin_runtime.refresh_task`. The task bridge requires explicit
confirmation, then reuses the existing pending-approval task and operator-step
owner; it only swaps the validated built-in registry generation. Module import,
plugin code execution, runtime activation, cache mutation, provider egress,
and network access remain disabled. Core and Observer refresh checks exercise
the common evidence path and its confirmation boundary. Details are in
`docs/plans/OPENCLAW_NATIVE_PLUGIN_RUNTIME_REFRESH_TASK_PLAN.md`.

The explicitly approved Engineering Context provider handoff task is now also
available through the common capability runtime as
`act.openclaw.engineering_context.provider_handoff_task`. It accepts only the
bounded DeepSeek request shape, requires both capability approval and
`confirm:true`, and delegates task/approval creation to the existing egress
owner. The persisted task retains only the endpoint/model/credential-reference
and request/context hash binding; it performs no credential read, endpoint
contact, provider call, or network egress. The existing operator step remains
the only execution owner. Observer now exposes a one-shot pending-task control
for this same capability: request text is transient, task approval remains
pending, and the panel returns only compact task/approval/governance evidence.
The real Phase 63 Core check now enters this capability with both
`approved:true` and `confirm:true`, then proves the existing approval and
deferred operator path without exposing the request text or contacting a
provider. Observer's existing Context Source Task ID input is also forwarded
into the same redacted source-task binding when supplied; it does not infer or
mutate a source task.

The first common capability-runtime entry point for the Level 2 trusted
work-view is now available as
`sense.openclaw.engineering_context.work_view_observation`. It reads the
existing session-manager authority and sidecar observation contract, projects
only compact binding/freshness/frame-provenance/semantic-count metadata, and
records the normal policy, invocation, and capability-event evidence. It does
not prepare or bind a task, dispatch an action, or transfer page payloads. The
focused boundary is documented in
`docs/plans/OPENCLAW_NATIVE_ENGINEERING_CAPABILITY_RUNTIME_WORK_VIEW_OBSERVATION_PLAN.md`.

The existing `act.work_view.control` descriptor now has a matching common
runtime handoff for explicit `work_view.prepare`, `work_view.reveal`, and
`work_view.hide` decisions. It maps only to the existing session-manager owner
routes and returns compact status/readback without session ids, leases, URLs,
browser payloads, or page content. Prepare/reveal retain the existing browser
navigation behavior; this is not provider egress and does not create tasks,
approvals, or automatic recovery. The boundary is documented in
`docs/plans/OPENCLAW_NATIVE_ENGINEERING_CAPABILITY_RUNTIME_WORK_VIEW_CONTROL_PLAN.md`.

The local Engineering Context Packet now also has the common capability entry
`sense.openclaw.engineering_context.packet`. Its dedicated route and capability
share one bounded assembly owner for transcript redaction, verification/recovery
protection, work-view and plan/todo selectors, and microcompact projection.
Packet messages remain transient; invocation/event evidence stores summaries only,
and no provider or credential path is added. The boundary is documented in
`docs/plans/OPENCLAW_NATIVE_ENGINEERING_CAPABILITY_RUNTIME_CONTEXT_PACKET_PLAN.md`.

The existing native `cc_edit` exact-match diff proposal is now also available as
the common capability `act.openclaw.engineering_tool.edit_proposal`. It reuses
the workspace-constrained proposal builder and exposes only a transient bounded
diff for review; capability invocation and audit evidence retain hashes and
compact counts, not search/replacement text or diff lines. It does not write,
apply, create a task or approval, execute commands, or call a provider. Apply
continues through the existing approval-gated edit task path. The boundary is
documented in
`docs/plans/OPENCLAW_NATIVE_ENGINEERING_CAPABILITY_RUNTIME_EDIT_PROPOSAL_PLAN.md`.
The existing Observer Edit Proposal panel now also requests that proposal
through the common capability runtime and keeps the diff transient; its
approval-gated apply task remains a separate explicit operator action.

The corresponding native `cc_write` redacted proposal is also available as
`act.openclaw.engineering_tool.write_proposal`. It preserves the existing
workspace/content/overwrite bounds and returns only redacted diff metadata;
content is absent from the response, capability history, and audit events.
It does not write, create a task or approval, execute commands, or call a
provider. Actual write approval and execution remain on the existing
`workspace-text-write-tasks` path. The boundary is documented in
`docs/plans/OPENCLAW_NATIVE_ENGINEERING_CAPABILITY_RUNTIME_WRITE_PROPOSAL_PLAN.md`.
The existing Observer Write Proposal panel now also requests that redacted
proposal through the common capability runtime and keeps proposed content out
of durable evidence; the approval-gated write task remains a separate explicit
operator action.

The existing edit/write execution evidence is now also available through the
common `/capabilities/invoke` runtime as
`sense.openclaw.engineering_tool.edit_execution_evidence` and
`sense.openclaw.engineering_tool.write_execution_evidence`. The bridge reuses
the existing task and filesystem-ledger builders and reads only completed
approved mutation records; invocation and audit events retain compact summaries
without file content, diff lines, replacement text, task creation, approval
actions, or mutation. The real edit closed-loop and write execution milestones
prove this common readback against completed tasks. It is documented in
`docs/plans/OPENCLAW_NATIVE_ENGINEERING_CAPABILITY_RUNTIME_EXECUTION_EVIDENCE_PLAN.md`.

The existing Level 2 engineering-task to trusted work-view bind is now also
available through the common capability runtime as
`act.openclaw.engineering_context.work_view_bind`. It reuses the dedicated
bind operation and task-manager mutation owner, requires explicit confirmation,
revalidates authoritative session/helper state immediately before mutation,
preserves task status, and rejects stale identities unless an explicit rebind
is requested. The common invocation keeps only compact bind status and
governance evidence; no lease, URL, page payload, browser action, task/approval
creation, provider call, or external egress is added. Core and Observer proof
is included in the existing context-packet pair batch. The boundary is
documented in
`docs/plans/OPENCLAW_NATIVE_ENGINEERING_CAPABILITY_RUNTIME_WORK_VIEW_BIND_PLAN.md`.

The declared `sense.screen.observe` capability is now also executable through
the common `/capabilities/invoke` path. It reuses the existing screen-sense
`/screen/current` owner and returns only bounded readiness, structural window/
OCR/frame counts, and trusted work-view status metadata. The descriptor no
longer points at the removed `/screen/state` path. Titles, OCR text, snapshot
text, URLs, session/lease identifiers, visual bytes, semantic target items,
mutation, action dispatch, provider calls, and network egress remain outside
the capability response and invocation history. Details are in
`docs/plans/OPENCLAW_NATIVE_ENGINEERING_CAPABILITY_RUNTIME_SCREEN_OBSERVATION_PLAN.md`.
The existing Observer Body Capabilities panel now provides an explicit
`Invoke Screen Observation` control for this same bounded request. It reuses
the common invocation readback and does not add a second screen owner, expose
raw screen payloads, or grant screen-action authority.

The existing Observer `Refresh Screen State` control now also invokes the
fixed `sense.screen.observe` capability before performing its existing
read-only `/screen/current` panel read. No direct `/screen/refresh` POST,
screen payload exposure, action dispatch, or provider egress is added.

The structured provider recommendation bridge now includes one Level 2
observation action, `observe_current_screen`, bound to that exact Observer
control and `sense.screen.observe`. A reviewed recommendation can therefore
refresh the bounded current work-view summary through an existing operator
control. The client revalidates the control id, capability id, and approval
contract; operator selection remains required, while raw screen payloads,
automatic action dispatch, arbitrary selectors, and provider-driven execution
remain deferred. Evidence stays on the existing recommendation and capability
invoke checks.

The selected Level 1 consistency closures are complete. Do not reopen the LSP
symbol chain or add another evidence/readiness shell; choose the next concrete
identity-upgrade capability only after its Level 2 authority boundary is
explicit.

The next autonomous product route is the smallest real Level 2 trusted AI
work-view/session-helper behavior. Keep helper installation, root/system daemon
work, desktop-wide capture, unapproved provider egress, and arbitrary endpoint
execution deferred until their runtime owner and authority boundary are explicit.

The first Level 2 runtime slice is now active: session-manager owns an in-process
AI work-view helper lease and browser-runtime must echo the same session/lease
before the helper contract reports `active`. Continue by carrying that lease
through existing browser action mediation; do not replace it with another
readiness endpoint.

That action-mediation follow-up is complete for browser input and click:
screen-act derives the current trusted lease, browser-runtime rejects missing or
mismatched leases before mutation, and Observer shows the mediation result.
Operator takeover now suspends the same lease in session-manager and
browser-runtime; explicit resume rotates and rebinds a new lease before actions
continue. The existing approved sidecar lifecycle now starts and stops one
bounded independent user-session process whose current-user socket heartbeat
backs lease readiness. Unexpected exit and heartbeat timeout fail closed by
suspending browser action authority; the same approved lifecycle action
explicitly reconnects a survivor or starts a replacement and rebinds a new
lease, with no automatic restart or reconnect. The Level 2
sidecar now continuously refreshes a bounded browser observation over an
allowlisted loopback-only source, with single-flight polling, sequence, and
fresh/stale state but no retained full payload. Screen-act now requires a fresh
same-session sidecar observation alongside the helper lease after sidecar
lifecycle activation. Bounded browser input/click now travels through the
sidecar socket, rechecks capture/session, and returns through screen-act audit.
Session-manager restart persists only compact lifecycle intent; the sidecar
survives but clears its authority binding and capture, while the new manager
revokes the stale browser lease before listening and reports
`recovery_required`. The existing approved task explicitly reconnects the same
PID under a fresh session lease. Browser-runtime restart recovery is also complete: an
unavailable browser capture source becomes
`recovery_required`, screen-act blocks before dispatch, Observer recommends the
existing prepare action, and a fresh bounded capture restores sidecar IPC
without restarting the helper. A bounded browser navigation/new-tab action is
now complete on the same trusted sidecar transport, with HTTP(S) URL validation,
lease/capture gates, sidecar IPC, browser mutation, refreshed capture, audit,
and an Observer control. Its core planner/task-executor bridge is also complete:
planner and executor use
one production action descriptor, task evidence retains the bounded sidecar
effect, and verification prefers the post-action capture URL over stale session
metadata. The next slice should make an in-flight browser task recover across a
capture-source interruption using the existing recovery loop. That bounded
action-level recovery is now complete: only sidecar capture reasons trigger one
prepare and one retry, and compact interruption/retry evidence is attached to
the task. Active-task continuity across session-manager restart is now complete:
authority dependency loss becomes a persisted recoverable task, explicit
session/sidecar restoration reuses the existing recovery route, and only
unfinished browser plan actions execute through the trusted sidecar. The next
continuity gap is startup reconciliation for a persisted active task after the
core process itself restarts. That exit gate is now complete: startup converts
only persisted running browser plans to recoverable evidence, preserves queued
and paused tasks, and the existing recovery path executes only unfinished work
through the still-running sidecar. The next Level 2 capability should establish
independently supervised user-session sidecar ownership with fail-closed
authority disconnect and explicit fresh-lease reconnect. Do not add horizontal
navigation variants, a readiness-only chain, fault-injection endpoints,
automatic action restart, root/system daemon ownership, or desktop-wide capture.

That independent sidecar slice is now complete. The current-user socket process
survives session-manager restart, clears binding/capture on disconnect, retains
no reconnect lease, and requires the existing approved action to bind a fresh
session. The milestone proves same-PID reconnect and stale-lease rejection. The
next Level 2 reliability gap is explicit replacement after the sidecar process
itself exits unexpectedly; it must reuse the existing lifecycle and must not
auto-start a replacement.

That replacement gap is now complete. Unexpected sidecar exit suspends action
authority, reports recovery without automatic replacement, and the existing
approved lifecycle starts a different PID before capture/actions resume. The
remaining Level 2 runtime-ownership step is a declarative, non-auto-started
`systemd --user` unit path for this same sidecar contract. Do not turn it into a
root service, login auto-start, or a second lifecycle API.

The unit contract is now materialized and evaluated through the existing Nix
body-config milestone: desktop-body defines a hardened
`openclaw-trusted-sidecar@` user unit with no `wantedBy` and `Restart=no`. This
does not yet change runtime ownership. The next real slice is to make the
existing approved lifecycle action launch/stop that fixed user-unit instance,
while retaining direct spawn only as an explicit development fallback and
keeping lease/session values out of the environment file.

That approved launcher bridge is now complete. The session-manager runtime
default uses the fixed `openclaw-trusted-sidecar@primary.service` user unit,
while development must explicitly select the direct-spawn fallback. The
existing lifecycle owns
the mode-0600 environment file, systemd start/stop, deterministic socket bind,
Observer launcher readback, and cleanup. Session, lease, credential, provider,
and browser-runtime URL values never enter the file. The real Phase 3 milestone
materializes the test unit, controls it through `systemctl --user`, proves
restart/replacement/action continuity, and removes both unit and environment
afterward.

This proves user-session ownership, not every Nix deployment topology. The
current Nix body skeleton still launches its main services as system services;
moving session-manager itself into a selected login-user manager, or adding a
separately governed cross-manager bridge, remains deferred. Do not hardcode a
desktop UID or add a root proxy merely to hide that deployment boundary.

The next real Level 2 behavior is bounded browser workspace continuity across a
browser-runtime restart. Preserve only compact AI-owned tab/active-URL/session
intent; restore it fail-closed without a lease or automatic action replay, and
reuse the existing prepare/rebind/recovery and Observer surfaces.

That workspace-continuity behavior is now complete. Browser runtime atomically
persists a bounded, mode-0600 navigation intent and restores tabs/session intent
without running state, PID, lease, input/click data, capture payload, or action
replay. Existing prepare supplies fresh authority, the sidecar reports recovery
status, and the real Phase 3 milestone proves eight tabs survive a process
restart before governed actions continue.

The next product gap is no longer continuity metadata. Browser runtime remains
a simulated in-memory browser with a synthetic PID. The next real Level 2 slice
should put a proven local browser engine behind the current bounded API and
sidecar contract, starting with one user-space profile, one governed HTTP(S)
navigation, and compact real-engine capture. Do not add a readiness endpoint or
broaden into desktop capture.

That real-engine slice is complete. Browser runtime can now launch a
NixOS-managed Firefox through `puppeteer-core`, expose its real PID/title/URL/tab
state, execute existing lease-gated page input/click/new-tab operations, feed
real page metadata through capture and screen-sense, and remove its ephemeral
AI profile on disconnect/shutdown. The targeted milestone uses a loopback page
and the production prepare/lease path; no hidden browser download, external
fixture, root launch, desktop capture, or `--no-sandbox` bypass is involved.

The Level 2 component-ownership gap is now closed. The Nix body partitions
enabled components into exclusive system or login-user ownership, and the
desktop profile places session-manager and browser-runtime in
`systemd.user.services` alongside the sidecar contract. They follow the
graphical session, use per-user state/profile paths, preserve same-scope
ordering, and default to the fixed NixOS Firefox package. Nix evaluation proves
neither component is duplicated in the system manager; no UID, root proxy, or
browser sandbox bypass is used.

The next real Level 2 gap is bounded visual capture of the AI-owned browser
page. The real adapter currently supplies process/page/tab metadata, while the
capture response's readable blocks are still derived from runtime state rather
than a browser pixel frame. Extend the existing capture/trust/Observer lane with
strictly bounded frame acquisition and freshness evidence. Do not capture the
desktop, write arbitrary image paths, add a parallel route, or create another
readiness shell.

That visual-capture gap is now closed through the existing route. Firefox
captures only its active AI-owned page as a fixed `960x540` bounded JPEG;
shared validation enforces dimensions, a 256 KiB ceiling, digest, freshness,
page scope, no desktop capture, and no persistence. Observer receives the
validated data URL, while sidecar polling, task/read-model summaries, and audit
events retain metadata only. The real milestone verifies actual JPEG bytes and
proves persisted events contain no image data.

The next smallest Level 2 behavior is to ground trusted browser actions in that
visual evidence: sidecar metadata capture should produce a fresh frame digest
and sequence before dispatch, action evidence should link that compact
provenance, and post-action capture should advance it. Keep image bytes out of
sidecar state, task evidence, and logs; do not add another endpoint or readiness
wrapper.

That grounding behavior is now complete. Real-engine sidecar observations
carry only fresh frame digest/sequence metadata; trusted actions bind compact
pre/post frame references, force post-mutation refresh, survive concurrent
capture invalidation, and propagate through screen-act plus autonomous task
evidence without image data. Simulated mode remains an explicit non-grounded
fallback. The real milestone proves both operator and autonomous navigation
change the observed frame and URL.

The next smallest Level 2 capability is a bounded read-only semantic target
inventory for the active AI-owned page, linked to the current visual frame.
Expose only visible interactive role/name/bounds metadata with hard limits and
no form values or mutation through the existing capture/screen/Observer lane.
Do not jump directly to arbitrary selectors, page-script execution, or another
readiness endpoint.

That inventory is now complete. The real Firefox path exposes at most 64
visible interactive targets with bounded names and viewport-clamped bounds,
ties target ids plus an inventory digest to the current visual frame, and keeps
values, selectors, arbitrary page script, mutation, desktop capture, and
persistence absent. Full items remain in current browser/screen/Observer
readback; sidecar, task, summary, metadata, and audit paths retain only compact
inventory evidence. The existing capture and Phase 3 milestones prove the real
fixture behavior and unchanged lease/recovery controls.

The next smallest Level 2 capability is governed semantic target action through
the existing trusted action lane. Resolve only a frame-scoped `targetId`, bind
the request to the matching frame and inventory digest, reject stale evidence,
and prove the post-action frame. Do not accept CSS/XPath selectors or arbitrary
page scripts, and do not add a parallel endpoint or readiness chain.

That first governed action is now complete for semantic click. The existing
mouse-click route accepts a normalized click-only target reference, resolves it
against the current browser-owned inventory, derives coordinates internally,
and rejects stale frame/inventory evidence. Sidecar mediation retains compact
semantic effect plus pre/post visual grounding, and Observer shows the result.
The real Firefox milestone proves navigation by target id and fail-closed reuse
of the old reference; Phase 3 recovery and takeover checks remain unchanged.

The next smallest Level 2 capability is autonomous semantic target selection
inside core after its initial screen observation. Build the current reference
at dispatch time and reuse the existing mouse-click/task evidence path. Do not
add another endpoint, selector surface, or action family. Semantic typing stays
deferred until input content no longer appears in public browser state or audit
events.

That autonomous selection is now complete. `browser.semantic_click` stores
bounded exact-name/optional-role intent, core materializes one unique current
target after initial observation, and capture recovery rematerializes after its
single prepare retry. Before dispatch, sidecar refreshes capture and requires
the target reference, inventory digest, and visual-grounding frame to match.
The real Firefox milestone proves autonomous selection, click, task evidence,
post-frame advance, and expected navigation.

The provider-to-action continuity bridge is documented in
`docs/plans/OPENCLAW_NATIVE_ENGINEERING_PROVIDER_RECOMMENDATION_SEMANTIC_TASK_LINK_PLAN.md`.
It carries only compact provenance from one completed approved provider
recommendation through an explicit Observer review into the existing queued
semantic-click planner. Core revalidates the completed provider source task and
fixed control contract; provider response content, target coordinates,
selectors, page scripts, credentials, and automatic execution remain outside
the bridge.

The trusted work-view readiness decision is now consumed by that same Core
handoff. Before the existing `screen-act` route is called, Core re-reads the
session-manager state and requires the task binding, active lease, fresh
readiness snapshot, screen inventory, and visual frame to be self-consistent
with the materialized reference. A newer screen frame is not rejected merely
because the session-manager cache has not advanced to the same sequence; the
existing sidecar is the dispatch-time owner and revalidates the current
reference, lease, capture, and grounding. Stale or cross-source-mismatched
evidence fails the task and suppresses automatic recovery; no second route or
action family was added.

The next smallest Level 2 capability is write-only semantic text input. Remove
legacy plaintext input echoes from browser state, summaries, action/task
evidence, and audit events first; retain only bounded length/redaction
evidence. Then reuse the same current-target selection, sidecar refresh, lease,
visual grounding, and Observer path for one semantic type operation without
persisting or reading back the value.

The plaintext-removal prerequisite is now complete. Inputs are bounded to 2,000
characters and all browser/screen/Observer/event/task/recovery/persistence
readbacks retain only count/truncation and negative exposure evidence. Core
state persistence strips action text; an active task restored without its
transient value becomes `input_reentry_required` and cannot replay. Existing
core, Observer, recovery, and real Firefox milestones prove the new contract.

The next smallest Level 2 capability is frame-bound semantic type through the
existing keyboard route. Select one current enabled textbox after observation,
carry text only in the execution request, revalidate the same inventory/frame
at sidecar and browser-runtime, and return write-only input evidence with
pre/post visual grounding. Do not add selectors, a parallel route, text
persistence, or readback of the typed value.

That semantic type capability is now complete. Core selects the current
textbox after observation, the transient execution value never enters the
plan, sidecar and browser-runtime validate the same frame-bound authority, and
the existing keyboard route returns only semantic effect, input evidence, and
pre/post visual grounding. Real Firefox, Observer, persistence, recovery, and
Phase 3 checks pass. The current bounded Level 2 browser eye-hand exit gate is
closed; do not grow more horizontal action variants.

The next active route is the kernel evolution whitepaper's Phase A Nix purity
gap. Start with one real cohesive service closure packaged into `/nix/store`
and make its generated unit execute from that read-only derivation instead of
mutable `/opt/openclaw`. Preserve user-session ownership, runtime state/log
paths, public routes, and real milestones. Do not introduce root hostd, D-Bus,
eBPF, or broad all-service migration until this first packaging proof works.

That first packaging proof is now complete for event-hub. Its minimal closure
contains only four runtime files, the generated unit executes from a read-only
store WorkingDirectory, and the body-config milestone starts the store process
and proves health plus audit event write/read against a separate state path.
The other eight services remain explicitly mutable-repo backed.

The next Phase A slice is the second concrete closure, screen-sense. Package its
exact shared-events/shared-utils imports, preserve system ownership and upstream
contracts, evaluate the unit, and prove a real screen readback from the store
path. Only then consider a small packaging helper based on demonstrated
duplication.

That second closure is now complete. Screen-sense contains exactly 10 runtime
files, its generated system unit points into the store, and a real packaged
process produces browser-backed `/screen/current` readback against bounded
loopback upstreams. With two matching derivations, the common fileset install
mechanism now lives in a small helper while both service runtime manifests stay
explicit. Phase A is 2/9 services at this checkpoint, not complete.

The next closure is screen-act. Preserve its current ownership and upstream
URLs, include only its mediation module plus exact shared imports, and prove one
real lease-mediated action from the store path without exposing input payloads.

That third closure is now complete. Screen-act contains exactly 11 runtime
files, its generated system unit points into the store, and a real packaged
process performs a trusted lease-mediated browser input action against bounded
loopback upstreams. Only write-only input evidence is retained; plaintext does
not enter the response or action state. Phase A is 3/9 services, not complete.

The next closure is system-heal. Preserve its system ownership, event-hub and
system-sense URLs, and writable state path while proving representative
persisted diagnosis or simulated maintenance behavior from the read-only store
source. Defer the broader system-sense closure to its own explicit slice.

That fourth closure is now complete. System-heal contains exactly seven runtime
files, its generated system unit points into the store, and a real packaged
process persists a conservative simulated diagnosis to a separate writable
state file and restores it after process restart. No real repair executes.
Phase A is 4/9 services, not complete.

The next closure is system-sense. Its larger explicit runtime manifest must
cover the current body, health, file, command, and systemd modules while the
representative packaging proof remains read-only and non-privileged.

That fifth closure is now complete. System-sense contains exactly 19 runtime
files, its generated system unit points into the store, and a real packaged
process returns Linux body/resource state after sampling seven bounded loopback
service targets. The proof invokes no command, file-write, systemd, or repair
route and performs no host mutation. Phase A is 5/9 services, not complete.

The next closure is session-manager. Preserve login-user ownership, writable
recovery state, and trusted sidecar lifecycle contracts while proving session
state behavior without starting an unapproved helper process.

That sixth closure is now complete. Session-manager contains exactly 14 runtime
files, its generated login-user unit points into the store and keeps recovery
intent under `%S/openclaw`, and a real packaged process creates an authoritative
Level 2 session while remaining fail-closed at `awaiting_browser`. No external
sidecar or recovery intent is started automatically. Phase A is 6/9 services,
not complete.

The next closure is observer-ui. Package its runtime client composition and
served assets without npm runtime dependencies, preserve upstream contracts,
and prove real HTML/client responses from the store.

That seventh closure is now complete. Observer-ui contains exactly 49 runtime
files, its generated system unit points into the store, and a real packaged
process serves the complete HTML/client composition with engineering-loop DOM
evidence. The shared source-closure helper now supports reviewed app roots
without copying whole source directories. Phase A is 7/9 services, not complete.

The next closure is browser-runtime. Its Puppeteer dependencies must be a
reproducible Nix closure with downloads disabled, while login-user ownership,
the Nix-managed Firefox executable, and real browser behavior remain intact.

That eighth closure is now complete. Browser-runtime has a lockfile-pinned
production Puppeteer closure beside 13 explicit runtime source files, its
generated login-user unit points into the store, and a real packaged process
proves bounded open plus fail-closed workspace restoration. The heavyweight
real Firefox launch remains in its dedicated browser/release gate rather than
the normal package iteration loop. Phase A is 8/9 services, not complete.

The final Phase A closure is core. Package its 148 runtime modules and exact
shared imports without tests/artifacts, preserve writable control-plane state,
and prove representative persisted behavior from the store.

That final closure is now complete. Core contains exactly 148 runtime modules
and 164 files across its exact store closure, its generated system unit points
into the store, and a real packaged process
persists and restores an unexecuted queued task. The trusted sidecar template
also runs from the session-manager store closure. Phase A is complete at 9/9
services with no default desktop-body process WorkingDirectory under
`/opt/openclaw`.

The active route now advances to kernel-whitepaper Phase B through
`docs/plans/OPENCLAW_DBUS_NATIVE_SYSTEMD_CONTROL_PLAN.md`. Start with native
read-only systemd unit inventory behind the existing system-sense/Observer
contract. Do not add privileged mutation, hostd, Polkit, or a readiness shell.

That first Phase B slice is now complete. System-sense reads the nine fixed
OpenClaw unit records through native systemd D-Bus from its lockfile-pinned Nix
store closure, exposes only an eight-property inventory allowlist, and reports
the transport through the existing route and Observer panel. VM milestones
prove a real `loaded/active/running` core unit and no command evidence. The
temporary read-only `systemctl` fallback has been removed; bus failure is
fail-closed. This first inventory slice intentionally excluded privileged
mutation; the separately governed fixed hostd restart is recorded below.

The second fixed Phase B slice is now proven in the switched VM generation. Its
owner-separation follow-up makes desktop system services run under
`openclaw-service`, gives the fixed store-native hostd its independent
`openclaw-hostd` service account and Polkit subject, and keeps core submission
on the shared `openclaw` socket group. The new core and Observer real-execution
checks both completed through that account combination. The response keeps the
kernel-level peer credential verification explicit: hostd now passes each
accepted socket FD to a fixed Nix-native `SO_PEERCRED` helper, matches only
`openclaw-service` with the `openclaw` group, and rejects the fixed mutation
before the D-Bus handler on mismatch or unavailable verification.
Core reaches hostd only through its bounded Unix socket, reuses the existing
approved next-repair lifecycle, and has no direct systemctl/sudo fallback. The
switched generation removed the historical host sudo helper. Core and Observer
real-execution milestones prove exit zero, D-Bus job paths, changed PIDs,
restored health, and no password prompt.
Post-verification now derives restored health from the selected unit's native
inventory state and helper PID evidence; failures recommend operator-reviewed
declarative-generation recovery and never issue an automatic second restart.
It uses a bounded read-only readiness poll because systemd process readiness can
precede the restarted service's HTTP-listener readiness. Hostd rejects unknown
fields, arbitrary units/methods, and response evidence whose request id is not
bound to the originating core request; core also requires the compact matching
peer-identity evidence. Broader systemd mutation remains deferred.

The next bounded Phase B operator gap is now closed on the existing systemd
dependency-map route. System-sense reads only the allowlisted live
`org.freedesktop.systemd1.Unit.After` property through native D-Bus and keeps
only edges between the fixed OpenClaw service inventory. The response separates
declarative `serviceSpecs.after` edges from observed `observedEdges`, reports
compact dependency drift, and Observer renders the evidence. Bus failure leaves
the live dependency fields unavailable without command fallback. No hostd
operation, approval, task, mutation, arbitrary unit, or new route was added.
The next Phase B capability still requires a separate operator justification
behind the existing fixed hostd owner.

The same inventory now also carries the Nix-declared manager scope for each
unit. It distinguishes a system unit observed on the system bus, a user-owned
unit intentionally not observed there, an unexpected system copy, and an
actual system-bus observation failure. The existing Observer inventory renders
compact matched/mismatch/unresolved scope counts. This remains read-only and
does not add a user-bus proxy, hostd capability, approval, task, or mutation.

That separately justified Phase B capability is now implemented and locally
proven for one concrete operator gap: the foundational
`openclaw-event-hub.service` can be selected in the existing approved
next-repair task and is bound to the same descriptor-bound `openclaw-hostd`
socket as system-sense. Core re-reads native inventory before task creation,
hostd accepts only the fixed descriptor operation/unit pairs, and Nix expands the
descriptor into exact Polkit rules. Focused tests and generated closure checks
prove this contract; the switched VM has real system-sense execution evidence,
and the 2026-07-17 switched generation now proves the event-hub mutation through
both the Core and Observer real-execution checks. Core verified a changed PID
from `191346` to `191587`; Observer verified a second changed PID from `191587`
to `191671`. Both checks required explicit approval and Operator Step/Run,
reported `openclaw-hostd` with `dbus_native` and
`org.freedesktop.systemd1.Manager.RestartUnit`, and completed restored-health
verification. Unknown units, automatic restart, arbitrary D-Bus arguments, and
direct command fallback remain blocked.

The next separately justified hostd capability is now the fixed
`openclaw-system-heal.service` recovery target. It is a declared system-owned
body service downstream of event-hub and system-sense; the existing native
inventory, approval, Operator Step/Run, hostd, and post-verification lifecycle
now accepts its descriptor-bound target. The system-heal owner's maintenance
operations remain simulated, while the 2026-07-17 switched generation now
proves its fixed restart through both Core and Observer. Core verified PID
`191453 -> 196563`; Observer verified `196563 -> 196638`, with
`hostd.restart_system_heal`, native D-Bus, and restored-health evidence.

The Level 1 live-plugin-refresh migration now owns a real fixed-registry
generation lifecycle. An approved existing refresh task builds and validates a
new built-in registry generation, atomically swaps the shared native plugin
plan owner, retains the previous generation, and causes later capability plans
to report the active generation id, sequence, and hash. Compact active and
previous generation metadata now persists in core runtime state and is
rehydrated after a core restart only when its hash matches the current fixed
registry. It still performs no arbitrary module discovery/import, plugin code
execution, loader-cache invalidation, provider egress, or automatic rollback.
Do not expand this into another readiness chain.

The existing operator stop control now also closes the trusted work-view action
authority before marking a session-bound task failed. It reuses the existing
session-manager suspend route, records only compact revoked-state evidence on
the task, and fails closed if the authority cannot be confirmed revoked. Tasks
without a trusted work-view session keep the existing local stop behavior. This
closes an operator-visible stop boundary without adding a route, sidecar,
automatic restart, or new permission surface.
Observer task history now renders the compact revoked/authority state from that
outcome so the stop result is visible after refresh as well as in the API
response.
All operator authority transitions now include the task's bound work-view
session id when one exists. Session-manager rejects stale-session suspend or
resume requests before mutating the current lease, keeping the current session
active and non-degraded on that mismatch.
When an attached task is stopped successfully, its outcome also carries the
existing compact work-view recovery evidence with an `operator_stop` stage and
the recommendation to restore/rebind the trusted work view before recovery.
The recovery task receives that provenance without the session lease id and
does not restart or replay the task automatically; the existing Observer task
history path renders the same recovery recommendation after refresh.

## Completed Phase C Slice

The first bounded kernel-whitepaper eBPF process-execution observation is
complete and documented in
`docs/plans/OPENCLAW_PHASE_C_KERNEL_PROCESS_EXEC_PLAN.md`. Store-native
system-sense attaches only the raw `sched_process_exec` tracepoint through a
libbpf ring buffer and returns raw `timestampNs`, `pid`, `uid`, and `comm`
fields plus a separate bounded executable-identity readback; raw attachment
avoids granting the service broad tracefs read access.
The capability is opt-in in the Nix body module; the desktop profile grants
only `CAP_BPF` and `CAP_PERFMON` plus the required `LimitMEMLOCK=infinity`
resource limit to the non-root system-sense service when it is enabled. The
existing core system-sense proxy and Observer expose the bounded read model and
explicit permission/unavailable states.

This slice deliberately does not capture command lines, paths, file content,
environment, or network traffic; it does not persist events, enforce policy,
block processes, mutate the host, expand hostd, or start declarative Nix
self-evolution.

The first concrete operator gap is now closed on the same route: each bounded
capture also returns a deterministic in-memory readback summary with unique
comm/PID/UID counts, a fixed 16-entry command-count bound, timestamp endpoints,
capture window, event limit, and explicit non-persistence. Observer renders the
summary alongside the raw four-field events. This is not an event ledger and it
does not survive restart. Select the next eBPF-adjacent capability from a
specific operator need exposed by this readback before adding another event
class.

The continuity refinement is also complete on the same route. Successful
captures receive a sequence and activity state plus a bounded list of newly
seen comm names; disabled, busy, and failed captures report continuity as
unavailable without changing the last successful baseline. This remains
in-memory only and is not a process event ledger. Continue from an explicit
operator need shown by this continuity evidence before adding another event
class.

The final concrete operator gap in this slice was executable identity ambiguity. A `comm` value
can be truncated or shared by unrelated binaries, so the same raw capture now
derives a separate `openclaw-kernel-process-exec-executable-identity-v0`
readback. The raw tracepoint uses CO-RE to read only
`linux_binprm.filename`, limits each filename to 255 bytes, returns at most 16
identity entries, and keeps the values in the current response only. The
existing four-field raw event contract remains unchanged. No `/proc` lookup,
command-line, environment, arbitrary VFS path, file-content, network, policy,
or persistence capability is introduced.

Phase C is now closed for this operator loop. The switched core and Observer
milestones pass, full `body-config` passes, and the running system-sense service
returns the bounded executable identity readback. Do not add another eBPF event
kind or a second readiness chain without a new operator need demonstrated by
the current capture evidence. The next capability must be selected from a
concrete user-visible gap and must preserve the existing local-first,
non-persistent, policy-deferred boundary.

The first demonstrated Level 2 work-view gap is now closed through the
existing Engineering Context Packet action. An explicit `includeWorkView`
request reads session-manager's authoritative `/work-view/state` and returns
`openclaw-native-engineering-work-view-association-v0` with compact task
binding, helper authority, and recovery status. It does not expose lease ids,
active URLs, capture payloads, automatic binding, action dispatch, provider
content, or external egress. Observer renders the association beside the
packet, and unavailable session-manager state fails closed without inventing a
binding.

The resulting unbound-task workflow is now closed by one explicit
operator-reviewed bind action at
`/plugins/native-adapter/engineering-context/work-view/bind`. It re-reads
authoritative session-manager state, preserves the task status, rejects stale
session/work-view identity, and does not dispatch work. The existing context
packet milestone proves the real local route and Observer control. Do not
infer another browser action variant or create another Level 1
readiness/evidence-only shell from historical plan text; preserve the existing
provider, root, desktop-wide capture, and arbitrary endpoint execution
boundaries.

The next concrete operator gap was the recovery decision shown by that same
readback: a divergent or inactive trusted helper recommends the existing
`prepare_work_view` action, but the context packet panel previously exposed only
status. The panel now renders that recovery action and, only for the exact
allowlisted recommendation, bridges to the existing reviewed Prepare Work View
control before rebuilding the packet. A follow-up readback after preparation
can recommend `reveal_work_view` because the AI work view is prepared but
hidden; the same panel now exposes a contextual Reveal Trusted Work View
control through the existing action runner. Both controls revalidate current
state, do not rebind tasks or replay actions, and do not create a new endpoint
or automatic recovery path. If a selected task retains an old session binding
after that recovery, the same packet Bind control now becomes an explicit
`Rebind Task to Work View` action; it requires `confirm:true` plus
`rebind:true`, revalidates fresh authority, preserves task execution state, and
does not replay the task. The same packet can now explicitly request the bounded
work-view observation bridge, which reports capture freshness, frame
provenance, and semantic-target counts without transferring page URLs, pixels,
page text, target items, input values, or selectors. Use that metadata to close
a demonstrated operator decision before adding another Level 2 action.
The packet can likewise request the existing bounded plan/todo workbench
summary and guidance-only next action; that context remains read-only and does
not create or execute a task.

The concrete cross-task context gap is now closed locally as well. The
Engineering Context Packet route accepts an optional `sourceTaskId` separate
from the packet caller's `taskId`, requires that source task to exist, and
uses it for transcript, verification, recovery, work-view, and plan/todo
evidence. Observer exposes the source-task input, effective source readback,
and an explicit Task Detail shortcut. The source remains read-only and packet
assembly still performs no task mutation, approval, command execution,
provider call, credential read, or network egress. Do not infer sources
automatically or reopen the provider handoff lane for this UI improvement.

The LSP selected-target route now also closes its concrete Observer ergonomics
gap. Completed symbol responses can expose up to eight bounded URI/range target
descriptors, while the existing core read bridge and edit-proposal seed already
accept `targetIndex`. Observer now gives the operator an explicit option menu to
choose one target before either existing control runs and passes that index
through the existing workspace-constrained routes. Selection is page-local and
read-only; it does not mutate task state, send another JSON-RPC request, create a
task or approval, or execute a patch. Keep the LSP loop closed unless a new
operator need demonstrates that this bounded selection is insufficient.

The existing selected-target read control is now also routed through the common
capability runtime as
`sense.openclaw.engineering_tool.lsp_selected_target_read_bridge`. It reuses
the same completed-target builder and keeps the read preview transient while
policy, invocation, and audit evidence retain only bounded target/read metadata
and negative authority flags. This closes a declared/runtime boundary without
reopening symbol requests, starting another LSP process, creating tasks or
approvals, mutating the workspace, or enabling provider/network egress.

The existing native engineering tool surface inventory is now also available
through the common capability runtime as
`sense.openclaw.engineering_tool_surface_inventory`. It reuses the dedicated
metadata builder and records only bounded contract counts, source-index status,
and negative authority flags in the common invocation/audit path. Source bodies,
enhanced-source execution, LSP startup, tasks, approvals, writes, provider
calls, and network egress remain outside the capability.

The existing ACPX/Codex compatibility and session-metadata read model is now
also available through the common capability runtime as
`sense.openclaw.acpx_codex_bridge.compatibility`. It reuses the native builder,
records normal policy/invocation/event evidence, and keeps session metadata
transient while summaries retain only counts and governance flags. It adds no
credential access, wrapper mutation, process spawn, provider call, or network
egress. Live ACPX/Codex execution remains an explicit operator-authorization
boundary.

The existing search/web adapter contract is now also available through the
common capability runtime as
`plan.openclaw.plugin_search_web_adapter_contract`. It reuses the existing
manifest-derived builder and records only bounded provider/check counts and
negative governance flags in invocation history. The Observer contract panel
uses this path; network access, provider execution, plugin import, runtime
activation, task creation, and approval creation remain disabled.

The existing prompt-semantics work-standards profile is now also declared in the
common capability runtime as `sense.openclaw.prompt_pack`. It reuses the bounded
prompt builder, exposes only file/check counts and work-standards status in the
invocation summary, and explicitly records no prompt-content exposure, prompt or
tool execution, mutation, task/approval creation, provider call, or network use.
Core and Observer capability-invoke checks exercise this path against a local
fixture. The detailed boundary is documented in
`docs/plans/OPENCLAW_NATIVE_ENGINEERING_CAPABILITY_RUNTIME_PROMPT_STANDARDS_PLAN.md`.

The existing source-derived workspace edit target selection is now also
declared in the common capability runtime as
`sense.openclaw.workspace_edit_target_select`. It reuses the direct bounded
selection builder, records only registry/scope/candidate/selection metadata and
explicit negative authority flags, and keeps source bodies, mutation,
task/approval creation, plugin execution, runtime activation, provider calls,
and network use outside the invocation summary. The existing Core and Observer
target-selection checks invoke this capability against the same fixture. This
closes a declared-versus-runtime contract gap; it is not a new edit or
approval path. Details are in
`docs/plans/OPENCLAW_NATIVE_ENGINEERING_CAPABILITY_RUNTIME_WORKSPACE_EDIT_TARGET_SELECTION_PLAN.md`.

The adjacent declared/runtime gap for the existing mutation owners is now also
closed. `act.openclaw.workspace_text_write` and
`act.openclaw.workspace_patch_apply` are available through the common
`/capabilities/invoke` path and delegate to the existing approval-gated
`workspaceOps` task builders. Capability policy approval and `confirm:true` are
both required; the common response may carry only transient task/approval and
diff-preview data, while invocation history and audit events keep compact
metadata without content, replacement text, or full diffs. Core and Observer
capability-invoke checks prove the unconfirmed block and approved pending-task
contracts. This is a Level 1 contract closure, not a new write executor or
automatic approval path. Details are in
`docs/plans/OPENCLAW_NATIVE_ENGINEERING_CAPABILITY_RUNTIME_WORKSPACE_MUTATIONS_PLAN.md`.

The next declared/runtime gap is now also closed for one concrete Level 2
operator action. `act.browser.open` accepts only an explicit
`browser.new_tab` operation through the common capability runtime and delegates
to the existing screen-act owner. Screen-act still owns fresh capture, trusted
lease, sidecar mediation, browser navigation, and visual grounding; invocation
evidence retains no URL or browser payload. Observer's existing Open New Tab
control uses the same path. This does not create a task, approval, automatic
dispatch, selector surface, page-script authority, or generic action proxy.
The boundary is documented in
`docs/plans/OPENCLAW_NATIVE_ENGINEERING_CAPABILITY_RUNTIME_BROWSER_ACTION_PLAN.md`.

The adjacent declared/runtime gap for the existing screen-act pointer/keyboard
owner is also closed for two explicit Level 2 actions. `act.screen.pointer_keyboard`
accepts only bounded `keyboard.type` and left-button `mouse.click` operations
through the common capability runtime; Observer's existing Simulate Type and
Simulate Click controls use the same path. Input remains write-only and
transient, click coordinates are bounded, and invocation evidence retains no
input value, coordinates, selector, page payload, or visual bytes. Hotkeys,
semantic targets, page scripts, automatic dispatch, and generic keyboard/mouse
proxies remain deferred. The boundary is documented in
`docs/plans/OPENCLAW_NATIVE_ENGINEERING_CAPABILITY_RUNTIME_SCREEN_ACTION_PLAN.md`.

The existing Observer system-heal controls now also use the common capability
runtime. `act.system.heal` receives only the explicit simulated
`heal.restart-service` and `heal.maintenance.tick` operations from the UI, so
Core policy evaluation, invocation history, and capability events cover the
actions without adding a new owner. The service continues to record simulated
outcomes only; real systemd restart/autofix remains on the separate approved
hostd/D-Bus path. The boundary is documented in
`docs/plans/OPENCLAW_NATIVE_ENGINEERING_CAPABILITY_RUNTIME_SYSTEM_HEAL_PLAN.md`.

The existing Observer work-view controls now likewise use the governed
`act.work_view.control` bridge. Prepare, reveal, hide, recovery recommendation,
and task-launch mutations send only the three allowlisted operations through
Core; task launch performs one separate read-only session-manager state read
after reveal so the existing task binding can retain owner metadata. The served
client no longer mutates session-manager directly, and observation still never
triggers recovery automatically. The existing work-view control plan records
this UI closure.

The Observer Engineering Context Packet and Work-View Bind controls now also
use their existing common capability owners. Packet assembly unwraps only the
transient bounded result from `sense.openclaw.engineering_context.packet`, while
bind sends `taskId`, `confirm:true`, and the explicit `rebind` decision through
`act.openclaw.engineering_context.work_view_bind`; no packet content is persisted
and no task execution or provider handoff is triggered automatically.

The Observer LSP Evidence / Lifecycle / Source / Symbol panel now also refreshes
its existing evidence and proposal builders through the common capability
runtime as `sense.openclaw.engineering_tool.lsp_evidence`,
`plan.openclaw.engineering_tool.lsp_lifecycle`,
`plan.openclaw.engineering_tool.lsp_source_transfer`, and
`plan.openclaw.engineering_tool.lsp_symbol_request`. Source previews remain
transient and capability summaries/events retain only compact metadata; LSP task
creation, approval, operator execution, selected-target reads/edits, and
short-lived process requests remain on their existing explicit governed paths.
The boundary is documented in
`OPENCLAW_NATIVE_ENGINEERING_CAPABILITY_RUNTIME_LSP_READ_PROPOSALS_PLAN.md`.

The existing Observer Write Execution Evidence panel now also requests
`sense.openclaw.engineering_tool.write_execution_evidence` through the common
capability runtime. It unwraps only the transient completed-task/ledger result;
the dedicated route remains the detailed read-model owner, while task creation,
approval, operator execution, and filesystem mutation remain explicit and
approval-gated.

The existing Observer Edit Target Selection panel now also requests
`sense.openclaw.workspace_edit_target_select` through the common capability
runtime. It unwraps only bounded selected-target metadata; proposal creation,
approval, patch execution, plugin execution, runtime activation, provider use,
and mutation remain separate explicit paths.

The existing Observer workspace semantic-index and symbol-lookup panels now
also refresh through their declared common capabilities:
`sense.openclaw.workspace_semantic_index` and
`sense.openclaw.workspace_symbol_lookup`. Their derived results remain
transient; the common runtime records only bounded audit/invocation summaries.
This closes the Level 1 navigation boundary and stops here; it does not add
another LSP request, generic tool dispatcher, task, approval, mutation,
provider call, or network path.

## Completed Phase D Candidate, Staging, Health-Gate, Activation-Decision, And Controlled Activation Contract

The first real Phase D declarative-evolution capability is complete. Core
accepts only structured allowlisted changes, generates a transient
`/etc/nixos/openclaw-managed.nix` candidate, and validates the generated module
with `nix-instantiate`. The common capability is
`plan.openclaw.declarative_evolution.managed_config_candidate`.

The approval-bound staging loop is now also complete through
`act.openclaw.declarative_evolution.staging_task`. After explicit confirmation
and approval, Core rebuilds the candidate from structured changes, requires the
same SHA-256 hash, writes the exact body to an OpenClaw-owned staging directory,
and runs read-only `nix-instantiate`, `nix eval`, and no-link `nix build` checks
when the explicit materialization lane is selected. Task, approval, state, and
event evidence retain only compact hash/path, validation, evaluation, build,
and governance metadata; the candidate body is not persisted in the public
evidence surfaces. The Core and Observer milestone pair proves the default
dry-run path with no materialization to keep daily validation bounded; the
explicit no-link lane is reserved for a resource-bounded positive closure
receipt proof.

This slice still does not write `/etc/nixos`, run `nixos-rebuild`, switch a
generation, execute rollback, read credentials, call a provider, or use network
egress.

The read-only health-gate assessment is now complete through
`sense.openclaw.declarative_evolution.health_gate` and
`GET /plugins/native-adapter/declarative-evolution/health-gate?taskId=...`.
After a completed staging task it re-reads the exact OpenClaw-owned staging
file, recomputes its SHA-256 and byte count, verifies candidate/approval/
execution hash bindings, and binds the evaluated `/nix/store/...` to the
staging execution evidence. It reports `eligible_for_activation_review` only
when every check passes. It explicitly reports `hostHealth=not_assessed` and
does not write managed configuration, switch generations, activate a system,
or execute rollback. The Core and Observer staging checks prove this path with
real services and no candidate-text exposure.

The explicit activation-decision and host-health boundary is now complete
through `act.openclaw.declarative_evolution.activation_decision`,
`GET /plugins/native-adapter/declarative-evolution/activation-decision?taskId=...`,
and `POST /plugins/native-adapter/declarative-evolution/activation-decisions`.
Core passes the raw read-only `openclaw-system-sense:/system/health` evidence
through the Core-owned `openclaw-native-declarative-evolution-host-health-oracle-v0`.
That oracle independently evaluates freshness, service completeness, service
state, alerts, and network state; it does not trust a source-provided health
status. It requires a healthy host for an approval of future activation and binds the staging task, candidate hash,
staged-file hash, closure-integrity receipt, evaluated output/deriver/NAR
metadata, and host-health hash. The approved task
revalidates every binding before recording `approved_for_future_activation` or
`rejected`; a changed health fingerprint fails closed. The Core and Observer
staging milestone pair proves the served panel, confirmation gate, real
approval, revalidation, and zero activation.

The authority split is explicit in both review and post-action readback: the
Core host-health oracle owns health assessment, fixed `openclaw-hostd` owns
activation, and `deferred_manual_operator` owns rollback. The oracle is an
independent decision module inside the Core control plane, not a separate
privileged daemon; process isolation and physical generation rehearsal remain
deferred. The current workspace is a physical host, not a VM; no VM-only
acceptance step may be treated as an available prerequisite.

The activation executor now records bounded manual rollback evidence when a
validated hostd receipt shows a generation switch but the independent
post-activation health result is degraded or unavailable. That evidence binds
the activation receipt and pre/post health hashes and recommends operator
review; it never creates a task or approval, calls hostd again, executes
rollback, or enables automatic recovery.

This remains a decision boundary, not physical activation. It does not write
`/etc/nixos`, run `nixos-rebuild`, switch a generation, activate a system, or
roll back. Before that Level 3 bridge, the control plane must pass the
operator-identity boundary below.

The Level 3 controlled activation contract is now implemented behind the fixed
hostd boundary. `POST
/plugins/native-adapter/declarative-evolution/activation-tasks` and
`act.openclaw.declarative_evolution.activation` accept only a completed approved
activation decision and bind the candidate hash, staged-file hash, fixed
staging path, evaluated closure, pre-activation health hash, task lineage, and
bounded expiry. The activation executor revalidates the binding, requires the
generic `planId + stepId + requestHash` approval contract, calls hostd through
the peer-verified Unix socket, validates the immutable receipt, and reads
post-action health through the Core-owned host-health oracle; rollback remains
manual-only.

Hostd exposes only `hostd.activate_managed_config`, fixed to
`/etc/nixos/openclaw-managed.nix` and a configured flake rebuild command.
`OPENCLAW_HOSTD_ACTIVATION_ENABLED=false` remains the default. The Core and
Observer Phase D pair proves the zero-confirmation path creates no activation
task or approval and performs no hostd call, managed-config write, generation
switch, or rollback. This is a controlled activation contract, not evidence
that a host generation has already been switched.

The closure-integrity receipt contract and fail-closed daily lane are now
implemented and positively proven: when a real output exists, every health-gate
review re-queries it through `nix path-info`, reads the current staging approval
record, and emits a task-bound receipt binding candidate and staged-file hashes
to the output path, deriver, NAR hash, and approval fingerprint. The receipt
identity and issue time are stable for that completed staging task, so approval
and execution revalidation compare the same receipt binding. Decision and
controlled activation bindings carry and revalidate the receipt hash.

On NixOS, the explicit positive lane uses the installed read-only `nixos`
channel when available and records that source in evaluation evidence; this
avoids rebuilding the pinned `26.11` flake closure when the deployed host is
`26.05`. The local-channel `nix build --no-link --print-out-paths` proof,
real closure receipt, healthy-host review, approved future activation decision,
and Core/Observer checks now pass. The pinned flake remains the default outside
that host optimization and its cold materialization remains a long-running
resource check. No lane writes `/etc/nixos`, switches a generation, activates a
system, or rolls back. The local manual rollback evidence contract is complete;
the next real slice is a physical-host-safe activation/health-failure rehearsal
using injected receipt/oracle inputs through the existing user-space boundary.
It must not connect to real hostd, write `/etc/nixos`, run `nixos-rebuild`,
switch a generation, or execute rollback. Do not turn a future disposable-VM
release gate into a current workspace assumption or add another generic
readiness wrapper.

## Operator Identity And Mutation Boundary Checkpoint

The first operator-identity slice is now implemented as a Level 1 control-plane
boundary. Core requires an operator token for every mutation route, validates a
configured browser `Origin`, and derives the approval actor from the
authenticated server-side identity. The request body can still carry an
approval reason, but `approvedBy` and `deniedBy` are no longer trusted input.

The token is supplied directly by the Unix dev launcher or through a
systemd `LoadCredential` file for NixOS services. Core can exchange the token
for a short-lived `HttpOnly; SameSite=Strict` operator session; Observer has an
explicit sign-in/sign-out panel and sends credentialed requests only after the
session is established. `/health` and non-state capability descriptions remain
public for liveness and discovery, while task, approval, runtime, policy, and
execution-ledger read models require the same authenticated operator boundary.
The Unix helper injects the file-backed credential into direct Core readback
calls used by milestone scripts.

Focused auth/route tests, Observer tests, generated-client syntax, body-config
evaluation, store-native Core/Observer builds, and live Core probes prove the
boundary. The probes cover unauthenticated mutation and sensitive-read
rejection, untrusted Origin rejection, server-derived actor identity, cookie
flags, session use, and post-logout rejection.

The common system-sense and screen-act mutation paths now reject unsigned direct
calls and accept only Core-issued, short-lived grants bound to the exact method,
route, body hash, audience, task, step, capability, and intent. This still does
not replace shared Browser Runtime credentials with per-caller credentials or
prove a real Nix closure receipt and host-health oracle for activation.

The first independent service-identity slice is now complete for Event Hub.
Each publishing service reads its own credential from a file, sends a bounded
caller/source identity, and Event Hub verifies the exact source-to-token
assignment in a credential map with constant-time comparison. Required map mode
fails closed at startup and rejects both token/source swaps and missing caller
identity. The Unix and PowerShell dev launchers generate separate local
credentials; NixOS exposes the same map and per-service files through
`LoadCredential` without writing token values into the Nix expression. This
slice is documented in
`docs/plans/OPENCLAW_INTERNAL_SERVICE_IDENTITY_PLAN.md`.

The Browser Runtime per-caller identity slice is now complete. A configured
caller map binds separate credentials to session-manager, screen-sense, and
screen-act; each service reads its own file and sends its caller identity.
Trusted sidecar capture and action receive the session-manager credential only
through the connected Unix IPC bind message, never through the transient
EnvironmentFile. Unix and PowerShell development launchers generate the same
bounded credential map, while NixOS delivers the map and caller files with
`LoadCredential`. Shared-token and loopback compatibility remains only when a
per-caller map is not configured.

The direct-actuator grant slice is now closed by both unit coverage and the real
service attack regression above. The reservation implementation already covers
commit, abort, expiry, and restart recovery in the Core runtime. The real
service check in `nix/scripts/dev-reservation-recovery-check.sh` proves an
interrupted running reservation is failed closed as `recovered_aborted` without
automatic replay. Pre-start expiry remains unit-covered because the production
executor has no externally pausable reserve/start boundary. These security
boundaries are now sufficient to keep the fixed hostd/systemd Level 3
activation contract under test. Physical activation remains deferred until the
closure receipt and independent post-action health oracle are proven.

## Identity-Upgrade Alignment

Every new capability must state which identity level it serves:

```text
Level 1: user-space control plane
Level 2: trusted session/work-view component
Level 3: controlled system-level body daemon
Level 4: graphics-stack-native AI workspace
```

The enhanced `openclaw` migration currently belongs mostly to Level 1. Some
future work-view manager and session helper work belongs to Level 2. Host repair
and controlled privileged actions belong to Level 3. Nested compositor and AI
session work belongs to Level 4.

Do not jump identity levels to make a milestone pass.

## Phase Plan Cleanup Policy

Historical phase plan files under `docs/plans/OPENCLAW_PHASE_*_PLAN.md` are not
the active roadmap. Many are still referenced by milestone checks and must remain
in place until the checks are refactored.

Use them as:

```text
evidence
test fixtures
historical implementation records
```

Do not use them as:

```text
automatic next-phase instructions
the current product roadmap
permission to continue nested safety shells
```

The active routing documents are listed in `docs/README.md` and
`docs/plans/README.md`.

## Definition Of Real Progress

A development slice counts as real progress only if it answers:

```text
What user-visible or operator-visible capability became more real?
Which whitepaper or identity-upgrade goal does it serve?
What evidence proves it?
What remains deliberately deferred?
What is the next smallest real capability step?
```

If a slice cannot answer those questions, it is likely a checklist shell and
should be stopped or merged into a more meaningful slice.

## Current Execution Environment

As of 2026-07-18, `/home/edvulcan/OpenClaw_On_NixOS` is running on the only
available physical host (`systemd-detect-virt=none`). There is no VM workspace,
VM IP, or SSH handoff available for current development. Historical VM claims
below remain evidence of earlier acceptance only; they are not executable
instructions for the current agent.

On this physical host, normal development is user-space and read-only with
respect to the host: do not run `sudo`, `nixos-rebuild switch`, generation
activation, real hostd activation, or rollback. Use injected clients, dry-run
builders, local service lanes, and unit/Observer evidence for unsafe host
boundaries until a separate mutation environment is explicitly provisioned.

## Historical VM Agent Startup Checklist (Archived)

The following checklist is retained for historical VM recovery only. Do not use
it as the current startup order:

```bash
cd /home/edvulcan/OpenClaw_On_NixOS
git pull origin main
git status --short
git log -10 --oneline
sed -n '1,260p' docs/OPENCLAW_FORWARD_WORK_DIRECTIVE.md
sed -n '1,220p' docs/README.md
sed -n '1,260p' docs/plans/OPENCLAW_ENHANCED_SOURCE_MIGRATION_BRIEF.md
sed -n '1,260p' docs/architecture/OPENCLAW_SYSTEM_IDENTITY_UPGRADE_PATH.md
```

Then report:

```text
1. Did the VM clone and checkout the preserved source reference?
2. Does the checked-out commit match `d90b253b0c03191613e45c36b1434078b8788bed`?
3. Which enhanced capabilities are already absorbed?
4. Which enhanced capabilities require migration?
5. Which active trunk is selected next, and why is it real capability progress
   instead of another safety wrapper?
```
