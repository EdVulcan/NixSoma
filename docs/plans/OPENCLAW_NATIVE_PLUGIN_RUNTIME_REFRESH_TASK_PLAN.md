# OpenClaw Native Plugin Runtime Refresh Task Plan

Updated: 2026-07-10

## Active Slice

Live plugin runtime refresh as a governed lifecycle action.

This slice upgrades the existing read-model refresh evidence into an
approval-gated OpenClaw-native task:

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
- approved operator execution recomputes the native plugin runtime read model
- task outcome stores refresh execution evidence and verification checks
- `/tasks/:taskId` readback exposes the persisted refresh execution evidence
- Observer milestone coverage keeps the runtime refresh panel visible while
  proving the same approval-gated lifecycle

The executor recomputes the same native registry read model used by:

```text
GET /plugins/native-adapter/runtime-refresh-evidence
```

It records that the read model refreshed while keeping every runtime mutation
boundary disabled.

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
approved execution: audit-only read-model recomputation
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
real loader cache invalidation
plugin install/enable/disable mutation
provider egress
result envelopes
root/system daemon work
```

## Next Smallest Real Capability

The next high-density migration target is:

```text
ACPX/Codex bridge compatibility and runtime persistence evidence
```

That slice should map the enhanced-source bridge/persistence tests into
OpenClaw-native compatibility evidence without adopting the enhanced source as a
runtime dependency, reading real credentials, or performing provider egress.
