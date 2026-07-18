# NixSoma Fixed-Unit Incident Scheduler Plan

Updated: 2026-07-18

## Purpose

Give the Level 3 body a bounded background owner for routine local observation.
The operator should not approve every read-only health check, while provider,
repair, activation, and rollback boundaries remain explicitly governed.

## Delivered Flow

```text
Core starts with an explicitly configured interval
-> read /system/health and /system/systemd/units without mutation
-> inspect only the three shared hostd fixed targets
-> compute a compact failure fingerprint per unit
-> audit a new unhealthy fingerprint before durable mutation
-> create one completed local incident task
-> show the compact task through existing Observer history/detail
-> suppress the same fingerprint until recovery or a changed failure
-> automatically create or reuse local triage for every current incident
-> bind source task, fingerprint, fixed unit, and existing repair draft owner
-> create one completed local plan/evidence task without approval or execution
-> automatically promote current triage through the existing repair owner
-> revalidate the entire source chain against current scheduler state
-> create one existing fixed-target real repair task and pending approval
-> let the operator explicitly approve or deny that exact task
-> stop before Operator execution or hostd invocation
```

The NixOS module enables the scheduler by default at a five-minute interval.
The runtime clamps configuration to 30 seconds through 24 hours, delays its
first tick until one interval after startup, prevents overlapping reads, and
clears its timer during Core shutdown.

## Persistence And Dedupe

Core persists the last tick, next due time, compact read-failure code, and the
current status, fingerprint, latest observation time, latest incident, triage,
repair task and approval IDs, and compact triage/promotion outcomes for each
fixed unit. Unknown persisted units are discarded. Recovery clears the active
fingerprint and derived workflow state, so a later regression creates a new
incident; a Core restart does not duplicate an unchanged incident. Transient
triage or promotion failure retains only a fixed error code and is retried on
the next unchanged unhealthy tick.

## Authority Boundary

- The fixed targets are derived from the shared hostd restart capability
  registry; callers cannot provide a unit.
- Observation reads local System Sense endpoints only.
- Incident tasks are terminal evidence and never enter the execution queue.
- Audit failure creates no incident task or dedupe mutation.
- Read failure records only `system_sense_read_failed`; raw error text is not
  persisted.
- Evidence excludes URLs, journal messages, provider output, credentials,
  commands, hostd receipts, and private paths.
- The scheduler cannot call a provider, create provider approval, invoke hostd,
  execute repair, activate a generation, or roll one back.
- Automatic and operator-requested triage share one owner. It revalidates the
  source fingerprint against current scheduler state, coalesces concurrent
  requests, and reuses a completed triage for the same source evidence.
- Triage calls only the existing read-only repair draft owner. It does not add
  capability or command steps, supersede active tasks, create approval, or
  enter the execution queue.
- Automatic and operator-requested repair promotion share one audit-first,
  restart-safe owner and remain idempotent for one triage binding. They ignore
  caller target, execution, and approval fields.
- Promotion reuses the existing hostd fixed-target repair task owner with its
  real-execution shape, but returns while its approval is still pending. It
  neither approves the task nor invokes Operator, hostd, activation, rollback,
  or a provider.

## Evidence

- healthy, first-failure, duplicate, recovery/regression, single-flight,
  audit-failure, read-failure, timer-stop, fixed-target, restart, and local
  triage binding, concurrent promotion, stale-source, and audit-failure tests;
- real task-manager extension serialization and Core-state restoration tests;
- generated Observer client syntax, compact task-detail assertions, and the
  explicit Triage action;
- `876/876` workspace tests and full typecheck;
- 811-entry milestone registry, script audit, and 160-character Windows path
  budget;
- full `dev-body-config-check.sh`, including exact 221-file Core and 77-file
  Observer Nix closures.

The validated source baseline was switched onto the physical host as generation
`/nix/store/gb72w3qavm6b0vv114ml723g7y8jv5qh-nixos-system-nixos-26.05.4808.569d57850992`.
Post-deployment probes covered service health, operator-auth rejection, live
bounded journal evidence, Observer controls, and one healthy scheduler tick.
No provider request, repair execution, hostd mutation, rollback, or reboot was
used.

## Deferred

- automatic provider diagnosis;
- automatic approval resolution or repair execution;
- arbitrary systemd targets;
- real activation and rollback validation in a disposable mutation environment.

## Next Real Capability

After explicit approval of the automatically promoted fixed-target repair task,
dispatch that exact task through the existing Executor once without requiring a
second operator command. Revalidate approval, task, source fingerprint, target,
and execution binding immediately before dispatch. Never dispatch a pending,
denied, expired, changed, or already-consumed task, and keep provider,
activation, and rollback disabled.
