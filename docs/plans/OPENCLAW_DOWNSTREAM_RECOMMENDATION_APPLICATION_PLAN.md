# Downstream Recommendation Application Receipt

Updated: 2026-08-01

Status: implemented and accepted in source, isolated real development services,
and the store-native Core closure. Physical generation deployment and real
provider execution are not part of this slice.

## Selected Capability

Prove one explicit transition after provider recommendation delivery:

```text
verified provider recommendation -> explicit Observer selection
-> existing governed semantic-click task control
-> optional validated recall-consumption receipt hash
-> server-derived downstream application receipt
```

No new actuator, provider call, task family, or approval owner is introduced.

## Contract

- Observer retains the existing `Use Recommendation` operator action and fixed
  `create-semantic-click-task-button` control.
- Core revalidates the completed provider task, fixed recommendation contract,
  response hash, action, capability, control id, and non-automatic governance.
- Only after assigning the new downstream browser-task id does Core derive the
  receipt. A caller-supplied receipt is ignored and cannot select its bindings.
- The receipt binds provider task, downstream task, response hash, complete
  recommendation-link hash, action, capability, control, timestamp, and its own
  hash. When the recommendation link carries a validated
  `experienceMemoryConsumptionReceiptHash`, the application receipt carries
  that hash and no recall record id, context, or provider content.
- `explicitOperatorSelection=true`, `existingControlReused=true`, and
  `downstreamTaskBound=true` prove application through the reviewed control.
- `downstreamAdvisoryApplicationProven=true` is derived only when the validated
  recall-consumption hash is present. It means the advisory crossed the
  reviewed application boundary; it does not mean the action executed, the
  terminal outcome followed, or the recommendation was effective.
- This application receipt intentionally keeps `downstreamExecutionProven=false`
  and `downstreamOutcomeProven=false`; later receipts prove those distinct
  edges without rewriting the original application claim. No provider reason
  or content is persisted.

## Evidence

- Contract tests cover exact binding, fixed-control rejection, receipt hashing,
  tamper rejection, and negative execution/outcome/causality claims.
- Task-manager tests prove server derivation, caller injection rejection, and
  public-state serialization.
- Existing Observer semantic-task tests prove the recommendation is forwarded
  only through the reviewed control without dispatching the task.
- Observer task detail exposes compact application, binding, control, and
  governance lines.
- Recall-link tests prove only the validated consumption receipt hash is
  projected, and application-receipt tests cover the hash-bound and legacy
  application shapes without changing causality or effectiveness claims.
- The store-native Core closure must contain the receipt module and exactly 269
  files.

Acceptance on 2026-07-31 passed Core 877/877, Observer 76/76, workspace
typecheck, and all seven exact `@changed` checks. The read-only 269-file Core
closure is
`/nix/store/7vn7y0lli7846xyq7g748bjzyjm3jx1d-openclaw-core-0.1.0`.
No real provider request, credential read, host mutation, generation switch, or
reboot occurred.

The 2026-08-01 continuation passed Core 900/900, Observer 95/95, workspace
typecheck/build, and touched-module syntax checks. It did not rerun the
store-closure or physical deployment gates; no new module or provider route
was introduced.

## Deferred

- downstream action execution is implemented separately in
  [`OPENCLAW_DOWNSTREAM_RECOMMENDATION_EXECUTION_PLAN.md`](./OPENCLAW_DOWNSTREAM_RECOMMENDATION_EXECUTION_PLAN.md);
- downstream terminal binding is implemented separately in
  [`OPENCLAW_DOWNSTREAM_RECOMMENDATION_OUTCOME_PLAN.md`](./OPENCLAW_DOWNSTREAM_RECOMMENDATION_OUTCOME_PLAN.md);
- effectiveness scoring, causal attribution, ranking changes, training, or
  automatic policy changes;
- automatic task creation, approval, execution, retries, provider calls, host
  mutation, generation switch, or reboot.

## Next Real Capability

The exact downstream execution and terminal bindings are now implemented in
[`OPENCLAW_DOWNSTREAM_RECOMMENDATION_EXECUTION_PLAN.md`](./OPENCLAW_DOWNSTREAM_RECOMMENDATION_EXECUTION_PLAN.md)
and
[`OPENCLAW_DOWNSTREAM_RECOMMENDATION_OUTCOME_PLAN.md`](./OPENCLAW_DOWNSTREAM_RECOMMENDATION_OUTCOME_PLAN.md).
Neither infers effectiveness from task creation or automatically alters
ranking, policy, approval, or execution.
