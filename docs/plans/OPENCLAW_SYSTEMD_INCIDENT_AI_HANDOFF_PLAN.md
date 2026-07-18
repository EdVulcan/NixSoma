# NixSoma Systemd Incident AI Handoff Plan

Updated: 2026-07-18

## Purpose

Close one governed Level 3 diagnosis loop by projecting an existing terminal
systemd repair receipt into the existing explicitly approved DeepSeek handoff.
The provider receives only bounded incident facts and returns the existing
`engineering_recommendation_v0` guidance contract.

This is not a new provider lane or a new repair authority. It reuses the
existing provider task, approval, exact request binding, Operator Step/Run,
DeepSeek sender, structured response parser, and Observer recommendation owner.

## Delivered Flow

```text
terminal fixed systemd repair task
-> verify the content-hashed incident receipt
-> remove journal messages, URLs, errors, invocation identity, and raw job path
-> create one exact request-bound pending provider task
-> require the existing high-risk provider approval
-> reconstruct and revalidate the same request at Operator Step/Run
-> parse engineering_recommendation_v0
-> return transient operator guidance
```

The source task must be a completed or failed `systemd_next_repair_task`. Core
recomputes the incident receipt hash, verifies task/step/target/health-key
binding, and rejects an unsafe journal projection. The persisted provider task
contains only the bounded projection and compact hashes needed to reconstruct
and verify the approved request.

Incident mode does not accept a caller-supplied prompt, context hash, response
schema, or unrelated context selectors. After approval, execution rebuilds the
projection from the authoritative source task and fails closed if either the
source receipt or stored projection changed.

## Provider Boundary

The provider-facing projection may include:

- fixed target unit and health-service key;
- bounded pre/post native unit and application-health state;
- journal availability and counts, without entries or messages;
- compact native restart method, owner, PID transition, and success state;
- final restored-health and operator-recovery flags.

It excludes service URLs, health error text, journal messages, credentials,
hostd invocation ids, peer identity, and raw D-Bus job paths. Provider output
remains transient. Durable evidence keeps only the existing structured
recommendation metadata and compact incident provenance.

## Authority Boundary

- Creating the handoff task does not read the credential or contact DeepSeek.
- The existing explicit provider approval remains mandatory.
- A recommendation cannot create a task or approval, execute a control, invoke
  hostd, issue another restart, activate a generation, or roll back the host.
- Observer requires an explicit operator action before using any allowlisted
  recommendation control, and that control retains its own approval boundary.
- No real provider contact was executed during this slice on the sole physical
  host; injected sender tests prove the complete request/response contract.

## Evidence

- `services/openclaw-core/src/systemd-incident-provider-context.mjs`
- focused context, handoff, task-executor, live-provider, and Observer tests
- body-config source-closure and changed-check selector assertions
- full workspace tests, typecheck, registry, script audit, and Windows path
  budget checks at slice closure

## Deferred

- automatic provider calls or automatic source-task selection;
- persistence of provider reasons or raw responses;
- journal-message egress;
- a systemd-specific provider response schema;
- recommendation-driven repair, retry, activation, or rollback;
- real DeepSeek contact without a separately approved execution.

## Next Real Capability

Use the existing advisory experience-memory owner to retain a bounded,
target-specific pattern from terminal incident receipts and recall it for a
later matching incident. Keep the learned evidence local and advisory: it must
not retain journal text or provider output, create a provider request, or
authorize another repair. This advances experience-based diagnosis without
reopening the completed provider handoff.
