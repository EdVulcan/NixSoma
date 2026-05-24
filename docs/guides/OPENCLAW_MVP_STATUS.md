# OpenClaw on NixOS MVP Status

Updated: 2026-05-19

## Status

First-stage MVP readiness is passed.

Current estimate:

- First-stage MVP: 88% - 90%
- Full whitepaper vision: about 35%

This status is based on the whitepaper direction that OpenClaw should first become a resident digital body with eyes, hands, observer visibility, and recovery responsibility under user sovereignty. It is not a count of all milestone scripts.

## Passed Mainline

The first-stage body loop is now validated across these slices:

- Body: NixOS body module, profiles, systemd service skeleton, and service startup checks.
- Eyes: browser-runtime-backed AI work view capture through screen-sense.
- Hands: screen-act actions linked to final AI work view observations.
- Observer: task state, work view summaries, action evidence, recovery evidence, health, and route alignment are visible.
- Task recovery: failed browser work carries recovery evidence and can auto-recover from the recommended target.
- Body health: system-sense snapshots drive conservative system-heal diagnosis and simulated self-heal evidence.
- Route alignment: `/mvp/route` points away from plugin/runtime hardening loops and back to the MVP body loop.
- Readiness: `openclaw-mvp-readiness` and `observer-openclaw-mvp-readiness` passed on NixOS.

## Demonstration Path

Use this as the human demo route for first-stage MVP:

1. Start OpenClaw services.
2. Open or prepare the AI work view.
3. Capture the work view through browser-runtime and screen-sense.
4. Execute a simple screen action through screen-act.
5. Verify the task with final work view observation evidence.
6. Trigger a failed verification and show recovery evidence.
7. Run auto recovery from the evidence-driven target URL.
8. Read system health through system-sense.
9. Run conservative self-heal evidence through system-heal.
10. Show all of the above in Observer: task history, action evidence, recovery evidence, system health, heal history, maintenance state, and MVP route.

## Canonical Checks

Run this pair for first-stage readiness:

```bash
OPENCLAW_MILESTONE_CHECKS=openclaw-mvp-readiness,observer-openclaw-mvp-readiness npm run dev:milestone-check:unix
```

Supporting checks:

- `openclaw-mvp-route-alignment`
- `observer-openclaw-mvp-route-alignment`
- `openclaw-eye-hand-recovery-regression`
- `observer-openclaw-eye-hand-recovery-regression`
- `openclaw-system-health-self-heal-evidence`
- `observer-openclaw-system-health-self-heal-evidence`

## Remaining MVP Tail

The remaining first-stage work should stay small and exit-oriented:

- Record a short manual demo transcript or screenshots from the NixOS run.
- Keep Observer wording aligned with the demo path.
- Do only bug fixes that block readiness or the demo.
- Re-check the whitepaper after each milestone before choosing the next task.

## Explicit Non-Goals For This Stage

Do not continue first-stage work by expanding these loops:

- Plugin runtime adapter hardening.
- Approval expiry, duplicate click, denial recovery, or persistence chains unless they block the demo.
- Source integration depth.
- Complex desktop action DSL.
- Body configuration generation or multi-body switching.
- High-risk autonomous repair.

These belong to a later phase after the first-stage body loop has a clean release/demo exit.

## Next Phase Boundary

The next phase should begin only after the first-stage demo is documented. Its focus should be chosen from the whitepaper route, not from whichever safety boundary is easiest to extend.

Likely next-phase candidates:

- Stronger real NixOS/systemd repair semantics.
- A more concrete operator-facing demo workflow.
- Controlled expansion of body governance.
- Plugin/runtime work only if it directly supports the next visible body capability.
