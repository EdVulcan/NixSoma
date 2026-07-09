# OpenClaw Native Engineering LSP Symbol Request Proposal Plan

Updated: 2026-07-10

## Active Slice

Governed LSP symbol request proposal and approval boundary.

This slice follows the approval-gated `didOpen` source-transfer task. It drafts
the exact `textDocument/definition`, `textDocument/references`, or
`textDocument/hover` request that would be sent after approved didOpen state
exists, but it does not send any operational symbol request.

Identity alignment: Level 1, stable user-space control plane.

## Endpoint And Registry

```text
GET /plugins/native-adapter/engineering-lsp/symbol-request-proposal
registry: openclaw-native-engineering-lsp-symbol-request-proposal-v0
mode: lsp-symbol-request-proposal-only
capability: plan.openclaw.engineering_tool.lsp_symbol_request
```

Inputs:

```text
workspacePath
language
action: definition | references | hover
relativePath / path
line
character
```

## Implemented Behavior

The proposal builder:

```text
reads only OpenClaw LSP lifecycle state
requires a matching approved didOpen source-transfer state
maps the requested action to the exact LSP method
converts the operator line/character into LSP position metadata
returns proposed JSON-RPC params with sent=false
reports blocked readiness when no approved didOpen state exists
exposes Observer visibility through the existing LSP panel
```

## Boundaries

This slice still blocks:

```text
definition / references / hover JSON-RPC execution
long-lived language-server process pools
task creation and approval creation from the read-only proposal endpoint
workspace mutation
provider calls, network egress, package installation, root/system daemon work
```

## Evidence

Runtime:

```text
services/openclaw-core/src/native-engineering-lsp-symbol-request-proposal-builders.mjs
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

## Follow-up Completed

The task boundary was completed as:

```text
OPENCLAW_NATIVE_ENGINEERING_LSP_SYMBOL_REQUEST_TASK_PLAN.md
```

That follow-up creates a task from approved didOpen state, requires explicit
approval, sends exactly one selected operational symbol request through a
bounded short-lived process, records bounded response metadata, and keeps
long-lived process pools, provider egress, package installation, root/system
daemon work, and automatic retries deferred.
