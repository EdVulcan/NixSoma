# OpenClaw Native Engineering Tool Surface Plan

Updated: 2026-07-09

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
| `cc_lsp` | `sense.openclaw.engineering_tool.lsp_evidence` | `read_only_language_intelligence_evidence` | medium | no approval for evidence; future lifecycle requires explicit availability, state, and recovery evidence | partially absorbed as evidence, lifecycle deferred |
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
LSP lifecycle startup and request handling; `lsp_evidence` contract and
availability evidence is absorbed
verification command execution and task-completion attachment
planning/todo evidence is absorbed; hidden planning mode and todo state mutation remain deferred
provider calls, network egress, and result envelopes
```

## Next Slice

The current next smallest real capability is:

```text
Native governed engineering loop operator controls
```

That slice should make the proven write/edit loops easier to operate from
Observer/workbench without bypassing approval or adding another readiness chain.
