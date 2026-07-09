# OpenClaw Native Engineering Loop State Guidance Plan

Updated: 2026-07-09

## Active Slice

Native governed engineering loop state guidance.

This slice makes the Observer-created engineering loop easier to follow after a
task is created. It does not add a new backend capability; it surfaces the
already-created task, approval, next operator action, and expected evidence
route in one place.

Identity alignment: Level 1, stable user-space control plane.

## Implemented Behavior

The Observer now includes an Engineering Loop State panel:

```text
engineering-loop-state-kind
engineering-loop-state-task
engineering-loop-state-approval
engineering-loop-state-next
engineering-loop-state-evidence
engineering-loop-state-json
```

When an operator creates an edit, write, or verification approval task from the
engineering controls, the panel records:

```text
loop kind
created task id and status
pending approval id and status
next manual step: approve pending approval, then run operator step
expected evidence route for the created task
```

This is operator guidance only. It does not approve, deny, run, retry, recover,
mutate files, execute commands, call providers, or create result envelopes.

## Evidence

Validation target:

```text
openclaw-native-engineering-loop-operator-controls
```

The targeted milestone now checks that Observer HTML and client script expose
the loop-state panel and guidance functions while still proving pending
approval gates and no pre-approval mutation.

## Deferred

The following remain deferred:

```text
state restoration after Observer reload from core task/approval history
automatic approval
automatic operator execution after task creation
automatic command execution without approval
automatic recovery task creation
provider calls, network egress, result envelopes
raw credential reads
```

## Next Slice

The completion-readback follow-up was completed as:

```text
OPENCLAW_NATIVE_ENGINEERING_LOOP_COMPLETION_READBACK_PLAN.md
```

The recovery ergonomics follow-up was completed as:

```text
OPENCLAW_NATIVE_ENGINEERING_LOOP_RECOVERY_ACTION_DRAFT_PLAN.md
```

It turns failed verification recovery evidence into an explicit Observer action
draft without automatic execution.
