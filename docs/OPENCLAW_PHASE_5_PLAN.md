# OpenClaw on NixOS Phase 5 Plan

Updated: 2026-05-22

## Status

Phase 4 is complete through `openclaw-phase-4-exit`.

Phase 5 starts as a separate deployment and rollback control phase. It must not reopen Phase 2 repair expansion, Phase 3 foreground-control work, Phase 4 self-heal expansion, or the earlier plugin/runtime hardening loop.

## Whitepaper Direction

The first MVP succeeds when OpenClaw can stay resident, see, act, work in the background, remain visible to the user, recover basic service faults, and keep overall deployment and rollback controllable.

Phase 5 therefore means:

- Inventory the NixOS body deployment surface.
- Show the deployed service/module/profile boundary.
- Document rollback surfaces before any real rollback.
- Keep release control visible in Observer.
- Keep rebuild, switch, and rollback execution outside this read-only phase.

## Phase 5 Theme

`Make deployment and rollback controllable.`

This follows the MVP success criterion:

- Overall deployment is known and repeatable.
- Rollback surfaces are explicit.
- Release control is visible to the operator.
- No hidden rebuild, switch, rollback, or host mutation happens during readiness checks.

## Allowed Slices

1. `openclaw-phase-5-plan`
   - Read-only Phase 5 route selection after Phase 4 exit.

2. `openclaw-phase-5-deployment-inventory`
   - Read-only inventory of NixOS modules, profiles, lifecycle scripts, and resident OpenClaw services.

3. `openclaw-phase-5-rollback-readiness`
   - Read-only rollback readiness bundle that names NixOS generation rollback, source rollback, service repair evidence, and dev lifecycle recovery surfaces.

4. `openclaw-phase-5-release-control-readiness`
   - Read-only readiness gate that proves deployment and rollback surfaces are operator-visible.

5. `openclaw-phase-5-exit`
   - Read-only Phase 5 exit gate that marks deployment and rollback control complete and points to `openclaw-mvp-final-readiness`.

## Boundaries

- No `nixos-rebuild switch`.
- No generation switch or rollback execution.
- No `git reset`, destructive source rollback, or source mutation.
- No new systemd restart path.
- No new approval/hardening loop.
- No plugin/runtime adapter work.
- No denial-recovery, duplicate-click, or persistence hardening loop.
- No hidden release automation.

## Exit Criteria

Phase 5 is complete when:

- Phase 4 exit is complete.
- The NixOS module/profile/script deployment inventory is visible.
- OpenClaw resident service health is visible.
- Rollback surfaces are explicit and not executed.
- Observer can show Phase 5 plan, deployment inventory, rollback readiness, release control readiness, and exit.
- Phase 5 release control readiness reports 100%.
- Phase 5 exit remains read-only.

## Canonical Checks

```bash
OPENCLAW_MILESTONE_CHECKS=openclaw-phase-5-plan,observer-openclaw-phase-5-plan,openclaw-phase-5-deployment-inventory,observer-openclaw-phase-5-deployment-inventory,openclaw-phase-5-rollback-readiness,observer-openclaw-phase-5-rollback-readiness,openclaw-phase-5-release-control-readiness,observer-openclaw-phase-5-release-control-readiness,openclaw-phase-5-exit,observer-openclaw-phase-5-exit npm run dev:milestone-check:unix
```
