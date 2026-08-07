# NixSoma Reviewed Worklist Workflow Selection Plan

Updated: 2026-08-07

## Capability

Advance the existing reviewed finite mission worklist from generic browser-task
issuance to explicit selection among a finite server-owned set of already
implemented workflows:

```text
operator selects one fixed recipe per reviewed item
-> Core validates the recipe against the exact goal grammar
-> binding persists the immutable recipe selection and hash
-> the epoch issues one task with that server-owned selection
-> the existing workflow owner prepares, invokes, audits, and cleans up
-> the item waits for explicit acceptance of the exact workflow receipt
-> only the accepted receipt advances the item
```

The selection registry is `nixsoma-reviewed-workflow-selection-v0`. The current
recipes are `bounded_run`, `semantic_form_workflow`, `native_intake_workflow`,
and `reviewed_multi_application_mission`. A recipe owns its capability id,
workflow registry, completion-audit field, budgets, and any fixed application
order. The caller can select only the recipe id; it cannot submit capability,
budget, application, action, or provider fields.

## Ownership

- `reviewed-workflow-selection.mjs` owns the immutable recipe allowlist,
  goal compatibility, selection hash, compact outcome, and governance model.
- `reviewed-mission-worklist.mjs` owns item persistence, legacy migration,
  issue checkpoints, workflow checkpoints, and stop-on-failure ordering.
- `reviewed-workflow-runner.mjs` owns the shared prepare -> invoke -> hide ->
  audited completion sequence and fails closed on uncertain cleanup or outcome.
- The worklist acceptance contract owns the second, hash-bound
  `awaiting_acceptance` -> `completed` reconciliation step; it never invokes a
  provider or actuator.
- The existing task executor and capability owners remain the only owners of
  work-view preparation, provider calls, browser/native actions, and cleanup.
- Operator mission routes expose recipe metadata for review; Observer displays
  the selected recipe and does not gain new execution authority.

## Hard Bounds

- Recipe ids are server-allowlisted and selections are immutable after binding.
- Goal-specific recipes accept only their fixed bounded objective grammar.
- Provider output cannot select, change, extend, retry, skip, or repeat a recipe.
- Each epoch issues at most one reviewed item and one selected workflow.
- A workflow must produce its own exact completion audit, task binding, and
  known outcome before the item can enter `awaiting_acceptance`.
- The operator must explicitly accept the exact current outcome before the
  item can advance; task completion alone does not advance the worklist.
- Start-audit, provider result, cleanup, or completion-audit uncertainty blocks
  the worklist and never replays the provider or action.
- Acceptance checkpoint, required audit, or post-audit binding uncertainty
  blocks the worklist and never repeats the workflow.
- Legacy persisted items without recipe fields remain generic and are marked
  `workflowStatus: "legacy"`; they do not acquire the default recipe merely
  because a later Core restart serializes them.
- No automatic acceptance or re-arm, scheduler, open-ended task supply,
  arbitrary application routing, root, desktop-wide input, host mutation,
  automatic completion, or live provider
  invocation is introduced by this slice.

## Evidence

The source gate passes with all `1457/1457` workspace tests, Core `1008/1008`,
Observer `122/122`, Session Manager `85/85`, typecheck, operator-control and
Observer operator service gates, body-config, the 835-entry registry,
1023-file/1007-shell-script audit, Windows path budget, and exact
`293/36/117`-file Core/Session Manager/Observer closures. Focused tests cover
recipe hashes and goal compatibility, workflow runner cleanup/audit failure,
fixed recipe worklist execution, explicit acceptance and tamper rejection,
acceptance restart interruption, legacy persistence compatibility, mission
pause, and production-shaped mission route assembly.

Physical activation and a live provider workflow are not claimed by this plan.

## Deferred

The explicit reconciliation step is recorded in
`OPENCLAW_REVIEWED_WORKFLOW_ACCEPTANCE_PLAN.md`. Provider-authored plans,
arbitrary application discovery, retry/skip policy, causal learning, physical
Phase D mutation/rollback, and wider root/process/desktop control remain
separate governed boundaries.

## Stop Condition

Freeze this slice and its acceptance reconciliation when the source and
representative validation evidence agree. Do not add another recipe, generic
action path, or readiness wrapper without a new user-visible workflow and an
explicit route review.
