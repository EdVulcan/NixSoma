# Downstream Recommendation Execution Receipt

Updated: 2026-07-31

Status: implemented and accepted in source, isolated real development services,
and the store-native Core/Observer closures. Physical generation deployment and
a fresh real provider execution are not part of this slice.

## Selected Capability

Close the missing action-evidence edge without adding another actuator:

```text
application receipt -> existing reviewed semantic-click task
-> trusted semantic handoff -> Screen Act verified click
-> execution receipt -> execution-bound terminal outcome receipt v1
```

## Contract

- The browser task executor forwards evidence only after its existing action and
  post-action verification succeed.
- The task manager derives the receipt; callers cannot inject it at task
  creation or choose its provider/task binding.
- The receipt requires the exact application receipt and downstream task, one
  trusted operator-reviewed semantic-click handoff, one accepted non-degraded
  `mouse.click`, Screen Act semantic resolution, action execution, post-frame
  verification, and a fully passing executor verification result.
- Durable evidence contains only task and action ids, hashes, item ordinal/count,
  frame sequence, execution status, and fixed governance claims. Target id,
  target name, URL, page content, provider content, and input values are absent.
- The terminal owner emits outcome receipt v1 only when the execution receipt
  binds the same application, provider task, and downstream task. Legacy
  outcome receipt v0 remains valid and retains its original hash shape.
- `downstreamActionExecutionProven=true` proves that the exact governed action
  executed and passed post-action verification. It does not prove that the
  recommendation was effective or caused the terminal outcome.
- No task, approval, provider call, retry, ranking, policy, training, host
  mutation, generation switch, or reboot is created.

## Evidence

- Execution-receipt contract tests cover exact binding, one-action enforcement,
  rejected unverified actions, tamper rejection, and target-id non-persistence.
- Task-executor production-shape tests prove evidence is forwarded only after
  successful verification; task-manager tests prove server derivation,
  persistence, caller-injection rejection, and outcome v1 binding.
- Outcome tests preserve legacy v0 and prove v1 execution binding without an
  effectiveness or causality claim.
- Experience-memory tests retain validated v0 and v1 outcomes and reject a
  tampered execution-receipt hash.
- Observer task detail renders only compact execution binding, evidence, and
  negative authority claims.
- The store-native Core closure must contain the execution-receipt module and
  exactly 271 files.

Acceptance on 2026-07-31 passed 109 focused tests, all 1281 workspace tests,
workspace typecheck, syntax checks, the exact eight-check `@changed` selection,
three structural gates, and three real service gates covering the operator loop,
the reusable Core/Observer context pair, and Observer capability invocation.
The read-only Core closure is
`/nix/store/x9ay4bszq39866q331g9b32w98z35lpi-openclaw-core-0.1.0` with exactly
271 files; the Observer closure is
`/nix/store/4a8ish136b1k05c1wvfw781hdny36cs9-openclaw-observer-ui-0.1.0` with
exactly 97 files. The resource-bounded body-config gate used one Nix job and two
cores, peaked near 55 C, and left swap unused. No real provider request,
credential read, physical service mutation, generation switch, or reboot
occurred.

## Deferred

- recommendation effectiveness, causal attribution, confidence adjustment,
  ranking, policy, training, or model changes;
- semantic type, multi-action, retry, automatic continuation, or generic action
  execution receipts;
- fresh real provider/browser acceptance and physical generation activation;
- host mutation, generation switch, and reboot.

## Next Real Capability

Freeze this chain after representative validation. The next route review should
select a distinct user capability; it must not add another receipt wrapper or
infer learning/effectiveness from one correlated action and terminal outcome.
