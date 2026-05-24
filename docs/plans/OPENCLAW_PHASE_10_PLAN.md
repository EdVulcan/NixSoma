# OpenClaw on NixOS Phase 10 Plan

Phase 10 starts after `openclaw-cloud-consciousness-provider-adapter-exit`. Phase 9 defined a cloud-consciousness provider adapter contract and recorded a local dry-run transcript. Phase 10 prepares the real provider-call path with egress, credential, and redaction evidence, then records a local provider response rehearsal without external transmission.

## Phase 10 Theme

Prepare the real provider-call path with a local response rehearsal, without external transmission.

This phase is intentionally narrow. It does not perform a live provider request, load a provider SDK, read credential values, transmit data externally, expand approval hardening, expand body repair, or expand plugin runtime work.

## Provider Call Boundary

- Directory: `.artifacts/openclaw-cloud-consciousness`
- File: `.artifacts/openclaw-cloud-consciousness/provider-response-rehearsal.jsonl`
- Format: append-only JSONL
- Ownership: OpenClaw runtime artifacts only
- Cloud calls: none
- Provider SDK loading: none
- Credential value reads: none
- External transmission: none
- Provider credentials: excluded
- Raw user documents: excluded
- Secrets: excluded
- Raw screen pixels: excluded

## Milestone Slices

1. `openclaw-cloud-consciousness-real-provider-call-plan`
   - Confirms Phase 9 is complete.
   - Selects egress and credential preflight before any real provider-call work.

2. `openclaw-cloud-consciousness-provider-egress-contract`
   - Defines `openclaw.cloud_consciousness.provider_egress_contract.v0`.
   - Requires operator review, explicit endpoint, credential preflight, redaction review, and egress transcript before live calls.
   - Forbids network send, provider SDK loading, credential value reads, and external transmission in Phase 10.

3. `openclaw-cloud-consciousness-provider-credential-preflight`
   - Checks credential posture without reading credential values.
   - Keeps live provider calls disabled when endpoint and credential are absent.

4. `openclaw-cloud-consciousness-provider-request-redaction-review`
   - Reviews the Phase 9 provider request envelope.
   - Confirms provider credentials, secrets, raw documents, raw screen pixels, command stdout, and external account tokens are excluded.

5. `openclaw-cloud-consciousness-real-provider-call-route-review`
   - Selects a local approval-gated provider-call rehearsal task.
   - Defers live provider egress to `openclaw-cloud-consciousness-live-provider-call-runbook`.

6. `openclaw-cloud-consciousness-real-provider-call-task`
   - Creates an approval-gated provider-call rehearsal task and approval request.
   - Does not write the response rehearsal until approval and operator execution.

7. `openclaw-cloud-consciousness-approved-provider-call-rehearsal`
   - After approval, appends exactly one local provider response rehearsal JSONL record.
   - Does not read credentials, load a provider SDK, call a cloud model, or transmit externally.

8. `openclaw-cloud-consciousness-provider-response-readback`
   - Reads the local provider response rehearsal artifact back.
   - Verifies schema, request hash, latest record ID, content hash, credential-read status, SDK status, and non-transmission status.

9. `openclaw-cloud-consciousness-real-provider-call-exit`
   - Marks Phase 10 complete after the approved local provider response rehearsal is readable and audit-safe.
   - Points next to `openclaw-cloud-consciousness-live-provider-call-runbook`.

## Exit Criteria

Phase 10 is complete when:

- `openclaw-cloud-consciousness-real-provider-call-plan` is ready.
- `openclaw-cloud-consciousness-provider-egress-contract` is ready.
- `openclaw-cloud-consciousness-provider-credential-preflight` is ready without reading credential values.
- `openclaw-cloud-consciousness-provider-request-redaction-review` is ready.
- `openclaw-cloud-consciousness-real-provider-call-route-review` defers live provider egress.
- `openclaw-cloud-consciousness-real-provider-call-task` creates a task and approval.
- `openclaw-cloud-consciousness-approved-provider-call-rehearsal` appends one approved local response rehearsal record.
- `openclaw-cloud-consciousness-provider-response-readback` verifies the local response rehearsal.
- Observer can show every Phase 10 panel.
- `openclaw-cloud-consciousness-real-provider-call-exit` reports 100%.

## Full Check

```bash
OPENCLAW_MILESTONE_CHECKS=openclaw-cloud-consciousness-real-provider-call-plan,observer-openclaw-cloud-consciousness-real-provider-call-plan,openclaw-cloud-consciousness-provider-egress-contract,observer-openclaw-cloud-consciousness-provider-egress-contract,openclaw-cloud-consciousness-provider-credential-preflight,observer-openclaw-cloud-consciousness-provider-credential-preflight,openclaw-cloud-consciousness-provider-request-redaction-review,observer-openclaw-cloud-consciousness-provider-request-redaction-review,openclaw-cloud-consciousness-real-provider-call-route-review,observer-openclaw-cloud-consciousness-real-provider-call-route-review,openclaw-cloud-consciousness-real-provider-call-task,observer-openclaw-cloud-consciousness-real-provider-call-task,openclaw-cloud-consciousness-approved-provider-call-rehearsal,observer-openclaw-cloud-consciousness-approved-provider-call-rehearsal,openclaw-cloud-consciousness-provider-response-readback,observer-openclaw-cloud-consciousness-provider-response-readback,openclaw-cloud-consciousness-real-provider-call-exit,observer-openclaw-cloud-consciousness-real-provider-call-exit npm run dev:milestone-check:unix
```
