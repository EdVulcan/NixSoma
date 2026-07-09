# OpenClaw Native ACPX/Codex Bridge Compatibility Plan

Updated: 2026-07-10

## Active Slice

ACPX/Codex bridge compatibility, runtime persistence evidence, Observer
visibility, wrapper/action proposal draft, approval-gated wrapper action task
bridge, wrapper write proposal/preview, approval-gated wrapper write bridge
through the existing workspace text-write path, and wrapper write execution
readback/recovery recommendation.

This slice migrates the useful enhanced-source ACPX/Codex bridge lessons into
OpenClaw-native Level 1 behavior:

```text
GET /plugins/native-adapter/acpx-codex-bridge-compatibility
POST /plugins/native-adapter/acpx-codex-session-records
GET /plugins/native-adapter/acpx-codex-bridge-wrapper-draft
GET /plugins/native-adapter/acpx-codex-bridge-wrapper-write-proposal
POST /plugins/native-adapter/acpx-codex-bridge-wrapper-tasks
POST /plugins/native-adapter/acpx-codex-bridge-wrapper-write-tasks
GET /plugins/native-adapter/acpx-codex-bridge-wrapper-write-execution/evidence
Observer panel: OpenClaw ACPX/Codex Bridge
```

Identity alignment: Level 1, stable user-space control plane.

## Implemented Behavior

The compatibility read model records:

- POSIX `npx` and Windows `npx.cmd` command compatibility lessons
- future ACP/Codex bridge target scoped to the NixOS body
- command override support as a contract, not an executed wrapper
- explicit auth isolation boundaries
- session metadata persistence status
- selected-session readback and missing-session null behavior
- Observer-visible compatibility, auth-isolation, runtime-blocked, and session
  persistence state

The session persistence store records bounded metadata for future ACPX/Codex
sessions:

- independent session keys
- overwrite revision increments
- restart persistence through the core state file
- secret-like metadata key redaction
- no credential value reads
- no auth material copies
- no wrapper writes
- no `npx` or ACP process spawn
- no provider/network egress

Passive Observer refresh exposes the existing read model without creating tasks,
approvals, wrapper files, ACP/Codex processes, provider calls, or network egress.
Explicit operator buttons can create the approval-gated wrapper action task or
wrapper write task; they still do not approve or execute those tasks.

The wrapper/action draft route creates a proposal-only bridge action shape for a
selected persisted session. It records the planned wrapper-relative path,
command shape, auth-isolation boundary, readiness gates, and future approval
requirements without creating a task or approval.

The wrapper action task route creates an approval-gated task from a reviewed
draft. Operator execution blocks before approval. After approval, the executor
records an approved-deferred boundary and completes with explicit evidence that
no wrapper file was written, no credential value was read, no auth material was
copied, no `npx` command was executed, no ACP/Codex process was spawned, and no
network/provider egress occurred.

The wrapper write proposal route derives the planned wrapper-relative path,
Node wrapper content preview, content hash, file/directory mode expectations,
and future `act.openclaw.workspace_text_write` boundary. It uses an explicit
`__OPENCLAW_APPROVED_CODEX_HOME__` placeholder and does not read real
`CODEX_HOME`, read `auth.json` or `config.toml`, copy auth material, create
directories, write the wrapper file, run `chmod`, execute `npx`, spawn ACP/Codex,
call providers, or use network.

The wrapper write task route connects that reviewed proposal to the existing
approval-gated `act.openclaw.workspace_text_write` path. Task creation returns
only metadata, content hash, and approval state; it does not expose the wrapper
content preview in the public task response. Operator execution blocks before
approval. After approval, the normal workspace text-write capability writes the
previewed user-space wrapper file under the bounded workspace root and records
capability history plus filesystem ledger evidence. It still does not read real
Codex credentials, copy auth material, create/chmod the wrapper directory,
execute `npx`, spawn ACP/Codex, call providers, use network, or require root.

The wrapper write execution readback route reads completed wrapper-write task
metadata plus filesystem ledger records and returns validation checks with a
recovery recommendation. It does not create recovery tasks, approve work,
execute operator steps, write files, read credentials, copy auth material,
chmod wrappers, execute wrappers, spawn ACP/Codex, call providers, or use
network.

## Governance

Capability mapping:

```text
ACPX/Codex bridge compatibility -> sense.openclaw.acpx_codex_bridge.compatibility
ACPX runtime persistence tests -> state.openclaw.acpx_codex_bridge.session_metadata
ACPX/Codex wrapper/action draft -> plan.openclaw.acpx_codex_bridge.wrapper_action
ACPX/Codex wrapper/action task -> act.openclaw.acpx_codex_bridge.wrapper_action
ACPX/Codex wrapper write proposal -> plan.openclaw.acpx_codex_bridge.wrapper_write
ACPX/Codex wrapper write approval bridge -> act.openclaw.acpx_codex_bridge.wrapper_write_bridge
Delegated approved write -> act.openclaw.workspace_text_write
ACPX/Codex wrapper write execution readback -> sense.openclaw.acpx_codex_bridge.wrapper_write_execution_evidence
```

This is intentionally not a live bridge execution path. It creates a native
compatibility contract and persistence primitive that later bridge work can
depend on.

## Evidence

Core builder:

```text
services/openclaw-core/src/native-acpx-codex-bridge-builders.mjs
services/openclaw-core/src/native-acpx-codex-bridge-task-builders.mjs
services/openclaw-core/src/task-executor-native-acpx-codex-bridge-handlers.mjs
services/openclaw-core/src/workspace-ops.mjs
services/openclaw-core/src/workspace-native-ops-routes.mjs
services/openclaw-core/src/native-acpx-codex-wrapper-write-execution-evidence-builders.mjs
```

State persistence:

```text
services/openclaw-core/src/runtime-state.mjs
acpxBridgeSessionRecords
```

Route wiring:

```text
services/openclaw-core/src/native-adapter-plugin-routes.mjs
```

Observer visibility:

```text
apps/observer-ui/src/observer-panels-operations.mjs
apps/observer-ui/src/client-script-config-dom-workspace-source.mjs
apps/observer-ui/src/client-script-refreshers-workspace-source.mjs
apps/observer-ui/src/client-script-renderers-acpx-codex-bridge.mjs
apps/observer-ui/src/client-script-startup-refreshes.mjs
```

Validation target:

```text
services/openclaw-core/test/native-acpx-codex-bridge-builders.test.mjs
services/openclaw-core/test/native-acpx-codex-bridge-task-builders.test.mjs
services/openclaw-core/test/native-acpx-codex-wrapper-write-execution-evidence-builders.test.mjs
services/openclaw-core/test/native-adapter-plugin-routes.test.mjs
services/openclaw-core/test/task-executor.test.mjs
openclaw-native-acpx-codex-bridge-compatibility
observer-openclaw-native-acpx-codex-bridge-compatibility
```

## Deferred

The following remain deferred:

```text
CODEX_HOME read
auth.json/config.toml read
auth material copy
direct unapproved wrapper file write
wrapper directory creation or chmod
npx/npx.cmd execution
ACP/Codex process spawn
provider calls
network egress
root/system daemon work
```

## Next Smallest Real Capability

The next smallest useful bridge follow-up is:

```text
ACPX/Codex bridge process-spawn proposal contract
```

That should be proposal-only: map what a future supervised `npx`/ACP spawn would
need from the approved wrapper write evidence, but do not execute the wrapper,
spawn ACP/Codex, read/copy auth material, chmod files, call providers, or use
network egress.
