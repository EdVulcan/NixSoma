# OpenClaw on NixOS Phase 7 Plan

Phase 7 starts immediately after `openclaw-phase-6-exit`. Phase 6 proved the consciousness, memory, and task-orchestration context without writing durable memory. Phase 7 makes the first governed durable long-term memory write.

## Phase 7 Theme

Give the body its first governed long-term memory write.

This phase is intentionally narrow. It does not expand approval hardening, systemd repair, plugin adapters, provider sandboxes, cloud-consciousness calls, or broad host mutation.

## Storage Boundary

- Directory: `.artifacts/openclaw-long-term-memory`
- File: `.artifacts/openclaw-long-term-memory/long-term-memory.jsonl`
- Format: append-only JSONL
- Ownership: OpenClaw runtime artifacts only
- Cloud calls: none
- Cross-domain behavior: none
- User-owned documents: untouched

## Milestone Slices

1. `openclaw-long-term-memory-write-plan`
   - Selects the whitepaper-aligned Phase 7 route after Phase 6.
   - Confirms local OpenClaw-owned JSONL scope.

2. `openclaw-long-term-memory-schema`
   - Defines `openclaw.long_term_memory.v0`.
   - Requires source, summary, evidence pointers, retention, governance, and content hash.

3. `openclaw-long-term-memory-proposal`
   - Builds one operational lesson proposal from Phase 6 context.
   - Explicitly avoids bulk import.

4. `openclaw-long-term-memory-write-route-review`
   - Reviews the write route.
   - Selects the approval-gated write task shell without appending yet.

5. `openclaw-long-term-memory-write-task`
   - Creates an approval-gated task and approval request.
   - Still does not append until approval and operator execution.

6. `openclaw-long-term-memory-approved-write`
   - After approval, appends exactly one JSONL record.
   - Records task ID, approval ID, governance, evidence, retention, and content hash.

7. `openclaw-long-term-memory-readback`
   - Reads the JSONL back.
   - Verifies schema, record count, latest record ID, and content hash.

8. `openclaw-long-term-memory-exit`
   - Marks Phase 7 complete after the approved write is readable and auditable.
   - Points next to `openclaw-cloud-consciousness-context-review`.

## Exit Criteria

Phase 7 is complete when:

- `openclaw-long-term-memory-write-plan` is ready.
- `openclaw-long-term-memory-schema` is ready.
- `openclaw-long-term-memory-proposal` is ready.
- `openclaw-long-term-memory-write-route-review` selects the write task.
- `openclaw-long-term-memory-write-task` creates a task and approval.
- `openclaw-long-term-memory-approved-write` appends one approved record.
- `openclaw-long-term-memory-readback` verifies the record.
- Observer can show every Phase 7 panel.
- `openclaw-long-term-memory-exit` reports 100%.

## Full Check

```bash
OPENCLAW_MILESTONE_CHECKS=openclaw-long-term-memory-write-plan,observer-openclaw-long-term-memory-write-plan,openclaw-long-term-memory-schema,observer-openclaw-long-term-memory-schema,openclaw-long-term-memory-proposal,observer-openclaw-long-term-memory-proposal,openclaw-long-term-memory-write-route-review,observer-openclaw-long-term-memory-write-route-review,openclaw-long-term-memory-write-task,observer-openclaw-long-term-memory-write-task,openclaw-long-term-memory-approved-write,observer-openclaw-long-term-memory-approved-write,openclaw-long-term-memory-readback,observer-openclaw-long-term-memory-readback,openclaw-long-term-memory-exit,observer-openclaw-long-term-memory-exit npm run dev:milestone-check:unix
```
