# OpenClaw Native Engineering LSP Source Transfer Proposal Plan

Updated: 2026-07-10

## Active Slice

Native governed LSP `didOpen` source-transfer proposal.

This slice extends the existing `cc_lsp` lane after initialize/shutdown
handshake evidence. It reads one bounded workspace source file locally, computes
the future `textDocument/didOpen` payload metadata, exposes a bounded preview
and full-content hash, and keeps every LSP process and JSON-RPC action disabled.

Identity alignment: Level 1, stable user-space control plane.

## Endpoint And Registries

```text
GET /plugins/native-adapter/engineering-lsp/source-transfer-proposal
registry: openclaw-native-engineering-lsp-source-transfer-proposal-v0
mode: lsp-didopen-source-transfer-proposal-only
capability: plan.openclaw.engineering_tool.lsp_source_transfer
```

Inputs:

```text
workspacePath
language
relativePath / path
maxFileSizeBytes
maxPreviewChars
```

## Implemented Behavior

The proposal builder:

```text
selects an OpenClaw workspace root
rejects traversal, absolute paths, skipped hidden/generated/cache/dependency path segments, and symlink escapes
requires the selected file extension to match the requested LSP language profile
enforces max file size and binary-file skip
reads only that bounded local source file
computes file URI, languageId, byte count, line count, sha256, and bounded preview
returns the proposed textDocument/didOpen metadata with sent=false
surfaces audit evidence in the response
renders in the existing Observer LSP panel
```

## Boundaries

This slice still blocks:

```text
language server process start
long-lived LSP process pools
textDocument/didOpen transmission
source content transfer into a language-server process
definition / references / hover JSON-RPC requests
task creation and approval creation from this read-only endpoint
workspace mutation
provider calls, network egress, package installation, root/system daemon work
```

## Evidence

Runtime:

```text
services/openclaw-core/src/native-engineering-lsp-source-transfer-proposal-builders.mjs
services/openclaw-core/src/native-adapter-plugin-routes.mjs
apps/observer-ui/src/client-script-renderers-engineering-lsp.mjs
apps/observer-ui/src/client-script-refreshers-workspace-source.mjs
```

Validation targets:

```text
services/openclaw-core/test/native-engineering-lsp-evidence-builders.test.mjs
services/openclaw-core/test/native-adapter-plugin-routes.test.mjs
openclaw-native-engineering-lsp-evidence
observer-openclaw-native-engineering-lsp-evidence
```

The existing LSP evidence milestone now proves static LSP evidence, lifecycle
draft, approval-gated task creation, missing-binary recovery, process probes,
explicit stop readback, lifecycle state, initialize/shutdown handshake evidence,
source-transfer proposal metadata, Observer visibility, and continued blocking
of actual `didOpen`, source transfer into an LSP process, symbol requests, and
long-lived process pools.

## Follow-up Completed

The next executable slice was completed as:

```text
OPENCLAW_NATIVE_ENGINEERING_LSP_SOURCE_TRANSFER_TASK_PLAN.md
```

That follow-up creates a task from an inspected proposal, requires explicit
approval, re-reads and hash-checks the file after approval, sends only
`initialize`, `textDocument/didOpen`, `shutdown`, and `exit` to a bounded
short-lived process, records lifecycle/source-transfer state, and still keeps
symbol requests and long-lived process pools deferred.

## Deferred Work

The next executable slice should not jump straight to definition/references/
hover execution. The next smallest real capability is:

```text
governed LSP symbol request proposal and approval boundary
```

That follow-up should draft the exact symbol request that would be sent after a
completed approved `didOpen`, require explicit approval before sending any
operational symbol request, and keep long-lived pools, provider egress, package
installation, root/system daemon work, and automatic retries deferred.
