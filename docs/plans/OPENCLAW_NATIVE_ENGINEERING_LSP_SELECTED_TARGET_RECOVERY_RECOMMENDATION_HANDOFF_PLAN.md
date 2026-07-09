# OpenClaw Native Engineering LSP Selected-Target Recovery Recommendation Handoff Plan

Updated: 2026-07-10

## Active Slice

LSP selected-target recovery recommendation handoff.

This slice extends the selected-target edit and verification loop by proving
the recovery path for a failed verification command:

```text
selected-target edit completion
-> explicit failed verification task
-> approval-gated failing command execution
-> recovery evidence recommendation
-> explicit recovery task creation
-> pre-approval recovery rerun block
```

Identity alignment: Level 1, stable user-space control plane.

## Implemented Behavior

No new runtime endpoint is added. The existing recovery evidence and task
recovery paths are now proven with the LSP selected-target flow by the LSP
evidence milestone:

```text
GET /plugins/native-adapter/engineering-recovery/evidence
POST /tasks/:taskId/recover
POST /operator/step
```

The proof verifies:

```text
failed selected-target verification produces recovery evidence
recovery evidence recommends /tasks/:taskId/recover
the recovery evidence endpoint remains read-only
explicit recovery task creation queues a recovered source-command task
operator execution of the recovered task remains blocked before approval
recovery readback links the source task to the queued recovered task
```

## Boundaries

This slice still blocks:

```text
automatic recovery task creation
automatic approval
automatic recovered command rerun
filesystem mutation from recovery evidence
long-lived LSP process pools
provider calls, network egress, root/system daemon work
```

## Evidence

Runtime reused:

```text
services/openclaw-core/src/native-engineering-recovery-evidence-builders.mjs
services/openclaw-core/src/task-recovery.mjs
services/openclaw-core/src/task-routes.mjs
```

Milestone proof:

```text
nix/scripts/dev-openclaw-native-engineering-lsp-evidence-check.sh
openclaw-native-engineering-lsp-evidence
```

## Next Slice

The next smallest real capability is:

```text
LSP selected-target recovered verification rerun proof
```

That follow-up should approve and run the recovered verification task through
the existing operator path, then prove successful rerun verification evidence
and recovery readback without adding automatic approval or recovery execution.
