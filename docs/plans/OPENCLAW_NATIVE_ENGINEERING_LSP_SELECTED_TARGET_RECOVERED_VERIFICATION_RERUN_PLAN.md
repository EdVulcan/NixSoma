# OpenClaw Native Engineering LSP Selected-Target Recovered Verification Rerun Plan

Updated: 2026-07-10

## Active Slice

LSP selected-target recovered verification rerun proof.

This slice completes the selected-target edit recovery loop by approving and
executing the previously queued recovered verification task through the
existing operator path:

```text
failed selected-target verification
-> recovery evidence recommendation
-> explicit recovered task creation
-> approval-gated recovered command rerun
-> recovered verification evidence
-> source recovery readback
```

Identity alignment: Level 1, stable user-space control plane.

## Implemented Behavior

No new runtime endpoint is added. The existing approval, operator, verification
evidence, and recovery evidence paths are proven together by the LSP evidence
milestone:

```text
POST /approvals/:id/approve
POST /operator/step
GET /plugins/native-adapter/engineering-verification/evidence
GET /plugins/native-adapter/engineering-recovery/evidence
```

The proof verifies:

```text
the recovered source-command task still requires approval
the approved recovered task reruns through operator step
the rerun completes successfully
verification evidence is attached to the recovered task
source recovery evidence stays linked to the recovered task
```

## Boundaries

This slice still blocks:

```text
automatic recovery approval
automatic recovery rerun
execution from evidence/readback routes
long-lived LSP process pools
provider calls, network egress, root/system daemon work
```

## Evidence

Runtime reused:

```text
services/openclaw-core/src/task-manager.mjs
services/openclaw-core/src/task-recovery.mjs
services/openclaw-core/src/native-engineering-verification-evidence-builders.mjs
services/openclaw-core/src/native-engineering-recovery-evidence-builders.mjs
```

Milestone proof:

```text
nix/scripts/dev-openclaw-native-engineering-lsp-evidence-check.sh
openclaw-native-engineering-lsp-evidence
```

## Next Slice

The next smallest real capability should leave this LSP selected-target loop
unless a user-facing LSP ergonomics gap is discovered. Prefer returning to the
native governed engineering route with:

```text
Live plugin runtime refresh as a governed lifecycle action
```

That follow-up should migrate the enhanced-source runtime refresh idea into an
OpenClaw-native, policy/audit/Observer-visible lifecycle action without
wholesale importing the reference implementation.
