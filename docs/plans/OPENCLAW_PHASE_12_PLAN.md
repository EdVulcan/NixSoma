# OpenClaw on NixOS Phase 12 Plan

Phase 12 starts after `openclaw-cloud-consciousness-live-provider-call-runbook-exit`. Phase 11 produced a human-visible live provider-call runbook without enabling live egress. Phase 12 records the final operator-visible live provider-call execution plan while still deferring real provider/network execution.

## Phase 12 Theme

Create the live provider-call execution plan without executing the live provider call.

This phase is intentionally narrow. It does not perform a live provider request, load a provider SDK, read credential values, contact endpoint hosts, transmit data externally, expand approval hardening, expand body repair, or expand plugin runtime work.

## Execution Plan Boundary

- Directory: `.artifacts/openclaw-cloud-consciousness`
- File: `.artifacts/openclaw-cloud-consciousness/live-provider-call-execution-plan.jsonl`
- Format: append-only JSONL
- Ownership: OpenClaw runtime artifacts only
- Cloud calls: none
- Provider SDK loading: none
- Credential value reads: none
- Endpoint contact: none
- External transmission: none
- Live provider call enabled: false

## Milestone Slices

1. `openclaw-cloud-consciousness-live-provider-call-execution-plan`
   - Confirms the Phase 11 local runbook is readable.
   - Selects the execution-plan route before any live provider egress.
   - Does not create a task, approval, SDK load, credential read, endpoint contact, or network call.

2. `openclaw-cloud-consciousness-live-provider-endpoint-credential-binding`
   - Defines endpoint fingerprint and credential-reference metadata.
   - Keeps endpoint host values and credential values unread.
   - Keeps endpoint contact disabled.

3. `openclaw-cloud-consciousness-live-provider-execution-transcript-schema`
   - Defines the local execution-plan transcript schema.
   - Requires runbook hash, endpoint fingerprint, credential reference, request envelope hash, and egress state.
   - Records `execution_plan_recorded`, not live execution.

4. `openclaw-cloud-consciousness-live-provider-execution-route-review`
   - Selects `openclaw-cloud-consciousness-live-provider-execution-plan-task`.
   - Defers actual provider egress to `openclaw-cloud-consciousness-live-provider-call-runtime-adapter-plan`.
   - Does not contact the provider.

5. `openclaw-cloud-consciousness-live-provider-execution-plan-task`
   - Creates an approval-gated local execution-plan task.
   - Does not write the JSONL artifact before approval.
   - Does not enable live provider execution.

6. `openclaw-cloud-consciousness-approved-live-provider-execution-plan`
   - After explicit approval, appends exactly one local live provider-call execution-plan JSONL record.
   - Does not call a cloud provider, load a provider SDK, read credentials, contact endpoints, or transmit externally.

7. `openclaw-cloud-consciousness-live-provider-execution-plan-readback`
   - Verifies schema, content hash, record count, and non-transmission status for the approved local execution plan.

8. `openclaw-cloud-consciousness-live-provider-call-execution-plan-exit`
   - Closes Phase 12 at 100%.
   - Points next to `openclaw-cloud-consciousness-live-provider-call-runtime-adapter-plan`.

## Exit Criteria

- `openclaw-cloud-consciousness-live-provider-call-execution-plan` is ready.
- `openclaw-cloud-consciousness-live-provider-endpoint-credential-binding` is ready without endpoint contact or credential reads.
- `openclaw-cloud-consciousness-live-provider-execution-transcript-schema` is ready.
- `openclaw-cloud-consciousness-live-provider-execution-route-review` defers live provider runtime adapter work.
- `openclaw-cloud-consciousness-live-provider-execution-plan-task` creates a task and approval.
- `openclaw-cloud-consciousness-approved-live-provider-execution-plan` appends one approved local execution-plan record.
- `openclaw-cloud-consciousness-live-provider-execution-plan-readback` verifies the local execution plan.
- `openclaw-cloud-consciousness-live-provider-call-execution-plan-exit` reports 100%.

## Targeted Check

```bash
OPENCLAW_MILESTONE_CHECKS=openclaw-cloud-consciousness-live-provider-call-execution-plan,observer-openclaw-cloud-consciousness-live-provider-call-execution-plan,openclaw-cloud-consciousness-live-provider-call-execution-plan-exit,observer-openclaw-cloud-consciousness-live-provider-call-execution-plan-exit npm run dev:milestone-check:unix
```
