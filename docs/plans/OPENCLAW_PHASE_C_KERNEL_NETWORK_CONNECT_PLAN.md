# Phase C Kernel Network Connect Observation Plan

Status: source implementation, closure validation, focused tests, and
disposable-KVM acceptance complete; physical deployment deferred, 2026-07-31

## Purpose

Extend the existing Level 3 read-only eBPF process-exec nerve with one bounded
network observation capability. The capability answers which local process made
a connect attempt and which numeric address family it used. It is observation
only; it is not a firewall, network policy engine, or packet capture path.

## Identity Alignment

- Whitepaper level: Phase C, second read-only kernel nerve.
- Runtime owner: store-native `openclaw-system-sense`.
- User-visible result: Core and Observer expose a bounded capture and in-memory
  continuity summary for recent connect attempts.
- Privilege boundary: system-sense receives only `CAP_BPF` and `CAP_PERFMON`.
  The probe does not run as root and does not widen hostd authority.
- Physical boundary: the source and disposable KVM gate are evidence only. No
  physical generation switch, reboot, sudo invocation, or host mutation is part
  of this slice.

## Implementation Contract

- Attachment: `fentry/__sys_connect`, selected because the non-root service
  cannot rely on tracefs event-ID reads for the ordinary connect tracepoint.
- Transport: libbpf ring buffer with one bounded capture window of at most five
  seconds and at most 4096 events.
- Event fields: `timestampNs`, `pid`, `uid`, `comm`, `family`, and
  `addressLength`.
- Address-family read: the eBPF program reads only the first two bytes of the
  user sockaddr with `bpf_probe_read_user`. `familyCaptured` describes the
  bounded field contract; the address itself is never returned.
- Explicit exclusions: destination address, port, address bytes, network
  payload, persistence, policy execution, automatic action, and provider
  egress.
- Runtime behavior: one capture at a time, no automatic retry, bounded error
  statuses, and in-memory continuity only. Restart clears the continuity
  baseline.
- Integration: system-sense route, Core read-only proxy, Observer panel and
  refresh, exact Nix source closures, changed-check mappings, and the existing
  milestone registry.

## Evidence

- `services/openclaw-system-sense/test/kernel-network-connect-capture.test.mjs`
  proves disabled behavior, bounds, family contract, rejection of extra address
  fields, permission redaction, and busy serialization.
- `services/openclaw-system-sense/test/kernel-network-connect-readback.test.mjs`
  proves deterministic family/process summaries and in-memory continuity.
- `services/openclaw-core/test/route-handlers.test.mjs` and
  `services/openclaw-system-sense/test/system-kernel-event-routes.test.mjs`
  prove the production read-only route and proxy boundaries.
- `apps/observer-ui/test/kernel-network-events.test.mjs` proves the served panel
  and refresh contract.
- `dev-body-config-check.sh` proves the exact system-sense and probe closures.
- `checks.x86_64-linux.openclaw-kernel-network-connect-capture-vm` proves the
  deployed fentry probe observes validation `curl` traffic with a non-zero
  family, verifies the CAP_BPF/CAP_PERFMON service boundary, checks the Core and
  Observer readbacks, and proves no destination or port leakage.
- `dev-openclaw-kernel-network-connect-capture-check.sh` and its Observer pair
  are the installed-host checks for a future explicitly authorized deployment.

## Deliberately Deferred

- physical generation activation or rollback;
- network destination, port, address-byte, socket-state, or payload capture;
- network blocking, policy enforcement, firewall changes, or arbitrary probes;
- persistent event black-box storage and automatic policy/action execution;
- provider egress, browser actions, root hostd expansion, and declarative
  self-evolution.

## Closure

The network connect-attempt capability is complete as a source and disposable
VM slice. The post-closure route review selected deployment of the exact
closure to the physical generation as the next actionable gate, but that gate
requires an explicit operator mutation decision and has not been executed.
Until then, do not add another kernel hook or enforcement variant without a
concrete operator need. VFS capture, destination/port capture, socket-state
capture, `fexit` outcome hooks, enforcement, persistence, provider egress, and
host mutation remain deferred.
