#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

BODY_MODULE="$REPO_ROOT/nix/modules/openclaw-body.nix"
DEV_PROFILE="$REPO_ROOT/nix/profiles/dev-body.nix"
DESKTOP_PROFILE="$REPO_ROOT/nix/profiles/desktop-body.nix"
LOCAL_HOST="$REPO_ROOT/nix/hosts/local-dev.nix"
FLAKE="$REPO_ROOT/flake.nix"

required_files=(
  "$BODY_MODULE"
  "$DEV_PROFILE"
  "$DESKTOP_PROFILE"
  "$LOCAL_HOST"
  "$FLAKE"
)

for file in "${required_files[@]}"; do
  if [[ ! -f "$file" ]]; then
    echo "Missing required body-config file: $file" >&2
    exit 1
  fi
done

if command -v nix-instantiate >/dev/null 2>&1; then
  while IFS= read -r nix_file; do
    nix-instantiate --parse "$nix_file" >/dev/null
  done < <(find "$REPO_ROOT/nix" -name '*.nix' -type f | sort)
fi

node - <<'EOF' "$REPO_ROOT"
const fs = require("node:fs");
const path = require("node:path");

const root = process.argv[2];
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const bodyModule = read("nix/modules/openclaw-body.nix");
const devProfile = read("nix/profiles/dev-body.nix");
const desktopProfile = read("nix/profiles/desktop-body.nix");
const localHost = read("nix/hosts/local-dev.nix");
const flake = read("flake.nix");

const serviceNames = [
  "openclaw-event-hub",
  "openclaw-core",
  "openclaw-session-manager",
  "openclaw-browser-runtime",
  "openclaw-screen-sense",
  "openclaw-screen-act",
  "openclaw-system-sense",
  "openclaw-system-heal",
  "observer-ui",
];

const componentKeys = [
  "eventHub",
  "core",
  "sessionManager",
  "browserRuntime",
  "screenSense",
  "screenAct",
  "systemSense",
  "systemHeal",
  "observerUi",
];

const envNames = [
  "OPENCLAW_CORE_URL",
  "OPENCLAW_EVENT_HUB_URL",
  "OPENCLAW_SESSION_MANAGER_URL",
  "OPENCLAW_BROWSER_RUNTIME_URL",
  "OPENCLAW_SCREEN_SENSE_URL",
  "OPENCLAW_SCREEN_ACT_URL",
  "OPENCLAW_SYSTEM_SENSE_URL",
  "OPENCLAW_SYSTEM_HEAL_URL",
  "OPENCLAW_CORE_STATE_FILE",
  "OPENCLAW_SYSTEM_HEAL_STATE_FILE",
  "OPENCLAW_BROWSER_RUNTIME_STATE_FILE",
  "OPENCLAW_BROWSER_ENGINE_MODE",
  "OPENCLAW_BROWSER_EXECUTABLE",
  "OPENCLAW_BROWSER_PROFILE_DIR",
  "OPENCLAW_BODY_PROFILE",
];

function requireIncludes(label, content, tokens) {
  const missing = tokens.filter((token) => !content.includes(token));
  if (missing.length > 0) {
    throw new Error(`${label} missing: ${missing.join(", ")}`);
  }
}

requireIncludes("openclaw-body module", bodyModule, [
  "options.services.openclaw",
  "systemd.services",
  "systemd.user.services",
  "openclaw-trusted-sidecar@",
  "trustedSidecarUserUnit",
  "EnvironmentFile = \"%t/openclaw-sidecars/%i.env\"",
  "ExecStart = \"${cfg.nodePackage}/bin/node src/trusted-work-view-sidecar.mjs\"",
  "Restart = \"no\"",
  "ReadWritePaths = [ \"%t/openclaw-sidecars\" ]",
  "systemd.tmpfiles.rules",
  "StateDirectory = \"openclaw\"",
  "LogsDirectory = \"openclaw\"",
  "ExecStart = \"${cfg.nodePackage}/bin/node src/server.mjs\"",
  ...serviceNames,
  ...componentKeys,
  ...envNames,
]);

for (const legacyPath of [
  "nix/modules/openclaw-core.nix",
  "nix/modules/openclaw-event-hub.nix",
  "nix/modules/openclaw-session-manager.nix",
  "nix/modules/openclaw-browser-runtime.nix",
  "nix/modules/openclaw-screen-sense.nix",
  "nix/modules/openclaw-screen-act.nix",
  "nix/modules/openclaw-system-sense.nix",
  "nix/modules/openclaw-system-heal.nix",
  "nix/modules/observer-ui.nix",
]) {
  const content = read(legacyPath);
  if (content.includes("placeholder")) {
    throw new Error(`${legacyPath} still contains placeholder service config.`);
  }
  requireIncludes(legacyPath, content, ["./openclaw-body.nix", "services.openclaw.components"]);
}

requireIncludes("dev-body profile", devProfile, [
  "../modules/openclaw-body.nix",
  "profile = lib.mkDefault \"dev-body\"",
  "eventHub",
  "core",
  "sessionManager",
  "browserRuntime",
  "observerUi",
]);

requireIncludes("desktop-body profile", desktopProfile, [
  "./dev-body.nix",
  "profile = \"desktop-body\"",
  "trustedSidecarUserUnit.enable = true",
  ...componentKeys,
]);

requireIncludes("local-dev host", localHost, [
  "../profiles/desktop-body.nix",
  "system.stateVersion",
]);

requireIncludes("flake", flake, [
  "nixosModules.openclaw-body",
  "nixosModules.default",
  "nixosConfigurations.openclaw-local-dev",
  "packages.${system}.firefox",
]);

console.log(JSON.stringify({
  bodyConfig: {
    module: "nix/modules/openclaw-body.nix",
    profiles: ["dev-body", "desktop-body"],
    host: "openclaw-local-dev",
    services: serviceNames.length,
    components: componentKeys,
    governance: {
      stateDirectory: true,
      logDirectory: true,
      dependencyOrdering: true,
      sharedEnvironment: true,
      flakeModuleExport: true,
    },
  },
}, null, 2));
EOF

if command -v nix >/dev/null 2>&1; then
  user_unit_json="$(nix --extra-experimental-features 'nix-command flakes' eval \
    --no-update-lock-file --json \
    .#nixosConfigurations.openclaw-local-dev.config.systemd.user.services \
    --apply 'services: let unit = services."openclaw-trusted-sidecar@"; service = unit.serviceConfig; in {
      wantedBy = unit.wantedBy;
      serviceConfig = {
        inherit (service) Restart EnvironmentFile ExecStart NoNewPrivileges PrivateTmp ProtectSystem ProtectHome ReadWritePaths RestrictAddressFamilies;
      };
    }')"
  node - <<'EOF' "$user_unit_json"
const unit = JSON.parse(process.argv[2]);
const service = unit.serviceConfig ?? {};
if ((unit.wantedBy ?? []).length !== 0
  || service.Restart !== "no"
  || service.EnvironmentFile !== "%t/openclaw-sidecars/%i.env"
  || !String(service.ExecStart ?? "").endsWith("/bin/node src/trusted-work-view-sidecar.mjs")
  || service.NoNewPrivileges !== true
  || service.PrivateTmp !== true
  || service.ProtectSystem !== "strict"
  || service.ProtectHome !== true
  || !Array.isArray(service.ReadWritePaths)
  || !service.ReadWritePaths.includes("%t/openclaw-sidecars")
  || !Array.isArray(service.RestrictAddressFamilies)
  || !service.RestrictAddressFamilies.includes("AF_UNIX")
  || !service.RestrictAddressFamilies.includes("AF_INET")) {
  throw new Error(`unexpected trusted sidecar user unit: ${JSON.stringify(unit)}`);
}
console.log(JSON.stringify({
  trustedSidecarUserUnit: {
    materialized: true,
    autoStarted: false,
    restart: service.Restart,
    environmentFile: service.EnvironmentFile,
    noNewPrivileges: service.NoNewPrivileges,
    readWritePaths: service.ReadWritePaths,
    addressFamilies: service.RestrictAddressFamilies,
  },
}, null, 2));
EOF
fi
