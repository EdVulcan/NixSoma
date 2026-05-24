# OpenClaw on NixOS Phase 6 Plan

Updated: 2026-05-22

## Status

Post-MVP route selection is complete through `openclaw-post-mvp-plan`.

Phase 6 starts the consciousness, memory, and task-orchestration trunk. It is a read-only proof of structure before any durable long-term memory writes or cloud-consciousness calls.

## Whitepaper Direction

The whitepaper defines OpenClaw consciousness as the layer that understands body state, generates decisions, integrates long-term memory, and orchestrates work. After the resident body MVP, the next jump is to make the body produce consciousness-grade context and task records.

## Phase 6 Theme

`Give the body a memory-bearing task mind.`

## Allowed Slices

1. `openclaw-phase-6-consciousness-memory-plan`
   - Read-only Phase 6 route selection after `openclaw-post-mvp-plan`.

2. `openclaw-phase-6-memory-substrate-inventory`
   - Read-only inventory of existing task history, event audit, capability history, body evidence ledger, heal history, and Observer evidence.

3. `openclaw-phase-6-consciousness-context-envelope`
   - Read-only body-state, work-view, task-state, memory-pointer, and sovereignty envelope intended for future cloud consciousness.

4. `openclaw-phase-6-task-orchestration-records`
   - Read-only goal decomposition, dependency, and next-action records without scheduling new tasks.

5. `openclaw-phase-6-memory-write-route-review`
   - Read-only decision that durable memory writes and cloud-consciousness calls remain deferred to a separate phase.

6. `openclaw-phase-6-exit`
   - Read-only exit gate proving Phase 6 is complete and pointing to a separate `openclaw-long-term-memory-write-plan`.

## Boundaries

- No durable memory writes.
- No cloud-consciousness calls.
- No new task scheduling.
- No cross-domain behavior.
- No host mutation.
- No repair expansion.
- No plugin/runtime adapter work.
- No approval, denial-recovery, duplicate-click, or persistence-hardening loop.

## Exit Criteria

Phase 6 is complete when:

- Post-MVP route is complete.
- Memory substrate inventory is visible.
- Consciousness context envelope is available and not transmitted.
- Task orchestration records exist and do not execute.
- Memory write route review defers durable writes to a separate phase.
- Observer can show all Phase 6 panels.
- Phase 6 exit reports 100%.

## Canonical Checks

```bash
OPENCLAW_MILESTONE_CHECKS=openclaw-phase-6-consciousness-memory-plan,observer-openclaw-phase-6-consciousness-memory-plan,openclaw-phase-6-memory-substrate-inventory,observer-openclaw-phase-6-memory-substrate-inventory,openclaw-phase-6-consciousness-context-envelope,observer-openclaw-phase-6-consciousness-context-envelope,openclaw-phase-6-task-orchestration-records,observer-openclaw-phase-6-task-orchestration-records,openclaw-phase-6-memory-write-route-review,observer-openclaw-phase-6-memory-write-route-review,openclaw-phase-6-exit,observer-openclaw-phase-6-exit npm run dev:milestone-check:unix
```
