# OpenClaw Native Engineering Edit Proposal Plan

Updated: 2026-07-09

## Active Slice

Surgical edit proposal with diff preview.

This slice migrates the useful `cc_edit` idea into OpenClaw-native proposal
generation. It creates an exact-match edit proposal and bounded diff preview,
but does not write files, apply patches, create tasks, or create approvals.

Identity alignment: Level 1, stable user-space control plane.

## Endpoint

```text
GET /plugins/native-adapter/engineering-edit-proposal/draft

registry: openclaw-native-engineering-edit-proposal-v0
mode: surgical-edit-proposal-diff-preview-only
```

Capability mapping:

```text
cc_edit -> act.openclaw.engineering_tool.edit_proposal
```

## Implemented Behavior

The native builder:

```text
uses the bounded read/search surface to read the target workspace file
requires workspace-relative target paths through the read/search boundary
requires exactly one exact oldString match
enforces search and replacement byte limits
builds a bounded diff preview with existing OpenClaw patch utilities
returns hashes, byte counts, changed line, validation, and audit evidence
marks content as not exposed while explicitly exposing the bounded diff preview
keeps apply/write/task/approval deferred
```

## Deferred

The following remain deferred:

```text
filesystem write
patch apply
approval task creation
shell execution or verification command execution
LSP startup
provider calls, network egress, result envelopes
```

Actual application remains the existing approval-gated OpenClaw patch path, not
this proposal endpoint.

## Evidence

Runtime builder:

```text
services/openclaw-core/src/native-engineering-edit-proposal-builders.mjs
```

Route wiring:

```text
services/openclaw-core/src/native-adapter-plugin-routes.mjs
```

Observer visibility:

```text
apps/observer-ui/src/observer-panels-operations.mjs
apps/observer-ui/src/client-script-renderers-engineering-edit.mjs
```

Validation target:

```text
services/openclaw-core/test/native-engineering-edit-proposal-builders.test.mjs
openclaw-native-engineering-edit-proposal
observer-openclaw-native-engineering-edit-proposal
```

Validated on 2026-07-09:

```text
node --test services/openclaw-core/test/native-engineering-edit-proposal-builders.test.mjs services/openclaw-core/test/native-adapter-plugin-routes.test.mjs
npm --workspace @openclaw/openclaw-core run typecheck
npm --workspace @openclaw/observer-ui run typecheck
OPENCLAW_MILESTONE_CHECKS=openclaw-native-engineering-edit-proposal,observer-openclaw-native-engineering-edit-proposal bash nix/scripts/dev-milestone-check.sh
```

## Next Slice

The next recommended real capability is:

```text
verification command evidence attached to task completion
```

That slice should migrate the `cc_verify` idea as governed command evidence with
command shape, provenance, timeout, retry budget, exit status, output budget,
and Observer visibility. It must not become ungoverned shell execution.
