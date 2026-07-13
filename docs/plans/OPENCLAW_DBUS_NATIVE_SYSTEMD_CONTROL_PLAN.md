# OpenClaw Native D-Bus Systemd Control Plan

## Purpose

Advance kernel-whitepaper Phase B by replacing command-line `systemctl`
wrappers with a native Node.js D-Bus boundary. Start with real read-only systemd
unit inventory from the local system bus, then prove one fixed Polkit-authorized
restart through the existing governed repair lifecycle.

The fixed restart is now owned by a dedicated `openclaw-hostd` system service.
Core reaches it through a bounded Unix socket protocol, and hostd accepts only
the fixed system-sense restart capability. This boundary is deliberately
smaller than a general systemd RPC surface.

## Phase A Prerequisite

Phase A is complete: all nine main services and the non-auto-started trusted
sidecar template execute from reviewed read-only Nix store closures while state,
logs, browser profiles, and recovery intent remain on explicit writable paths.
The `dev-body-config-check.sh` milestone builds every closure, evaluates every
unit, and runs representative behavior from each store path.

## Existing Command Seams

- Read-only inventory no longer invokes `systemctl`; native D-Bus is the only
  transport and bus loss fails closed.
- The historical host-local browser-runtime `systemctl`/sudo helper and global
  environment overrides have been removed from the switched VM generation.
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

## First-Slice Boundaries (Historical)

The following limits governed the initial read-only inventory slice. The later
fixed restart slice has its own hostd, approval, Polkit, audit, and VM evidence.

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

The fixed native restart behavior was proven in the running VM generation. This
follow-up tightens its owner split before the next generation is switched:

1. Desktop system services run as the dedicated `openclaw-service` account
   instead of root; session-manager and browser-runtime remain user-manager
   services.
2. A dedicated `openclaw-hostd` store-native service account owns the fixed
   hostd process and its Polkit subject. It accepts one no-argument restart
   capability and invokes only
   `org.freedesktop.systemd1.Manager.RestartUnit` for
   `openclaw-system-sense.service` with mode `replace`.
3. The helper waits for the unit to return to `active/running` with a different
   main PID, then returns compact job and before/after evidence.
4. Polkit grants only `org.freedesktop.systemd1.manage-units` when unit,
   verb, and subject match that fixed restart and the `openclaw-hostd` service
   account. The Unix socket remains group-readable/writable by the existing
   `openclaw` service group so core can submit approved requests.
5. Core reuses the existing next-repair proposal, high-risk approval, operator
   step, audit, post-verification, and Observer path, reaching hostd over its
   Unix socket. There is no direct `systemctl` or sudo fallback; unmatched
   targets fail closed.
6. Store-native core execution resolves body-ledger readiness and writes through
   `OPENCLAW_BODY_EVIDENCE_LEDGER_DIR` at
   `/var/lib/openclaw/body-evidence-ledger`; public evidence continues to use
   the stable `.artifacts/openclaw-body-evidence-ledger` display path.
7. Post-verification evaluates the selected unit rather than the historical
   browser-runtime health field. Completion requires native mutation evidence
   plus an observed `loaded/active/running` target; failure records an
   operator-reviewed declarative-generation recovery recommendation without an
   automatic second restart.
8. Because systemd can report the restarted Node service as running before its
   HTTP listener is ready, post-verification performs a bounded readiness poll
   of the existing read-only inventory route. It never repeats `RestartUnit`.

Focused tests prove the exact D-Bus message, no-argument boundary, PID-change
verification, production helper subprocess bridge, negative fallback, and
non-retrying recovery recommendation. A restart-race test proves one transient
post-restart fetch failure is absorbed without a second mutation. The
auth-delegation and full body-config gates prove Nix/Polkit evaluation and all
store closures. The existing core and Observer real-execution milestones now
require successful native transport rather than accepting a failed attempt.

Existing real VM evidence proves two separately approved executions, one through
the core milestone and one through the Observer milestone. Both returned exit
zero, an `org.freedesktop.systemd1` job path, changed positive main PIDs,
restored readiness, `polkit-dbus-fixed-unit`, and the fixed hostd store closure
with no sudo or direct systemctl execution. That evidence predates the owner
split below; the switched generation must rerun the real-execution checks before
the new service-account combination is called VM-proven.

## Completed Hostd Boundary

`openclaw-hostd` is now a separate system service with a read-only Nix closure,
an `AF_UNIX` socket, and an independent `openclaw-hostd` service identity. Core
continues to run as `openclaw-service`; the socket uses the shared `openclaw`
group for request submission, while only the hostd identity matches the fixed
Polkit rule. The protocol rejects unknown fields, arbitrary units, arbitrary
methods, and non-fixed operations. The hostd response carries the request id,
owner, transport, method, unit, job path, before/after PID evidence, and the
truthful group-socket caller boundary; the core client rejects a response whose
request id does not match the request it sent.

Focused hostd tests, core executor tests, auth-delegation checks, Nix closure
builds, and the body configuration check prove the local owner/socket contract.
The next switched VM must additionally prove that `openclaw-hostd` is the live
Polkit subject while core remains `openclaw-service`. No new public route or
arbitrary privileged API was added.

## Deferred

- D-Bus start/stop/reload operations and any restart target other than the fixed
  system-sense unit.
- Any hostd capability beyond the fixed system-sense restart, including
  arbitrary unit names, methods, arguments, or caller-supplied D-Bus paths.
- Kernel-level peer credential verification for the Unix socket remains a
  separate hardening slice; the current boundary relies on the Nix/systemd
  socket owner/group and keeps that limitation explicit in response evidence.
- eBPF kernel event transport and declarative Nix self-evolution.

## Next Slice

Continue with the selected Level 2 trusted work-view/session-helper route. Any
future Level 3 slice must add a separately justified capability behind the
existing hostd owner; do not broaden this fixed restart into an arbitrary
systemd control API.
