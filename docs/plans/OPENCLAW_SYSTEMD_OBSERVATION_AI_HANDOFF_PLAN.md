# NixSoma Systemd Observation AI Handoff Plan

Updated: 2026-07-18

## Purpose

Let an operator create a fresh, approval-gated DeepSeek diagnosis task from a
reviewed systemd observation receipt. The request reuses the existing provider
handoff, approval, credential, network, and execution owners instead of adding
another provider lane.

## Delivered Flow

```text
completed provider task with reviewed observation receipt
-> operator selects reviewed-observation mode in Observer
-> revalidate provider recommendation, original incident, receipt, unit, and hashes
-> build one compact fixed DeepSeek request locally
-> bind model, endpoint fingerprint, credential reference, request hash,
   context hash, source task, original incident hash, and observation hash
-> create a pending provider task and approval without endpoint contact
-> after separate approval, rebuild the same context and reject any drift
-> accept only review_systemd_incident_observation from the structured response
-> operator opens the exact provider task containing the observation receipt
```

## Context Contract

`openclaw-systemd-incident-observation-provider-context-v0` contains only the
fixed unit, original incident task/hash and outcome, observation timestamp,
health booleans, bounded journal counts, receipt hashes, and negative exposure
and authority flags. Journal messages, service URLs, provider output,
credentials, commands, and hostd evidence are excluded.

The global `engineering_recommendation_v0` contract now includes
`review_systemd_incident_observation`. Observation diagnosis additionally
enforces that exact action at execution time. Another otherwise valid action is
a response-contract failure, preventing recursive refresh/receipt chains.

## Authority Boundary

- Task creation is local but explicit operator selection is required.
- The new task always creates a pending approval before provider egress.
- Creating the task does not read a credential or contact the endpoint.
- Approval binds endpoint, model, request/context bytes, and both receipt hashes.
- Execution-time reconstruction rejects receipt or source drift.
- Provider guidance cannot refresh again, create a task, execute repair, invoke
  hostd, activate a generation, or authorize rollback.
- No real provider request is part of local validation.

## Evidence

- observation receipt structural and hash validation;
- deterministic context materialization and execution-time drift rejection;
- real egress task builder approval-binding test;
- mock provider execution with request-content and response-action assertions;
- Observer mutually exclusive context mode, exact request, and bound readback;
- full workspace, generated client, registry, path, and Nix closure validation.

## Next Real Capability

The bounded automatic incident scheduler selected here is complete in
`OPENCLAW_FIXED_UNIT_INCIDENT_SCHEDULER_PLAN.md`. Freeze both lanes. Continue
with one operator-reviewed local triage bridge from a scheduled incident into
the existing fixed repair planning owner, stopping before approval or execution.
