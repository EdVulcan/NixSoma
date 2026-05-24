# OpenClaw on NixOS Phase 9 Plan

Phase 9 starts after `openclaw-cloud-consciousness-exit`. Phase 8 prepared and approved a local cloud-consciousness context handoff. Phase 9 defines a provider adapter contract and records a local dry-run transcript without transmitting anything to a provider.

## Phase 9 Theme

Define and dry-run a cloud-consciousness provider adapter without external transmission.

This phase is intentionally narrow. It does not add a real provider SDK, call a cloud model, transmit data externally, store provider credentials, expand approval hardening, expand body repair, or expand plugin runtime work.

## Provider Adapter Boundary

- Directory: `.artifacts/openclaw-cloud-consciousness`
- File: `.artifacts/openclaw-cloud-consciousness/provider-dry-run.jsonl`
- Format: append-only JSONL
- Ownership: OpenClaw runtime artifacts only
- Cloud calls: none
- Provider SDK loading: none
- External transmission: none
- Provider credentials: excluded
- Raw user documents: excluded
- Secrets: excluded
- Raw screen pixels: excluded

## Milestone Slices

1. `openclaw-cloud-consciousness-provider-adapter-plan`
   - Confirms Phase 8 is complete.
   - Selects provider adapter contract work before any SDK or network call.

2. `openclaw-cloud-consciousness-provider-contract`
   - Defines `openclaw.cloud_consciousness.provider_adapter.contract.v0`.
   - Requires request preparation, governance validation, and local dry-run transcript recording.
   - Forbids provider SDK loading, credentials, network send, and real cloud calls.

3. `openclaw-cloud-consciousness-provider-request-envelope`
   - Defines `openclaw.cloud_consciousness.provider_request.v0`.
   - Links the approved Phase 8 handoff record and content hash.
   - Keeps the envelope dry-run only and credential-free.

4. `openclaw-cloud-consciousness-provider-dry-run-route-review`
   - Selects a local approval-gated provider dry-run task.
   - Defers real provider calls to `openclaw-cloud-consciousness-real-provider-call-plan`.

5. `openclaw-cloud-consciousness-provider-dry-run-task`
   - Creates an approval-gated provider adapter dry-run task and approval request.
   - Does not write the dry-run transcript until approval and operator execution.

6. `openclaw-cloud-consciousness-approved-provider-dry-run`
   - After approval, appends exactly one local provider dry-run JSONL record.
   - Does not load a provider SDK, call a cloud model, or transmit externally.

7. `openclaw-cloud-consciousness-provider-dry-run-readback`
   - Reads the local provider dry-run artifact back.
   - Verifies schema, request hash, latest record ID, content hash, and non-transmission status.

8. `openclaw-cloud-consciousness-provider-adapter-exit`
   - Marks Phase 9 complete after the approved local provider dry-run transcript is readable and audit-safe.
   - Points next to `openclaw-cloud-consciousness-real-provider-call-plan`.

## Exit Criteria

Phase 9 is complete when:

- `openclaw-cloud-consciousness-provider-adapter-plan` is ready.
- `openclaw-cloud-consciousness-provider-contract` is ready.
- `openclaw-cloud-consciousness-provider-request-envelope` is ready.
- `openclaw-cloud-consciousness-provider-dry-run-route-review` defers real provider calls.
- `openclaw-cloud-consciousness-provider-dry-run-task` creates a task and approval.
- `openclaw-cloud-consciousness-approved-provider-dry-run` appends one approved local record.
- `openclaw-cloud-consciousness-provider-dry-run-readback` verifies the local dry-run transcript.
- Observer can show every Phase 9 panel.
- `openclaw-cloud-consciousness-provider-adapter-exit` reports 100%.

## Full Check

```bash
OPENCLAW_MILESTONE_CHECKS=openclaw-cloud-consciousness-provider-adapter-plan,observer-openclaw-cloud-consciousness-provider-adapter-plan,openclaw-cloud-consciousness-provider-contract,observer-openclaw-cloud-consciousness-provider-contract,openclaw-cloud-consciousness-provider-request-envelope,observer-openclaw-cloud-consciousness-provider-request-envelope,openclaw-cloud-consciousness-provider-dry-run-route-review,observer-openclaw-cloud-consciousness-provider-dry-run-route-review,openclaw-cloud-consciousness-provider-dry-run-task,observer-openclaw-cloud-consciousness-provider-dry-run-task,openclaw-cloud-consciousness-approved-provider-dry-run,observer-openclaw-cloud-consciousness-approved-provider-dry-run,openclaw-cloud-consciousness-provider-dry-run-readback,observer-openclaw-cloud-consciousness-provider-dry-run-readback,openclaw-cloud-consciousness-provider-adapter-exit,observer-openclaw-cloud-consciousness-provider-adapter-exit npm run dev:milestone-check:unix
```
