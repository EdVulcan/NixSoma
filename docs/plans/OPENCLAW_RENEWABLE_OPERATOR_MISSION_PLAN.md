# Renewable Operator Mission

Updated: 2026-08-01

Status: implemented, source-accepted, and built as a reviewed physical
candidate. Focused Core/Observer tests, production route assembly, real
nine-service Core/Observer development gates, exact Nix closures, and physical
candidate preflight pass. Activation remains a separate operator decision.

## Selected Capability

Lift the finite operator window into a restart-aware renewable mission:

```text
explicit finite mission authority
-> one checkpointed epoch
-> one mission-owned child window using the existing bounded executor
-> progress or no-progress circuit evidence
-> next epoch only while budget and deadline remain valid
```

This is a new Level 1 lifecycle owner, not another task executor. It gives the
operator a directly visible long-running unit of work while preserving a finite
authority envelope.

## Contract

- `POST /operator/mission` requires `confirm=true`, 1-32 epochs, 1-20 steps per
  epoch, a 0-24 hour interval, a 1 second-7 day authority deadline, and a 1-5
  epoch no-progress circuit.
- Before every epoch, Core permanently consumes one epoch budget and persists
  the checkpoint. An interruption cannot restore or replay that consumed
  authority.
- Every epoch creates exactly one mission-owned, one-window child through the
  existing bounded window lease owner. No second task runner, action override,
  URL, policy, approval, provider, root, or host input is accepted.
- Ordinary window ticks and re-arm calls reject mission-owned children; only
  the exact mission id can drive its child window.
- `renew` requires the exact mission id and explicit confirmation. It adds at
  most 32 epochs and seven days per call, with a 256-epoch mission lifetime and
  a 30-day live horizon.
- Pause and cancel settle immediately between epochs or at the current epoch
  boundary. They never abort and retry a partially executed task.
- Core startup pauses active missions, releases non-running child leases, and
  requires an exact explicit re-arm. Consumed epochs remain consumed.
- A cancellation already requested before restart remains terminal; restart
  cannot turn cancellation or authority expiry back into resumable work.
- Two consecutive no-progress epochs open the default circuit. Only an exact
  explicit re-arm with `resetCircuit=true` can clear that circuit.
- Persistence contains counters, timestamps, ids, compact step counts, status,
  and stop reason. It contains no task goal, action payload, input text, pixels,
  provider content, credential, or host mutation authority.
- `services.openclaw.renewableOperatorMission.enable` controls due-time checks
  and defaults to `false`. Enabling the timer never arms a mission.

## Observer

Observer exposes finite arm and renewal parameters, progress percentage,
completed epochs, latest checkpoint, next due time, authority deadline,
no-progress circuit, renewal count, stop reason, and explicit renew/pause/
resume/cancel controls. It always binds actions to the mission id returned by
Core and does not expose the internal tick route.

## Evidence

- Mission unit tests cover finite bounds, exact child ownership, multi-epoch
  completion, renewal, boundary pause, cancellation, restart reconciliation,
  no-progress circuit opening/reset, and default-off timer behavior.
- Runtime-state tests preserve the compact mission checkpoint across restart.
- Production route assembly tests cover read, arm, tick, renew, pause, re-arm,
  and cancel without forwarding execution authority.
- Observer tests cover unit conversion, checkpoint/progress rendering, exact id
  binding, explicit circuit reset, local range rejection, and served panel
  controls.
- `dev-operator-control-check.sh` completed three authorized epochs, consumed
  two real queued tasks, recorded one explicit renewal, reached 100%, then
  proved a second mission paused on Core restart, explicitly re-armed, and
  cancelled. It also rejected an anonymous mission-state read with HTTP 401
  while the authenticated read returned the exact armed mission.
- `dev-observer-operator-check.sh` served the mission panel/client and read the
  default-off supervisor from the real Core route.
- `dev-body-config-check.sh` built exact read-only Core and Observer closures at
  `/nix/store/8h1hy8jz8h1v7ab5wrrad1xcp8v0rscy-openclaw-core-0.1.0` and
  `/nix/store/y5xi43dxg0lpv875sjwfib68hxz7xph3-openclaw-observer-ui-0.1.0`,
  with 280 and 109 files respectively.
- Physical candidate
  `/nix/store/w58x78k1sl78nwjknzpgbs0a0gj5kxzx-nixos-system-nixos-26.05.4808.569d57850992`
  is root-owned and switchable, matches the immutable physical target marker
  and kernel/initrd/fstab/GDM/NetworkManager/SSH protected paths, contains both
  mission modules, and has 1826 closure paths (about 9.2 GiB). Its Core unit
  keeps `OPENCLAW_RENEWABLE_OPERATOR_MISSION_ENABLED=0`. The active generation
  and boot id remained unchanged during build and inspection.

## Deferred

- automatic goal invention, planning, task creation, retry, and open-ended
  backlog growth;
- causal learning, adaptive authority, or provider control of mission budgets;
- arbitrary process/window/desktop/root control and physical host mutation;
- physical timer enablement, mission execution, or NixOS generation activation.

## Stop Condition

Freeze this lifecycle after activation/health review. The next real behavior is
a reviewed finite mission worklist, not another lease, receipt, readiness, or
mission status variant.
