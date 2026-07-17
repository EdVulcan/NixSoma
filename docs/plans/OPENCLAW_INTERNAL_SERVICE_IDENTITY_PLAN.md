# NixSoma Internal Service Identity Plan

Updated: 2026-07-17

## Purpose

Close the internal-service identity gap before the fixed Level 3 hostd and
systemd activation bridge. A service must not be able to claim another service's
audit identity merely because it can reach a loopback HTTP port.

Identity alignment: Level 1 control-plane boundary, supporting the Level 3
controlled system daemon boundary.

## Delivered Slice: Event Hub

The Event Hub now supports a required per-source credential map:

```text
service credential file
-> createEventPublisher/registerService
-> x-openclaw-event-source + x-openclaw-service-caller
-> Event Hub source-to-token verification
-> server-generated audit source
```

`packages/shared-utils/src/service-credentials.mjs` reads direct or
`LoadCredential`-backed files, parses bounded maps, creates caller headers, and
uses constant-time token comparison. `createEventIngress` retains the old
single-token compatibility mode, but required map mode fails closed when the
map is missing and rejects token/source swaps or missing caller identity.

The Unix and PowerShell development launchers generate one credential per
publishing service in ignored artifact files. NixOS exposes
`eventHubCredentialMapFile` and `eventHubCredentialFiles`; when configured,
service units receive only `%d` credential paths through `LoadCredential` and
Event Hub requires the map.

## Evidence

- Event ingress and credential helper tests cover file reads, map parsing,
  constant-time comparison, source binding, and required-mode failure.
- An isolated real-service run proved wrong-token and missing-caller requests
  return `401`, while the correct source token returns `201`; service registry
  registration succeeded for all publishing services.
- `dev-body-config-check.sh` passed, including Nix store closures with the new
  shared credential module and read-only runtime checks.

## Delivered Slice: Browser Runtime

Browser Runtime now supports a strict per-caller credential map. The
session-manager, screen-sense, and screen-act services read only their own
credential file and send their bounded caller identity. Browser Runtime rejects
caller/token swaps, while retaining the old shared-token and loopback behavior
only when no map is configured.

The trusted sidecar uses the session-manager caller identity. Its launch
environment contains no Browser Runtime credential; the supervisor delivers the
credential in the already-connected Unix IPC bind message, and the sidecar
keeps it only in memory for loopback capture/action requests. The launcher
regression proves that the credential cannot enter the transient EnvironmentFile.

The Unix and PowerShell development launchers generate independent Browser
Runtime credentials for the three internal callers plus a bounded operator
inspection identity. NixOS exposes `browserRuntimeCredentialMapFile`,
`browserRuntimeCredentialFiles`, and legacy `browserRuntimeAuthTokenFile`
through `LoadCredential`; token values remain outside Nix expressions.

## Delivered Slice: Authenticated Core Readback

Core now applies the operator identity boundary to sensitive state read models,
not only mutation routes. Approval inboxes and summaries, task history and
focus routes, runtime and policy state, capability invocation history, command
transcripts, and filesystem ledgers require either the bearer credential or an
active operator session. `/health` and the non-state capability registry remain
available for liveness and discovery; this is an explicit bounded read policy,
not a claim that every Core GET is public or that every internal service route
is operator-authenticated.

Operator credentials are resolved file-first, so a `LoadCredential` or launcher
file cannot be silently shadowed by a legacy environment value. The shared Unix
HTTP helper adds the same file-backed credential to direct Core readback calls;
POST requests continue through its existing authenticated `post_json` path.

## Evidence

- Operator auth tests prove file-first credential precedence and the sensitive
  read allowlist.
- Core route tests prove an anonymous approval read is rejected before the route
  reads state, while an authenticated operator receives the bounded inbox.
- The real approval milestone proves the authenticated task/approval lifecycle
  and separately probes that an unauthenticated approval read returns `401`.
- The HTTP helper check proves direct Core GET calls receive the bearer header
  without adding it to unrelated service requests.

## Delivered Slice: Core-Issued Actuator Grants

Direct mutation routes now require a short-lived, single-use Ed25519 grant
issued by Core and addressed to the exact downstream service. The grant binds
the HTTP method, path, body, task/step context, capability, and intent. Missing
verification configuration fails closed; audience swaps, request mismatches,
expired grants, and replayed grants are rejected before the actuator runs.

## Evidence

- `packages/shared-utils/test/execution-grants.test.mjs` covers signature,
  audience, request binding, context binding, expiry, and replay semantics.
- `services/openclaw-core/test/service-client.test.mjs` proves Core's service
  client signs the configured actuator target and carries task context.
- `nix/scripts/dev-direct-actuator-grant-check.sh` starts isolated real services
  and proves unsigned system-sense/screen-act requests, cross-audience grants,
  replay, and target tampering fail before mutation; the approved Core operator
  path completes a real filesystem write through its issued grant.

## Delivered Slice: Reservation Recovery Evidence

The Core reservation state machine now has real service evidence for an
interrupted running step. A bounded approved command is allowed to persist its
`running` reservation, Core is interrupted, and the same persisted state is
reloaded. Startup reconciliation marks the step and task failed, clears the
active reservation, records a `recovered_aborted` receipt, and does not replay
the command.

Evidence: `nix/scripts/dev-reservation-recovery-check.sh`. Focused unit tests
also cover commit, abort, pre-start expiry release, and restart recovery.

## Deliberately Deferred

- Removal of shared Event Hub and Browser Runtime compatibility modes.
- Authorization of Browser Runtime read routes through a separate operator
  session; the per-caller map authenticates internal service callers.
- A production pause boundary for pre-start reservation expiry. The branch is
  unit-covered and remains intentionally unexposed as a standalone API.
- Real NixOS VM activation, host-health oracle, generation receipt, and rollback.

## Next Slice

Resume the fixed hostd/systemd Level 3 activation bridge using the existing
approval, health, changed-PID, and recovery contracts.
