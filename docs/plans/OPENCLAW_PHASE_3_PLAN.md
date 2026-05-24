# OpenClaw on NixOS Phase 3 Plan

Updated: 2026-05-22

## Status

Phase 2 is complete through `openclaw-phase-2-exit`.

Phase 3 starts as a separate product-experience phase. It must not reopen Phase 2 repair, ledger, approval-hardening, denial-recovery, duplicate-click, persistence, plugin/runtime adapter, or host-control loops.

## Whitepaper Direction

The whitepaper frames OpenClaw as a resident digital body under user sovereignty. Phase 3 should make that body feel resident rather than intrusive:

- It can keep an AI-owned work view.
- It should not steal the user's foreground by default.
- The user can observe it at any time.
- The user can pause, stop, or take over active work.

## Phase 3 Theme

`Let it work without stealing the foreground.`

This follows the earlier MVP route:

- AI work view is independent.
- Default execution is background/non-intrusive.
- Observer can show the AI's current work view.
- User can pause, stop, and take over.

## Allowed Slices

1. `openclaw-phase-3-plan`
   - Read-only Phase 3 route selection after Phase 2 exit.

2. `openclaw-phase-3-background-work-view`
   - Prove the AI work view defaults to hidden/background and remains observable through session/browser/screen metadata.

3. `openclaw-phase-3-operator-interrupt-controls`
   - Prove operator controls expose pause, resume, stop, and takeover without adding hidden automation.

4. `openclaw-phase-3-completion-readiness`
   - Read-only readiness bundle for the Phase 3 non-intrusive work loop.

5. `openclaw-phase-3-exit`
   - Read-only Phase 3 exit gate that marks the phase complete and points to a separate `openclaw-phase-4-plan`.

## Boundaries

- No new host mutation.
- No scheduler or background writer.
- No automatic repair.
- No plugin/runtime adapter work.
- No expanded command execution.
- No persistence hardening loop.
- No denial-recovery or duplicate-click loop.
- No hidden foreground stealing.

## Exit Criteria

Phase 3 is complete when:

- Phase 2 exit is complete.
- The Phase 3 plan is visible.
- The AI work view defaults to background/hidden.
- Observer can see Phase 3 work-view status.
- Operator controls expose pause, resume, stop, and takeover.
- Phase 3 completion readiness reports 100%.
- Phase 3 exit remains read-only.

## Canonical Checks

```bash
OPENCLAW_MILESTONE_CHECKS=openclaw-phase-3-plan,observer-openclaw-phase-3-plan,openclaw-phase-3-background-work-view,observer-openclaw-phase-3-background-work-view,openclaw-phase-3-operator-interrupt-controls,observer-openclaw-phase-3-operator-interrupt-controls,openclaw-phase-3-completion-readiness,observer-openclaw-phase-3-completion-readiness,openclaw-phase-3-exit,observer-openclaw-phase-3-exit npm run dev:milestone-check:unix
```
