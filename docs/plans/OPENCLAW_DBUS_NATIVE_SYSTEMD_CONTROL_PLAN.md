# OpenClaw Native D-Bus Systemd Control Plan

## Purpose

Advance kernel-whitepaper Phase B by replacing command-line `systemctl`
wrappers with a native Node.js D-Bus boundary. Start with real read-only systemd
unit inventory from the local system bus, then prove fixed Polkit-authorized
restarts through the existing governed repair lifecycle and expose bounded
resource-pressure evidence for the same fixed body units.

The fixed restarts are now owned by a dedicated `openclaw-hostd` system service.
Core reaches it through a bounded Unix socket protocol, and hostd accepts only
the three descriptor-backed OpenClaw restart capabilities for system-sense,
event-hub, and system-heal. This boundary remains deliberately smaller than a
general systemd RPC surface.

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
- The system-sense Nix closure contains 24 reviewed runtime source files plus
  the lockfile-pinned production D-Bus dependency and excludes Puppeteer and
  workspace development packages.

## Completed First Slice

The read-only native inventory slice is complete. System-sense now uses only
`org.freedesktop.systemd1.Manager.GetUnit` and
`org.freedesktop.DBus.Properties.GetAll`, retains only a fixed property
allowlist, and closes the bus after each inventory. The public route and
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
   no-argument restart capabilities for `openclaw-system-sense.service`,
   `openclaw-event-hub.service`, and `openclaw-system-heal.service`, and invokes only
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
core/Observer milestones prove the owner/socket contract for the fixed target
set. No new public route or arbitrary privileged API was added.

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
`OPENCLAW_SYSTEMD_NEXT_REPAIR_TARGET_UNIT` selector for any descriptor entry,
defaulting to `openclaw-system-sense.service`. Each check derives the expected
operation and capability id from that same fixed mapping and verifies the task,
native mutation, and command transcript agree. The shared host-mutation guard
still refuses `execute:true` unless an intentional VM lane sets its explicit
allow flag; the intentional 2026-07-17 VM lane used that guard and completed
all three target checks.

## Sixth Slice: Fixed System-Heal Recovery

The system-heal service is a declared system-owned body component that depends
on event-hub and system-sense, but the fixed hostd recovery contract previously
could not restore it when its process was inactive. This slice reuses the same
descriptor, native D-Bus helper, high-risk approval, Operator Step/Run, and
post-restart readiness path for one additional fixed target:

```text
Observer selects openclaw-system-heal.service
-> Core verifies the native systemd inventory and descriptor binding
-> explicit approval remains required
-> hostd invokes only RestartUnit with no arguments
-> Core verifies the changed PID and system-heal readiness
```

The capability is `restart_system_heal` / `hostd.restart_system_heal` and is
allowlisted only for `openclaw-system-heal.service`. It adds no new route,
system-heal mutation API, automatic recovery, command fallback, arbitrary
unit input, or user-supplied D-Bus argument. The system-heal owner's own
maintenance operations remain simulated; this target only restores its fixed
service process through the existing governed host boundary. On 2026-07-17 the
Core check verified PID `191453 -> 196563`, and the Observer check verified
`196563 -> 196638`; both completed through `hostd.restart_system_heal`, native
D-Bus, explicit approval, Operator Step/Run, and restored-readiness evidence.

The non-mutating `next-repair-task-shell` Core and Observer checks no longer
bootstrap the historical body-evidence ledger or request `execute:true` as an
unrelated prerequisite. They now prove the task route directly: a queued
approval-gated task is created and Operator Step remains blocked before
approval. The real-execution checks retain their explicit host-mutation guard
and are the only checks that perform the fixed restart.

## Seventh Slice: Bounded Journal Evidence

The fixed restart path now has the missing operator readback needed to explain
why a body unit is unhealthy. System-sense exposes
`GET /system/systemd/journal-evidence` through a dedicated read-only owner. The
request must name one of the configured OpenClaw system-manager units, and the
line count is clamped to a small fixed budget. The owner invokes only a fixed
JSON `journalctl` shape, filters entries back to the requested unit, bounds the
message field, and redacts credential-like values before returning evidence.

The NixOS system-sense service receives the explicit `journalctl` store path and
the standard `systemd-journal` read group. This is a read authority for bounded
body diagnosis, not a hostd mutation authority. Observer renders the selected
unit, line budget, availability, sanitized messages, command-binding state, and
the unchanged `hostMutation=false` boundary; the refresh is manual after the
initial read so the UI does not poll system logs continuously.

Core and Observer journal-evidence checks run on the physical host in an
isolated dev-service run with a private event log. They prove actual journal
availability, fixed arguments, non-allowlisted-unit rejection, sanitized
readback, generated client syntax, and no task, approval, restart, activation,
or rollback. The route remains unavailable rather than widening its allowlist
when manager ownership is unknown.

## Deferred

- D-Bus start/stop/reload operations and restart targets outside the three fixed
  descriptor entries.
- Any hostd capability beyond the fixed system-sense, event-hub, and system-heal restarts,
  including arbitrary unit names, methods, arguments, or caller-supplied D-Bus
  paths.
- Additional eBPF event kinds beyond the existing bounded process-exec slice,
  and real Phase D generation activation or rollback.

## Eighth Slice: Incident Repair Loop

The fixed Level 3 repair path now binds diagnosis, mutation, and application
health in one existing task lifecycle. Before hostd is contacted, Core captures
the selected target's native unit state, its actual `/system/health` service
entry, and a compact summary of the bounded journal response. Journal messages
remain transient: the task stores only registry, availability, counts, latest
timestamp, and error code.

Core then dispatches exactly once through the existing descriptor-backed hostd
owner. Post-verification polls both native `loaded/active/running` state and the
selected service health key (`systemSense`, `eventHub`, or `systemHeal`). A
successful D-Bus job no longer completes the repair when application health is
still false. The final incident receipt binds task and execution step, fixed
target, pre-health, compact journal evidence, native hostd job/PID evidence,
post-health, and `restoredHealthy` under a content hash. Observer renders that
same receipt through the existing task detail surface.

This slice adds no hostd operation, systemd target, journal query shape,
automatic restart, retry, scheduler, activation, or rollback authority. Focused
tests use an injected hostd client and prove target-specific health mapping,
bounded readiness polling, journal-message non-persistence, successful receipt
binding, and fail-closed handling when systemd is running but the application
remains unhealthy. Installed real-mutation checks are updated as future release
gates but are not executed on the sole physical host.

## Ninth Slice: Governed Incident AI Handoff

The compact incident receipt now enters the existing explicitly approved
DeepSeek handoff through
`OPENCLAW_SYSTEMD_INCIDENT_AI_HANDOFF_PLAN.md`. Core verifies the terminal
repair task and receipt hash, projects only bounded health, journal counts,
native mutation summary, and restored state, and binds the exact generated
request before approval. Operator execution reconstructs the same request from
the authoritative source task and fails closed on source or projection drift.

This slice reuses `engineering_recommendation_v0`; it does not create a
systemd-specific provider schema. Journal messages, service URLs, errors,
credentials, hostd invocation identity, and raw job paths do not leave the
host. The recommendation remains transient and cannot create or approve a
repair task, invoke hostd, retry a restart, activate a generation, or roll back
the host. No real provider contact was executed on the sole physical host.

## Tenth Slice: Resource Pressure Observation

The physical host previously experienced a near-exhausted-memory event that
terminated a terminal process, while the body inventory could report only
service state and PID. The existing native D-Bus owner now projects a fixed
`org.freedesktop.systemd1.Service` property allowlist into
`openclaw-systemd-unit-resource-observation-v0` for each configured body unit.
It reports bounded current/peak/available/effective-limit memory values,
configured `MemoryHigh`/`MemoryMax` state, cumulative CPU use, current/effective
task counts, OOM policy, managed OOM modes, and managed OOM kill count. Unsafe
64-bit values are never serialized as imprecise counters; systemd's unlimited
sentinel becomes an explicit `limited=false` state.

The existing `/system/systemd/units` response owns the per-unit values and a
compact aggregate of current/peak memory, CPU, tasks, configured-limit counts,
and managed OOM kills. User-manager units remain explicitly unobserved from the
system bus. Observer adds current memory, peak memory, and task metrics to the
existing inventory panel and lists each observed unit's current memory without
adding another route or panel family.

This is a Level 3 sensing capability only. It reads no environment, command
line, file content, arbitrary cgroup path, or caller-selected unit; it creates
no task, approval, scheduler, alert, resource limit, process signal, hostd
operation, provider request, or host mutation. Focused projection/adapter/
inspection tests and the existing Core and Observer unit-inventory milestones
prove the fixed allowlist, safe numeric boundary, live D-Bus values, visible
metrics, and `resourceMutation=false` contract.

The final store-native package
`/nix/store/rgg1kz4j6zydwm4cfqgxcd19y0d8n9kr-openclaw-system-sense-0.1.0`
started from its read-only closure and observed resource evidence for all seven
system-manager body units. Its live Core sample had a positive bounded current
memory value, explicit `MemoryMax` unlimited state, and zero managed OOM kills;
these are point-in-time observations, not a health guarantee or configured
resource policy.

## Eleventh Slice: Bounded Resource Trend And Warning

Repeated reads of the existing inventory now retain at most four in-memory
samples per configured unit. Reads closer than one second are deduplicated so
the dependency-map builder cannot manufacture a trend. A first observation or
post-restart observation establishes only a baseline. Later samples report a
warning when memory grows by at least 64 MiB and 25%, or reaches 80% of the
configured/effective limit; 95% utilization or an increased managed OOM kill
count is critical. Fixed reason codes and compact per-unit deltas are returned,
while the history array remains private.

Observer's existing five-second inventory refresh drives the sampling and shows
aggregate status and warning count in the existing panel. The trend is not
persisted, paged, scheduled by Core, or converted into a task, approval,
provider request, process signal, resource limit, or hostd action. An
unavailable observation clears that unit's history, so recovery starts from a
new baseline instead of comparing unrelated processes across an outage.

Focused baseline/growth/limit/OOM/deduplication tests plus the existing Core and
Observer inventory milestones prove the warning behavior and its
`persisted=false`, `hostMutation=false` boundary.

The final store-native package
`/nix/store/igbf34mn19vcmrsnyz7lm07f3kyj7b2v-openclaw-system-sense-0.1.0`
started with the complete trend owner, observed seven system-manager units,
moved from seven baseline samples to a normal second sample, and reported zero
warning/critical units without mutation.

## Twelfth Slice: Declarative Cgroup Envelope

The desktop Nix profile now enables two independent static resource envelopes.
Seven ordinary system-manager body services run in `openclaw-body.slice`; the
session manager, browser runtime, and non-auto-started trusted sidecar run in
the user manager's `openclaw-session.slice`. Each slice declares
`MemoryAccounting=true`, `MemoryHigh=1610612736`,
`MemoryMax=3221225472`, `TasksAccounting=true`, and `TasksMax=1024`. The module
requires the soft memory limit to remain below the hard limit.

The boundary deliberately excludes `openclaw-hostd` and the operator-token and
execution-grant key initializers so resource pressure in the ordinary body does
not remove the fixed recovery or credential bootstrap owners. It adds no
runtime `SetUnitProperties`, arbitrary cgroup input, process signal, hostd
operation, task, approval, provider call, or automatic activation. Resource
trend warning classification now uses `EffectiveMemoryHigh` for soft pressure
and retains `MemoryMax`/`EffectiveMemoryMax` as the critical hard boundary.

The body configuration check builds store-native services and verifies both
slice definitions, all service assignments, and trusted-sidecar assignment.
Focused tests, typecheck, all 891 workspace tests, and both native inventory
milestones pass. The complete physical-host candidate
`/nix/store/9bbc00da4qg5n7v6n05x37azd491dxpn-nixos-system-nixos-26.05.4808.569d57850992`
contains the generated units. Relative to the installed generation it adds the
updated system-sense package, both slice units, and the updated Core package/unit
for disabled-by-default provider configuration. Generated service-unit review
confirms the assignments and the absence of a provider secret. It has not been
switched.

## Next Slice

Freeze the cgroup implementation. A separately authorized physical-host switch
may deploy the exact reviewed candidate, after which only non-mutating checks
should confirm active slice properties, service assignment, service health,
restart counts, and existing anonymous-auth rejection. Do not deliberately
consume memory or force OOM on the sole physical host. After deployment evidence
is recorded, select the next distinct Level 3 capability from the identity
upgrade path instead of adding another resource-envelope wrapper.
