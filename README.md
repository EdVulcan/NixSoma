# OpenClawOnNixOS

OpenClawOnNixOS is the next-generation workspace for building OpenClaw as an AI-native control plane on top of NixOS.

The first milestone focuses on a minimal "body loop":

- persistent local control plane
- observable AI work view
- screen sensing
- screen actions
- browser runtime
- basic system sensing and healing

## Repository Layout

```text
apps/       User-facing applications such as the observer UI
services/   Background services that form the control plane
packages/   Shared types, events, clients, and utilities
nix/        NixOS modules, profiles, hosts, and helper scripts
docs/       Local design notes and implementation references
```

## First-Phase Services

- `openclaw-core`
- `openclaw-event-hub`
- `openclaw-session-manager`
- `openclaw-screen-sense`
- `openclaw-screen-act`
- `openclaw-browser-runtime`
- `openclaw-system-sense`
- `openclaw-system-heal`
- `observer-ui`

## Status

The repository now includes the first runnable service pair:

1. `openclaw-event-hub`
2. `openclaw-core`

## Quick Start

Bring the full local control plane up with ordered startup and health checks:

```bash
npm run dev:up
```

On Linux / NixOS:

```bash
npm run dev:up:unix
```

The Unix launcher keeps health checks on `127.0.0.1`, but it now binds the services to `0.0.0.0` so the observer UI and backend ports can be reached from the host machine through the VM IP as well.

- Inside the VM, use `http://127.0.0.1:<port>`
- From the host machine, use `http://<vm-ip>:<port>`

Verify the current health matrix:

```bash
npm run dev:check
```

On Linux / NixOS:

```bash
npm run dev:check:unix
```

Run a reproducible state-settling check for `warming_up -> ready -> degraded`:

```bash
npm run dev:state-check
```

On Linux / NixOS:

```bash
npm run dev:state-check:unix
```

Run a reproducible external command capture check:

```bash
npm run dev:command-capture-check
```

On Linux / NixOS:

```bash
npm run dev:command-capture-check:unix
```

Run the current mainline milestone suite on Linux / NixOS:

```bash
npm run dev:milestone-check:unix
```

Run the NixOS body-config slice directly:

```bash
npm run dev:milestone-check:unix -- body-config
```

To run only a subset:

```bash
OPENCLAW_MILESTONE_CHECKS=body-config,planner,operator-loop,operator-control,policy,approval,capability,capability-planner,event-audit,system-capability npm run dev:milestone-check:unix
```

Run the policy governance slice directly:

```bash
npm run dev:milestone-check:unix -- policy
```

This verifies body-internal actions, ordinary user tasks, cross-boundary approval gates, denial boundaries, audit history, and the operator execution gate.

Run the sovereign body policy slice directly:

```bash
npm run dev:milestone-check:unix -- sovereign-body-policy
```

This verifies `OPENCLAW_AUTONOMY_MODE=sovereign_body`, where body-internal high-risk capability actions run autonomously with audit while cross-boundary and absolute-deny policies remain gated.

Run the sovereign command execution slice directly:

```bash
npm run dev:milestone-check:unix -- sovereign-command-execute
```

This verifies `act.system.command.execute` can run allowlisted body-internal commands in `sovereign_body` mode with cwd limits, timeout/output capture, audit history, and no shell.

Run the sovereign command chain slice directly:

```bash
npm run dev:milestone-check:unix -- sovereign-command-chain
```

This verifies multi-step body-internal command execution preserves a command transcript across task outcome, execution response, capability history, and audit events.

Run the sovereign command branch slice directly:

```bash
npm run dev:milestone-check:unix -- sovereign-command-branch
```

This verifies command steps can branch on previous transcript output/exit code, executing matching steps and preserving skipped steps in the task transcript.

Run the sovereign command recovery slice directly:

```bash
npm run dev:milestone-check:unix -- sovereign-command-recovery
```

This verifies non-zero command exits are persisted in transcripts, can drive explicit recovery branches with `onFailure: "continue"`, and fail the task by default when no recovery policy is declared.

Run the sovereign command ledger slice directly:

```bash
npm run dev:milestone-check:unix -- sovereign-command-ledger
```

This verifies `/commands/transcripts` and `/commands/transcripts/summary` expose recovered, failed, executed, and skipped command transcript entries and survive core restart recovery.

Run the sovereign filesystem write slice directly:

```bash
npm run dev:milestone-check:unix -- sovereign-filesystem-write
```

This verifies `act.filesystem.write_text` can autonomously write bounded UTF-8 text inside allowed body roots in `sovereign_body` mode while rejecting paths outside those roots.

Run the sovereign filesystem workspace slice directly:

```bash
npm run dev:milestone-check:unix -- sovereign-filesystem-workspace
```

This verifies `act.filesystem.mkdir`, `act.filesystem.write_text`, and filesystem metadata can form an autonomous workspace creation chain inside allowed body roots.

Run the sovereign filesystem append slice directly:

```bash
npm run dev:milestone-check:unix -- sovereign-filesystem-append
```

This verifies `act.filesystem.append_text` can autonomously append bounded UTF-8 text to existing files inside allowed body roots, record append metadata in the filesystem change ledger, and reject paths outside those roots.

Run the sovereign filesystem ledger slice directly:

```bash
npm run dev:milestone-check:unix -- sovereign-filesystem-ledger
```

This verifies `/filesystem/changes` and `/filesystem/changes/summary` expose mkdir/write changes and survive core restart recovery.

Run the sovereign filesystem read-text slice directly:

```bash
npm run dev:milestone-check:unix -- sovereign-filesystem-read-text
```

This verifies `sense.filesystem.read` can read bounded UTF-8 text through governed body sense after autonomous mkdir/write chains while rejecting paths outside allowed roots.

Run the sovereign filesystem read ledger slice directly:

```bash
npm run dev:milestone-check:unix -- sovereign-filesystem-read-ledger
```

This verifies `/filesystem/reads` and `/filesystem/reads/summary` expose metadata/list/search/read-text access records without leaking file content and survive core restart recovery.

Run the observer command transcript slice directly:

```bash
npm run dev:milestone-check:unix -- observer-command-transcript
```

This verifies Observer surfaces sovereign command transcripts, including executed, failed, recovered, and skipped command steps.

Run the observer command ledger slice directly:

```bash
npm run dev:milestone-check:unix -- observer-command-ledger
```

This verifies Observer surfaces the cross-task command transcript ledger summary and recent command records.

Run the observer filesystem ledger slice directly:

```bash
npm run dev:milestone-check:unix -- observer-filesystem-ledger
```

This verifies Observer surfaces the cross-task filesystem change ledger summary and recent mkdir/write records.

Run the observer filesystem read ledger slice directly:

```bash
npm run dev:milestone-check:unix -- observer-filesystem-read-ledger
```

This verifies Observer surfaces the filesystem read access ledger summary and recent metadata/list/search/read-text records without displaying file content.

Run the observer OpenClaw workspace detection slice directly:

```bash
npm run dev:milestone-check:unix -- observer-workspace-detect
```

This verifies Observer surfaces the read-only OpenClaw workspace registry, including package metadata, scripts, markers, shallow directories, and governance flags without exposing file contents or enabling mutation/execution.

Run the observer OpenClaw workspace command proposal slice directly:

```bash
npm run dev:milestone-check:unix -- observer-workspace-command-proposals
```

This verifies Observer surfaces proposal-only workspace command shapes, risks, and governance flags without exposing script bodies or enabling execution.

Run the observer OpenClaw source migration map slice directly:

```bash
npm run dev:milestone-check:unix -- observer-openclaw-source-migration-map
```

This verifies Observer surfaces the read-only source migration candidate map, including target areas, migration kinds, risks, priorities, and governance flags without exposing source file contents, mutating files, or executing source workspace commands.

Run the observer OpenClaw source migration plan slice directly:

```bash
npm run dev:milestone-check:unix -- observer-openclaw-source-migration-plan
```

This verifies Observer surfaces the plan-only first-wave migration draft, including first-wave items, backlog counts, acceptance criteria, blockers, risks, priorities, and governance flags without exposing source file contents, creating tasks or approvals, mutating files, or executing source workspace commands.

Run the observer OpenClaw plugin SDK contract review slice directly:

```bash
npm run dev:milestone-check:unix -- observer-openclaw-plugin-sdk-contract-review
```

This verifies Observer surfaces the read-only plugin SDK contract review, including manifest shape, exports, types, script names, contract surfaces, review blockers, and governance flags without exposing SDK source contents, script bodies, README text, dependency versions, creating tasks or approvals, mutating files, or executing source workspace commands.

Run the observer OpenClaw workspace command plan slice directly:

```bash
npm run dev:milestone-check:unix -- observer-workspace-command-plan
```

This verifies Observer surfaces the plan-only execution draft for the default workspace command proposal, including command shape, approval gate, and inert governance flags without creating tasks or approvals.

Run the observer OpenClaw workspace command task slice directly:

```bash
npm run dev:milestone-check:unix -- observer-workspace-command-task
```

This verifies Observer can create an approval-gated workspace command task from the default proposal while preserving the explicit approval gate and avoiding command execution before approval.

Run the observer OpenClaw workspace command execute slice directly:

```bash
npm run dev:milestone-check:unix -- observer-workspace-command-execute
```

This verifies Observer exposes the controls and live refresh hooks needed to approve, run, and inspect an allowlisted workspace command execution through task detail, command transcript, command ledger, capability history, and audit events.

Run the observer OpenClaw workspace command failure slice directly:

```bash
npm run dev:milestone-check:unix -- observer-workspace-command-failure
```

This verifies Observer exposes failed workspace command execution through task failure state, command transcript failures, command ledger failures, capability history, and audit events after explicit approval.

Run the observer OpenClaw workspace command denial slice directly:

```bash
npm run dev:milestone-check:unix -- observer-workspace-command-denial
```

This verifies Observer exposes the controls, approval inbox state, task failure state, command ledger emptiness, capability history emptiness, and audit events for denied workspace command approvals.

Run the observer OpenClaw workspace command denial recovery slice directly:

```bash
npm run dev:milestone-check:unix -- observer-workspace-command-denial-recovery
```

This verifies Observer exposes recovery controls and task detail for denied workspace commands while preserving the fresh approval gate before the recovered command can execute.

Run the observer OpenClaw workspace command recovery slice directly:

```bash
npm run dev:milestone-check:unix -- observer-workspace-command-recovery
```

This verifies Observer exposes controls and refresh hooks for recovering a failed workspace command, while preserving the fresh approval gate before the recovered command can execute.

Run the observer OpenClaw workspace command recovery persistence slice directly:

```bash
npm run dev:milestone-check:unix -- observer-workspace-command-recovery-persistence
```

This verifies Observer recovery controls and task detail views remain valid across restarts while recovered workspace command chains preserve pending approval, command transcript ledger, and capability history.

Run the approval inbox slice directly:

```bash
npm run dev:milestone-check:unix -- approval
```

This verifies pending approval creation, operator blocking, user approve/deny decisions, audited continuation after approval, denial failure handling, Observer visibility, and approval audit events.

Run the body capability registry slice directly:

```bash
npm run dev:milestone-check:unix -- capability
```

This verifies the body capability inventory, service-backed health status, risk/governance metadata, cross-boundary approval boundaries, Observer visibility, and capability refresh events.

Run the capability-aware planner slice directly:

```bash
npm run dev:milestone-check:unix -- capability-planner
```

This verifies planner steps are annotated with body capability IDs, risk, governance, approval requirements, and registry-backed mappings for browser, filesystem, process, and conservative command dry-run plans.

Run the policy-governed capability invocation slice directly:

```bash
npm run dev:milestone-check:unix -- capability-invoke
```

This verifies core-routed body capability invocation for system vitals, filesystem search/list, process listing, and approval-gated command dry-run without executing system commands.

Run the persistent capability history slice directly:

```bash
npm run dev:milestone-check:unix -- capability-history
```

This verifies capability invocation records, blocked/invoked summaries, audit events, and restart recovery for core-held body capability history.

Run the capability operator execution slice directly:

```bash
npm run dev:milestone-check:unix -- capability-operator
```

This verifies system-task plans are executed by the operator through governed capability invocation for process listing and approved command dry-run.

Run the capability approval operator slice directly:

```bash
npm run dev:milestone-check:unix -- capability-approval-operator
```

This verifies high-risk system capability plans wait for user approval, continue after approval through dry-run-only command invocation, and fail cleanly after denial.

Run the Observer capability-plan visibility slice directly:

```bash
npm run dev:milestone-check:unix -- observer-capability-plan
```

This verifies Observer exposes planner, capability count, approval-gate count, and per-step capability/risk/governance metadata for capability-aware plans.

Run the Observer capability invocation controls slice directly:

```bash
npm run dev:milestone-check:unix -- observer-capability-invoke
```

This verifies Observer exposes capability invocation controls and result visibility for audited vitals/process calls, blocked command dry-run, and approved dry-run.

Run the Observer capability history slice directly:

```bash
npm run dev:milestone-check:unix -- observer-capability-history
```

This verifies Observer exposes persistent capability invocation history, invoked/blocked totals, latest timestamp, and restart-restored history entries.

Run the conservative system capability slice directly:

```bash
npm run dev:milestone-check:unix -- system-capability
```

This verifies allowed-root filesystem sensing, filename search, process listing, command dry-run risk classification, capability registry exposure, and audit events without executing system commands.

Run the durable event audit ledger slice directly:

```bash
npm run dev:milestone-check:unix -- event-audit
```

This verifies JSONL event persistence, filtered audit queries, audit summaries, Observer visibility, and restart recovery for the control-plane black box.

Run the body vitals slice directly:

```bash
npm run dev:milestone-check:unix -- system-sense
```

This verifies host/body identity, uptime, CPU/memory/disk vitals, service latency, network summary, and structured alerts.

Run the conservative self-heal slice directly:

```bash
npm run dev:milestone-check:unix -- system-heal
```

This verifies diagnosis, repair-plan generation, simulated restart actions, observe-only handling for high-risk resource alerts, and heal history.

Run the OpenClaw workspace detection slice directly:

```bash
npm run dev:milestone-check:unix -- openclaw-workspace-detect
```

This verifies core can build a read-only profile for configured OpenClaw workspaces, including package metadata, scripts, workspace globs, markers, and governance flags, without reading file contents, mutating files, or executing commands.

Run the OpenClaw workspace command proposal slice directly:

```bash
npm run dev:milestone-check:unix -- openclaw-workspace-command-proposals
```

This verifies core can derive proposal-only `pnpm run <script>` command shapes from detected OpenClaw workspace scripts without exposing script bodies or executing commands.

Run the OpenClaw source migration map slice directly:

```bash
npm run dev:milestone-check:unix -- openclaw-source-migration-map
```

This verifies core can turn a profiled OpenClaw source workspace into read-only migration candidates for extension catalogs, SDKs, UI patterns, core source patterns, docs, skills, and verification assets without reading file contents, mutating files, or executing source workspace commands.

Run the OpenClaw source migration plan slice directly:

```bash
npm run dev:milestone-check:unix -- openclaw-source-migration-plan
```

This verifies core can turn read-only migration candidates into a plan-only first-wave migration draft, including recommended next steps, acceptance criteria, blockers, and backlog items without creating tasks, approvals, imports, source reads, mutations, or executions.

Run the OpenClaw plugin SDK contract review slice directly:

```bash
npm run dev:milestone-check:unix -- openclaw-plugin-sdk-contract-review
```

This verifies core can turn the first-wave `plugin_sdk` migration plan item into a read-only contract review draft using only package manifest metadata and SDK directory markers, without exposing source contents, script bodies, dependency versions, README text, mutations, executions, tasks, or approvals.

Run the OpenClaw workspace command plan slice directly:

```bash
npm run dev:milestone-check:unix -- openclaw-workspace-command-plan
```

This verifies core can render a plan-only execution draft for a selected workspace command proposal, including command shape and explicit approval governance, without creating tasks, approvals, or command executions.

Run the OpenClaw workspace command task slice directly:

```bash
npm run dev:milestone-check:unix -- openclaw-workspace-command-task
```

This verifies core can materialize a selected workspace command proposal into a queued task with a pending approval, while the operator remains blocked and no command transcript is created before approval.

Run the OpenClaw workspace command execute slice directly:

```bash
npm run dev:milestone-check:unix -- openclaw-workspace-command-execute
```

This verifies core can execute an allowlisted workspace command only after explicit approval, using the configured workspace root and command allowlist, with command transcripts, capability history, and audit events.

Run the OpenClaw workspace command failure slice directly:

```bash
npm run dev:milestone-check:unix -- openclaw-workspace-command-failure
```

This verifies an approved workspace command with a non-zero exit code fails the task, preserves stderr and exit code in the command transcript ledger, records capability history, clears pending approvals, and emits failure audit events.

Run the OpenClaw workspace command denial slice directly:

```bash
npm run dev:milestone-check:unix -- openclaw-workspace-command-denial
```

This verifies denying a workspace command approval fails the queued task without executing the command, creating command transcripts, or invoking the command capability.

Run the OpenClaw workspace command denial recovery slice directly:

```bash
npm run dev:milestone-check:unix -- openclaw-workspace-command-denial-recovery
```

This verifies a denied workspace command can only recover into a fresh approval-gated task, does not execute during recovery, and executes only after the new approval.

Run the OpenClaw workspace command recovery slice directly:

```bash
npm run dev:milestone-check:unix -- openclaw-workspace-command-recovery
```

This verifies a failed workspace command is recoverable as a fresh queued system task with the original command plan, a new explicit approval gate, preserved recovery links, and separate failed/successful command transcripts.

Run the OpenClaw workspace command recovery persistence slice directly:

```bash
npm run dev:milestone-check:unix -- openclaw-workspace-command-recovery-persistence
```

This verifies recovered workspace command chains survive core restarts before approval and after completion, including pending approval restoration, recovery links, command transcript ledger, and capability invocation history.

Stop everything that `dev:up` started:

```bash
npm run dev:down
```

On Linux / NixOS:

```bash
npm run dev:down:unix
```

If you still want to run services manually, the startup order is:

1. `services/openclaw-event-hub`
2. `services/openclaw-core`
3. `services/openclaw-session-manager`
4. `services/openclaw-browser-runtime`
5. `services/openclaw-screen-sense`
6. `services/openclaw-screen-act`
7. `services/openclaw-system-sense`
8. `services/openclaw-system-heal`
9. `apps/observer-ui`

Check health:

```bash
curl http://127.0.0.1:4101/health
curl http://127.0.0.1:4100/health
curl http://127.0.0.1:4102/health
curl http://127.0.0.1:4103/health
curl http://127.0.0.1:4104/health
curl http://127.0.0.1:4105/health
curl http://127.0.0.1:4106/health
curl http://127.0.0.1:4107/health
curl http://127.0.0.1:4170/health
```

Create a task:

```bash
curl -X POST http://127.0.0.1:4100/tasks \
  -H "content-type: application/json" \
  -d "{\"goal\":\"Open the browser work view\",\"type\":\"browser_task\"}"
```

Open the AI browser runtime:

```bash
curl -X POST http://127.0.0.1:4103/browser/open \
  -H "content-type: application/json" \
  -d "{\"url\":\"https://example.com\"}"
```

Refresh placeholder screen state:

```bash
curl -X POST http://127.0.0.1:4104/screen/refresh
```

Inspect the current screen capture provider:

```bash
curl http://127.0.0.1:4104/screen/provider
```

Simulate a screen click:

```bash
curl -X POST http://127.0.0.1:4105/act/mouse/click \
  -H "content-type: application/json" \
  -d "{\"x\":640,\"y\":360,\"button\":\"left\"}"
```

Refresh aggregated system state:

```bash
curl -X POST http://127.0.0.1:4106/system/refresh
```

Simulate a heal action:

```bash
curl -X POST http://127.0.0.1:4107/heal/restart-service \
  -H "content-type: application/json" \
  -d "{\"service\":\"openclaw-browser-runtime\"}"
```

## Screen Capture Adapter Shell

`openclaw-screen-sense` now supports a first capture-adapter shell:

- `OPENCLAW_SCREEN_CAPTURE_MODE=browser`
  uses `openclaw-browser-runtime /browser/capture`
- `OPENCLAW_SCREEN_CAPTURE_MODE=command`
  runs an external command and expects JSON screen payload

Windows-friendly option:

- `OPENCLAW_SCREEN_CAPTURE_POWERSHELL_FILE`
  runs `powershell.exe -ExecutionPolicy Bypass -File <script>`
- `OPENCLAW_SCREEN_CAPTURE_NODE_FILE`
  runs `node <script>`

The external command contract is:

```json
{
  "source": "command",
  "snapshotPath": "D:/captures/frame.txt",
  "snapshotText": "captured text",
  "focusedWindow": { "title": "App", "pid": 1234 },
  "windowList": [{ "title": "App", "pid": 1234 }],
  "ocrBlocks": [{ "text": "captured text", "confidence": 0.95 }]
}
```

Example adapter script:

```powershell
powershell.exe -ExecutionPolicy Bypass -File .\nix\scripts\example-screen-capture.ps1
```

File-backed example adapter:

```powershell
node .\nix\scripts\file-screen-capture.mjs
```

Example environment for command mode:

```powershell
$env:OPENCLAW_SCREEN_CAPTURE_MODE="command"
$env:OPENCLAW_SCREEN_CAPTURE_NODE_FILE="$PWD\\nix\\scripts\\file-screen-capture.mjs"
```

The file-backed example reads these environment variables:

- `OPENCLAW_CAPTURE_SNAPSHOT_TEXT_FILE`
- `OPENCLAW_CAPTURE_OCR_TEXT_FILE`
- `OPENCLAW_CAPTURE_WINDOW_TITLE`
- `OPENCLAW_CAPTURE_WINDOW_PID`
- `OPENCLAW_CAPTURE_SNAPSHOT_PATH`

## Migration Reality

Development can continue on Windows with relatively low migration cost, but not
literally zero cost.

What should migrate cleanly:

- control-plane services
- HTTP contracts
- readiness / degraded semantics
- capture adapter contract

What will still change on NixOS/Linux:

- startup scripts
- filesystem paths
- desktop capture commands
- OCR tooling
- window enumeration tooling

That is why the current architecture keeps platform-specific capture logic in
external adapters. The intended Linux starting point is:

```bash
./nix/scripts/linux-screen-capture.sh
```

## Linux Capture Strategy

There are now two separate Linux capture tracks:

1. Mainline track: AI work view capture
2. Experimental track: whole-desktop GNOME/Wayland capture

The current recommendation for NixOS is:

- treat browser/runtime-backed capture as the stable path
- treat external file/command capture as the stable extension point
- treat whole-desktop GNOME/Wayland capture as experimental

This is based on real NixOS VM validation:

- `dev:up:unix` works
- `dev:check:unix` works
- `dev:state-check:unix` works
- `body-config` milestone covers the first NixOS body module and systemd skeleton
- `dev:command-capture-check:unix` works
- `dev:milestone-check:unix` is the preferred mainline regression suite
- `operator-control` milestone covers operator dry-run, pause gating, and resume
- `policy` milestone covers the first policy governance and cross-boundary gate
- `sovereign-body-policy` milestone covers body-internal autonomy under `OPENCLAW_AUTONOMY_MODE=sovereign_body`
- `sovereign-command-execute` milestone covers allowlisted body-internal command execution under sovereign body autonomy
- `sovereign-command-chain` milestone covers multi-step command execution transcripts under sovereign body autonomy
- `sovereign-command-branch` milestone covers branching command execution from previous transcript results
- `sovereign-command-recovery` milestone covers non-zero command exit recovery and default command task failure
- `sovereign-command-ledger` milestone covers queryable command transcript ledger and restart recovery
- `sovereign-filesystem-write` milestone covers bounded autonomous filesystem text writes under sovereign body autonomy
- `sovereign-filesystem-workspace` milestone covers autonomous directory creation, file write, and metadata verification chains
- `sovereign-filesystem-ledger` milestone covers queryable filesystem change ledger and restart recovery
- `observer-command-transcript` milestone covers Observer visibility for sovereign command transcripts
- `observer-command-ledger` milestone covers Observer visibility for the cross-task command transcript ledger
- `observer-filesystem-ledger` milestone covers Observer visibility for the cross-task filesystem change ledger
- `observer-filesystem-read-ledger` milestone covers Observer visibility for the cross-task filesystem read access ledger
- `observer-workspace-detect` milestone covers Observer visibility for read-only OpenClaw workspace detection
- `observer-openclaw-source-migration-map` milestone covers Observer visibility for read-only OpenClaw source migration candidates
- `observer-openclaw-source-migration-plan` milestone covers Observer visibility for plan-only OpenClaw source migration drafts
- `observer-openclaw-plugin-sdk-contract-review` milestone covers Observer visibility for read-only OpenClaw plugin SDK contract reviews
- `observer-workspace-command-proposals` milestone covers Observer visibility for OpenClaw workspace command proposals
- `observer-workspace-command-plan` milestone covers Observer visibility for OpenClaw workspace command plan drafts
- `observer-workspace-command-task` milestone covers Observer controls for approval-gated OpenClaw workspace command tasks
- `observer-workspace-command-execute` milestone covers Observer controls and visibility for approved OpenClaw workspace command execution
- `observer-workspace-command-failure` milestone covers Observer visibility for failed OpenClaw workspace command execution
- `observer-workspace-command-denial` milestone covers Observer visibility for denied OpenClaw workspace command approvals
- `observer-workspace-command-denial-recovery` milestone covers Observer visibility for recovered denied OpenClaw workspace commands
- `observer-workspace-command-recovery` milestone covers Observer controls and visibility for recovered OpenClaw workspace commands
- `observer-workspace-command-recovery-persistence` milestone covers Observer visibility for recovered OpenClaw workspace command chains across restarts
- `capability-planner` milestone covers capability-aware plan metadata and approval-gated body capabilities
- `capability-invoke` milestone covers policy-governed capability invocation through core
- `capability-history` milestone covers persistent capability invocation history and restart recovery
- `capability-operator` milestone covers operator execution through governed capability invocation
- `capability-approval-operator` milestone covers operator approval waiting before high-risk capability execution
- `observer-capability-plan` milestone covers Observer visibility for body capability decisions inside plans
- `observer-capability-invoke` milestone covers Observer controls for policy-governed capability invocation
- `observer-capability-history` milestone covers Observer visibility for persistent capability invocation history
- `system-sense` milestone covers real body vitals and service health telemetry
- `system-heal` milestone covers conservative diagnosis, autofix, and heal history
- `openclaw-source-migration-map` milestone covers read-only migration candidate maps for profiled OpenClaw source capabilities
- `openclaw-source-migration-plan` milestone covers plan-only first-wave migration drafts for OpenClaw source capabilities
- `openclaw-plugin-sdk-contract-review` milestone covers read-only plugin SDK contract review drafts derived from first-wave migration plans
- `openclaw-workspace-command-proposals` milestone covers proposal-only command shapes for detected OpenClaw workspaces
- `openclaw-workspace-command-plan` milestone covers plan-only execution drafts for selected OpenClaw workspace commands
- `openclaw-workspace-command-task` milestone covers approval-gated task materialization for selected OpenClaw workspace commands
- `openclaw-workspace-command-execute` milestone covers approved execution of allowlisted OpenClaw workspace commands
- `openclaw-workspace-command-failure` milestone covers failure capture for approved OpenClaw workspace commands
- `openclaw-workspace-command-denial` milestone covers denial safety for approval-gated OpenClaw workspace commands
- `openclaw-workspace-command-denial-recovery` milestone covers recovery of denied OpenClaw workspace commands behind a fresh approval gate
- `openclaw-workspace-command-recovery` milestone covers recovery of failed OpenClaw workspace commands behind a fresh approval gate
- `openclaw-workspace-command-recovery-persistence` milestone covers restart persistence for recovered OpenClaw workspace command chains
- direct GNOME/Wayland whole-desktop capture remains inconsistent across:
  - `org.gnome.Shell.Screenshot`
  - `grim`
  - `gnome-screenshot`
  - `xdg-desktop-portal Screenshot`

So the current Linux collector should be understood as an experiment shell, not
the core product path.

The experimental Linux collector currently tries tools in this order:

- screenshots:
  - `xdg-desktop-portal Screenshot` via `gdbus monitor` + `gdbus call`
  - `org.gnome.Shell.Screenshot` via `gdbus`
  - `grim`
  - `gnome-screenshot`
  - `import`
- focused window / window list:
  - `gdbus` with `org.gnome.Shell`
  - `xdotool`
  - `wmctrl`
- OCR:
  - `tesseract`

See:

- [docs/DESKTOP_CAPTURE_CONTRACT_V1.md](D:/OpenclawAndClaudecode/OpenClawOnNixOS/docs/DESKTOP_CAPTURE_CONTRACT_V1.md)
- [docs/AI_WORK_VIEW_CAPTURE_STRATEGY.md](D:/OpenclawAndClaudecode/OpenClawOnNixOS/docs/AI_WORK_VIEW_CAPTURE_STRATEGY.md)
- [docs/architecture/OPENCLAW_SYSTEM_IDENTITY_UPGRADE_PATH.md](D:/OpenclawAndClaudecode/OpenClawOnNixOS/docs/architecture/OPENCLAW_SYSTEM_IDENTITY_UPGRADE_PATH.md)
