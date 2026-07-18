# NixSoma Systemd Incident Observation Receipt Plan

Updated: 2026-07-18

## Purpose

Persist one compact, hash-bound local record after an operator selects the
reviewed same-unit observation refresh. This turns transient health, unit, and
journal panel reads into bounded evidence that a later governed diagnosis can
reference without retaining journal messages or provider output.

## Delivered Flow

```text
reviewed refresh_systemd_incident_observation recommendation
-> revalidate provider task, source incident receipt, fixed unit, and hashes
-> read body health, fixed-unit inventory, and 25-line journal evidence
-> publish compact audit evidence before task mutation
-> persist one observation receipt on the provider task
-> render receipt hash, unit, health booleans, journal counts, and boundaries
```

The existing Observer action invokes
`act.openclaw.systemd_incident.observation_receipt` before refreshing the
three existing panels. If recording fails, panel refresh does not start.

## Receipt Contract

The `openclaw-systemd-incident-observation-receipt-v0` record contains only:

- provider task, source incident task, and source receipt bindings;
- fixed systemd unit and health-service key;
- observation timestamp and deterministic receipt hash;
- service and unit availability/health booleans;
- bounded journal availability, requested/returned counts, and parse errors;
- explicit negative authority and exposure flags.

It excludes journal messages, URLs, commands, credentials, provider response
content, hostd receipts, and repair authority.

## Authority Boundary

- Explicit operator selection remains required for the reviewed action.
- The capability creates no task or approval and performs no provider egress.
- It reads only the three existing system-sense observation owners.
- The target cannot be supplied independently of the bound incident receipt.
- Compact audit publication must succeed before task state is changed.
- It does not execute a command, invoke hostd, retry repair, activate a
  generation, or authorize rollback.

## Evidence

- focused builder tests for compact persistence, binding rejection, and
  audit-before-mutation failure;
- production `createCapabilityRuntime` invoke assembly and summary coverage;
- Observer exact request and failure-before-refresh regressions;
- generated client syntax and task-detail readback assertions;
- Nix Core closure membership and exact file-count validation.

## Next Real Capability

Allow an operator to create a fresh, exact-bound diagnosis task from this
compact observation receipt through the existing provider handoff owner. The
new request must bind the observation receipt hash, source incident hash, unit,
model, endpoint fingerprint, and request/context hash; it must still require
explicit approval before egress and must not execute or authorize repair.
