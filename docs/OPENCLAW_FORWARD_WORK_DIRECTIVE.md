# OpenClaw Forward Work Directive

Updated: 2026-07-10

This is the active guidance document for continuing OpenClaw development after
the Phase 136 checkpoint and the discovery that the locally optimized
`openclaw` source has not yet been preserved on GitHub or migrated into
`OpenClawOnNixOS`.

Use this document as the first stop for new agents. Historical phase plans and
milestone checks remain valuable evidence, but they must not be treated as an
automatic instruction to continue with Phase 137.

## Current Diagnosis

The project has not fundamentally drifted from the whitepaper:

- The NixOS body has a service skeleton and resident control plane.
- The AI work-view route exists through session, browser, screen-sense, and
  screen-act services.
- Body health, conservative self-heal, systemd repair, evidence ledgers, and
  Observer visibility exist.
- Memory, cloud-consciousness, provider-call, and result-envelope routes have
  strong governance evidence.
- The core and Observer have been decoupled significantly since the earlier
  giant-file phase.

The risk is local drift:

- Phase 59 through Phase 136 became too dominated by nested cloud-provider,
  credential, local-read, result-envelope, approved-deferred, and readiness
  gates.
- Some of those gates are valid sovereignty boundaries, but continuing that
  pattern mechanically would create more shell/checklist work than product
  capability.
- The locally enhanced `openclaw` source contains real Claude Code-grade
  engineering improvements that are not yet stored in GitHub and not yet
  integrated as native OpenClaw body capabilities.

## Governing Vision

The controlling architecture documents are:

```text
docs/architecture/OPENCLAW_SYSTEM_IDENTITY_UPGRADE_PATH.md
docs/architecture/KERNEL_LEVEL_EVOLUTION_WHITEPAPER.md
docs/plans/OPENCLAW_ENHANCED_SOURCE_MIGRATION_BRIEF.md
```

The identity route is:

```text
stable user-space control plane
-> trusted session/work-view component
-> controlled system-level body daemon
-> graphics-stack-native AI workspace
-> later kernel-level body nerves
```

Do not root-ify the whole system. Do not try to take over the full user desktop
as the main route. First make OpenClaw stable, observable, useful, and capable
inside its own body and work-view.

## Immediate Stop Rule

Do not continue with another generic cloud/provider/credential phase unless it
unlocks an actual live capability that has been explicitly selected after this
directive.

In particular, do not create a Phase 137 that only adds another:

```text
route
task shell
approved-deferred record
final-readiness preflight
readback wrapper
observer mirror
```

Those patterns are allowed only when they are the smallest necessary slice for a
new product capability.

## First Required Work: Use Preserved Enhanced Source

The optimized Windows-host `openclaw` source is now preserved on GitHub as a
source reference for migration.

```text
repository: https://github.com/EdVulcan/openclaw-enhanced-source
branch: main
commit: d90b253b0c03191613e45c36b1434078b8788bed
```

This repository is a reference source, not a dependency to wholesale import.

Original Windows source working tree:

```text
D:\OpenclawAndClaudecode\openclaw
```

Observed important source material:

```text
extensions/cc-tools/
src/agents/pi-embedded-runner/microcompact.ts
src/agents/pi-embedded-runner/run/attempt.ts
src/agents/pi-tools.ts
src/agents/system-prompt.ts
src/plugins/runtime/runtime-registry-loader.ts
src/plugins/runtime/runtime-registry-loader.test.ts
src/auto-reply/reply/commands-plugins.ts
src/auto-reply/reply/commands-plugins.test.ts
src/auto-reply/reply/commands-plugins.install.test.ts
extensions/acpx/src/codex-auth-bridge.ts
extensions/acpx/src/runtime-persistence.test.ts
ui/index.html
ui/src/styles/
HEARTBEAT.md
SOUL.md
TOOLS.md
gateway-architecture.html
```

Do not preserve accidental local state unless the human explicitly asks:

```text
.openclaw/workspace-state.json
help.txt
temp_test.txt
```

Preferred VM inspection command:

```bash
rm -rf /tmp/openclaw-enhanced-source
git clone https://github.com/EdVulcan/openclaw-enhanced-source.git /tmp/openclaw-enhanced-source
cd /tmp/openclaw-enhanced-source
git checkout d90b253b0c03191613e45c36b1434078b8788bed
```

Preservation note:

```text
The first push preserved the full enhanced-source branch history from the local
openclaw checkout. GitHub reported one large historical cache file warning:
.serena/cache/typescript/document_symbols.pkl is 83.22 MB. Do not treat that
cache file as migration material.
```

The next step is not more preservation. The next step is the gap audit.

## Second Required Work: Enhanced Source Gap Audit

After the enhanced source is preserved, perform a source-integration gap audit.
The audit must classify every enhanced capability as one of:

```text
absorbed
partially absorbed
not absorbed
should not migrate
requires source transfer
```

Minimum capability list:

```text
cc_read / precise file read
cc_edit / surgical string replacement
cc_write / controlled new-file or overwrite path
cc_glob and cc_grep / fast codebase navigation
cc_lsp / definition, references, hover
cc_verify / verification loop and command evidence
cc_plan_enter, cc_plan_exit, cc_todo_write / planning state
microcompact / in-memory old tool-result compaction
live plugin runtime refresh
ACPX/Codex bridge compatibility and persistence tests
engineering prompt semantics
operator-facing UI refinements
identity notes: HEARTBEAT, SOUL, TOOLS
```

The audit output should become a new document:

```text
docs/plans/OPENCLAW_ENHANCED_SOURCE_GAP_AUDIT.md
```

## Third Required Work: Select Real Capability Slices

After the audit, the recommended trunk is:

```text
Native governed engineering tool surface
```

The first slices should move in this order:

1. Read-only tool inventory and contract mapping.
2. Native governed read/search surface.
3. Surgical edit proposal with diff preview, not raw write.
4. Verification command evidence attached to task completion.
5. Observer visibility and recovery evidence.
6. Microcompact as context-management evidence, not hidden transcript mutation.
7. Live plugin runtime refresh as a governed lifecycle action.
8. Planning/todo evidence as visible task/workbench state, not hidden mode.
9. LSP availability, lifecycle evidence, governed process probes, lifecycle
   state, and initialize/shutdown handshake before any source-content transfer
   or symbol request.

Only after these are proven should the project continue deeper cloud-provider
execution work.

## Current Evidence-Based Frontier

The Level 1 native engineering route now has bounded read/search, proposal,
approval-gated edit/write, ledger, verification, recovery, LSP selected-target,
planning workbench, governed suggested-action creation, and compact linked task
readback. Do not reopen completed LSP symbol-request slices or add another
standalone engineering evidence/readiness shell without a concrete operator gap.

The next autonomous product route is the smallest real Level 2 trusted AI
work-view/session-helper behavior. Keep helper installation, root/system daemon
work, desktop-wide capture, provider egress, and arbitrary endpoint execution
deferred until their runtime owner and authority boundary are explicit.

The first Level 2 runtime slice is now active: session-manager owns an in-process
AI work-view helper lease and browser-runtime must echo the same session/lease
before the helper contract reports `active`. Continue by carrying that lease
through existing browser action mediation; do not replace it with another
readiness endpoint.

That action-mediation follow-up is complete for browser input and click:
screen-act derives the current trusted lease, browser-runtime rejects missing or
mismatched leases before mutation, and Observer shows the mediation result.
Operator takeover now suspends the same lease in session-manager and
browser-runtime; explicit resume rotates and rebinds a new lease before actions
continue. The existing approved sidecar lifecycle now starts and stops one
bounded independent user-session process whose current-user socket heartbeat
backs lease readiness. Unexpected exit and heartbeat timeout fail closed by
suspending browser action authority; the same approved lifecycle action
explicitly reconnects a survivor or starts a replacement and rebinds a new
lease, with no automatic restart or reconnect. The Level 2
sidecar now continuously refreshes a bounded browser observation over an
allowlisted loopback-only source, with single-flight polling, sequence, and
fresh/stale state but no retained full payload. Screen-act now requires a fresh
same-session sidecar observation alongside the helper lease after sidecar
lifecycle activation. Bounded browser input/click now travels through the
sidecar socket, rechecks capture/session, and returns through screen-act audit.
Session-manager restart persists only compact lifecycle intent; the sidecar
survives but clears its authority binding and capture, while the new manager
revokes the stale browser lease before listening and reports
`recovery_required`. The existing approved task explicitly reconnects the same
PID under a fresh session lease. Browser-runtime restart recovery is also complete: an
unavailable browser capture source becomes
`recovery_required`, screen-act blocks before dispatch, Observer recommends the
existing prepare action, and a fresh bounded capture restores sidecar IPC
without restarting the helper. A bounded browser navigation/new-tab action is
now complete on the same trusted sidecar transport, with HTTP(S) URL validation,
lease/capture gates, sidecar IPC, browser mutation, refreshed capture, audit,
and an Observer control. Its core planner/task-executor bridge is also complete:
planner and executor use
one production action descriptor, task evidence retains the bounded sidecar
effect, and verification prefers the post-action capture URL over stale session
metadata. The next slice should make an in-flight browser task recover across a
capture-source interruption using the existing recovery loop. That bounded
action-level recovery is now complete: only sidecar capture reasons trigger one
prepare and one retry, and compact interruption/retry evidence is attached to
the task. Active-task continuity across session-manager restart is now complete:
authority dependency loss becomes a persisted recoverable task, explicit
session/sidecar restoration reuses the existing recovery route, and only
unfinished browser plan actions execute through the trusted sidecar. The next
continuity gap is startup reconciliation for a persisted active task after the
core process itself restarts. That exit gate is now complete: startup converts
only persisted running browser plans to recoverable evidence, preserves queued
and paused tasks, and the existing recovery path executes only unfinished work
through the still-running sidecar. The next Level 2 capability should establish
independently supervised user-session sidecar ownership with fail-closed
authority disconnect and explicit fresh-lease reconnect. Do not add horizontal
navigation variants, a readiness-only chain, fault-injection endpoints,
automatic action restart, root/system daemon ownership, or desktop-wide capture.

That independent sidecar slice is now complete. The current-user socket process
survives session-manager restart, clears binding/capture on disconnect, retains
no reconnect lease, and requires the existing approved action to bind a fresh
session. The milestone proves same-PID reconnect and stale-lease rejection. The
next Level 2 reliability gap is explicit replacement after the sidecar process
itself exits unexpectedly; it must reuse the existing lifecycle and must not
auto-start a replacement.

That replacement gap is now complete. Unexpected sidecar exit suspends action
authority, reports recovery without automatic replacement, and the existing
approved lifecycle starts a different PID before capture/actions resume. The
remaining Level 2 runtime-ownership step is a declarative, non-auto-started
`systemd --user` unit path for this same sidecar contract. Do not turn it into a
root service, login auto-start, or a second lifecycle API.

The unit contract is now materialized and evaluated through the existing Nix
body-config milestone: desktop-body defines a hardened
`openclaw-trusted-sidecar@` user unit with no `wantedBy` and `Restart=no`. This
does not yet change runtime ownership. The next real slice is to make the
existing approved lifecycle action launch/stop that fixed user-unit instance,
while retaining direct spawn only as an explicit development fallback and
keeping lease/session values out of the environment file.

That approved launcher bridge is now complete. The session-manager runtime
default uses the fixed `openclaw-trusted-sidecar@primary.service` user unit,
while development must explicitly select the direct-spawn fallback. The
existing lifecycle owns
the mode-0600 environment file, systemd start/stop, deterministic socket bind,
Observer launcher readback, and cleanup. Session, lease, credential, provider,
and browser-runtime URL values never enter the file. The real Phase 3 milestone
materializes the test unit, controls it through `systemctl --user`, proves
restart/replacement/action continuity, and removes both unit and environment
afterward.

This proves user-session ownership, not every Nix deployment topology. The
current Nix body skeleton still launches its main services as system services;
moving session-manager itself into a selected login-user manager, or adding a
separately governed cross-manager bridge, remains deferred. Do not hardcode a
desktop UID or add a root proxy merely to hide that deployment boundary.

The next real Level 2 behavior is bounded browser workspace continuity across a
browser-runtime restart. Preserve only compact AI-owned tab/active-URL/session
intent; restore it fail-closed without a lease or automatic action replay, and
reuse the existing prepare/rebind/recovery and Observer surfaces.

That workspace-continuity behavior is now complete. Browser runtime atomically
persists a bounded, mode-0600 navigation intent and restores tabs/session intent
without running state, PID, lease, input/click data, capture payload, or action
replay. Existing prepare supplies fresh authority, the sidecar reports recovery
status, and the real Phase 3 milestone proves eight tabs survive a process
restart before governed actions continue.

The next product gap is no longer continuity metadata. Browser runtime remains
a simulated in-memory browser with a synthetic PID. The next real Level 2 slice
should put a proven local browser engine behind the current bounded API and
sidecar contract, starting with one user-space profile, one governed HTTP(S)
navigation, and compact real-engine capture. Do not add a readiness endpoint or
broaden into desktop capture.

That real-engine slice is complete. Browser runtime can now launch a
NixOS-managed Firefox through `puppeteer-core`, expose its real PID/title/URL/tab
state, execute existing lease-gated page input/click/new-tab operations, feed
real page metadata through capture and screen-sense, and remove its ephemeral
AI profile on disconnect/shutdown. The targeted milestone uses a loopback page
and the production prepare/lease path; no hidden browser download, external
fixture, root launch, desktop capture, or `--no-sandbox` bypass is involved.

The remaining Level 2 deployment gap is component ownership: the Nix body
skeleton still defines session-manager and browser-runtime as system services,
so its desktop profile cannot truthfully default to the real user browser. Move
those two components into the selected login user's manager alongside the
sidecar without creating duplicate instances or hardcoding a UID. Until then,
real engine mode remains explicit and simulated mode remains the default Nix
fallback.

## Identity-Upgrade Alignment

Every new capability must state which identity level it serves:

```text
Level 1: user-space control plane
Level 2: trusted session/work-view component
Level 3: controlled system-level body daemon
Level 4: graphics-stack-native AI workspace
```

The enhanced `openclaw` migration currently belongs mostly to Level 1. Some
future work-view manager and session helper work belongs to Level 2. Host repair
and controlled privileged actions belong to Level 3. Nested compositor and AI
session work belongs to Level 4.

Do not jump identity levels to make a milestone pass.

## Phase Plan Cleanup Policy

Historical phase plan files under `docs/plans/OPENCLAW_PHASE_*_PLAN.md` are not
the active roadmap. Many are still referenced by milestone checks and must remain
in place until the checks are refactored.

Use them as:

```text
evidence
test fixtures
historical implementation records
```

Do not use them as:

```text
automatic next-phase instructions
the current product roadmap
permission to continue nested safety shells
```

The active routing documents are listed in `docs/README.md` and
`docs/plans/README.md`.

## Definition Of Real Progress

A development slice counts as real progress only if it answers:

```text
What user-visible or operator-visible capability became more real?
Which whitepaper or identity-upgrade goal does it serve?
What evidence proves it?
What remains deliberately deferred?
What is the next smallest real capability step?
```

If a slice cannot answer those questions, it is likely a checklist shell and
should be stopped or merged into a more meaningful slice.

## VM Agent Startup Checklist

Use this exact startup order on the VM:

```bash
cd /home/edvulcan/OpenClaw_On_NixOS
git pull origin main
git status --short
git log -10 --oneline
sed -n '1,260p' docs/OPENCLAW_FORWARD_WORK_DIRECTIVE.md
sed -n '1,220p' docs/README.md
sed -n '1,260p' docs/plans/OPENCLAW_ENHANCED_SOURCE_MIGRATION_BRIEF.md
sed -n '1,260p' docs/architecture/OPENCLAW_SYSTEM_IDENTITY_UPGRADE_PATH.md
```

Then report:

```text
1. Did the VM clone and checkout the preserved source reference?
2. Does the checked-out commit match `d90b253b0c03191613e45c36b1434078b8788bed`?
3. Which enhanced capabilities are already absorbed?
4. Which enhanced capabilities require migration?
5. Which active trunk is selected next, and why is it real capability progress
   instead of another safety wrapper?
```
