# OpenClaw Native D-Bus Systemd Control Plan

## Purpose

Advance kernel-whitepaper Phase B by replacing command-line `systemctl`
wrappers with a native Node.js D-Bus boundary. Start with real read-only systemd
unit inventory from the local system bus, then prove fixed Polkit-authorized
restarts through the existing governed repair lifecycle.

The fixed restarts are now owned by a dedicated `openclaw-hostd` system service.
Core reaches it through a bounded Unix socket protocol, and hostd accepts only
the two descriptor-backed OpenClaw restart capabilities for system-sense and
event-hub. This boundary remains deliberately smaller than a general systemd
RPC surface.

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

The fixed native restart owner split and the original system-sense restart are
proven in the switched VM generation. This slice extends the same contract to
the fixed event-hub target; its protocol, task, hostd, Nix, and Polkit evidence
is locally proven below, with the real event-hub mutation validated by a
separate explicit operator-approved VM check.

1. Desktop system services run as the dedicated `openclaw-service` account
   instead of root; session-manager and browser-runtime remain user-manager
   services.
2. A dedicated `openclaw-hostd` store-native service account owns the fixed
   hostd process and its Polkit subject. It accepts only the descriptor-backed
   no-argument restart capabilities for `openclaw-system-sense.service` and
   `openclaw-event-hub.service`, and invokes only
   `org.freedesktop.systemd1.Manager.RestartUnit` with mode `replace`.
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
non-retrying recovery recommendation. The hostd socket keeps its response side
open after the core client half-closes its line-delimited request, so delayed
native D-Bus results cannot be dropped; a delayed-handler socket regression
proves that boundary. A restart-race test proves one transient post-restart
fetch failure is absorbed without a second mutation. The auth-delegation and
full body-config gates prove Nix/Polkit evaluation and all store closures. The
existing core and Observer real-execution milestones now require successful
native transport rather than accepting a failed attempt.

The switched generation proves the original system-sense execution through the
core and Observer milestones: both returned exit zero, an
`org.freedesktop.systemd1` job path, changed positive main PIDs, restored
readiness, `polkit-dbus-fixed-unit`, and the fixed hostd store closure with no
sudo or direct systemctl execution. Core ran as `openclaw-service` while the
Polkit subject and hostd process ran as `openclaw-hostd`. On 2026-07-17 the
same generation also proved the event-hub extension through both real-execution
milestones: Core changed the target PID from `191346` to `191587`, and the
Observer check changed it from `191587` to `191671`. Both checks validated the
descriptor capability `hostd.restart_event_hub`, native D-Bus transport,
changed-PID evidence, and restored readiness.

## Completed Hostd Boundary

`openclaw-hostd` is now a separate system service with a read-only Nix closure,
an `AF_UNIX` socket, and an independent `openclaw-hostd` service identity. Core
continues to run as `openclaw-service`; the socket uses the shared `openclaw`
group for request submission, while only the hostd identity matches the fixed
Polkit rule. The accepted socket FD now passes through a fixed Nix-native
`SO_PEERCRED` helper that matches `openclaw-service` and `openclaw` before the
request handler runs. The protocol rejects unknown fields, arbitrary units,
arbitrary methods, non-descriptor operations, and mismatched peer identities.
The shared JSON descriptor is the source for the runtime allowlist; the Nix
module expands the same fixed units into the Polkit rule. The
hostd response carries the request id, owner, transport, method, unit, job path,
before/after PID evidence, and compact kernel-peer verification state; the core
client rejects a response whose request id or peer evidence does not match the
request it sent.

Focused hostd tests, core executor tests, auth-delegation checks, Nix closure
builds, body configuration, a real helper socket check, and the switched
core/Observer milestones prove the owner/socket contract for both fixed
targets. No new public route or arbitrary privileged API was added.

## Third Slice: Live Dependency Evidence

The existing body dependency map previously described only the declarative
`serviceSpecs.after` plan. That is insufficient when system and user service
managers own different components: the plan can name a cross-manager edge that
the running systemd manager cannot actually materialize.

The system-sense D-Bus adapter now reads the bounded `Unit.After` property in
the same fixed `GetAll` call used by the read-only inventory. It retains only
relationships between the nine allowlisted OpenClaw service units. The existing
dependency-map route keeps its compatibility `upstream`/`edges` fields tied to
the declarative plan, and adds `observedUpstream`, `observedDownstream`,
`observedEdges`, dependency evidence source, and compact plan-drift counts.
Observer renders that evidence in the existing Body Dependency Map panel.

This remains read-only: it adds no D-Bus mutation method, hostd operation,
approval, task, command fallback, persistence, or arbitrary unit input. A bus
failure leaves the observed dependency fields unavailable and preserves the
existing planned map with explicit `service_specs_after` evidence.

The native systemd inventory and Observer milestones prove the live
`openclaw-core.service` -> `openclaw-event-hub.service` edge and expose the
number of observed nodes and declarative drift nodes from the switched VM.

## Fourth Slice: Manager Scope Reconciliation

The live dependency evidence exposed a second operator ambiguity: the system
bus can observe a stale or duplicated unit name that is supposed to belong to
the login user's manager, while a genuinely missing system unit must remain an
error. The desktop Nix profile now injects the declared user-owned unit names
into the body environment. System-sense reconciles that declaration with its
system-bus observation and reports `expectedManager`, `observedManager`, and a
bounded `managerScopeStatus` per unit, plus compact matched/mismatch/unresolved
counts in the existing inventory response.

This is still read-only and system-bus scoped. It does not claim that a user
unit is healthy merely because it is absent from the system bus; it reports
`not_observed_on_system_bus` and leaves user-manager observation to the existing
login-session ownership path. Unexpected system copies are explicit
`unexpected_system_unit` evidence. No user-bus proxy, hostd operation, new
D-Bus method, task, approval, mutation, or route was added.

## Fifth Slice: Fixed Event-Hub Recovery

The system-sense restart was sufficient to prove the first native mutation, but
it could not recover its upstream event hub even though the existing inventory
and dependency map identify `openclaw-event-hub.service` as a foundational body
unit. This slice closes that concrete Level 3 gap through the same lifecycle:

```text
Observer selects fixed event-hub target
-> Core re-reads native unit inventory
-> queued approval-gated next-repair task records capability binding
-> explicit approval and Operator Step/Run remain required
-> Core sends the descriptor operation through hostd
-> hostd verifies peer identity and exact target before native D-Bus restart
-> post-verification reports event-hub state and changed PID
```

The shared descriptor is
`packages/shared-systemd/src/openclaw-hostd-capabilities.json`. The default
system-sense route remains backward compatible. Unknown units, operation/target
mismatches, direct systemctl fallback, automatic restart, arbitrary D-Bus
arguments, and user-owned units remain rejected. Focused Core/hostd tests prove
the positive event-hub path and negative allowlist/peer boundaries. The
2026-07-17 Core and Observer checks prove the explicit real host mutation and
post-restart readiness through the existing approval and Operator Step/Run
lifecycle.

The existing core and Observer real-execution checks now accept the bounded
`OPENCLAW_SYSTEMD_NEXT_REPAIR_TARGET_UNIT` selector for either descriptor entry,
defaulting to `openclaw-system-sense.service`. Each check derives the expected
operation and capability id from that same fixed mapping and verifies the task,
native mutation, and command transcript agree. The shared host-mutation guard
still refuses `execute:true` unless an intentional VM lane sets its explicit
allow flag; the intentional 2026-07-17 VM lane used that guard and completed
both target checks.

## Deferred

- D-Bus start/stop/reload operations and restart targets outside the two fixed
  descriptor entries.
- Any hostd capability beyond the fixed system-sense and event-hub restarts,
  including arbitrary unit names, methods, arguments, or caller-supplied D-Bus
  paths.
- eBPF kernel event transport and declarative Nix self-evolution.

## Next Slice

The fixed Level 3 hostd socket contract and real VM evidence are complete for
both allowlisted restart capabilities. Future work must keep the native helper,
exact user/group match, compact verified/matched readback, and
descriptor-bound target. Continue with a separately justified capability behind
the existing hostd owner; do not broaden this fixed restart into an arbitrary
systemd control API.
