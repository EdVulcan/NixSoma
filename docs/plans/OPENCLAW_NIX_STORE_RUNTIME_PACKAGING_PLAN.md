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

## Completed: Eight Store-Native Services

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

`openclaw-system-heal` is the fourth store-native service closure:

- its seven-file closure contains only the service server plus the exact
  shared event, HTTP, and persistence imports,
- its generated unit preserves system ownership, event-hub/system-sense URLs,
  and the separate writable system-heal state path,
- the milestone creates a real conservative diagnosis from the packaged
  process and persists it outside the store, and
- restarting the packaged process restores the same diagnosis while the
  proposed restart remains simulated and no real repair is executed.

`openclaw-system-sense` is the fifth store-native service closure:

- its 19-file closure contains all 14 runtime service modules plus the service
  package and exact shared event/HTTP imports,
- its generated unit preserves system ownership and body service URL
  contracts,
- the real packaged process samples seven bounded loopback service targets and
  returns Linux body/resource metadata against an explicit writable state and
  disk probe path, and
- the packaging proof calls no command, file-write, systemd, or repair route
  and performs no host mutation.

`openclaw-session-manager` is the sixth store-native service closure:

- its 14-file closure contains seven runtime service modules plus the service
  package and exact shared event/trust/visual-frame imports,
- its generated user unit preserves login-session ownership and points its
  recovery intent file at writable `%S/openclaw` state,
- the real packaged process creates an authoritative Level 2 session while the
  helper truthfully remains `awaiting_browser`, and
- no browser prepare, external sidecar start, automatic restart, or recovery
  intent write occurs during the packaging proof.

`observer-ui` is the seventh store-native service closure:

- its 49-file closure contains all 46 runtime composition modules, its package
  metadata, and the exact shared-client descriptor import,
- the common source-closure helper now installs only reviewed roots that are
  present (`apps`, `services`, or `packages`) while package manifests remain
  explicit,
- its generated system unit points into the store and preserves all upstream
  URL contracts, and
- the real packaged process serves the complete 270,892-character HTML and
  1,118,194-character client bundle with the engineering loop DOM visible.

`openclaw-browser-runtime` is the eighth store-native service closure:

- `buildNpmPackage` uses the pinned root lockfile, workspace-aware dependency
  fetching, disabled install scripts/browser downloads, and a fixed dependency
  hash,
- its runtime source remains an explicit 13-file manifest while production
  `puppeteer-core` dependencies live beside the service in the store; workspace
  links and the root TypeScript dev dependency are excluded,
- its generated login-user unit points into the store and retains the
  Nix-managed Firefox executable/profile contract, and
- the real packaged Node process resolves Puppeteer, performs a bounded
  simulated open, persists workspace intent, and restarts fail-closed without
  restoring browser execution, helper authority, input, or click state.

## Evidence

- Packages: `nix/packages/openclaw-event-hub.nix`,
  `nix/packages/openclaw-screen-sense.nix`, and
  `nix/packages/openclaw-screen-act.nix`, plus
  `nix/packages/openclaw-system-heal.nix` and
  `nix/packages/openclaw-system-sense.nix`, plus
  `nix/packages/openclaw-session-manager.nix` and
  `nix/packages/observer-ui.nix`, plus
  `nix/packages/openclaw-browser-runtime.nix`
- Shared packaging mechanism: `nix/lib/mk-openclaw-source-closure.nix`
- Module: `nix/modules/openclaw-body.nix`
- Flake exports: `packages.x86_64-linux.openclaw-event-hub`,
  `packages.x86_64-linux.openclaw-screen-sense`, and
  `packages.x86_64-linux.openclaw-screen-act`, plus
  `packages.x86_64-linux.openclaw-system-heal` and
  `packages.x86_64-linux.openclaw-system-sense`, plus
  `packages.x86_64-linux.openclaw-session-manager` and
  `packages.x86_64-linux.observer-ui`, plus
  `packages.x86_64-linux.openclaw-browser-runtime`
- Targeted milestone: `nix/scripts/dev-body-config-check.sh`
- Identity route: kernel whitepaper Phase A, before privileged Level 3 work

## Deferred

- Only `openclaw-core` still executes from `repoRoot`.
- The store-native browser package has not repeated the heavyweight real
  Firefox gate during normal iteration; keep that proof in the dedicated real
  browser milestone/release gate once the Firefox closure is locally cached.
- No root service, hostd, D-Bus control, eBPF probe, Nix self-edit, rebuild, or
  rollback action is enabled.

## Next Slice

Package `openclaw-core` as the ninth and final store-native service. Derive an
explicit runtime import closure from its 134 local modules and exact shared
package imports, preserve writable core state and all upstream contracts, and
prove representative health plus persisted control-plane behavior from the
store. Do not copy tests, historical artifacts, or unrelated workspace source.
