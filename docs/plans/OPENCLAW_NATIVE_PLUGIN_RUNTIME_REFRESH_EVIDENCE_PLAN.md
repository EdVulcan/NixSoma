# OpenClaw Native Plugin Runtime Refresh Evidence Plan

Updated: 2026-07-09

## Active Slice

Live plugin runtime refresh as a governed lifecycle action, implemented first as
read-model refresh evidence.

This historical slice transferred the useful enhanced-source runtime refresh
idea into OpenClaw-native lifecycle evidence. It recomputes the native plugin
registry read model and reports refresh preconditions, activation gates, cache
invalidation boundaries, and recovery boundaries.

It does not load plugin modules, execute plugin code, activate runtime, clear a
module cache, install/enable/disable plugins, create tasks, or create approvals.

Identity alignment: Level 1, stable user-space control plane.

## Endpoint

```text
GET /plugins/native-adapter/runtime-refresh-evidence

registry: openclaw-native-plugin-runtime-refresh-evidence-v0
mode: governed-runtime-refresh-evidence-only
```

Capability mapping:

```text
live plugin runtime refresh -> sense.openclaw.plugin_runtime.refresh_evidence
```

## Implemented Behavior

The native builder:

```text
recomputes the native plugin contract registry read model
summarizes runtime activation plan gates
reports cache invalidation intent while keeping cache mutation disabled
reports plugin module load, code execution, and runtime activation as blocked
returns audit evidence and Observer-visible governance boundaries
```

## Deferred

The following remain deferred:

```text
plugin module import
plugin code execution
runtime activation
discovery or module cache invalidation
install/enable/disable state mutation
task or approval creation
provider calls, network egress, result envelopes
```

Actual live refresh of a module loader remains deferred until a governed loader
exists and its lifecycle can be approved, audited, and recovered.

## Evidence

Runtime builder:

```text
services/openclaw-core/src/native-plugin-runtime-refresh-evidence-builders.mjs
```

Route wiring:

```text
services/openclaw-core/src/native-plugin-runtime-routes.mjs
```

Observer visibility:

```text
apps/observer-ui/src/observer-panels-operations.mjs
apps/observer-ui/src/client-script-renderers-native-runtime-refresh.mjs
```

Validation target:

```text
services/openclaw-core/test/native-plugin-plan-builders.test.mjs
services/openclaw-core/test/native-plugin-runtime-routes.test.mjs
openclaw-native-plugin-runtime-refresh-evidence
observer-openclaw-native-plugin-runtime-refresh-evidence
```

Validated on 2026-07-09:

```text
node --test services/openclaw-core/test/native-plugin-plan-builders.test.mjs services/openclaw-core/test/native-plugin-runtime-routes.test.mjs
npm --workspace @openclaw/openclaw-core run typecheck
npm --workspace @openclaw/observer-ui run typecheck
OPENCLAW_MILESTONE_CHECKS=openclaw-native-plugin-runtime-refresh-evidence,observer-openclaw-native-plugin-runtime-refresh-evidence bash nix/scripts/dev-milestone-check.sh
OPENCLAW_MILESTONE_CHECKS=milestone-registry,milestone-script-audit bash nix/scripts/dev-milestone-check.sh
```

## Follow-Up Slice

Completed next recommended real capability:

```text
Planning/todo evidence surface
```

`cc_plan_enter`, `cc_plan_exit`, and `cc_todo_write` are now represented as
explicit task/workbench evidence, not hidden agent mode or uncontrolled file
mutation.

The next smallest real capability is:

```text
Native governed LSP availability and contract evidence
```

Latest runtime refresh follow-up completed:

```text
OPENCLAW_NATIVE_PLUGIN_RUNTIME_REFRESH_TASK_PLAN.md
```

The evidence-only endpoint now has an approval-gated lifecycle bridge:

```text
POST /plugins/native-adapter/runtime-refresh-tasks
```

That bridge creates an explicit task and approval, blocks before approval,
recomputes read-model evidence only after approval, stores execution evidence in
`nativePluginRuntimeRefresh.execution`, and keeps plugin module import, plugin
code execution, runtime activation, cache mutation, provider egress, and root
work disabled.
