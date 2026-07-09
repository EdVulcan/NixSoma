# OpenClaw Native Engineering Tool Surface Plan

Updated: 2026-07-10

## Active Slice

Native governed engineering tool surface: read-only tool inventory and contract
mapping.

This slice turns the preserved enhanced `openclaw` `cc-tools` source into an
OpenClaw-native contract directory. It does not migrate or execute the
standalone tool implementations.

Identity alignment: Level 1, stable user-space control plane.

## Scope

The active implementation exposes:

```text
GET /plugins/native-adapter/engineering-tool-surface
registry: openclaw-native-engineering-tool-surface-inventory-v0
mode: read-only-tool-contract-mapping
```

The endpoint reads only enough enhanced-source metadata to prove which tool
contracts exist and how OpenClaw intends to govern them. It reports source index
presence, expected source file presence, contract fields, governance flags, and
deferred execution boundaries.

It does not:

```text
import cc-tools modules
execute cc_read / cc_glob / cc_grep
create edits, patches, writes, tasks, or approvals
start LSP servers
run verification commands
mutate plan/todo state
expose source file bodies
call providers or perform network egress
```

## Contract Mapping

| Source tool | Native capability id | Operation class | Risk | Approval expectation | Migration status |
| --- | --- | --- | --- | --- | --- |
| `cc_read` | `sense.openclaw.engineering_tool.read` | `read_only_file_read` | low | no approval for inventory; future content reads require workspace scope, budget, and audit | contract mapped, execution deferred |
| `cc_edit` | `act.openclaw.engineering_tool.edit_proposal` / `act.openclaw.engineering_tool.edit_proposal_task` / `sense.openclaw.engineering_tool.edit_execution_evidence` | `mutation_proposal_approval_execution_evidence` | high | approval required before apply | absorbed through governed proposal, approval bridge, thin execution evidence, and closed-loop proof |
| `cc_write` | `act.openclaw.engineering_tool.write_proposal` / `sense.openclaw.engineering_tool.write_execution_evidence` | `mutation_proposal_and_execution_evidence` | high | approval required before create or overwrite | absorbed through governed proposal, approval bridge, and execution evidence |
| `cc_glob` | `sense.openclaw.engineering_tool.glob` | `read_only_path_search` | low | no approval for bounded metadata search | contract mapped, execution deferred |
| `cc_grep` | `sense.openclaw.engineering_tool.grep` | `read_only_content_search` | low | no approval for bounded search; snippets require budget and audit | contract mapped, execution deferred |
| `cc_lsp` | `sense.openclaw.engineering_tool.lsp_evidence` / `act.openclaw.engineering_tool.lsp_lifecycle_task` / `sense.openclaw.engineering_tool.lsp_lifecycle_state` / `plan.openclaw.engineering_tool.lsp_source_transfer` / `act.openclaw.engineering_tool.lsp_source_transfer_task` / `plan.openclaw.engineering_tool.lsp_symbol_request` / `act.openclaw.engineering_tool.lsp_symbol_request_task` | `language_intelligence_evidence_governed_lifecycle_source_transfer_and_symbol_boundary` | medium | no approval for evidence/state/proposal readback; approval required before lifecycle/source-transfer/symbol execution | partially absorbed as evidence, lifecycle draft, approval-gated binary gate, bounded process supervision probe, lifecycle state readback, initialize/shutdown handshake, didOpen source-transfer proposal, approval-gated didOpen task, symbol request proposal, and approval-gated single symbol request task |
| `cc_verify` | `act.openclaw.engineering_tool.verify` | `verification_command_evidence` | medium | command execution requires policy or approval | partially absorbed, command execution deferred |
| `cc_plan_enter` | `plan.openclaw.engineering_tool.plan_enter` | `planning_state` | low | no hidden mode switch without task/workbench evidence | state mutation deferred |
| `cc_plan_exit` | `plan.openclaw.engineering_tool.plan_exit` | `planning_state` | low | no hidden execution transition without task evidence | state mutation deferred |
| `cc_todo_write` | `plan.openclaw.engineering_tool.todo_write` | `planning_state` | low | filesystem persistence deferred to governed workbench storage | state mutation deferred |

Every entry records:

```text
source tool name
intended native capability id
operation class
risk level
domain
approval expectation
audit expectation
Observer visibility expectation
migration status
deferred execution boundary
```

## Evidence

Core builder:

```text
services/openclaw-core/src/native-engineering-tool-surface-builders.mjs
```

Core route:

```text
services/openclaw-core/src/native-adapter-plugin-routes.mjs
```

Observer visibility:

```text
apps/observer-ui/src/observer-panels-operations.mjs
apps/observer-ui/src/client-script-config-dom-workspace-source.mjs
apps/observer-ui/src/client-script-refreshers-workspace-source.mjs
apps/observer-ui/src/client-script-renderers-workspace-source.mjs
apps/observer-ui/src/client-script-startup-refreshes.mjs
```

Validation targets:

```text
services/openclaw-core/test/native-engineering-tool-surface-builders.test.mjs
openclaw-native-engineering-tool-surface-inventory
observer-openclaw-native-engineering-tool-surface-inventory
```

## Deferred Execution

The following remain intentionally deferred:

```text
unbounded/raw file reads outside the native read/search surface
raw enhanced glob/grep execution outside native bounds
automatic edit approval, automatic recovery task creation, and unapproved verification command execution
automatic write approval, automatic recovery task creation, and post-write
verification command execution
long-lived LSP process pool and multi-request symbol navigation sessions;
`lsp_evidence` contract, availability evidence, lifecycle readiness draft,
approval-gated binary gate, bounded process supervision probe, lifecycle state
readback, initialize/shutdown handshake, source-transfer proposal, and approved
didOpen source-transfer task, symbol request proposal, and approval-gated single
symbol request task are absorbed
verification command execution and task-completion attachment
planning/todo evidence is absorbed; hidden planning mode and todo state mutation remain deferred
provider calls, network egress, and result envelopes
```

## Next Slice

The recovery action draft follow-up was completed as:

```text
OPENCLAW_NATIVE_ENGINEERING_LOOP_RECOVERY_ACTION_DRAFT_PLAN.md
```

The operator-control bridge is now visible, parameterized, guided in Observer,
can read completion evidence after manual approval/execution, and can draft and
explicitly create a recovery task from failed verification evidence without
automatic execution.

The recovery rerun readback follow-up was completed as:

```text
OPENCLAW_NATIVE_ENGINEERING_LOOP_RECOVERY_RERUN_READBACK_PLAN.md
```

The engineering loop now covers failed verification recovery through explicit
recovery task creation, manual approval, operator rerun, recovered-task
verification evidence, and source recovery readback.

The planning workbench state bridge follow-up was completed as:

```text
OPENCLAW_NATIVE_ENGINEERING_PLANNING_WORKBENCH_STATE_BRIDGE_PLAN.md
```

It turns existing plan/todo evidence into operator-visible Engineering Loop
State for selected engineering tasks without hidden planning modes, todo-file
writes, or task mutation.

The workbench state restoration follow-up was completed as:

```text
OPENCLAW_NATIVE_ENGINEERING_WORKBENCH_STATE_RESTORATION_PLAN.md
```

The Observer can now rebuild the latest engineering loop state from core task
history after reload without creating tasks, approvals, execution, or mutation.

The Observer startup auto-restore follow-up was completed as:

```text
OPENCLAW_NATIVE_ENGINEERING_WORKBENCH_STATE_AUTO_RESTORE_PLAN.md
```

Observer startup now calls the read-only restoration flow when no local loop
state exists, while keeping operator action creation explicit and
approval-gated.

The LSP lifecycle readiness draft follow-up was completed as:

```text
OPENCLAW_NATIVE_ENGINEERING_LSP_LIFECYCLE_READINESS_DRAFT_PLAN.md
```

That slice moves beyond static LSP evidence by drafting a governed,
workspace-scoped language-server lifecycle action without starting servers,
reading arbitrary files, creating tasks/approvals, persisting lifecycle state, or
sending JSON-RPC.

The LSP supervised lifecycle pilot follow-up was completed as:

```text
OPENCLAW_NATIVE_ENGINEERING_LSP_SUPERVISED_LIFECYCLE_PILOT_PLAN.md
```

That slice creates an approval-gated workspace-scoped lifecycle task, proves
pre-approval blocking and approved binary-gate execution, records missing-binary
recovery evidence, starts and terminates a bounded user-space process
supervision probe when the mapped server binary exists, records task readback,
and exposes the workflow in Observer without long-lived process state or
JSON-RPC.

The LSP lifecycle state follow-up was completed as:

```text
OPENCLAW_NATIVE_ENGINEERING_LSP_LIFECYCLE_STATE_PLAN.md
```

It adds persisted read-only lifecycle records for approved start/restart probes,
explicit stop actions, and recovery-required states while keeping JSON-RPC and
source-content transfer disabled.

The LSP source-transfer proposal follow-up was completed as:

```text
OPENCLAW_NATIVE_ENGINEERING_LSP_SOURCE_TRANSFER_PROPOSAL_PLAN.md
```

That slice reads one bounded workspace source file locally, shows the future
`textDocument/didOpen` metadata, hash, and preview in Observer, and keeps actual
source transfer into an LSP process disabled.

The approval-gated didOpen task follow-up was completed as:

```text
OPENCLAW_NATIVE_ENGINEERING_LSP_SOURCE_TRANSFER_TASK_PLAN.md
```

That slice creates an inspected source-transfer task from the proposal, requires
explicit approval, sends only initialize plus `textDocument/didOpen`, shutdown,
and exit to a bounded short-lived process, records lifecycle/source-transfer
state, and keeps definition/references/hover requests, long-lived process pools,
provider egress, package installation, and root/system daemon work disabled.

The symbol request proposal follow-up was completed as:

```text
OPENCLAW_NATIVE_ENGINEERING_LSP_SYMBOL_REQUEST_PROPOSAL_PLAN.md
```

That slice drafts the exact definition/references/hover request that would be
sent after approved didOpen state exists and keeps operational symbol request
execution disabled.

The approval-gated symbol request task follow-up was completed as:

```text
OPENCLAW_NATIVE_ENGINEERING_LSP_SYMBOL_REQUEST_TASK_PLAN.md
```

That slice sends exactly one approved definition/references/hover request
through a bounded short-lived LSP process, records lifecycle state, and keeps
long-lived process pools, provider egress, package installation, and
root/system daemon work disabled.

The current next smallest real capability is:

```text
Observer LSP symbol request task control and readback
```

That slice should expose creation and completion readback for the existing
approval-gated symbol request task in the LSP Observer panel without adding a
new standalone evidence shell.
