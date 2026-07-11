# OpenClaw Plans Directory

Updated: 2026-07-11

This directory contains both active route documents and historical milestone
evidence. Do not infer the next development task from the highest numbered phase
file.

## Active Route Documents

Read these first:

```text
../OPENCLAW_FORWARD_WORK_DIRECTIVE.md
OPENCLAW_ENHANCED_SOURCE_MIGRATION_BRIEF.md
OPENCLAW_ENHANCED_SOURCE_GAP_AUDIT.md
OPENCLAW_NATIVE_ENGINEERING_TOOL_SURFACE_PLAN.md
OPENCLAW_NATIVE_ENGINEERING_READ_SEARCH_PLAN.md
OPENCLAW_NATIVE_ENGINEERING_EDIT_PROPOSAL_PLAN.md
OPENCLAW_NATIVE_ENGINEERING_EDIT_APPROVAL_BRIDGE_PLAN.md
OPENCLAW_NATIVE_ENGINEERING_EDIT_CLOSED_LOOP_PLAN.md
OPENCLAW_NATIVE_ENGINEERING_LOOP_OPERATOR_CONTROLS_PLAN.md
OPENCLAW_NATIVE_ENGINEERING_LOOP_PARAMETERIZED_INPUTS_PLAN.md
OPENCLAW_NATIVE_ENGINEERING_LOOP_STATE_GUIDANCE_PLAN.md
OPENCLAW_NATIVE_ENGINEERING_LOOP_COMPLETION_READBACK_PLAN.md
OPENCLAW_NATIVE_ENGINEERING_LOOP_RECOVERY_ACTION_DRAFT_PLAN.md
OPENCLAW_NATIVE_ENGINEERING_LOOP_RECOVERY_RERUN_READBACK_PLAN.md
OPENCLAW_NATIVE_ENGINEERING_PROMPT_WORK_STANDARDS_PLAN.md
OPENCLAW_NATIVE_ENGINEERING_LOOP_WORK_STANDARDS_BRIDGE_PLAN.md
OPENCLAW_NATIVE_ENGINEERING_WRITE_PROPOSAL_PLAN.md
OPENCLAW_NATIVE_ENGINEERING_WRITE_APPROVAL_BRIDGE_PLAN.md
OPENCLAW_NATIVE_ENGINEERING_WRITE_EXECUTION_EVIDENCE_PLAN.md
OPENCLAW_NATIVE_ENGINEERING_WRITE_CLOSED_LOOP_PLAN.md
OPENCLAW_NATIVE_ENGINEERING_VERIFICATION_EVIDENCE_PLAN.md
OPENCLAW_NATIVE_ENGINEERING_VERIFICATION_WORK_STANDARDS_COVERAGE_PLAN.md
OPENCLAW_NATIVE_ENGINEERING_RECOVERY_EVIDENCE_PLAN.md
OPENCLAW_NATIVE_ENGINEERING_RECOVERY_WORK_STANDARDS_COVERAGE_PLAN.md
OPENCLAW_NATIVE_ENGINEERING_MICROCOMPACT_EVIDENCE_PLAN.md
OPENCLAW_NATIVE_PLUGIN_RUNTIME_REFRESH_EVIDENCE_PLAN.md
OPENCLAW_NATIVE_PLUGIN_RUNTIME_REFRESH_TASK_PLAN.md
OPENCLAW_NATIVE_ACPX_CODEX_BRIDGE_COMPATIBILITY_PLAN.md
OPENCLAW_NATIVE_ENGINEERING_PLAN_TODO_EVIDENCE_PLAN.md
OPENCLAW_NATIVE_ENGINEERING_LSP_EVIDENCE_PLAN.md
OPENCLAW_NATIVE_ENGINEERING_LSP_LIFECYCLE_READINESS_DRAFT_PLAN.md
OPENCLAW_NATIVE_ENGINEERING_LSP_SUPERVISED_LIFECYCLE_PILOT_PLAN.md
OPENCLAW_NATIVE_ENGINEERING_LSP_LIFECYCLE_STATE_PLAN.md
OPENCLAW_NATIVE_ENGINEERING_LSP_HANDSHAKE_PLAN.md
OPENCLAW_NATIVE_ENGINEERING_LSP_SOURCE_TRANSFER_PROPOSAL_PLAN.md
OPENCLAW_NATIVE_ENGINEERING_LSP_SOURCE_TRANSFER_TASK_PLAN.md
OPENCLAW_NATIVE_ENGINEERING_LSP_SYMBOL_REQUEST_PROPOSAL_PLAN.md
OPENCLAW_NATIVE_ENGINEERING_LSP_SYMBOL_REQUEST_TASK_PLAN.md
OPENCLAW_NATIVE_ENGINEERING_LSP_OBSERVER_SYMBOL_REQUEST_CONTROL_PLAN.md
OPENCLAW_NATIVE_ENGINEERING_LSP_SYMBOL_RESPONSE_SUMMARY_PLAN.md
OPENCLAW_NATIVE_ENGINEERING_LSP_VARIANT_REQUESTS_PLAN.md
OPENCLAW_NATIVE_ENGINEERING_LSP_RESPONSE_TARGET_SELECTION_PLAN.md
OPENCLAW_NATIVE_ENGINEERING_LSP_SELECTED_TARGET_READ_BRIDGE_PLAN.md
OPENCLAW_NATIVE_ENGINEERING_LSP_OBSERVER_SELECTED_TARGET_READ_CONTROL_PLAN.md
OPENCLAW_NATIVE_ENGINEERING_LSP_SELECTED_TARGET_EDIT_PROPOSAL_SEED_PLAN.md
OPENCLAW_NATIVE_ENGINEERING_LSP_OBSERVER_SELECTED_TARGET_EDIT_SEED_CONTROL_PLAN.md
OPENCLAW_NATIVE_ENGINEERING_LSP_SELECTED_TARGET_EDIT_CLOSED_LOOP_PLAN.md
OPENCLAW_NATIVE_ENGINEERING_LSP_SELECTED_TARGET_VERIFICATION_HANDOFF_PLAN.md
OPENCLAW_NATIVE_ENGINEERING_LSP_SELECTED_TARGET_RECOVERY_RECOMMENDATION_HANDOFF_PLAN.md
OPENCLAW_NATIVE_ENGINEERING_LSP_SELECTED_TARGET_RECOVERED_VERIFICATION_RERUN_PLAN.md
OPENCLAW_NATIVE_ENGINEERING_PLANNING_WORKBENCH_STATE_BRIDGE_PLAN.md
OPENCLAW_NATIVE_ENGINEERING_WORKBENCH_STATE_RESTORATION_PLAN.md
OPENCLAW_NATIVE_ENGINEERING_WORKBENCH_STATE_AUTO_RESTORE_PLAN.md
OPENCLAW_TRUSTED_WORK_VIEW_SESSION_CONTRACT_PLAN.md
OPENCLAW_NIX_STORE_RUNTIME_PACKAGING_PLAN.md
OPENCLAW_DBUS_NATIVE_SYSTEMD_CONTROL_PLAN.md
../architecture/OPENCLAW_SYSTEM_IDENTITY_UPGRADE_PATH.md
../architecture/KERNEL_LEVEL_EVOLUTION_WHITEPAPER.md
```

Use these as supporting documents:

```text
OPENCLAW_MONOLITH_REDUCTION_PLAN.md
OPENCLAW_EXPERT_REVIEW_OPTIMIZATION_PLAN.md
OPENCLAW_SOURCE_INTEGRATION_STAGE_PLAN.md
```

## Current Route Correction

The current route is no longer "continue to the next numbered cloud-provider
phase." The corrected route is:

```text
preserve enhanced openclaw source on GitHub
-> perform enhanced source gap audit
-> migrate governed engineering tool capabilities into OpenClawOnNixOS
-> return to identity-upgrade work-view/session-helper/hostd route
```

Current native engineering plan/todo storage and suggested-action Observer
bridge evidence is documented in:

```text
OPENCLAW_NATIVE_ENGINEERING_PLAN_TODO_WORKBENCH_STORAGE_PLAN.md
```

That lane now preserves compact persisted-workbench provenance through existing
edit/write/verification task readback. The Level 1 engineering loop should not
grow another evidence/readiness shell; continue with the smallest real Level 2
trusted work-view/session-helper capability.

The active Level 2 bridge is documented in:

```text
OPENCLAW_TRUSTED_WORK_VIEW_SESSION_CONTRACT_PLAN.md
```

The bounded Level 2 browser eye-hand exit gate and kernel-whitepaper Phase A are
complete. The active Phase B route is documented alongside the Phase A record:

```text
OPENCLAW_NIX_STORE_RUNTIME_PACKAGING_PLAN.md
OPENCLAW_DBUS_NATIVE_SYSTEMD_CONTROL_PLAN.md
```

Kernel-whitepaper Phase A is complete: all nine services and the trusted
sidecar template run from reviewed read-only Nix closures with real targeted
behavior evidence. Phase B's first slice is also complete: system-sense now
reads all fixed OpenClaw unit inventory through native systemd D-Bus, fails
closed without a `systemctl` fallback, and preserves the existing Observer
contract. The fixed system-sense restart and exact Polkit rule are now
implemented behind the existing approved next-repair lifecycle, but the running
VM generation has not loaded them yet. Switched-VM mutation/recovery proof and
removal of the host's historical sudo helper remain the completion gate.

It now closes browser action mediation through operator takeover suspension and
explicit resume/rebind, then runs a bounded approval-gated user-space helper
heartbeat process under the existing sidecar lifecycle. Fail-closed recovery
across session-manager restart now persists compact intent, revokes the old
browser lease, avoids automatic child resurrection, and reuses the approved
task for explicit restart. Browser-runtime restart continuity now blocks actions
on capture-source loss, recommends prepare through the existing Observer path,
and recovers capture plus sidecar IPC without restarting the helper. The next
real slice is bounded browser navigation/new-tab through the same trusted
transport. That operator-facing action is now complete with bounded URL
validation, lease/capture gates, real tab mutation, refreshed capture, and an
Observer control. Its core planner/task-executor bridge is complete with shared
production descriptors, compact sidecar
effect evidence, and post-action capture verification. The next real slice is
in-flight browser task recovery across capture-source interruption. That
bounded recovery now performs one prepare and one retry only for sidecar capture
reasons and records compact action evidence. Active-task continuity across
session-manager restart now persists recoverable authority-interruption
evidence, explicitly restores the session and approved sidecar, and executes
only unfinished steps from the preserved browser plan. Active-task startup
reconciliation across core process restart is also complete: persisted running
browser plans become recoverable evidence while queued/paused tasks are
preserved, and recovery executes pending work through the still-running sidecar.
The next real Level 2 slice is independently supervised user-session sidecar
ownership with fail-closed disconnect and explicit fresh-lease reconnect. Do
not add a readiness milestone, automatic action restart, root/system daemon,
fault-injection endpoint, or desktop-wide capture.

That slice is complete: the bounded current-user socket sidecar survives
session-manager restart without retaining action authority, and the existing
approved lifecycle action reconnects the same PID only after a fresh work-view
session exists. The next real reliability slice is explicit approved
replacement after the sidecar process itself exits; no automatic replacement,
new panel, or readiness chain is needed.

That replacement slice is complete: unexpected PID exit suspends action
authority and the existing approved lifecycle starts a different PID before
capture/actions resume. The remaining Level 2 ownership slice is a declarative,
non-auto-started `systemd --user` unit path for the same sidecar process. It must
reuse the current approval/socket/recovery contracts and must not create a root
service or parallel lifecycle API.

The non-auto-started user-unit contract is now present in the desktop-body Nix
profile and proven through the existing `body-config` milestone. Runtime still
uses direct spawn. The next slice is the approval-preserving launcher bridge to
that fixed template instance, including explicit stop and existing Observer
readback; it is not another unit/readiness document.

That launcher bridge is complete: approved lifecycle start/stop now controls
the fixed `systemd --user` instance, binds authority over the existing socket,
keeps lease/session/provider values out of its bounded environment file, and
projects launcher ownership through the existing Observer panel. Direct spawn
is an explicit development fallback. The next slice is bounded AI-owned browser
workspace continuity across browser-runtime restart, not a Level 2 readiness
wrapper.

Bounded browser workspace continuity is now complete through the same Phase 3
lane: compact tabs/session intent survives browser-runtime restart without
restoring lease or actions, and explicit prepare rebinds fresh authority. The
next real slice is a local real-browser-engine adapter behind the existing
browser API and sidecar, replacing the synthetic PID/in-memory capture model.

The real browser-engine adapter and declarative login-user ownership are now
complete. The desktop profile emits session-manager and browser-runtime only as
graphical-session user units, uses per-user state/profile paths, and defaults to
the fixed NixOS Firefox without a root browser, hardcoded UID, or duplicate
system units. The next Level 2 slice is bounded pixel capture of the AI-owned
browser page through the existing capture/trust/Observer lane; current capture
metadata is real, but its readable blocks are not yet derived from an acquired
browser frame.

Bounded visual capture is now complete through the same browser/screen/Observer
lane: the active AI-owned Firefox page produces a validated `960x540` JPEG with
a 256 KiB ceiling, digest, freshness, no filesystem write, and metadata-only
audit/sidecar projections. The next Level 2 slice is to link fresh frame
digest/sequence evidence to trusted action dispatch and post-action refresh,
without moving image bytes into task or sidecar state.

Visual-frame-grounded actions are now complete for the real Firefox path:
sidecar metadata observations provide fresh digest/sequence references,
operator and autonomous navigation retain compact pre/post evidence, and
simulated fallback stays explicit. The next Level 2 slice is bounded read-only
semantic target inventory for visible interactive elements in the AI-owned
page, tied to the current frame and exposed through the existing lane.

The bounded semantic inventory is now complete through that same lane. Current
browser/screen/Observer readback carries frame-scoped visible target metadata;
sidecar, task, summary, metadata, and audit paths retain only count/digest/frame
evidence, with no values or selectors. The next Level 2 slice is a governed
semantic target action selected by `targetId` plus matching frame/inventory
digest, reusing the current lease, grounding, autonomous task, and Observer
contracts rather than adding a route or readiness family.

The first governed semantic click is now complete through the existing
mouse-click route and trusted sidecar. Browser-runtime resolves only a current
frame-bound target, derives its coordinate internally, emits compact semantic
effect plus visual grounding, and rejects stale reference reuse. Observer shows
the effect and the real Firefox milestone proves navigation and no replay. The
next Level 2 slice is core-side target selection after initial observation so
an autonomous browser task can construct a current reference at dispatch time.
Semantic typing remains deferred pending removal of input-text echoes from
public state and audit paths.

Autonomous target selection is now complete. Core stores exact-name/optional
role intent, observes after prepare, requires one unique current match, and
materializes the frame reference only at dispatch. Recovery rematerializes
after prepare, while sidecar refreshes capture and requires target inventory and
grounding-frame equality before forwarding. The existing Firefox milestone now
proves the autonomous task. The next Level 2 slice is write-only semantic text
input after replacing all legacy plaintext input echoes with bounded redaction
metadata.

That redaction prerequisite is now complete. Browser, screen, Observer,
screen-act, task/verification/recovery evidence, events, and core persistence
retain bounded input evidence rather than text. Core restart fails active
redacted-input tasks as `input_reentry_required` with no replay. The next Level
2 slice is one semantic type operation selected from the current inventory and
executed through the existing keyboard/sidecar/grounding path with a transient
execution-only value.

Semantic type is now complete through that path. The plan stores target intent
only, execution supplies transient text, the runtime accepts only a current
enabled textbox, and Firefox evidence proves frame change with no value in
response, state, or events. The current bounded Level 2 browser eye-hand exit
gate and kernel-whitepaper Phase A are closed. Phase B now has a proven native
read-only D-Bus inventory and a repository-complete fixed-unit mutation bridge.
Its next real step is switched-VM Polkit/restart/recovery proof, not another
readiness surface or broader systemd API.

## Historical Phase Plans

`OPENCLAW_PHASE_2_PLAN.md` through `OPENCLAW_PHASE_136_PLAN.md` are retained
because milestone scripts and runtime evidence still reference them.

They are historical records and check fixtures. They are not the live roadmap.

Do not delete, rename, or move them until the milestone scripts that read them
are updated.

## Cleanup Rule

When adding a new plan:

- Prefer updating an active route document over creating another numbered phase.
- Create a new numbered phase only when a real capability slice needs an
  executable milestone check.
- If the document is historical evidence, say so at the top.
- If the document is active guidance, link it from this README and from
  `docs/README.md`.
