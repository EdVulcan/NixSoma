# Phase C Kernel Activity Snapshot Plan

Status: source, closure, Observer, disposable-KVM acceptance, and physical
deployment complete, 2026-07-31

## Purpose

Turn the three completed Phase C body nerves into one operator-visible body
state without adding another kernel hook. One explicit request starts the
existing process-exec, network connect-attempt, and file open-attempt captures
in parallel and returns only a compact three-lane snapshot.

## Capability Contract

- Endpoint: `/system/kernel/activity-snapshot` through System Sense and the
  existing Core read-only proxy.
- Trigger: explicit Observer button or exact GET; the aggregate function is not
  registered in Observer's five-second refresh interval.
- Capture owners: the existing three probe owners remain unchanged and retain
  their own limits, field validation, and continuity state.
- Aggregate concurrency: one snapshot at a time. A concurrent aggregate request
  returns `busy`; a busy or unavailable underlying lane produces truthful
  `partial` or `unavailable` state without retry.
- Returned data: lane registry/status/availability, event and unique-value
  counts, plus compact continuity status/sequence/activity/new-comm count.
- Explicit omissions: raw events, comm names/count lists, executable identity,
  address/family values, file flags/mode/path/name/content/result, and capture
  timestamps.
- Governance: read-only, in-memory, no persistence, no automatic repeat, no
  provider/browser activity, no policy execution, and no host mutation.

## Evidence

- `kernel-activity-snapshot.test.mjs` proves complete/partial/busy behavior,
  simultaneous invocation, compact projection, and private-field omission.
- System Sense and Core production-shape route tests prove the exact existing
  proxy path.
- Observer assembly tests prove the explicit button and absence from automatic
  intervals.
- `openclaw-kernel-activity-snapshot` and its Observer pair passed on physical
  generation `52s1asvy...`. The Core gate captured 62 process, 46 network, and
  128 file events; the Observer gate captured 240 aggregate events with all
  three lanes available.
- `checks.x86_64-linux.openclaw-kernel-activity-snapshot-vm` is the disposable
  KVM release gate for all three real probes in one capture window. It passed
  with 208 compact events: 40 process exec, 40 network connect-attempt, and 128
  file open-attempt events. All three lanes were available and captured while
  raw metadata, persistence, automatic repeat, provider/browser activity, and
  host mutation remained false.
- The store-native body configuration check passed with the staged System Sense
  and Observer closures.

## Deliberately Deferred

- a fourth eBPF hook or widened event fields;
- continuous background aggregate capture or automatic retries;
- raw-event aggregation, persistence, black-box storage, or cross-restart
  continuity;
- anomaly inference, policy enforcement, actions, provider assessment, browser
  work, and host mutation;
- physical rollback.

## Stop Condition

This aggregate is frozen after focused, closure, disposable-KVM, and physical
evidence passed. The next canonical review must choose a distinct operator
capability, not another snapshot variant.

## Physical Closure

Candidate
`/nix/store/52s1asvywh94dsl76kvjacn4i1hpkmhc-nixos-system-nixos-26.05.4808.569d57850992`
matched the current physical marker and exact kernel, initrd, fstab, GDM,
NetworkManager, and SSH store targets. Its 1832-path closure replaced only the
Core, System Sense, and Observer packages/units plus derived `etc`,
`system-units`, and top-level generation paths. The fixed passwordless helper
activated it without reboot as generation 103; generation 102 `qcv5ggpr...` is
the previous generation.

Current and system-profile links match. Boot ID
`9b7f2879-7f4d-4932-997a-1efffc0eff65` remained unchanged. Both installed gates
passed, all nine services and health endpoints remained active, restart counts
and failed-unit counts were zero, and relevant system/user warning journals
were empty. Raw values, persistence, automatic repeat, provider/browser
activity, policy execution, and additional host mutation remained absent.
