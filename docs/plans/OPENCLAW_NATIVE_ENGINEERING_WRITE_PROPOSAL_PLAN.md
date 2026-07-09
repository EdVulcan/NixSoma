# OpenClaw Native Engineering Write Proposal Plan

Updated: 2026-07-09

## Active Slice

Native governed source write proposal evidence for enhanced-source `cc_write`.

This slice migrates the useful `cc_write` create/overwrite intent into
OpenClaw-native proposal evidence. It does not write files, overwrite files,
create tasks, create approvals, run shell commands, call providers, or import
the enhanced source implementation.

Identity alignment: Level 1, stable user-space control plane.

## Endpoint

```text
GET /plugins/native-adapter/engineering-write-proposal/draft

registry: openclaw-native-engineering-write-proposal-v0
mode: source-write-proposal-diff-metadata-preview-only
```

Capability mapping:

```text
cc_write -> act.openclaw.engineering_tool.write_proposal
```

Approved mutation remains on:

```text
act.openclaw.workspace_text_write
```

## Implemented Behavior

The native builder:

```text
resolves create or overwrite targets inside the bounded workspace root
rejects path traversal and hidden/generated/cache/dependency directories
checks existing target realpaths and existing parent realpaths
blocks existing targets unless overwrite=true is explicitly requested
reads existing target content only through the bounded read surface
returns proposed and existing byte/hash metadata without exposing content
returns redacted diff metadata with line hashes instead of raw diff text
reports Observer-visible governance and deferred mutation boundaries
```

The endpoint returns response-embedded audit evidence and does not persist a new
record.

## Deferred

The following remain deferred:

```text
filesystem write
overwrite execution
task creation
approval creation
filesystem ledger entry
verification command execution
provider calls, network egress, result envelopes
```

Future write execution should bridge this proposal to the existing
approval-gated `act.openclaw.workspace_text_write` task path, preserving
workspace scope, redacted content handling, approval evidence, filesystem
ledgering, Observer recovery evidence, and explicit operator confirmation.

## Evidence

Runtime builder:

```text
services/openclaw-core/src/native-engineering-write-proposal-builders.mjs
```

Route wiring:

```text
services/openclaw-core/src/native-adapter-plugin-routes.mjs
```

Observer visibility:

```text
apps/observer-ui/src/observer-panels-operations.mjs
apps/observer-ui/src/client-script-renderers-engineering-write.mjs
```

Validation target:

```text
services/openclaw-core/test/native-engineering-write-proposal-builders.test.mjs
services/openclaw-core/test/native-adapter-plugin-routes.test.mjs
openclaw-native-engineering-write-proposal
observer-openclaw-native-engineering-write-proposal
```

## Follow-Up Status

The recommended approval bridge follow-up was completed as:

```text
OPENCLAW_NATIVE_ENGINEERING_WRITE_APPROVAL_BRIDGE_PLAN.md
```

That slice connects reviewed write proposal evidence to the existing
approval-gated workspace text write task path. It still does not approve or
execute the write.
