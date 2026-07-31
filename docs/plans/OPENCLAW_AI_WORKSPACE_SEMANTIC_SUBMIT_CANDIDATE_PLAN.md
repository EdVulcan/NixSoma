# NixSoma AI Workspace Semantic Submit Candidate

Updated: 2026-07-31

Status: source implemented and locally validated; deterministic physical
acceptance remains pending explicit authorization. The implementation adds one
receipt-bound capability id and reuses the existing semantic click actuator.

## User Capability

Close one real reviewed form workflow inside the AI-owned browser. After the
same task has exact receipt-bound, write-only semantic type evidence, a separate
explicit operator trigger may activate exactly one current eligible semantic
submit control and then verify a visible semantic transition. Task completion
continues to require the existing separate assessment and explicit acceptance
owner.

This is not generic Enter or a general second action. It is a narrow lifecycle
binding from an existing verified type result to one task-bound semantic
activation/submit result.

## Duplicate-Capability Audit

The implementation decision followed this gate:

1. Check whether two explicit invocations of the existing task-bound
   `act.ai.workspace.single_step` path can already produce type -> submit with
   sufficient task, scene, receipt, audit, and post-action evidence.
2. If the existing path is complete, add no actuator or response-contract
   variant. Close only the representative workflow acceptance and update the
   canonical docs.
3. Because the existing path lacked an exact prior-type-to-submit binding, add the
   smallest Core coordinator or contract constraint that supplies that binding.
   Reuse the existing semantic `click_item` owner in Screen Act and Browser
   Runtime.

A renamed `click_item`, another provider wrapper, or another readiness/readback
surface does not satisfy this candidate.

## Source Implementation Record

The duplicate-capability audit found that `act.ai.workspace.single_step` could
already type and click separately, but its second request accepted only a task
id and confirmation. It did not bind the follow-up click to the exact verified
type invocation, and the bounded run intentionally stopped after type.

Source now provides `act.ai.workspace.semantic_submit` as the missing lifecycle
coordinator. It accepts only the reviewed task id, explicit confirmation, one
type invocation id, and the exact objective, task-version, response, and scene
hashes from that invocation. Core requires a successful, completion-audited,
post-action-verified, write-only type receipt less than five minutes old;
rejects a changed task binding, a later task action, or a consumed receipt; and
allows the provider to choose only `no_op` or one enabled semantic `button`
whose accessible name begins with Submit, Send, Continue, or Confirm. The
existing semantic click owner retains target resolution, execution-grant,
pre-action audit, actuation, and post-action verification ownership.

Receipt consumption is durable through the compact capability invocation log
after the authorization audit succeeds, including an audited execution failure.
Malformed or mismatched requests do not consume a valid receipt. Observer keeps
the exact verified type invocation only in browser memory, enables one explicit
Submit control, sends no ordinal or input text, and clears the receipt after the
attempt.

Focused Core/runtime tests, complete Core and Observer suites, both builds,
workspace typecheck/tests, and source-level closure wiring have passed. This is
source evidence only: no provider call, browser action, deployment, generation
switch, or physical acceptance is claimed by this record.

## Required Reuse And Binding

The candidate must reuse:

- the existing reviewed task and authoritative work-view binding;
- the existing bounded semantic scene and private local target resolution;
- an exact successful semantic-type receipt for the same task and current
  authority, retaining only the owner's existing write-only character/byte
  evidence;
- the existing single-use execution grant, pre-action durable audit, semantic
  click actuator, and post-action recapture;
- at most one existing provider decision for the explicit submit step, with no
  new provider transport or free-form caller prompt.

Before the action, Core must fail closed on task version, task status, work-view
authority, browser surface, scene, prior type receipt, target eligibility, or
grant drift. The submit target must be enabled and present in the current
bounded semantic scene; caller coordinates, private target ids, selectors, URL,
and current input values stay local or excluded.

## Acceptance

The stop condition is one deterministic real-browser form workflow that proves:

- one reviewed task and authoritative work view remain bound throughout;
- an existing semantic type is receipt- and audit-verified without plaintext
  persistence;
- one explicit follow-up activates exactly one current eligible submit control;
- the existing actuator runs at most once and returns a matching grant, receipt,
  and newer post-action semantic/frame observation;
- the fixed form exposes a deterministic visible completion state, while task
  state remains unchanged until separate assessment acceptance;
- durable evidence contains only compact hashes, counts, action identity, and
  verification facts, not typed text, URL, selector, target id, provider reason,
  pixels, or credentials;
- focused tests, typecheck, affected registry/script checks, exact closure
  checks, service health, failed-unit, restart-count, and no-repeat evidence
  pass at the level required by the eventual implementation.

Prefer a deterministic fixed Workbench form for the physical gate. A public
form may supplement that proof when networking is healthy, but external service
availability must not define product correctness.

## Explicitly Deferred

- generic Enter, hotkeys, modifiers, arbitrary keyboard input, or caller text;
- caller coordinates, ordinals, selectors, target ids, URLs, or page scripts;
- automatic continuation from arbitrary actions, retries, repetition, or an
  open multi-step loop;
- automatic task assessment, task completion, or assessment acceptance;
- arbitrary tab/window/process control, parent-display input, desktop takeover,
  root, hostd, generation activation, or host mutation.

## Freeze Rule

After one representative form lifecycle is physically proven, freeze this
lane. Select the next missing end-to-end capability from the identity path; do
not add submit aliases, keyboard variants, provider wrappers, or additional
form-specific action contracts without a concrete operator gap.
