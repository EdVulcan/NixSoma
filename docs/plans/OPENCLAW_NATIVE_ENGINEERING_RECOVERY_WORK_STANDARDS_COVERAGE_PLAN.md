# OpenClaw Native Engineering Recovery Work Standards Coverage Plan

Updated: 2026-07-10

## Active Slice

Recovery evidence work standards coverage.

This slice extends the existing native engineering recovery evidence route with
read-only coverage inherited from verification evidence. It does not add a new
endpoint, milestone lane, recovery executor, approval path, command rerun path,
or mutation path.

Identity alignment: Level 1, stable user-space control plane.

## Implemented Behavior

Existing endpoint:

```text
GET /plugins/native-adapter/engineering-recovery/evidence
```

now returns:

```text
workStandardsCoverage.registry: openclaw-engineering-recovery-work-standards-coverage-v0
workStandardsCoverage.status
workStandardsCoverage.score
failures[].workStandardsCoverage
summary.workStandardsCoveredFailures
summary.workStandardsMissingFailures
summary.workStandardsRecoveryRecommended
```

The coverage distinguishes:

```text
verification failed but evidence is attached to terminal task state
failed task exists but verification evidence is missing
```

This helps the operator decide whether to inspect/recover a failed command or
first recover missing evidence.

## Governance

The route remains read-only:

```text
no recovery task creation
no approval creation
no command execution
no automatic retry
no filesystem mutation
no provider call
```

## Evidence

Runtime builder:

```text
services/openclaw-core/src/native-engineering-recovery-evidence-builders.mjs
```

Observer renderer:

```text
apps/observer-ui/src/client-script-renderers-engineering-recovery.mjs
```

Validation targets:

```text
services/openclaw-core/test/native-engineering-recovery-evidence-builders.test.mjs
openclaw-native-engineering-recovery-evidence
observer-openclaw-native-engineering-recovery-evidence
```

## Deferred

The following remain deferred:

```text
automatic recovery task creation
automatic recovery approval
automatic command rerun or retry
server-side policy enforcement from prompt standards
provider/network egress
root/system daemon work
```

## Next Slice

The next safe slice should leave standards work unless it directly reduces
operator ambiguity in an existing readback. Prefer returning to other enhanced
source gaps that can be proven without live ACP/Codex process execution.
