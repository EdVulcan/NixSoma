# OpenClaw Native Engineering Write Closed Loop Plan

Updated: 2026-07-09

## Active Slice

Native governed engineering write closed-loop proof.

This slice does not add another read-only endpoint. It proves that the existing
`cc_write`-derived proposal path can complete the product loop:

```text
bounded read/search -> write proposal -> approval task ->
operator-approved workspace_text_write -> filesystem ledger ->
Observer visibility -> approved verification command -> recovery readback
```

Identity alignment: Level 1, stable user-space control plane.

## Implemented Behavior

The milestone proof:

```text
creates a confirmed engineering write proposal task
starts from existing bounded read, glob, and grep surfaces
blocks operator execution before approval
approves the task through the approval API
executes the existing workspace_text_write path through operator step
verifies the target file changed only after approval
checks filesystem write invocation history and filesystem ledger
checks write execution readback without exposing file content
fetches Observer HTML/client tokens for write, verification, and recovery panels
creates an approval-gated verification command task
approves and executes verification through the existing command path
checks verification evidence is attached to task completion
checks recovery readback reports no failures for the successful verification
```

No new endpoint, provider egress, credential read, root daemon, or hidden
enhanced-source import is introduced.

## Evidence

Validation target:

```text
openclaw-native-engineering-write-closed-loop
```

Script:

```text
nix/scripts/dev-openclaw-native-engineering-write-closed-loop-check.sh
```

The check uses existing runtime surfaces:

```text
POST /plugins/native-adapter/engineering-write-proposal-tasks
POST /approvals/:id/approve
POST /operator/step
GET /filesystem/changes
GET /capabilities/invocations
GET /plugins/native-adapter/engineering-write-execution/evidence
POST /plugins/native-adapter/source-command-proposals/tasks
GET /plugins/native-adapter/engineering-verification/evidence
GET /plugins/native-adapter/engineering-recovery/evidence
GET / and /client-v5.js from Observer
GET /plugins/native-adapter/engineering-read-search/read
GET /plugins/native-adapter/engineering-read-search/glob
GET /plugins/native-adapter/engineering-read-search/grep
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

## Follow-Up Status

The recommended edit closed-loop follow-up was completed as:

```text
OPENCLAW_NATIVE_ENGINEERING_EDIT_CLOSED_LOOP_PLAN.md
```

That slice proves edit proposal -> approval-gated workspace_patch_apply ->
ledger -> Observer -> verification/recovery, with only a thin execution
readback and no readiness chain.

## Next Slice

The next highest-density capability slice should improve operator ergonomics:

```text
Native governed engineering loop operator controls
```

That slice should make the proven write/edit loops easier to operate from
Observer/workbench without bypassing approval.
