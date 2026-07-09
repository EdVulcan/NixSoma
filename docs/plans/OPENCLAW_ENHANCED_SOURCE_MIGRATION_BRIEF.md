# OpenClaw Enhanced Source Migration Brief

Updated: 2026-07-09

This brief exists so a VM-side agent can understand an important project truth:
the main `OpenClawOnNixOS` repository has absorbed many enhanced `openclaw`
ideas through governed source-integration milestones, but the concrete locally
optimized `openclaw` source changes from the Windows host have not been fully
merged into this repository yet.

Read this file before continuing new phases that claim to improve coding
capability, Claude Code parity, source integration, plugin runtime ergonomics, or
agent token efficiency.

Also read:

```text
docs/architecture/OPENCLAW_SYSTEM_IDENTITY_UPGRADE_PATH.md
```

That identity-upgrade route is the governing architecture lens for this work:
enhanced `openclaw` capabilities should help OpenClaw become a stable user-space
control plane first, then a trusted session component, then a controlled
system-level body daemon, and finally a graphics-stack-native AI workspace. They
should not push the project toward a crude root process or an ungoverned source
dump.

## Source Situation

Primary project repository:

```text
/home/edvulcan/OpenClaw_On_NixOS
```

Windows host source repository containing the local enhanced implementation:

```text
D:\OpenclawAndClaudecode\openclaw
```

The VM cannot assume those local Windows-only changes are present after a normal
`git pull` of `EdVulcan/OpenClaw_On_NixOS`. They are source material for the
next integration pass, not already-integrated code.

## Why This Matters

The project goal is not to keep adding milestone wrappers. OpenClaw is a
NixOS-based local autonomous agent body with user sovereignty, body sovereignty,
observable execution, recoverable actions, memory, and eventually live provider
collaboration.

The enhanced `openclaw` work captured several practical advantages from Claude
Code-style development:

- precise code reading and surgical editing tools
- fast codebase search and symbol navigation
- structured planning and persistent task tracking
- verification-first coding loops
- token-pressure reduction through microcompaction
- live plugin runtime refresh after install/enable/disable
- cross-platform ACP/Codex bridge compatibility fixes
- stronger engineering behavior prompts

Those advantages should be absorbed into `OpenClawOnNixOS` as native,
policy-governed body capabilities. They should not be forgotten while later
cloud/provider phases continue.

## Local Enhanced Source Inventory

These paths were observed as uncommitted or untracked changes in the Windows
host `openclaw` repository on 2026-07-09:

```text
extensions/acpx/src/codex-auth-bridge.ts
extensions/acpx/src/runtime-persistence.test.ts
extensions/cc-tools/package.json
extensions/cc-tools/tsconfig.json
extensions/cc-tools/src/cc-tools.test.ts
extensions/cc-tools/src/fs-bridge.ts
extensions/cc-tools/src/index.ts
extensions/cc-tools/src/types.ts
extensions/cc-tools/src/lsp/LSPTool.ts
extensions/cc-tools/src/lsp/lsp-manager.ts
extensions/cc-tools/src/tools/FileEditTool.ts
extensions/cc-tools/src/tools/FileReadTool.ts
extensions/cc-tools/src/tools/FileWriteTool.ts
extensions/cc-tools/src/tools/GlobTool.ts
extensions/cc-tools/src/tools/GrepTool.ts
extensions/cc-tools/src/tools/PlanModeTool.ts
extensions/cc-tools/src/tools/VerifyCodeTool.ts
src/agents/pi-embedded-runner/microcompact.ts
src/agents/pi-embedded-runner/run/attempt.ts
src/agents/pi-tools.ts
src/agents/system-prompt.ts
src/auto-reply/reply/commands-plugins.ts
src/auto-reply/reply/commands-plugins.test.ts
src/auto-reply/reply/commands-plugins.install.test.ts
src/plugins/runtime/runtime-registry-loader.ts
src/plugins/runtime/runtime-registry-loader.test.ts
ui/index.html
ui/src/styles/base.css
ui/src/styles/chat/grouped.css
ui/src/styles/chat/layout.css
ui/src/styles/chat/tool-cards.css
ui/src/styles/components.css
ui/src/styles/layout.css
HEARTBEAT.md
SOUL.md
TOOLS.md
gateway-architecture.html
```

Temporary/local files also existed and should not be blindly migrated:

```text
.openclaw/workspace-state.json
help.txt
temp_test.txt
```

## Capability Themes To Preserve

### 1. CC Tools Engineering Surface

Observed intent: add Claude Code-grade tools to the enhanced `openclaw` agent
runtime:

```text
cc_read
cc_edit
cc_write
cc_glob
cc_grep
cc_plan_enter
cc_plan_exit
cc_todo_write
cc_lsp
cc_verify
```

OpenClawOnNixOS target: absorb these as native workspace-engineering
capabilities behind existing policy, approval, audit ledger, observer visibility,
workspace scoping, and recovery semantics.

Do not simply copy a standalone tool bundle and bypass the body-governance
chain. The useful capability is "precise, verifiable engineering action by a
local body," not just the tool names.

### 2. Microcompact Token Pressure Control

Observed intent: compress old large tool results in-memory before model calls
while preserving persisted session logs.

OpenClawOnNixOS target: treat this as a local memory/context-management
capability. It should preserve recent turns, keep audit/source logs intact, and
emit evidence about reclaimed context budget without hiding current evidence
needed for verification.

### 3. Live Plugin Runtime Refresh

Observed intent: after `/plugins install`, enable, or disable, refresh the active
plugin runtime without requiring a gateway restart.

OpenClawOnNixOS target: integrate as governed runtime lifecycle management:
operator-visible, auditable, recoverable, and safe for setup-only/channel-scoped
plugins.

### 4. ACP/Codex Bridge Compatibility

Observed intent: fix Windows `npx.cmd` and wrapper execution behavior for the
Codex ACP bridge, plus add runtime persistence tests.

OpenClawOnNixOS target: preserve the compatibility insight where relevant, but
adapt it to the NixOS body and VM/host bridge model instead of treating Windows
wrapper behavior as the main runtime path.

### 5. Engineering Prompt Semantics

Observed intent: add Claude Code-style engineering directives:

```text
precise edits over full rewrites
no gold plating
blast-radius control
evidence before report
plan before acting
```

OpenClawOnNixOS target: encode these as agent conduct and observer-verifiable
work standards, not as an ungoverned prompt wall. They should support the
whitepaper goal of reliable local autonomy.

### 6. UI And Identity Notes

Observed intent: improve UI styling and add local project notes such as
`HEARTBEAT.md`, `SOUL.md`, and `TOOLS.md`.

OpenClawOnNixOS target: classify these separately. Some may become operator UX,
project identity, or agent conduct docs. They are not equal priority with the
engineering capability layer.

## Required VM Agent Reading Order

Before continuing a new source-integration or coding-capability phase, read:

```bash
cd /home/edvulcan/OpenClaw_On_NixOS
git status --short
git log -10 --oneline
sed -n '1,220p' docs/plans/OPENCLAW_ENHANCED_SOURCE_MIGRATION_BRIEF.md
sed -n '1,260p' docs/plans/OPENCLAW_SOURCE_INTEGRATION_STAGE_PLAN.md
find docs -maxdepth 3 -type f | sort | grep -Ei 'whitepaper|source|integration|plugin|workspace|tool|runtime|memory|body'
```

Then answer with evidence:

```text
1. Which enhanced source capabilities are already absorbed?
2. Which are only planned or represented as metadata?
3. Which require real source transfer from the Windows enhanced openclaw repo?
4. Which next slice creates actual product capability instead of another
   readiness wrapper?
```

## Transfer Options If The VM Needs Source

The VM agent should not fabricate source details if the Windows enhanced source
is unavailable. Use one of these transfer paths:

```powershell
# On Windows host, produce a tracked diff for modified files.
git -C D:\OpenclawAndClaudecode\openclaw diff --binary > D:\OpenclawAndClaudecode\enhanced-openclaw-local.diff

# Also archive untracked source files that are part of the intended migration.
# Exclude .openclaw/workspace-state.json, help.txt, and temp_test.txt unless a
# human explicitly says otherwise.
```

Alternative preferred long-term path:

```text
Commit the enhanced openclaw work to a dedicated branch or fork, then let the VM
agent inspect that branch as an external source reference.
```

## Source Preservation Decision

The best preservation path is to save the enhanced `openclaw` source as its own
GitHub-visible reference, not as a direct dump into `OpenClawOnNixOS`.

Current preservation status as of 2026-07-09:

```text
preserved
```

Source reference:

```text
repository: https://github.com/EdVulcan/openclaw-enhanced-source
branch: main
commit: d90b253b0c03191613e45c36b1434078b8788bed
commit title: Preserve enhanced OpenClaw source prototype
```

Preservation note:

```text
The first push preserved the full enhanced-source branch history from the local
openclaw checkout. GitHub reported one large historical cache file warning:
.serena/cache/typescript/document_symbols.pkl is 83.22 MB. Treat the repository
as a source reference for migration, not as the final vendored dependency.
```

Recommended shape:

```text
EdVulcan/OpenClaw_On_NixOS
  Main NixOS body project, whitepaper route, milestones, governance, docs.

EdVulcan/openclaw-enhanced-source
  Or a dedicated branch in an EdVulcan fork of openclaw.
  Stores the concrete enhanced source implementation for inspection and
  migration.
```

Recommended branch name if using a fork:

```text
edvulcan/enhanced-cc-tools-source-2026-07-09
```

Only preserve intentional source material:

```text
cc-tools
microcompact
live plugin runtime refresh
ACPX/Codex bridge compatibility
runtime persistence tests
engineering prompt semantics
operator-facing UI refinements
```

Do not preserve accidental local state in the source reference unless a human
explicitly asks for it:

```text
.openclaw/workspace-state.json
help.txt
temp_test.txt
```

After the enhanced source is pushed, record its GitHub URL and commit hash in
this brief. The VM agent should then clone or fetch that reference for source
inspection instead of guessing from summaries.

## Integration Rules

- Do not wholesale-copy the enhanced `openclaw` repo into `OpenClawOnNixOS`.
- Do not import old runtime modules as hidden dependencies.
- Do not bypass policy, approval, audit, observer, or workspace scoping.
- Do not spend many phases on safety-only shells without moving capability.
- Prefer small vertical slices that prove a real body capability.
- Every slice must name the user-visible capability, evidence artifact,
  remaining deferred boundary, and next capability step.
- Keep code decoupled; do not recreate a giant core file.
- Align capability migration with
  `docs/architecture/OPENCLAW_SYSTEM_IDENTITY_UPGRADE_PATH.md`: strengthen the
  user-space control plane and AI-owned work view first, then introduce trusted
  sidecars or privileged daemons only when the capability requires that identity
  level.

## Recommended Next Slice

Create an "enhanced source migration gap audit" that compares the existing
`OpenClawOnNixOS` source-integration milestones against the inventory above.

The audit should classify each capability as:

```text
absorbed
partially absorbed
not absorbed
should not migrate
requires source transfer
```

After the audit, prioritize the highest-value real capability:

```text
Native governed engineering tool surface:
read -> grep/glob -> surgical edit proposal -> verification command ->
observer evidence -> recovery/audit.
```

This directly advances the whitepaper direction because it makes the local body
better at controlled self-development, not merely better at passing milestone
checks.
