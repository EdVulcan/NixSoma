# OpenClaw Documentation Control Room

Updated: 2026-07-10

This is the active documentation entry point for `OpenClawOnNixOS`.

The project has many historical phase plans. Do not use the largest phase number
as the next task. Start from the active route below.

## Start Here

Read in this order:

1. [Forward Work Directive](./OPENCLAW_FORWARD_WORK_DIRECTIVE.md)
2. [Enhanced Source Migration Brief](./plans/OPENCLAW_ENHANCED_SOURCE_MIGRATION_BRIEF.md)
3. [System Identity Upgrade Path](./architecture/OPENCLAW_SYSTEM_IDENTITY_UPGRADE_PATH.md)
4. [Kernel-Level Evolution Whitepaper](./architecture/KERNEL_LEVEL_EVOLUTION_WHITEPAPER.md)
5. [Plans Directory Guide](./plans/README.md)

## Current Project Correction

The project is not fundamentally off-course, but the recent provider/credential
phase ladder has become too fine-grained. The active route is now:

```text
preserve enhanced openclaw source on GitHub
-> audit which enhanced capabilities are already absorbed
-> migrate Claude Code-grade engineering capabilities as governed body tools
-> return to identity-upgrade work: work-view/session helper, then hostd
```

Do not continue with Phase 137-style provider wrappers unless the next slice
creates a real capability and explicitly passes the progress test in the forward
directive.

## Active Architecture

| Document | Role |
| --- | --- |
| [OPENCLAW_SYSTEM_IDENTITY_UPGRADE_PATH.md](./architecture/OPENCLAW_SYSTEM_IDENTITY_UPGRADE_PATH.md) | Governs how OpenClaw evolves from user-space control plane to trusted session component, system daemon, and graphics-stack-native body. |
| [KERNEL_LEVEL_EVOLUTION_WHITEPAPER.md](./architecture/KERNEL_LEVEL_EVOLUTION_WHITEPAPER.md) | Long-horizon architecture for NixOS, eBPF, declarative mutation, and kernel-level body nerves. |
| [AI_WORK_VIEW_CAPTURE_STRATEGY.md](./architecture/AI_WORK_VIEW_CAPTURE_STRATEGY.md) | Work-view capture strategy for AI-owned graphical work. |
| [DESKTOP_CAPTURE_CONTRACT_V1.md](./architecture/DESKTOP_CAPTURE_CONTRACT_V1.md) | Screen-sense capture contract. |
| [DECOUPLING_REPORT.md](./architecture/DECOUPLING_REPORT.md) | Historical and still useful service decoupling report. |
| [coupling_analysis.md](./architecture/coupling_analysis.md) | Coupling audit after the large service split. |

## Active Plans

| Document | Role |
| --- | --- |
| [OPENCLAW_ENHANCED_SOURCE_MIGRATION_BRIEF.md](./plans/OPENCLAW_ENHANCED_SOURCE_MIGRATION_BRIEF.md) | Records the optimized Windows-host `openclaw` source inventory, preservation strategy, and integration rules. |
| [OPENCLAW_ENHANCED_SOURCE_GAP_AUDIT.md](./plans/OPENCLAW_ENHANCED_SOURCE_GAP_AUDIT.md) | Audits which preserved enhanced-source capabilities are absorbed, partially absorbed, not absorbed, should not migrate, or require source transfer. |
| [OPENCLAW_NATIVE_ENGINEERING_TOOL_SURFACE_PLAN.md](./plans/OPENCLAW_NATIVE_ENGINEERING_TOOL_SURFACE_PLAN.md) | Active native engineering tool contract inventory route. |
| [OPENCLAW_NATIVE_ENGINEERING_READ_SEARCH_PLAN.md](./plans/OPENCLAW_NATIVE_ENGINEERING_READ_SEARCH_PLAN.md) | Active bounded workspace read/search route for `cc_read`, `cc_glob`, and `cc_grep`. |
| [OPENCLAW_NATIVE_ENGINEERING_EDIT_PROPOSAL_PLAN.md](./plans/OPENCLAW_NATIVE_ENGINEERING_EDIT_PROPOSAL_PLAN.md) | Active surgical edit proposal and bounded diff-preview route for `cc_edit`. |
| [OPENCLAW_NATIVE_ENGINEERING_EDIT_APPROVAL_BRIDGE_PLAN.md](./plans/OPENCLAW_NATIVE_ENGINEERING_EDIT_APPROVAL_BRIDGE_PLAN.md) | Active bridge from `cc_edit` proposal evidence to approval-gated workspace patch tasks. |
| [OPENCLAW_NATIVE_ENGINEERING_EDIT_CLOSED_LOOP_PLAN.md](./plans/OPENCLAW_NATIVE_ENGINEERING_EDIT_CLOSED_LOOP_PLAN.md) | Active closed-loop proof for bounded read/search, edit proposal, approval, patch apply, ledger, Observer, verification, and recovery. |
| [OPENCLAW_NATIVE_ENGINEERING_LOOP_OPERATOR_CONTROLS_PLAN.md](./plans/OPENCLAW_NATIVE_ENGINEERING_LOOP_OPERATOR_CONTROLS_PLAN.md) | Active Observer controls for creating governed engineering edit/write/verification approval tasks. |
| [OPENCLAW_NATIVE_ENGINEERING_LOOP_PARAMETERIZED_INPUTS_PLAN.md](./plans/OPENCLAW_NATIVE_ENGINEERING_LOOP_PARAMETERIZED_INPUTS_PLAN.md) | Active bounded Observer inputs for governed engineering edit/write/verification task controls. |
| [OPENCLAW_NATIVE_ENGINEERING_LOOP_STATE_GUIDANCE_PLAN.md](./plans/OPENCLAW_NATIVE_ENGINEERING_LOOP_STATE_GUIDANCE_PLAN.md) | Active Observer state guidance for created engineering loop tasks, approvals, next action, and evidence routes. |
| [OPENCLAW_NATIVE_ENGINEERING_LOOP_COMPLETION_READBACK_PLAN.md](./plans/OPENCLAW_NATIVE_ENGINEERING_LOOP_COMPLETION_READBACK_PLAN.md) | Active Observer readback for completed engineering loop task evidence after manual approval and operator execution. |
| [OPENCLAW_NATIVE_ENGINEERING_LOOP_RECOVERY_ACTION_DRAFT_PLAN.md](./plans/OPENCLAW_NATIVE_ENGINEERING_LOOP_RECOVERY_ACTION_DRAFT_PLAN.md) | Active Observer recovery action draft and explicit recovery task creation for failed engineering verification outcomes. |
| [OPENCLAW_NATIVE_ENGINEERING_LOOP_RECOVERY_RERUN_READBACK_PLAN.md](./plans/OPENCLAW_NATIVE_ENGINEERING_LOOP_RECOVERY_RERUN_READBACK_PLAN.md) | Active recovered verification rerun readback through the existing approval/operator path. |
| [OPENCLAW_NATIVE_ENGINEERING_PROMPT_WORK_STANDARDS_PLAN.md](./plans/OPENCLAW_NATIVE_ENGINEERING_PROMPT_WORK_STANDARDS_PLAN.md) | Active Observer-verifiable work standards assessment derived from native prompt semantics without copying prompt walls or creating tasks. |
| [OPENCLAW_NATIVE_ENGINEERING_LOOP_WORK_STANDARDS_BRIDGE_PLAN.md](./plans/OPENCLAW_NATIVE_ENGINEERING_LOOP_WORK_STANDARDS_BRIDGE_PLAN.md) | Active bridge from prompt-derived work standards into the existing Observer Engineering Loop State panel. |
| [OPENCLAW_NATIVE_ENGINEERING_WRITE_PROPOSAL_PLAN.md](./plans/OPENCLAW_NATIVE_ENGINEERING_WRITE_PROPOSAL_PLAN.md) | Active redacted create/overwrite proposal evidence route for `cc_write` without file mutation. |
| [OPENCLAW_NATIVE_ENGINEERING_WRITE_APPROVAL_BRIDGE_PLAN.md](./plans/OPENCLAW_NATIVE_ENGINEERING_WRITE_APPROVAL_BRIDGE_PLAN.md) | Active bridge from redacted `cc_write` proposal evidence to approval-gated workspace text write tasks. |
| [OPENCLAW_NATIVE_ENGINEERING_WRITE_EXECUTION_EVIDENCE_PLAN.md](./plans/OPENCLAW_NATIVE_ENGINEERING_WRITE_EXECUTION_EVIDENCE_PLAN.md) | Active read-only execution evidence route for approved `cc_write`-derived workspace text writes. |
| [OPENCLAW_NATIVE_ENGINEERING_WRITE_CLOSED_LOOP_PLAN.md](./plans/OPENCLAW_NATIVE_ENGINEERING_WRITE_CLOSED_LOOP_PLAN.md) | Active closed-loop proof for bounded read/search, write proposal, approval, write execution, ledger, Observer, verification, and recovery. |
| [OPENCLAW_NATIVE_ENGINEERING_VERIFICATION_EVIDENCE_PLAN.md](./plans/OPENCLAW_NATIVE_ENGINEERING_VERIFICATION_EVIDENCE_PLAN.md) | Active verification evidence route for `cc_verify` over governed command transcripts. |
| [OPENCLAW_NATIVE_ENGINEERING_VERIFICATION_WORK_STANDARDS_COVERAGE_PLAN.md](./plans/OPENCLAW_NATIVE_ENGINEERING_VERIFICATION_WORK_STANDARDS_COVERAGE_PLAN.md) | Active work-standards coverage attached to existing verification evidence without adding a new execution path. |
| [OPENCLAW_NATIVE_ENGINEERING_RECOVERY_EVIDENCE_PLAN.md](./plans/OPENCLAW_NATIVE_ENGINEERING_RECOVERY_EVIDENCE_PLAN.md) | Active Observer recovery evidence route for failed native engineering verification/source-command outcomes. |
| [OPENCLAW_NATIVE_ENGINEERING_RECOVERY_WORK_STANDARDS_COVERAGE_PLAN.md](./plans/OPENCLAW_NATIVE_ENGINEERING_RECOVERY_WORK_STANDARDS_COVERAGE_PLAN.md) | Active work-standards coverage attached to existing recovery evidence without adding a recovery executor. |
| [OPENCLAW_NATIVE_ENGINEERING_MICROCOMPACT_EVIDENCE_PLAN.md](./plans/OPENCLAW_NATIVE_ENGINEERING_MICROCOMPACT_EVIDENCE_PLAN.md) | Active context-management evidence route for `microcompact` without hidden transcript mutation. |
| [OPENCLAW_NATIVE_PLUGIN_RUNTIME_REFRESH_EVIDENCE_PLAN.md](./plans/OPENCLAW_NATIVE_PLUGIN_RUNTIME_REFRESH_EVIDENCE_PLAN.md) | Active native plugin runtime refresh evidence route without module loading or activation. |
| [OPENCLAW_NATIVE_PLUGIN_RUNTIME_REFRESH_TASK_PLAN.md](./plans/OPENCLAW_NATIVE_PLUGIN_RUNTIME_REFRESH_TASK_PLAN.md) | Active approval-gated native plugin runtime refresh task that recomputes read-model evidence after approval without module import, code execution, runtime activation, or cache mutation. |
| [OPENCLAW_NATIVE_ACPX_CODEX_BRIDGE_COMPATIBILITY_PLAN.md](./plans/OPENCLAW_NATIVE_ACPX_CODEX_BRIDGE_COMPATIBILITY_PLAN.md) | Active ACPX/Codex bridge compatibility, session metadata persistence, Observer visibility, wrapper/action proposal draft, approval-gated task bridge, wrapper write proposal/preview, approved wrapper write bridge, wrapper write execution readback/recovery recommendation, process-spawn proposal contract, approval-gated process-spawn preflight task, and live execution boundary review without reading credentials, copying auth material, spawning ACP processes, or using provider egress. |
| [OPENCLAW_NATIVE_ENGINEERING_PLAN_TODO_EVIDENCE_PLAN.md](./plans/OPENCLAW_NATIVE_ENGINEERING_PLAN_TODO_EVIDENCE_PLAN.md) | Active planning/todo evidence route for `cc_plan_enter`, `cc_plan_exit`, and `cc_todo_write` without hidden mode or todo-file mutation. |
| [OPENCLAW_NATIVE_ENGINEERING_PLAN_TODO_WORKBENCH_STORAGE_PLAN.md](./plans/OPENCLAW_NATIVE_ENGINEERING_PLAN_TODO_WORKBENCH_STORAGE_PLAN.md) | Active governed core-state workbench storage plus compact task/readback provenance for local whitelisted suggested actions, without hidden mode, todo-file writes, arbitrary endpoints, automatic approval/execution, or providers. |
| [OPENCLAW_NATIVE_ENGINEERING_LSP_EVIDENCE_PLAN.md](./plans/OPENCLAW_NATIVE_ENGINEERING_LSP_EVIDENCE_PLAN.md) | Active LSP availability and lifecycle evidence lane for `cc_lsp`, including governed process probe readback while operational LSP requests remain deferred. |
| [OPENCLAW_NATIVE_ENGINEERING_LSP_LIFECYCLE_READINESS_DRAFT_PLAN.md](./plans/OPENCLAW_NATIVE_ENGINEERING_LSP_LIFECYCLE_READINESS_DRAFT_PLAN.md) | Active draft of a governed workspace-scoped LSP lifecycle action; later slices added approval-gated task execution, bounded process probe, state readback, and initialize/shutdown handshake while source transfer remains deferred. |
| [OPENCLAW_NATIVE_ENGINEERING_LSP_SUPERVISED_LIFECYCLE_PILOT_PLAN.md](./plans/OPENCLAW_NATIVE_ENGINEERING_LSP_SUPERVISED_LIFECYCLE_PILOT_PLAN.md) | Active approval-gated LSP lifecycle task, binary gate, supervised user-space process probe, and state readback with audit events and Observer controls while long-lived process pools and operational LSP requests remain deferred. |
| [OPENCLAW_NATIVE_ENGINEERING_LSP_LIFECYCLE_STATE_PLAN.md](./plans/OPENCLAW_NATIVE_ENGINEERING_LSP_LIFECYCLE_STATE_PLAN.md) | Active read-only LSP lifecycle state store for approved start/restart probes, explicit stop readback, recovery states, handshake status, and Observer visibility while source transfer remains deferred. |
| [OPENCLAW_NATIVE_ENGINEERING_LSP_HANDSHAKE_PLAN.md](./plans/OPENCLAW_NATIVE_ENGINEERING_LSP_HANDSHAKE_PLAN.md) | Active approval-gated LSP initialize/shutdown handshake evidence while source transfer, didOpen, symbol requests, and long-lived process pools remain deferred. |
| [OPENCLAW_NATIVE_ENGINEERING_LSP_SOURCE_TRANSFER_PROPOSAL_PLAN.md](./plans/OPENCLAW_NATIVE_ENGINEERING_LSP_SOURCE_TRANSFER_PROPOSAL_PLAN.md) | Active read-only `didOpen` source-transfer proposal with bounded workspace source preview/hash and Observer visibility while actual `didOpen`, symbol requests, and long-lived pools remain deferred. |
| [OPENCLAW_NATIVE_ENGINEERING_LSP_SOURCE_TRANSFER_TASK_PLAN.md](./plans/OPENCLAW_NATIVE_ENGINEERING_LSP_SOURCE_TRANSFER_TASK_PLAN.md) | Active approval-gated `didOpen` source-transfer task with hash re-check, short-lived process execution, lifecycle state, and Observer task controls while symbol requests and long-lived pools remain deferred. |
| [OPENCLAW_NATIVE_ENGINEERING_LSP_SYMBOL_REQUEST_PROPOSAL_PLAN.md](./plans/OPENCLAW_NATIVE_ENGINEERING_LSP_SYMBOL_REQUEST_PROPOSAL_PLAN.md) | Active read-only definition/references/hover request proposal over approved didOpen state while operational symbol request execution and long-lived pools remain deferred. |
| [OPENCLAW_NATIVE_ENGINEERING_LSP_SYMBOL_REQUEST_TASK_PLAN.md](./plans/OPENCLAW_NATIVE_ENGINEERING_LSP_SYMBOL_REQUEST_TASK_PLAN.md) | Active approval-gated definition/references/hover task that sends exactly one symbol request through a bounded short-lived LSP process while long-lived pools remain deferred. |
| [OPENCLAW_NATIVE_ENGINEERING_LSP_OBSERVER_SYMBOL_REQUEST_CONTROL_PLAN.md](./plans/OPENCLAW_NATIVE_ENGINEERING_LSP_OBSERVER_SYMBOL_REQUEST_CONTROL_PLAN.md) | Active Observer control and readback for creating the existing approval-gated LSP symbol request task from the LSP panel without adding another evidence shell. |
| [OPENCLAW_NATIVE_ENGINEERING_LSP_SYMBOL_RESPONSE_SUMMARY_PLAN.md](./plans/OPENCLAW_NATIVE_ENGINEERING_LSP_SYMBOL_RESPONSE_SUMMARY_PLAN.md) | Active bounded response summary for approved single LSP symbol requests without exposing raw response payloads or source bodies. |
| [OPENCLAW_NATIVE_ENGINEERING_LSP_VARIANT_REQUESTS_PLAN.md](./plans/OPENCLAW_NATIVE_ENGINEERING_LSP_VARIANT_REQUESTS_PLAN.md) | Active governed references/hover variants through the same approval-gated single LSP symbol request path. |
| [OPENCLAW_NATIVE_ENGINEERING_LSP_RESPONSE_TARGET_SELECTION_PLAN.md](./plans/OPENCLAW_NATIVE_ENGINEERING_LSP_RESPONSE_TARGET_SELECTION_PLAN.md) | Active bounded URI/range target selection from approved LSP symbol responses without raw payload exposure. |
| [OPENCLAW_NATIVE_ENGINEERING_LSP_SELECTED_TARGET_READ_BRIDGE_PLAN.md](./plans/OPENCLAW_NATIVE_ENGINEERING_LSP_SELECTED_TARGET_READ_BRIDGE_PLAN.md) | Active bridge from completed LSP selected target metadata to explicit bounded native read/search previews. |
| [OPENCLAW_NATIVE_ENGINEERING_LSP_OBSERVER_SELECTED_TARGET_READ_CONTROL_PLAN.md](./plans/OPENCLAW_NATIVE_ENGINEERING_LSP_OBSERVER_SELECTED_TARGET_READ_CONTROL_PLAN.md) | Active Observer control for explicitly reading completed LSP selected targets through the bounded bridge. |
| [OPENCLAW_NATIVE_ENGINEERING_LSP_SELECTED_TARGET_EDIT_PROPOSAL_SEED_PLAN.md](./plans/OPENCLAW_NATIVE_ENGINEERING_LSP_SELECTED_TARGET_EDIT_PROPOSAL_SEED_PLAN.md) | Active seed path from completed LSP selected target reads into governed edit proposal drafts. |
| [OPENCLAW_NATIVE_ENGINEERING_LSP_OBSERVER_SELECTED_TARGET_EDIT_SEED_CONTROL_PLAN.md](./plans/OPENCLAW_NATIVE_ENGINEERING_LSP_OBSERVER_SELECTED_TARGET_EDIT_SEED_CONTROL_PLAN.md) | Active Observer control for seeding existing edit proposal inputs from completed LSP selected targets. |
| [OPENCLAW_NATIVE_ENGINEERING_LSP_SELECTED_TARGET_EDIT_CLOSED_LOOP_PLAN.md](./plans/OPENCLAW_NATIVE_ENGINEERING_LSP_SELECTED_TARGET_EDIT_CLOSED_LOOP_PLAN.md) | Active closed-loop proof from completed LSP selected target to approval-gated patch apply, filesystem ledger, edit evidence, and bounded readback. |
| [OPENCLAW_NATIVE_ENGINEERING_LSP_SELECTED_TARGET_VERIFICATION_HANDOFF_PLAN.md](./plans/OPENCLAW_NATIVE_ENGINEERING_LSP_SELECTED_TARGET_VERIFICATION_HANDOFF_PLAN.md) | Active handoff from selected-target edit completion to approval-gated verification command execution and verification evidence readback. |
| [OPENCLAW_NATIVE_ENGINEERING_LSP_SELECTED_TARGET_RECOVERY_RECOMMENDATION_HANDOFF_PLAN.md](./plans/OPENCLAW_NATIVE_ENGINEERING_LSP_SELECTED_TARGET_RECOVERY_RECOMMENDATION_HANDOFF_PLAN.md) | Active handoff from failed selected-target verification to recovery evidence, explicit recovery task creation, and pre-approval rerun blocking. |
| [OPENCLAW_NATIVE_ENGINEERING_LSP_SELECTED_TARGET_RECOVERED_VERIFICATION_RERUN_PLAN.md](./plans/OPENCLAW_NATIVE_ENGINEERING_LSP_SELECTED_TARGET_RECOVERED_VERIFICATION_RERUN_PLAN.md) | Active recovered selected-target verification rerun proof through approval, operator step, verification evidence, and recovery readback. |
| [OPENCLAW_NATIVE_ENGINEERING_PLANNING_WORKBENCH_STATE_BRIDGE_PLAN.md](./plans/OPENCLAW_NATIVE_ENGINEERING_PLANNING_WORKBENCH_STATE_BRIDGE_PLAN.md) | Active bridge from plan/todo evidence into operator-visible Engineering Loop State. |
| [OPENCLAW_NATIVE_ENGINEERING_WORKBENCH_STATE_RESTORATION_PLAN.md](./plans/OPENCLAW_NATIVE_ENGINEERING_WORKBENCH_STATE_RESTORATION_PLAN.md) | Active read-only restoration of Engineering Loop State from core task history after Observer reload. |
| [OPENCLAW_NATIVE_ENGINEERING_WORKBENCH_STATE_AUTO_RESTORE_PLAN.md](./plans/OPENCLAW_NATIVE_ENGINEERING_WORKBENCH_STATE_AUTO_RESTORE_PLAN.md) | Active startup auto-restore of Engineering Loop State when browser-local state is empty. |
| [OPENCLAW_TRUSTED_WORK_VIEW_SESSION_CONTRACT_PLAN.md](./plans/OPENCLAW_TRUSTED_WORK_VIEW_SESSION_CONTRACT_PLAN.md) | Active Level 2 bridge with systemd user sidecar ownership, bounded workspace continuity, a real NixOS Firefox engine, and the next login-user component ownership slice. |
| [OPENCLAW_MONOLITH_REDUCTION_PLAN.md](./plans/OPENCLAW_MONOLITH_REDUCTION_PLAN.md) | Tracks current coupling reduction and milestone-batch improvements. |
| [OPENCLAW_EXPERT_REVIEW_OPTIMIZATION_PLAN.md](./plans/OPENCLAW_EXPERT_REVIEW_OPTIMIZATION_PLAN.md) | Tracks expert-review fixes around test lifecycle, shared packages, helpers, batching, and profiling. |
| [OPENCLAW_SOURCE_INTEGRATION_STAGE_PLAN.md](./plans/OPENCLAW_SOURCE_INTEGRATION_STAGE_PLAN.md) | Historical source-integration stage log; use with the enhanced migration brief, not as the sole roadmap. |
| [OPENCLAW_POST_MVP_PLAN.md](./plans/OPENCLAW_POST_MVP_PLAN.md) | Historical post-MVP route selection that remains useful for memory/consciousness context. |

## Historical Phase Plans

`docs/plans/OPENCLAW_PHASE_*_PLAN.md` files are retained because many milestone
scripts still read them as evidence fixtures. They are not active next-work
instructions.

Do not delete, rename, or move them until the milestone scripts that reference
them are refactored.

## Guides And Evidence

| Document | Role |
| --- | --- |
| [OPENCLAW_MVP_DEMO_GUIDE.md](./guides/OPENCLAW_MVP_DEMO_GUIDE.md) | Historical MVP demo guide; still referenced by milestone checks. |
| [OPENCLAW_MVP_STATUS.md](./guides/OPENCLAW_MVP_STATUS.md) | Historical MVP status; still referenced by milestone checks. |
| [OPENCLAW_MVP_FINAL_READINESS.md](./guides/OPENCLAW_MVP_FINAL_READINESS.md) | Historical MVP final readiness; still referenced by milestone checks. |
| [fix_log.md](./guides/fix_log.md) | Historical diagnosis and repair log. |
| [HANDOVER_SUMMARY.md](./HANDOVER_SUMMARY.md) | Historical handoff for the decoupling/restructure era. |

## Documentation Cleanup Policy

- Active guidance must be linked from this file.
- Historical evidence may remain in place when milestone checks reference it.
- Do not create a new numbered phase just to continue a pattern.
- Prefer updating an active route document when correcting direction.
- If a document becomes obsolete but is referenced by tests, mark it historical
  in the index rather than moving it.
