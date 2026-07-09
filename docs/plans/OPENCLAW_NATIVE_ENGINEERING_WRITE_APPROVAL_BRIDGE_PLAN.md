# OpenClaw Native Engineering Write Approval Bridge Plan

Updated: 2026-07-09

## Active Slice

Native governed engineering write proposal approval bridge.

This slice connects reviewed `cc_write`-style proposal evidence to the existing
approval-gated `act.openclaw.workspace_text_write` task path. It does not write
files directly and does not approve or execute the task.

Identity alignment: Level 1, stable user-space control plane.

## Endpoint

```text
POST /plugins/native-adapter/engineering-write-proposal-tasks

registry: openclaw-native-engineering-write-proposal-task-v0
mode: approval-gated-write-proposal-bridge
```

The route requires:

```text
confirm=true
bounded workspace-relative path
redacted proposal evidence from openclaw-native-engineering-write-proposal-v0
existing workspace_text_write approval gate
```

## Implemented Behavior

The bridge:

```text
rebuilds native engineering write proposal evidence before task creation
refuses blocked proposals, including existing targets when overwrite=false
creates a workspace_text_write task only after explicit confirm=true
creates an approval request but does not approve it
keeps operator execution blocked until approval
serializes task and approval responses through public redaction paths
returns proposal metadata, target hashes, and byte counts without content bodies
```

## Deferred

The following remain deferred:

```text
automatic approval
filesystem write before approval
operator execution in this bridge route
verification command execution after write
provider calls, network egress, result envelopes
```

Approved write execution remains the existing `workspace_text_write` task
capability. Future engineering-specific execution evidence should prove the
approved write outcome, filesystem ledger, task transcript, Observer recovery,
and targeted verification without weakening the approval gate.

## Evidence

Bridge implementation:

```text
services/openclaw-core/src/workspace-ops.mjs
services/openclaw-core/src/workspace-native-ops-routes.mjs
```

Proposal source:

```text
services/openclaw-core/src/native-engineering-write-proposal-builders.mjs
```

Observer token:

```text
apps/observer-ui/src/client-script-renderers-engineering-write.mjs
```

Validation target:

```text
services/openclaw-core/test/workspace-native-ops-routes.test.mjs
openclaw-native-engineering-write-approval-bridge
observer-openclaw-native-engineering-write-approval-bridge
```

## Next Slice

The next recommended real capability is:

```text
Native governed engineering write execution evidence
```

That slice should prove approved write execution through the existing
workspace_text_write task path, then attach bounded verification and recovery
evidence. It must not auto-approve or bypass operator approval.
