# OpenClaw on NixOS Phase 2 Plan

Updated: 2026-05-19

## Status

Phase 1 is release-exit passed and demo-ready.

Phase 2 starts with route selection only. Do not begin implementation until this plan is accepted and the first Phase 2 slice is chosen from the whitepaper route.

## Whitepaper Direction

The next phase should deepen OpenClaw as a resident digital body under user sovereignty. That means the next work should make OpenClaw more capable at understanding, maintaining, demonstrating, or governing its own body.

Phase 2 should not be selected by whichever safety boundary is easiest to extend.

## Priority Order

1. Real NixOS/systemd repair semantics.
2. Operator/Observer demo experience.
3. Body governance enhancement.
4. Plugin/runtime adapter work, only if it directly supports a visible body capability.

## Track A: Real NixOS/systemd Repair Semantics

Goal: move from simulated self-heal evidence toward a controlled real repair path.

Allowed first slices:

- Read-only systemd unit inventory for OpenClaw services.
- Plan-only repair proposal for one OpenClaw service.
- Explicit operator-visible dry-run repair envelope.
- Observer display for repair proposal, risk, command, and rollback note.

Boundaries:

- No automatic high-risk repair.
- No blind service restart without Observer-visible evidence.
- No host mutation before a plan-only and dry-run milestone.
- No persistence/hardening loop unless a real repair demo is blocked.

## Track B: Operator/Observer Demo Experience

Goal: make the Phase 1 demo easier to run, explain, and verify.

Allowed first slices:

- Observer release status panel backed by existing MVP status and route data.
- One-click demo checklist view, without executing hidden actions.
- Demo evidence bundle that links task history, recovery evidence, heal history, maintenance state, and MVP route.
- Clear “Phase 1 demo-ready” surface in Observer.

Boundaries:

- No new autonomy.
- No new plugin/runtime adapter work.
- No broad UI redesign unless it directly improves the demo path.

## Track C: Body Governance Enhancement

Goal: help OpenClaw reason about its body state and recovery choices.

Allowed first slices:

- Body service dependency map.
- Health trend summary from existing system-sense snapshots.
- Conservative recovery policy explanation.
- Route-aware next-action recommendation.

Boundaries:

- No unapproved mutation.
- No complex policy engine rewrite.
- No hidden background autonomy beyond existing maintenance controls.

## Deferred Track: Plugin/runtime Adapter

Plugin/runtime adapter work is deferred for the first half of Phase 2.

It may re-enter only when:

- A visible body capability requires it.
- The slice has a direct demo path.
- It does not restart approval hardening, denial recovery, duplicate-click, or persistence loops.
- The whitepaper route review says it is the best next body capability.

## First Recommended Slice

Recommended first Phase 2 slice:

`openclaw-systemd-unit-inventory`

Purpose:

Read OpenClaw-owned systemd unit metadata and expose it as body governance evidence. This is read-only and prepares real repair semantics without mutating the host.

Expected Observer pair:

`observer-openclaw-systemd-unit-inventory`

Why this first:

- It deepens the “body” rather than expanding safety boundaries.
- It supports later real repair semantics.
- It is demoable in Observer.
- It keeps high-risk repair out of the first Phase 2 slice.

## Track A Execution Route Gate

Status after the first Track A block:

- `openclaw-systemd-unit-inventory` is passed.
- `observer-openclaw-systemd-unit-inventory` is passed.
- `openclaw-systemd-repair-plan` is passed.
- `observer-openclaw-systemd-repair-plan` is passed.
- `openclaw-systemd-repair-dry-run` is passed.
- `observer-openclaw-systemd-repair-dry-run` is passed.

Decision:

OpenClaw may begin planning the next Track A slice, `openclaw-systemd-repair-execution-task`, only as an operator-reviewed real systemd repair execution path.

The next slice is allowed because it directly advances real NixOS/systemd repair semantics, but it must remain narrow:

- One selected OpenClaw-owned body unit only.
- Operator-visible command, target, risk, reason, and rollback note.
- No automatic high-risk repair.
- No blind restart.
- No background scheduler.
- No persistence, denial-recovery, duplicate-click, or approval-hardening loop.
- No plugin/runtime adapter work.

The next slice must not execute until its own milestone explicitly proves that execution is operator-reviewed and linked back to the passed inventory, repair plan, and dry-run envelope.

Approved-deferred checkpoint:

Before real host mutation, `openclaw-systemd-repair-approved-deferred` must prove that approval unlocks operator flow but still ends in a deferred execution shell with `hostMutation=false` and `executed=false`.

This checkpoint is allowed because it validates the operator-reviewed task shell. It must not add persistence hardening, denial recovery, duplicate-click handling, schedulers, plugin/runtime adapter work, or real `systemctl restart` execution.

Real execution checkpoint:

After the approved-deferred checkpoint passes, `openclaw-systemd-repair-real-execution` may prove one operator-reviewed real repair execution attempt for `openclaw-browser-runtime.service`.

This checkpoint is allowed because it is the narrow Track A transition from simulated repair semantics to real NixOS/systemd repair semantics. It must remain explicit and small:

- Requires `execute=true` task materialization plus a separate approved approval request.
- Executes only `systemctl restart openclaw-browser-runtime.service`.
- Records command, target, exit code, stdout/stderr, result, and rollback note in task evidence.
- Exposes Observer-visible real execution intent and result fields.
- Must not add persistence hardening, denial recovery, duplicate-click handling, schedulers, plugin/runtime adapter work, or any automatic repair loop.

Post-execution verification checkpoint:

After real execution passes, `openclaw-systemd-repair-post-verification` may record one before/after body-state verification bundle for `openclaw-browser-runtime.service`.

This checkpoint is allowed because it closes the first Track A repair loop with evidence rather than adding another safety boundary:

- Reads systemd unit inventory before and after the approved execution attempt.
- Reads `/system/health` before and after the approved execution attempt.
- Records target unit state, service health, command exit code, and verification summary in task evidence.
- Exposes Observer-visible post-execution verification fields.
- Must not retry the restart, trigger automatic recovery, add persistence hardening, add denial recovery, add duplicate-click handling, or schedule background repair.

## Phase 2 Gate

Before implementing any Phase 2 feature, confirm:

- Phase 1 release exit remains passed.
- The next slice appears in this plan.
- The slice improves body capability, demo experience, or body governance.
- The slice is not merely hardening, persistence, denial recovery, or plugin/runtime adapter boundary work.

## Canonical Planning Check

Run:

```bash
OPENCLAW_MILESTONE_CHECKS=openclaw-phase-2-plan npm run dev:milestone-check:unix
```
