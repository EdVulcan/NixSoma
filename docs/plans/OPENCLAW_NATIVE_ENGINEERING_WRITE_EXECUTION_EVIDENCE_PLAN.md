# OpenClaw Native Engineering Write Execution Evidence Plan

Updated: 2026-07-09

## Active Slice

Native governed engineering write execution evidence for enhanced-source
`cc_write`.

This slice proves that a `cc_write`-style proposal can move through OpenClaw's
existing approval-gated `workspace_text_write` path and then be audited as a
completed filesystem write. The evidence route is read-only and does not create,
approve, execute, or write.

Identity alignment: Level 1, stable user-space control plane.

## Endpoint

```text
GET /plugins/native-adapter/engineering-write-execution/evidence

registry: openclaw-native-engineering-write-execution-evidence-v0
mode: approved-workspace-text-write-execution-evidence
```

Capability mapping:

```text
cc_write -> sense.openclaw.engineering_tool.write_execution_evidence
```

## Implemented Behavior

The evidence builder:

```text
reads completed filesystem write records from the existing capability ledger
links write_text records back to completed task state
requires engineering write proposal metadata on the task for passing evidence
verifies the approved mutation path uses workspace_text_write -> filesystem.write_text
reports content byte counts and hashes without exposing file content
reports Observer-visible governance and deferred execution boundaries
```

The milestone proof approves and executes a fixture workspace write through the
existing approval flow, then queries this read-only evidence endpoint.

## Deferred

The following remain deferred:

```text
automatic approval
write execution from the evidence route
verification command execution after write
automatic recovery task creation
provider calls, network egress, result envelopes
```

Future follow-up should attach targeted verification evidence and recovery
recommendations to completed engineering write tasks without auto-approval.

## Evidence

Runtime builder:

```text
services/openclaw-core/src/native-engineering-write-execution-evidence-builders.mjs
```

Read-model route:

```text
services/openclaw-core/src/observer-read-model-routes.mjs
```

Observer visibility:

```text
apps/observer-ui/src/observer-panels-operations.mjs
apps/observer-ui/src/client-script-renderers-engineering-write-execution.mjs
```

Validation target:

```text
services/openclaw-core/test/native-engineering-write-execution-evidence-builders.test.mjs
openclaw-native-engineering-write-execution-evidence
observer-openclaw-native-engineering-write-execution-evidence
```

## Next Slice

The next recommended real capability is:

```text
Native governed edit proposal approval bridge
```

That slice should connect `cc_edit` proposal evidence to the existing
approval-gated patch apply task path while preserving the same proposal,
approval, execution, evidence, and recovery separation.
