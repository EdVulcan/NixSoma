# OpenClaw Native Engineering Loop Completion Readback Plan

Updated: 2026-07-09

## Active Slice

Native governed engineering loop completion readback.

This slice lets the Observer read the evidence route for the latest
engineering-loop task created from the operator controls. It closes the
operator-facing loop after manual approval and operator execution without
creating a new execution path.

Identity alignment: Level 1, stable user-space control plane.

## Implemented Behavior

The Engineering Loop State panel now includes:

```text
engineering-loop-state-completion
engineering-loop-completion-button
```

The client tracks the latest operator-created edit, write, or verification task
and exposes:

```text
refreshEngineeringLoopCompletionReadback
```

The readback fetches the already-known evidence route:

```text
edit -> /plugins/native-adapter/engineering-edit-execution/evidence?taskId=...
write -> /plugins/native-adapter/engineering-write-execution/evidence?taskId=...
verification -> /plugins/native-adapter/engineering-verification/evidence?taskId=...
```

It does not approve, deny, run operator steps, retry commands, create recovery
tasks, mutate files, call providers, or create result envelopes.

## Evidence

Validation target:

```text
openclaw-native-engineering-loop-operator-controls
```

The targeted milestone now proves:

```text
Observer exposes completion readback controls and client functions
operator-created edit/write/verification tasks remain approval-gated
operator step is blocked before approval
manual approval plus operator step completes one edit task
edit execution evidence links the completed task to the filesystem ledger
the unapproved write task still does not write its target file
```

## Deferred

The following remain deferred:

```text
automatic approval
automatic operator execution after task creation
automatic command execution without approval
automatic recovery task creation
state restoration after Observer reload from core task/approval history
provider calls, network egress, result envelopes
raw credential reads
```

## Next Slice

The recovery ergonomics follow-up was completed as:

```text
OPENCLAW_NATIVE_ENGINEERING_LOOP_RECOVERY_ACTION_DRAFT_PLAN.md
```

It keeps recovery action creation explicit and approval-gated; it does not
auto-rerun verification or mutate files.
