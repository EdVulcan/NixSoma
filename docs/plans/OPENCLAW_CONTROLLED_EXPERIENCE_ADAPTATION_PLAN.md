# Controlled Experience Adaptation

Updated: 2026-08-02

Status: implemented and validated in source, focused suites, reusable real
Core/Observer services, body-config, and exact Core/Observer Nix closures.
Physical generation activation and live provider trials remain separate
operator decisions.

## Selected Capability

Close the first controlled adaptation loop over the existing durable receipt
chain:

```text
operator arms one finite task-type experiment
-> Core privately assigns baseline or feedback-weighted recall ordering
-> existing provider consumption/application/execution/outcome receipts bind the result
-> exact balanced comparison produces one hash-bound ranking candidate
-> operator explicitly activates or revokes recall ordering for that task type
```

This changes only the order of already eligible bounded experience records.
It does not change task policy, approval, provider-call authority, available
actions, or host authority.

## Experiment Contract

- One task type may have one open experiment with 8-32 even assignments and a
  5-minute-to-30-day hard deadline.
- Assignment uses balanced random pairs. Callers cannot select an arm, ranking
  mode, record, provider response, outcome, or result.
- Only `engineering_recommendation_v0` provider contexts are eligible. The
  first eligible assignment locks the model alias for the experiment.
- A trial is consumed only when baseline and feedback-weighted ordering contain
  at least two records and differ. The assignment checkpoint is flushed before
  provider dispatch.
- Core restart pauses open experiments. Exact-id explicit re-arm is required;
  there is no automatic replay, retry, skip, or provider call.
- A terminal result counts only when the existing recommendation outcome
  receipt, provider task, assignment hash, and selected ranking mode all agree.
- Feedback-weighted ordering uses only validated `helpful` and `not_helpful`
  operator receipts. No free-form content or provider reason is persisted.

## Decision Contract

- Each arm must have the same number of terminal observations and all assigned
  trials must be terminal.
- The predeclared decision requires an absolute completion-rate difference of
  at least 0.25 and a two-sided Fisher exact p-value at most 0.05.
- The analysis hash covers arm counts, outcomes, test result, thresholds, model,
  task type, and candidate mode.
- Activation requires `confirm: true`, the exact experiment id, and exact
  analysis hash. Revocation is separately explicit.
- The result is evidence scoped to this bounded recall-ordering experiment. It
  does not claim general causality, model training, or authority adaptation.

## Governance

```text
finiteExperiment=true
pairedRandomAssignment=true
callerSelectsArm=false
operatorActivationRequired=true
recallOrderingOnly=true
changesExecutionPolicy=false
changesAuthority=false
createsTask=false
createsApproval=false
executesAction=false
automaticProviderCall=false
automaticRetry=false
generalCausalAttribution=false
```

## Evidence

- Core owner tests cover balanced assignment, exact outcome binding, Fisher
  analysis, hash-bound activation, restart pause/re-arm, cancellation, and
  ineligible no-consumption behavior.
- Memory tests prove feedback-weighted order changes without adding treatment
  labels or scores to provider-visible record content.
- Provider-context and live-execution tests prove assignment evidence reaches
  durable compact task state while the provider message cannot see the arm or
  experiment id.
- Route and production-assembly tests cover exact finite request shapes.
- Observer tests cover arm/read/re-arm/cancel/activate/revoke controls and prove
  the browser cannot select a ranking arm.
- Runtime-state and Nix closure checks cover restart durability and packaged
  module completeness.

## Stop Condition

Freeze this slice after focused suites, the existing Core/Observer context
service gate, body configuration, and exact Core/Observer closures pass. Do not
add another feedback receipt or observational score. The next route must be a
richer native multi-step workflow or the separately governed physical Phase D
promotion/rollback boundary.

## Validation Result

- Core package: `963/963`; Observer package: `118/118`.
- Focused Core/Observer set: `108/108`; both package typechecks pass.
- Reusable real Context Pair gate started all nine services once and proved
  experiment arm/read/cancel plus served Observer controls. Its first attempt
  was blocked before service startup by an inherited deployed token path; the
  gate now owns an isolated mode-0600 test token and the rerun passed.
- `dev-body-config-check.sh` passed with one Nix job/core.
- Core closure:
  `/nix/store/ypgjrysm665cmjlk0rz8n5j5df36p5mr-openclaw-core-0.1.0`
  (`284` files).
- Observer closure:
  `/nix/store/brl8ld8lv80pxgfhvgd3qizsfj7smbnj-openclaw-observer-ui-0.1.0`
  (`114` files).
- No system switch, reboot, root mutation, physical provider experiment, task
  creation, approval, action, or policy change occurred in this validation.
