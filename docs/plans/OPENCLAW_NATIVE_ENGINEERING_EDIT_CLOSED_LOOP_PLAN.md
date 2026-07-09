# OpenClaw Native Engineering Edit Closed Loop Plan

Updated: 2026-07-09

## Active Slice

Native governed engineering edit closed-loop proof.

This slice keeps the post-bridge execution readback thin and uses it as one
part of the full product loop:

```text
bounded read/search -> edit proposal -> approval task ->
operator-approved workspace_patch_apply -> filesystem ledger ->
thin edit execution evidence -> Observer visibility ->
approved verification command -> recovery readback
```

Identity alignment: Level 1, stable user-space control plane.

## Implemented Behavior

The slice adds:

```text
GET /plugins/native-adapter/engineering-edit-execution/evidence
registry: openclaw-native-engineering-edit-execution-evidence-v0
mode: approved-workspace-patch-apply-execution-evidence
```

The endpoint reads completed filesystem write records and task metadata, links
records back to `engineeringEditProposal`, and verifies that the approved
mutation path used `workspace_patch_apply -> filesystem.write_text`. It does
not create tasks, approve tasks, execute operator steps, write files, run
commands, call providers, or expose full file content.

The milestone proof:

```text
starts from existing bounded read, glob, and grep surfaces
creates a confirmed engineering edit proposal task
blocks operator execution before approval
approves the task through the approval API
executes the existing workspace_patch_apply path through operator step
verifies the target file changed only after approval
checks filesystem write invocation history and filesystem ledger
checks thin edit execution readback without exposing file content
fetches Observer HTML/client tokens for edit, patch, verification, and recovery surfaces
creates an approval-gated verification command task
approves and executes verification through the existing command path
checks verification evidence is attached to task completion
checks recovery readback reports no failures for the successful verification
```

No provider egress, credential read, root daemon, or hidden enhanced-source
import is introduced.

## Evidence

Validation target:

```text
openclaw-native-engineering-edit-closed-loop
```

Runtime builder:

```text
services/openclaw-core/src/native-engineering-edit-execution-evidence-builders.mjs
```

Read-model route:

```text
services/openclaw-core/src/observer-read-model-routes.mjs
```

Script:

```text
nix/scripts/dev-openclaw-native-engineering-edit-closed-loop-check.sh
```

Focused unit test:

```text
services/openclaw-core/test/native-engineering-edit-execution-evidence-builders.test.mjs
```

## Deferred

The following remain deferred:

```text
automatic approval
automatic command execution without approval
automatic recovery task creation
provider calls, network egress, result envelopes
raw credential reads
```

## Next Slice

The next highest-density capability slice should move from proof scripts toward
operator ergonomics:

```text
Native governed engineering loop operator controls
```

That slice should make the closed loop easier to operate from Observer/workbench
without bypassing approval or adding another readiness chain.
