# OpenClaw Enhanced Source Gap Audit

Updated: 2026-07-09

This audit compares the current `OpenClaw_On_NixOS` main branch with the
preserved enhanced `openclaw` source reference:

```text
repository: https://github.com/EdVulcan/openclaw-enhanced-source
branch: main
commit: d90b253b0c03191613e45c36b1434078b8788bed
commit title: Preserve enhanced OpenClaw source prototype
```

The enhanced source is a migration reference, not a dependency to vendor into
`OpenClaw_On_NixOS`. The goal is to migrate useful engineering capability into
OpenClaw's policy, approval, audit, recovery, and Observer surfaces.

Do not continue a mechanical Phase 137 cloud/provider/credential wrapper from
this point. Use this audit to select real capability slices.

## Method

Current main branch evidence:

- Main branch contains `76b3151 Record preserved enhanced source reference`.
- Active route is
  [`../OPENCLAW_FORWARD_WORK_DIRECTIVE.md`](../OPENCLAW_FORWARD_WORK_DIRECTIVE.md).
- Historical source-integration evidence is in
  [`OPENCLAW_SOURCE_INTEGRATION_STAGE_PLAN.md`](./OPENCLAW_SOURCE_INTEGRATION_STAGE_PLAN.md).
- Existing implementation evidence was inspected under
  `services/openclaw-core/src/`, `packages/plugin-runtime/src/`,
  `apps/observer-ui/src/`, and `nix/scripts/`.

Enhanced source evidence:

- `extensions/cc-tools/src/index.ts`
- `extensions/cc-tools/src/tools/FileReadTool.ts`
- `extensions/cc-tools/src/tools/FileEditTool.ts`
- `extensions/cc-tools/src/tools/FileWriteTool.ts`
- `extensions/cc-tools/src/tools/GlobTool.ts`
- `extensions/cc-tools/src/tools/GrepTool.ts`
- `extensions/cc-tools/src/tools/PlanModeTool.ts`
- `extensions/cc-tools/src/tools/VerifyCodeTool.ts`
- `extensions/cc-tools/src/lsp/LSPTool.ts`
- `extensions/cc-tools/src/lsp/lsp-manager.ts`
- `extensions/cc-tools/src/cc-tools.test.ts`
- `src/agents/pi-embedded-runner/microcompact.ts`
- `src/plugins/runtime/runtime-registry-loader.ts`
- `src/auto-reply/reply/commands-plugins.ts`
- `extensions/acpx/src/codex-auth-bridge.ts`
- `extensions/acpx/src/runtime-persistence.test.ts`
- `src/agents/system-prompt.ts`
- `src/agents/pi-tools.ts`
- `ui/index.html`
- `ui/src/styles/`
- `HEARTBEAT.md`, `SOUL.md`, `TOOLS.md`

Exclusion:

- `.serena/cache/typescript/document_symbols.pkl` is historical cache material
  and is excluded from migration analysis.

## Current Absorbed Baseline

`OpenClaw_On_NixOS` has already absorbed many enhanced-source themes as native,
governed surfaces:

- Native plugin contract and registry:
  `packages/plugin-runtime/src/plugin-capability-descriptors.mjs` and
  `packages/plugin-runtime/src/plugin-registry.mjs`.
- Read-only enhanced-source catalog and metadata absorption:
  `sense.openclaw.tool_catalog`,
  `sense.openclaw.workspace_semantic_index`,
  `sense.openclaw.workspace_symbol_lookup`,
  `sense.openclaw.workspace_edit_target_select`,
  `sense.openclaw.engineering_tool_surface_inventory`,
  `sense.openclaw.engineering_tool.read`,
  `sense.openclaw.engineering_tool.glob`,
  `sense.openclaw.engineering_tool.grep`,
  `sense.openclaw.prompt_pack`,
  `sense.openclaw.plugin_manifest_map`, and
  `plan.openclaw.plugin_capability`.
- Native engineering proposal surface:
  `act.openclaw.engineering_tool.edit_proposal` creates exact-match surgical
  edit proposals and bounded diff previews without applying patches.
- Native engineering edit approval bridge:
  `openclaw-native-engineering-edit-proposal-task-v0` connects reviewed
  `cc_edit` proposal evidence to approval-gated `workspace_patch_apply` tasks
  without approving or executing the patch.
- Native engineering edit execution evidence and closed-loop proof:
  `sense.openclaw.engineering_tool.edit_execution_evidence` links approved
  `workspace_patch_apply` task completion and filesystem write ledger records
  back to `cc_edit` proposal metadata; the closed-loop milestone proves
  read/search, proposal, approval, patch apply, ledger, Observer,
  verification, and recovery together.
- Native engineering loop operator controls:
  Observer buttons create the existing approval-gated edit, write, and
  verification tasks from the engineering panels while preserving manual
  approval and operator-step gates; the controls now accept bounded
  operator-selected edit/write/verification inputs and display task, approval,
  next-step, evidence-route guidance, and completion evidence readback.
- Native engineering loop recovery action draft:
  Observer reads failed verification recovery evidence, drafts an explicit
  `/tasks/:taskId/recover` operator action, and can create a queued recovered
  task through the existing recovery route while preserving approval and
  operator-step gates before any command rerun.
- Native engineering recovery rerun readback:
  After the recovered task is manually approved and executed through the
  existing operator path, Observer reads verification evidence attached to the
  recovered task and keeps source recovery evidence linked to the original
  failed verification task.
- Native engineering write proposal surface:
  `act.openclaw.engineering_tool.write_proposal` maps `cc_write`
  create/overwrite intent into bounded workspace proposal evidence with redacted
  diff metadata, byte counts, content hashes, and no filesystem mutation.
- Native engineering write approval bridge:
  `openclaw-native-engineering-write-proposal-task-v0` connects reviewed
  `cc_write` proposal evidence to approval-gated `workspace_text_write` tasks
  without approving or executing the write.
- Native engineering write execution evidence:
  `sense.openclaw.engineering_tool.write_execution_evidence` links approved
  `workspace_text_write` task completion and filesystem write ledger records
  back to `cc_write` proposal metadata without exposing file content.
- Native engineering verification evidence:
  `sense.openclaw.engineering_tool.verify_evidence` converts governed command
  transcripts into bounded verification evidence attached to completed tasks.
- Native engineering recovery evidence:
  `sense.openclaw.engineering_tool.recovery_evidence` reads failed verification
  evidence and failed source-command task outcomes, classifies recoverability,
  and exposes operator recovery recommendations without creating tasks or
  rerunning commands.
- Native engineering microcompact evidence:
  `sense.openclaw.engineering_context.microcompact_evidence` estimates
  context-budget savings from historical command transcripts without returning
  raw output or mutating runtime messages or persisted logs.
- Native engineering plan/todo evidence:
  `sense.openclaw.engineering_context.plan_todo_evidence` maps
  `cc_plan_enter`, `cc_plan_exit`, and `cc_todo_write` into visible
  task/workbench planning evidence without hidden mode switches, task mutation,
  or `.openclaw/cc-todo.md` writes.
- Native engineering planning workbench state bridge:
  Observer maps selected engineering task plan/todo evidence into Engineering
  Loop State with visible todo counts and current-item hints while keeping
  hidden planning modes, todo-file writes, and task mutation blocked.
- Native engineering workbench state restoration:
  Observer can rebuild the latest Engineering Loop State from public core task
  history after reload by classifying edit, write, verification, recovery, and
  planning-workbench task records without creating tasks or executing commands.
- Native engineering LSP evidence:
  `sense.openclaw.engineering_tool.lsp_evidence` maps `cc_lsp` `check`,
  `definition`, `references`, and `hover` contracts into bounded workspace
  availability evidence without checking binaries, starting servers, opening
  files in LSP, reading source contents into LSP, or sending JSON-RPC.
- Approval-gated workspace mutation:
  `act.openclaw.workspace_text_write` and
  `act.openclaw.workspace_patch_apply`.
- Patch safety:
  exact replacement, multi-hunk replacement, structured line edits, bounded diff
  previews, proposal envelopes, source-derived rationale/check/risk bundles, and
  filesystem ledgering.
- Source-derived command chain:
  command proposal, command plan, approval-gated task materialization, approved
  execution, denial recovery, hardening, persistence, and focused regression.
- Native plugin/search-web chain:
  manifest mapping, candidate contracts, adapter shells, approval/recovery/
  persistence gates, and runtime activation/sandbox contracts.

These are absorbed in OpenClaw's governance model, not as direct copies of the
enhanced `openclaw` modules.

## Summary Matrix

| Enhanced capability | Classification | Current evidence | Migration call | Identity level |
| --- | --- | --- | --- | --- |
| `cc_read` | absorbed | `sense.openclaw.engineering_tool.read` provides bounded workspace file read with line ranges, content budget, traversal protection, binary/size boundaries, audit, and Observer evidence. | Continue using the native read/search surface; do not import enhanced `FileReadTool.ts`. | Level 1 |
| `cc_edit` | absorbed through governed proposal/approval/execution evidence and closed-loop proof | `act.openclaw.engineering_tool.edit_proposal` creates exact-match surgical edit proposals with bounded diff previews; `openclaw-native-engineering-edit-proposal-task-v0` bridges confirmed proposals to approval-gated `workspace_patch_apply` tasks; `sense.openclaw.engineering_tool.edit_execution_evidence` reads completed patch ledger evidence; `openclaw-native-engineering-edit-closed-loop` proves read/search -> proposal -> approval -> apply -> ledger -> verification/recovery -> Observer. | Keep proposal, approval, execution evidence, verification, and recovery separated. Do not migrate immediate raw edit execution or auto-approval. | Level 1 |
| `cc_write` | absorbed through governed proposal/approval/execution evidence | `act.openclaw.engineering_tool.write_proposal` creates redacted create/overwrite proposal evidence; `openclaw-native-engineering-write-proposal-task-v0` bridges confirmed proposals to approval-gated `workspace_text_write` tasks; `sense.openclaw.engineering_tool.write_execution_evidence` reads completed write ledger evidence. | Keep proposal, approval, execution, and recovery separated. Do not migrate raw overwrite semantics as an autonomous default. | Level 1 |
| `cc_glob` | absorbed | `sense.openclaw.engineering_tool.glob` performs bounded workspace file discovery with skipped hidden/generated/cache/dependency directories and result caps. | Continue native bounded discovery; do not execute enhanced `GlobTool.ts`. | Level 1 |
| `cc_grep` | absorbed | `sense.openclaw.engineering_tool.grep` performs bounded workspace text search with literal/regex mode, include filters, result/output caps, binary skips, audit, and Observer evidence. | Continue native bounded search; do not execute enhanced `GrepTool.ts`. | Level 1 |
| `cc_lsp` | partially absorbed as evidence | `sense.openclaw.engineering_tool.lsp_evidence` maps `check`, `definition`, `references`, and `hover` contracts, reports language/config metadata and server hints, and keeps binary checks, server startup, source-content reads, and JSON-RPC blocked. `sense.openclaw.workspace_symbol_lookup` remains separate derived navigation. | Keep the evidence route. Defer full LSP lifecycle to a governed workspace service with explicit server state and recovery evidence. | Level 1 now, Level 2 later |
| `cc_verify` | absorbed as evidence | `sense.openclaw.engineering_tool.verify_evidence` reads approval-gated command transcripts, capability invocations, and completed task outcomes to produce bounded verification evidence with checks, output budgets, retry-policy metadata, audit evidence, and Observer visibility. `sense.openclaw.engineering_tool.recovery_evidence` adds read-only failed-evidence recovery recommendations. | Keep actual command execution on the existing approval-gated source/workspace command task path. Do not add ungoverned shell execution or automatic retries. | Level 1 |
| `cc_plan_enter`, `cc_plan_exit`, `cc_todo_write` | absorbed as evidence plus operator-visible workbench state | `sense.openclaw.engineering_context.plan_todo_evidence` reads visible task/workbench plan state, maps planning/todo tool semantics, reports todo counts, and exposes Observer evidence without hidden mode switches, task mutation, or `.openclaw/cc-todo.md` writes. `openclaw-native-engineering-planning-workbench-state-v0` bridges that evidence into Engineering Loop State for selected engineering tasks. | Keep hidden mode, todo-file persistence, and task mutation deferred until governed workbench storage exists. | Level 1 |
| `microcompact` | absorbed as evidence | `sense.openclaw.engineering_context.microcompact_evidence` reads command transcript metadata, protects recent engineering evidence by default, and estimates reclaimable context budget without returning raw output or mutating logs. | Keep actual runtime-message compaction deferred until the evidence surface is stable and governed. Do not silently mutate persisted transcript or hide current verification/recovery evidence. | Level 1 |
| Live plugin runtime refresh | absorbed as evidence | `sense.openclaw.plugin_runtime.refresh_evidence` recomputes the native plugin registry read model, reports activation gates, cache invalidation intent, and blocked module-load/runtime-activation boundaries with Observer evidence. | Keep actual module-loader cache invalidation and live activation deferred until a governed loader exists. | Level 1 |
| ACPX/Codex bridge compatibility | requires source transfer | No ACPX/Codex bridge implementation exists in this repo. | Transfer compatibility lessons only where useful for OpenClaw's NixOS body and ACP bridge model. Do not center Windows wrapper behavior. | Level 1 |
| Runtime persistence tests | partially absorbed | Main has many task/approval/recovery persistence milestones; enhanced ACPX/runtime persistence tests are not migrated. | Reuse the persistence discipline, and add native tests only when adopting ACPX or live runtime refresh behavior. | Level 1 |
| Engineering prompt semantics | partially absorbed | Project docs and Codex skills encode evidence-first, precise edits, low coupling, and scoped validation; no product runtime prompt-pack enforcement exists. | Convert useful semantics into Observer-verifiable work standards, not a monolithic prompt wall. | Level 1 |
| Operator-facing UI refinements | partially absorbed | Observer UI has been decoupled into panels/refreshers/renderers and now exposes parameterized engineering loop controls plus task/approval/evidence guidance, completion readback, explicit recovery action drafts, recovered verification rerun readback, plan/todo workbench state, and read-only loop-state restoration from core task history, but enhanced chat/tool-card styling is not migrated. | Keep product-native controls; next auto-restore loop state on Observer startup when no local state exists. Avoid wholesale CSS import. | Level 1 now, Level 2 when work-view is active |
| `HEARTBEAT.md`, `SOUL.md`, `TOOLS.md` identity notes | should not migrate | Main has mission/docs/skills and fixtures that read `TOOLS.md`, but not these identity files as product authority. | Do not copy persona or local setup notes wholesale. Extract only governed context-file concepts after policy review. | Level 1 |

## Capability Findings

### `cc_read`

Enhanced source:

- `FileReadTool.ts` resolves paths against a workspace root, rejects path escape,
  supports `start_line` and `end_line`, caps output to 2000 lines, and returns
  numbered lines with metadata.

Current OpenClaw:

- `sense.openclaw.engineering_tool.read` provides bounded workspace file read
  with traversal protection, line range controls, file-size/output budgets,
  binary skips, audit evidence, and Observer visibility.
- `sense.openclaw.workspace_semantic_index` and
  `sense.openclaw.workspace_symbol_lookup` remain separate derived read-only
  analysis surfaces.

Classification: absorbed.

Recommendation:

- Continue using the native governed read surface. Do not import or execute
  enhanced `FileReadTool.ts`, and do not add unbounded system-path reads.

### `cc_edit`

Enhanced source:

- `FileEditTool.ts` performs an exact string replacement only when
  `old_string` appears exactly once and returns a diff-style snippet after
  writing.

Current OpenClaw:

- `workspace-patch-utils.mjs` already supports exact replacements, structured
  line edits, multi-hunk validation, overlap rejection, bounded diff previews,
  and unit tests.
- `workspace-ops.mjs` materializes mutation only through approval-gated tasks,
  `act.filesystem.write_text`, filesystem ledgering, and public redaction.
- `openclaw-native-engineering-edit-proposal-task-v0` rebuilds proposal
  evidence, verifies hashes against the patch task draft, and creates a queued
  approval-gated `workspace_patch_apply` task without approving or executing it.
- `sense.openclaw.engineering_tool.edit_execution_evidence` reads completed
  approved patch task outcomes and filesystem ledger records without applying
  edits or creating approvals.

Classification: absorbed through governed proposal/approval/execution evidence
and closed-loop proof.

Recommendation:

- Do not migrate immediate edit execution. The useful part is the uniqueness
  check and surgical edit ergonomics; OpenClaw's existing approval and ledger
  path should remain authoritative. Future work should improve operator controls
  for the closed loop rather than adding more readiness shells.

### `cc_write`

Enhanced source:

- `FileWriteTool.ts` creates or overwrites a file under the workspace root and
  warns callers to prefer `cc_edit` for existing files.

Current OpenClaw:

- `act.openclaw.engineering_tool.write_proposal` maps create/overwrite intent
  into bounded workspace proposal evidence with redacted diff metadata, content
  hashes, overwrite checks, and Observer visibility.
- `openclaw-native-engineering-write-proposal-task-v0` creates approval-gated
  workspace text write tasks from confirmed proposals without approving or
  executing the mutation.
- `sense.openclaw.engineering_tool.write_execution_evidence` reads completed
  approved write task outcomes and filesystem ledger records, linking them back
  to engineering write proposal metadata.
- `act.openclaw.workspace_text_write` exists as an approval-gated write path.
- Public task/approval/Observer surfaces expose hashes and byte counts instead
  of raw content.

Classification: absorbed through governed proposal/approval/execution evidence.

Recommendation:

- Keep full write as a high-risk action. Proposal evidence should remain
  separate from the approved, task-based, auditable, and recoverable write path.

### `cc_glob` and `cc_grep`

Enhanced source:

- `GlobTool.ts` provides recursive glob search with ignored noisy directories
  and a result cap.
- `GrepTool.ts` uses `rg` when available, falls back to a Node.js grep, supports
  regex/literal mode, include filters, case sensitivity, path and line evidence,
  and caps results.

Current OpenClaw:

- Tool catalog and semantic index scan selected roots and derive metadata.
- Existing system file search capability is not the same as a native codebase
  grep/glob engineering surface.

Classification: not absorbed.

Recommendation:

- After inventory/contract mapping, migrate these as the first real read/search
  execution slice. Preserve result caps, ignored directories, workspace bounds,
  and Observer readback.

### `cc_lsp`

Enhanced source:

- `LSPTool.ts` exposes `definition`, `references`, `hover`, and `check`.
- `lsp-manager.ts` starts language servers, caches connections by workspace and
  language, opens files, and garbage-collects idle servers.

Current OpenClaw:

- `sense.openclaw.workspace_symbol_lookup` provides declaration-oriented
  navigation without importing or executing legacy modules.
- `sense.openclaw.engineering_tool.lsp_evidence` maps LSP `check`,
  `definition`, `references`, and `hover` contracts, scans bounded workspace
  metadata for TypeScript, JavaScript, and Python signals, reports config-file
  presence without reading config bodies, and reports server binary names and
  install hints without executing version checks.
- It does not implement Language Server Protocol lifecycle, open files in an
  LSP connection, send JSON-RPC requests, or perform optional language server
  installation checks.

Classification: partially absorbed as evidence.

Recommendation:

- Keep the current evidence route as the Level 1 contract surface. Rewrite any
  future LSP lifecycle as an optional governed user-space service that exposes
  availability checks, server lifecycle state, workspace scope, failure
  evidence, and Observer recovery controls rather than becoming a hidden
  long-lived process.

### `cc_verify`

Enhanced source:

- `VerifyCodeTool.ts` dispatches a verification command through an injected
  runtime, captures output, exit code, timeout state, and a retry budget.
- Tests assert that verification goes through the injected runtime and does not
  shell-wrap commands unexpectedly.

Current OpenClaw:

- Source-derived command chains can plan, approve, execute, recover, harden, and
  persist command tasks.
- `sense.openclaw.engineering_tool.verify_evidence` now reads command
  transcripts, capability invocation records, and completed task outcomes to
  create bounded verification evidence.
- `sense.openclaw.engineering_tool.recovery_evidence` now reads failed
  verification evidence and failed source-command task outcomes to surface
  governed recovery recommendations without invoking them.

Classification: absorbed as evidence.

Recommendation:

- Keep execution on the existing approval-gated command task path. Use the
  native verification evidence surface for command shape, provenance, output
  budget, exit status, timeout flag, retry-policy metadata, and Observer
  display. Use recovery evidence only to guide operator review of existing
  recoverable tasks; do not turn it into an automatic retry path.

### `cc_plan_enter`, `cc_plan_exit`, and `cc_todo_write`

Enhanced source:

- `PlanModeTool.ts` defines explicit planning mode entry/exit and persists a
  checklist to `.openclaw/cc-todo.md`.

Current OpenClaw:

- Core already has tasks, plans, approvals, recovery, and state persistence.
- `sense.openclaw.engineering_context.plan_todo_evidence` now exposes
  planning/todo evidence from visible task/workbench state and bounded query
  fixtures. It reports the `.openclaw/cc-todo.md` target only as a deferred
  boundary and does not write it.

Classification: absorbed as evidence.

Recommendation:

- Keep this evidence-only until a governed workbench storage model exists.
  Avoid hidden agent state that cannot be observed or recovered.

### Microcompact

Enhanced source:

- `microcompact.ts` compresses historical large `toolResult` text blocks in
  memory, protects recent assistant turns, and leaves persisted session logs
  intact.

Current OpenClaw:

- `sense.openclaw.engineering_context.microcompact_evidence` reads command
  transcript metadata and output lengths without returning raw output.
- The evidence surface protects recent command evidence by default, links
  verification/recovery read models, estimates reclaimable context budget, and
  keeps runtime-message and persisted-log mutation disabled.

Classification: absorbed as evidence.

Recommendation:

- Keep the evidence route as the authority before adding any actual LLM-context
  transformation. It must not silently hide current task evidence, approval
  context, recovery context, or verification output.

### Live Plugin Runtime Refresh

Enhanced source:

- `runtime-registry-loader.ts` provides `ensurePluginRegistryLoaded` and
  `refreshActivePluginRegistry`, clears discovery/manifest caches, reloads
  selected plugin scopes, and supports setup-only/channel-scoped options.
- `/plugins install`, enable, and disable paths call live refresh and report
  refresh success or failure to the operator.

Current OpenClaw:

- Native plugin runtime activation, denial recovery, hardening, persistence, and
  adapter contracts exist, but many remain explicitly deferred before actual
  module loading or execution.
- `sense.openclaw.plugin_runtime.refresh_evidence` now recomputes the native
  plugin registry read model, reports activation gates and cache invalidation
  intent, and keeps module import, plugin execution, activation, cache mutation,
  task creation, and approval creation disabled.

Classification: absorbed as evidence.

Recommendation:

- Keep using the evidence route until a governed loader exists. The next step
  is not hidden refresh execution; it is planning/todo evidence or a governed
  loader design that can preserve approval, audit, and recovery boundaries.

### ACPX/Codex Bridge Compatibility

Enhanced source:

- `codex-auth-bridge.ts` prepares isolated Codex auth material, writes a wrapper
  that launches `npx.cmd` on Windows and `npx` elsewhere, preserves selected
  environment semantics, and avoids embedding secret values in wrapper text.
- Tests cover isolated auth copy, wrapper creation, explicit command override,
  and persistence behavior.

Current OpenClaw:

- No ACPX/Codex bridge implementation exists in `OpenClaw_On_NixOS`.

Classification: requires source transfer.

Recommendation:

- Preserve the compatibility and secret-isolation lessons. Adapt them to the
  NixOS body and any future ACP bridge, rather than centering Windows command
  wrapper behavior.

### Runtime Persistence Tests

Enhanced source:

- ACPX runtime tests cover session load/save, multiple independent sessions,
  missing sessions, and overwrite behavior.
- Runtime registry tests cover scoped loads, configured-channel resolution, and
  cache refresh behavior.

Current OpenClaw:

- The main repo has substantial milestone evidence for task, approval, recovery,
  runtime activation, and provider-lane persistence.
- The specific enhanced ACPX and live plugin runtime persistence tests are not
  migrated.

Classification: partially absorbed.

Recommendation:

- Keep the existing persistence discipline. Add focused unit tests when the ACPX
  bridge or live runtime refresh is migrated.

### Engineering Prompt Semantics

Enhanced source:

- `system-prompt.ts` adds Claude Code-style instructions: precise edits over
  full rewrites, verification before report, blast-radius control, planning
  before acting, and concise evidence-backed reporting.
- `pi-tools.ts` directly loads `cc-tools` and exposes summaries for the prompt.

Current OpenClaw:

- Repository skills and route documents already enforce many of these
  engineering standards for Codex project development.
- Product runtime enforcement and Observer evidence for these semantics is still
  incomplete.

Classification: partially absorbed.

Recommendation:

- Convert prompt semantics into product-visible work standards: proposal
  rationale, expected checks, verification evidence, and Observer readback.
  Avoid adding another large prompt wall as the primary artifact.

### Operator-Facing UI Refinements

Enhanced source:

- `ui/src/styles/chat/tool-cards.css`, chat layout CSS, and related UI files add
  tool cards, grouped tool rendering, approval overlays, and denser operator
  controls.

Current OpenClaw:

- Observer UI has been decoupled into domain panels, config DOM modules,
  refreshers, renderers, and runtime action modules.
- The exact enhanced UI styling and chat/tool-card interaction layer is not
  migrated.

Classification: partially absorbed.

Recommendation:

- Defer direct UI migration until native engineering tools produce real
  read/search/edit/verify evidence. Then add Observer views for those artifacts,
  not generic styling imports.

### `HEARTBEAT.md`, `SOUL.md`, and `TOOLS.md`

Enhanced source:

- `HEARTBEAT.md` is a heartbeat task/context template.
- `SOUL.md` is a persona and conduct note.
- `TOOLS.md` is a local environment note convention.

Current OpenClaw:

- OpenClaw already has project mission docs, route directives, and Codex skills.
- Some milestone fixtures create `TOOLS.md` for source-command and prompt
  semantics checks, but those are not product identity authority.

Classification: should not migrate.

Recommendation:

- Do not copy these files wholesale. If context files become product features,
  define governed contracts for which files are read, how they are scoped, how
  they are displayed, and how they interact with higher-priority policy.

## Deferred Or Should-Not-Migrate Items

Deferred:

- Unbounded/raw `cc_read` execution outside the native workspace scope,
  content budgets, audit evidence, and Observer visibility.
- Raw enhanced glob/grep execution outside the native bounded read/search
  surface.
- Full LSP server lifecycle, server binary checks, file open notifications, and
  definition/references/hover JSON-RPC until a governed service boundary is
  chosen. The current absorbed surface is evidence-only.
- Verification-command execution until command provenance and completion
  evidence attach cleanly to task records.
- Actual microcompact runtime-message transformation until the evidence route
  proves safe context boundaries.
- Actual live plugin module-loader refresh until a governed loader exists and
  cache invalidation can be approved, audited, and recovered.
- ACPX/Codex bridge work until it is scoped to OpenClaw's NixOS body and ACP
  compatibility needs.

Should not migrate:

- Wholesale `extensions/cc-tools` import as an ungoverned tool bundle.
- Immediate `cc_edit`/`cc_write` mutation outside OpenClaw approval and ledger
  paths; `cc_edit` execution evidence after approved patch completion remains a
  follow-up.
- Hidden prompt-wall replacement as the main way to enforce engineering
  behavior.
- Raw persona or local setup notes from `SOUL.md` and `TOOLS.md` as product
  authority.
- Accidental local state or historical caches from the enhanced source repo.

## Recommended Next Slice

Selected trunk:

```text
Native governed engineering tool surface
```

Next smallest real capability:

```text
Planning/todo evidence surface
```

This should produce:

- An explicit task/workbench evidence surface for `cc_plan_enter`,
  `cc_plan_exit`, and `cc_todo_write` semantics.
- Observer-visible active plan, todo state, completion transitions, and recovery
  links without hidden agent mode or uncontrolled `.openclaw` file mutation.
- No raw file mutation, no provider call, no hidden enhanced-source import, and
  no automatic activation.
- Evidence through focused unit tests plus a targeted local milestone if an
  endpoint or Observer surface is added.

Why this is real progress:

- It advances Level 1, the stable user-space control plane.
- It makes OpenClaw better at governing its own engineering work rather than
  adding another cloud/provider safety shell.
- It sets up the next executable slice after planning/todo evidence: ACP/Codex
  bridge compatibility or governed loader design, depending on the route
  documents after plan evidence lands.

Required answer for every following slice:

- What real user/operator-visible capability became more concrete?
- Which identity level does it serve?
- Where is the evidence?
- What remains deliberately deferred?
- What is the next smallest real capability?
