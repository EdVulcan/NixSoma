# NixSoma Reviewed Workflow Acceptance

Updated: 2026-08-07

## Status

Implemented in source as the reconciliation step after reviewed worklist
workflow execution. Physical deployment and a live provider workflow remain
outside this slice.

## Capability

Close one selected worklist item only after explicit operator acceptance of its
exact verified workflow receipt:

```text
selected workflow completes its task-bound receipt
-> worklist item becomes awaiting_acceptance
-> Observer submits item/task/workflow/selection/outcome hashes
-> Core checkpoints acceptance and publishes a required audit
-> the exact item advances to completed and the worklist reconciles
```

The task terminal state remains owned by the existing workflow runner. The new
receipt governs reviewed worklist advancement; it does not start another
workflow or mutate the task a second time.

## Contract

- Only a selected workflow item with `workflowStatus: "awaiting_acceptance"`
  can be accepted.
- The request accepts only `confirm`, `itemId`, `taskId`, `workflowId`,
  `selectionHash`, and `outcomeHash`.
- Core recomputes the compact outcome hash, checks the exact selected recipe,
  completed task, and verified workflow audit before checkpointing acceptance.
- The checkpoint changes to `accepting` before the required audit. Restart or
  audit uncertainty fails closed and never repeats provider or action work.
- Every acceptance receipt binds worklist, mission, item, task, ordinal,
  workflow, selection hash, outcome hash, timestamp, and an immutable receipt
  hash. It exposes no input text, pixels, provider content, credential, or
  host authority.
- Legacy generic items remain generic and cannot enter this route.
- A mission pauses before opening a later epoch while acceptance is pending;
  explicit acceptance and, when needed, explicit mission re-arm are required.

## Ownership

- `reviewed-workflow-selection.mjs` owns outcome and acceptance hashes.
- `reviewed-mission-worklist.mjs` owns the acceptance checkpoint, receipt,
  item advancement, and restart reconciliation.
- `operator-mission-routes.mjs` exposes one operator-authenticated acceptance
  route; it adds no capability invocation or provider authority.
- Observer exposes one disabled-by-default acceptance control and sends only
  the server-projected hashes.

## Evidence

Focused tests cover exact receipt binding, tamper rejection, acceptance
checkpoint restart interruption, duplicate rejection, mission pause, route
assembly, and Observer hash-only submission. The acceptance gate passes all
`1457/1457` workspace tests, typecheck, Core `1008/1008`, Observer `122/122`,
Session Manager `85/85`, the real Core/Observer gates, body-config, the
835-entry registry, 1023-file/1007-shell-script audit, Windows path budget,
and exact `293/36/117`-file Core/Session Manager/Observer closures.

## Deferred

Automatic acceptance, automatic re-arm, provider-authored task supply, retry or
skip, causal learning, physical Phase D mutation/rollback, arbitrary process or
desktop control, root, and host mutation remain separate boundaries.

## Stop Condition

Freeze this reconciliation step after representative validation. The next
route review must select a distinct user workflow or a separately authorized
physical evidence gate; do not add another acceptance wrapper or receipt alias.
