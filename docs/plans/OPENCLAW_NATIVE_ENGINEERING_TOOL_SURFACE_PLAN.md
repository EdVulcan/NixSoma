# OpenClaw Native Engineering Tool Surface Plan

Updated: 2026-07-15

## Current Frontier

The original read-only inventory and the subsequent Level 1 engineering loop
are complete through LSP selected-target edit, verification, recovery/rerun,
plugin refresh, ACPX/Codex boundary evidence, and local context-packet
assembly. The Level 1 operator execution-consistency correction and the
unified capability-runtime bridges for bounded read/search, verification
evidence, local context packet, trusted work-view observation, explicit
work-view owner control, and the bounded edit/write proposal entry points are
now complete; the next identity-upgrade route remains a concrete operator decision
rather than another horizontal action variant.

The previously route-only plan/todo workbench lane is also closed at the common
runtime boundary. Its evidence and confirmed core-state storage descriptors now
dispatch through `/capabilities/invoke`, reuse the existing builders, and keep
plan text and todo descriptions out of persisted invocation summaries.

The latest completed slices are the compact work-view association, the explicit
operator-reviewed task bind documented in
`OPENCLAW_NATIVE_ENGINEERING_WORK_VIEW_ASSOCIATION_PLAN.md` and
`OPENCLAW_NATIVE_ENGINEERING_WORK_VIEW_BIND_PLAN.md`, and the execution binding
documented in
`OPENCLAW_NATIVE_ENGINEERING_OPERATOR_EXECUTION_BINDING_PLAN.md`. The bounded
read/search and verification capability-runtime bridges are documented in
`OPENCLAW_NATIVE_ENGINEERING_CAPABILITY_RUNTIME_READ_SEARCH_PLAN.md` and
`OPENCLAW_NATIVE_ENGINEERING_CAPABILITY_RUNTIME_VERIFICATION_EVIDENCE_PLAN.md`;
the context-packet, Level 2 observation, and owner-control bridges are
documented in
`OPENCLAW_NATIVE_ENGINEERING_CAPABILITY_RUNTIME_CONTEXT_PACKET_PLAN.md`,
`OPENCLAW_NATIVE_ENGINEERING_CAPABILITY_RUNTIME_EDIT_PROPOSAL_PLAN.md`,
`OPENCLAW_NATIVE_ENGINEERING_CAPABILITY_RUNTIME_WRITE_PROPOSAL_PLAN.md`,
`OPENCLAW_NATIVE_ENGINEERING_CAPABILITY_RUNTIME_EXECUTION_EVIDENCE_PLAN.md`,
`OPENCLAW_NATIVE_ENGINEERING_CAPABILITY_RUNTIME_WORK_VIEW_OBSERVATION_PLAN.md`
and
`OPENCLAW_NATIVE_ENGINEERING_CAPABILITY_RUNTIME_WORK_VIEW_CONTROL_PLAN.md`.

Do not select historical inventory or LSP variant text below as a new slice.

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

The inventory endpoint itself does not:

```text
import cc-tools modules
execute the mapped tools
create edits, patches, writes, tasks, or approvals
start LSP servers
run verification commands
mutate plan/todo state
expose source file bodies
call providers or perform network egress
```

The separate native read/search surface executes only bounded native
`cc_read`/`cc_glob`/`cc_grep` behavior. Its capability-runtime entry point is
governed by the existing local policy, invocation ledger, and audit event path.

## Contract Mapping

| Source tool | Native capability id | Operation class | Risk | Approval expectation | Migration status |
| --- | --- | --- | --- | --- | --- |
| `cc_read` | `sense.openclaw.engineering_tool.read` | `read_only_file_read` | low | no approval for bounded content reads; workspace scope, budget, and audit required | absorbed through bounded native route and capability-runtime invoke |
| `cc_edit` | `act.openclaw.engineering_tool.edit_proposal` / `act.openclaw.engineering_tool.edit_proposal_task` / `sense.openclaw.engineering_tool.edit_execution_evidence` | `mutation_proposal_approval_execution_evidence` | high | approval required before apply | absorbed through governed proposal, approval bridge, thin execution evidence, and closed-loop proof |
| `cc_write` | `act.openclaw.engineering_tool.write_proposal` / `sense.openclaw.engineering_tool.write_execution_evidence` | `mutation_proposal_and_execution_evidence` | high | approval required before create or overwrite | absorbed through governed proposal, approval bridge, and execution evidence |
| `cc_glob` | `sense.openclaw.engineering_tool.glob` | `read_only_path_search` | low | no approval for bounded metadata search | absorbed through bounded native route and capability-runtime invoke |
| `cc_grep` | `sense.openclaw.engineering_tool.grep` | `read_only_content_search` | low | no approval for bounded search; snippets require budget and audit | absorbed through bounded native route and capability-runtime invoke |
| `cc_lsp` | `sense.openclaw.engineering_tool.lsp_evidence` / `act.openclaw.engineering_tool.lsp_lifecycle_task` / `sense.openclaw.engineering_tool.lsp_lifecycle_state` / `plan.openclaw.engineering_tool.lsp_source_transfer` / `act.openclaw.engineering_tool.lsp_source_transfer_task` / `plan.openclaw.engineering_tool.lsp_symbol_request` / `act.openclaw.engineering_tool.lsp_symbol_request_task` / `sense.openclaw.engineering_tool.lsp_selected_target_read_bridge` / `plan.openclaw.engineering_tool.lsp_selected_target_edit_proposal_seed` | `language_intelligence_evidence_governed_lifecycle_source_transfer_symbol_boundary_read_bridge_edit_seed_approved_edit_verification_recovery_and_rerun_proof` | medium | no approval for evidence/state/proposal/read-bridge/edit-seed/recovery-evidence readback; approval required before lifecycle/source-transfer/symbol execution, edit mutation, verification command execution, or recovery rerun | partially absorbed as evidence, lifecycle draft, approval-gated binary gate, bounded process supervision probe, lifecycle state readback, initialize/shutdown handshake, didOpen source-transfer proposal, approval-gated didOpen task, symbol request proposal, approval-gated single symbol request task, bounded response target selection, selected-target native read bridge, selected-target edit proposal seed, selected-target approved edit closed-loop proof, selected-target verification handoff, selected-target recovery recommendation handoff, and selected-target recovered verification rerun proof |
| `cc_verify` | `sense.openclaw.engineering_tool.verify_evidence` / `act.openclaw.engineering_tool.verify` | `verification_command_evidence` | medium | evidence readback is audit-only; command execution remains on the existing approval-gated task path | absorbed through bounded evidence route and capability-runtime invoke; new command execution deferred |
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
services/openclaw-core/src/capability-descriptors.mjs
services/openclaw-core/src/capability-runtime.mjs
services/openclaw-core/src/capability-runtime-engineering-read-search.mjs
services/openclaw-core/src/capability-runtime-engineering-verification.mjs
services/openclaw-core/src/capability-runtime-engineering-recovery.mjs
services/openclaw-core/src/capability-runtime-engineering-microcompact.mjs
services/openclaw-core/src/capability-runtime-engineering-execution-evidence.mjs
services/openclaw-core/src/capability-runtime-work-view.mjs
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
services/openclaw-core/test/capability-runtime.test.mjs
openclaw-native-engineering-tool-surface-inventory
observer-openclaw-native-engineering-tool-surface-inventory
capability-invoke
observer-capability-invoke
openclaw-native-engineering-verification-evidence
observer-openclaw-native-engineering-verification-evidence
openclaw-native-engineering-edit-closed-loop
openclaw-native-engineering-write-execution-evidence
observer-openclaw-native-engineering-write-execution-evidence
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
microcompact evidence, bounded in-memory projection, local governed engineering
context packets, the explicitly approved DeepSeek context-packet handoff, and
the bounded `engineering_recommendation_v0` response contract are absorbed;
automatic provider-request creation, automatic task/approval/execution from a
recommendation, persisted transcript rewriting, and result-envelope creation
remain deferred
unapproved provider calls and network egress
```

## Next Slice

The common execution-evidence closure is now implemented as:

```text
OPENCLAW_NATIVE_ENGINEERING_CAPABILITY_RUNTIME_EXECUTION_EVIDENCE_PLAN.md
```

The shared capability runtime exposes read-only edit/write completion evidence
after the existing approval-gated mutation paths have produced task and
filesystem-ledger records. The existing edit closed-loop and write execution
milestones prove the common invocation against real completed tasks; no new
evidence route or readiness milestone was added.

The bounded read/search capability-runtime follow-up was completed as:

```text
OPENCLAW_NATIVE_ENGINEERING_CAPABILITY_RUNTIME_READ_SEARCH_PLAN.md
```

The existing native builders are now available through the common capability
registry and `/capabilities/invoke` path, with the same bounded workspace,
output, and binary policies plus compact invocation/event evidence. This does
not add a task or approval path.

The existing `cc_verify` verification-evidence builder is now available through
the same registry and invoke path as
`sense.openclaw.engineering_tool.verify_evidence`. It reads only existing
governed command transcripts and completed task outcomes, keeps output previews
bounded, and records compact invocation/event evidence without executing a
command or creating a task or approval. The focused bridge is documented in:

```text
OPENCLAW_NATIVE_ENGINEERING_CAPABILITY_RUNTIME_VERIFICATION_EVIDENCE_PLAN.md
```

The corresponding failed-verification recovery readback is now available as
`sense.openclaw.engineering_tool.recovery_evidence`. It reuses the existing
verification and recovery builders, exposes only the bounded recovery response,
and keeps common invocation/event evidence to compact failure counts and
governance flags. It cannot create recovery tasks or approvals, execute or retry
commands, mutate workspaces, or call providers. The direct route and common
runtime proof are documented in:

```text
OPENCLAW_NATIVE_ENGINEERING_RECOVERY_EVIDENCE_PLAN.md
```

The context-management builders are now also available through the common
capability registry as `sense.openclaw.engineering_context.microcompact_evidence`
and `act.openclaw.engineering_context.microcompact_projection`. The first reads
bounded transcript savings; the second transforms only a caller-owned message
copy. Both preserve protected evidence and summary-only invocation/audit
metadata without task, approval, command, provider, or persisted-log mutation.
The existing Core/Observer microcompact checks prove both dispatches.

The operator execution-consistency follow-up was completed as:

```text
OPENCLAW_NATIVE_ENGINEERING_OPERATOR_EXECUTION_BINDING_PLAN.md
```

It keeps the existing `/operator/step` and `/operator/run` routes but binds
each rule-v1 browser task to its target, action count/order/kind, and
non-input parameters. `keyboard.type` and `browser.semantic_type` may receive
only a bounded transient text value at execution; that value is excluded from
the hash and persisted evidence. An absent or stale binding fails closed before
work-view preparation or screen-act. Together with the read/search bridge, this
closes the selected Level 1 consistency gaps; do not add another browser action
variant or provider wrapper. Continue with the smallest concrete capability at
the next identity level when its authority boundary is explicit.

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

The plan/todo capability-runtime follow-up is complete. The common registry now
exposes `sense.openclaw.engineering_context.plan_todo_evidence` and
`act.openclaw.engineering_context.plan_todo_workbench_state`; the first is
read-only evidence, and the second requires explicit `confirm: true` before
revisioned core-state storage. The existing core milestone covers readback,
confirmation blocking, revision increment, task-status preservation, and no-leak
invocation summaries. Do not add another plan/todo endpoint or readiness shell.

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

The previously recorded LSP variant next-step is complete and must not be
selected again. The bounded response summary follow-up was completed as:

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

The explicit Observer target-selection follow-up was completed as:

```text
OPENCLAW_NATIVE_ENGINEERING_LSP_EXPLICIT_TARGET_SELECTION_PLAN.md
```

The existing response summary can expose up to eight bounded targets and the
core bridges already accept `targetIndex`. Observer now lets the operator choose
one of those targets before the existing read or edit-seed controls run, while
keeping the selection page-local and read-only. Do not add automatic target
follow-up, task creation, or selection persistence without a demonstrated
operator gap.

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
builds and validates a new fixed native registry generation, atomically swaps it
into the shared plan owner, retains the previous generation, persists compact
generation metadata for core restart, and keeps arbitrary plugin module import,
plugin code execution, runtime activation, cache mutation, provider egress, and
root work disabled.

The existing explicitly approved provider handoff task is also available as
`act.openclaw.engineering_context.provider_handoff_task`. It validates the
fixed DeepSeek request shape, delegates to the existing approval-bound egress
owner, and retains only compact request/context binding metadata. This is a
task-creation bridge, not a provider call: credential reads, endpoint contact,
network egress, automatic approval, and operator execution remain deferred.
Observer exposes the bounded request as a pending-task control and never
echoes the request text in its readback.

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

The following Level 2 transition records are historical completion evidence, not
the current next step. The session-manager lease is enforced through existing
browser action mediation, operator takeover suspends it, and explicit resume
rotates and rebinds it. The bounded sidecar lifecycle, user-session recovery,
browser navigation, semantic type, and real Firefox evidence are also complete.

The bounded Level 2 browser eye-hand exit gate is closed. The kernel-whitepaper
Phase A Nix store packaging and the fixed Phase B native D-Bus systemd inventory
and restart slices are closed as well. The active route returns to a concrete
Level 1 local capability; helper process execution, desktop-wide capture, hostd,
unapproved provider egress, and ACPX/Codex live process execution remain
deferred.

## Current Route Correction

Updated: 2026-07-15

The historical LSP next-step text above is evidence history, not an instruction
to reopen completed variants. The current native engineering frontier includes
the complete LSP selected-target edit, verification, recovery, and rerun loop;
the fixed native plugin registry generation lifecycle; ACPX/Codex compatibility
and process-spawn preflight; and the local Engineering Context Packet.

The remaining ACPX live process/auth boundary and any provider/model boundary
outside the explicit DeepSeek handoff require explicit operator authorization.
The context-packet handoff consumes the local packet only for the current
approved operator call and returns only a review-required recommendation;
preserve that boundary and select only concrete local capabilities that close a
user-visible gap.

The approved handoff can now explicitly carry the bounded trusted work-view
observation and plan/todo summaries through the same materialized request. This
is documented in
`OPENCLAW_NATIVE_ENGINEERING_CONTEXT_PROVIDER_HANDOFF_BRIDGE_PLAN.md`; the
selectors are hash-bound with the provider message and do not transfer page
payloads or enable automatic actions.

The same handoff now supports an explicit `sourceTaskId` so provider context
can come from an existing engineering evidence task while approval remains on
the egress task. Missing or mutated source context fails the existing binding;
the explicit source-task identity is included in that binding as well. Automatic
source selection and source-task mutation remain deferred.

The existing Observer readback bridge for a valid recommendation is now
complete. `/operator/step` and `/operator/run` return the bounded transient
recommendation, Observer revalidates its contract and allowlisted control id,
and the explicit use action calls only the existing governed control. Route
fixtures prove the reason remains absent from compact evidence. This does not
create tasks, approvals, execution, or provider egress automatically.

The current installed generation also closes the adjacent system boundary
evidence without changing this Level 1 surface: Phase C process-exec capture
returns bounded CO-RE executable identity, and the fixed hostd restart path
verifies the kernel socket peer before native D-Bus mutation. Body-config and
real core/Observer checks pass for both boundaries; neither is a reason to
reopen the engineering evidence chain.

The first demonstrated Level 2 work-view gap is now closed through the
existing Engineering Context Packet action. With explicit `includeWorkView`,
core reads the session-manager owner and returns
`openclaw-native-engineering-work-view-association-v0`, which classifies the
selected engineering task as unbound, stale, authority-blocked, or bound. The
association is compact and excludes lease ids, active URLs, capture payloads,
automatic binding, and action dispatch; Observer renders the work-view id,
binding status, and authority state beside the packet.

The resulting unbound-task workflow is now closed by the explicit
operator-reviewed bind route documented in
`OPENCLAW_NATIVE_ENGINEERING_WORK_VIEW_BIND_PLAN.md`. It re-reads
authoritative session-manager state, preserves task status, rejects stale
identity, and remains separate from action execution. Do not infer another
browser action variant or create another Level 1 readiness/evidence-only shell
from historical plan text; preserve the existing provider, root, desktop-wide
capture, and arbitrary endpoint execution boundaries.

The existing context packet now also has an explicit observation bridge,
documented in `OPENCLAW_NATIVE_ENGINEERING_WORK_VIEW_OBSERVATION_BRIDGE_PLAN.md`.
When requested, it carries only capture freshness, frame digest/dimensions, and
semantic-target counts from the session-manager sidecar. It does not transfer
pixels, page URLs, page text, target items, input values, or selectors. Use this
metadata to close a demonstrated operator decision before adding another
Level 2 action.

The packet also explicitly reuses the existing plan/todo workbench evidence
through `OPENCLAW_NATIVE_ENGINEERING_CONTEXT_PLAN_TODO_BRIDGE_PLAN.md`. The
protected context includes only bounded plan/workbench state and the existing
guidance-only next action; it does not create or execute a plan transition.

The explicit provider/source-task handoff now has a matching local operator
surface. Observer can select a separate existing source task for the local
Engineering Context Packet, show the effective source in readback, and send
the execution and source ids independently. Core rejects an unknown explicit
source before reading evidence and applies the source id consistently across
transcript, verification, recovery, work-view, and plan/todo builders. This
does not change the provider approval owner or add automatic source inference.

The bound-task context workflow now also exposes the concrete trusted-session
recovery recommendation in the existing Observer packet panel. When the
authoritative readback recommends `prepare_work_view`, the operator can invoke
the existing allowlisted prepare action from that panel and receive a refreshed
association. No new endpoint, bind variant, automatic recovery, action replay,
provider call, or arbitrary endpoint execution was added.
