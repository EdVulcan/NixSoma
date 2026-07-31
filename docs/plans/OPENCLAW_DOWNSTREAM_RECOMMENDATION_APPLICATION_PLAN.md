# Downstream Recommendation Application Receipt

Updated: 2026-07-31

Status: implemented and accepted in source, isolated real development services,
and the store-native Core closure. Physical generation deployment and real
provider execution are not part of this slice.

## Selected Capability

Prove one explicit transition after provider recommendation delivery:

```text
verified provider recommendation -> explicit Observer selection
-> existing governed semantic-click task control
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
  hash.
- `explicitOperatorSelection=true`, `existingControlReused=true`, and
  `downstreamTaskBound=true` prove application through the reviewed control.
- `downstreamExecutionProven=false`, `downstreamOutcomeProven=false`, and
  `causalAttribution=false` are mandatory. No provider reason or content is
  persisted.

## Evidence

- Contract tests cover exact binding, fixed-control rejection, receipt hashing,
  tamper rejection, and negative execution/outcome/causality claims.
- Task-manager tests prove server derivation, caller injection rejection, and
  public-state serialization.
- Existing Observer semantic-task tests prove the recommendation is forwarded
  only through the reviewed control without dispatching the task.
- Observer task detail exposes compact application, binding, control, and
  governance lines.
- The store-native Core closure must contain the receipt module and exactly 269
  files.

Acceptance on 2026-07-31 passed Core 877/877, Observer 76/76, workspace
typecheck, and all seven exact `@changed` checks. The read-only 269-file Core
closure is
`/nix/store/7vn7y0lli7846xyq7g748bjzyjm3jx1d-openclaw-core-0.1.0`.
No real provider request, credential read, host mutation, generation switch, or
reboot occurred.

## Deferred

- proof that the downstream task started or executed its action;
- downstream terminal binding is implemented separately in
  [`OPENCLAW_DOWNSTREAM_RECOMMENDATION_OUTCOME_PLAN.md`](./OPENCLAW_DOWNSTREAM_RECOMMENDATION_OUTCOME_PLAN.md);
- effectiveness scoring, causal attribution, ranking changes, training, or
  automatic policy changes;
- automatic task creation, approval, execution, retries, provider calls, host
  mutation, generation switch, or reboot.

## Next Real Capability

The exact downstream terminal binding is now implemented in
[`OPENCLAW_DOWNSTREAM_RECOMMENDATION_OUTCOME_PLAN.md`](./OPENCLAW_DOWNSTREAM_RECOMMENDATION_OUTCOME_PLAN.md).
It does not infer success from task creation or automatically alter ranking,
policy, approval, or execution.
