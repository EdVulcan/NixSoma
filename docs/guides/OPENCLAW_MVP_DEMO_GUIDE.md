# OpenClaw on NixOS MVP Demo Guide

Updated: 2026-05-19

## Purpose

This guide is the first-stage MVP human demo path. It demonstrates that OpenClaw has a resident body, eyes, hands, Observer visibility, task recovery, and conservative body self-heal evidence.

This is an exit/demo guide, not a new feature plan.

## Preconditions

- Run on the NixOS OpenClaw host.
- Pull the latest `main`.
- Keep the demo focused on first-stage MVP body-loop behavior.
- Do not expand plugin runtime adapter, approval hardening, denial recovery, duplicate-click, or persistence chains during this demo.

## Readiness Command

Run the canonical readiness regression first:

```bash
cd /home/edvulcan/OpenClaw_On_NixOS && \
git pull origin main && \
OPENCLAW_MILESTONE_CHECKS=openclaw-mvp-readiness,observer-openclaw-mvp-readiness npm run dev:milestone-check:unix
```

Expected result:

- `openclaw-mvp-readiness` passes.
- `observer-openclaw-mvp-readiness` passes.
- Summary reports `failed: 0`.

## Demo Path

1. Start OpenClaw services through the milestone check or dev service script.
2. Open Observer UI and confirm service health is visible.
3. Prepare or open the AI work view.
4. Capture the work view through browser-runtime and screen-sense.
5. Confirm screen-sense exposes capture source, capture strategy, active URL, and work view summary.
6. Execute a simple screen-act action.
7. Confirm task verification links the action evidence to the final AI work view observation.
8. Trigger or review a failed verification path.
9. Confirm failed task recovery evidence includes the failed observation and recommended target URL.
10. Run or review auto recovery from the evidence-driven target URL.
11. Read system health through system-sense.
12. Run or review conservative system-heal evidence.
13. Confirm high-risk resource pressure remains observe-only.
14. Show Observer panels for task history, action evidence, recovery evidence, system health, heal history, maintenance state, and MVP route.
15. Open `/mvp/route` or the Observer MVP Route panel and confirm the next trunk points to body health/self-heal, not plugin/runtime hardening.

## Evidence Checklist

The demo is complete when these evidence points are visible:

- Body: services start and report health.
- Eyes: AI work view capture is browser-runtime-backed.
- Hands: screen-act records a visible action.
- Verification: task verification records final work view summary evidence.
- Recovery: failed task has recovery evidence and a recommended target URL.
- Auto recovery: recovery execution uses the evidence-driven target URL.
- System health: system-sense reports body, service, resource, network, and alert state.
- Self-heal: system-heal records conservative diagnosis and simulated repair evidence.
- Safety posture: high-risk resource alerts are observe-only, not auto-mutated.
- Observer: the operator can inspect the above from the UI.
- Route: MVP route stays on the body loop and avoids plugin/runtime hardening loops.

## Pass Criteria

The first-stage MVP demo passes if:

- The readiness command passes on NixOS.
- Observer can show the body loop evidence without requiring hidden logs.
- The demo can be explained as `body -> eyes -> hands -> observer -> recovery -> body health/self-heal`.
- No new first-stage work is opened for plugin runtime adapter hardening, approval hardening, denial recovery, duplicate-click hardening, or persistence hardening.

## Fail Criteria

The demo fails if:

- The readiness command fails.
- Observer cannot show task, action, recovery, system health, heal history, maintenance, or MVP route evidence.
- Recovery evidence cannot identify a target URL.
- Conservative self-heal evidence cannot show both executed low/medium-risk repair and skipped high-risk observe-only handling.
- The next task proposal drifts into a safety-boundary loop instead of demo/release exit work.

## Artifacts To Keep

For a release note or handoff, keep:

- The milestone summary JSON from the readiness run.
- Logs for `openclaw-mvp-readiness` and `observer-openclaw-mvp-readiness`.
- A short note of the Observer panels checked.
- Optional screenshots of Observer task history, heal history, maintenance state, and MVP route.

## After The Demo

After a passing demo:

- Mark first-stage MVP as demo-ready.
- Keep only blocker bug fixes in the first-stage lane.
- Choose next-phase work from the whitepaper route.
- Prefer visible body capability progress over safety-boundary expansion.
