# Bounded Operator Schedule Workflow

Updated: 2026-08-01

Status: implemented in source, validated by the seven changed gates, and
deployed in physical generation 108 after the reviewed candidate switch rule.
The scheduler remains disabled by default; physical deployment health is proved
without claiming physical scheduled execution.

## Selected Capability

Make the finite operator scheduler a usable, explicitly controlled workflow:

```text
operator selects an existing 1-20 task limit
-> chooses a 0-1440 minute delay
-> arms one queue schedule from Observer
-> observes its bounded status and due time
-> cancels it, or explicitly re-arms it after a Core restart
-> reuses the existing finite operator run owner once
```

This connects the existing bounded scheduling implementation to a real
operator surface without introducing an open-ended autonomous loop.

## Contract

- `POST /operator/schedule` accepts only the existing bounded `maxSteps`, a
  delay from 0 through 24 hours, and `confirm=true`.
- An active schedule is one-shot. A paused schedule created by Core restart
  cannot be replaced by a new schedule; it must be re-armed through its exact
  schedule id with `confirm=true`, preserving its original step budget.
- `POST /operator/schedule/:id/cancel` cancels only an armed schedule.
- `POST /operator/schedule/:id/rearm` changes only the due time of a paused
  schedule. It cannot change tasks, actions, URLs, policy, approvals,
  credentials, provider authority, or host authority.
- Observer uses the authenticated Core read/mutation path and exposes schedule,
  cancel, re-arm, due-time, timer, and compact status readback. It does not
  expose the internal tick route.
- `services.openclaw.boundedOperatorScheduler.enable` is a Nix option with a
  false default. Enabling the timer is an explicit deployment decision and is
  separate from creating a schedule.
- There is no automatic repeat, retry, task creation, planning, provider
  authority, input replay, or host mutation.

## Evidence

- Core scheduler and route tests cover explicit arming, one-shot consumption,
  restart pause, exact-budget re-arm, cancellation, and route forwarding.
- Observer tests cover bounded delay conversion, schedule-id binding, re-arm,
  cancellation, local input rejection, and served panel tokens.
- The Observer and Core real-service gates exercise the enabled development
  timer configuration without changing the physical host.
- The physical candidate `/nix/store/n23b58fh3qm17n57k625l92ynp1wbi4k-nixos-system-nixos-26.05.4808.569d57850992`
  passed marker/protected-path checks and was activated as generation 108.
  Current/profile matched, all nine HTTP health endpoints returned 200, all
  seven system services and both user services were active, failed units were
  empty, and no host reboot occurred.
- The physical profile exposes
  `OPENCLAW_BOUNDED_OPERATOR_SCHEDULER_ENABLED=0`; the timer is intentionally
  disabled, so this evidence does not claim a physical scheduled run.

## Deferred

- unbounded resident autonomy, repeat/retry, automatic planning, and automatic
  task creation;
- provider-selected scheduling or provider authority over execution;
- arbitrary task/action overrides, desktop takeover, root, and host mutation;
- enabling the scheduler in the physical profile without a separate operator
  deployment decision; this generation deliberately keeps it disabled.

## Stop Condition

Freeze this workflow after the focused tests, seven changed gates, physical
candidate health gate, and documentation closure. The next route must select
another concrete user workflow rather than adding more schedule variants.
