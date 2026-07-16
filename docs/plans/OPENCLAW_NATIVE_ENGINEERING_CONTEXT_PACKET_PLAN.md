# OpenClaw Native Engineering Context Packet Plan

Updated: 2026-07-16

## Active Slice

Local governed engineering context assembly.

This slice gives OpenClaw a cohesive local owner for preparing model-ready
engineering context without invoking a provider. It combines bounded command
transcripts, task summaries, verification summary, recovery summary, output
redaction, and the native microcompact projection into one packet.

Identity alignment: Level 1, stable user-space control plane.

## Endpoint

```text
POST /plugins/native-adapter/engineering-context/packet
registry: openclaw-native-engineering-context-packet-v0
capability: sense.openclaw.engineering_context.packet
```

Optional request fields select an existing task, transcript count, per-record
output limit, microcompact threshold, and recent assistant-turn protection.

## Implemented Behavior

The packet owner:

```text
reads the existing command transcript ledger and task map
reuses existing verification and recovery builders
orders selected command evidence chronologically
adds bounded task goal/status/outcome summaries
recalls a small set of matching advisory experience lessons from the persisted core state
caps stdout/stderr per record
redacts password/token/secret/api-key/credential, Bearer, and sk-* patterns
applies the native in-memory microcompact projection
marks verification and recovery summaries as protected evidence
persists a summary-only audit event before returning packet content
fails closed with HTTP 503 when audit persistence is unavailable
is available from an explicit Observer control that reuses the same core route
and displays bounded packet summaries and messages without provider consumption
```

## Governance

```text
local context assembly only
no credential-store read
no task, transcript, or event-content mutation
no task or approval creation
no command execution
no provider SDK or provider call
no network egress
no raw packet content in audit events
experience lessons are advisory-only and cannot create tasks, approvals, commands, or provider calls
```

The packet may contain bounded local command output because its purpose is to
prepare useful engineering context. Credential-like output is redacted first,
and callers can scope the packet to one task.

## Evidence

Implementation:

```text
services/openclaw-core/src/native-engineering-context-packet.mjs
services/openclaw-core/src/native-engineering-experience-memory.mjs
services/openclaw-core/src/native-engineering-context-routes.mjs
services/openclaw-core/src/native-engineering-work-view-action-decision.mjs
```

Tests:

```text
services/openclaw-core/test/native-engineering-context-packet.test.mjs
services/openclaw-core/test/native-engineering-experience-memory.test.mjs
services/openclaw-core/test/native-engineering-work-view-action-decision.test.mjs
services/openclaw-core/test/native-engineering-context-routes.test.mjs
services/openclaw-core/test/route-handlers.test.mjs
apps/observer-ui/src/observer-panels-engineering-context.mjs
apps/observer-ui/src/client-script-renderers-engineering-context.mjs
apps/observer-ui/src/client-script-refreshers-engineering-context.mjs
nix/scripts/dev-openclaw-native-engineering-context-packet-common-check.sh
```

Tests prove task filtering, output bounds, credential-like redaction,
microcompaction, verification/recovery protection, no provider/network flags,
and summary-only audit publication. The core/Observer milestone also proves an
explicit packet build from an approved command transcript, visible HTML/client
tokens, redaction and microcompaction evidence, recalled terminal experience,
and no provider/network use.

## Deferred

```text
automatic packet persistence
automatic task execution or recovery
unbounded transcript/output inclusion
provider SDK loading
provider calls or network egress outside the explicitly approved live-provider task
credential value access outside the existing sender gate
```

## Observer Follow-Up Complete

Observer now exposes a `Build Context Packet` control in a dedicated panel. It
uses the selected task when present, otherwise the bounded current ledger, and
renders the returned packet only after the operator requests it. The control
does not create a task, approval, command, provider request, or persistent packet
artifact.

## Provider Handoff Follow-Up Complete

The existing approved live-provider task can now consume this packet through
the same explicit `POST /operator/step` execution call. The handoff is:

```text
bounded transcript/task evidence -> redaction and microcompact -> one bounded
provider message -> existing endpoint/credential/egress gate -> transient response
```

The operator must request `contextPacket` with the current task id; a manual
`requestEnvelope` and context packet cannot be combined. The bridge reuses the
existing verification and recovery evidence builders, keeps packet content in
the current execution request only, and persists only counts, hashes, redaction,
truncation, and materialization evidence. No new provider route, task type,
automatic call, credential read path, or Observer execution control was added.

This advances the Level 1 cloud-consciousness boundary from local context
assembly to an explicitly approved provider handoff while preserving local
operator control.

The provider handoff now also accepts the existing explicit work-view and
plan/todo selectors:

```json
{
  "includeWorkView": true,
  "includeWorkViewObservation": true,
  "includePlanTodo": true
}
```

The materializer reuses the local association, observation, and plan/todo
builders, includes only their bounded summaries in the transient provider
message, and records their inclusion/status in compact task evidence. The
resulting content hash remains part of the existing approval binding. Page
URLs, pixels, page text, target items, selectors, input values, lease ids, and
credentials remain excluded. The focused boundary is documented in
`OPENCLAW_NATIVE_ENGINEERING_CONTEXT_PROVIDER_HANDOFF_BRIDGE_PLAN.md`.

The approved provider request may also set `sourceTaskId` separately from its
egress `taskId`. This lets the egress task consume an existing source-command,
verification, edit, or workbench task's bounded evidence while keeping
approval, execution, and hash ownership on the egress task. The source task
must exist and is never mutated or resumed; the two ids are retained only as
compact provenance. See
`OPENCLAW_NATIVE_ENGINEERING_CONTEXT_PROVIDER_SOURCE_TASK_PLAN.md`.

## Structured Recommendation Follow-Up Complete

The approved context-packet handoff now appends the bounded
`engineering_recommendation_v0` response contract. The contract derives its
action ids from the existing plan/todo allowlist and accepts only a bounded JSON
recommendation that points to an existing Observer control and capability while
requiring operator review.

```text
local context packet -> structured provider recommendation -> operator review
-> existing governed Observer/task/approval path
```

Unknown action ids, unknown response keys, malformed fields, and automatic task,
approval, or execution flags fail closed. A valid recommendation is returned in
the current execution response only. The durable live-provider task stores
compact contract evidence and hashes, never the assistant reason or raw response.
This is an initial Level 1 governance loop; it does not auto-create a task,
auto-approve, auto-execute, mutate the workspace, or add a provider transcript.

## Observer Recommendation Follow-Up Complete

The valid transient recommendation is now rendered in the existing Observer
Engineering Loop State panel after an operator step or operator loop returns a
structured provider recommendation. The panel shows the bounded action id,
review requirement, expected existing control id, and transient reason. A
disabled-by-default `Use AI Recommendation` control becomes available only
after the client revalidates the recommendation contract, allowlisted action,
matching Observer control id, required review, confidence, and all automatic
control flags.

Using the control calls only the existing allowlisted Observer control
function. It does not send the provider response back to core, create an
approval implicitly, approve or execute a task, persist the recommendation, or
accept an endpoint, command, path, or provider payload from the model.

Evidence is served through the existing `/operator/step` and `/operator/run`
response serialization paths. No new provider route or task type was added.

## Screen Observation Recommendation Follow-Up Complete

The structured recommendation allowlist now also contains
`observe_current_screen`. Its binding is fixed to the existing Observer
`invoke-screen-observation-button` and the common `sense.screen.observe`
capability. The operator can review a transient provider recommendation and
select `Use AI Recommendation`; that selection invokes the same bounded screen
summary path and never exposes pixels, OCR text, URLs, session/lease ids, or
semantic target items.

This action is read-only and does not require a second approval task, but the
operator selection remains mandatory. The client validates the action's
Observer control, capability id, approval contract, review flag, confidence,
and automatic-control flags before invoking it. Plan/todo guidance can point
to the same control without creating a task or suggestion-link mutation.

Evidence is covered by the existing core recommendation tests, plan/todo
evidence test, Observer recommendation test, and capability-invoke/Observer
real checks. The provider response remains transient and durable evidence
retains only compact action and hash metadata.

## Trusted Work-View Association Follow-Up Complete

The existing explicit Observer packet action can now request a compact
association with the session-manager-owned trusted AI work view. Core reads
`/work-view/state` only when `includeWorkView=true` and derives task binding,
session identity status, helper action authority, lease-match state, and
recovery recommendation through
`openclaw-native-engineering-work-view-association-v0`.

The packet and Observer expose only bounded status metadata. Lease ids, active
URLs, capture payloads, task mutation, action dispatch, automatic binding,
provider calls, and external egress remain excluded. Session-manager failure
returns an explicit unavailable association while preserving the local packet
readback.

The live association can now carry the existing `prepare_work_view` and
`reveal_work_view` recovery recommendations into the packet Observer panel.
The panel shows the recovery status and reveals a contextual Prepare or Reveal
control only for those exact allowlisted recommendations. The control
revalidates through the existing work-view recovery action and refreshes the
packet; it does not accept arbitrary endpoint data or automatically run during
packet assembly.

## Operator Route Fixture Follow-Up Complete

The production-shaped route test now supplies a local valid recommendation to
both existing operator response paths:

```text
POST /operator/step
POST /operator/run
```

It proves the full recommendation remains transient in `execution.recommendation`
while `recommendationEvidence` retains only compact action/status data and no
reason. The fixture uses no provider sender, credential, endpoint, or network
egress.

## Experience Memory Follow-Up Complete

Task completion and failure now feed one bounded `experienceMemoryRecords` store
in core state. Each record contains only a task type, a fixed bounded lesson,
terminal outcome, execution phase, applicability tokens, confidence, and compact
source/hash metadata. Goal text is used only to derive filtered applicability
tokens; URLs, credential-like values, command output, task details, and
executable parameters are excluded from the record.

The existing Context Packet assembly recalls at most four matching records by
task type and goal tokens. It injects them as protected
`experience_memory_evidence` with explicit advisory-only governance. The same
assembly is reused by the capability route, direct route, Observer readback, and
explicit provider handoff, so the provider path inherits no new authority. The
memory recall stores only counts and a query hash in audit evidence.

## Adaptive Advisory Recall Follow-Up Complete

Matching terminal experience now also produces a bounded pattern summary:

```text
matched/completed/failed counts
completion rate and latest outcome
repeatable_success, mixed_outcomes, recovery_needed, or no-match pattern
advisory next-action guidance
```

The summary is derived from sanitized task type, phase, outcome, and
applicability tokens. It is visible in the packet summary and Observer, and the
approved provider handoff receives it only as part of the same transient local
context packet. Compact evidence stores counts, rate, latest outcome, and
pattern; it never stores task goals, command output, credentials, or raw model
content. The guidance cannot create tasks, approvals, commands, actions, or
network egress.

## Semantic Action Readiness Follow-Up Complete

The existing trusted work-view observation now feeds a bounded semantic-action
readiness decision through the same association owner. It allows only the
operator-facing target-selection stage when the selected task is bound to the
current work view, authority is authoritative with an active lease, the
observation is ready and fresh, and the semantic inventory and visual frame
share the same sequence and digests.

The decision is read-only and reports bounded reasons for unbound, stale,
unavailable, incomplete, or mismatched observations. Observer and Context
Packet readback show the status and the existing recovery/bind/build control
that can address it. Target ids, selectors, target items, action parameters,
action dispatch, task/approval creation, provider calls, credentials, and
network egress remain excluded.

## Next Slice

The Level 1 context-packet -> structured recommendation -> Observer review ->
existing governed control loop is now closed with local route and UI evidence.
The first concrete Level 2 context bridge and its unbound-task follow-up are
also closed through the existing session-manager owner. The bind route
revalidates authoritative state, preserves task status, rejects stale identity,
and does not dispatch an action or resume work automatically. Its concrete
`prepare_work_view` and post-prepare `reveal_work_view` recovery recommendations
are now bridged through the existing Observer recovery control and refreshed
packet readback. After a session restart, the same selected task can be
explicitly rebound through the existing bind route with `rebind: true` after
authority recovery; automatic rebinding remains disabled. The dedicated
work-view bind plan records the boundary and evidence. Keep provider response
content transient and do not resume the historical Phase 59-136 wrapper chain.

The same packet can now explicitly request the bounded AI-owned work-view
observation bridge from
`OPENCLAW_NATIVE_ENGINEERING_WORK_VIEW_OBSERVATION_BRIDGE_PLAN.md`. It reports
capture status/freshness, frame provenance, and semantic-target counts without
transferring page URLs, pixels, text blocks, target items, input values, or
selectors. It remains read-only and does not select or dispatch an action.

The packet can also explicitly request the existing plan/todo workbench bridge
with `includePlanTodo: true`. It carries bounded task-plan/workbench summaries
and the existing guidance-only next action as protected context; it does not
switch planning mode, write a todo file, create a task, or execute the
suggestion.

The same local packet owner is now available through the common capability
runtime as `sense.openclaw.engineering_context.packet`. The dedicated route and
capability share one assembly helper, so task/source selection, redaction,
microcompact protection, work-view selectors, and plan/todo selectors cannot
drift between callers. The capability records only compact invocation evidence;
packet messages remain transient. See
`OPENCLAW_NATIVE_ENGINEERING_CAPABILITY_RUNTIME_CONTEXT_PACKET_PLAN.md`.

When this packet is used by the existing approved provider handoff, these
selectors are still explicit request inputs and are covered by the same
request-content hash. They do not enable provider calls or action execution by
themselves.

The next Level 2 slice is to use this reviewed readiness decision at the
existing browser semantic-action handoff for one bounded operator-approved
click. The handoff must revalidate the current lease, target inventory digest,
frame sequence, and visual grounding at the runtime owner before dispatch;
arbitrary selectors, page scripts, automatic action dispatch, semantic type,
and desktop-wide capture remain deferred.
