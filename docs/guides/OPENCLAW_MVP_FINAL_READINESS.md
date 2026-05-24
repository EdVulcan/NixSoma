# OpenClaw on NixOS MVP Final Readiness

Updated: 2026-05-22

## Status

First-stage MVP is complete after `openclaw-phase-5-exit`.

This document is the final read-only readiness gate for the first MVP. It does not start Phase 6, post-MVP release automation, rollback execution, multi-agent orchestration, long-term memory, or higher-autonomy work.

## Whitepaper Success Criteria

The MVP route says first-stage success is factual, not about maximum intelligence:

- OpenClaw can run as a resident NixOS body.
- OpenClaw can continuously see the system picture.
- OpenClaw can perform basic actions against the visible system.
- OpenClaw can work in an independent background work view.
- The user can always inspect and interrupt what OpenClaw is doing.
- Basic service faults can be recovered with evidence.
- Overall deployment and rollback are controllable.

## Evidence Closure

- Body and service deployment: `body-config`, `state-settling`, `openclaw-phase-5-deployment-inventory`.
- Eyes: `openclaw-ai-work-view-capture`, `openclaw-ai-work-view-capture-summary`, `screen-sense`.
- Hands: `openclaw-eye-hand-action-evidence`, `screen-act`.
- Non-intrusive work view: `openclaw-phase-3-background-work-view`, `openclaw-phase-3-exit`.
- Observer sovereignty: `observer-openclaw-phase-3-operator-interrupt-controls`, `observer-openclaw-phase-5-exit`.
- Recovery and self-heal: `openclaw-phase-4-self-heal-loop`, `openclaw-phase-4-exit`.
- Deployment and rollback control: `openclaw-phase-5-deployment-inventory`, `openclaw-phase-5-rollback-readiness`, `openclaw-phase-5-exit`.

## Boundary

- No `nixos-rebuild switch`.
- No rollback execution.
- No destructive source rollback.
- No hidden service mutation.
- No new approval/hardening loop.
- No plugin/runtime adapter work.
- No post-MVP automation without a separate plan.

## Canonical Checks

```bash
OPENCLAW_MILESTONE_CHECKS=openclaw-mvp-final-readiness,observer-openclaw-mvp-final-readiness npm run dev:milestone-check:unix
```
