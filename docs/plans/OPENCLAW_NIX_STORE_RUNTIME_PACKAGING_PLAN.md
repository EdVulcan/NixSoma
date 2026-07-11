# OpenClaw Nix Store Runtime Packaging Plan

## Purpose

Advance the kernel evolution whitepaper's Phase A by replacing mutable
`/opt/openclaw` service execution with reproducible, read-only `/nix/store`
runtime closures. This is packaging of the existing user-sovereign body, not a
root daemon, hostd, D-Bus, eBPF, or self-rebuild capability.

## Migration Rules

- Migrate one cohesive service closure at a time and keep an explicit mutable
  fallback for services not yet proven.
- Include only runtime files and local imports required by that service. Do not
  copy the monorepo, tests, caches, artifacts, or unrelated shared modules into
  a closure.
- Preserve service ownership, public routes, state/log paths, environment,
  dependency ordering, browser sandboxing, and recovery semantics.
- A service counts as migrated only when Nix builds the derivation, generated
  systemd config points into its store path, the source is read-only, and a real
  process exercises representative behavior from that path.
- Introduce a shared packaging factory only after two concrete service
  closures prove the same file-selection and unit-wiring shape.

## Completed: Event Hub, Screen Sense, And Screen Act

`openclaw-event-hub` is the first store-native service closure:

- `nix/packages/openclaw-event-hub.nix` includes only the event-hub package and
  server plus `shared-utils/package.json` and `shared-utils/src/http.mjs`.
- `packages.x86_64-linux.openclaw-event-hub` builds the closure through the
  flake.
- `services.openclaw.runtimePackages.eventHub` defaults to that package while
  retaining `null` as an explicit mutable-repository fallback.
- The generated event-hub unit sets
  `OPENCLAW_BODY_RUNTIME_SOURCE=nix-store` and uses
  `$package/share/openclaw/services/openclaw-event-hub` as WorkingDirectory.
- Other service specs still report `mutable-repo` and continue using
  `services.openclaw.repoRoot`; Phase A is not falsely declared complete.

The existing `dev-body-config-check.sh` milestone now:

1. builds the flake package,
2. rejects unrelated work-view modules in the closure,
3. verifies the server source is read-only,
4. evaluates the real NixOS unit and rejects `/opt/openclaw`,
5. starts Node from the store WorkingDirectory, and
6. proves real health plus persisted audit event write/read behavior using a
   separate writable state directory.

`openclaw-screen-sense` is the second store-native service closure:

- its 10-file closure contains only the service server/capture adapter and the
  exact shared-events/shared-utils imports reached at runtime,
- its generated unit preserves system ownership and upstream URL environment,
- the milestone starts the store process against a bounded loopback
  session/browser/capture fixture, and
- `/screen/current` returns the expected browser-backed snapshot and URL from
  the real packaged code.

After both concrete closures produced the same package mechanics, the shared
`nix/lib/mk-openclaw-source-closure.nix` helper was extracted. It owns only the
fileset-to-store installation shape; each service package continues to expose
its explicit reviewable runtime file list. Rebuilding both packages preserves
their output content and runtime behavior.

`openclaw-screen-act` is the third store-native service closure:

- its 11-file closure contains only the service server/mediation modules and
  exact shared-events/shared-utils imports,
- its generated system unit preserves system ownership and the existing
  screen-sense, session-manager, and browser-runtime upstream contracts,
- the milestone starts the store process against authoritative bounded
  loopback screen and lease fixtures, and
- a real `/act/keyboard/type` request reaches browser-runtime through the
  trusted lease while responses and persisted action state retain only
  write-only input evidence, never plaintext.

## Evidence

- Packages: `nix/packages/openclaw-event-hub.nix`,
  `nix/packages/openclaw-screen-sense.nix`, and
  `nix/packages/openclaw-screen-act.nix`
- Shared packaging mechanism: `nix/lib/mk-openclaw-source-closure.nix`
- Module: `nix/modules/openclaw-body.nix`
- Flake exports: `packages.x86_64-linux.openclaw-event-hub`,
  `packages.x86_64-linux.openclaw-screen-sense`, and
  `packages.x86_64-linux.openclaw-screen-act`
- Targeted milestone: `nix/scripts/dev-body-config-check.sh`
- Identity route: kernel whitepaper Phase A, before privileged Level 3 work

## Deferred

- Six remaining OpenClaw services still execute from `repoRoot`.
- npm dependency closure handling for browser-runtime and Observer is not yet
  designed.
- No root service, hostd, D-Bus control, eBPF probe, Nix self-edit, rebuild, or
  rollback action is enabled.

## Next Slice

Package `openclaw-system-heal` as the fourth store-native service. Preserve its
system ownership, event-hub/system-sense contracts, and separate writable state
file. Prove a representative persisted diagnosis or simulated maintenance
behavior from the read-only store path. Keep `openclaw-system-sense` for a
separate slice because its larger set of inspection, health, file, command, and
systemd modules needs a broader explicit manifest and behavior proof.
