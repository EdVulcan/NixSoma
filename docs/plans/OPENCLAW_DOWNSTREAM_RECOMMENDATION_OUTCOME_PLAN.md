# Downstream Recommendation Outcome Receipt

Updated: 2026-07-31

Status: implemented and accepted in source, isolated real development services,
and the store-native Core closure. Physical generation deployment and real
provider execution are not part of this slice.

## Selected Capability

Close the exact bounded observation edge after reviewed recommendation
application:

```text
application receipt -> optional verified execution receipt
-> exact downstream task -> authoritative terminal owner
-> completed/failed outcome receipt v0/v1 -> task state, memory, Observer
```

## Contract

- Core derives the receipt only from a validated application receipt whose
  downstream task id matches the terminal task.
- `completeTask`, `failTask`, and delegated `setTaskPhase` terminal transitions
  share the same owner and attach the receipt before experience recording.
- Receipt v0 binds provider task, downstream task, application receipt hash,
  completed/failed, bounded terminal phase, outcome-binding hash, timestamp,
  and its own hash.
- Receipt v1 additionally requires a validated execution receipt for the same
  application/provider/downstream task and binds its hash. The v0 hash shape
  remains unchanged for compatibility.
- Outcome summary, reason, details, action payload, provider content, and page
  content are not copied into the receipt or experience read model.
- `downstreamTerminalOutcomeObserved=true` proves terminal correlation. In v0,
  action execution remains unproven; in v1 the exact execution receipt makes
  `downstreamActionExecutionProven=true`. Both versions keep recommendation
  effectiveness, causality, ranking changes, and policy changes false.
- No task, approval, action, provider call, retry, or host mutation is created.

## Evidence

- Contract tests cover completed, failed, mismatched task, non-terminal state,
  legacy v0, execution-bound v1, binding hashes, receipt hashes, and governance
  tamper rejection.
- Task-manager tests cover all three authoritative terminal transitions and
  prove the receipt exists before the experience callback.
- Experience-memory tests retain only validated v0/v1 receipts and expose them
  through the bounded public record without outcome content.
- Observer task detail exposes only terminal binding and negative authority
  claims.
- The execution-receipt continuation raises the exact store-native Core closure
  count to 271 files.

Acceptance on 2026-07-31 passed Core 881/881, Observer 76/76, workspace
typecheck, and all eight exact `@changed` checks, including the reusable native
engineering context-packet Core/Observer pair. The final read-only 270-file Core
closure is
`/nix/store/r3mf72aariv854d1g7qgw72fyxbj5pqb-openclaw-core-0.1.0`.
No real provider request, credential read, host mutation, generation switch, or
reboot occurred.

## Deferred

- proof that the recommendation was effective or caused the terminal state;
- recommendation effectiveness or causal attribution;
- automatic confidence, ranking, lesson, policy, approval, execution, retry,
  provider, training, or model changes;
- physical generation activation, reboot, or host mutation.

## Next Real Capability

The exact action-execution continuation is implemented in
[`OPENCLAW_DOWNSTREAM_RECOMMENDATION_EXECUTION_PLAN.md`](./OPENCLAW_DOWNSTREAM_RECOMMENDATION_EXECUTION_PLAN.md).
Freeze the completed receipt chain after validation; do not add another outcome
wrapper or infer automatic learning from the correlation.
