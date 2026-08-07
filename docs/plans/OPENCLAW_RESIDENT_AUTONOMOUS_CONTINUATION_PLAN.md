# NixSoma Resident Autonomous Continuation

Updated: 2026-08-07

## Status

Implemented in source as an explicitly authorized continuation mode for a
reviewed finite mission worklist. Physical activation and a live resident
mission gate remain separate evidence work.

## Selected Capability

Allow one operator-reviewed mission to remain resident between finite epochs
while a selected workflow waits for its required operator acceptance:

```text
explicit resident-continuation arm
-> one reviewed worklist epoch
-> verified workflow waits for exact acceptance
-> resident mission polls the same bound worklist
-> acceptance releases the next finite epoch
```

This is the first resident continuation slice beyond one-shot finite mission
supervision. It does not invent goals, create an unreviewed worklist, or grant
the provider authority to decide what happens next.

## Contract

- `residentContinuation` defaults to `false` and is accepted only on an
  explicit `confirm=true` mission arm.
- Resident continuation requires the existing reviewed mission worklist owner.
  A missing or unmanaged worklist blocks before consuming another epoch.
- When the worklist returns `workflow_acceptance_required`, the mission stays
  `armed` and schedules a later poll. It does not consume epoch authority,
  create a task, invoke a provider, or create an action while acceptance is
  pending.
- The poll interval is at least one second and otherwise respects the mission
  interval. Finite limits remain unchanged: 32 initial epochs, 32 renewal
  epochs, 256 lifetime epochs, bounded authority deadlines, and the
  no-progress circuit.
- A completed worklist still terminates the mission. Worklist failure,
  missing state, owner loss, and non-acceptance blocking still fail closed.
- Core startup converts every active mission, including resident missions, to
  `paused` with `core_restart_requires_explicit_rearm`. The resident flag and
  consumed epoch count survive reconciliation, but no mission resumes until
  the operator explicitly re-arms the exact mission.
- The mission timer remains default-off. Enabling its existing timer does not
  arm a mission or widen its authority.
- Persistence retains only bounded mission state, ids, timestamps, counters,
  hashes/checkpoints already owned by the mission, and governance flags. No
  provider content, task goal, input value, pixels, credentials, root
  authority, or arbitrary host command is added.

## Ownership

- `renewable-operator-mission.mjs` owns resident mode, finite poll scheduling,
  epoch accounting, and restart reconciliation.
- `reviewed-mission-worklist.mjs` remains the only source of reviewed task
  supply and workflow acceptance state.
- Observer owns the explicit checkbox and sends only the boolean arm option;
  Core remains the authority for all limits and worklist binding.
- The existing bounded window lease remains the sole child execution owner.

## Evidence

Focused Core tests prove acceptance polling without a second epoch charge,
reviewed-worklist-owner rejection, resident flag persistence through startup
reconciliation, explicit re-arm after restart, and finite child ownership.
Observer tests prove the explicit arm control, request field, rendering, and
disabled state. The full workspace gate passes `1461/1461` tests, including
Core `1011/1011`, Observer `123/123`, and Session Manager `85/85`; typecheck,
syntax, diff, and the two changed milestone checks also pass.

The remaining release evidence is physical activation and a resident live
execution gate under a separately authorized deployment. Provider-backed
open-ended continuation is not claimed by this source slice.

## Deferred Boundaries

Infinite autonomy, provider-authored goals or task supply, automatic
acceptance, automatic re-arm, retry/skip, causal self-modification, physical
Phase D mutation or rollback, arbitrary root, arbitrary desktop/process
control, and unrestricted host mutation remain outside this contract.

## Stop Condition

Freeze this capability after the representative source validation and one
bounded correction pass. The next route review must select a distinct
operator-visible behavior or a separately authorized physical evidence gate,
not another resident scheduling wrapper.
