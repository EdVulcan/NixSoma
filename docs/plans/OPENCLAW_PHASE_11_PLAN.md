# OpenClaw on NixOS Phase 11 Plan

Phase 11 starts after `openclaw-cloud-consciousness-real-provider-call-exit`. Phase 10 prepared the real provider-call path and recorded a local response rehearsal. Phase 11 creates the human-visible live provider-call runbook without enabling live provider egress.

## Phase 11 Theme

Prepare the live provider-call runbook without enabling external transmission.

This phase is intentionally narrow. It does not perform a live provider request, load a provider SDK, read credential values, transmit data externally, expand approval hardening, expand body repair, or expand plugin runtime work.

## Runbook Boundary

- Directory: `.artifacts/openclaw-cloud-consciousness`
- File: `.artifacts/openclaw-cloud-consciousness/live-provider-call-runbook.jsonl`
- Format: append-only JSONL
- Ownership: OpenClaw runtime artifacts only
- Cloud calls: none
- Provider SDK loading: none
- Credential value reads: none
- External transmission: none
- Live provider call enabled: false

## Milestone Slices

1. `openclaw-cloud-consciousness-live-provider-call-runbook`
   - Confirms Phase 10 is complete.
   - Selects a human-visible runbook before any live provider egress.

2. `openclaw-cloud-consciousness-live-provider-operator-checklist`
   - Defines endpoint, credential source, request hash, redaction, egress transcript, and revocation checks.
   - Keeps live provider calls disabled.

3. `openclaw-cloud-consciousness-live-provider-egress-transcript-schema`
   - Defines `openclaw.cloud_consciousness.live_provider_egress_transcript.v0`.
   - Allows only `not_enabled` live-call status in Phase 11.

4. `openclaw-cloud-consciousness-live-provider-final-authorization-review`
   - Links the Phase 10 response rehearsal readback.
   - Records that live egress is not authorized in Phase 11.

5. `openclaw-cloud-consciousness-live-provider-runbook-route-review`
   - Selects a local approval-gated runbook task.
   - Defers actual live provider egress to `openclaw-cloud-consciousness-live-provider-call-execution-plan`.

6. `openclaw-cloud-consciousness-live-provider-runbook-task`
   - Creates an approval-gated runbook task and approval request.
   - Does not write the runbook until approval and operator execution.

7. `openclaw-cloud-consciousness-approved-live-provider-runbook`
   - After approval, appends exactly one local live provider-call runbook JSONL record.
   - Does not enable live calls, read credentials, load a provider SDK, call a cloud model, or transmit externally.

8. `openclaw-cloud-consciousness-live-provider-runbook-readback`
   - Reads the local runbook artifact back.
   - Verifies schema, response hash, latest record ID, content hash, live-call status, credential-read status, SDK status, and non-transmission status.

9. `openclaw-cloud-consciousness-live-provider-call-runbook-exit`
   - Marks Phase 11 complete after the approved local runbook is readable and audit-safe.
   - Points next to `openclaw-cloud-consciousness-live-provider-call-execution-plan`.

## Exit Criteria

Phase 11 is complete when:

- `openclaw-cloud-consciousness-live-provider-call-runbook` is ready.
- `openclaw-cloud-consciousness-live-provider-operator-checklist` is ready.
- `openclaw-cloud-consciousness-live-provider-egress-transcript-schema` is ready.
- `openclaw-cloud-consciousness-live-provider-final-authorization-review` is ready without enabling live egress.
- `openclaw-cloud-consciousness-live-provider-runbook-route-review` defers actual live provider egress.
- `openclaw-cloud-consciousness-live-provider-runbook-task` creates a task and approval.
- `openclaw-cloud-consciousness-approved-live-provider-runbook` appends one approved local runbook record.
- `openclaw-cloud-consciousness-live-provider-runbook-readback` verifies the local runbook.
- Observer can show every Phase 11 panel.
- `openclaw-cloud-consciousness-live-provider-call-runbook-exit` reports 100%.

## Full Check

```bash
OPENCLAW_MILESTONE_CHECKS=openclaw-cloud-consciousness-live-provider-call-runbook,observer-openclaw-cloud-consciousness-live-provider-call-runbook,openclaw-cloud-consciousness-live-provider-operator-checklist,observer-openclaw-cloud-consciousness-live-provider-operator-checklist,openclaw-cloud-consciousness-live-provider-egress-transcript-schema,observer-openclaw-cloud-consciousness-live-provider-egress-transcript-schema,openclaw-cloud-consciousness-live-provider-final-authorization-review,observer-openclaw-cloud-consciousness-live-provider-final-authorization-review,openclaw-cloud-consciousness-live-provider-runbook-route-review,observer-openclaw-cloud-consciousness-live-provider-runbook-route-review,openclaw-cloud-consciousness-live-provider-runbook-task,observer-openclaw-cloud-consciousness-live-provider-runbook-task,openclaw-cloud-consciousness-approved-live-provider-runbook,observer-openclaw-cloud-consciousness-approved-live-provider-runbook,openclaw-cloud-consciousness-live-provider-runbook-readback,observer-openclaw-cloud-consciousness-live-provider-runbook-readback,openclaw-cloud-consciousness-live-provider-call-runbook-exit,observer-openclaw-cloud-consciousness-live-provider-call-runbook-exit npm run dev:milestone-check:unix
```
