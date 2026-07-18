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
```

The NixOS module enables the scheduler by default at a five-minute interval.
The runtime clamps configuration to 30 seconds through 24 hours, delays its
first tick until one interval after startup, prevents overlapping reads, and
clears its timer during Core shutdown.

## Persistence And Dedupe

Core persists the last tick, next due time, compact read-failure code, and the
current status, fingerprint, latest observation time, and latest task ID for
each fixed unit. Unknown persisted units are discarded. Recovery clears the
active fingerprint, so a later regression creates a new incident; a Core
restart does not duplicate an unchanged incident.

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

## Evidence

- healthy, first-failure, duplicate, recovery/regression, single-flight,
  audit-failure, read-failure, timer-stop, fixed-target, and restart tests;
- real task-manager extension serialization and Core-state restoration tests;
- generated Observer client syntax and compact task-detail assertions;
- `855/855` workspace tests and full typecheck;
- 811-entry milestone registry, script audit, and 160-character Windows path
  budget;
- full `dev-body-config-check.sh`, including an exact 220-file Core Nix closure.

No real provider request, hostd mutation, system switch, activation, rollback,
or reboot was used for validation.

## Deferred

- automatic provider diagnosis;
- automatic repair or approval creation;
- arbitrary systemd targets;
- deployment to the current physical-host generation;
- real activation and rollback validation in a disposable mutation environment.

## Next Real Capability

Add one operator-reviewed local triage bridge from a scheduler-created incident
to the existing fixed-unit repair planning boundary. It should bind the source
task, fingerprint, and unit, reuse existing repair owners, and stop before
approval or execution. Do not add another provider receipt or readiness lane.
