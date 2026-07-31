# NixSoma Durable Experience Feedback

Updated: 2026-07-31

Status: implemented and accepted in source plus isolated real development
services. Physical generation deployment is not part of this slice.

## Selected Capability

Close the first measurable feedback edge in existing local experience memory:

```text
terminal task -> bounded experience record -> later same-type terminal outcome
-> durable correlation summary -> engineering context and Observer readback
```

This advances Level 1 memory from write-and-recall toward a verifiable feedback
loop. It reuses the existing terminal-task recorder, Core state persistence,
engineering context packet, and Observer surface.

## Contract

- A later completed or failed task updates only older records with the exact
  normalized task type.
- Each older record retains at most 32 feedback observations.
- A hash key makes repeated terminal recording idempotent; public readback does
  not expose the later task id.
- Readback reports observed records/outcomes, completed/failed counts,
  completion rate, latest outcome, and the fixed correlation kind.
- Feedback does not change lesson text, recall ranking, policy, approval,
  provider, actuator, or task execution.
- `causalAttribution=false` and `advisoryUseProven=false` are mandatory. This
  slice proves subsequent-outcome correlation, not that recalled advice caused
  the outcome or was consumed.

## Evidence

- Core unit tests cover same-type correlation, task-type isolation, idempotent
  replay, bounded hashed observations, public redaction, and state round-trip.
- Context-packet tests bind the compact feedback summary into protected local
  evidence.
- Observer tests render the feedback separately from historical outcome rate.
- The existing native engineering context Core/Observer pair gate creates two
  approved same-type tasks and requires a real persisted completed feedback
  observation with no causal or advisory-use claim.

Acceptance on 2026-07-31 passed Core 870/870, Observer 76/76, workspace
typecheck, and the reusable context-packet pair gate. The Core pass observed one
completed feedback outcome; the Observer pass reused the same service lifecycle
and observed three, each at completion rate 1 with `provider=false`.

## Deferred

- explicit task-bound proof that a recalled advisory was consumed;
- automatic confidence/ranking changes or policy decisions from feedback;
- provider-generated lessons, model training, reward scoring, or cloud memory;
- retries, automatic task creation/completion, actions, host mutation, and
  physical generation activation.

## Next Real Capability

The next canonical review should select an explicit task-bound
recall-consumption receipt. That later slice must
prove which bounded records reached a governed consumer before associating the
consumer task outcome; it must not infer causality from type similarity alone.
