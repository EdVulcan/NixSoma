# OpenClaw Native Engineering LSP Selected-Target Edit Proposal Seed Plan

Updated: 2026-07-10

## Active Slice

LSP selected-target edit proposal seed.

This slice connects a completed LSP selected target to the existing native
governed edit proposal surface. It reads the selected target through the
bounded bridge, exposes the selected text as an edit seed, and can build a
normal exact-match edit proposal when the operator supplies replacement text.

Identity alignment: Level 1, stable user-space control plane.

## Endpoint And Registry

```text
GET /plugins/native-adapter/engineering-lsp/selected-target-edit-proposal-seed
registry: openclaw-native-engineering-lsp-selected-target-edit-proposal-seed-v0
mode: lsp-selected-target-edit-proposal-seed
```

Capability mapping:

```text
cc_lsp selected target + cc_read + cc_edit
-> plan.openclaw.engineering_tool.lsp_selected_target_edit_proposal_seed
```

## Implemented Behavior

The seed endpoint:

```text
requires completed symbol_request lifecycle state
uses the selected-target read bridge with includeRead=true
uses contextLines=0 by default so the seed is the selected target range
returns target path, selected text, byte count, and hash
returns no edit proposal until replacement text is provided
builds a normal openclaw-native-engineering-edit-proposal-v0 diff preview when newString is provided
keeps task creation, approval creation, patch application, and mutation disabled
```

## Boundaries

This slice still blocks:

```text
automatic replacement generation
automatic edit task creation
automatic approval creation
patch application and workspace mutation
additional JSON-RPC requests
LSP process start/reuse
provider calls, network egress, root/system daemon work
```

## Evidence

Runtime:

```text
services/openclaw-core/src/native-engineering-lsp-selected-target-read-bridge-builders.mjs
services/openclaw-core/src/native-adapter-plugin-routes.mjs
services/openclaw-core/src/plugin-review.mjs
```

Validation targets:

```text
services/openclaw-core/test/native-engineering-lsp-selected-target-read-bridge-builders.test.mjs
services/openclaw-core/test/native-adapter-plugin-routes.test.mjs
openclaw-native-engineering-lsp-evidence
```

## Follow-up Completed

The Observer selected-target edit seed control follow-up was completed as:

```text
OPENCLAW_NATIVE_ENGINEERING_LSP_OBSERVER_SELECTED_TARGET_EDIT_SEED_CONTROL_PLAN.md
```

That slice lets the operator seed the existing Observer edit proposal inputs
from a completed LSP selected target, while keeping actual mutation on the
existing approval-gated edit task path.
