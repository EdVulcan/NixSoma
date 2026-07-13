# Phase C Kernel Process-Exec Capture Plan

Status: implementation, switched-VM acceptance, full body-config, and bounded
readback passed, 2026-07-13

## Purpose

Advance the kernel evolution whitepaper from the completed Nix-store and fixed
native D-Bus foundations to one real, read-only eBPF body nerve. The selected
capability is bounded `sched_process_exec` observation owned by system-sense.

This is a capability slice, not a general kernel event bus. A successful read
returns only `timestampNs`, `pid`, `uid`, and `comm` through a libbpf ring
buffer. The user-space route validates the event contract and exposes a
bounded read model through the existing core system-sense proxy and Observer.

## Identity Alignment

- Whitepaper level: Phase C, first eBPF kernel nerve.
- Runtime owner: store-native `openclaw-system-sense`.
- User-visible result: an operator can inspect recent process-exec events and
  distinguish disabled, captured, busy, unavailable, permission-denied, and
  invalid-output states.
- Authority: desktop-body configuration explicitly enables the capability and
  grants only `CAP_BPF` and `CAP_PERFMON` to the system-sense service.
- Runtime prerequisite: the system-sense unit sets `LimitMEMLOCK=infinity` so
  libbpf can establish its bounded ring-buffer probe without widening the
  capability set.

## Implementation Contract

- BPF attachment: raw `sched_process_exec` tracepoint, avoiding a tracefs
  event-ID read permission for the non-root service.
- Transport: libbpf ring buffer.
- Capture bounds: one fixed configuration window of at most 5 seconds and at
  most 4096 events; desktop defaults are 1000ms and 128 events.
- Output fields: `timestampNs`, `pid`, `uid`, `comm` only.
- Runtime behavior: one capture at a time, no automatic retry, no persistence,
  no policy execution, and no host mutation.
- Readback: the existing response includes a bounded in-memory summary with a
  fixed 16-entry comm count list, unique comm/PID/UID counts, event timestamp
  endpoints, capture window, event limit, and an explicit persisted: false
  marker.
- Continuity: successful captures also carry an in-memory sequence, quiet or
  observed activity state, and at most 16 newly seen comm names from a tracked
  set of 64; disabled, busy, and failed captures do not advance the baseline.
- Failure behavior: permission and execution failures become explicit bounded
  status values without exposing raw stderr, command paths, argv, or file
  content.

## Evidence

- `services/openclaw-system-sense/test/kernel-process-exec-capture.test.mjs`
  proves disabled behavior, bounds, field validation, permission redaction,
  and concurrent-request serialization.
- `services/openclaw-system-sense/test/system-kernel-event-routes.test.mjs`
  proves the read-only route dispatch contract.
- `services/openclaw-core/test/route-handlers.test.mjs` proves the production
  core proxy forwards the route to system-sense.
- `openclaw-kernel-process-exec-capture` and its Observer pair are the
  switched-VM acceptance checks for the explicit Nix probe path, capabilities,
  and validation child process observed through the core proxy.
- `dev-body-config-check.sh` is the acceptance check for the probe derivation,
  system-sense source closure, desktop service environment, and capability
  bounding set. On a NixOS host it reuses the installed system channel as the
  flake nixpkgs input, with `OPENCLAW_BODY_CONFIG_NIXPKGS_OVERRIDE` available
  for an explicit source and the locked flake input as the fallback.

Local implementation, Nix evaluation/parse, shell validation, system-sense
tests (48/48), core route tests (32/32), and Observer served-source assembly
checks pass. The corrected derivation compiled in the switched system, which
loaded the raw tracepoint probe with only `CAP_BPF`, `CAP_PERFMON`, and
`LimitMEMLOCK=infinity`. The core acceptance check captured 8 events and the
Observer acceptance check captured 8 events including the external `true`
  validation process. The full `body-config` check then passed while reusing
  the installed NixOS 25.11 channel, so it did not redownload the separate
  unstable clang closure.

The bounded readback evidence includes deterministic summary ordering, identity
counts, and the fixed command summary bound in the system-sense tests. Observer
tests prove the served panel, DOM bindings, and refresh wiring expose the same
summary. The switched-VM Observer acceptance also checks the readback registry,
non-persistence marker, and the validation process name.

The continuity evidence proves first-capture and continued-capture sequencing,
new comm detection, and non-advancing unavailable/busy states. It retains no
event ledger and does not survive service restart.

## Deliberately Deferred

- command-line, executable path, file-content, environment, and network
  capture;
- network eBPF hooks, VFS hooks, syscall interception, blocking, or enforcement;
- persistent event black-box storage or automatic policy/action execution;
- arbitrary probe parameters, arbitrary tracepoints, root hostd expansion,
  kernel socket peer credentials, and declarative Nix self-evolution.

## Next Slice

The bounded readback and continuity requirements are now complete: operators
can inspect the current capture, distinguish quiet from observed activity, and
see newly observed comm names without losing the raw allowlisted events. All
state is derived in memory and resets on restart. Before adding another eBPF
event kind, select a concrete follow-up operator need from this evidence.
