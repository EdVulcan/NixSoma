# OpenClaw on NixOS Phase 2 Plan

Updated: 2026-05-19

## Status

Phase 1 is release-exit passed and demo-ready.

Phase 2 starts with route selection only. Do not begin implementation until this plan is accepted and the first Phase 2 slice is chosen from the whitepaper route.

## Whitepaper Direction

The next phase should deepen OpenClaw as a resident digital body under user sovereignty. That means the next work should make OpenClaw more capable at understanding, maintaining, demonstrating, or governing its own body.

Phase 2 should not be selected by whichever safety boundary is easiest to extend.

## Priority Order

1. Real NixOS/systemd repair semantics.
2. Operator/Observer demo experience.
3. Body governance enhancement.
4. Plugin/runtime adapter work, only if it directly supports a visible body capability.

## Track A: Real NixOS/systemd Repair Semantics

Goal: move from simulated self-heal evidence toward a controlled real repair path.

Allowed first slices:

- Read-only systemd unit inventory for OpenClaw services.
- Plan-only repair proposal for one OpenClaw service.
- Explicit operator-visible dry-run repair envelope.
- Observer display for repair proposal, risk, command, and rollback note.

Boundaries:

- No automatic high-risk repair.
- No blind service restart without Observer-visible evidence.
- No host mutation before a plan-only and dry-run milestone.
- No persistence/hardening loop unless a real repair demo is blocked.

## Track B: Operator/Observer Demo Experience

Goal: make the Phase 1 demo easier to run, explain, and verify.

Allowed first slices:

- Observer release status panel backed by existing MVP status and route data.
- One-click demo checklist view, without executing hidden actions.
- Demo evidence bundle that links task history, recovery evidence, heal history, maintenance state, and MVP route.
- Clear “Phase 1 demo-ready” surface in Observer.

Boundaries:

- No new autonomy.
- No new plugin/runtime adapter work.
- No broad UI redesign unless it directly improves the demo path.

## Track C: Body Governance Enhancement

Goal: help OpenClaw reason about its body state and recovery choices.

Allowed first slices:

- Body service dependency map.
- Health trend summary from existing system-sense snapshots.
- Conservative recovery policy explanation.
- Route-aware next-action recommendation.

Boundaries:

- No unapproved mutation.
- No complex policy engine rewrite.
- No hidden background autonomy beyond existing maintenance controls.

## Deferred Track: Plugin/runtime Adapter

Plugin/runtime adapter work is deferred for the first half of Phase 2.

It may re-enter only when:

- A visible body capability requires it.
- The slice has a direct demo path.
- It does not restart approval hardening, denial recovery, duplicate-click, or persistence loops.
- The whitepaper route review says it is the best next body capability.

## First Recommended Slice

Recommended first Phase 2 slice:

`openclaw-systemd-unit-inventory`

Purpose:

Read OpenClaw-owned systemd unit metadata and expose it as body governance evidence. This is read-only and prepares real repair semantics without mutating the host.

Expected Observer pair:

`observer-openclaw-systemd-unit-inventory`

Why this first:

- It deepens the “body” rather than expanding safety boundaries.
- It supports later real repair semantics.
- It is demoable in Observer.
- It keeps high-risk repair out of the first Phase 2 slice.

## Track A Execution Route Gate

Status after the first Track A block:

- `openclaw-systemd-unit-inventory` is passed.
- `observer-openclaw-systemd-unit-inventory` is passed.
- `openclaw-systemd-repair-plan` is passed.
- `observer-openclaw-systemd-repair-plan` is passed.
- `openclaw-systemd-repair-dry-run` is passed.
- `observer-openclaw-systemd-repair-dry-run` is passed.

Decision:

OpenClaw may begin planning the next Track A slice, `openclaw-systemd-repair-execution-task`, only as an operator-reviewed real systemd repair execution path.

The next slice is allowed because it directly advances real NixOS/systemd repair semantics, but it must remain narrow:

- One selected OpenClaw-owned body unit only.
- Operator-visible command, target, risk, reason, and rollback note.
- No automatic high-risk repair.
- No blind restart.
- No background scheduler.
- No persistence, denial-recovery, duplicate-click, or approval-hardening loop.
- No plugin/runtime adapter work.

The next slice must not execute until its own milestone explicitly proves that execution is operator-reviewed and linked back to the passed inventory, repair plan, and dry-run envelope.

Approved-deferred checkpoint:

Before real host mutation, `openclaw-systemd-repair-approved-deferred` must prove that approval unlocks operator flow but still ends in a deferred execution shell with `hostMutation=false` and `executed=false`.

This checkpoint is allowed because it validates the operator-reviewed task shell. It must not add persistence hardening, denial recovery, duplicate-click handling, schedulers, plugin/runtime adapter work, or real `systemctl restart` execution.

Real execution checkpoint:

After the approved-deferred checkpoint passes, `openclaw-systemd-repair-real-execution` may prove one operator-reviewed real repair execution attempt for `openclaw-browser-runtime.service`.

This checkpoint is allowed because it is the narrow Track A transition from simulated repair semantics to real NixOS/systemd repair semantics. It must remain explicit and small:

- Requires `execute=true` task materialization plus a separate approved approval request.
- Executes only `systemctl restart openclaw-browser-runtime.service`.
- Records command, target, exit code, stdout/stderr, result, and rollback note in task evidence.
- Exposes Observer-visible real execution intent and result fields.
- Must not add persistence hardening, denial recovery, duplicate-click handling, schedulers, plugin/runtime adapter work, or any automatic repair loop.

Post-execution verification checkpoint:

After real execution passes, `openclaw-systemd-repair-post-verification` may record one before/after body-state verification bundle for `openclaw-browser-runtime.service`.

This checkpoint is allowed because it closes the first Track A repair loop with evidence rather than adding another safety boundary:

- Reads systemd unit inventory before and after the approved execution attempt.
- Reads `/system/health` before and after the approved execution attempt.
- Records target unit state, service health, command exit code, and verification summary in task evidence.
- Exposes Observer-visible post-execution verification fields.
- Must not retry the restart, trigger automatic recovery, add persistence hardening, add denial recovery, add duplicate-click handling, or schedule background repair.

Track B repair demo status checkpoint:

After the first Track A repair loop is complete, `openclaw-phase-2-repair-demo-status` may expose a read-only demo status bundle for Observer.

This checkpoint is allowed because it turns completed body capability evidence into an operator-visible demo surface:

- Reads existing route, task history, command transcript, and post-execution verification evidence.
- Exposes demo readiness, target unit, command result, before/after body state, checklist, and next demo slice.
- Creates no task, no approval, no command execution, no host mutation, and no recovery action.
- Must not add persistence hardening, denial recovery, duplicate-click handling, schedulers, plugin/runtime adapter work, or any hidden execution path.

Repair auth delegation checkpoint:

If the operator sees a password prompt for every approved repair action, `openclaw-systemd-repair-auth-delegation` may prove a narrow NixOS authorization bridge for the existing real repair demo path.

This checkpoint is allowed because repeated OS password prompts block the Phase 2 operator demo experience after the real repair loop is already approved and visible. It must remain a least-privilege integration, not a new autonomy or hardening loop:

- Delegates only the already-approved `openclaw-browser-runtime.service` restart path.
- Keeps OpenClaw operator approval separate from host OS authorization.
- Uses a fixed helper that accepts no arguments and executes only `systemctl restart openclaw-browser-runtime.service`.
- Is disabled by default and requires an explicit OpenClaw service user.
- Must not grant passwordless `ALL`, arbitrary `systemctl`, shell access, plugin/runtime execution, background repair, denial recovery, duplicate-click handling, or persistence hardening.

Body service dependency map checkpoint:

After the repair demo path is usable on a real NixOS body, `openclaw-body-service-dependency-map` may expose a read-only dependency graph for OpenClaw-owned body services.

This checkpoint is allowed because it advances Track C body governance: OpenClaw should understand how its organs depend on each other before it recommends broader recovery choices.

- Reads existing OpenClaw service specs and systemd inventory evidence.
- Exposes nodes, upstream dependencies, downstream impact, startup layers, roots, leaves, and high-impact body services.
- Creates no task, no approval, no command execution, no host mutation, and no repair action.
- Must not add automatic restart, background repair, persistence hardening, denial recovery, duplicate-click handling, plugin/runtime adapter work, or arbitrary systemd control.

Health trend summary checkpoint:

After the dependency map passes, `openclaw-health-trend-summary` may summarize recent `/system/health` snapshots.

This checkpoint is allowed because OpenClaw needs short-term body memory before it can make route-aware recovery recommendations:

- Reads existing system-sense health snapshots only.
- Exposes sample window, service stability, degraded services, alert count, and resource min/max/latest summaries.
- Creates no task, no approval, no command execution, no host mutation, no scheduler, and no recovery action.
- Must not add automatic repair, background maintenance, persistence hardening, denial recovery, duplicate-click handling, plugin/runtime adapter work, or arbitrary host control.

Route-aware next-action recommendation checkpoint:

After health trends pass, `openclaw-route-aware-next-action-recommendation` may combine the dependency map and health trends into a read-only next-action recommendation.

This checkpoint is allowed because it turns body evidence into governance judgment without crossing into execution:

- Reads dependency map and health trend summaries only.
- Recommends observe/review/recovery-planning direction with evidence references and candidate actions.
- Creates no task, no approval, no command execution, no host mutation, no scheduler, and no recovery action.
- Must not add automatic repair, background maintenance, persistence hardening, denial recovery, duplicate-click handling, plugin/runtime adapter work, or arbitrary host control.

Conservative recovery policy explanation checkpoint:

After route-aware next-action recommendations pass, `openclaw-conservative-recovery-policy-explanation` may explain the conservative recovery policy that governs when OpenClaw can stay in observe/review mode versus when a separate operator-reviewed repair route is required.

This checkpoint is allowed because it makes body governance understandable before broadening any recovery action:

- Reads route-aware recommendation, dependency map, and health trend evidence only.
- Explains observe-first recovery rules, minimum evidence, repair proposal gates, and hard boundaries.
- Creates no task, no approval, no command execution, no host mutation, no scheduler, and no recovery action.
- Must not add automatic repair, background maintenance, persistence hardening, denial recovery, duplicate-click handling, plugin/runtime adapter work, or arbitrary host control.

Body governance readiness checkpoint:

After the conservative recovery policy explanation passes, `openclaw-body-governance-readiness` may close Track C with a read-only readiness bundle.

This checkpoint is allowed because it verifies that body governance has enough evidence to support the next whitepaper route review:

- Reads dependency map, health trend, route-aware recommendation, and conservative recovery policy evidence only.
- Exposes readiness checks, current governance posture, completed Track C slices, and next route review boundary.
- Creates no task, no approval, no command execution, no host mutation, no scheduler, and no recovery action.
- Must not add automatic repair, background maintenance, persistence hardening, denial recovery, duplicate-click handling, plugin/runtime adapter work, or arbitrary host control.

Phase 2 route review checkpoint:

After Track C body governance readiness passes, `openclaw-phase-2-route-review` may choose the next Phase 2 body-capability block.

Decision:

Select Track B, `openclaw-phase-2-demo-control-room`, as the next block.

This checkpoint is allowed because Phase 2 now has real repair evidence and body governance evidence, so the next whitepaper-aligned gain is a clearer human demo/control surface before adding broader mutation or plugin/runtime capability:

- Reads body governance readiness, Phase 2 priority order, and existing route evidence only.
- Selects the next track and explains why Track A broadening, plugin/runtime adapter work, persistence hardening, denial recovery, duplicate-click handling, and broader host mutation are not selected.
- Creates no task, no approval, no command execution, no host mutation, no scheduler, and no recovery action.
- Must not add automatic repair, background maintenance, persistence hardening, denial recovery, duplicate-click handling, plugin/runtime adapter work, or arbitrary host control.

Phase 2 demo control room checkpoint:

After the route review selects Track B, `openclaw-phase-2-demo-control-room` may expose a read-only demo control surface that gathers the visible Phase 2 body evidence into one operator view.

This checkpoint is allowed because it improves the human demo path without broadening autonomy:

- Reads MVP route alignment, repair demo status, route review, and body governance readiness evidence only.
- Exposes available panels, selected next slice, repair demo readiness, body governance readiness, and an operator walkthrough script.
- Creates no task, no approval, no command execution, no host mutation, no scheduler, and no recovery action.
- Must not add automatic repair, background maintenance, persistence hardening, denial recovery, duplicate-click handling, plugin/runtime adapter work, or arbitrary host control.

Phase 2 demo walkthrough checkpoint:

After the demo control room passes, `openclaw-phase-2-demo-walkthrough` may expose a human-readable walkthrough script for the operator demo.

This checkpoint is allowed because it turns the control room into an explainable whitepaper-aligned demo without adding new capability:

- Reads demo control room evidence only.
- Exposes ordered demo steps, expected evidence, speaking script, and explicit no-mutation boundary.
- Creates no task, no approval, no command execution, no host mutation, no scheduler, and no recovery action.
- Must not add automatic repair, background maintenance, persistence hardening, denial recovery, duplicate-click handling, plugin/runtime adapter work, or arbitrary host control.

Phase 2 demo readiness exit checkpoint:

After the demo walkthrough passes, `openclaw-phase-2-demo-readiness-exit` may close the Track B demo block with a read-only exit gate.

This checkpoint is allowed because it confirms that the operator demo is ready before opening another body capability block:

- Reads demo walkthrough and demo control room evidence only.
- Exposes exit checks, safe-to-demo outcome, completed Track B slices, and next route-review boundary.
- Creates no task, no approval, no command execution, no host mutation, no scheduler, and no recovery action.
- Must not add automatic repair, background maintenance, persistence hardening, denial recovery, duplicate-click handling, plugin/runtime adapter work, or arbitrary host control.

Phase 2 next capability route review checkpoint:

After the demo readiness exit passes, `openclaw-phase-2-next-capability-route-review` may choose the next body-capability block. After the candidate repair demo status passes, the same route review must avoid looping back into the already completed candidate assessment block. After `openclaw-body-evidence-ledger-readiness` passes, it must avoid looping back into the already completed ledger plan or append path. After `openclaw-body-evidence-ledger-demo-status` passes, it must avoid looping back into the completed ledger demo package and return to Track A with `openclaw-systemd-next-repair-scope-review`. After later repair/candidate demo evidence is visible, it may select `openclaw-body-evidence-ledger-followup-record-plan` as a plan-only body-memory checkpoint without creating another append. After the follow-up append readiness passes, it must avoid further ledger expansion and select `openclaw-phase-2-completion-readiness`.

Decision:

Select Track A, `openclaw-systemd-repair-candidate-assessment`, as the next block before the candidate repair demo is complete.

After `openclaw-systemd-repair-candidate-demo-status` is complete, select Track C, `openclaw-body-evidence-timeline`, as the next block.

After `openclaw-body-evidence-timeline-readiness` is complete, select Track C, `openclaw-body-evidence-ledger-plan`, as the next block.

After `openclaw-body-evidence-ledger-demo-status` is complete, select Track A, `openclaw-systemd-next-repair-scope-review`, as the next block.

After `openclaw-systemd-repair-candidate-demo-status` is complete and the durable ledger is ready, select Track C, `openclaw-body-evidence-ledger-followup-record-plan`, as the next plan-only body-memory checkpoint.

After `openclaw-body-evidence-ledger-followup-record-append-readiness` is complete, select `openclaw-phase-2-completion-readiness` as the Phase 2 closeout checkpoint.

This checkpoint is allowed because Track B demo readiness is complete, and the whitepaper priority order points back to real NixOS/systemd repair semantics until the candidate repair route is demo-ready. Once that candidate route is complete, the next whitepaper-aligned gain is body evidence memory rather than repeating the same candidate assessment:

- Reads demo readiness exit, candidate demo status when available, Phase 2 priority order, and existing route evidence only.
- Selects Track A candidate assessment before candidate demo completion, Track C body evidence timeline after candidate demo completion, Track C body evidence ledger plan after timeline readiness, Track C `openclaw-body-evidence-ledger-demo-status` after ledger readiness, Track A `openclaw-systemd-next-repair-scope-review` after ledger demo readiness, then Track C `openclaw-body-evidence-ledger-followup-record-plan` after later repair/candidate demo evidence is available.
- Explains why route loops, candidate-specific approval replay, durable storage implementation before a plan, plugin/runtime adapter work, automatic repair, broader mutation, persistence hardening, and denial recovery are not selected.
- Creates no task, no approval, no command execution, no host mutation, no scheduler, and no recovery action.
- Must not add automatic repair, background maintenance, persistence hardening, denial recovery, duplicate-click handling, plugin/runtime adapter work, or arbitrary host control.

Body evidence ledger plan checkpoint:

After the next capability route review selects Track C, `openclaw-body-evidence-ledger-plan` may define the plan-only durable body evidence ledger design.

This checkpoint is allowed because durable body memory is a whitepaper-aligned capability, but implementation must be planned before any storage write:

- Reads body evidence timeline readiness only.
- Exposes planned record schema, content policy, retention plan, write gates, verification plan, and next route-review boundary.
- Creates no task, no approval, no command execution, no host mutation, no scheduler, no durable storage write, and no recovery action.
- Must not add automatic repair, background maintenance, persistence hardening, denial recovery, duplicate-click handling, plugin/runtime adapter work, arbitrary host control, durable event storage, or append-only ledger writes.

Body evidence ledger route review checkpoint:

After the ledger plan passes, `openclaw-body-evidence-ledger-route-review` may choose the next implementation-preparation slice.

This checkpoint is allowed because the ledger schema and write gates are visible, but the project still needs a route decision before selecting any storage root or append behavior:

- Reads body evidence ledger plan evidence only.
- Selects an operator-visible storage root plan as the next slice before any durable append.
- Explains why direct durable writes, background ledger schedulers, automatic repair, plugin/runtime adapter work, and safety-boundary hardening loops are not selected.
- Creates no task, no approval, no command execution, no host mutation, no scheduler, no durable storage write, and no recovery action.
- Must not add append-only ledger writes, durable event storage, background persistence, automatic repair, denial recovery, duplicate-click handling, plugin/runtime adapter work, arbitrary host control, or broader mutation.

Body evidence ledger storage root plan checkpoint:

After the ledger route review selects implementation preparation, `openclaw-body-evidence-ledger-storage-root-plan` may propose the operator-visible storage root for future ledger records.

This checkpoint is allowed because durable body memory needs a visible home before any directory creation or append:

- Reads body evidence ledger route review only.
- Exposes candidate roots, selected display path, path policy, pre-write checks, and next route-review boundary.
- Creates no directory, no task, no approval, no command execution, no host mutation, no scheduler, no durable storage write, and no recovery action.
- Must not add append-only ledger writes, durable event storage, background persistence, automatic repair, denial recovery, duplicate-click handling, plugin/runtime adapter work, arbitrary host control, or broader mutation.

Body evidence ledger storage root route review checkpoint:

After the storage root plan passes, `openclaw-body-evidence-ledger-storage-root-route-review` may choose the smallest materialization step for the ledger root.

This checkpoint is allowed because the storage root is visible and workspace-bounded, but directory creation still needs to be separated from record writes:

- Reads body evidence ledger storage root plan only.
- Selects an approval-visible ledger directory creation task shell as the next slice.
- Explains why direct ledger record writes, background schedulers, automatic repair, plugin/runtime adapter work, and safety-boundary hardening loops are not selected.
- Creates no directory, no task, no approval, no command execution, no host mutation, no scheduler, no durable storage write, and no recovery action.
- Must not add append-only ledger writes, durable event storage, background persistence, automatic repair, denial recovery, duplicate-click handling, plugin/runtime adapter work, arbitrary host control, or broader mutation.

Body evidence ledger directory task checkpoint:

After the storage root route review selects the task shell, `openclaw-body-evidence-ledger-directory-task` may create a queued task and pending approval for the selected ledger directory.

This checkpoint is allowed because it moves from route selection into an explicit operator gate for the first real filesystem materialization step:

- Reads body evidence ledger storage root route review only.
- Creates a queued task and pending medium-risk approval for `.artifacts/openclaw-body-evidence-ledger`.
- Does not create the directory, write ledger records, execute commands, schedule work, or trigger recovery.
- Must remain limited to the selected workspace-bounded ledger root and must not add append-only ledger writes, durable event storage, background persistence, automatic repair, denial recovery, duplicate-click handling, plugin/runtime adapter work, arbitrary host control, or broader mutation.

Body evidence ledger directory execution checkpoint:

After the directory task is explicitly approved, `openclaw-body-evidence-ledger-directory-execution` may create only the selected ledger directory.

This checkpoint is allowed because persistent body memory needs one approved, observable filesystem materialization step before any ledger record append:

- Reads the approved body evidence ledger directory task only.
- Creates `.artifacts/openclaw-body-evidence-ledger` with recursive mkdir inside the OpenClaw workspace.
- Records task outcome evidence, resolved path, approval, and no-record-write boundary.
- Does not write ledger records, schedule background persistence, execute arbitrary commands, or trigger recovery.
- Must remain limited to the selected workspace-bounded ledger root and must not add append-only ledger writes, durable event storage records, automatic repair, denial recovery, duplicate-click handling, plugin/runtime adapter work, arbitrary host control, or broader mutation.

Body evidence ledger first record plan checkpoint:

After the ledger directory exists, `openclaw-body-evidence-ledger-first-record-plan` may plan the first append-only body evidence ledger record.

This checkpoint is allowed because the storage root now exists, but the first durable record must be planned before any JSONL append:

- Reads body evidence timeline readiness, ledger schema plan, and ledger directory existence only.
- Exposes the planned bootstrap record type, source registry, source endpoint, content hash strategy, required fields, pre-append checks, and next route-review boundary.
- Creates no task, no approval, no command execution, no host mutation, no scheduler, no durable record append, and no recovery action.
- Must not write ledger records, add background persistence, automatic repair, denial recovery, duplicate-click handling, plugin/runtime adapter work, arbitrary host control, or broader mutation.

Body evidence ledger first record route review checkpoint:

After the first record plan passes, `openclaw-body-evidence-ledger-first-record-route-review` may choose the smallest operator-visible step toward the first append-only record.

This checkpoint is allowed because the bootstrap record is planned and the ledger root exists, but the first durable JSONL append still needs an explicit approval-gated task shell:

- Reads body evidence ledger first record plan only.
- Selects an approval-gated first-record append task shell as the next slice.
- Explains why background ledger writers, bulk evidence import, automatic repair, denial recovery, duplicate-click hardening, plugin/runtime adapter work, and broader host mutation are not selected.
- Creates no task, no approval, no command execution, no host mutation, no scheduler, no durable record append, and no recovery action.
- Must not write ledger records, add background persistence, bulk import, automatic repair, denial recovery, duplicate-click handling, plugin/runtime adapter work, arbitrary host control, or broader mutation.

Body evidence ledger first record task checkpoint:

After the first record route review selects the append task shell, `openclaw-body-evidence-ledger-first-record-task` may create a queued task and pending approval for the first bootstrap ledger record append.

This checkpoint is allowed because the first durable body-memory record must be operator-visible before any JSONL append is executed:

- Reads body evidence ledger first record route review only.
- Creates a queued task and pending medium-risk approval for the planned `body_evidence_ledger_bootstrap` record.
- Does not append a ledger record, execute commands, schedule background persistence, trigger recovery, or broaden filesystem access.
- Must remain limited to the planned bootstrap record and must not add background ledger writers, bulk import, automatic repair, denial recovery, duplicate-click handling, plugin/runtime adapter work, arbitrary host control, or broader mutation.

Body evidence ledger first record append checkpoint:

After the first record task is explicitly approved, `openclaw-body-evidence-ledger-first-record-append` may append one bootstrap JSONL record into the workspace-bounded body evidence ledger.

This checkpoint is allowed because durable body memory needs a first real, inspectable record before any scheduler, import, or autonomous writer is considered:

- Reads the approved first record task and body evidence timeline readiness.
- Appends exactly one `body_evidence_ledger_bootstrap` JSONL record to `.artifacts/openclaw-body-evidence-ledger/body-evidence-ledger.jsonl`.
- Records source registry, source endpoint, governance, content hash, task id, approval id, and append result evidence.
- Does not schedule background persistence, import bulk evidence, trigger recovery, execute arbitrary commands, or broaden filesystem access beyond the selected ledger file.
- Must not add background ledger writers, automatic repair, denial recovery, duplicate-click handling, plugin/runtime adapter work, arbitrary host control, or broader mutation.

Body evidence ledger readiness checkpoint:

After the first bootstrap record append passes, `openclaw-body-evidence-ledger-readiness` may close the first durable body evidence ledger block with a read-only readiness bundle.

This checkpoint is allowed because the project now needs a whitepaper-aligned pause point before adding more records, background writers, schedulers, or new mutation:

- Reads the ledger schema plan, first-record plan, and `.artifacts/openclaw-body-evidence-ledger/body-evidence-ledger.jsonl`.
- Verifies exactly one `body_evidence_ledger_bootstrap` JSONL record, source registry, source endpoint, content hash, task id, approval id, append-only governance, no scheduler, no background writer, and no bulk import.
- Creates no task, no approval, no command execution, no host mutation, no scheduler, no recovery action, and no additional ledger record.
- Must return to whitepaper route review before adding more ledger records, durable background persistence, automatic repair, denial recovery, duplicate-click handling, plugin/runtime adapter work, arbitrary host control, or broader mutation.

Body evidence ledger demo status checkpoint:

After the route review selects `openclaw-body-evidence-ledger-demo-status`, the system may package the completed first durable body-memory ledger block into an operator-visible demo status.

This checkpoint is allowed because the completed ledger block needs a concise demo narrative before any next capability route is opened:

- Reads body evidence ledger readiness only.
- Exposes checklist status, bootstrap record id, content hash, task/approval provenance, no-background-writer boundary, and a short operator narrative.
- Creates no task, no approval, no command execution, no host mutation, no scheduler, no recovery action, no background writer, and no additional ledger record.
- Must return to whitepaper route review before adding more ledger records, durable background persistence, automatic repair, denial recovery, duplicate-click handling, plugin/runtime adapter work, arbitrary host control, or broader mutation.

Body evidence ledger follow-up record plan checkpoint:

After the first durable ledger demo and later body repair/candidate evidence are visible, `openclaw-body-evidence-ledger-followup-record-plan` may plan how the next body evidence timeline readiness snapshot would become a future ledger record.

This checkpoint is allowed because it advances resident body memory by making the next evidence write explainable before any second append exists:

- Reads body evidence timeline readiness, body evidence ledger readiness, and the existing ledger JSONL record count only.
- Exposes planned follow-up record type, source registry, source endpoint, existing record count, latest record id, pre-append checks, and explicit deferred actions.
- Creates no task, no approval, no command execution, no host mutation, no scheduler, no recovery action, no background writer, no bulk import, and no additional ledger record.
- Must return to whitepaper route review before turning this plan into any task, approval, scheduler, durable append, automatic repair, denial recovery, duplicate-click handling, plugin/runtime adapter work, arbitrary host control, or broader mutation.

Body evidence ledger follow-up record route review checkpoint:

After the follow-up record plan passes, `openclaw-body-evidence-ledger-followup-record-route-review` may decide whether the future second ledger record should proceed through an explicit task shell.

This checkpoint is allowed because OpenClaw should review the route before turning a body-memory plan into executable work:

- Reads body evidence ledger follow-up record plan only.
- Selects a future approval-gated follow-up append task shell as the next slice while explicitly rejecting direct append, recurring ledger writers, background persistence, automatic repair, and plugin/runtime adapter work.
- Creates no task, no approval, no command execution, no host mutation, no scheduler, no recovery action, no background writer, no bulk import, and no additional ledger record.
- Must not append the second record, request approval, create the task shell, schedule recurring writes, add automatic repair, denial recovery, duplicate-click handling, plugin/runtime adapter work, arbitrary host control, or broader mutation.

Body evidence ledger follow-up record task checkpoint:

After the follow-up record route review selects `openclaw-body-evidence-ledger-followup-record-task`, the system may create an approval-gated task shell for a future second ledger record.

This checkpoint is allowed because the route review has already selected a single explicit task shell over direct append or a recurring writer:

- Reads body evidence ledger follow-up record route review only.
- Creates one queued `body_evidence_ledger_followup_record_task` and one pending medium-risk approval.
- Exposes planned follow-up record type, planned sequence, source registry, existing record count, and deferred append phases.
- Does not append a ledger record, execute a command, mutate the host, schedule recurring writes, enable a background writer, or create a second durable record.
- Must not approve the task, execute the follow-up append, add denial recovery, duplicate-click handling, persistence hardening, plugin/runtime adapter work, arbitrary host control, or broader mutation.

Body evidence ledger follow-up record readiness checkpoint:

After the follow-up record task shell is visible, `openclaw-body-evidence-ledger-followup-record-readiness` may close this follow-up body-memory block with a read-only readiness bundle.

This checkpoint is allowed because the project needs a route pause before deciding whether any second ledger append is worth approving:

- Reads Core task history and the existing body evidence ledger JSONL only.
- Confirms one queued `body_evidence_ledger_followup_record_task`, pending approval, planned sequence 2, exactly one existing ledger record, and no durable follow-up append.
- Exposes Observer-visible readiness, checklist, task id, approval id, planned record type, and no-hidden-mutation boundary.
- Creates no task, no approval, no command execution, no host mutation, no scheduler, no recovery action, no background writer, and no additional ledger record.
- Must return to whitepaper route review before approving the task, appending a second record, adding background persistence, schedulers, automatic repair, denial recovery, duplicate-click handling, plugin/runtime adapter work, arbitrary host control, or broader mutation.

Phase 2 next capability route review after follow-up ledger readiness checkpoint:

After `openclaw-body-evidence-ledger-followup-record-readiness` passes, `openclaw-phase-2-next-capability-route-review-followup-readiness` may decide whether the already-visible follow-up ledger task shell should become the next body-memory route.

Decision:

Select Track C, `openclaw-body-evidence-ledger-followup-record-append-route-review`, as a future route-review slice only.

This checkpoint is allowed because the follow-up task shell is visible and pending, but the second durable ledger record still needs a separate route review before any approval or append:

- Reads body evidence ledger follow-up record readiness only.
- Selects a future append route review for the pending `body_evidence_ledger_followup_record_task`.
- Exposes task id, approval id, planned sequence 2, existing record count 1, and no-second-record evidence.
- Creates no task, no approval, no command execution, no host mutation, no scheduler, no recovery action, no background writer, and no additional ledger record.
- Must not approve the follow-up task, append the second record, add background persistence, schedulers, automatic repair, denial recovery, duplicate-click handling, plugin/runtime adapter work, arbitrary host control, or broader mutation.

Body evidence ledger follow-up append route review checkpoint:

After the next capability route review selects `openclaw-body-evidence-ledger-followup-record-append-route-review`, the system may review whether the existing pending follow-up task can become a future approved append.

Decision:

Select Track C, `openclaw-body-evidence-ledger-followup-record-append`, as a future explicit append execution slice only.

This checkpoint is allowed because the second durable body-memory record should be route-reviewed before approval, but the route review itself must remain non-mutating:

- Reads body evidence ledger follow-up record readiness and next capability route review only.
- Confirms the pending task id, approval id, planned sequence 2, existing record count 1, and no second JSONL record.
- Selects a future approved append execution slice without approving or executing it.
- Creates no task, no approval, no command execution, no host mutation, no scheduler, no recovery action, no background writer, and no additional ledger record.
- Must not approve the follow-up task, append the second record, add background persistence, schedulers, automatic repair, denial recovery, duplicate-click handling, plugin/runtime adapter work, arbitrary host control, or broader mutation.

Body evidence ledger follow-up record append checkpoint:

After the follow-up append route review selects `openclaw-body-evidence-ledger-followup-record-append`, the existing pending follow-up task may be explicitly approved and executed to append one second JSONL record.

This checkpoint is allowed because durable body memory needs a second inspectable record only after the task shell, readiness, next capability route review, and append route review have all passed:

- Reuses the existing `body_evidence_ledger_followup_record_task` and its pending approval.
- Requires explicit approval before append execution.
- Appends exactly one `body_evidence_timeline_followup` JSONL record to `.artifacts/openclaw-body-evidence-ledger/body-evidence-ledger.jsonl`.
- Records source registry, source endpoint, previous record id/hash, task id, approval id, content hash, and append result evidence.
- Does not create another task, create another approval, execute commands, schedule background persistence, trigger recovery, or broaden filesystem access beyond the selected ledger file.
- Must not add background ledger writers, automatic repair, denial recovery, duplicate-click handling, plugin/runtime adapter work, arbitrary host control, or broader mutation.

Body evidence ledger follow-up record append readiness checkpoint:

After the second ledger record append passes, `openclaw-body-evidence-ledger-followup-record-append-readiness` may close the follow-up durable body-memory block with a read-only readiness bundle.

This checkpoint is allowed because the project needs a clear route pause after writing the second durable body-memory record:

- Reads Core task history and `.artifacts/openclaw-body-evidence-ledger/body-evidence-ledger.jsonl` only.
- Verifies exactly two JSONL records, second record type `body_evidence_timeline_followup`, previous-record linkage, content hash, task id, approval id, append result, and no background writer.
- Creates no task, no approval, no command execution, no host mutation, no scheduler, no recovery action, no background writer, and no additional ledger record.
- Must return to whitepaper route review before adding more ledger records, background persistence, schedulers, automatic repair, denial recovery, duplicate-click handling, plugin/runtime adapter work, arbitrary host control, or broader mutation.

Phase 2 completion readiness checkpoint:

After the next capability route review selects `openclaw-phase-2-completion-readiness`, the system may summarize whether Phase 2 is ready for final exit.

This checkpoint is allowed because Track A, Track B, and Track C have each produced observable body capability evidence and the project should stop expanding sub-slices before declaring Phase 2 complete:

- Reads existing Phase 2 evidence only: demo readiness exit, repair demo status, next repair demo status, body governance readiness, candidate demo status, and follow-up append readiness.
- Verifies real repair evidence, Observer demo readiness, body governance readiness, durable body memory with two records, and no hidden scheduler/background writer.
- Creates no task, no approval, no command execution, no host mutation, no scheduler, no recovery action, no background writer, and no additional ledger record.
- Must not add more body-memory records, repair executions, plugin/runtime adapter work, persistence hardening, denial recovery, duplicate-click handling, arbitrary host control, or broader mutation.

Phase 2 exit checkpoint:

After `openclaw-phase-2-completion-readiness` reports 100% readiness, `openclaw-phase-2-exit` may mark Phase 2 complete.

This checkpoint is allowed because it is a read-only closeout gate, not a new capability slice:

- Reads Phase 2 completion readiness only.
- Confirms Track A real repair semantics, Track B Observer demo readiness, Track C body governance and durable body memory, and no hidden scheduler/background writer.
- Declares Phase 2 complete and points future work to a separate Phase 3 plan.
- Creates no task, no approval, no command execution, no host mutation, no scheduler, no recovery action, no background writer, and no additional ledger record.
- Must not add more Phase 2 capability slices, repair executions, body-memory records, plugin/runtime adapter work, persistence hardening, denial recovery, duplicate-click handling, arbitrary host control, or broader mutation.

Systemd next repair scope review checkpoint:

After the next capability route review selects `openclaw-systemd-next-repair-scope-review`, the system may choose the next Track A repair scope from existing body evidence.

This checkpoint is allowed because the durable ledger demo block is complete, and the whitepaper priority order says to return to real NixOS/systemd repair semantics without jumping straight to mutation:

- Reads systemd unit inventory, body service dependency map, and body evidence ledger demo status only.
- Selects `openclaw-system-sense.service` as the next read-only repair scope because it is the introspection organ that produced the body evidence.
- Exposes candidate scores, selected unit, dependency context, completed demo target, ledger demo readiness, and next plan-only boundary.
- Creates no task, no approval, no command execution, no restart, no host mutation, no scheduler, no recovery action, and no additional ledger write.
- Must not loop back to the browser-runtime repair demo, replay approval/execution, add automatic repair, persistence hardening, denial recovery, duplicate-click handling, plugin/runtime adapter work, arbitrary host control, or broader mutation.

Systemd next repair plan checkpoint:

After the scope review selects `openclaw-system-sense.service`, `openclaw-systemd-next-repair-plan` may convert that selected unit into a plan-only repair scope.

This checkpoint is allowed because it advances Track A real systemd semantics by naming the target, command preview, required gates, and route boundary without crossing into dry-run or execution:

- Reads the next repair scope review and systemd inventory only.
- Exposes target unit, impact context, command preview, command-preview-only flag, required-before-execution gates, and not-selected boundaries.
- Creates no task, no approval, no command execution, no restart, no host mutation, no scheduler, no recovery action, and no additional ledger write.
- Must not immediately create a dry-run, task, approval, restart, automatic repair, browser-runtime replay, persistence hardening, denial recovery, duplicate-click handling, plugin/runtime adapter work, arbitrary host control, or broader mutation.

Systemd next repair route review checkpoint:

After `openclaw-systemd-next-repair-plan` passes, `openclaw-systemd-next-repair-route-review` may select the next smallest Track A step.

Decision:

Select Track A, `openclaw-systemd-next-repair-dry-run`, as the next slice.

This checkpoint is allowed because the selected system-sense repair plan is visible and plan-only, but even a dry-run route should be explicitly chosen before any new task, approval, or restart path:

- Reads the next repair plan only.
- Selects an operator-visible dry-run envelope for `openclaw-system-sense.service`.
- Explains why immediate task creation, approval creation, real `systemctl` execution, browser-runtime demo replay, automatic repair, persistence hardening, denial recovery, duplicate-click work, and plugin/runtime adapter work are not selected.
- Creates no task, no approval, no command execution, no restart, no host mutation, no scheduler, no recovery action, and no additional ledger write.
- Must not implement the dry-run envelope in this checkpoint; that belongs to `openclaw-systemd-next-repair-dry-run`.

Systemd next repair dry-run checkpoint:

After the route review selects `openclaw-systemd-next-repair-dry-run`, the system may expose an operator-visible dry-run envelope for the selected `openclaw-system-sense.service` repair.

This checkpoint is allowed because it makes the exact future restart command visible without crossing into task creation, approval creation, or host mutation:

- Reads the next repair route review and next repair plan only.
- Exposes `systemctl restart openclaw-system-sense.service` as a dry-run command envelope with `wouldExecute=false`.
- Records route-review evidence, target unit, risk, required future approval, no-execution checks, operator-visible-before-mutation check, and no-restart-executed check.
- Creates no task, no approval, no command execution, no restart, no host mutation, no scheduler, no recovery action, and no additional ledger write.
- Must not create the task shell, approve the action, execute `systemctl`, add automatic repair, replay the browser-runtime demo, add persistence hardening, denial recovery, duplicate-click handling, plugin/runtime adapter work, arbitrary host control, or broader mutation.

Systemd next repair task route checkpoint:

After `openclaw-systemd-next-repair-dry-run` passes, `openclaw-systemd-next-repair-task-route` may decide whether an approval-gated task shell can be materialized for the selected `openclaw-system-sense.service` repair.

Decision:

Select Track A, `openclaw-systemd-next-repair-task-shell`, as the next slice.

This checkpoint is allowed because the dry-run is visible and non-mutating, but task creation and approval creation still need an explicit route gate:

- Reads the next repair dry-run envelope only.
- Confirms the task shell route is available for `openclaw-system-sense.service`.
- Exposes required-before-task-creation gates and allowed next actions.
- Creates no task, no approval, no command execution, no restart, no host mutation, no scheduler, no recovery action, and no additional ledger write.
- Must not create the task shell, approve the action, execute `systemctl`, add automatic repair, replay the browser-runtime demo, add persistence hardening, denial recovery, duplicate-click handling, plugin/runtime adapter work, arbitrary host control, or broader mutation.

Systemd next repair task shell checkpoint:

After `openclaw-systemd-next-repair-task-route` passes, `openclaw-systemd-next-repair-task-shell` may materialize one approval-gated task shell for the selected `openclaw-system-sense.service` repair.

This checkpoint is allowed because it advances Track A from a read-only route to an operator-visible queued task while still refusing host mutation:

- Reads the next repair task route only.
- Creates one queued `systemd_next_repair_task` with pending high-risk approval for `openclaw-system-sense.service`.
- Exposes the source route, dry-run command, target unit, pending approval, and no-execution boundary in Core and Observer.
- Creates a task and approval only; it does not approve, execute a command, restart a service, recover a failed task, schedule follow-up work, mutate the host, or add another ledger write.
- Must not approve the task, execute `systemctl`, add automatic repair, replay the browser-runtime demo, add persistence hardening, denial recovery, duplicate-click handling, plugin/runtime adapter work, arbitrary host control, or broader mutation.

Systemd next repair real execution checkpoint:

After `openclaw-systemd-next-repair-task-shell` passes, `openclaw-systemd-next-repair-real-execution` may prove one operator-approved real execution attempt for `openclaw-system-sense.service`.

This checkpoint is allowed because it is the narrow Track A continuation from approval-gated task materialization to a visible body repair attempt:

- Requires explicit `execute=true` task materialization and a separate approved approval request.
- Executes only `systemctl restart openclaw-system-sense.service`.
- Records command, target, exit code, stdout/stderr, result, rollback note, and before/after body-state verification evidence.
- Exposes Observer-visible real execution intent and result fields.
- Must not add automatic repair, retries, denial recovery, duplicate-click handling, persistence hardening, schedulers, plugin/runtime adapter work, arbitrary host control, or broader mutation.

Systemd next repair demo status checkpoint:

After `openclaw-systemd-next-repair-real-execution` passes, `openclaw-systemd-next-repair-demo-status` may expose a read-only evidence bundle for the completed next repair block.

This checkpoint is allowed because it closes the second Track A repair loop as operator-visible evidence before returning to read-only body memory:

- Reads task history only.
- Summarizes route evidence, approval state, command transcript, exit code, rollback note, and before/after body-state verification for `openclaw-system-sense.service`.
- Exposes Observer-visible readiness and checklist fields.
- Creates no task, no approval, no command execution, no restart, no host mutation, no scheduler, no recovery action, and no additional ledger write.
- Must not add another execution attempt, automatic repair, retries, denial recovery, duplicate-click handling, persistence hardening, schedulers, plugin/runtime adapter work, arbitrary host control, or broader mutation.

Body evidence timeline checkpoint:

After the next repair demo status closes the second Track A repair loop, `openclaw-body-evidence-timeline` may expose a read-only chronological memory spine for OpenClaw body evidence.

This checkpoint is allowed because the whitepaper calls for a resident digital body with persistent self-understanding, and the next useful step is to make prior body evidence navigable before adding durable storage or broader repair mutation:

- Reads dependency map, health trend, route-aware recommendation, conservative recovery policy, body governance readiness, Phase 2 route review, repair candidate demo status, and next repair demo status evidence only.
- Exposes timeline entries, phases, latest entry, source registries, memory purpose, operator use, and no-hidden-mutation boundary.
- Creates no task, no approval, no command execution, no host mutation, no scheduler, no durable storage, and no recovery action.
- Must not add automatic repair, background maintenance, persistence hardening, denial recovery, duplicate-click handling, plugin/runtime adapter work, arbitrary host control, or durable event storage.

Body evidence timeline readiness checkpoint:

After the body evidence timeline passes, `openclaw-body-evidence-timeline-readiness` may close the body evidence memory block with a read-only readiness bundle.

This checkpoint is allowed because the evidence timeline should be summarized and routed before adding durable storage, schedulers, or new mutation:

- Reads body evidence timeline evidence only.
- Exposes required entries, phase coverage, non-mutating governance, memory purpose, completed slices, and next route-review boundary.
- Creates no task, no approval, no command execution, no host mutation, no scheduler, no durable storage, and no recovery action.
- Must not add automatic repair, background maintenance, persistence hardening, denial recovery, duplicate-click handling, plugin/runtime adapter work, arbitrary host control, or durable event storage.

Systemd repair candidate assessment checkpoint:

After the next capability route review selects Track A, `openclaw-systemd-repair-candidate-assessment` may rank OpenClaw-owned systemd units as read-only repair candidates.

This checkpoint is allowed because it resumes real NixOS/systemd repair semantics without immediately broadening mutation:

- Reads systemd inventory, dependency map, and health trend evidence only.
- Exposes candidate score, impact class, health signal, existing demo target flag, recommended unit, and next plan-only boundary.
- Creates no task, no approval, no command execution, no host mutation, no scheduler, and no recovery action.
- Must not add automatic repair, background maintenance, persistence hardening, denial recovery, duplicate-click handling, plugin/runtime adapter work, or arbitrary host control.

Systemd repair candidate plan checkpoint:

After candidate assessment passes, `openclaw-systemd-repair-candidate-plan` may convert the selected candidate into a plan-only repair scope.

This checkpoint is allowed because it advances Track A repair semantics from candidate assessment to operator-reviewable plan shape without creating executable work:

- Reads repair candidate assessment evidence only.
- Exposes selected unit, command preview, planned review steps, required-before-execution gates, and Observer visibility boundary.
- Creates no task, no approval, no command execution, no host mutation, no scheduler, and no recovery action.
- Must not add automatic repair, background maintenance, persistence hardening, denial recovery, duplicate-click handling, plugin/runtime adapter work, or arbitrary host control.

Systemd repair candidate task route checkpoint:

After the candidate plan is visible in Observer, `openclaw-systemd-repair-candidate-task-route` may decide whether the selected candidate can use an existing operator-reviewed repair task shell.

This checkpoint is allowed because it checks the route before task materialization:

- Reads repair candidate plan evidence only.
- Exposes target unit, existing-route availability, required-before-task-creation gates, allowed next actions, and task-shell boundary.
- Creates no task, no approval, no command execution, no host mutation, no scheduler, and no recovery action.
- Must not add automatic repair, background maintenance, persistence hardening, denial recovery, duplicate-click handling, plugin/runtime adapter work, or arbitrary host control.

Systemd repair candidate task shell checkpoint:

After the candidate task route passes, `openclaw-systemd-repair-candidate-task-shell` may materialize the candidate as an approval-gated task shell using the existing operator-reviewed repair route.

This checkpoint is allowed because it advances Track A from visible route gate to task materialization while still stopping before approval and execution:

- Reads candidate task route evidence and reuses the existing browser-runtime repair execution task shell.
- Creates a queued task and pending approval, but does not approve, execute, mutate host, schedule work, or trigger recovery.
- Exposes Observer controls for the candidate task shell so the operator can see the route, target, pending-approval boundary, and no-mutation guarantee before materialization.
- Must remain limited to `openclaw-browser-runtime.service` until a future route review explicitly accepts another unit.
- Must not add automatic repair, background maintenance, persistence hardening, denial recovery, duplicate-click handling, plugin/runtime adapter work, or arbitrary host control.

Systemd repair candidate readiness checkpoint:

After the candidate task shell is visible in Observer, `openclaw-systemd-repair-candidate-readiness` may close this Track A candidate block with a read-only readiness bundle.

This checkpoint is allowed because it prevents drift: the candidate block must be summarized and routed before any approval/execution broadening:

- Reads candidate assessment, candidate plan, candidate task route, and candidate task shell boundary evidence only.
- Exposes completed slices, passed checks, selected unit, no-mutation governance, and the next route-review boundary.
- Creates no task, no approval, no command execution, no host mutation, no scheduler, and no recovery action.
- Must not add automatic repair, background maintenance, persistence hardening, denial recovery, duplicate-click handling, plugin/runtime adapter work, or arbitrary host control.

Systemd repair candidate route review checkpoint:

After candidate readiness passes, `openclaw-systemd-repair-candidate-route-review` may decide the next step for the completed candidate repair block.

Decision:

Select Track B, `openclaw-systemd-repair-candidate-demo-status`, as the next slice.

This checkpoint is allowed because the candidate repair route has reached a safe task-shell boundary, and the whitepaper-aligned next gain is to make the completed route understandable to the operator before adding any duplicate approval/execution branch:

- Reads candidate readiness evidence only.
- Selects a read-only candidate demo status bundle as the next slice.
- Explains why candidate-specific approval replay, real execution replay for the same browser-runtime target, broader systemd mutation, plugin/runtime adapter work, persistence hardening, denial recovery, and duplicate-click handling are not selected.
- Creates no task, no approval, no command execution, no host mutation, no scheduler, and no recovery action.
- Must not add automatic repair, background maintenance, persistence hardening, denial recovery, duplicate-click handling, plugin/runtime adapter work, or arbitrary host control.

Systemd repair candidate demo status checkpoint:

After candidate route review selects the demo-status route, `openclaw-systemd-repair-candidate-demo-status` may expose the completed candidate repair route as an operator-readable evidence bundle.

This checkpoint is allowed because it turns the completed candidate route into a clear demo surface without replaying approval or execution:

- Reads candidate readiness, candidate route review, and candidate task route evidence only.
- Exposes demo readiness, checklist, selected unit, command preview, route status, speaking points, and no-hidden-mutation boundary.
- Creates no task, no approval, no command execution, no host mutation, no scheduler, and no recovery action.
- Must not add automatic repair, background maintenance, persistence hardening, denial recovery, duplicate-click handling, plugin/runtime adapter work, candidate-specific approval replay, real execution replay, or arbitrary host control.

## Phase 2 Gate

Before implementing any Phase 2 feature, confirm:

- Phase 1 release exit remains passed.
- The next slice appears in this plan.
- The slice improves body capability, demo experience, or body governance.
- The slice is not merely hardening, persistence, denial recovery, or plugin/runtime adapter boundary work.

## Canonical Planning Check

Run:

```bash
OPENCLAW_MILESTONE_CHECKS=openclaw-phase-2-plan npm run dev:milestone-check:unix
```
