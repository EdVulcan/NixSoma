# OpenClaw on NixOS Phase 8 Plan

Phase 8 starts after `openclaw-long-term-memory-exit`. Phase 7 gave the body its first governed local long-term memory write. Phase 8 prepares a cloud-consciousness context handoff without transmitting it to any provider.

## Phase 8 Theme

Prepare the first cloud-consciousness context without transmitting it.

This phase is intentionally narrow. It does not add a provider SDK, call a cloud model, transmit data externally, expand approval hardening, expand systemd repair, or expand plugin runtime work.

## Handoff Boundary

- Directory: `.artifacts/openclaw-cloud-consciousness`
- File: `.artifacts/openclaw-cloud-consciousness/context-handoff.jsonl`
- Format: append-only JSONL
- Ownership: OpenClaw runtime artifacts only
- Cloud calls: none
- External transmission: none
- Raw user documents: excluded
- Secrets: excluded
- Raw screen pixels: excluded

## Milestone Slices

1. `openclaw-cloud-consciousness-context-review`
   - Confirms Phase 7 is complete.
   - Selects local context review before any cloud-consciousness provider call.

2. `openclaw-cloud-consciousness-envelope-schema`
   - Defines `openclaw.cloud_consciousness.context_handoff.v0`.
   - Requires body context, memory context, task context, sovereignty, redaction, transmission, and content hash.

3. `openclaw-cloud-consciousness-context-package`
   - Assembles a bounded local context package from body state, task summary, and long-term memory readback.
   - Keeps the package untransmitted.

4. `openclaw-cloud-consciousness-redaction-review`
   - Confirms raw documents, secrets, raw screen pixels, command stdout, and external tokens are excluded.
   - Keeps operator review required.

5. `openclaw-cloud-consciousness-transmission-route-review`
   - Selects a local approval-gated handoff artifact task.
   - Defers real provider calls to `openclaw-cloud-consciousness-provider-adapter-plan`.

6. `openclaw-cloud-consciousness-handoff-task`
   - Creates an approval-gated task and approval request.
   - Does not write the local handoff artifact until approval and operator execution.

7. `openclaw-cloud-consciousness-approved-handoff`
   - After approval, appends exactly one local handoff JSONL record.
   - Does not call a cloud model or transmit externally.

8. `openclaw-cloud-consciousness-handoff-readback`
   - Reads the local handoff artifact back.
   - Verifies schema, latest record ID, content hash, and non-transmission status.

9. `openclaw-cloud-consciousness-exit`
   - Marks Phase 8 complete after the approved local handoff is readable and audit-safe.
   - Points next to `openclaw-cloud-consciousness-provider-adapter-plan`.

## Exit Criteria

Phase 8 is complete when:

- `openclaw-cloud-consciousness-context-review` is ready.
- `openclaw-cloud-consciousness-envelope-schema` is ready.
- `openclaw-cloud-consciousness-context-package` is ready.
- `openclaw-cloud-consciousness-redaction-review` is ready.
- `openclaw-cloud-consciousness-transmission-route-review` defers provider calls.
- `openclaw-cloud-consciousness-handoff-task` creates a task and approval.
- `openclaw-cloud-consciousness-approved-handoff` appends one approved local record.
- `openclaw-cloud-consciousness-handoff-readback` verifies the local handoff.
- Observer can show every Phase 8 panel.
- `openclaw-cloud-consciousness-exit` reports 100%.

## Full Check

```bash
OPENCLAW_MILESTONE_CHECKS=openclaw-cloud-consciousness-context-review,observer-openclaw-cloud-consciousness-context-review,openclaw-cloud-consciousness-envelope-schema,observer-openclaw-cloud-consciousness-envelope-schema,openclaw-cloud-consciousness-context-package,observer-openclaw-cloud-consciousness-context-package,openclaw-cloud-consciousness-redaction-review,observer-openclaw-cloud-consciousness-redaction-review,openclaw-cloud-consciousness-transmission-route-review,observer-openclaw-cloud-consciousness-transmission-route-review,openclaw-cloud-consciousness-handoff-task,observer-openclaw-cloud-consciousness-handoff-task,openclaw-cloud-consciousness-approved-handoff,observer-openclaw-cloud-consciousness-approved-handoff,openclaw-cloud-consciousness-handoff-readback,observer-openclaw-cloud-consciousness-handoff-readback,openclaw-cloud-consciousness-exit,observer-openclaw-cloud-consciousness-exit npm run dev:milestone-check:unix
```
