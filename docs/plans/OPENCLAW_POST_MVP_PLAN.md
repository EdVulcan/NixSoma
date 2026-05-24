# OpenClaw on NixOS Post-MVP Plan

Updated: 2026-05-22

## Status

First-stage MVP is complete through `openclaw-mvp-final-readiness`.

This is a post-MVP route selection document. It exists to prevent drift after MVP completion: the next work must deepen the whitepaper vision instead of extending the old repair, approval, persistence, or plugin/runtime hardening loops.

## Whitepaper Direction

After the resident body can run, see, act, recover, stay visible, and expose deployment/rollback control, the next bottleneck is not another body shell. The whitepaper points to a higher layer:

- OpenClaw consciousness understands body state, plans, learns, and generates decisions.
- Long-term memory integrates prior body/task experience.
- Autonomous task orchestration organizes domain-internal work under user sovereignty.
- Cross-domain border law remains critical, but should govern real outward intent after the internal cognition loop exists.

## Selected Post-MVP Trunk

`Give the body a memory-bearing task mind.`

The next major trunk is:

`openclaw-phase-6-consciousness-memory-plan`

Phase 6 should begin with a read-only plan for:

- Runtime memory substrate.
- Goal decomposition and task-orchestration records.
- Body-state-to-consciousness context envelopes.
- Observer visibility for memory/task reasoning.
- Boundaries before durable memory writes or cloud-consciousness calls.

## Deferred Trunks

- Cross-domain border governance.
  - Deferred until internal task intent is concrete enough for border rules to govern real outward behavior.

- Body configuration generation and verified rollback.
  - Deferred until memory and orchestration can explain why a body config change is proposed.

- Plugin/runtime adapter expansion.
  - Deferred unless it directly unlocks the selected consciousness/memory/task trunk.

## Boundaries

- No memory writes yet.
- No cloud model calls yet.
- No cross-domain behavior yet.
- No release automation.
- No rollback execution.
- No plugin/runtime adapter work.
- No approval, denial-recovery, duplicate-click, or persistence-hardening loop.

## Canonical Checks

```bash
OPENCLAW_MILESTONE_CHECKS=openclaw-post-mvp-plan,observer-openclaw-post-mvp-plan npm run dev:milestone-check:unix
```
