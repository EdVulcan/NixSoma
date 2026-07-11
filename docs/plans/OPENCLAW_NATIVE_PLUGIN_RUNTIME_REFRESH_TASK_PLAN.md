# OpenClaw Native Plugin Runtime Refresh Task Plan

Updated: 2026-07-11

## Active Slice

Live plugin runtime refresh as a governed lifecycle action.

This slice upgrades the existing read-model refresh evidence into an
approval-gated OpenClaw-native fixed-registry generation lifecycle:

```text
POST /plugins/native-adapter/runtime-refresh-tasks
registry: openclaw-native-plugin-runtime-refresh-task-v0
task type: native_plugin_runtime_refresh
executor evidence: openclaw-native-plugin-runtime-refresh-task-execution-v0
```

Identity alignment: Level 1, stable user-space control plane.

## Implemented Behavior

The runtime refresh task now proves:

- explicit task creation with `confirm=true`
- explicit approval request creation
- `/operator/step` blocks before approval with `policy_requires_approval`
- approval converts the policy decision to audited execution
- approved operator execution builds and validates a new fixed native registry
  generation and atomically swaps it into the shared plan/runtime owner
- failed candidate validation leaves the old generation active
- the immediately previous generation remains available in memory
- subsequent native plugin capability plans resolve against the active
  generation and expose its id, sequence, and content hash
- task outcome stores refresh execution evidence and verification checks
- `/tasks/:taskId` readback exposes the persisted refresh execution evidence
- Observer milestone coverage keeps the runtime refresh panel visible while
  proving the same approval-gated lifecycle

The executor refreshes the same active native registry generation used by:

```text
GET /plugins/native-adapter/runtime-refresh-evidence
```

This is a real process-lifetime lifecycle state change, not module-loader
activation. The fixed built-in descriptor set is rebuilt and validated before
swap; no workspace or external module path is accepted.

## Governance

Capability mapping:

```text
live plugin runtime refresh -> act.openclaw.plugin_runtime.refresh_task
```

Approval and audit:

```text
requires explicit approval: true
creates task: true
creates approval: true
operator step before approval: blocked
approved execution: validated atomic fixed-registry generation swap
audit evidence: task outcome embedded execution record
Observer visibility: runtime refresh panel plus task/readback milestone proof
```

Disabled boundaries:

```text
no plugin module import
no plugin code execution
no runtime activation
no discovery cache invalidation
no module cache invalidation
no install/enable/disable state mutation
no provider call
no network egress
no root/system daemon escalation
no generation persistence or automatic rollback
```

## Evidence

Task builders:

```text
services/openclaw-core/src/native-plugin-runtime-refresh-task-builders.mjs
```

Route wiring:

```text
services/openclaw-core/src/native-plugin-runtime-routes.mjs
```

Task executor:

```text
services/openclaw-core/src/task-executor-native-plugin-runtime-refresh-handlers.mjs
packages/plugin-runtime/src/plugin-registry-generation-store.mjs
```

Task readback field:

```text
nativePluginRuntimeRefresh.execution
```

Validation targets:

```text
services/openclaw-core/test/native-plugin-plan-builders.test.mjs
services/openclaw-core/test/native-plugin-runtime-routes.test.mjs
services/openclaw-core/test/task-executor.test.mjs
openclaw-native-plugin-runtime-refresh-evidence
observer-openclaw-native-plugin-runtime-refresh-evidence
```

## Deferred

The following remain deferred:

```text
plugin module import
plugin code execution
runtime activation
dynamic module discovery/import and loader cache invalidation
plugin install/enable/disable mutation
provider egress
result envelopes
root/system daemon work
generation persistence and explicit rollback action
```

## Next Smallest Real Capability

The next high-density product target is:

```text
consume the governed Engineering Context Packet at an explicitly authorized
local model/provider boundary
```

Do not start provider egress or credential reads without explicit operator
authorization. If that boundary remains deferred, choose another real local
capability rather than extending plugin refresh with more readiness shells.
