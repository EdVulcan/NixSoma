# NixSoma Systemd Incident Experience Memory Plan

Updated: 2026-07-18

## Purpose

Let the existing advisory experience-memory owner retain a bounded pattern from
each verified terminal fixed-systemd incident and recall only matching-target
history for a later incident. This is the next Hermes-inspired experience
absorption slice: prior outcomes become useful local context without automatic
code change, provider use, or host action.

## Delivered Flow

```text
delegated systemd repair enters completed or failed
-> unified terminal phase records experience once
-> shared receipt owner verifies hash, task, unit, health, journal, and hostd binding
-> persist one compact target-specific incident pattern
-> later fixed-target task requests Engineering Context Packet
-> recall matching-target pattern and bounded advisory next action
-> render the pattern in existing Observer context readback
```

The existing `openclaw.native_engineering_experience.v0` record gains an
optional `openclaw-systemd-incident-experience-v0` projection. It stores only:

- fixed target unit and health-service key;
- source receipt hash;
- restored, pre-health, and post-health booleans;
- journal availability and entry count;
- fixed native-mutation and restart-success booleans;
- explicit journal-message and provider-output exclusion flags.

It does not store journal text, service URLs, error text, command output,
provider response content, hostd invocation ids, peer identity, or raw D-Bus
job paths.

## Lifecycle Correction

The existing experience recorder previously covered `completeTask` and
`failTask`, while delegated executors such as the systemd owner finish through
`setTaskPhase`. The unified phase owner now records experience only on the first
transition from a non-terminal status to `completed` or `failed`. Repeated
terminal updates do not create another record.

## Recall Contract

The Context Packet assembly derives the fixed target from the selected task and
passes it to the existing experience read model. Incident records for another
fixed unit are excluded from target-specific recall. The compact summary reports
matching, restored, recovery-required, latest-restored, pattern, and next-action
evidence while preserving the existing generic task-history summary.

## Authority Boundary

- Recording is local and follows an already terminal task.
- Recall is read-only, bounded, and advisory.
- No task, approval, command, repair, provider request, or network egress is
  created from a record or pattern.
- The pattern cannot authorize hostd, another restart, generation activation,
  or rollback.
- No real host mutation or provider contact was executed for this slice.

## Evidence

- `services/openclaw-core/src/systemd-incident-receipt.mjs`
- `services/openclaw-core/src/native-engineering-experience-memory.mjs`
- delegated terminal lifecycle, experience recall, Context Packet, capability,
  and Observer focused tests
- Core Nix source-closure and changed-check integration

## Deferred

- learning from journal text or provider reasons;
- automatic retry or automatic provider contact;
- cross-target incident generalization;
- model-written memory records or automatic code self-modification;
- using recalled history as execution authority.

## Next Real Capability

Include at most a small bounded set of matching-target incident patterns in the
existing exact request-bound systemd incident AI handoff. The operator approval
must bind the resulting request, and journal/provider text must remain excluded.
This lets absorbed experience influence a later diagnosis without creating a
new provider schema or automatic egress path.
