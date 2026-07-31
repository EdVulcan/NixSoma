# Downstream Recommendation Outcome Receipt

Updated: 2026-07-31

Status: implemented and accepted in source, isolated real development services,
and the store-native Core closure. Physical generation deployment and real
provider execution are not part of this slice.

## Selected Capability

Close the exact bounded observation edge after reviewed recommendation
application:

```text
application receipt -> exact downstream task -> authoritative terminal owner
-> completed/failed outcome receipt -> task state, experience memory, Observer
```

## Contract

- Core derives the receipt only from a validated application receipt whose
  downstream task id matches the terminal task.
- `completeTask`, `failTask`, and delegated `setTaskPhase` terminal transitions
  share the same owner and attach the receipt before experience recording.
- The receipt binds provider task, downstream task, application receipt hash,
  completed/failed, bounded terminal phase, outcome-binding hash, timestamp,
  and its own hash.
- Outcome summary, reason, details, action payload, provider content, and page
  content are not copied into the receipt or experience read model.
- `downstreamTerminalOutcomeObserved=true` proves only terminal correlation.
  Action execution, recommendation effectiveness, causality, ranking changes,
  and policy changes remain false.
- No task, approval, action, provider call, retry, or host mutation is created.

## Evidence

- Contract tests cover completed, failed, mismatched task, non-terminal state,
  binding hash, receipt hash, and governance tamper rejection.
- Task-manager tests cover all three authoritative terminal transitions and
  prove the receipt exists before the experience callback.
- Experience-memory tests retain only a validated receipt and expose it through
  the bounded public record without outcome content.
- Observer task detail exposes only terminal binding and negative authority
  claims.
- The final store-native Core closure must contain the new owner and exactly 270
  files.

Acceptance on 2026-07-31 passed Core 881/881, Observer 76/76, workspace
typecheck, and all eight exact `@changed` checks, including the reusable native
engineering context-packet Core/Observer pair. The final read-only 270-file Core
closure is
`/nix/store/r3mf72aariv854d1g7qgw72fyxbj5pqb-openclaw-core-0.1.0`.
No real provider request, credential read, host mutation, generation switch, or
reboot occurred.

## Deferred

- proof that a browser action actually executed or caused the terminal state;
- recommendation effectiveness or causal attribution;
- automatic confidence, ranking, lesson, policy, approval, execution, retry,
  provider, training, or model changes;
- physical generation activation, reboot, or host mutation.

## Next Real Capability

Freeze this completed receipt chain after validation. Run a fresh canonical
route review against the forward directive and identity path before selecting a
new vertical capability; do not add another outcome wrapper or automatic
learning mechanism merely because the receipt now exists.
