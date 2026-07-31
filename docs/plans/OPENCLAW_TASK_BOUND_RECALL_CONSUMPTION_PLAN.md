# NixSoma Task-Bound Recall Consumption Receipt

Updated: 2026-07-31

Status: implemented and accepted in source, isolated real development services,
and the store-native Core closure. Physical generation deployment is not part
of this slice.

## Selected Capability

Prove which bounded local experience records reached one approved governed
provider consumer:

```text
experience recall -> transient context candidate -> approved provider request
-> provider response -> task-bound durable consumption receipt
-> terminal experience and Observer readback
```

This follows the durable correlation slice without changing provider transport,
memory ranking, or task execution policy.

## Contract

- Context materialization selects at most four already-public experience record
  ids and keeps the candidate on a non-enumerable in-memory Symbol.
- No candidate content enters task state, JSON evidence, logs, or the request
  binding before provider execution.
- A receipt is finalized only when the provider result proves `ok`, response
  creation, endpoint contact, network egress, external transmission, and a
  SHA-256 request-content binding.
- The receipt binds execution task, source task, exact record ids and set hash,
  context hash, request hash, response contract, and receipt hash.
- The provider task outcome and its terminal experience record retain the
  validated receipt; Observer task detail shows only compact binding evidence.
- `providerConsumptionProven=true` means the governed provider returned after
  receiving the bound context. `downstreamAdvisoryApplicationProven=false` and
  `causalAttribution=false` remain mandatory.

## Evidence

- Contract tests cover four-record bounds, candidate absence without recall,
  every pre-consumption failure condition, receipt hashing, and tamper rejection.
- Context-packet tests prove the candidate is available only through the private
  Symbol and absent from enumerable compact evidence.
- Live-execution tests finalize and persist the receipt only after an injected
  successful provider response without performing network access.
- Experience-memory tests accept only a valid receipt, and Observer tests cover
  the compact task-detail readback.
- Core package closure explicitly contains the new receipt owner.

Acceptance on 2026-07-31 passed Core 874/874, Observer 76/76, workspace
typecheck, the native context-packet Core/Observer pair, Observer capability
invoke, and `body-config`. The exact Core closure contains 268 files at
`/nix/store/8gs0s49j99i1imsv3aq9hjy83d9gcp02-openclaw-core-0.1.0`; its new
receipt module is read-only. No real provider request, credential read, host
mutation, generation switch, or reboot occurred.

## Deferred

- proof that a later downstream engineering action applied the advisory;
- causal effectiveness, reward scoring, automatic confidence/ranking changes,
  training, or model updates;
- automatic provider calls, task creation/completion, retries, actions, host
  mutation, or physical generation activation.

## Next Real Capability

The next canonical review should select a downstream application receipt that explicitly binds
one operator-reviewed recommendation to a later governed task before using that
task's terminal outcome as effectiveness feedback. Do not derive application or
causality from provider delivery alone.
