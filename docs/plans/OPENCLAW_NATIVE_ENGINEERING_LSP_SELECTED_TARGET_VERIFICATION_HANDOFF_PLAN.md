# OpenClaw Native Engineering LSP Selected-Target Verification Handoff Plan

Updated: 2026-07-10

## Active Slice

LSP selected-target verification handoff.

This slice extends the selected-target edit closed loop by handing the edited
workspace state to the existing approval-gated verification command path:

```text
selected LSP target
-> selected-target edit seed
-> explicit edit task
-> approved workspace_patch_apply
-> bounded readback
-> explicit source-command verification task
-> approval-gated command execution
-> verification evidence readback
```

Identity alignment: Level 1, stable user-space control plane.

## Implemented Behavior

No new runtime endpoint is added. The existing source-command and verification
surfaces are now proven together with the LSP selected-target edit flow by the
LSP evidence milestone:

```text
POST /plugins/native-adapter/source-command-proposals/tasks
POST /approvals/:id/approve
POST /operator/step
GET /plugins/native-adapter/engineering-verification/evidence
```

The proof verifies:

```text
the verification task is created only by explicit request
operator execution is blocked before approval
approved execution runs the existing workspace command path
the command transcript confirms the selected-target edit result
verification evidence is attached to the completed task
```

## Boundaries

This slice still blocks:

```text
automatic verification task creation
automatic approval
automatic operator execution
arbitrary shell execution outside the existing command policy and allowlist
automatic recovery task creation
long-lived LSP process pools
provider calls, network egress, root/system daemon work
```

## Evidence

Runtime reused:

```text
services/openclaw-core/src/workspace-ops.mjs
services/openclaw-core/src/workspace-native-ops-routes.mjs
services/openclaw-core/src/native-engineering-verification-evidence-builders.mjs
```

Milestone proof:

```text
nix/scripts/dev-openclaw-native-engineering-lsp-evidence-check.sh
openclaw-native-engineering-lsp-evidence
```

## Follow-up Completed

The selected-target recovery recommendation handoff follow-up was completed as:

```text
OPENCLAW_NATIVE_ENGINEERING_LSP_SELECTED_TARGET_RECOVERY_RECOMMENDATION_HANDOFF_PLAN.md
```

That slice proves failed verification after a selected-target edit can be read
as recovery evidence and turned into an explicit recovery task through the
existing recovery controls, without automatic approval or recovery execution.
