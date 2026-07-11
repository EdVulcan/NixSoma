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
| `cc_lsp` | `sense.openclaw.engineering_tool.lsp_evidence` / `act.openclaw.engineering_tool.lsp_lifecycle_task` / `sense.openclaw.engineering_tool.lsp_lifecycle_state` / `plan.openclaw.engineering_tool.lsp_source_transfer` / `act.openclaw.engineering_tool.lsp_source_transfer_task` / `plan.openclaw.engineering_tool.lsp_symbol_request` / `act.openclaw.engineering_tool.lsp_symbol_request_task` / `sense.openclaw.engineering_tool.lsp_selected_target_read_bridge` / `plan.openclaw.engineering_tool.lsp_selected_target_edit_proposal_seed` | `language_intelligence_evidence_governed_lifecycle_source_transfer_symbol_boundary_read_bridge_edit_seed_approved_edit_verification_recovery_and_rerun_proof` | medium | no approval for evidence/state/proposal/read-bridge/edit-seed/recovery-evidence readback; approval required before lifecycle/source-transfer/symbol execution, edit mutation, verification command execution, or recovery rerun | partially absorbed as evidence, lifecycle draft, approval-gated binary gate, bounded process supervision probe, lifecycle state readback, initialize/shutdown handshake, didOpen source-transfer proposal, approval-gated didOpen task, symbol request proposal, approval-gated single symbol request task, bounded response target selection, selected-target native read bridge, selected-target edit proposal seed, selected-target approved edit closed-loop proof, selected-target verification handoff, selected-target recovery recommendation handoff, and selected-target recovered verification rerun proof |
| `cc_verify` | `act.openclaw.engineering_tool.verify` | `verification_command_evidence` | medium | command execution requires policy or approval | partially absorbed, command execution deferred |
| `cc_plan_enter` | `plan.openclaw.engineering_tool.plan_enter` / `act.openclaw.engineering_context.plan_todo_workbench_state` | `planning_state` | low | no hidden mode switch; explicit operator confirmation for core-state workbench storage | absorbed as evidence plus governed workbench storage |
| `cc_plan_exit` | `plan.openclaw.engineering_tool.plan_exit` / `act.openclaw.engineering_context.plan_todo_workbench_state` | `planning_state` | low | no hidden execution transition; explicit operator confirmation for stored confirmed-plan readback | absorbed as evidence plus governed workbench storage |
| `cc_todo_write` | `plan.openclaw.engineering_tool.todo_write` / `act.openclaw.engineering_context.plan_todo_workbench_state` | `planning_state` | low | explicit operator confirmation for bounded core-state todo storage; no `.openclaw/cc-todo.md` write | absorbed as evidence plus governed workbench storage |

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
symbol request task, bounded target selection, explicit selected-target read
bridge, selected-target edit proposal seed, and selected-target approved edit
closed-loop proof are absorbed; selected-target verification handoff is also
absorbed through the existing approval-gated source-command path; selected-target
recovery recommendation handoff is absorbed through read-only recovery evidence
and explicit recovery task creation; recovered verification rerun proof is
absorbed through the existing approval/operator/verification readback path
verification command execution and task-completion attachment
planning/todo evidence and governed core-state workbench storage are absorbed; hidden planning mode, `.openclaw/cc-todo.md` persistence, task mutation, and plan_exit execution transition remain deferred
microcompact evidence, bounded in-memory projection, and local governed engineering context packets are absorbed; automatic provider-request integration and persisted transcript rewriting remain deferred
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

The governed plan/todo workbench storage follow-up was completed as:

```text
OPENCLAW_NATIVE_ENGINEERING_PLAN_TODO_WORKBENCH_STORAGE_PLAN.md
```

It stores bounded visible plan/todo state in OpenClaw core state, feeds
`workbench_storage` back into the existing plan/todo evidence route, and exposes
an Observer Save Workbench State control while keeping hidden planning modes,
todo-file writes, task mutation, approval creation, command execution, provider
egress, and result envelopes blocked.

The same lane now emits `openclaw-native-engineering-plan-todo-next-action-v0`
as guidance-only readback over the stored/current todo. It points to existing
Observer controls and governed capabilities but does not create tasks,
approvals, execution, provider calls, workspace mutation, or result envelopes.

Observer now has a `Use Suggested Action` bridge for that readback. It dispatches
only through a local whitelist of existing governed controls after the suggested
control id matches the expected control, so the readback remains guidance rather
than an arbitrary endpoint, command, provider, or workspace mutation channel.

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

The Observer symbol request control follow-up was completed as:

```text
OPENCLAW_NATIVE_ENGINEERING_LSP_OBSERVER_SYMBOL_REQUEST_CONTROL_PLAN.md
```

That slice exposes creation and completion readback for the existing
approval-gated symbol request task in the LSP Observer panel without adding a
new standalone evidence shell.

The current next smallest real capability is:

```text
governed LSP references/hover variants
```

The bounded response summary follow-up was completed as:

```text
OPENCLAW_NATIVE_ENGINEERING_LSP_SYMBOL_RESPONSE_SUMMARY_PLAN.md
```

That slice records result shape/count metadata from approved single symbol
requests without returning raw response payloads or source bodies.

The references/hover variant follow-up was completed as:

```text
OPENCLAW_NATIVE_ENGINEERING_LSP_VARIANT_REQUESTS_PLAN.md
```

That slice proves `definition`, `references`, and `hover` use the same
approval-gated single-request path and bounded response summary.

The response target selection follow-up was completed as:

```text
OPENCLAW_NATIVE_ENGINEERING_LSP_RESPONSE_TARGET_SELECTION_PLAN.md
```

That slice records bounded URI/range target descriptors and a selected target
from approved symbol responses without exposing raw response payloads.

The selected-target read bridge follow-up was completed as:

```text
OPENCLAW_NATIVE_ENGINEERING_LSP_SELECTED_TARGET_READ_BRIDGE_PLAN.md
```

That slice connects completed LSP selected target metadata to the native bounded
read/search surface. It returns a follow-up read request by default and returns
bounded read content only when `includeRead=true` is explicit.

The Observer selected-target read control follow-up was completed as:

```text
OPENCLAW_NATIVE_ENGINEERING_LSP_OBSERVER_SELECTED_TARGET_READ_CONTROL_PLAN.md
```

That slice lets the operator call the selected-target read bridge from
Engineering Loop State and inspect the bounded read preview without automatic
task creation or mutation.

The selected-target edit proposal seed follow-up was completed as:

```text
OPENCLAW_NATIVE_ENGINEERING_LSP_SELECTED_TARGET_EDIT_PROPOSAL_SEED_PLAN.md
```

That slice converts completed LSP selected target reads into edit seeds and can
build a normal bounded edit proposal when replacement text is explicitly
provided, while preserving approval-gated mutation.

The Observer selected-target edit seed control follow-up was completed as:

```text
OPENCLAW_NATIVE_ENGINEERING_LSP_OBSERVER_SELECTED_TARGET_EDIT_SEED_CONTROL_PLAN.md
```

That slice seeds the existing Observer edit proposal inputs from a completed
LSP selected target, without creating an edit task or approval automatically.

The selected-target edit closed-loop proof follow-up was completed as:

```text
OPENCLAW_NATIVE_ENGINEERING_LSP_SELECTED_TARGET_EDIT_CLOSED_LOOP_PLAN.md
```

That slice proves the operator path from selected target to seeded edit inputs,
explicit edit task, approval, patch apply, filesystem ledger, existing edit
execution evidence, and bounded readback without adding another readiness shell.

The selected-target verification handoff follow-up was completed as:

```text
OPENCLAW_NATIVE_ENGINEERING_LSP_SELECTED_TARGET_VERIFICATION_HANDOFF_PLAN.md
```

That slice attaches explicit source-command verification task creation,
approval-gated command execution, and verification evidence readback to the
selected-target edit flow without creating another standalone readiness chain.

The selected-target recovery recommendation handoff follow-up was completed as:

```text
OPENCLAW_NATIVE_ENGINEERING_LSP_SELECTED_TARGET_RECOVERY_RECOMMENDATION_HANDOFF_PLAN.md
```

That slice proves failed selected-target verification can be read as recovery
evidence and turned into an explicit recovery task through existing recovery
controls, while keeping recovered execution blocked before approval.

The selected-target recovered verification rerun follow-up was completed as:

```text
OPENCLAW_NATIVE_ENGINEERING_LSP_SELECTED_TARGET_RECOVERED_VERIFICATION_RERUN_PLAN.md
```

That slice approves and runs the recovered verification task through the
existing operator path, then proves successful rerun verification evidence and
source recovery readback without automatic approval or recovery execution.

The live plugin runtime refresh follow-up was completed as:

```text
OPENCLAW_NATIVE_PLUGIN_RUNTIME_REFRESH_TASK_PLAN.md
```

It creates an approval-gated runtime refresh task, blocks before approval,
recomputes read-model evidence after approval, persists task execution evidence,
and keeps plugin module import, plugin code execution, runtime activation, cache
mutation, provider egress, and root work disabled.

The ACPX/Codex bridge compatibility follow-up was completed as:

```text
OPENCLAW_NATIVE_ACPX_CODEX_BRIDGE_COMPATIBILITY_PLAN.md
```

It maps enhanced-source ACPX/Codex command/auth-isolation lessons into a native
compatibility read model and persists bounded session metadata with independent
sessions, overwrite revisions, missing-session null behavior, restart recovery,
and secret-key redaction. It still does not read `CODEX_HOME`, copy auth
material, write wrappers, spawn ACP processes, or perform provider egress.

The ACPX/Codex lane now also includes Observer visibility, proposal drafts,
approval-gated wrapper action tasks, wrapper write proposal and approval bridge
through `act.openclaw.workspace_text_write`, wrapper write execution readback,
process-spawn proposal/preflight, and live execution boundary review. The next
ACPX/Codex step is explicit live process execution authorization, which is
intentionally blocked for autonomous development because it crosses real local
process, auth, provider, and network boundaries.

The Level 2 trusted work-view follow-up completed as:

```text
OPENCLAW_TRUSTED_WORK_VIEW_SESSION_CONTRACT_PLAN.md
```

That lane now carries a shared trusted-session contract, helper recovery
recommendations, Observer recovery bridging, sidecar lifecycle task
materialization, start-probe approval blocking, consolidated task/readback
evidence, authoritative session identity matching across session-manager and
browser-runtime, divergence recovery recommendations, and Observer session
identity visibility. It still does not start a sidecar process, install a
helper, capture the desktop, require root, copy credentials, call providers, or
spawn ACP/Codex.

The plan/todo suggested-action task/readback linkage is now complete through the
existing edit/write/verification controls. The core recomputes the action from
persisted workbench state and exposes only compact provenance in task and
Observer readback.

The next autonomous slice should leave Level 1 horizontal engineering expansion
and advance the smallest real Level 2 trusted AI work-view/session-helper
behavior. Stay within existing governed local body and Observer surfaces unless
the operator explicitly authorizes helper process start, root, desktop-wide
capture, provider egress, or another blocked boundary above.

That transition has started with a session-manager owned in-process helper lease
that browser-runtime matches for the AI-owned work-view session. The next Level
2 slice should enforce the same lease through existing browser action mediation,
not return to another native engineering evidence shell.

The lease is now enforced for screen-act mediated browser input and click. The
next Level 2 slice should bind explicit operator takeover to lease suspension and
explicit resume/rebind.
