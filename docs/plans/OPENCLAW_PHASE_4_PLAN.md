# OpenClaw on NixOS Phase 4 Plan

Updated: 2026-05-22

## Status

Phase 3 is complete through `openclaw-phase-3-exit`.

Phase 4 starts as a separate self-heal phase. It must not reopen Phase 2 repair expansion or Phase 3 foreground-control work.

## Whitepaper Direction

The whitepaper says OpenClaw's body sovereignty includes responsibility for maintaining body stability, recording risky actions, and staying subject to user sovereignty.

Phase 4 therefore means:

- Sense body health.
- Diagnose simple body faults.
- Apply conservative rule-based self-heal actions.
- Keep high-risk conditions observe-only.
- Record heal and maintenance history.
- Keep the Observer UI as the operator's visible control surface.

## Phase 4 Theme

`Let it care for its body.`

This follows the earlier MVP route:

- Detect key service health.
- Restart or recover simple body components.
- Leave evidence for failed or skipped repair.
- Show health and repair history in Observer.

## Allowed Slices

1. `openclaw-phase-4-plan`
   - Read-only Phase 4 route selection after Phase 3 exit.

2. `openclaw-phase-4-self-heal-loop`
   - Prove system-sense health evidence can drive conservative system-heal maintenance.

3. `openclaw-phase-4-heal-history-evidence`
   - Prove heal and maintenance history retain executed and skipped repair evidence.

4. `openclaw-phase-4-completion-readiness`
   - Read-only readiness bundle for the Phase 4 self-heal loop.

5. `openclaw-phase-4-exit`
   - Read-only Phase 4 exit gate that marks the phase complete and points to a separate `openclaw-phase-5-plan`.

## Boundaries

- No new real host mutation.
- No arbitrary `systemctl`.
- No scheduler expansion.
- No plugin/runtime adapter work.
- No persistence hardening loop.
- No denial-recovery or duplicate-click loop.
- No hidden repair beyond the existing conservative system-heal path.
- High-risk resource pressure remains observe-only.

## Exit Criteria

Phase 4 is complete when:

- Phase 3 exit is complete.
- System health is readable.
- System-heal exposes diagnose, autofix, maintenance, scheduler state, and history.
- A conservative maintenance run records at least one repairable service action.
- High-risk alerts remain skipped/observe-only.
- Observer can show health, heal history, maintenance state, and Phase 4 panels.
- Phase 4 completion readiness reports 100%.
- Phase 4 exit remains read-only.

## Canonical Checks

```bash
OPENCLAW_MILESTONE_CHECKS=openclaw-phase-4-plan,observer-openclaw-phase-4-plan,openclaw-phase-4-self-heal-loop,observer-openclaw-phase-4-self-heal-loop,openclaw-phase-4-heal-history-evidence,observer-openclaw-phase-4-heal-history-evidence,openclaw-phase-4-completion-readiness,observer-openclaw-phase-4-completion-readiness,openclaw-phase-4-exit,observer-openclaw-phase-4-exit npm run dev:milestone-check:unix
```
