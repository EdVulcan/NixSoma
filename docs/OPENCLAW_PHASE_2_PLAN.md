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

Track B repair demo status checkpoint:

After the first Track A repair loop is complete, `openclaw-phase-2-repair-demo-status` may expose a read-only demo status bundle for Observer.

This checkpoint is allowed because it turns completed body capability evidence into an operator-visible demo surface:

- Reads existing route, task history, command transcript, and post-execution verification evidence.
- Exposes demo readiness, target unit, command result, before/after body state, checklist, and next demo slice.
- Creates no task, no approval, no command execution, no host mutation, and no recovery action.
- Must not add persistence hardening, denial recovery, duplicate-click handling, schedulers, plugin/runtime adapter work, or any hidden execution path.

Repair auth delegation checkpoint:

If the operator sees a password prompt for every approved repair action, `openclaw-systemd-repair-auth-delegation` may prove a narrow NixOS authorization bridge for the existing real repair demo path.

This checkpoint is allowed because repeated OS password prompts block the Phase 2 operator demo experience after the real repair loop is already approved and visible. It must remain a least-privilege integration, not a new autonomy or hardening loop:

- Delegates only the already-approved `openclaw-browser-runtime.service` restart path.
- Keeps OpenClaw operator approval separate from host OS authorization.
- Uses a fixed helper that accepts no arguments and executes only `systemctl restart openclaw-browser-runtime.service`.
- Is disabled by default and requires an explicit OpenClaw service user.
- Must not grant passwordless `ALL`, arbitrary `systemctl`, shell access, plugin/runtime execution, background repair, denial recovery, duplicate-click handling, or persistence hardening.

Body service dependency map checkpoint:

After the repair demo path is usable on a real NixOS body, `openclaw-body-service-dependency-map` may expose a read-only dependency graph for OpenClaw-owned body services.

This checkpoint is allowed because it advances Track C body governance: OpenClaw should understand how its organs depend on each other before it recommends broader recovery choices.

- Reads existing OpenClaw service specs and systemd inventory evidence.
- Exposes nodes, upstream dependencies, downstream impact, startup layers, roots, leaves, and high-impact body services.
- Creates no task, no approval, no command execution, no host mutation, and no repair action.
- Must not add automatic restart, background repair, persistence hardening, denial recovery, duplicate-click handling, plugin/runtime adapter work, or arbitrary systemd control.

Health trend summary checkpoint:

After the dependency map passes, `openclaw-health-trend-summary` may summarize recent `/system/health` snapshots.

This checkpoint is allowed because OpenClaw needs short-term body memory before it can make route-aware recovery recommendations:

- Reads existing system-sense health snapshots only.
- Exposes sample window, service stability, degraded services, alert count, and resource min/max/latest summaries.
- Creates no task, no approval, no command execution, no host mutation, no scheduler, and no recovery action.
- Must not add automatic repair, background maintenance, persistence hardening, denial recovery, duplicate-click handling, plugin/runtime adapter work, or arbitrary host control.

Route-aware next-action recommendation checkpoint:

After health trends pass, `openclaw-route-aware-next-action-recommendation` may combine the dependency map and health trends into a read-only next-action recommendation.

This checkpoint is allowed because it turns body evidence into governance judgment without crossing into execution:

- Reads dependency map and health trend summaries only.
- Recommends observe/review/recovery-planning direction with evidence references and candidate actions.
- Creates no task, no approval, no command execution, no host mutation, no scheduler, and no recovery action.
- Must not add automatic repair, background maintenance, persistence hardening, denial recovery, duplicate-click handling, plugin/runtime adapter work, or arbitrary host control.

Conservative recovery policy explanation checkpoint:

After route-aware next-action recommendations pass, `openclaw-conservative-recovery-policy-explanation` may explain the conservative recovery policy that governs when OpenClaw can stay in observe/review mode versus when a separate operator-reviewed repair route is required.

This checkpoint is allowed because it makes body governance understandable before broadening any recovery action:

- Reads route-aware recommendation, dependency map, and health trend evidence only.
- Explains observe-first recovery rules, minimum evidence, repair proposal gates, and hard boundaries.
- Creates no task, no approval, no command execution, no host mutation, no scheduler, and no recovery action.
- Must not add automatic repair, background maintenance, persistence hardening, denial recovery, duplicate-click handling, plugin/runtime adapter work, or arbitrary host control.

Body governance readiness checkpoint:

After the conservative recovery policy explanation passes, `openclaw-body-governance-readiness` may close Track C with a read-only readiness bundle.

This checkpoint is allowed because it verifies that body governance has enough evidence to support the next whitepaper route review:

- Reads dependency map, health trend, route-aware recommendation, and conservative recovery policy evidence only.
- Exposes readiness checks, current governance posture, completed Track C slices, and next route review boundary.
- Creates no task, no approval, no command execution, no host mutation, no scheduler, and no recovery action.
- Must not add automatic repair, background maintenance, persistence hardening, denial recovery, duplicate-click handling, plugin/runtime adapter work, or arbitrary host control.

Phase 2 route review checkpoint:

After Track C body governance readiness passes, `openclaw-phase-2-route-review` may choose the next Phase 2 body-capability block.

Decision:

Select Track B, `openclaw-phase-2-demo-control-room`, as the next block.

This checkpoint is allowed because Phase 2 now has real repair evidence and body governance evidence, so the next whitepaper-aligned gain is a clearer human demo/control surface before adding broader mutation or plugin/runtime capability:

- Reads body governance readiness, Phase 2 priority order, and existing route evidence only.
- Selects the next track and explains why Track A broadening, plugin/runtime adapter work, persistence hardening, denial recovery, duplicate-click handling, and broader host mutation are not selected.
- Creates no task, no approval, no command execution, no host mutation, no scheduler, and no recovery action.
- Must not add automatic repair, background maintenance, persistence hardening, denial recovery, duplicate-click handling, plugin/runtime adapter work, or arbitrary host control.

Phase 2 demo control room checkpoint:

After the route review selects Track B, `openclaw-phase-2-demo-control-room` may expose a read-only demo control surface that gathers the visible Phase 2 body evidence into one operator view.

This checkpoint is allowed because it improves the human demo path without broadening autonomy:

- Reads MVP route alignment, repair demo status, route review, and body governance readiness evidence only.
- Exposes available panels, selected next slice, repair demo readiness, body governance readiness, and an operator walkthrough script.
- Creates no task, no approval, no command execution, no host mutation, no scheduler, and no recovery action.
- Must not add automatic repair, background maintenance, persistence hardening, denial recovery, duplicate-click handling, plugin/runtime adapter work, or arbitrary host control.

Phase 2 demo walkthrough checkpoint:

After the demo control room passes, `openclaw-phase-2-demo-walkthrough` may expose a human-readable walkthrough script for the operator demo.

This checkpoint is allowed because it turns the control room into an explainable whitepaper-aligned demo without adding new capability:

- Reads demo control room evidence only.
- Exposes ordered demo steps, expected evidence, speaking script, and explicit no-mutation boundary.
- Creates no task, no approval, no command execution, no host mutation, no scheduler, and no recovery action.
- Must not add automatic repair, background maintenance, persistence hardening, denial recovery, duplicate-click handling, plugin/runtime adapter work, or arbitrary host control.

Phase 2 demo readiness exit checkpoint:

After the demo walkthrough passes, `openclaw-phase-2-demo-readiness-exit` may close the Track B demo block with a read-only exit gate.

This checkpoint is allowed because it confirms that the operator demo is ready before opening another body capability block:

- Reads demo walkthrough and demo control room evidence only.
- Exposes exit checks, safe-to-demo outcome, completed Track B slices, and next route-review boundary.
- Creates no task, no approval, no command execution, no host mutation, no scheduler, and no recovery action.
- Must not add automatic repair, background maintenance, persistence hardening, denial recovery, duplicate-click handling, plugin/runtime adapter work, or arbitrary host control.

Phase 2 next capability route review checkpoint:

After the demo readiness exit passes, `openclaw-phase-2-next-capability-route-review` may choose the next body-capability block.

Decision:

Select Track A, `openclaw-systemd-repair-candidate-assessment`, as the next block.

This checkpoint is allowed because Track B demo readiness is complete, and the whitepaper priority order now points back to real NixOS/systemd repair semantics. The first slice must be read-only candidate assessment, not broader mutation:

- Reads demo readiness exit, Phase 2 priority order, and existing route evidence only.
- Selects Track A candidate assessment and explains why additional demo polish, governance-only expansion, plugin/runtime adapter work, automatic repair, broader mutation, persistence hardening, and denial recovery are not selected.
- Creates no task, no approval, no command execution, no host mutation, no scheduler, and no recovery action.
- Must not add automatic repair, background maintenance, persistence hardening, denial recovery, duplicate-click handling, plugin/runtime adapter work, or arbitrary host control.

Systemd repair candidate assessment checkpoint:

After the next capability route review selects Track A, `openclaw-systemd-repair-candidate-assessment` may rank OpenClaw-owned systemd units as read-only repair candidates.

This checkpoint is allowed because it resumes real NixOS/systemd repair semantics without immediately broadening mutation:

- Reads systemd inventory, dependency map, and health trend evidence only.
- Exposes candidate score, impact class, health signal, existing demo target flag, recommended unit, and next plan-only boundary.
- Creates no task, no approval, no command execution, no host mutation, no scheduler, and no recovery action.
- Must not add automatic repair, background maintenance, persistence hardening, denial recovery, duplicate-click handling, plugin/runtime adapter work, or arbitrary host control.

Systemd repair candidate plan checkpoint:

After candidate assessment passes, `openclaw-systemd-repair-candidate-plan` may convert the selected candidate into a plan-only repair scope.

This checkpoint is allowed because it advances Track A repair semantics from candidate assessment to operator-reviewable plan shape without creating executable work:

- Reads repair candidate assessment evidence only.
- Exposes selected unit, command preview, planned review steps, required-before-execution gates, and Observer visibility boundary.
- Creates no task, no approval, no command execution, no host mutation, no scheduler, and no recovery action.
- Must not add automatic repair, background maintenance, persistence hardening, denial recovery, duplicate-click handling, plugin/runtime adapter work, or arbitrary host control.

Systemd repair candidate task route checkpoint:

After the candidate plan is visible in Observer, `openclaw-systemd-repair-candidate-task-route` may decide whether the selected candidate can use an existing operator-reviewed repair task shell.

This checkpoint is allowed because it checks the route before task materialization:

- Reads repair candidate plan evidence only.
- Exposes target unit, existing-route availability, required-before-task-creation gates, allowed next actions, and task-shell boundary.
- Creates no task, no approval, no command execution, no host mutation, no scheduler, and no recovery action.
- Must not add automatic repair, background maintenance, persistence hardening, denial recovery, duplicate-click handling, plugin/runtime adapter work, or arbitrary host control.

Systemd repair candidate task shell checkpoint:

After the candidate task route passes, `openclaw-systemd-repair-candidate-task-shell` may materialize the candidate as an approval-gated task shell using the existing operator-reviewed repair route.

This checkpoint is allowed because it advances Track A from visible route gate to task materialization while still stopping before approval and execution:

- Reads candidate task route evidence and reuses the existing browser-runtime repair execution task shell.
- Creates a queued task and pending approval, but does not approve, execute, mutate host, schedule work, or trigger recovery.
- Exposes Observer controls for the candidate task shell so the operator can see the route, target, pending-approval boundary, and no-mutation guarantee before materialization.
- Must remain limited to `openclaw-browser-runtime.service` until a future route review explicitly accepts another unit.
- Must not add automatic repair, background maintenance, persistence hardening, denial recovery, duplicate-click handling, plugin/runtime adapter work, or arbitrary host control.

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
