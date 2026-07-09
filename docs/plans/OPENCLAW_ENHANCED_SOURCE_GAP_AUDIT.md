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
- Native engineering verification evidence:
  `sense.openclaw.engineering_tool.verify_evidence` converts governed command
  transcripts into bounded verification evidence attached to completed tasks.
- Native engineering recovery evidence:
  `sense.openclaw.engineering_tool.recovery_evidence` reads failed verification
  evidence and failed source-command task outcomes, classifies recoverability,
  and exposes operator recovery recommendations without creating tasks or
  rerunning commands.
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
| `cc_edit` | partially absorbed | `act.openclaw.engineering_tool.edit_proposal` creates exact-match surgical edit proposals with bounded diff previews, while `act.openclaw.workspace_patch_apply` remains the approval-gated apply path. | Keep proposal and apply separated. Do not migrate immediate raw edit execution. | Level 1 |
| `cc_write` | partially absorbed | `act.openclaw.workspace_text_write` exists and writes only after approval through native filesystem governance. | Keep write gated and redacted. Do not migrate raw overwrite semantics as an autonomous default. | Level 1 |
| `cc_glob` | absorbed | `sense.openclaw.engineering_tool.glob` performs bounded workspace file discovery with skipped hidden/generated/cache/dependency directories and result caps. | Continue native bounded discovery; do not execute enhanced `GlobTool.ts`. | Level 1 |
| `cc_grep` | absorbed | `sense.openclaw.engineering_tool.grep` performs bounded workspace text search with literal/regex mode, include filters, result/output caps, binary skips, audit, and Observer evidence. | Continue native bounded search; do not execute enhanced `GrepTool.ts`. | Level 1 |
| `cc_lsp` | requires source transfer | `sense.openclaw.workspace_symbol_lookup` approximates navigation but does not start or manage LSP servers. | Transfer the LSP manager idea, rewritten as an optional governed workspace service with lifecycle evidence. | Level 1 now, Level 2 later |
| `cc_verify` | absorbed as evidence | `sense.openclaw.engineering_tool.verify_evidence` reads approval-gated command transcripts, capability invocations, and completed task outcomes to produce bounded verification evidence with checks, output budgets, retry-policy metadata, audit evidence, and Observer visibility. `sense.openclaw.engineering_tool.recovery_evidence` adds read-only failed-evidence recovery recommendations. | Keep actual command execution on the existing approval-gated source/workspace command task path. Do not add ungoverned shell execution or automatic retries. | Level 1 |
| `cc_plan_enter`, `cc_plan_exit`, `cc_todo_write` | partially absorbed | Core tasks, plans, approvals, and recovery exist; no lightweight planning mode or `.openclaw/cc-todo.md` equivalent is native. | Treat as plan-state evidence, not hidden agent mode. Integrate with task/workbench state if migrated. | Level 1 |
| `microcompact` | not absorbed | Only docs mention microcompaction; no context-management runtime exists in this repo. | Add as explicit context-management evidence. Do not silently mutate persisted transcript or hide current verification evidence. | Level 1 |
| Live plugin runtime refresh | requires source transfer | Main has runtime activation tasks and deferred gates, but not live in-process refresh after install/enable/disable. | Transfer the refresh semantics into a governed lifecycle action with cache invalidation, status, recovery, and Observer evidence. | Level 1 |
| ACPX/Codex bridge compatibility | requires source transfer | No ACPX/Codex bridge implementation exists in this repo. | Transfer compatibility lessons only where useful for OpenClaw's NixOS body and ACP bridge model. Do not center Windows wrapper behavior. | Level 1 |
| Runtime persistence tests | partially absorbed | Main has many task/approval/recovery persistence milestones; enhanced ACPX/runtime persistence tests are not migrated. | Reuse the persistence discipline, and add native tests only when adopting ACPX or live runtime refresh behavior. | Level 1 |
| Engineering prompt semantics | partially absorbed | Project docs and Codex skills encode evidence-first, precise edits, low coupling, and scoped validation; no product runtime prompt-pack enforcement exists. | Convert useful semantics into Observer-verifiable work standards, not a monolithic prompt wall. | Level 1 |
| Operator-facing UI refinements | partially absorbed | Observer UI has been decoupled into panels/refreshers/renderers, but enhanced chat/tool-card styling is not migrated. | Cherry-pick interaction patterns after capability surfaces exist. Avoid wholesale CSS import. | Level 2 when work-view is active |
| `HEARTBEAT.md`, `SOUL.md`, `TOOLS.md` identity notes | should not migrate | Main has mission/docs/skills and fixtures that read `TOOLS.md`, but not these identity files as product authority. | Do not copy persona or local setup notes wholesale. Extract only governed context-file concepts after policy review. | Level 1 |

## Capability Findings

### `cc_read`

Enhanced source:

- `FileReadTool.ts` resolves paths against a workspace root, rejects path escape,
  supports `start_line` and `end_line`, caps output to 2000 lines, and returns
  numbered lines with metadata.

Current OpenClaw:

- `sense.openclaw.workspace_semantic_index` and
  `sense.openclaw.workspace_symbol_lookup` perform bounded read-only analysis.
- The current surfaces intentionally avoid exposing raw source file bodies.

Classification: partially absorbed.

Recommendation:

- Implement a native governed read contract before adding mutating tools:
  workspace scope, line range, result budget, content exposure flag, audit
  ledger entry, Observer evidence, and recovery semantics.

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

Classification: partially absorbed.

Recommendation:

- Do not migrate immediate edit execution. The useful part is the uniqueness
  check and surgical edit ergonomics; OpenClaw's existing approval and ledger
  path should remain authoritative.

### `cc_write`

Enhanced source:

- `FileWriteTool.ts` creates or overwrites a file under the workspace root and
  warns callers to prefer `cc_edit` for existing files.

Current OpenClaw:

- `act.openclaw.workspace_text_write` exists as an approval-gated write path.
- Public task/approval/Observer surfaces expose hashes and byte counts instead
  of raw content.

Classification: partially absorbed.

Recommendation:

- Keep full write as a high-risk action. It should remain task-based, approved,
  auditable, and recoverable.

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
- It does not implement Language Server Protocol lifecycle, hover, references,
  or optional language server installation checks.

Classification: requires source transfer.

Recommendation:

- Rewrite the LSP lifecycle as an optional governed user-space service. It
  should expose availability checks, server lifecycle state, workspace scope,
  and failure evidence, rather than becoming a hidden long-lived process.

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
- There is no equivalent lightweight planning-mode artifact that the Observer
  can show as the agent's current engineering plan.

Classification: partially absorbed.

Recommendation:

- If migrated, represent this as task/workbench evidence. Avoid hidden agent
  state that cannot be observed or recovered.

### Microcompact

Enhanced source:

- `microcompact.ts` compresses historical large `toolResult` text blocks in
  memory, protects recent assistant turns, and leaves persisted session logs
  intact.

Current OpenClaw:

- No runtime microcompact feature exists. The current repo only records it in
  the enhanced source migration brief and forward directive.

Classification: not absorbed.

Recommendation:

- Migrate as an explicit context-management capability with reclaimed-budget
  evidence. It must not silently hide current task evidence, approval context,
  or verification output.

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

Classification: requires source transfer.

Recommendation:

- Migrate as a governed lifecycle action: operator initiated or policy-approved,
  cache invalidation recorded, runtime state visible, failure recoverable, and
  no hidden activation during registration.

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

- Direct raw `cc_read` execution until a native contract maps workspace scope,
  content exposure, and Observer evidence.
- General glob/grep execution until inventory and contract mapping exists.
- Full LSP server lifecycle until a governed service boundary is chosen.
- Verification-command execution until command provenance and completion
  evidence attach cleanly to task records.
- Microcompact until it emits auditable context-management evidence.
- Live plugin runtime refresh until runtime lifecycle state, cache invalidation,
  and recovery are visible.
- ACPX/Codex bridge work until it is scoped to OpenClaw's NixOS body and ACP
  compatibility needs.

Should not migrate:

- Wholesale `extensions/cc-tools` import as an ungoverned tool bundle.
- Immediate `cc_edit`/`cc_write` mutation outside OpenClaw approval and ledger
  paths.
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
Microcompact context-management evidence
```

This should produce:

- An explicit OpenClaw context-management evidence route that summarizes
  bounded engineering context without mutating hidden transcript state.
- Observer-visible context budget, included evidence sources, omitted sections,
  and recovery/verification links needed to continue the task safely.
- No prompt-wall replacement, no silent transcript rewrite, no provider call,
  no file mutation, and no hidden enhanced-source import.
- Evidence through focused unit tests plus a targeted local milestone if an
  endpoint or Observer surface is added.

Why this is real progress:

- It advances Level 1, the stable user-space control plane.
- It makes OpenClaw better at governing its own engineering work rather than
  adding another cloud/provider safety shell.
- It sets up the next executable slice: governed live plugin runtime refresh or
  a planning/todo evidence surface, depending on the route documents after
  microcompact evidence lands.

Required answer for every following slice:

- What real user/operator-visible capability became more concrete?
- Which identity level does it serve?
- Where is the evidence?
- What remains deliberately deferred?
- What is the next smallest real capability?
