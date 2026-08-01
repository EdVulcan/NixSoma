# NixSoma Task-Bound Recall Consumption Receipt

Updated: 2026-08-01

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
  receiving the bound context. The consumption receipt itself keeps
  `downstreamAdvisoryApplicationProven=false` and `causalAttribution=false`.
  A later validated recommendation link may project only this receipt's
  `receiptHash`; its downstream application receipt may then mark advisory
  application as proven without copying recalled record ids or context.

## Evidence

- Contract tests cover four-record bounds, candidate absence without recall,
  every pre-consumption failure condition, receipt hashing, and tamper rejection.
- Context-packet tests prove the candidate is available only through the private
  Symbol and absent from enumerable compact evidence.
- Live-execution tests finalize and persist the receipt only after an injected
  successful provider response without performing network access.
- Experience-memory tests accept only a valid receipt, and Observer tests cover
  the compact task-detail readback.
- Recommendation-link and application-receipt tests prove that only the
  validated receipt hash crosses into the downstream recommendation chain;
  legacy application receipts without that optional hash remain valid.
- Core package closure explicitly contains the new receipt owner.

Acceptance on 2026-07-31 passed Core 874/874, Observer 76/76, workspace
typecheck, the native context-packet Core/Observer pair, Observer capability
invoke, and `body-config`. The exact Core closure contains 268 files at
`/nix/store/8gs0s49j99i1imsv3aq9hjy83d9gcp02-openclaw-core-0.1.0`; its new
receipt module is read-only. No real provider request, credential read, host
mutation, generation switch, or reboot occurred.

The 2026-08-01 provenance continuation passed Core 900/900, Observer 95/95,
workspace typecheck/build, and touched-module syntax checks. It did not rerun
the Nix closure or physical deployment; no new module was added, and the
previous store-closure evidence remains the last closure record.

## Deferred

- causal effectiveness, reward scoring, automatic confidence/ranking changes,
  training, or model updates;
- automatic provider calls, task creation/completion, retries, actions, host
  mutation, or physical generation activation.

## Next Real Capability

The downstream application receipt now consumes the validated recall receipt by
hash only, when present. It binds one explicit operator-reviewed
recommendation to a later governed task without deriving execution, outcome,
effectiveness, or causality from provider delivery alone. The next route review
must select a distinct user capability rather than another memory or receipt
wrapper.
