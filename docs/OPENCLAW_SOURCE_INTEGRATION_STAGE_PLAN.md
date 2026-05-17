# OpenClaw Source Integration Stage Plan

更新时间：2026-05-15 12:05 +08:00

本文档用于跟踪当前阶段：把旁路 `openclaw` 增强源码项目中的能力，受控接入 `OpenClawOnNixOS`。后续每推进一个接入切片，都必须同步更新本文件，避免路线漂移、重复准备层、或忘记阶段边界。

## 1. 阶段定位

当前阶段不是继续做抽象准备，而是进入正式接入的第一段：从增强版 `openclaw` 中吸收插件 SDK、工具体系、提示词规范、Claude Code 风格工程能力，并把它们内化为 `OpenClawOnNixOS` 原生能力。

核心比喻：

- `openclaw` 是增强过的高性能部件库，包含插件 SDK、工具、提示词、会话、沙箱、跨端网关等能力。
- `OpenClawOnNixOS` 是 NixOS 躯体底盘、主权总线、审计系统、Observer 仪表盘和恢复系统。
- 接入方式不是整坨挂载旧项目，而是拆成可治理的能力部件，接到 `OpenClawOnNixOS` 的 policy、approval、audit、executor 链路上。

## 2. 不变量

这些规则不能因为进度压力被绕过：

- `OpenClawOnNixOS` 始终是运行时所有者。
- 旧 `openclaw` 源码是能力来源和设计参考，不是长期运行时依赖。
- 不 wholesale copy 旧仓库，不直接执行旧仓库命令，不隐式 import 旧模块。
- 每个接入能力必须经过 capability contract、policy、approval 边界、audit ledger、Observer 可见性。
- 躯体内部能力可以默认自治，但跨域、高风险、写入、执行、网络、系统级变更必须受用户宗主权约束。
- 不再增加“准备的准备”。任何新准备项都必须直接解锁一个真实实现切片。

## 3. 当前已完成基线

已完成并通过的准备/边界工作：

- NixOS 躯体服务骨架、profiles、systemd service skeleton。
- Core task、planner、operator、policy、approval、capability、event audit、system sense/heal。
- Sovereign command/filesystem/workspace 能力链路。
- Observer 对核心任务、能力、命令、文件系统、workspace、operator 的可见性。
- real OpenClaw workspace profile。
- OpenClaw source migration map。
- OpenClaw source migration plan。
- OpenClaw plugin SDK contract review。
- OpenClaw plugin SDK source review scope。
- Native plugin contract、registry、adapter shell。
- Native plugin invoke plan、task、deferred boundary、runtime preflight、runtime activation plan。

最近提交：

- `cb9ad20 Add plugin SDK source content review`
- `6564d79 Document OpenClaw source integration stage plan`

本地验证：

- `npm run typecheck` 通过。
- `git diff --check` 通过。
- NixOS targeted milestone 已确认通过：`openclaw-plugin-sdk-source-content-review`、`observer-openclaw-plugin-sdk-source-content-review`。

已确认的 NixOS 侧命令：

```bash
cd /home/edvulcan/OpenClaw_On_NixOS && \
git pull origin main && \
OPENCLAW_MILESTONE_CHECKS=openclaw-plugin-sdk-source-content-review,observer-openclaw-plugin-sdk-source-content-review npm run dev:milestone-check:unix
```

## 4. 当前切片

切片名称：Plugin SDK Source Content Review

状态：passed。

确认时间：2026-05-13 12:27:31 +08:00 至 2026-05-13 12:27:41 +08:00。

确认结果：

- `openclaw-plugin-sdk-source-content-review`：PASS，5s。
- `observer-openclaw-plugin-sdk-source-content-review`：PASS，5s。
- 合计：2 passed / 0 failed。

目的：

- 第一次读取旧 `openclaw` 插件 SDK 的真实源码内容。
- 只输出派生信号，不暴露源码文本。
- 为下一步 native contract tests 和原生实现提供依据。

允许输出：

- 文件数量、行数。
- export/import/interface/type/function/class/const 计数。
- capability vocabulary 信号。
- recommended absorption category。

禁止输出或执行：

- 原始源码文本。
- README 正文。
- package scripts body。
- dependency version。
- 旧模块 import。
- 旧插件代码执行。
- runtime activation。
- task/approval 自动创建。

## 5. 下一步计划

### Step 1: 确认 Source Content Review

状态：passed。

目标：确认新增的两个 targeted milestone 在 NixOS 侧通过。

完成条件：

- `openclaw-plugin-sdk-source-content-review` 通过。
- `observer-openclaw-plugin-sdk-source-content-review` 通过。
- Observer 可以看到 derived signals。
- 无源码、脚本、依赖版本、fixture secret 泄漏。

若失败：

- 只修复该切片的实现或检查。
- 不新增额外准备层。

### Step 2: SDK Derived Signals -> Native Contract Tests

状态：passed。

确认时间：2026-05-13 14:47:42 +08:00 至 2026-05-13 14:47:51 +08:00。

确认结果：

- `openclaw-plugin-sdk-native-contract-tests`：PASS，5s。
- `observer-openclaw-plugin-sdk-native-contract-tests`：PASS，4s。
- 合计：2 passed / 0 failed。

目标：把 Step 1 读出的 SDK 派生信号，转成 `OpenClawOnNixOS` 原生合同测试。

计划产物：

- 原生 plugin/capability contract 测试。
- 合同字段最小集合：plugin id、capability id、risk、domains、permissions、approval、audit、runtime owner。
- 对 enhanced `openclaw` 的 SDK 概念做映射表。

完成条件：

- 测试先失败，证明合同缺口真实存在。
- 测试不依赖旧 `openclaw` 仓库作为运行时。
- Observer/summary 能展示合同映射状态。

### Step 3: Native Plugin SDK Contract Implementation

状态：passed。

确认时间：2026-05-13 15:41:53 +08:00 至 2026-05-13 15:42:03 +08:00。

确认结果：

- `openclaw-native-plugin-sdk-contract-implementation`：PASS，5s。
- `observer-openclaw-native-plugin-sdk-contract-implementation`：PASS，4s。
- 合计：2 passed / 0 failed。

目标：实现 Step 2 的原生合同，使 `OpenClawOnNixOS` 具备吸收旧 OpenClaw 工具/提示词/插件的稳定插槽。

计划产物：

- 原生 contract builder。
- 原生 registry validation。
- policy/audit metadata。
- Observer 合同状态展示。

完成条件：

- SDK contract tests 通过。
- 现有 native plugin registry 不倒退。
- 不 import 或执行旧 OpenClaw 代码。

### Step 4: First Real Capability Absorption

状态：planned，下一步执行焦点。

目标：选一个低风险但真实的 enhanced `openclaw` 能力做第一次“部件接入”。

优先候选：

- `sense.openclaw.tool_catalog`：读取并归纳旧 OpenClaw 工具体系的能力目录。
- `sense.openclaw.prompt_pack`：读取并归纳 Claude Code 风格提示词/行为规范目录。
- `sense.openclaw.plugin_manifest`：读取插件 manifest 并映射到 native registry。

选择原则：

- 第一项必须是 read-only。
- 必须能证明我们在吸收增强版 `openclaw` 的真实能力，而不是继续只做空壳。
- 不执行旧工具，不运行旧插件。
- 输出必须是 capability metadata，而不是源码泄漏。

完成条件：

- 一个真实 `openclaw` 能力目录被 native contract 表达。
- Observer 可见。
- milestone targeted check 通过。

### Step 5: First Governed Executable Adapter

目标：从只读能力进入受控执行能力。

优先候选：

- 安全的只读文件/工作区感知工具。
- LSP/语义导航类工具。
- 非破坏性 shell dry-run 工具。

硬性边界：

- 执行必须走 native adapter。
- 高风险或写入能力必须 approval-gated。
- 每次执行必须进入 capability history / event audit。
- 不能绕过 NixOS service、policy、Observer。

完成条件：

- 至少一个来自增强 `openclaw` 设计的能力，在 `OpenClawOnNixOS` 中原生执行。
- 执行链路为 `capability -> policy -> approval if needed -> adapter -> audit -> Observer`。

## 6. 后续吸收顺序

建议顺序：

1. Plugin SDK / capability contract。
2. Tool catalog / prompt pack metadata。
3. Read-only semantic tools。
4. File edit tools behind approval。
5. Shell/process tools behind approval and sandbox rules。
6. Session/subagent orchestration。
7. Cross-channel gateway capabilities。
8. NixOS-native deployment and self-healing integration。

暂不优先：

- 直接运行旧 OpenClaw daemon。
- 直接接入全部跨端渠道。
- 直接开放 mutating tools。
- 直接复制 Claude Code prompt wall 而不接 policy。
- 直接把旧 repo 当 runtime dependency。

## 7. 状态更新协议

每次推进后必须更新：

- `更新时间`
- `当前切片`
- `最近提交`
- `本地验证`
- `待 NixOS 侧确认命令`
- 对应 Step 的状态和完成条件

状态枚举：

- `planned`：已决定但未实现。
- `in_progress`：正在实现。
- `implemented_waiting_check`：已实现，等待 milestone。
- `passed`：targeted milestone 通过。
- `blocked`：存在失败或设计阻塞。
- `superseded`：被后续设计替代，必须写清原因。

## 8. 路线漂移检查

开始任何新工作前，先问四个问题：

- 这一步是否直接推进真实接入？
- 这一步是否吸收了增强 `openclaw` 的真实能力？
- 这一步是否仍保持 `OpenClawOnNixOS` 为运行时所有者？
- 这一步完成后，Observer 和 milestone 是否能证明进度？

如果任一答案是否定，就暂停，不做。

## 9. 当前判断

当前项目方向应从“接入前准备”切换为“受控吸收增强 OpenClaw 能力”。下一步不应再做新的 readiness/checklist 层，而应在当前 source content review 通过后，直接进入：

```text
SDK derived signals -> native contract tests -> native contract implementation -> first real capability absorption
```

## 10. 2026-05-13 Step 4 Update: Tool Catalog Absorption

Status: passed.

Confirmed on NixOS:
- Started: 2026-05-13 19:39:25 +08:00.
- Finished: 2026-05-13 19:39:36 +08:00.
- `openclaw-tool-catalog`: PASS, 6s.
- `observer-openclaw-tool-catalog`: PASS, 5s.
- Total: 2 passed / 0 failed.

Slice: `sense.openclaw.tool_catalog`.

Purpose: this is the first real read-only absorption of the enhanced `openclaw` workspace, using metadata from `openclaw/src/agents/tools`, `openclaw/docs/tools`, and `openclaw/src/plugin-sdk`.

Implemented artifacts:
- Core API: `GET /plugins/openclaw-tool-catalog`.
- Core summary API: `GET /plugins/openclaw-tool-catalog/summary`.
- Registry: `openclaw-tool-catalog-v0`.
- Observer panel: `OpenClaw Tool Catalog`.
- Targeted checks: `openclaw-tool-catalog`, `observer-openclaw-tool-catalog`.

Governance boundaries:
- No old `openclaw` module import.
- No old tool execution.
- No source text exposure.
- No documentation body exposure.
- No script body or dependency version exposure.
- No task or approval creation.
- Runtime owner remains `openclaw_on_nixos`.

Local verification on Windows:
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- Unix milestone scripts could not run locally because Windows shell has no `bash`.
- Equivalent Node smoke test for Core tool catalog: passed.
- Equivalent Node smoke test for Observer visibility: passed.

NixOS targeted milestone command:

```bash
cd /home/edvulcan/OpenClaw_On_NixOS && \
git pull origin main && \
OPENCLAW_MILESTONE_CHECKS=openclaw-tool-catalog,observer-openclaw-tool-catalog npm run dev:milestone-check:unix
```

Next intended slice after this passes:
- Select the first native read-only tool adapter from the catalog.
- Candidate direction: read-only workspace/file semantic inspection or tool metadata lookup.
- Do not add another readiness/checklist layer unless it directly unlocks that adapter.

## 11. 2026-05-13 Step 4 Update: Native Tool Catalog Adapter

Status: passed.

Confirmed on NixOS:
- Started: 2026-05-13 19:53:01 +08:00.
- Finished: 2026-05-13 19:53:23 +08:00.
- `openclaw-native-plugin-adapter`: PASS, 6s.
- `openclaw-native-tool-catalog-adapter`: PASS, 5s.
- `observer-openclaw-native-plugin-adapter`: PASS, 6s.
- `observer-openclaw-native-tool-catalog-adapter`: PASS, 5s.
- Total: 4 passed / 0 failed.

Slice: native adapter invocation for `sense.openclaw.tool_catalog`.

Purpose: promote the absorbed enhanced `openclaw` tool catalog from a passive metadata endpoint into a real OpenClawOnNixOS native adapter capability. This means it now follows the body-owned invocation chain: `capability -> policy -> native adapter -> audit/history -> Observer`.

Implemented artifacts:
- Core native adapter API: `GET /plugins/native-adapter/tool-catalog`.
- Capability registry entry: `sense.openclaw.tool_catalog`.
- Capability invoke support: `POST /capabilities/invoke` with `capabilityId=sense.openclaw.tool_catalog`.
- Invocation history support for `sense.openclaw.tool_catalog`.
- Observer panel: `OpenClaw Tool Catalog Adapter`.
- Targeted checks: `openclaw-native-tool-catalog-adapter`, `observer-openclaw-native-tool-catalog-adapter`.

Governance boundaries:
- Read-only metadata query only.
- No old `openclaw` module import.
- No old tool execution.
- No source text exposure.
- No documentation body exposure.
- No script body or dependency version exposure.
- No runtime activation.
- No task or approval creation.
- Invocation is audit-only and recorded in capability history.

Local verification on Windows:
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- Equivalent Node smoke test for native tool catalog adapter invocation: passed.
- Equivalent Node smoke test for Observer visibility: passed.
- Unix milestone scripts still require NixOS/bash.

NixOS targeted milestone command:

```bash
cd /home/edvulcan/OpenClaw_On_NixOS && \
git pull origin main && \
OPENCLAW_MILESTONE_CHECKS=openclaw-native-tool-catalog-adapter,observer-openclaw-native-tool-catalog-adapter npm run dev:milestone-check:unix
```

Next intended slice after this passes:
- Use the invokable tool catalog to choose and implement one native read-only semantic tool.
- Recommended candidate: a bounded workspace/file semantic inspection adapter inspired by enhanced OpenClaw tooling.
- Do not implement mutating tool execution yet.

## 12. 2026-05-13 Step 4 Update: Native Workspace Semantic Index

Status: passed.

Slice: `sense.openclaw.workspace_semantic_index`.

Purpose: implement the first native read-only semantic tool selected from the absorbed enhanced `openclaw` tool catalog. This moves beyond catalog visibility into bounded source-aware analysis owned by `OpenClawOnNixOS`: the adapter can read small OpenClaw source/docs files, derive semantic counts and categories, invoke through policy, and show the result in Observer, while still refusing to expose raw source text or execute old OpenClaw modules.

Implemented artifacts:
- Core native adapter API: `GET /plugins/native-adapter/workspace-semantic-index`.
- Capability registry entry: `sense.openclaw.workspace_semantic_index`.
- Capability invoke support: `POST /capabilities/invoke` with `capabilityId=sense.openclaw.workspace_semantic_index`.
- Invocation history support for `sense.openclaw.workspace_semantic_index`.
- Observer panel: `OpenClaw Semantic Index`.
- Targeted checks: `openclaw-native-workspace-semantic-index`, `observer-openclaw-native-workspace-semantic-index`.

Governance boundaries:
- Reads bounded file content only to derive signals.
- Does not expose raw source text.
- Does not expose documentation bodies.
- Does not expose package versions, dependency versions, or script bodies.
- Does not import or execute old `openclaw` modules.
- Does not execute old OpenClaw tools.
- Does not mutate files.
- Does not activate runtime.
- Does not create tasks or approvals.
- Invocation is audit-only and recorded in capability history.

Local verification on Windows:
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- Local PowerShell service smoke against `D:\OpenclawAndClaudecode\openclaw`: passed.
- Smoke result: `files=20`, `exports=51`, `functions=63`, `policy=audit_only`, `history=1`.
- Unix milestone scripts still require NixOS/bash.

Confirmed on NixOS:
- Started: 2026-05-13 20:28:12 +08:00.
- Finished: 2026-05-13 20:28:23 +08:00.
- `openclaw-native-workspace-semantic-index`: PASS, 6s.
- `observer-openclaw-native-workspace-semantic-index`: PASS, 5s.
- Total: 2 passed / 0 failed.

NixOS targeted milestone command:

```bash
cd /home/edvulcan/OpenClaw_On_NixOS && \
git pull origin main && \
OPENCLAW_MILESTONE_CHECKS=openclaw-native-workspace-semantic-index,observer-openclaw-native-workspace-semantic-index npm run dev:milestone-check:unix
```

Next intended slice:
- Move from read-only semantic indexing to the first governed executable native adapter.
- Recommended candidate: a read-only workspace/LSP-style navigation tool or conservative filesystem inspection tool inspired by enhanced OpenClaw.
- Do not implement mutating file edits, shell execution, or cross-boundary gateway tools until a read-only executable adapter has proven the governed execution chain.

## 13. 2026-05-13 Step 5 Update: Native Workspace Symbol Lookup

Status: passed.

Slice: `sense.openclaw.workspace_symbol_lookup`.

Purpose: implement the first governed executable native adapter after the read-only semantic index. This adapter executes a bounded local symbol query over enhanced `openclaw` workspace files and returns declaration-level navigation results. It is inspired by the enhanced OpenClaw workspace/LSP/code-navigation direction, but remains owned by `OpenClawOnNixOS` and does not import or run old OpenClaw modules.

Implemented artifacts:
- Core native adapter API: `GET /plugins/native-adapter/workspace-symbol-lookup`.
- Capability registry entry: `sense.openclaw.workspace_symbol_lookup`.
- Capability invoke support: `POST /capabilities/invoke` with `capabilityId=sense.openclaw.workspace_symbol_lookup`.
- Invocation history support for `sense.openclaw.workspace_symbol_lookup`.
- Observer panel: `OpenClaw Symbol Lookup`.
- Targeted checks: `openclaw-native-workspace-symbol-lookup`, `observer-openclaw-native-workspace-symbol-lookup`.

Governance boundaries:
- Executes only a bounded local read-only symbol query.
- Reads small source files only to extract declarations.
- Returns declaration symbols, line numbers, file paths, export flags, and sanitized declaration previews.
- Does not expose function bodies.
- Does not expose raw source files.
- Does not expose documentation bodies.
- Does not expose package versions, dependency versions, or script bodies.
- Does not import or execute old `openclaw` modules.
- Does not execute old OpenClaw tools.
- Does not mutate files.
- Does not activate runtime.
- Does not create tasks or approvals.
- Invocation is audit-only and recorded in capability history.

Local verification on Windows:
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- Local PowerShell service smoke against `D:\OpenclawAndClaudecode\openclaw`: passed.
- Smoke result: `matches=20`, `files=9`, `declarations=30`, `policy=audit_only`, `history>=1`.
- Unix milestone scripts still require NixOS/bash.

Confirmed on NixOS:
- Started: 2026-05-13 20:47:15 +08:00.
- Finished: 2026-05-13 20:47:27 +08:00.
- `openclaw-native-workspace-symbol-lookup`: PASS, 7s.
- `observer-openclaw-native-workspace-symbol-lookup`: PASS, 5s.
- Total: 2 passed / 0 failed.

NixOS targeted milestone command:

```bash
cd /home/edvulcan/OpenClaw_On_NixOS && \
git pull origin main && \
OPENCLAW_MILESTONE_CHECKS=openclaw-native-workspace-symbol-lookup,observer-openclaw-native-workspace-symbol-lookup npm run dev:milestone-check:unix
```

Next intended slice after this passes:
- Start the first approval-gated native adapter that can affect workspace state, likely a conservative file-edit proposal/apply chain.
- Keep mutation behind approval and ledgering.
- Do not jump to shell/process/web gateway execution until one bounded filesystem mutation adapter is proven.

这条线是本阶段的主线。

当前执行焦点：Step 5 `First Governed Executable Adapter` 的第一个 read-only executable adapter：`sense.openclaw.workspace_symbol_lookup` 已通过 NixOS targeted milestone。下一步进入第一个 approval-gated workspace mutation adapter，禁止再新增与真实 adapter 无关的 readiness/checklist 层。

## 14. 2026-05-13 Step 5 Update: Native Workspace Text Write

Status: passed.

Confirmed on NixOS:
- Started: 2026-05-13 21:17:41 +08:00.
- Finished: 2026-05-13 21:17:53 +08:00.
- `openclaw-native-workspace-text-write`: PASS, 6s.
- `observer-openclaw-native-workspace-text-write`: PASS, 5s.
- Total: 2 passed / 0 failed.

Slice: `act.openclaw.workspace_text_write`.

Purpose: implement the first approval-gated native adapter that can affect enhanced `openclaw` workspace state. This is the first controlled mutation slice: the native adapter creates a task and approval, then approved execution reuses the existing `act.filesystem.write_text` capability so policy, capability history, filesystem ledger, event audit, and Observer remain authoritative.

Implemented artifacts:
- Core draft API: `GET /plugins/native-adapter/workspace-text-write/draft`.
- Core task API: `POST /plugins/native-adapter/workspace-text-write-tasks`.
- Native contract capability: `act.openclaw.workspace_text_write`.
- Capability registry entry: `act.openclaw.workspace_text_write`.
- Public task plan redaction for content-like params.
- Observer panel/control: `OpenClaw Workspace Text Write`.
- Targeted checks: `openclaw-native-workspace-text-write`, `observer-openclaw-native-workspace-text-write`.

Governance boundaries:
- Does not import or execute old `openclaw` modules.
- Does not execute old OpenClaw tools.
- Does not write before explicit approval.
- Actual mutation runs through `act.filesystem.write_text`.
- Filesystem change is recorded in the filesystem ledger.
- Capability execution is recorded in capability history.
- Public task/approval/Observer responses expose content bytes and sha256, not raw content.
- Runtime owner remains `openclaw_on_nixos`.

Local verification:
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- PowerShell service smoke: passed.
- NixOS targeted milestone: passed.

NixOS targeted milestone command:

```bash
cd /home/edvulcan/OpenClaw_On_NixOS && \
git pull origin main && \
OPENCLAW_MILESTONE_CHECKS=openclaw-native-workspace-text-write,observer-openclaw-native-workspace-text-write npm run dev:milestone-check:unix
```

Next intended slice:
- Extend from whole-file text write to a conservative edit proposal/apply chain with diff preview.
- Keep all writes behind approval and filesystem ledgering.
- Do not jump to shell/process/web gateway execution until the diff-preview edit chain is proven.

## 15. 2026-05-13 Step 5 Update: Native Workspace Patch Apply

Status: passed.

Slice: `act.openclaw.workspace_patch_apply`.

Purpose: extend the first workspace mutation adapter from whole-file writes into a conservative edit proposal/apply chain. This slice reads a bounded target file, creates a small diff preview for a single `search -> replacement` edit, creates an approval-gated task, and applies only after approval through `act.filesystem.write_text`.

Implemented artifacts:
- Core draft API: `GET /plugins/native-adapter/workspace-patch-apply/draft`.
- Core task API: `POST /plugins/native-adapter/workspace-patch-apply-tasks`.
- Native contract capability: `act.openclaw.workspace_patch_apply`.
- Capability registry entry: `act.openclaw.workspace_patch_apply`.
- Bounded line diff preview format: `bounded-line-diff-v0`.
- Observer panel/control: `OpenClaw Workspace Patch Apply`.
- Targeted checks: `openclaw-native-workspace-patch-apply`, `observer-openclaw-native-workspace-patch-apply`.

Governance boundaries:
- Does not import or execute old `openclaw` modules.
- Does not execute old OpenClaw tools.
- Does not apply a patch before explicit approval.
- Actual mutation runs through `act.filesystem.write_text`.
- Filesystem change is recorded in the filesystem ledger.
- Capability execution is recorded in capability history.
- Public task/approval/Observer responses expose bounded diff preview and hashes, not full patched file content.
- Runtime owner remains `openclaw_on_nixos`.

Local verification target:
- `npm run typecheck`.
- `git diff --check`.
- PowerShell service smoke.
- NixOS targeted milestone.

NixOS targeted milestone command:

```bash
cd /home/edvulcan/OpenClaw_On_NixOS && \
git pull origin main && \
OPENCLAW_MILESTONE_CHECKS=openclaw-native-workspace-patch-apply,observer-openclaw-native-workspace-patch-apply npm run dev:milestone-check:unix
```

Next intended slice after this passes:
- Expand patch apply from one exact replacement to multi-hunk edit proposals.
- Keep all edit application behind approval and filesystem ledgering.
- Do not start shell/process/web gateway execution until multi-hunk edit proposal safety is proven or explicitly deferred.

## 16. 2026-05-13 Step 5 Update: Native Workspace Multi-Patch

Status: passed.

Slice: `act.openclaw.workspace_patch_apply` multi-hunk mode.

Purpose: extend the approved patch adapter from one exact replacement to multiple bounded exact-replacement hunks in one approval-gated task. This is the first practical bridge toward real code-edit workflows while keeping `OpenClawOnNixOS` as the runtime owner and preserving a single governed filesystem write.

Implemented artifacts:
- Core draft API now accepts `edits: [{ search, replacement, occurrence }]` via query JSON or POST body.
- Core task API now materializes multi-hunk patch tasks with one approval and one filesystem write plan.
- Multi-hunk preview format: `bounded-multi-hunk-line-diff-v0`.
- Observer patch panel now demonstrates a two-hunk edit proposal and renders hunk labels.
- Targeted checks: `openclaw-native-workspace-multi-patch`, `observer-openclaw-native-workspace-multi-patch`.

Governance boundaries:
- Does not import or execute old `openclaw` modules.
- Does not create a new write channel.
- Does not apply any hunk before explicit approval.
- All hunks collapse into one approved `act.filesystem.write_text` execution.
- Filesystem change remains recorded in the filesystem ledger.
- Capability execution remains recorded in capability history.
- Public task/approval/Observer responses expose bounded hunk previews and hashes, not full patched file content.
- Multi-hunk preview is hunk-local so unrelated content between separated hunks is not exposed by a single spanning diff.

Local verification target:
- `npm run typecheck`.
- `git diff --check`.
- Targeted milestone checks on NixOS.

NixOS targeted milestone command:

```bash
cd /home/edvulcan/OpenClaw_On_NixOS && \
git pull origin main && \
OPENCLAW_MILESTONE_CHECKS=openclaw-native-workspace-multi-patch,observer-openclaw-native-workspace-multi-patch npm run dev:milestone-check:unix
```

Next intended slice after this passes:
- Add structured patch validation around overlapping edits, missing matches, and preview limits before moving toward richer code-edit operations.
- Keep shell/process/web gateway execution deferred until edit safety is stable.

## 17. 2026-05-13 Step 5 Update: Native Workspace Patch Validation

Status: passed.

Slice: `act.openclaw.workspace_patch_apply` structured validation.

Purpose: harden the multi-hunk patch adapter before richer code-edit operations. This slice validates every hunk against the original file, rejects missing matches and overlapping original ranges, rejects previews that would be truncated or exceed total preview limits, and only then allows an approval-gated task to be created.

Implemented artifacts:
- Original-file range resolver for every patch hunk.
- Overlap rejection for hunks targeting the same or intersecting source range.
- Preview validation for truncated or oversized bounded previews.
- Top-level validation envelope on patch drafts/tasks.
- Observer visibility for structured and preview validation engines.
- Targeted checks: `openclaw-native-workspace-patch-validation`, `observer-openclaw-native-workspace-patch-validation`.

Governance boundaries:
- Does not import or execute old `openclaw` modules.
- Does not create a new write channel.
- Does not create approval tasks for invalid patch proposals.
- Valid proposals still require explicit approval before execution.
- Valid proposals still execute through `act.filesystem.write_text`.
- Public responses expose validation metadata, bounded diff previews, ranges, byte counts, and hashes, not full patched file content.

Local verification target:
- `npm run typecheck`.
- `git diff --check`.
- Targeted milestone checks on NixOS.

NixOS targeted milestone command:

```bash
cd /home/edvulcan/OpenClaw_On_NixOS && \
git pull origin main && \
OPENCLAW_MILESTONE_CHECKS=openclaw-native-workspace-patch-validation,observer-openclaw-native-workspace-patch-validation npm run dev:milestone-check:unix
```

Next intended slice after this passes:
- Move from exact text replacement toward a richer structured edit proposal format, but only within the same approval/ledger execution chain.
- Keep shell/process/web gateway execution deferred until code-edit safety is stable.

## 18. 2026-05-14 Step 5 Update: Native Workspace Structured Edit

Status: passed.

Slice: `act.openclaw.workspace_patch_apply` structured line-edit mode.

Purpose: extend the patch adapter beyond exact text search into a richer structured edit proposal shape. This slice adds `kind: "replace_lines"` hunks with explicit `startLine`/`endLine` ranges, while preserving the existing `replace_text` behavior and the same approval/ledger execution chain.

Implemented artifacts:
- Structured edit kind: `replace_lines`.
- Backward-compatible exact edit kind: `replace_text`.
- Original-file line range resolver with overlap validation shared with text hunks.
- Observer visibility for supported and observed edit kinds.
- Targeted checks: `openclaw-native-workspace-structured-edit`, `observer-openclaw-native-workspace-structured-edit`.

Governance boundaries:
- Does not import or execute old `openclaw` modules.
- Does not create a new write channel.
- Structured line edits still produce a bounded diff preview.
- Structured line edits still require explicit approval before execution.
- Structured line edits still execute through `act.filesystem.write_text`.
- Public responses expose edit kind, ranges, byte counts, hashes, and bounded previews, not full patched file content.

Local verification target:
- `npm run typecheck`.
- `git diff --check`.
- Targeted milestone checks on NixOS.

NixOS targeted milestone command:

```bash
cd /home/edvulcan/OpenClaw_On_NixOS && \
git pull origin main && \
OPENCLAW_MILESTONE_CHECKS=openclaw-native-workspace-structured-edit,observer-openclaw-native-workspace-structured-edit npm run dev:milestone-check:unix
```

Next intended slice after this passes:
- Add a higher-level edit proposal wrapper that can carry rationale, target symbol/file context, and a dry-run summary before approval.
- Keep shell/process/web gateway execution deferred until code-edit safety is stable.

## 19. 2026-05-14 Step 5 Update: Native Workspace Edit Proposal Envelope

Status: passed.

Slice: `act.openclaw.workspace_patch_apply` proposal envelope.

Purpose: add a high-level edit proposal wrapper around the existing patch adapter so future OpenClaw/Claude Code-inspired planning can carry rationale, target symbol/file context, and dry-run governance metadata before approval. This keeps the low-level patch execution chain unchanged while making proposals more inspectable and auditable.

Implemented artifacts:
- Proposal envelope registry: `openclaw-native-workspace-edit-proposal-v0`.
- Proposal metadata: title, rationale, source, target context, dry-run summary, governance summary.
- Core draft and task responses include redacted proposal metadata.
- Observer panel renders proposal envelope metadata.
- Targeted checks: `openclaw-native-workspace-edit-proposal`, `observer-openclaw-native-workspace-edit-proposal`.

Governance boundaries:
- Does not import or execute old `openclaw` modules.
- Does not create a new write channel.
- Proposal envelopes do not expose full patched content.
- Proposal envelopes do not execute before approval.
- Approved proposal tasks still execute through `act.filesystem.write_text`.
- Filesystem and capability ledgers remain authoritative.

Local verification target:
- `npm run typecheck`.
- `git diff --check`.
- Targeted milestone checks on NixOS.

NixOS targeted milestone command:

```bash
cd /home/edvulcan/OpenClaw_On_NixOS && \
git pull origin main && \
OPENCLAW_MILESTONE_CHECKS=openclaw-native-workspace-edit-proposal,observer-openclaw-native-workspace-edit-proposal npm run dev:milestone-check:unix
```

Next intended slice after this passes:
- Start deriving proposal envelopes from the enhanced `openclaw` source/tool signals instead of hand-authored request metadata.
- Keep shell/process/web gateway execution deferred until code-edit safety is stable.

## 20. 2026-05-14 Step 5 Update: Source-Derived Edit Proposal

Status: passed.

Slice: `act.openclaw.workspace_patch_apply` source-derived proposal mode.

Purpose: move proposal envelopes from hand-authored metadata toward enhanced `openclaw` source/tool signals. This slice derives proposal title/rationale/target context from the existing read-only tool catalog and semantic index, while still refusing to import, execute, or expose old OpenClaw source bodies.

Implemented artifacts:
- Source-derived proposal registry: `openclaw-source-derived-edit-proposal-v0`.
- Draft/task option: `deriveProposalFromSource=true`.
- Proposal source signal summary from tool catalog and semantic index.
- Observer visibility for source-derived proposal signals.
- Targeted checks: `openclaw-source-derived-edit-proposal`, `observer-openclaw-source-derived-edit-proposal`.

Recheck note:
- 2026-05-14 12:22 +08:00 NixOS core check passed.
- Observer check failed because the client bundle displayed source-derived registry values from runtime API data but did not contain the static `openclaw-source-derived-edit-proposal-v0` token expected by the milestone contract.
- Fix: publish the registry token in the Observer client contract and include it in the source-signal display without changing execution behavior.
- 2026-05-14 14:06 +08:00 NixOS targeted milestone passed: `openclaw-source-derived-edit-proposal`, `observer-openclaw-source-derived-edit-proposal`.

Governance boundaries:
- Does not import or execute old `openclaw` modules.
- Does not expose source file bodies or tool implementation content.
- Does not create a new write channel.
- Source-derived proposals still require approval before execution.
- Approved tasks still execute through `act.filesystem.write_text`.
- Filesystem and capability ledgers remain authoritative.

Local verification target:
- `npm run typecheck`.
- `git diff --check`.
- Targeted milestone checks on NixOS.

NixOS targeted milestone command:

```bash
cd /home/edvulcan/OpenClaw_On_NixOS && \
git pull origin main && \
OPENCLAW_MILESTONE_CHECKS=openclaw-source-derived-edit-proposal,observer-openclaw-source-derived-edit-proposal npm run dev:milestone-check:unix
```

Next intended slice after this passes:
- Connect source-derived proposals to a bounded real OpenClaw workspace target selection flow.
- Keep shell/process/web gateway execution deferred until code-edit safety is stable.

## 21. 2026-05-14 Step 5 Update: Real Workspace Edit Target Selection

Status: passed.

Slice: `sense.openclaw.workspace_edit_target_select` plus `act.openclaw.workspace_patch_apply` target-selection bridge.

Purpose: connect source-derived edit proposals to bounded real enhanced `openclaw` workspace files. This moves beyond scratch fixtures by selecting eligible target paths from the real workspace semantic index, symbol lookup, and tool catalog metadata, then feeding the selected path into the existing approval-gated patch proposal chain.

Implemented artifacts:
- Target selection registry: `openclaw-native-workspace-edit-target-selection-v0`.
- Core endpoint: `GET /plugins/native-adapter/workspace-edit-target-selection`.
- Patch draft/task option: `selectTargetFromSource=true`.
- Target selection metadata included in patch draft/task responses.
- Observer panel: `OpenClaw Edit Target Selection`.
- Targeted checks: `openclaw-workspace-edit-target-selection`, `observer-openclaw-workspace-edit-target-selection`.

Recheck note:
- 2026-05-14 15:30 +08:00 NixOS targeted milestone failed with curl exit 22 before Node assertions.
- Diagnosis: the new fixture created real tool files but omitted the minimal `packages/plugin-sdk` structure expected by the existing tool-catalog/source-derived proposal chain.
- Fix: add minimal plugin SDK fixture structure and make edit target selection tolerate missing optional tool-catalog metadata while still selecting from semantic/symbol signals.
- 2026-05-15 10:59 +08:00 NixOS targeted milestone passed: `openclaw-workspace-edit-target-selection`, `observer-openclaw-workspace-edit-target-selection`.

Governance boundaries:
- Does not import or execute old `openclaw` modules.
- Does not expose source file bodies or function bodies.
- Exposes only bounded target metadata and sanitized declaration previews.
- Does not create a task or approval by itself.
- Mutation still happens only through `act.openclaw.workspace_patch_apply` and requires explicit approval.
- Approved patch tasks still execute through `act.filesystem.write_text`.

Local verification target:
- `npm run typecheck`.
- `git diff --check`.
- Targeted milestone checks on NixOS.

NixOS targeted milestone command:

```bash
cd /home/edvulcan/OpenClaw_On_NixOS && \
git pull origin main && \
OPENCLAW_MILESTONE_CHECKS=openclaw-workspace-edit-target-selection,observer-openclaw-workspace-edit-target-selection npm run dev:milestone-check:unix
```

Next intended slice after this passes:
- Use target-selected source-derived proposals as the entry point for absorbing prompt/tool semantics into concrete edit plans.
- Keep shell/process/web gateway execution deferred until code-edit target safety is stable.

## 22. 2026-05-15 Step 5 Update: Prompt Semantics Edit Plan

Status: passed.

Slice: `sense.openclaw.prompt_pack` plus `act.openclaw.workspace_patch_apply` semantic plan enrichment.

Purpose: absorb enhanced `openclaw` prompt/tool semantics into concrete edit plans. This turns prompt/tool surfaces into redacted `editIntent`, `expectedChecks`, and `semanticPlan` metadata on source-derived patch proposals, while keeping prompt bodies, source bodies, old module imports, and old tool execution blocked.

Implemented artifacts:
- Prompt semantics registry: `openclaw-native-prompt-semantics-v0`.
- Core endpoint: `GET /plugins/native-adapter/prompt-semantics`.
- Source-derived proposal enrichment: `editIntent`, `expectedChecks`, `semanticPlan`.
- Proposal source signals now include redacted prompt semantic signals.
- Observer panel: `OpenClaw Prompt Semantics`.
- Observer patch panel shows `Edit Intent` and `Expected Checks`.
- Targeted checks: `openclaw-prompt-semantics-edit-plan`, `observer-openclaw-prompt-semantics-edit-plan`.

Recheck note:
- 2026-05-15 12:01 +08:00 NixOS targeted milestone passed: `openclaw-prompt-semantics-edit-plan`, `observer-openclaw-prompt-semantics-edit-plan`.

Governance boundaries:
- Does not import or execute old `openclaw` modules.
- Does not expose prompt bodies, source file bodies, or function bodies.
- Reads bounded prompt/tool files only to derive counts, vocabulary flags, and check names.
- Does not create a task or approval by itself.
- Mutation remains only through `act.openclaw.workspace_patch_apply` with explicit approval.
- Approved patch tasks still execute through `act.filesystem.write_text`.

Local verification target:
- `npm run typecheck`.
- `git diff --check`.
- Targeted milestone checks on NixOS.

NixOS targeted milestone command:

```bash
cd /home/edvulcan/OpenClaw_On_NixOS && \
git pull origin main && \
OPENCLAW_MILESTONE_CHECKS=openclaw-prompt-semantics-edit-plan,observer-openclaw-prompt-semantics-edit-plan npm run dev:milestone-check:unix
```

Next intended slice after this passes:
- Use prompt/tool semantics plus target selection to produce richer structured edit proposals with named rationale/check bundles.
- Keep shell/process/web gateway execution deferred until prompt-derived edit planning is stable.

## 23. 2026-05-15 Step 6 Update: Rationale / Check / Risk Bundles

Status: passed.

Slice: structured audit bundles on source-derived OpenClaw workspace edit proposals.

Purpose: turn prompt/tool semantics plus target selection into auditable proposal bundles before approval. This enriches the existing approval-gated patch proposal with named rationale, required/recommended checks, and risk notes, without creating a new mutation path or executing legacy `openclaw` modules.

Implemented artifacts:
- Bundle registry: `openclaw-rationale-check-bundle-v0`.
- Proposal enrichment: `rationaleBundle`, `checkBundle`, `riskNotes`.
- Rationale bundle carries sanitized source signal counts and target context only.
- Check bundle separates required checks, recommended follow-up checks, and actions blocked until approval.
- Risk notes restate approval and redaction boundaries for source-derived edits.
- Observer patch panel shows `Rationale Bundle`, `Check Bundle`, and `Risk Notes`.
- Targeted checks: `openclaw-rationale-check-bundle`, `observer-openclaw-rationale-check-bundle`.

Recheck note:
- 2026-05-15 12:25 +08:00 NixOS targeted milestone passed: `openclaw-rationale-check-bundle`, `observer-openclaw-rationale-check-bundle`.

Governance boundaries:
- Does not import or execute old `openclaw` modules.
- Does not expose prompt bodies, source file bodies, function bodies, search text, or replacement text through proposal metadata.
- Does not create a task or approval by itself.
- Mutation remains only through `act.openclaw.workspace_patch_apply` with explicit approval.
- Approved patch tasks still execute through `act.filesystem.write_text`.

Local verification target:
- `npm run typecheck`.
- `git diff --check`.
- Targeted milestone checks on NixOS.

NixOS targeted milestone command:

```bash
cd /home/edvulcan/OpenClaw_On_NixOS && \
git pull origin main && \
OPENCLAW_MILESTONE_CHECKS=openclaw-rationale-check-bundle,observer-openclaw-rationale-check-bundle npm run dev:milestone-check:unix
```

Next intended slice after this passes:
- Start converting source-derived proposal bundles into the first governed OpenClaw-authored edit execution path, still behind explicit approval and existing filesystem ledgers.
- Defer shell/process/web gateway expansion until the edit path has passed a full targeted regression.

## 24. 2026-05-15 Step 7 Update: Source-Authored Edit Task Entrypoint

Status: passed.

Slice: first approval-gated source-authored OpenClaw edit task entrypoint.

Purpose: make enhanced `openclaw` prompt/tool semantics drive a real governed edit task path instead of only enriching previews. This adds a formal source-authored edit draft/task API that composes target selection, source-derived proposals, rationale/check/risk bundles, and the existing patch approval task chain.

Implemented artifacts:
- Source-authored edit registry: `openclaw-source-authored-edit-v0`.
- Draft API: `GET /plugins/native-adapter/source-authored-edit/draft`.
- Task API: `POST /plugins/native-adapter/source-authored-edit-tasks`.
- Source-authored task registry: `openclaw-source-authored-edit-task-v0`.
- Observer workspace patch panel now exposes source-authored edit metadata and a `Create Source-Authored Task` control.
- Targeted checks: `openclaw-source-authored-edit-task`, `observer-openclaw-source-authored-edit-task`.

Recheck note:
- 2026-05-15 12:52 +08:00 NixOS targeted milestone passed: `openclaw-source-authored-edit-task`, `observer-openclaw-source-authored-edit-task`.

Governance boundaries:
- Reuses `act.openclaw.workspace_patch_apply` and the existing approval-gated task materialization path.
- Does not import or execute old `openclaw` modules.
- Does not expose prompt bodies, source file bodies, function bodies, search text, or replacement text through public outputs.
- Cannot mutate without explicit approval.
- Approved patch tasks still execute through `act.filesystem.write_text`, preserving filesystem ledger and task history.

Local verification target:
- `npm run typecheck`.
- `git diff --check`.
- Targeted milestone checks on NixOS.

NixOS targeted milestone command:

```bash
cd /home/edvulcan/OpenClaw_On_NixOS && \
git pull origin main && \
OPENCLAW_MILESTONE_CHECKS=openclaw-source-authored-edit-task,observer-openclaw-source-authored-edit-task npm run dev:milestone-check:unix
```

Next intended slice after this passes:
- Run a focused regression over the source-authored edit chain plus prior proposal/bundle milestones.
- Then begin the next OpenClaw capability surface only if the edit path remains stable: likely read-only shell/process command proposal absorption before any execution expansion.

## 25. 2026-05-15 Step 8 Update: Source Integration Focused Regression

Status: passed.

Slice: focused regression over the first real enhanced OpenClaw edit integration chain.

Purpose: lock the source-authored edit path before expanding to additional OpenClaw capability surfaces. This regression deliberately avoids the full milestone suite and instead replays only the source integration chain that now matters for the first governed edit path.

Implemented artifacts:
- Core focused regression check: `openclaw-source-integration-regression`.
- Observer focused regression check: `observer-openclaw-source-integration-regression`.
- Core regression covers source-derived edit proposals, target selection, prompt semantics, rationale/check/risk bundles, and source-authored edit task creation.
- Observer regression covers the matching UI/API visibility and controls for the same chain.

Recheck note:
- 2026-05-15 13:12 +08:00 NixOS targeted milestone partially passed: `openclaw-source-integration-regression` passed, `observer-openclaw-source-integration-regression` failed in the first legacy Observer source-derived check.
- Diagnosis: Observer had moved its sample patch draft to the new source-authored endpoint, so the older static client visibility token `deriveProposalFromSource=true` disappeared even though the underlying source-derived draft API still worked.
- Fix: keep the source-authored endpoint as the active UI path while adding an explicit source-derived compatibility marker in the Observer patch panel output.
- 2026-05-15 13:22 +08:00 NixOS targeted milestone passed: `openclaw-source-integration-regression`, `observer-openclaw-source-integration-regression`.

Governance boundaries:
- Regression remains read-only or approval-gated; it does not approve or execute pending mutation tasks.
- Uses existing milestone fixtures and existing approval-gated task creation checks.
- Does not import or execute old `openclaw` modules.
- Does not expose prompt bodies or source bodies.

Local verification target:
- `npm run typecheck`.
- `git diff --check`.
- Targeted milestone checks on NixOS.

NixOS targeted milestone command:

```bash
cd /home/edvulcan/OpenClaw_On_NixOS && \
git pull origin main && \
OPENCLAW_MILESTONE_CHECKS=openclaw-source-integration-regression,observer-openclaw-source-integration-regression npm run dev:milestone-check:unix
```

Next intended slice after this passes:
- Begin the next OpenClaw capability surface only after this focused regression passes.
- Candidate: read-only shell/process command proposal absorption, still proposal-only before any execution expansion.

## 26. 2026-05-15 Step 9 Update: Source-Derived Command Proposals

Status: passed.

Slice: read-only shell/process command proposal absorption from enhanced `openclaw` source signals.

Purpose: start the next OpenClaw capability surface after the edit integration regression passed. This slice absorbs command/shell/process vocabulary from enhanced OpenClaw tool and prompt surfaces into command proposal metadata only. It deliberately does not create tasks, approvals, or command execution.

Implemented artifacts:
- Source command proposal registry: `openclaw-source-command-proposals-v0`.
- Core endpoint: `GET /plugins/native-adapter/source-command-proposals`.
- Existing workspace command proposals remain available at `/workspaces/command-proposals`.
- Observer panel: `OpenClaw Source Command Proposals`.
- Targeted checks: `openclaw-source-command-proposals`, `observer-openclaw-source-command-proposals`.

Recheck note:
- 2026-05-15 13:38 +08:00 NixOS targeted milestone passed: `openclaw-source-command-proposals`, `observer-openclaw-source-command-proposals`.

Governance boundaries:
- Proposal-only: `canExecute=false`, `createsTask=false`, `createsApproval=false`.
- Does not expose package script bodies, prompt bodies, source file bodies, or tool bodies.
- Does not import or execute old `openclaw` modules.
- Does not expand shell/process execution yet.
- Future execution must go through separate plan/task/approval gates.

Local verification target:
- `npm run typecheck`.
- `git diff --check`.
- Targeted milestone checks on NixOS.

NixOS targeted milestone command:

```bash
cd /home/edvulcan/OpenClaw_On_NixOS && \
git pull origin main && \
OPENCLAW_MILESTONE_CHECKS=openclaw-source-command-proposals,observer-openclaw-source-command-proposals npm run dev:milestone-check:unix
```

Next intended slice after this passes:
- Add plan-only command proposal drafts derived from `openclaw-source-command-proposals-v0`.
- Keep command task creation and execution deferred until the source-derived command plan has its own approval-gate checks.

## 27. 2026-05-15 Step 10 Update: Source-Derived Command Plan

Status: passed.

Slice: plan-only shell/process command draft from enhanced `openclaw` source command proposals.

Purpose: convert `openclaw-source-command-proposals-v0` into a governed command plan draft without creating tasks, approvals, shell execution, or process execution. This is the command-side equivalent of the earlier edit proposal enrichment step: source-derived metadata becomes an auditable plan shape, not an executable action.

Implemented artifacts:
- Source command plan registry: `openclaw-source-command-plan-draft-v0`.
- Core endpoint: `GET /plugins/native-adapter/source-command-proposals/plan`.
- Existing workspace command plan endpoint remains available at `/workspaces/command-proposals/plan`.
- Observer panel: `OpenClaw Source Command Plan`.
- Targeted checks: `openclaw-source-command-plan`, `observer-openclaw-source-command-plan`.

Recheck note:
- 2026-05-15 13:47 +08:00 NixOS targeted milestone passed: `openclaw-source-command-plan`, `observer-openclaw-source-command-plan`.

Governance boundaries:
- Plan-only: `canExecute=false`, `createsTask=false`, `createsApproval=false`.
- Preserves explicit approval requirement for future execution.
- Does not expose package script bodies, prompt bodies, source file bodies, or tool bodies.
- Does not import or execute old `openclaw` modules.
- Does not expand shell/process execution yet.

Local verification target:
- `npm run typecheck`.
- `git diff --check`.
- Targeted milestone checks on NixOS.

NixOS targeted milestone command:

```bash
cd /home/edvulcan/OpenClaw_On_NixOS && \
git pull origin main && \
OPENCLAW_MILESTONE_CHECKS=openclaw-source-command-plan,observer-openclaw-source-command-plan npm run dev:milestone-check:unix
```

Next intended slice after this passes:
- Add approval-gated source command task materialization only after confirming the plan-only boundary.
- Keep actual command execution deferred behind the existing command approval chain.

## 28. 2026-05-15 Step 11 Update: Source-Derived Command Task

Status: passed.

Slice: approval-gated task materialization for enhanced `openclaw` source-derived shell/process command proposals.

Purpose: move the command capability surface from inert source-derived command plans into the governed task queue, without approving or executing the command. This is the command-side equivalent of the earlier source-authored edit task entrypoint: enhanced `openclaw` source semantics can now request a native OpenClawOnNixOS task, but policy still forces explicit user approval before any shell/process execution.

Implemented artifacts:
- Source command task registry: `openclaw-source-command-task-v0`.
- Core endpoint: `POST /plugins/native-adapter/source-command-proposals/tasks`.
- Source command task wrapper delegates to existing `workspace-command-task-v0` task materialization.
- Observer source command plan panel now exposes `Create Source Command Approval Task`.
- Targeted checks: `openclaw-source-command-task`, `observer-openclaw-source-command-task`.

Recheck note:
- 2026-05-15 14:00 +08:00 NixOS targeted milestone passed: `openclaw-source-command-task`, `observer-openclaw-source-command-task`.

Governance boundaries:
- Creates a queued task and pending approval only.
- Does not approve the task.
- Does not execute shell/process commands.
- Does not add a new command execution path; execution remains delegated to `workspace-command-task-v0`.
- Does not expose package script bodies, prompt bodies, source file bodies, or old tool bodies.
- Operator must block on `policy_requires_approval` until a user approves.
- Command transcript ledger must remain unchanged before approval.

Local verification target:
- `npm run typecheck`.
- `git diff --check`.
- Targeted milestone checks on NixOS.

NixOS targeted milestone command:

```bash
cd /home/edvulcan/OpenClaw_On_NixOS && \
git pull origin main && \
OPENCLAW_MILESTONE_CHECKS=openclaw-source-command-task,observer-openclaw-source-command-task npm run dev:milestone-check:unix
```

Next intended slice after this passes:
- Add approved execution for source-derived commands by reusing the existing workspace command approval/execution chain.
- Keep denial/recovery/hardening as follow-up slices only after the first approved source command execution is proven.

## 29. 2026-05-15 Step 12 Update: Source-Derived Command Approved Execution

Status: passed.

Slice: approved execution for enhanced `openclaw` source-derived shell/process command tasks.

Purpose: prove that the source-derived command task created in Step 28 can execute only after explicit approval, while preserving the existing native command execution chain. This does not introduce a new shell/process runner; it tags the source-derived task with redacted provenance and then reuses `workspace-command-task-v0`, `act.system.command.execute`, command transcripts, capability history, and audit events.

Implemented artifacts:
- Source command task provenance persisted on the task as `sourceCommand`.
- Command transcript records include source command provenance for executed source-derived command tasks.
- Targeted checks: `openclaw-source-command-execute`, `observer-openclaw-source-command-execute`.
- Observer execution verification uses the existing approval, operator, command ledger, and capability history controls.

Recheck note:
- 2026-05-15 14:07 +08:00 NixOS targeted milestone passed: `openclaw-source-command-execute`, `observer-openclaw-source-command-execute`.

Governance boundaries:
- Must block on `policy_requires_approval` before approval.
- Executes only after a user approval transitions the task policy to audited execution.
- Uses the existing allowlisted native command capability; no old `openclaw` command runner is imported or executed.
- Command transcript ledger records the execution and task source provenance.
- Does not expose package script bodies, prompt bodies, source file bodies, or old tool bodies.

Local verification target:
- `npm run typecheck`.
- `git diff --check`.
- Targeted milestone checks on NixOS.

NixOS targeted milestone command:

```bash
cd /home/edvulcan/OpenClaw_On_NixOS && \
git pull origin main && \
OPENCLAW_MILESTONE_CHECKS=openclaw-source-command-execute,observer-openclaw-source-command-execute npm run dev:milestone-check:unix
```

Next intended slice after this passes:
- Add denial/recovery coverage for source-derived command tasks.
- Then add hardening/persistence coverage only if the first execution path remains stable.

## 30. 2026-05-15 Step 13 Update: Source-Derived Command Denial Recovery

Status: passed.

Slice: denial and fresh-approval recovery for enhanced `openclaw` source-derived shell/process command tasks.

Purpose: prove that a rejected source-derived command cannot execute, remains recoverable, and can only execute after a newly materialized recovery task receives a fresh approval. This closes the basic safety loop around the source command execution path before adding persistence/hardening coverage.

Implemented artifacts:
- Recovery now preserves redacted `sourceCommand` provenance from the denied task to the recovered task.
- Targeted checks: `openclaw-source-command-denial-recovery`, `observer-openclaw-source-command-denial-recovery`.
- Observer verification uses the existing deny, recover, approve, operator, command ledger, capability history, task history, and audit visibility paths.

Recheck note:
- 2026-05-15 14:15 +08:00 NixOS targeted milestone passed: `openclaw-source-command-denial-recovery`, `observer-openclaw-source-command-denial-recovery`.

Governance boundaries:
- Denied source command tasks fail without command execution.
- Recovery does not inherit approval from the denied task.
- Recovery creates a fresh pending approval and blocks on `policy_requires_approval`.
- Only the recovered, freshly approved task may execute.
- Command transcript ledger must contain only the approved recovered execution and retain source command provenance.
- Does not expose package script bodies, prompt bodies, source file bodies, or old tool bodies.

Local verification target:
- `npm run typecheck`.
- `git diff --check`.
- Targeted milestone checks on NixOS.

NixOS targeted milestone command:

```bash
cd /home/edvulcan/OpenClaw_On_NixOS && \
git pull origin main && \
OPENCLAW_MILESTONE_CHECKS=openclaw-source-command-denial-recovery,observer-openclaw-source-command-denial-recovery npm run dev:milestone-check:unix
```

Next intended slice after this passes:
- Add command hardening for source-derived commands: duplicate approval/denial safety, duplicate recovery safety, and chained recovery.
- Then add restart persistence coverage for source command provenance and recovered command transcripts.

## 31. 2026-05-15 Step 14 Update: Source-Derived Command Hardening

Status: passed.

Slice: hardening for enhanced `openclaw` source-derived command approval and recovery chains.

Purpose: close edge cases around the approved source command execution path before persistence work. This verifies approval expiry, duplicate approval/denial clicks, duplicate recovery attempts, and multi-hop recovery chains while preserving `sourceCommand` provenance.

Implemented artifacts:
- Targeted checks: `openclaw-source-command-hardening`, `observer-openclaw-source-command-hardening`.
- Source command hardening checks cover expired approval rejection, duplicate resolution rejection, duplicate recovery rejection, and chained recovery.
- Observer hardening checks confirm the same chain is visible through existing approval, recovery, task history, command ledger, and capability history surfaces.

Recheck note:
- 2026-05-15 14:30 +08:00 NixOS targeted milestone passed: `openclaw-source-command-hardening`, `observer-openclaw-source-command-hardening`.

Governance boundaries:
- Expired source command approvals fail active tasks and reject late approve/deny.
- Duplicate approve/deny after resolution returns conflict.
- A failed source command task can create only one direct recovery task.
- Recovery chains preserve `sourceCommand` provenance on every link.
- Command transcript ledger keeps provenance for failed and successful recovered command attempts.
- Does not expose package script bodies, prompt bodies, source file bodies, or old tool bodies.

Local verification target:
- `npm run typecheck`.
- `git diff --check`.
- Targeted milestone checks on NixOS.

NixOS targeted milestone command:

```bash
cd /home/edvulcan/OpenClaw_On_NixOS && \
git pull origin main && \
OPENCLAW_MILESTONE_CHECKS=openclaw-source-command-hardening,observer-openclaw-source-command-hardening npm run dev:milestone-check:unix
```

Next intended slice after this passes:
- Add restart persistence coverage for source command provenance, recovered source-command chains, approvals, and command transcript ledgers.
- Then run a focused source-command regression across proposal -> plan -> task -> execute -> denial/recovery -> hardening.

## 32. 2026-05-15 Step 15 Update: Source-Derived Command Persistence

Status: passed.

Slice: restart persistence for enhanced `openclaw` source-derived command approval and recovery chains.

Purpose: prove that the already-integrated source command path remains trustworthy across service restarts. This is not another readiness layer; it closes the runtime durability gap for real source-derived command execution by checking pending approvals, failed tasks, recovered tasks, transcripts, and capability history after restarts.

Implemented artifacts:
- Targeted checks: `openclaw-source-command-persistence`, `observer-openclaw-source-command-persistence`.
- Source command persistence check creates a source-derived command task, approves a failing run, materializes a recovery task, restarts services before approving recovery, then verifies the recovered command after a second restart.
- Observer persistence check confirms the same persisted chain remains visible through existing source command task, approval, recovery, task detail, command ledger, and capability history surfaces.

Recheck note:
- 2026-05-15 16:01 +08:00 NixOS targeted milestone passed: `openclaw-source-command-persistence`, `observer-openclaw-source-command-persistence`.

Governance boundaries:
- Pending recovered source-command approvals survive restart but do not execute until freshly approved.
- Failed source-command tasks preserve `sourceCommand` provenance, `restorable`, and `recoveredByTaskId`.
- Recovered source-command tasks preserve `sourceCommand` provenance and `recovery.recoveredFromTaskId`.
- Command transcript ledgers preserve failed and executed source-command records across restart.
- Capability invocation history remains stable across restart.
- Does not expose package script bodies, prompt bodies, source file bodies, or old tool bodies.

Local verification target:
- `npm run typecheck`.
- `git diff --check`.
- Targeted milestone checks on NixOS.

NixOS targeted milestone command:

```bash
cd /home/edvulcan/OpenClaw_On_NixOS && \
git pull origin main && \
OPENCLAW_MILESTONE_CHECKS=openclaw-source-command-persistence,observer-openclaw-source-command-persistence npm run dev:milestone-check:unix
```

Next intended slice after this passes:
- Run a focused source-command regression across proposal -> plan -> task -> execute -> denial/recovery -> hardening -> persistence.
- If regression is stable, move to the next real enhanced OpenClaw absorption surface instead of adding more command preflight layers.

## 33. 2026-05-15 Step 16 Update: Source-Derived Command Regression

Status: passed.

Slice: focused regression for the enhanced `openclaw` source-derived command integration chain.

Purpose: lock the completed command-side absorption path together as one regression target. This prevents future work from accidentally breaking an earlier link in the chain after persistence has passed.

Implemented artifacts:
- Targeted checks: `openclaw-source-command-regression`, `observer-openclaw-source-command-regression`.
- Core regression chains proposal -> plan -> task -> approved execution -> denial/recovery -> hardening -> persistence.
- Observer regression chains the matching UI/API visibility checks for the same command path.

Governance boundaries:
- This does not introduce another capability or preflight layer.
- It only re-runs already-approved source command slices as a focused integration guard.
- Mutating/executing behavior remains approval-gated and allowlisted by the existing command capability.

Local verification target:
- `npm run typecheck`.
- `git diff --check`.
- Targeted milestone checks on NixOS.

NixOS targeted milestone command:

```bash
cd /home/edvulcan/OpenClaw_On_NixOS && \
git pull origin main && \
OPENCLAW_MILESTONE_CHECKS=openclaw-source-command-regression,observer-openclaw-source-command-regression npm run dev:milestone-check:unix
```

Next intended slice after this passes:
- Treat the source-derived command lane as stable enough for normal regression coverage.
- Move to the next real enhanced OpenClaw absorption surface rather than adding more command-readiness layers.

## 34. 2026-05-16 Step 17 Update: Plugin Manifest Map Absorption

Status: passed.

Slice: read-only native absorption of enhanced `openclaw/extensions/*/openclaw.plugin.json` manifests.

Purpose: move from command-lane completion to the next real enhanced OpenClaw absorption surface. This maps extension plugin manifests into native metadata candidates owned by `OpenClawOnNixOS`, without importing old plugin modules, exposing manifest bodies, leaking auth/config details, or activating any plugin runtime.

Implemented artifacts:
- Core API: `GET /plugins/openclaw-plugin-manifest-map`.
- Core summary API: `GET /plugins/openclaw-plugin-manifest-map/summary`.
- Native adapter API: `GET /plugins/native-adapter/plugin-manifest-map`.
- Capability registry entry: `sense.openclaw.plugin_manifest_map`.
- Capability backend support for `sense.openclaw.plugin_manifest_map`.
- Observer panel: `OpenClaw Plugin Manifest Map`.
- Targeted checks: `openclaw-plugin-manifest-map`, `observer-openclaw-plugin-manifest-map`.

Recheck note:
- 2026-05-16 17:46 +08:00 NixOS targeted milestone passed: `openclaw-plugin-manifest-map`, `observer-openclaw-plugin-manifest-map`.

Governance boundaries:
- Reads extension manifest files only to derive bounded metadata.
- Does not expose manifest bodies.
- Does not expose auth env var names.
- Does not expose endpoint host/token details.
- Does not expose config schema bodies or script bodies.
- Does not import old `openclaw` modules.
- Does not execute plugin code or activate plugin runtime.
- Does not mutate, create tasks, or create approvals.

Local verification target:
- `npm run typecheck`.
- `git diff --check`.
- Bash syntax check for the new milestone scripts.
- Targeted milestone checks on NixOS.

NixOS targeted milestone command:

```bash
cd /home/edvulcan/OpenClaw_On_NixOS && \
git pull origin main && \
OPENCLAW_MILESTONE_CHECKS=openclaw-plugin-manifest-map,observer-openclaw-plugin-manifest-map npm run dev:milestone-check:unix
```

Next intended slice after this passes:
- Use the manifest map to choose one safe plugin capability shape for a native planning/preflight path.
- Do not activate plugin runtime yet.
- Keep execution and mutation behind explicit approval/task boundaries.

## 35. 2026-05-17 Step 18 Update: Plugin Capability Plan

Status: passed.

Slice: manifest-derived native OpenClaw plugin capability planning.

Purpose: turn the absorbed `openclaw.plugin.json` manifest map into native capability candidates with explicit risk, policy domains, approval requirements, runtime-adapter gates, and blocked/not-required states. This is still plan-only: it decides what could become a native capability later, but does not register extension plugins as executable runtime modules.

Implemented artifacts:
- Native contract slot: `plan.openclaw.plugin_capability`.
- Core API: `GET /plugins/native-adapter/plugin-capability-plan`.
- Capability backend support for `plan.openclaw.plugin_capability`.
- Observer panel: `OpenClaw Plugin Capability Plan`.
- Targeted checks: `openclaw-plugin-capability-plan`, `observer-openclaw-plugin-capability-plan`.

Recheck note:
- 2026-05-17 15:11 +08:00 NixOS targeted milestone passed: `openclaw-plugin-capability-plan`, `observer-openclaw-plugin-capability-plan`.

Governance boundaries:
- Reads only manifest-derived metadata from the previous manifest map.
- Does not expose manifest bodies.
- Does not expose auth env var names, endpoint tokens, schema bodies, or script bodies.
- Does not import old `openclaw` modules.
- Does not execute plugin code or activate plugin runtime.
- Direct endpoint reads do not create tasks, approvals, or capability invocations.
- Capability invocation is audit-only and only records `plan.openclaw.plugin_capability` history.

Local verification target:
- `npm run typecheck`.
- `git diff --check`.
- Bash syntax check for the new milestone scripts.
- Targeted milestone checks on NixOS.

NixOS targeted milestone command:

```bash
cd /home/edvulcan/OpenClaw_On_NixOS && \
git pull origin main && \
OPENCLAW_MILESTONE_CHECKS=openclaw-plugin-capability-plan,observer-openclaw-plugin-capability-plan npm run dev:milestone-check:unix
```

Next intended slice after this passes:
- Select one blocked candidate category, likely `search_and_web` or `memory`, and write native adapter contract tests for that candidate.
- Do not activate runtime or execute plugin code yet.

## 36. 2026-05-17 Step 19 Update: Plugin Candidate Contract Tests

Status: passed.

Slice: native adapter contract tests for the selected enhanced OpenClaw plugin candidate category `search_and_web`.

Purpose: move from broad manifest-derived capability planning into a concrete candidate lane. This selects the blocked `search_and_web` plugin shape and turns its expected native adapter boundaries into testable contract output before any runtime adapter implementation, task materialization, plugin import, plugin execution, or runtime activation.

Implemented artifacts:
- Core API: `GET /plugins/native-adapter/plugin-candidate-contract-tests?category=search_and_web`.
- Observer panel: `OpenClaw Plugin Candidate Contract Tests`.
- Targeted checks: `openclaw-plugin-candidate-contract-tests`, `observer-openclaw-plugin-candidate-contract-tests`.

Recheck note:
- 2026-05-17 15:24 +08:00 NixOS targeted milestone passed: `openclaw-plugin-candidate-contract-tests`, `observer-openclaw-plugin-candidate-contract-tests`.

Contract expectations now checked:
- The selected candidate must come from `openclaw-plugin-capability-plan-v0`.
- The candidate must remain blocked pending native adapter implementation.
- The proposed capability must declare native contract fields, runtime owner, risk, domains, approval, and audit ledger.
- `search_and_web` must stay cross-boundary and approval-gated, even when an individual provider's derived risk is low or medium.
- Runtime adapter and native capability contract gates must remain blocked before implementation.
- Manifest-derived signals remain metadata-only.

Governance boundaries:
- Reads only manifest-derived metadata from the previous capability plan.
- Does not expose manifest bodies.
- Does not expose auth env var names, endpoint hosts/tokens, schema bodies, source files, or script bodies.
- Does not import old `openclaw` modules.
- Does not execute plugin code or activate plugin runtime.
- Direct endpoint reads do not create tasks, approvals, or capability invocations.

Local verification target:
- `npm run typecheck`.
- `git diff --check`.
- Bash syntax check for the new milestone scripts.
- Targeted milestone checks on NixOS.

NixOS targeted milestone command:

```bash
cd /home/edvulcan/OpenClaw_On_NixOS && \
git pull origin main && \
OPENCLAW_MILESTONE_CHECKS=openclaw-plugin-candidate-contract-tests,observer-openclaw-plugin-candidate-contract-tests npm run dev:milestone-check:unix
```

Next intended slice after this passes:
- Implement the selected `search_and_web` native adapter contract shell inside `OpenClawOnNixOS`.
- Keep actual command/network/plugin execution behind explicit approval-gated task materialization.
- Add runtime preflight only after this candidate contract stays green.

## 37. 2026-05-17 Step 20 Update: Search/Web Adapter Contract Shell

Status: passed.

Slice: native search/web adapter contract shell for selected enhanced OpenClaw plugin candidates.

Purpose: move from testing candidate boundaries into an OpenClawOnNixOS-owned adapter contract shape. This maps `search_and_web` candidates into native provider contracts with cross-boundary approval policy, audit binding, privacy redaction, and runtime-disabled execution boundaries before any network access, plugin import, plugin execution, task materialization, or runtime activation.

Implemented artifacts:
- Core API: `GET /plugins/native-adapter/plugin-search-web-adapter-contract`.
- Native adapter status includes `plan.openclaw.plugin_search_web_adapter_contract`.
- Observer panel: `OpenClaw Search/Web Adapter Contract`.
- Targeted checks: `openclaw-plugin-search-web-adapter-contract`, `observer-openclaw-plugin-search-web-adapter-contract`.

Recheck note:
- 2026-05-17 15:34 +08:00 NixOS targeted milestone passed: `openclaw-plugin-search-web-adapter-contract`, `observer-openclaw-plugin-search-web-adapter-contract`.

Contract expectations now checked:
- Provider contracts are derived from `openclaw-plugin-candidate-contract-tests-v0`.
- Each provider contract is owned by `openclaw_on_nixos`.
- Each provider contract remains `cross_boundary` and approval-gated.
- Each provider contract binds to `capability_history` audit.
- Network use, old module imports, plugin execution, runtime activation, task creation, and approval creation remain blocked.
- Manifest bodies, auth env var names, endpoint hosts, config schema bodies, source contents, and script bodies remain hidden.

Governance boundaries:
- Reads only manifest-derived metadata and candidate contract output.
- Does not expose manifest bodies.
- Does not expose auth env var names, endpoint hosts/tokens, schema bodies, source files, or script bodies.
- Does not perform network requests.
- Does not import old `openclaw` modules.
- Does not execute plugin code or activate plugin runtime.
- Direct endpoint reads do not create tasks, approvals, or capability invocations.

Local verification target:
- `npm run typecheck`.
- `git diff --check`.
- Bash syntax check for the new milestone scripts.
- Targeted milestone checks on NixOS.

NixOS targeted milestone command:

```bash
cd /home/edvulcan/OpenClaw_On_NixOS && \
git pull origin main && \
OPENCLAW_MILESTONE_CHECKS=openclaw-plugin-search-web-adapter-contract,observer-openclaw-plugin-search-web-adapter-contract npm run dev:milestone-check:unix
```

Next intended slice after this passes:
- Materialize search/web adapter invocation drafts as approval-gated tasks.
- Keep actual network/provider execution deferred behind explicit approval and future runtime preflight.
- Do not activate old OpenClaw plugin runtime.

## 38. 2026-05-17 Step 21 Update: Search/Web Adapter Task Materialization

Status: passed.

Slice: approval-gated native search/web adapter task materialization.

Purpose: move the native search/web adapter contract shell into the normal OpenClawOnNixOS task/approval/operator path. This creates a queued task and linked pending approval for a selected search/web provider contract while keeping query content redacted and network/provider execution deferred.

Implemented artifacts:
- Core draft API: `GET /plugins/native-adapter/plugin-search-web-adapter-task-draft`.
- Core task API: `POST /plugins/native-adapter/plugin-search-web-adapter-tasks`.
- Observer control: `Create Search/Web Approval Task`.
- Targeted checks: `openclaw-plugin-search-web-adapter-task`, `observer-openclaw-plugin-search-web-adapter-task`.

Task boundaries now checked:
- Task creation requires `confirm=true`.
- The task is queued with policy decision `require_approval`.
- A linked pending approval is created.
- Operator step blocks before approval with `policy_requires_approval`.
- Query content is represented only by length/digest and is not exposed.
- Capability invocation history remains empty.
- Network use, old module imports, plugin execution, runtime activation, mutation, and provider execution remain blocked.

Governance boundaries:
- Creates a task and approval only after explicit task materialization request.
- Does not expose query content, manifest bodies, auth env var names, endpoint hosts/tokens, schema bodies, source files, or script bodies.
- Does not perform network requests.
- Does not import old `openclaw` modules.
- Does not execute plugin code or activate plugin runtime.
- Does not invoke capabilities or providers during task creation.

Local verification target:
- `npm run typecheck`.
- `git diff --check`.
- Bash syntax check for the new milestone scripts.
- Targeted milestone checks on NixOS.

NixOS targeted milestone command:

```bash
cd /home/edvulcan/OpenClaw_On_NixOS && \
git pull origin main && \
OPENCLAW_MILESTONE_CHECKS=openclaw-plugin-search-web-adapter-task,observer-openclaw-plugin-search-web-adapter-task npm run dev:milestone-check:unix
```

Recheck note:
- 2026-05-17 15:45 +08:00 NixOS targeted milestone passed: `openclaw-plugin-search-web-adapter-task`, `observer-openclaw-plugin-search-web-adapter-task`.

## 39. 2026-05-17 Step 22 Update: Search/Web Adapter Denial Recovery

Status: passed.

Slice: denial and fresh-approval recovery for native search/web adapter tasks.

Purpose: make denied native search/web adapter tasks recoverable without inheriting approval or executing network/provider code. This keeps the user-control loop intact: denial fails the original task, recovery creates a fresh queued task and fresh pending approval, and even after approval the task remains deferred until a later runtime preflight boundary is implemented.

Implemented artifacts:
- Core recovery support for `openclaw_search_web_adapter_invocation` tasks with native adapter plans.
- Runtime-preflight deferred execution boundary for approved search/web adapter tasks.
- Targeted checks: `openclaw-plugin-search-web-adapter-denial-recovery`, `observer-openclaw-plugin-search-web-adapter-denial-recovery`.

Safety boundaries:
- Recovery does not reuse the denied approval ID.
- Recovered task policy is reevaluated and requires a fresh explicit approval.
- Approved recovered tasks do not use network, execute plugin/provider code, import old OpenClaw modules, or expose query/endpoint/auth-env details.
- Duplicate recovery for the same denied task is rejected.

Expected NixOS check:

```bash
cd /home/edvulcan/OpenClaw_On_NixOS && \
git pull origin main && \
OPENCLAW_MILESTONE_CHECKS=openclaw-plugin-search-web-adapter-denial-recovery,observer-openclaw-plugin-search-web-adapter-denial-recovery npm run dev:milestone-check:unix
```

Recheck note:
- 2026-05-17 15:59 +08:00 NixOS targeted milestone passed: `openclaw-plugin-search-web-adapter-denial-recovery`.
- 2026-05-17 16:01 +08:00 NixOS targeted milestone passed: `observer-openclaw-plugin-search-web-adapter-denial-recovery`.

## 40. 2026-05-17 Step 23 Update: Search/Web Runtime Preflight

Status: local implementation ready; awaiting NixOS targeted milestone.

Slice: runtime preflight envelope for native search/web adapter invocation.

Purpose: add an observable preflight-only envelope for the native search/web adapter before any network/provider runtime can be activated. This keeps the integration moving toward real provider capability while preserving the hard boundary: no network, no provider execution, no old OpenClaw module import, no task or approval creation at the preflight endpoint.

Implemented artifacts:
- Core API: `GET /plugins/native-adapter/plugin-search-web-adapter-runtime-preflight`.
- Observer panel: `OpenClaw Search/Web Runtime Preflight`.
- Native adapter status capability: `plan.openclaw.plugin_search_web_runtime_preflight`.
- Targeted checks: `openclaw-plugin-search-web-adapter-runtime-preflight`, `observer-openclaw-plugin-search-web-adapter-runtime-preflight`.

Preflight boundaries now checked:
- Envelope version is `openclaw-search-web-execution-envelope-v0`.
- State is `blocked_pending_network_runtime_adapter`.
- Explicit approval is required but not collected by preflight.
- Audit remains bound to `capability_history`.
- Query is represented only by length/digest and content is not exposed.
- Network, module import, plugin/provider execution, runtime activation, mutation, task creation, and approval creation remain blocked.
- Manifest bodies, endpoint hosts/tokens, auth env var names, source contents, script bodies, and package versions remain hidden.

Expected NixOS check:

```bash
cd /home/edvulcan/OpenClaw_On_NixOS && \
git pull origin main && \
OPENCLAW_MILESTONE_CHECKS=openclaw-plugin-search-web-adapter-runtime-preflight,observer-openclaw-plugin-search-web-adapter-runtime-preflight npm run dev:milestone-check:unix
```

Next intended slice after this passes:
- Add search/web runtime activation plan gates.
- Keep actual provider/network execution disabled until activation gates and approval-gated task flow are explicit.
