# OpenClaw Native D-Bus Systemd Control Plan

## Purpose

Advance kernel-whitepaper Phase B by replacing command-line `systemctl`
wrappers with a native Node.js D-Bus boundary. Start with real read-only systemd
unit inventory from the local system bus; privileged mutation and Polkit policy
remain separate later slices.

## Phase A Prerequisite

Phase A is complete: all nine main services and the non-auto-started trusted
sidecar template execute from reviewed read-only Nix store closures while state,
logs, browser profiles, and recovery intent remain on explicit writable paths.
The `dev-body-config-check.sh` milestone builds every closure, evaluates every
unit, and runs representative behavior from each store path.

## Existing Command Seams

- Read-only inventory no longer invokes `systemctl`; native D-Bus is the only
  transport and bus loss fails closed.
- The running VM generation still contains the historical fixed browser-runtime
  `systemctl`/sudo helper in `/etc/nixos/configuration.nix`. The repository
  profile no longer generates that path, but runtime removal requires a NixOS
  generation switch.
- Existing repair proposals, approvals, audit evidence, Observer routes, and
  fail-closed behavior must remain stable while transport changes underneath.

## First Slice: Read-Only Native Inventory

1. Add one maintained Node D-Bus client as an explicit system-sense production
   dependency and package it reproducibly from the committed lockfile.
2. Introduce a cohesive systemd D-Bus adapter that connects to the local system
   bus and reads unit properties without shelling out.
3. Inject that adapter into the existing systemd inspection owner; preserve the
   current inventory response and Observer contract rather than adding a new
   readiness route.
4. Keep the current command adapter only until native inventory equivalence is
   proven on the VM, then remove it and fail closed when D-Bus is unavailable.
5. Prove at least one real OpenClaw unit inventory result through D-Bus and
   attach transport evidence to the existing readback.

## Boundaries

- Identity route: first bounded Level 3 substrate, still initiated by the
  existing user-space control plane.
- No service restart/start/stop/reload through D-Bus in the first slice.
- No root daemon, hostd, Polkit rule, sudo expansion, password prompt, or new
  privileged socket.
- No arbitrary bus name, object path, interface, method, or unit supplied by an
  external request.
- No removal of the existing approved repair path until native mutation has its
  own policy, authorization, audit, recovery, and VM proof.

## Evidence

- Focused adapter and inspection unit tests prove the fixed read-only method set,
  bounded unit names, property allowlist, native-first behavior, and fail-closed
  handling without command fallback.
- `dev-openclaw-systemd-unit-inventory-check.sh` proves all nine unit records and
  a real `loaded/active/running` core unit through `dbus_native` transport.
- `dev-observer-openclaw-systemd-unit-inventory-check.sh` proves the same native
  evidence remains visible through the existing Observer panel.
- The system-sense Nix closure contains 22 reviewed runtime source files plus
  the lockfile-pinned production D-Bus dependency and excludes Puppeteer and
  workspace development packages.

## Completed First Slice

The read-only native inventory slice is complete. System-sense now uses only
`org.freedesktop.systemd1.Manager.GetUnit` and
`org.freedesktop.DBus.Properties.GetAll`, retains only eight allowlisted unit
properties, and closes the bus after each inventory. The public route and
Observer contract are unchanged, while response evidence identifies
`source.transport = "dbus_native"` and contains no read-only command evidence.
If the system bus is unavailable, inventory remains planned and unobserved; it
does not shell out to `systemctl`.

## Second Slice: Fixed Native Restart

The repository implementation is complete but not yet loaded into the running
VM generation:

1. Desktop system services run as the dedicated `openclaw-service` account
   instead of root; session-manager and browser-runtime remain user-manager
   services.
2. A no-argument store-native helper invokes only
   `org.freedesktop.systemd1.Manager.RestartUnit` for
   `openclaw-system-sense.service` with mode `replace`.
3. The helper waits for the unit to return to `active/running` with a different
   main PID, then returns compact job and before/after evidence.
4. Polkit grants only `org.freedesktop.systemd1.manage-units` when unit,
   verb, and subject match that fixed restart and service account.
5. Core reuses the existing next-repair proposal, high-risk approval, operator
   step, audit, post-verification, and Observer path. There is no direct
   `systemctl` or sudo fallback; unmatched targets fail closed.
6. Store-native core execution resolves body-ledger readiness and writes through
   `OPENCLAW_BODY_EVIDENCE_LEDGER_DIR` at
   `/var/lib/openclaw/body-evidence-ledger`; public evidence continues to use
   the stable `.artifacts/openclaw-body-evidence-ledger` display path.

Focused tests prove the exact D-Bus message, no-argument boundary, PID-change
verification, production helper subprocess bridge, and negative fallback. The
auth-delegation and full body-config gates prove Nix/Polkit evaluation and all
store closures. The existing core and Observer real-execution milestones now
require successful native transport rather than accepting a failed attempt.

## Deferred

- D-Bus start/stop/reload operations and any restart target other than the fixed
  system-sense unit.
- Loading and proving the repository Polkit rule in the running VM generation.
- Dedicated `openclaw-hostd` ownership boundary.
- Removal of the historical fixed sudo repair helper from the active host
  configuration/generation.
- eBPF kernel event transport and declarative Nix self-evolution.

## Next Slice

Switch a host generation that imports this profile, remove the historical
browser-runtime sudo helper from the host configuration, and run the existing
core plus Observer next-repair real-execution milestones. Completion requires
`dbus_native`, Polkit mode, exit zero, a systemd job path, changed PID, restored
health, no password prompt, and no sudo/systemctl execution evidence.
