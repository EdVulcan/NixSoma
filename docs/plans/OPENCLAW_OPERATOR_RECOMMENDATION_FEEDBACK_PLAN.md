# Operator Recommendation Feedback

Updated: 2026-08-01

Status: implemented and validated through Core, memory, route, Observer,
affected-check selection, and the full affected milestone gate. Physical
generation activation remains a separate deployment decision.

## Selected Capability

Close the missing human-feedback edge in the bounded memory workflow:

```text
reviewed provider recommendation
-> explicit governed downstream application
-> verified terminal outcome
-> operator selects helpful / not helpful / uncertain
-> durable hash-bound feedback observation
-> read-only effectiveness projection
```

This is a Level 1 durable-learning input. It makes an operator's judgment
inspectable without pretending that one rating proves causality or authorizes
automatic adaptation.

## Contract

- `POST /tasks/:taskId/recommendation-feedback` accepts only `confirm: true`
  and one rating from `helpful`, `not_helpful`, or `uncertain`.
- The task must be terminal and carry the existing validated recommendation
  outcome receipt. The receipt hash and terminal outcome are re-bound locally;
  callers cannot supply either binding.
- A task accepts one feedback receipt. Repeating the same rating is idempotent;
  changing an existing rating is rejected.
- Persistence contains the feedback registry, rating, terminal outcome, task
  id, recommendation outcome receipt hash, and receipt hashes. Comments, goal
  text, provider response content, URLs, credentials, and input values are not
  accepted or stored.
- Observer exposes the rating selector and records feedback for the selected
  terminal task through the existing Experience Effectiveness panel.
- Event Hub receives one compact `experience.operator_feedback_recorded` event.

## Governance

```text
explicit operator feedback required
outcome receipt and task id are locally revalidated
one-use per terminal task with same-rating idempotency
causalAttribution=false
recommendationEffectivenessProven=false
changesRanking=false
changesPolicy=false
trainsProvider=false
createsTask=false
createsApproval=false
executesAction=false
callsProvider=false
networkEgress=false
```

## Evidence

- `native-engineering-recommendation-feedback.test.mjs` proves receipt
  binding, rating bounds, and tamper rejection.
- `native-engineering-experience-memory.test.mjs` proves durable record
  attachment and effectiveness counts without learning claims.
- `task-manager.test.mjs` proves terminal binding and idempotency.
- `route-handlers.test.mjs` proves only the selected rating crosses the route
  and the event is compact.
- Observer engineering-context tests prove the served feedback controls and
  DOM contract.

## Deferred

- causal attribution, randomized experiments, automatic ranking, policy
  adaptation, model training, and provider feedback egress;
- automatic feedback inference from task status;
- repeated feedback history, free-form operator comments, and automatic task
  or approval creation;
- physical generation switching and host mutation.

## Next Route

Freeze this feedback edge after the changed-check and representative service
validation pass. The next product route is the separately authorized physical
deployment proof for the already implemented Level 3 process-lifecycle
observation, followed by a fresh review of broader body nerves or Phase D
mutation. Do not add another receipt-only feedback variant.
