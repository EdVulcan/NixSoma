# Reviewed Finite Mission Worklist

Updated: 2026-08-02

Status: physically deployed. Core ownership, persistence, route assembly,
mission integration, Observer controls, real service gates, exact Nix closures,
guarded activation, and post-switch health evidence pass in generation 111.

## Selected Capability

Give one explicitly armed renewable mission a finite, immutable source of
operator-reviewed browser tasks:

```text
operator reviews 1-16 goal + URL blueprints
-> bind once to one unstarted mission
-> persist an issue checkpoint at an epoch boundary
-> create exactly the next reviewed task through the existing task owner
-> run it through the existing bounded window
-> continue only after its terminal completion
```

This closes finite task supply. It does not add provider-selected goals,
open-ended planning, a second executor, automatic retry, or policy authority.

## Contract

- `POST /operator/mission/:missionId/worklist` requires `confirm=true`, an
  unstarted `armed` or restart-paused mission, no active task, and 1-16 items
  that fit the mission's remaining epoch authority.
- Each item accepts only the existing reviewed browser-task `goal` and
  credential-free HTTP(S) `targetUrl`. Core fixes browser-task type,
  AI-work-view strategy, empty caller actions, task intent, and deterministic
  rule-plan creation.
- Binding persists the bounded reviewed goal/URL blueprints and SHA-256 binding
  hashes but creates no task. The list is immutable; changing it requires
  cancelling the mission and creating a new mission.
- Before task creation, Core permanently marks the next item `issuing` and
  flushes state. A restart during that interval blocks the list and never
  retries or guesses whether creation succeeded.
- At most one item is `issued`. While that task remains queued, running, or
  paused, no later item can be created. Only terminal `completed` advances to
  the next reviewed item.
- Missing, failed, superseded, issue-failed, or unrelated active tasks block the
  worklist and mission. Core never skips or retries an item automatically.
- Mission cancellation closes the worklist. Deadline expiry, finite epoch
  exhaustion, pause, and recoverable circuit blocking preserve it so existing
  explicit renewal or re-arm authority can continue pending reviewed items.
- The existing reviewed browser-task owner publishes task-created/planned and
  approval/reclamation events. Worklist provenance contains only registry,
  mission/worklist/item ids, ordinal, and blueprint hash.
- Worklist state contains reviewed goals and URLs, ids, hashes, status, counts,
  timestamps, and issued task ids. It contains no input value, browser pixels,
  provider content, credential, execution grant, action payload, root, or host
  authority.

## Observer

Observer reuses the existing Task Goal and Desired Work View URL fields. The
operator can add up to 16 local draft items, remove or clear them before
binding, then bind the exact ordered draft once. The deployed read model shows
worklist/mission ids, item/issued/completed counts, current task, next ordinal,
progress, stop reason, and the bounded durable record.

## Evidence

- Focused Core tests cover shared reviewed-task event ownership, zero-task
  binding, one-at-boundary issuance, no duplicate issuance, terminal advance,
  issue checkpoint persistence, failure/unrelated-task blocking, restart
  interruption, cancellation closure, route assembly, and mission stop state.
- Focused Observer tests cover exact mission binding, ordered draft payload,
  duplicate rejection, durable progress rendering, and served panel controls.
- Runtime-state tests preserve mission worklists and issue checkpoints.
- The isolated nine-service `operator-control` gate bound two items while the
  task total remained unchanged, then completed the two exact goals in order
  through two epochs. It ended with two unique completed task ids,
  `bindingCreatedTasks=0`, `automaticRetry=false`, and
  `automaticSkip=false`.
- The served Observer gate contains the reviewed-worklist draft, bind,
  progress, and durable readback controls. The focused suites pass Core
  `85/85`, Observer `9/9`, complete Core package `955/955`, and complete
  Observer package `115/115`; workspace typecheck and shell syntax also pass.
- `@changed` selects exactly `milestone-registry`, `milestone-script-audit`,
  `windows-path-budget`, `openclaw-core-service-unit-tests`, `body-config`,
  `operator-control`, and `observer-operator`. All seven underlying checks
  pass.
- `dev-body-config-check.sh` built read-only Core and Observer packages at
  `/nix/store/r303bl6qb6myqprl3d33j73x7mqw1w5x-openclaw-core-0.1.0` and
  `/nix/store/7prwbg79yay8hyp54krjp5gyxppfkw02-openclaw-observer-ui-0.1.0`
  with exact file counts `282` and `111`.
- The root-owned switchable physical generation is
  `/nix/store/2rg3qq3nzg5yva0z0yg7scs4hb99asl0-nixos-system-nixos-26.05.4808.569d57850992`.
  Its physical target marker and kernel/initrd/fstab/GDM/NetworkManager/SSH
  protected paths matched generation 110 before activation. Its closure has
  1826 paths (about
  9.2 GiB), contains all four new Core/Observer runtime modules, and keeps
  `OPENCLAW_RENEWABLE_OPERATOR_MISSION_ENABLED=0`.
- The fixed generation helper exited 0 and activated it as generation 111.
  `/run/current-system` and the system profile both match the exact store path;
  boot id `6e950d88-62a0-41b6-a17b-8a918b2895f1` did not change. Only Core and
  Observer restarted. GDM, NetworkManager, and SSH retained their existing
  PIDs/start timestamps.
- All nine health endpoints returned HTTP 200. Seven system owners and two
  user owners are active with `NRestarts=0`; system/user failed-unit checks and
  the post-switch error journal are empty. Anonymous mission readback returns
  401, while the deployed operator credential returns the default-off
  supervisor with reviewed-worklist issuance present and open-ended creation
  absent. Deployed Observer HTML/client contain the worklist controls.

## Deferred

- provider-generated goals, plan expansion, worklist append/reorder/edit, or
  dynamic authority changes;
- automatic retry, skip, recovery, approval, assessment acceptance, or mission
  renewal;
- causal ranking, adaptive policy, physical Phase D mutation, arbitrary
  process/window/desktop/root control, or host mutation;
- physical timer enablement or a live physical mission/worklist execution.

## Stop Condition

Source, candidate, activation, and post-switch proof are complete. Freeze this
task-supply lifecycle; do not add another queue/readiness variant. Select the
smallest evidence-based adaptation or richer native workflow that changes real
operator behavior.
