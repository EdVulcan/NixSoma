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

- `openclaw-system-sense/src/systemd-inspection.mjs` invokes `systemctl show`
  for read-only unit inventory.
- Core repair execution still delegates a fixed `systemctl restart` command to
  a Nix-generated helper, optionally through narrowly scoped sudo.
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
4. Keep the current command adapter as an explicit development/test fallback
   until native inventory equivalence is proven on the VM.
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

- Focused adapter unit tests with a fake bus.
- Existing systemd inspection tests unchanged at the public contract boundary.
- Targeted core and Observer systemd inventory milestone.
- Real VM read-only system-bus inventory proving native transport and no command
  execution.

## Deferred

- D-Bus start/stop/restart/reload operations.
- Polkit policy and authorization-agent integration.
- Dedicated `openclaw-hostd` ownership boundary.
- Removal of the fixed sudo repair helper.
- eBPF kernel event transport and declarative Nix self-evolution.

## Next Slice

Implement and prove the read-only native systemd D-Bus inventory adapter through
the existing system-sense route and Observer surface.
