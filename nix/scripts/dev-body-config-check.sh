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

body_config_nixpkgs_override="${OPENCLAW_BODY_CONFIG_NIXPKGS_OVERRIDE:-}"
system_nixpkgs_channel="/nix/var/nix/profiles/per-user/root/channels/nixos"
if [[ -z "$body_config_nixpkgs_override" && -f "$system_nixpkgs_channel/flake.nix" ]]; then
  body_config_nixpkgs_override="$(readlink -f "$system_nixpkgs_channel")"
fi
NIXPKGS_OVERRIDE_ARGS=( )
if [[ -n "$body_config_nixpkgs_override" ]]; then
  if [[ ! -f "$body_config_nixpkgs_override/flake.nix" ]]; then
    echo "OPENCLAW_BODY_CONFIG_NIXPKGS_OVERRIDE must point to a flake source: $body_config_nixpkgs_override" >&2
    exit 64
  fi
  NIXPKGS_OVERRIDE_ARGS=(--override-input nixpkgs "$body_config_nixpkgs_override")
  echo "body-config nixpkgs source: $body_config_nixpkgs_override"
else
  echo "body-config nixpkgs source: flake.lock"
fi

nix_flake() {
  local subcommand="$1"
  shift
  nix --extra-experimental-features 'nix-command flakes' "$subcommand" "${NIXPKGS_OVERRIDE_ARGS[@]}" --no-write-lock-file "$@"
}

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
  "OPENCLAW_SESSION_MANAGER_STATE_FILE",
  "OPENCLAW_SYSTEM_HEAL_STATE_FILE",
  "OPENCLAW_BROWSER_RUNTIME_STATE_FILE",
  "OPENCLAW_BROWSER_ENGINE_MODE",
  "OPENCLAW_BROWSER_EXECUTABLE",
  "OPENCLAW_BROWSER_PROFILE_DIR",
  "OPENCLAW_BODY_PROFILE",
  "OPENCLAW_BODY_COMPONENT_SCOPE",
  "OPENCLAW_BODY_RUNTIME_SOURCE",
  "OPENCLAW_KERNEL_EVENT_CAPTURE_ENABLED",
  "OPENCLAW_KERNEL_EVENT_PROBE",
  "OPENCLAW_KERNEL_EVENT_CAPTURE_DURATION_MS",
  "OPENCLAW_KERNEL_EVENT_CAPTURE_MAX_EVENTS",
  "OPENCLAW_EXECUTION_GRANT_PRIVATE_KEY_FILE",
  "OPENCLAW_EXECUTION_GRANT_PUBLIC_KEY_FILE",
  "OPENCLAW_EVENT_HUB_TOKEN_FILE",
  "OPENCLAW_EVENT_HUB_TOKEN_MAP_FILE",
  "OPENCLAW_EVENT_HUB_AUTH_REQUIRED",
  "OPENCLAW_BROWSER_RUNTIME_AUTH_TOKEN_FILE",
  "OPENCLAW_BROWSER_RUNTIME_TOKEN_FILE",
  "OPENCLAW_BROWSER_RUNTIME_CALLER",
  "OPENCLAW_BROWSER_RUNTIME_CREDENTIAL_MAP_FILE",
  "OPENCLAW_BROWSER_RUNTIME_AUTH_REQUIRED",
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
  "componentOwnership.user",
  "hostdUser",
  "userService.stateDir",
  "userService.logDir",
  "EnvironmentFile = \"%t/openclaw-sidecars/%i.env\"",
  "ExecStart = \"${cfg.nodePackage}/bin/node src/trusted-work-view-sidecar.mjs\"",
  "Restart = \"no\"",
  "ReadWritePaths = [ \"%t/openclaw-sidecars\" ]",
  "systemd.tmpfiles.rules",
  "openclaw-event-log-ownership-migration",
  "openclaw-execution-grant-key-init",
  "eventHubCredentialMapFile",
  "eventHubCredentialFiles",
  "event-hub-token-map",
  "event-hub-token",
  "browserRuntimeAuthTokenFile",
  "browserRuntimeCredentialMapFile",
  "browserRuntimeCredentialFiles",
  "browser-runtime-token-map",
  "browser-runtime-token",
  "browser-runtime-auth-token",
  "LoadCredential",
  "ExecStartPre = [ \"+${eventLogOwnershipMigration}\" ]",
  "chown ${lib.escapeShellArg \"${owner}:${group}\"} \"$event_log\"",
  "StateDirectory = \"openclaw\"",
  "LogsDirectory = \"openclaw\"",
  "ExecStart = \"${cfg.nodePackage}/bin/node src/server.mjs\"",
  "runtimePackages.eventHub",
  "runtimePackages.core",
  "runtimePackages.sessionManager",
  "runtimePackages.browserRuntime",
  "runtimePackages.screenSense",
  "runtimePackages.screenAct",
  "runtimePackages.systemSense",
  "kernelEventCapture",
  "probePackage",
  "AmbientCapabilities",
  "CapabilityBoundingSet",
  "CAP_BPF",
  "CAP_PERFMON",
  "runtimePackages.hostd",
  "runtimePackages.systemHeal",
  "runtimePackages.observerUi",
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
  "nix.settings = {",
  "https://mirrors.tuna.tsinghua.edu.cn/nix-channels/store",
  "profile = \"desktop-body\"",
  "user = \"openclaw-service\"",
  "hostdUser = \"openclaw-hostd\"",
  "systemdRepairAuthDelegation.enable = true",
  "trustedSidecarUserUnit.enable = true",
  "componentOwnership.user",
  "browserEngine.mode = \"firefox\"",
  "kernelEventCapture.enable = true",
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
  "packages.${system} =",
  "firefox = pkgs.firefox",
  "openclaw-event-hub = pkgs.callPackage",
  "openclaw-core = pkgs.callPackage",
  "openclaw-session-manager = pkgs.callPackage",
  "openclaw-browser-runtime = pkgs.callPackage",
  "openclaw-screen-sense = pkgs.callPackage",
  "openclaw-screen-act = pkgs.callPackage",
  "openclaw-system-sense = pkgs.callPackage",
  "openclaw-kernel-event-probe = pkgs.callPackage",
  "openclaw-system-heal = pkgs.callPackage",
  "observer-ui = pkgs.callPackage",
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
  ownership_json="$(nix_flake eval \
    --no-update-lock-file --json \
    .#nixosConfigurations.openclaw-local-dev.config \
    --apply 'config: let
      project = unit: {
        inherit (unit) wantedBy partOf after environment;
        serviceConfig = {
          User = unit.serviceConfig.User or null;
          Group = unit.serviceConfig.Group or null;
          WorkingDirectory = unit.serviceConfig.WorkingDirectory or null;
          ExecStart = unit.serviceConfig.ExecStart or null;
          Type = unit.serviceConfig.Type or null;
          RemainAfterExit = unit.serviceConfig.RemainAfterExit or null;
          LoadCredential = unit.serviceConfig.LoadCredential or [ ];
          RuntimeDirectory = unit.serviceConfig.RuntimeDirectory or null;
          RuntimeDirectoryMode = unit.serviceConfig.RuntimeDirectoryMode or null;
          AmbientCapabilities = unit.serviceConfig.AmbientCapabilities or [ ];
          CapabilityBoundingSet = unit.serviceConfig.CapabilityBoundingSet or [ ];
          LimitMEMLOCK = unit.serviceConfig.LimitMEMLOCK or null;
        };
      };
    in {
      system = builtins.attrNames config.systemd.services;
      user = builtins.attrNames config.systemd.user.services;
      nixSettings = {
        substituters = config.nix.settings.substituters;
        trustedPublicKeys = config.nix.settings."trusted-public-keys";
      };
      polkitEnabled = config.security.polkit.enable;
      polkitExtraConfig = config.security.polkit.extraConfig;
      session = project config.systemd.user.services.openclaw-session-manager;
      browser = project config.systemd.user.services.openclaw-browser-runtime;
      core = project config.systemd.services.openclaw-core;
      operatorTokenInit = project config.systemd.services.openclaw-operator-token-init;
      executionGrantInit = project config.systemd.services.openclaw-execution-grant-key-init;
      eventHub = project config.systemd.services.openclaw-event-hub;
      screenSense = project config.systemd.services.openclaw-screen-sense;
      screenAct = project config.systemd.services.openclaw-screen-act;
      systemSense = project config.systemd.services.openclaw-system-sense;
      systemHeal = project config.systemd.services.openclaw-system-heal;
      observerUi = project config.systemd.services.observer-ui;
      hostd = if builtins.hasAttr "openclaw-hostd" config.systemd.services
        then project config.systemd.services.openclaw-hostd
        else null;
    }')"
  node - <<'EOF' "$ownership_json"
const ownership = JSON.parse(process.argv[2]);
const expectedSubstituters = [
  "https://mirrors.tuna.tsinghua.edu.cn/nix-channels/store",
  "https://cache.nixos.org/",
];
const expectedTrustedPublicKeys = [
  "cache.nixos.org-1:6NCHdD59X431o0gWypbMrAURkbJ16ZPMQFGspcDShjY=",
];
if (JSON.stringify(ownership.nixSettings?.substituters) !== JSON.stringify(expectedSubstituters)
  || JSON.stringify(ownership.nixSettings?.trustedPublicKeys) !== JSON.stringify(expectedTrustedPublicKeys)) {
  throw new Error(`desktop body must expose the domestic-first Nix cache configuration: ${JSON.stringify(ownership.nixSettings)}`);
}
const userOwned = ["openclaw-session-manager", "openclaw-browser-runtime"];
for (const name of userOwned) {
  if (!ownership.user.includes(name) || ownership.system.includes(name)) {
    throw new Error(`${name} must exist exclusively in the user manager: ${JSON.stringify(ownership)}`);
  }
}
for (const [name, unit] of Object.entries(ownership).filter(([name]) =>
  ["core", "eventHub", "screenSense", "screenAct", "systemSense", "systemHeal", "observerUi"].includes(name)
)) {
  if (unit.serviceConfig?.User !== "openclaw-service") {
    throw new Error(`${name} must run as the dedicated openclaw service user: ${JSON.stringify(unit)}`);
  }
}
if (ownership.polkitEnabled !== true
  || !ownership.polkitExtraConfig.includes('action.lookup("unit") == "openclaw-system-sense.service"')
  || !ownership.polkitExtraConfig.includes('action.lookup("unit") == "openclaw-event-hub.service"')
  || !ownership.polkitExtraConfig.includes('action.lookup("unit") == "openclaw-system-heal.service"')
  || !ownership.polkitExtraConfig.includes('action.lookup("verb") == "restart"')
  || !ownership.polkitExtraConfig.includes('subject.user == "openclaw-hostd"')) {
  throw new Error(`desktop body must expose fixed native systemd Polkit delegation: ${JSON.stringify({
    enabled: ownership.polkitEnabled,
    config: ownership.polkitExtraConfig,
  })}`);
}
for (const [name, unit] of [["session", ownership.session], ["browser", ownership.browser]]) {
  if (!unit.wantedBy?.includes("graphical-session.target")
    || !unit.partOf?.includes("graphical-session.target")
    || unit.serviceConfig?.User != null
    || unit.environment?.OPENCLAW_BODY_COMPONENT_SCOPE !== "user"
    || unit.environment?.OPENCLAW_BODY_STATE_DIR !== "%S/openclaw"
    || unit.environment?.OPENCLAW_BODY_LOG_DIR !== "%L/openclaw") {
    throw new Error(`unexpected ${name} user unit ownership: ${JSON.stringify(unit)}`);
  }
}
if (ownership.browser.environment?.OPENCLAW_BROWSER_ENGINE_MODE !== "firefox"
  || ownership.browser.environment?.OPENCLAW_BROWSER_PROFILE_DIR !== "%S/openclaw/browser-profile"
  || !String(ownership.browser.environment?.OPENCLAW_BROWSER_EXECUTABLE ?? "").endsWith("/bin/firefox")) {
  throw new Error(`desktop browser runtime must use the Nix-managed Firefox user profile: ${JSON.stringify(ownership.browser)}`);
}
if (ownership.browser.environment?.OPENCLAW_BODY_RUNTIME_SOURCE !== "nix-store"
  || !String(ownership.browser.serviceConfig?.WorkingDirectory ?? "").startsWith("/nix/store/")
  || !String(ownership.browser.serviceConfig?.WorkingDirectory ?? "").endsWith("/share/openclaw/services/openclaw-browser-runtime")
  || ownership.browser.serviceConfig?.WorkingDirectory?.includes("/opt/openclaw")) {
  throw new Error(`browser-runtime must execute from its read-only Nix closure: ${JSON.stringify(ownership.browser)}`);
}
if (!ownership.browser.after?.includes("openclaw-session-manager.service")) {
  throw new Error(`browser runtime must retain same-scope session-manager ordering: ${JSON.stringify(ownership.browser.after)}`);
}
if (ownership.session.environment?.OPENCLAW_BODY_RUNTIME_SOURCE !== "nix-store"
  || ownership.session.environment?.OPENCLAW_SESSION_MANAGER_STATE_FILE !== "%S/openclaw/openclaw-session-manager-state.json"
  || !String(ownership.session.serviceConfig?.WorkingDirectory ?? "").startsWith("/nix/store/")
  || !String(ownership.session.serviceConfig?.WorkingDirectory ?? "").endsWith("/share/openclaw/services/openclaw-session-manager")
  || ownership.session.serviceConfig?.WorkingDirectory?.includes("/opt/openclaw")) {
  throw new Error(`session-manager must execute from its read-only Nix closure with writable user state: ${JSON.stringify(ownership.session)}`);
}
if (ownership.eventHub.environment?.OPENCLAW_BODY_RUNTIME_SOURCE !== "nix-store"
  || !String(ownership.eventHub.serviceConfig?.WorkingDirectory ?? "").startsWith("/nix/store/")
  || !String(ownership.eventHub.serviceConfig?.WorkingDirectory ?? "").endsWith("/share/openclaw/services/openclaw-event-hub")
  || ownership.eventHub.serviceConfig?.WorkingDirectory?.includes("/opt/openclaw")) {
  throw new Error(`event hub must execute from its read-only Nix closure: ${JSON.stringify(ownership.eventHub)}`);
}
if (ownership.core.environment?.OPENCLAW_BODY_RUNTIME_SOURCE !== "nix-store"
  || ownership.core.environment?.OPENCLAW_BODY_USER_OWNED_UNITS !== "openclaw-session-manager,openclaw-browser-runtime"
  || ownership.core.environment?.OPENCLAW_CORE_STATE_FILE !== "/var/lib/openclaw/openclaw-core-state.json"
  || ownership.core.environment?.OPENCLAW_BODY_EVIDENCE_LEDGER_DIR !== "/var/lib/openclaw/body-evidence-ledger"
  || ownership.core.environment?.OPENCLAW_SYSTEMD_REPAIR_AUTH_DELEGATION !== "polkit-dbus-fixed-unit"
  || ownership.core.environment?.OPENCLAW_HOSTD_SOCKET_PATH !== "/run/openclaw/hostd.sock"
  || ownership.core.environment?.OPENCLAW_OPERATOR_TOKEN_FILE !== "%d/operator-token"
  || ownership.core.environment?.OPENCLAW_EXECUTION_GRANT_PRIVATE_KEY_FILE !== "%d/execution-grant-private"
  || JSON.stringify(ownership.core.serviceConfig?.LoadCredential ?? []) !== JSON.stringify(["operator-token:/var/lib/openclaw/operator-token", "execution-grant-private:/var/lib/openclaw/execution-grant-private.pem"])
  || !String(ownership.core.serviceConfig?.WorkingDirectory ?? "").startsWith("/nix/store/")
  || !String(ownership.core.serviceConfig?.WorkingDirectory ?? "").endsWith("/share/openclaw/services/openclaw-core")
  || ownership.core.serviceConfig?.WorkingDirectory?.includes("/opt/openclaw")) {
  throw new Error(`core must execute from its read-only Nix closure with writable state: ${JSON.stringify(ownership.core)}`);
}
if (!ownership.operatorTokenInit.wantedBy?.includes("multi-user.target")
  || ownership.operatorTokenInit.serviceConfig?.Type !== "oneshot"
  || ownership.operatorTokenInit.serviceConfig?.RemainAfterExit !== true
  || !String(ownership.operatorTokenInit.serviceConfig?.ExecStart ?? "").includes("openclaw-operator-token-init")) {
  throw new Error(`core operator credential initializer is not durable and pre-started: ${JSON.stringify(ownership.operatorTokenInit)}`);
}
if (!ownership.executionGrantInit.wantedBy?.includes("multi-user.target")
  || ownership.executionGrantInit.serviceConfig?.Type !== "oneshot"
  || ownership.executionGrantInit.serviceConfig?.RemainAfterExit !== true
  || !String(ownership.executionGrantInit.serviceConfig?.ExecStart ?? "").includes("openclaw-execution-grant-key-init")) {
  throw new Error(`execution grant key initializer is not durable and pre-started: ${JSON.stringify(ownership.executionGrantInit)}`);
}
if (ownership.hostd == null
  || ownership.hostd.environment?.OPENCLAW_BODY_RUNTIME_SOURCE !== "nix-store"
  || ownership.hostd.environment?.OPENCLAW_HOSTD_SOCKET_PATH !== "/run/openclaw/hostd.sock"
  || !String(ownership.hostd.environment?.OPENCLAW_HOSTD_PEER_CREDENTIAL_HELPER ?? "").startsWith("/nix/store/")
  || ownership.hostd.environment?.OPENCLAW_HOSTD_PEER_EXPECTED_USER !== "openclaw-service"
  || ownership.hostd.environment?.OPENCLAW_HOSTD_PEER_EXPECTED_GROUP !== "openclaw"
  || ownership.hostd.serviceConfig?.User !== "openclaw-hostd"
  || ownership.hostd.serviceConfig?.Group !== "openclaw"
  || ownership.hostd.serviceConfig?.RuntimeDirectory !== "openclaw"
  || !String(ownership.hostd.serviceConfig?.WorkingDirectory ?? "").startsWith("/nix/store/")
  || !String(ownership.hostd.serviceConfig?.WorkingDirectory ?? "").endsWith("/share/openclaw/services/openclaw-hostd")
  || ownership.hostd.serviceConfig?.WorkingDirectory?.includes("/opt/openclaw")) {
  throw new Error(`hostd must execute from its fixed read-only Nix closure: ${JSON.stringify(ownership.hostd)}`);
}
if (ownership.screenSense.environment?.OPENCLAW_BODY_RUNTIME_SOURCE !== "nix-store"
  || !String(ownership.screenSense.serviceConfig?.WorkingDirectory ?? "").startsWith("/nix/store/")
  || !String(ownership.screenSense.serviceConfig?.WorkingDirectory ?? "").endsWith("/share/openclaw/services/openclaw-screen-sense")
  || ownership.screenSense.serviceConfig?.WorkingDirectory?.includes("/opt/openclaw")) {
  throw new Error(`screen-sense must execute from its read-only Nix closure: ${JSON.stringify(ownership.screenSense)}`);
}
if (ownership.screenAct.environment?.OPENCLAW_BODY_RUNTIME_SOURCE !== "nix-store"
  || !String(ownership.screenAct.serviceConfig?.WorkingDirectory ?? "").startsWith("/nix/store/")
  || !String(ownership.screenAct.serviceConfig?.WorkingDirectory ?? "").endsWith("/share/openclaw/services/openclaw-screen-act")
  || ownership.screenAct.serviceConfig?.WorkingDirectory?.includes("/opt/openclaw")) {
  throw new Error(`screen-act must execute from its read-only Nix closure: ${JSON.stringify(ownership.screenAct)}`);
}
if (ownership.systemHeal.environment?.OPENCLAW_BODY_RUNTIME_SOURCE !== "nix-store"
  || !String(ownership.systemHeal.serviceConfig?.WorkingDirectory ?? "").startsWith("/nix/store/")
  || !String(ownership.systemHeal.serviceConfig?.WorkingDirectory ?? "").endsWith("/share/openclaw/services/openclaw-system-heal")
  || ownership.systemHeal.serviceConfig?.WorkingDirectory?.includes("/opt/openclaw")) {
  throw new Error(`system-heal must execute from its read-only Nix closure: ${JSON.stringify(ownership.systemHeal)}`);
}
if (ownership.systemSense.environment?.OPENCLAW_BODY_RUNTIME_SOURCE !== "nix-store"
  || !String(ownership.systemSense.serviceConfig?.WorkingDirectory ?? "").startsWith("/nix/store/")
  || !String(ownership.systemSense.serviceConfig?.WorkingDirectory ?? "").endsWith("/share/openclaw/services/openclaw-system-sense")
  || ownership.systemSense.serviceConfig?.WorkingDirectory?.includes("/opt/openclaw")) {
  throw new Error(`system-sense must execute from its read-only Nix closure: ${JSON.stringify(ownership.systemSense)}`);
}
if (ownership.systemSense.environment?.OPENCLAW_KERNEL_EVENT_CAPTURE_ENABLED !== "1"
  || !String(ownership.systemSense.environment?.OPENCLAW_KERNEL_EVENT_PROBE ?? "").startsWith("/nix/store/")
  || ownership.systemSense.environment?.OPENCLAW_KERNEL_EVENT_CAPTURE_DURATION_MS !== "1000"
  || ownership.systemSense.environment?.OPENCLAW_KERNEL_EVENT_CAPTURE_MAX_EVENTS !== "128"
  || !ownership.systemSense.serviceConfig?.AmbientCapabilities?.includes("CAP_BPF")
  || !ownership.systemSense.serviceConfig?.AmbientCapabilities?.includes("CAP_PERFMON")
  || !ownership.systemSense.serviceConfig?.CapabilityBoundingSet?.includes("CAP_BPF")
  || !ownership.systemSense.serviceConfig?.CapabilityBoundingSet?.includes("CAP_PERFMON")
  || ownership.systemSense.serviceConfig?.LimitMEMLOCK !== "infinity") {
  throw new Error(`desktop system-sense must expose only the bounded eBPF capabilities: ${JSON.stringify(ownership.systemSense)}`);
}
if (ownership.observerUi.environment?.OPENCLAW_BODY_RUNTIME_SOURCE !== "nix-store"
  || !String(ownership.observerUi.serviceConfig?.WorkingDirectory ?? "").startsWith("/nix/store/")
  || !String(ownership.observerUi.serviceConfig?.WorkingDirectory ?? "").endsWith("/share/openclaw/apps/observer-ui")
  || ownership.observerUi.serviceConfig?.WorkingDirectory?.includes("/opt/openclaw")) {
  throw new Error(`observer-ui must execute from its read-only Nix closure: ${JSON.stringify(ownership.observerUi)}`);
}
console.log(JSON.stringify({
  componentOwnership: {
    userOwned,
    duplicated: userOwned.filter((name) => ownership.system.includes(name)),
    hostdServiceUser: ownership.hostd.serviceConfig.User,
    hostdSocketGroup: ownership.hostd.serviceConfig.Group,
    browserEngine: ownership.browser.environment.OPENCLAW_BROWSER_ENGINE_MODE,
    browserProfile: ownership.browser.environment.OPENCLAW_BROWSER_PROFILE_DIR,
    browserRuntimeSource: ownership.browser.environment.OPENCLAW_BODY_RUNTIME_SOURCE,
    browserWorkingDirectory: ownership.browser.serviceConfig.WorkingDirectory,
    sessionManagerRuntimeSource: ownership.session.environment.OPENCLAW_BODY_RUNTIME_SOURCE,
    sessionManagerWorkingDirectory: ownership.session.serviceConfig.WorkingDirectory,
    sessionManagerStateFile: ownership.session.environment.OPENCLAW_SESSION_MANAGER_STATE_FILE,
    eventHubRuntimeSource: ownership.eventHub.environment.OPENCLAW_BODY_RUNTIME_SOURCE,
    eventHubWorkingDirectory: ownership.eventHub.serviceConfig.WorkingDirectory,
    coreRuntimeSource: ownership.core.environment.OPENCLAW_BODY_RUNTIME_SOURCE,
    coreWorkingDirectory: ownership.core.serviceConfig.WorkingDirectory,
    coreStateFile: ownership.core.environment.OPENCLAW_CORE_STATE_FILE,
    declaredUserOwnedUnits: ownership.core.environment.OPENCLAW_BODY_USER_OWNED_UNITS,
    screenSenseRuntimeSource: ownership.screenSense.environment.OPENCLAW_BODY_RUNTIME_SOURCE,
    screenSenseWorkingDirectory: ownership.screenSense.serviceConfig.WorkingDirectory,
    screenActRuntimeSource: ownership.screenAct.environment.OPENCLAW_BODY_RUNTIME_SOURCE,
    screenActWorkingDirectory: ownership.screenAct.serviceConfig.WorkingDirectory,
    systemSenseRuntimeSource: ownership.systemSense.environment.OPENCLAW_BODY_RUNTIME_SOURCE,
    systemSenseWorkingDirectory: ownership.systemSense.serviceConfig.WorkingDirectory,
    systemSenseLimitMEMLOCK: ownership.systemSense.serviceConfig.LimitMEMLOCK,
    systemHealRuntimeSource: ownership.systemHeal.environment.OPENCLAW_BODY_RUNTIME_SOURCE,
    systemHealWorkingDirectory: ownership.systemHeal.serviceConfig.WorkingDirectory,
    observerUiRuntimeSource: ownership.observerUi.environment.OPENCLAW_BODY_RUNTIME_SOURCE,
    observerUiWorkingDirectory: ownership.observerUi.serviceConfig.WorkingDirectory,
  },
}, null, 2));
EOF

  user_unit_json="$(nix_flake eval \
    --no-update-lock-file --json \
    .#nixosConfigurations.openclaw-local-dev.config.systemd.user.services \
    --apply 'services: let unit = services."openclaw-trusted-sidecar@"; service = unit.serviceConfig; in {
      wantedBy = unit.wantedBy;
      environment = unit.environment;
      serviceConfig = {
        inherit (service) Restart EnvironmentFile WorkingDirectory ExecStart NoNewPrivileges PrivateTmp ProtectSystem ProtectHome ReadWritePaths RestrictAddressFamilies;
      };
    }')"
  node - <<'EOF' "$user_unit_json"
const unit = JSON.parse(process.argv[2]);
const service = unit.serviceConfig ?? {};
if ((unit.wantedBy ?? []).length !== 0
  || service.Restart !== "no"
  || service.EnvironmentFile !== "%t/openclaw-sidecars/%i.env"
  || unit.environment?.OPENCLAW_BODY_RUNTIME_SOURCE !== "nix-store"
  || !String(service.WorkingDirectory ?? "").startsWith("/nix/store/")
  || !String(service.WorkingDirectory ?? "").endsWith("/share/openclaw/services/openclaw-session-manager")
  || service.WorkingDirectory?.includes("/opt/openclaw")
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
    runtimeSource: unit.environment.OPENCLAW_BODY_RUNTIME_SOURCE,
    workingDirectory: service.WorkingDirectory,
    noNewPrivileges: service.NoNewPrivileges,
    readWritePaths: service.ReadWritePaths,
    addressFamilies: service.RestrictAddressFamilies,
  },
}, null, 2));
EOF

  event_hub_out="$(nix_flake build \
    --no-update-lock-file --no-link --print-out-paths .#openclaw-event-hub)"
  event_hub_working_dir="$event_hub_out/share/openclaw/services/openclaw-event-hub"
  event_hub_server="$event_hub_working_dir/src/server.mjs"
  if [[ "$event_hub_out" != /nix/store/*
    || ! -f "$event_hub_server"
    || ! -f "$event_hub_out/share/openclaw/packages/shared-utils/src/http.mjs"
    || ! -f "$event_hub_out/share/openclaw/packages/shared-utils/src/service-credentials.mjs"
    || -w "$event_hub_server"
    || -e "$event_hub_out/share/openclaw/packages/shared-utils/src/work-view-trust.mjs" ]]; then
    echo "event-hub Nix closure is not minimal and read-only: $event_hub_out" >&2
    exit 1
  fi

  (
    runtime_dir="$(mktemp -d)"
    runtime_port=5841
    runtime_url="http://127.0.0.1:$runtime_port"
    cleanup_runtime() {
      if [[ -n "${runtime_pid:-}" ]]; then
        kill -TERM "$runtime_pid" >/dev/null 2>&1 || true
        wait "$runtime_pid" >/dev/null 2>&1 || true
      fi
      rm -rf "$runtime_dir"
    }
    trap cleanup_runtime EXIT

    cd "$event_hub_working_dir"
    OPENCLAW_EVENT_HUB_HOST=127.0.0.1 \
    OPENCLAW_EVENT_HUB_PORT="$runtime_port" \
    OPENCLAW_BODY_RUNTIME_SOURCE=nix-store \
    OPENCLAW_BODY_STATE_DIR="$runtime_dir" \
    OPENCLAW_EVENT_LOG_FILE="$runtime_dir/events.jsonl" \
      "${pkgs_node:-$(command -v node)}" src/server.mjs >"$runtime_dir/event-hub.log" 2>&1 &
    runtime_pid=$!

    for _ in $(seq 1 50); do
      if curl --silent --fail "$runtime_url/health" >"$runtime_dir/health.json"; then
        break
      fi
      sleep 0.1
    done
    curl --silent --fail -X POST "$runtime_url/events" \
      -H 'content-type: application/json' \
      --data '{"type":"phase_a.nix_store_probe","source":"body-config-milestone","payload":{"runtimeSource":"nix-store"}}' \
      >"$runtime_dir/published.json"
    curl --silent --fail "$runtime_url/events/audit?type=phase_a.nix_store_probe&limit=1" \
      >"$runtime_dir/audit.json"

    node - <<'EOF' "$runtime_dir/health.json" "$runtime_dir/published.json" "$runtime_dir/audit.json" "$event_hub_out"
const fs = require("node:fs");
const health = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const published = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
const audit = JSON.parse(fs.readFileSync(process.argv[4], "utf8"));
const storePath = process.argv[5];
if (health.service !== "openclaw-event-hub"
  || published.ok !== true
  || published.event?.type !== "phase_a.nix_store_probe"
  || audit.items?.[0]?.payload?.runtimeSource !== "nix-store") {
  throw new Error(`store-native event hub did not serve real audit behavior: ${JSON.stringify({ health, published, audit })}`);
}
console.log(JSON.stringify({
  nixStoreEventHub: {
    storePath,
    readOnlySource: true,
    health: health.service,
    auditEvent: audit.items[0].type,
    runtimeSource: audit.items[0].payload.runtimeSource,
  },
}, null, 2));
EOF
  )

  core_out="$(nix_flake build \
    --no-update-lock-file --no-link --print-out-paths .#openclaw-core)"
  core_working_dir="$core_out/share/openclaw/services/openclaw-core"
  core_server="$core_working_dir/src/server.mjs"
  if [[ "$core_out" != /nix/store/*
    || ! -f "$core_server"
    || ! -f "$core_out/share/openclaw/services/openclaw-core/src/native-engineering-context-routes.mjs"
    || ! -f "$core_out/share/openclaw/services/openclaw-core/src/native-engineering-context-packet.mjs"
    || ! -f "$core_out/share/openclaw/services/openclaw-core/src/native-engineering-experience-memory.mjs"
    || ! -f "$core_out/share/openclaw/services/openclaw-core/src/native-engineering-microcompact-projection.mjs"
    || ! -f "$core_out/share/openclaw/services/openclaw-core/src/native-engineering-work-view-action-decision.mjs"
    || ! -f "$core_out/share/openclaw/services/openclaw-core/src/native-engineering-work-view-semantic-action-handoff.mjs"
    || ! -f "$core_out/share/openclaw/services/openclaw-core/src/native-engineering-work-view-association.mjs"
    || ! -f "$core_out/share/openclaw/services/openclaw-core/src/native-engineering-work-view-binding.mjs"
    || ! -f "$core_out/share/openclaw/services/openclaw-core/src/native-engineering-work-view-bind-routes.mjs"
    || ! -f "$core_out/share/openclaw/services/openclaw-core/src/native-engineering-recommendation-link.mjs"
    || ! -f "$core_out/share/openclaw/services/openclaw-core/src/capability-runtime-engineering-verification.mjs"
    || ! -f "$core_out/share/openclaw/services/openclaw-core/src/capability-runtime-engineering-recovery.mjs"
    || ! -f "$core_out/share/openclaw/services/openclaw-core/src/capability-runtime-engineering-microcompact.mjs"
    || ! -f "$core_out/share/openclaw/services/openclaw-core/src/capability-runtime-engineering-provider-handoff.mjs"
    || ! -f "$core_out/share/openclaw/services/openclaw-core/src/capability-runtime-plugin-refresh.mjs"
    || ! -f "$core_out/share/openclaw/services/openclaw-core/src/capability-runtime-engineering-plan-todo.mjs"
    || ! -f "$core_out/share/openclaw/services/openclaw-core/src/native-declarative-evolution-execution.mjs"
    || ! -f "$core_out/share/openclaw/services/openclaw-core/src/native-declarative-evolution-closure-integrity.mjs"
    || ! -f "$core_out/share/openclaw/services/openclaw-core/src/native-declarative-evolution-health-gate.mjs"
    || ! -f "$core_out/share/openclaw/services/openclaw-core/src/native-declarative-evolution-host-health-oracle.mjs"
    || ! -f "$core_out/share/openclaw/services/openclaw-core/src/native-declarative-evolution-rollback-evidence.mjs"
    || ! -f "$core_out/share/openclaw/services/openclaw-core/src/native-declarative-evolution-paths.mjs"
    || ! -f "$core_out/share/openclaw/services/openclaw-core/src/native-declarative-evolution-task-builders.mjs"
    || ! -f "$core_out/share/openclaw/services/openclaw-core/src/native-declarative-evolution-task-routes.mjs"
    || ! -f "$core_out/share/openclaw/services/openclaw-core/src/native-declarative-evolution-activation-decision.mjs"
    || ! -f "$core_out/share/openclaw/services/openclaw-core/src/native-declarative-evolution-activation.mjs"
    || ! -f "$core_out/share/openclaw/services/openclaw-core/src/task-executor-native-declarative-evolution-handlers.mjs"
    || ! -f "$core_out/share/openclaw/services/openclaw-core/src/task-executor-native-declarative-evolution-activation-handlers.mjs"
    || ! -f "$core_out/share/openclaw/services/openclaw-core/src/task-executor-native-declarative-evolution-activation-execution-handlers.mjs"
    || ! -f "$core_out/share/openclaw/services/openclaw-core/src/operator-auth.mjs"
    || ! -f "$core_out/share/openclaw/services/openclaw-core/src/hostd-control-client.mjs"
    || ! -f "$core_out/share/openclaw/services/openclaw-core/src/systemd-repair-verification.mjs"
    || ! -f "$core_out/share/openclaw/services/openclaw-core/src/systemd-incident-receipt.mjs"
    || ! -f "$core_out/share/openclaw/services/openclaw-core/src/systemd-incident-provider-context.mjs"
    || ! -f "$core_out/share/openclaw/services/openclaw-core/src/capability-runtime-systemd-incident-observation.mjs"
    || ! -f "$core_out/share/openclaw/packages/shared-systemd/src/openclaw-hostd-capabilities.mjs"
    || ! -f "$core_out/share/openclaw/packages/shared-systemd/src/openclaw-hostd-capabilities.json"
    || ! -f "$core_out/share/openclaw/packages/shared-systemd/src/openclaw-hostd-activation.mjs"
    || ! -f "$core_out/share/openclaw/packages/plugin-runtime/src/plugin-registry.mjs"
    || ! -f "$core_out/share/openclaw/packages/plugin-runtime/src/plugin-registry-generation-store.mjs"
    || ! -f "$core_out/share/openclaw/packages/shared-utils/src/persist.mjs"
    || ! -f "$core_out/share/openclaw/packages/shared-utils/src/execution-grants.mjs"
    || -w "$core_server"
    || -e "$core_out/share/openclaw/services/openclaw-core/test"
    || ! -f "$core_out/share/openclaw/packages/shared-utils/src/service-credentials.mjs"
    || "$(find "$core_out" -type f | wc -l)" -ne 219 ]]; then
    echo "core Nix closure is not exact and read-only: $core_out" >&2
    exit 1
  fi

  (
    runtime_dir="$(mktemp -d)"
    runtime_port=5852
    upstream_port=5843
    runtime_url="http://127.0.0.1:$runtime_port"
    upstream_url="http://127.0.0.1:$upstream_port"
    state_file="$runtime_dir/core-state.json"
    operator_token="body-config-operator-token"
    cleanup_runtime() {
      for pid in "${core_pid:-}" "${upstream_pid:-}"; do
        if [[ -n "$pid" ]]; then
          kill -TERM "$pid" >/dev/null 2>&1 || true
          wait "$pid" >/dev/null 2>&1 || true
        fi
      done
      rm -rf "$runtime_dir"
    }
    trap cleanup_runtime EXIT

    node "$REPO_ROOT/nix/scripts/dev-body-config-store-upstream.mjs" "$upstream_port" \
      >"$runtime_dir/upstream.log" 2>&1 &
    upstream_pid=$!
    for _ in $(seq 1 50); do
      if curl --silent --fail "$upstream_url/health" >/dev/null; then
        break
      fi
      sleep 0.1
    done

    start_core() {
      cd "$core_working_dir"
      OPENCLAW_CORE_HOST=127.0.0.1 \
      OPENCLAW_CORE_PORT="$runtime_port" \
      OPENCLAW_EVENT_HUB_URL="$upstream_url" \
      OPENCLAW_SESSION_MANAGER_URL="$upstream_url" \
      OPENCLAW_BROWSER_RUNTIME_URL="$upstream_url" \
      OPENCLAW_SCREEN_SENSE_URL="$upstream_url" \
      OPENCLAW_SCREEN_ACT_URL="$upstream_url" \
      OPENCLAW_SYSTEM_SENSE_URL="$upstream_url" \
      OPENCLAW_SYSTEM_HEAL_URL="$upstream_url" \
      OPENCLAW_CORE_STATE_FILE="$state_file" \
      OPENCLAW_OPERATOR_TOKEN="$operator_token" \
      OPENCLAW_WORKSPACE_ROOTS="$runtime_dir" \
      OPENCLAW_BODY_RUNTIME_SOURCE=nix-store \
        node src/server.mjs >"$runtime_dir/core.log" 2>&1 &
      core_pid=$!
      for _ in $(seq 1 50); do
        if curl --silent --fail "$runtime_url/health" >"$runtime_dir/health.json"; then
          return 0
        fi
        sleep 0.1
      done
      return 1
    }

    start_core
    curl --silent --fail -X POST "$runtime_url/tasks" \
      -H 'content-type: application/json' \
      -H "authorization: Bearer $operator_token" \
      --data '{"type":"phase_a_nix_store_probe","goal":"Persist a queued control-plane task without execution","intent":"task.observe"}' \
      >"$runtime_dir/created.json"
    task_id="$(node -e 'const fs = require("node:fs"); const data = JSON.parse(fs.readFileSync(process.argv[1], "utf8")); process.stdout.write(data.task.id)' "$runtime_dir/created.json")"
    for _ in $(seq 1 50); do
      if node -e 'const fs = require("node:fs"); try { const state = JSON.parse(fs.readFileSync(process.argv[1], "utf8")); process.exit(state.tasks?.some((task) => task.id === process.argv[2] && task.status === "queued") ? 0 : 1); } catch { process.exit(1); }' "$state_file" "$task_id"; then
        break
      fi
      sleep 0.1
    done
    kill -TERM "$core_pid"
    wait "$core_pid" >/dev/null 2>&1 || true
    core_pid=""
    start_core
    curl --silent --fail "$runtime_url/tasks?limit=5" \
      -H "authorization: Bearer $operator_token" >"$runtime_dir/restored.json"

    node - <<'EOF' "$runtime_dir/health.json" "$runtime_dir/created.json" "$runtime_dir/restored.json" "$state_file" "$core_out"
const fs = require("node:fs");
const health = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const created = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
const restored = JSON.parse(fs.readFileSync(process.argv[4], "utf8"));
const persisted = JSON.parse(fs.readFileSync(process.argv[5], "utf8"));
const storePath = process.argv[6];
const taskId = created.task?.id;
const restoredTask = restored.items?.find((task) => task.id === taskId);
if (health.service !== "openclaw-core"
  || health.stateFilePath !== process.argv[5]
  || created.ok !== true
  || created.task?.status !== "queued"
  || restored.count !== 1
  || restoredTask?.status !== "queued"
  || persisted.tasks?.[0]?.id !== taskId
  || persisted.tasks[0].status !== "queued"
  || restoredTask?.outcome !== null) {
  throw new Error(`store-native core did not persist queued control-plane state: ${JSON.stringify({ health, created, restored, persisted })}`);
}
console.log(JSON.stringify({
  nixStoreCore: {
    storePath,
    readOnlySource: true,
    writableStatePath: health.stateFilePath,
    taskId,
    taskStatus: restoredTask.status,
    restoredAfterRestart: true,
    taskExecuted: restoredTask.outcome !== null,
  },
}, null, 2));
EOF
  )

  session_manager_out="$(nix_flake build \
    --no-update-lock-file --no-link --print-out-paths .#openclaw-session-manager)"
  session_manager_working_dir="$session_manager_out/share/openclaw/services/openclaw-session-manager"
  session_manager_server="$session_manager_working_dir/src/server.mjs"
  if [[ "$session_manager_out" != /nix/store/*
    || ! -f "$session_manager_server"
    || ! -f "$session_manager_out/share/openclaw/services/openclaw-session-manager/src/trusted-work-view-sidecar.mjs"
    || ! -f "$session_manager_out/share/openclaw/packages/shared-utils/src/work-view-trust.mjs"
    || -w "$session_manager_server"
    || -e "$session_manager_out/share/openclaw/services/openclaw-session-manager/test"
    || ! -f "$session_manager_out/share/openclaw/packages/shared-utils/src/service-credentials.mjs"
    || "$(find "$session_manager_out" -type f | wc -l)" -ne 15 ]]; then
    echo "session-manager Nix closure is not exact and read-only: $session_manager_out" >&2
    exit 1
  fi

  (
    runtime_dir="$(mktemp -d)"
    runtime_port=5847
    upstream_port=5843
    runtime_url="http://127.0.0.1:$runtime_port"
    upstream_url="http://127.0.0.1:$upstream_port"
    state_file="$runtime_dir/session-manager-state.json"
    cleanup_runtime() {
      for pid in "${session_manager_pid:-}" "${upstream_pid:-}"; do
        if [[ -n "$pid" ]]; then
          kill -TERM "$pid" >/dev/null 2>&1 || true
          wait "$pid" >/dev/null 2>&1 || true
        fi
      done
      rm -rf "$runtime_dir"
    }
    trap cleanup_runtime EXIT

    node "$REPO_ROOT/nix/scripts/dev-body-config-store-upstream.mjs" "$upstream_port" \
      >"$runtime_dir/upstream.log" 2>&1 &
    upstream_pid=$!
    for _ in $(seq 1 50); do
      if curl --silent --fail "$upstream_url/health" >/dev/null; then
        break
      fi
      sleep 0.1
    done
    cd "$session_manager_working_dir"
    OPENCLAW_SESSION_MANAGER_HOST=127.0.0.1 \
    OPENCLAW_SESSION_MANAGER_PORT="$runtime_port" \
    OPENCLAW_EVENT_HUB_URL="$upstream_url" \
    OPENCLAW_BROWSER_RUNTIME_URL="$upstream_url" \
    OPENCLAW_SESSION_MANAGER_STATE_FILE="$state_file" \
    OPENCLAW_BODY_RUNTIME_SOURCE=nix-store \
      node src/server.mjs >"$runtime_dir/session-manager.log" 2>&1 &
    session_manager_pid=$!

    for _ in $(seq 1 50); do
      if curl --silent --fail "$runtime_url/health" >/dev/null; then
        break
      fi
      sleep 0.1
    done
    curl --silent --fail -X POST "$runtime_url/session/start" \
      -H 'content-type: application/json' \
      --data '{"displayTarget":"nix-store-workspace"}' >"$runtime_dir/started.json"
    curl --silent --fail "$runtime_url/session/state" >"$runtime_dir/state.json"

    node - <<'EOF' "$runtime_dir/started.json" "$runtime_dir/state.json" "$state_file" "$session_manager_out"
const fs = require("node:fs");
const started = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const state = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
const recoveryStatePath = process.argv[4];
const storePath = process.argv[5];
const helper = state.workView?.helperRuntime ?? {};
if (started.ok !== true
  || started.reused !== false
  || started.session?.status !== "running"
  || started.session?.displayTarget !== "nix-store-workspace"
  || state.session?.sessionId !== started.session.sessionId
  || state.trustedSession?.kind !== "openclaw-trusted-session-work-view-contract"
  || state.trustedSession?.identityLevel !== "level_2_trusted_session_work_view"
  || state.trustedSession?.sessionIdentity?.status !== "authoritative"
  || helper.status !== "awaiting_browser"
  || helper.externalProcessStarted !== false
  || helper.sidecar?.running !== false
  || state.trustedSession?.readiness !== "degraded"
  || state.trustedSession?.recoveryRecommendation?.action !== "prepare_work_view"
  || fs.existsSync(recoveryStatePath)) {
  throw new Error(`store-native session-manager did not preserve bounded session ownership: ${JSON.stringify({ started, state, recoveryStatePath })}`);
}
console.log(JSON.stringify({
  nixStoreSessionManager: {
    storePath,
    readOnlySource: true,
    sessionStatus: started.session.status,
    displayTarget: started.session.displayTarget,
    trustedSession: state.trustedSession.kind,
    identityLevel: state.trustedSession.identityLevel,
    helperStatus: helper.status,
    externalSidecarStarted: helper.externalProcessStarted,
    recoveryStatePath,
    recoveryIntentWritten: false,
  },
}, null, 2));
EOF
  )

  browser_runtime_out="$(nix_flake build \
    --no-update-lock-file --no-link --print-out-paths .#openclaw-browser-runtime)"
  browser_runtime_working_dir="$browser_runtime_out/share/openclaw/services/openclaw-browser-runtime"
  browser_runtime_server="$browser_runtime_working_dir/src/server.mjs"
  browser_runtime_source_count="$(find "$browser_runtime_out/share/openclaw" \
    -path '*/node_modules' -prune -o -type f -print | wc -l)"
  if [[ "$browser_runtime_out" != /nix/store/*
    || ! -f "$browser_runtime_server"
    || ! -f "$browser_runtime_working_dir/node_modules/puppeteer-core/package.json"
    || ! -f "$browser_runtime_out/share/openclaw/packages/shared-utils/src/work-view-input-evidence.mjs"
    || ! -f "$browser_runtime_out/share/openclaw/packages/shared-utils/src/service-credentials.mjs"
    || -w "$browser_runtime_server"
    || -e "$browser_runtime_working_dir/node_modules/@openclaw"
    || -e "$browser_runtime_working_dir/node_modules/typescript"
    || "$browser_runtime_source_count" -ne 15 ]]; then
    echo "browser-runtime Nix closure is not exact, production-only, and read-only: $browser_runtime_out" >&2
    exit 1
  fi

  (
    runtime_dir="$(mktemp -d)"
    runtime_port=5849
    upstream_port=5843
    runtime_url="http://127.0.0.1:$runtime_port"
    upstream_url="http://127.0.0.1:$upstream_port"
    state_file="$runtime_dir/browser-runtime-state.json"
    cleanup_runtime() {
      for pid in "${browser_runtime_pid:-}" "${upstream_pid:-}"; do
        if [[ -n "$pid" ]]; then
          kill -TERM "$pid" >/dev/null 2>&1 || true
          wait "$pid" >/dev/null 2>&1 || true
        fi
      done
      rm -rf "$runtime_dir"
    }
    trap cleanup_runtime EXIT

    node "$REPO_ROOT/nix/scripts/dev-body-config-store-upstream.mjs" "$upstream_port" \
      >"$runtime_dir/upstream.log" 2>&1 &
    upstream_pid=$!
    for _ in $(seq 1 50); do
      if curl --silent --fail "$upstream_url/health" >/dev/null; then
        break
      fi
      sleep 0.1
    done

    start_browser_runtime() {
      cd "$browser_runtime_working_dir"
      OPENCLAW_BROWSER_RUNTIME_HOST=127.0.0.1 \
      OPENCLAW_BROWSER_RUNTIME_PORT="$runtime_port" \
      OPENCLAW_EVENT_HUB_URL="$upstream_url" \
      OPENCLAW_SESSION_MANAGER_URL="$upstream_url" \
      OPENCLAW_BROWSER_RUNTIME_STATE_FILE="$state_file" \
      OPENCLAW_BROWSER_ENGINE_MODE=simulated \
      OPENCLAW_BROWSER_ALLOW_LOCAL_FIXTURES=1 \
      OPENCLAW_BROWSER_PROFILE_DIR="$runtime_dir/profile" \
      OPENCLAW_BODY_RUNTIME_SOURCE=nix-store \
        node src/server.mjs >"$runtime_dir/browser-runtime.log" 2>&1 &
      browser_runtime_pid=$!
      for _ in $(seq 1 50); do
        if curl --silent --fail "$runtime_url/health" >/dev/null; then
          return 0
        fi
        sleep 0.1
      done
      return 1
    }

    start_browser_runtime
    curl --silent --fail -X POST "$runtime_url/browser/open" \
      -H 'content-type: application/json' \
      --data "{\"url\":\"$upstream_url/health\",\"sessionId\":\"nix-store-browser-session\",\"sessionAuthority\":\"openclaw-session-manager\"}" \
      >"$runtime_dir/open.json"
    kill -TERM "$browser_runtime_pid"
    wait "$browser_runtime_pid" >/dev/null 2>&1 || true
    browser_runtime_pid=""
    start_browser_runtime
    curl --silent --fail "$runtime_url/browser/state" >"$runtime_dir/restored.json"

    node - <<'EOF' "$runtime_dir/open.json" "$runtime_dir/restored.json" "$state_file" "$browser_runtime_out"
const fs = require("node:fs");
const opened = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const restored = JSON.parse(fs.readFileSync(process.argv[3], "utf8")).browser ?? {};
const persisted = JSON.parse(fs.readFileSync(process.argv[4], "utf8"));
const storePath = process.argv[5];
if (opened.ok !== true
  || opened.browser?.engine?.mode !== "simulated"
  || opened.browser?.engine?.realEngine !== false
  || opened.browser?.activeUrl !== "http://127.0.0.1:5843/health"
  || restored.running !== false
  || restored.activeUrl !== opened.browser.activeUrl
  || restored.sessionId !== "nix-store-browser-session"
  || restored.workspaceRecovery?.restored !== true
  || restored.workspaceRecovery?.automaticActionReplay !== false
  || restored.trustedHelperLease !== null
  || persisted.safety?.trustedHelperLeasePersisted !== false
  || persisted.safety?.inputPersisted !== false
  || persisted.safety?.clickPersisted !== false) {
  throw new Error(`store-native browser-runtime did not preserve fail-closed workspace intent: ${JSON.stringify({ opened, restored, persisted })}`);
}
console.log(JSON.stringify({
  nixStoreBrowserRuntime: {
    storePath,
    readOnlySource: true,
    puppeteerResolvedFromStore: true,
    engineMode: opened.browser.engine.mode,
    activeUrl: opened.browser.activeUrl,
    restoredIntent: restored.workspaceRecovery.restored,
    browserAutoRestarted: restored.running,
    authorityRestored: restored.trustedHelperLease !== null,
  },
}, null, 2));
EOF
  )

  screen_sense_out="$(nix_flake build \
    --no-update-lock-file --no-link --print-out-paths .#openclaw-screen-sense)"
  screen_sense_working_dir="$screen_sense_out/share/openclaw/services/openclaw-screen-sense"
  screen_sense_server="$screen_sense_working_dir/src/server.mjs"
  if [[ "$screen_sense_out" != /nix/store/*
    || ! -f "$screen_sense_server"
    || ! -f "$screen_sense_out/share/openclaw/packages/shared-events/src/event-factory.mjs"
    || ! -f "$screen_sense_out/share/openclaw/packages/shared-utils/src/work-view-semantic-targets.mjs"
    || ! -f "$screen_sense_out/share/openclaw/packages/shared-utils/src/service-credentials.mjs"
    || -w "$screen_sense_server"
    || -e "$screen_sense_out/share/openclaw/packages/shared-utils/test/work-view-trust.test.mjs"
    || "$(find "$screen_sense_out" -type f | wc -l)" -ne 11 ]]; then
    echo "screen-sense Nix closure is not exact and read-only: $screen_sense_out" >&2
    exit 1
  fi

  (
    runtime_dir="$(mktemp -d)"
    runtime_port=5842
    upstream_port=5843
    runtime_url="http://127.0.0.1:$runtime_port"
    upstream_url="http://127.0.0.1:$upstream_port"
    cleanup_runtime() {
      for pid in "${screen_sense_pid:-}" "${upstream_pid:-}"; do
        if [[ -n "$pid" ]]; then
          kill -TERM "$pid" >/dev/null 2>&1 || true
          wait "$pid" >/dev/null 2>&1 || true
        fi
      done
      rm -rf "$runtime_dir"
    }
    trap cleanup_runtime EXIT

    node "$REPO_ROOT/nix/scripts/dev-body-config-store-upstream.mjs" "$upstream_port" \
      >"$runtime_dir/upstream.log" 2>&1 &
    upstream_pid=$!
    for _ in $(seq 1 50); do
      if curl --silent --fail "$upstream_url/health" >/dev/null; then
        break
      fi
      sleep 0.1
    done
    cd "$screen_sense_working_dir"
    OPENCLAW_SCREEN_SENSE_HOST=127.0.0.1 \
    OPENCLAW_SCREEN_SENSE_PORT="$runtime_port" \
    OPENCLAW_EVENT_HUB_URL="$upstream_url" \
    OPENCLAW_SESSION_MANAGER_URL="$upstream_url" \
    OPENCLAW_BROWSER_RUNTIME_URL="$upstream_url" \
    OPENCLAW_BODY_RUNTIME_SOURCE=nix-store \
      node src/server.mjs >"$runtime_dir/screen-sense.log" 2>&1 &
    screen_sense_pid=$!

    for _ in $(seq 1 50); do
      if curl --silent --fail "$runtime_url/screen/current" >"$runtime_dir/screen.json"; then
        break
      fi
      sleep 0.1
    done
    node - <<'EOF' "$runtime_dir/screen.json" "$screen_sense_out"
const fs = require("node:fs");
const data = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const storePath = process.argv[3];
const screen = data.screen ?? {};
if (data.ok !== true
  || screen.captureSource !== "browser-runtime"
  || screen.captureStrategy !== "browser-runtime-backed"
  || screen.workViewSummary?.url !== "https://example.com/nix-store-screen-sense"
  || screen.snapshotText !== "Nix store screen capture") {
  throw new Error(`store-native screen-sense did not produce real readback: ${JSON.stringify(data)}`);
}
console.log(JSON.stringify({
  nixStoreScreenSense: {
    storePath,
    readOnlySource: true,
    captureSource: screen.captureSource,
    activeUrl: screen.workViewSummary.url,
    snapshotText: screen.snapshotText,
  },
}, null, 2));
EOF
  )

  screen_act_out="$(nix_flake build \
    --no-update-lock-file --no-link --print-out-paths .#openclaw-screen-act)"
  screen_act_working_dir="$screen_act_out/share/openclaw/services/openclaw-screen-act"
  screen_act_server="$screen_act_working_dir/src/server.mjs"
  if [[ "$screen_act_out" != /nix/store/*
    || ! -f "$screen_act_server"
    || ! -f "$screen_act_out/share/openclaw/services/openclaw-screen-act/src/trusted-work-view-action-mediation.mjs"
    || ! -f "$screen_act_out/share/openclaw/packages/shared-utils/src/work-view-input-evidence.mjs"
    || ! -f "$screen_act_out/share/openclaw/packages/shared-utils/src/execution-grants.mjs"
    || ! -f "$screen_act_out/share/openclaw/packages/shared-utils/src/service-credentials.mjs"
    || -w "$screen_act_server"
    || -e "$screen_act_out/share/openclaw/packages/shared-utils/test/http.test.mjs"
    || "$(find "$screen_act_out" -type f | wc -l)" -ne 13 ]]; then
    echo "screen-act Nix closure is not exact and read-only: $screen_act_out" >&2
    exit 1
  fi

  (
    runtime_dir="$(mktemp -d)"
    runtime_port=5844
    upstream_port=5843
    runtime_url="http://127.0.0.1:$runtime_port"
    upstream_url="http://127.0.0.1:$upstream_port"
    input_text="nix store action remains write only"
    grant_private_key="$runtime_dir/execution-grant-private.pem"
    grant_public_key="$runtime_dir/execution-grant-public.pem"
    cleanup_runtime() {
      for pid in "${screen_act_pid:-}" "${upstream_pid:-}"; do
        if [[ -n "$pid" ]]; then
          kill -TERM "$pid" >/dev/null 2>&1 || true
          wait "$pid" >/dev/null 2>&1 || true
        fi
      done
      rm -rf "$runtime_dir"
    }
    trap cleanup_runtime EXIT

    node "$REPO_ROOT/nix/scripts/dev-body-config-store-upstream.mjs" "$upstream_port" \
      >"$runtime_dir/upstream.log" 2>&1 &
    upstream_pid=$!
    for _ in $(seq 1 50); do
      if curl --silent --fail "$upstream_url/health" >/dev/null; then
        break
      fi
      sleep 0.1
    done
    node --input-type=module -e '
      import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
      import { createPrivateKey, createPublicKey, generateKeyPairSync } from "node:crypto";
      const [privatePath, publicPath] = process.argv.slice(1);
      if (!existsSync(privatePath)) {
        const { privateKey } = generateKeyPairSync("ed25519");
        writeFileSync(privatePath, privateKey.export({ type: "pkcs8", format: "pem" }), { mode: 0o600 });
      }
      const privateKey = createPrivateKey(readFileSync(privatePath, "utf8"));
      writeFileSync(publicPath, createPublicKey(privateKey).export({ type: "spki", format: "pem" }), { mode: 0o644 });
      chmodSync(privatePath, 0o600);
      chmodSync(publicPath, 0o644);
    ' "$grant_private_key" "$grant_public_key"
    cd "$screen_act_working_dir"
    OPENCLAW_SCREEN_ACT_HOST=127.0.0.1 \
    OPENCLAW_SCREEN_ACT_PORT="$runtime_port" \
    OPENCLAW_EVENT_HUB_URL="$upstream_url" \
    OPENCLAW_SCREEN_SENSE_URL="$upstream_url" \
    OPENCLAW_SESSION_MANAGER_URL="$upstream_url" \
    OPENCLAW_BROWSER_RUNTIME_URL="$upstream_url" \
    OPENCLAW_EXECUTION_GRANT_PUBLIC_KEY_FILE="$grant_public_key" \
    OPENCLAW_BODY_RUNTIME_SOURCE=nix-store \
      node src/server.mjs >"$runtime_dir/screen-act.log" 2>&1 &
    screen_act_pid=$!

    for _ in $(seq 1 50); do
      if curl --silent --fail "$runtime_url/health" >/dev/null; then
        break
      fi
      sleep 0.1
    done
    grant_token="$(OPENCLAW_GRANT_INPUT="$input_text" node --input-type=module -e '
      const modulePath = process.argv[1];
      const privatePath = process.argv[2];
      const { createExecutionGrantSigner } = await import(modulePath);
      const signer = createExecutionGrantSigner({ privateKeyFilePath: privatePath });
      process.stdout.write(signer.issue({
        audience: "openclaw-screen-act",
        method: "POST",
        path: "/act/keyboard/type",
        body: { text: process.env.OPENCLAW_GRANT_INPUT },
      }));
    ' "$screen_act_out/share/openclaw/packages/shared-utils/src/execution-grants.mjs" "$grant_private_key")"
    curl --silent --fail -X POST "$runtime_url/act/keyboard/type" \
      -H 'content-type: application/json' \
      -H "x-openclaw-execution-grant: $grant_token" \
      --data "{\"text\":\"$input_text\"}" >"$runtime_dir/action.json"
    curl --silent --fail "$runtime_url/act/state" >"$runtime_dir/action-state.json"

    node - <<'EOF' "$runtime_dir/action.json" "$runtime_dir/action-state.json" "$screen_act_out" "$input_text"
const fs = require("node:fs");
const actionText = fs.readFileSync(process.argv[2], "utf8");
const stateText = fs.readFileSync(process.argv[3], "utf8");
const action = JSON.parse(actionText).action ?? {};
const storePath = process.argv[4];
const inputText = process.argv[5];
if (action.result !== "executed-browser-runtime"
  || action.mediation?.accepted !== true
  || action.mediation?.leaseMatched !== true
  || action.mediation?.transport !== "browser-runtime-direct"
  || action.params?.inputEvidence?.registry !== "openclaw-write-only-input-evidence-v0"
  || action.params.inputEvidence.charCount !== inputText.length
  || action.params.inputEvidence.textExposed !== false
  || "text" in (action.params ?? {})
  || actionText.includes(inputText)
  || stateText.includes(inputText)) {
  throw new Error(`store-native screen-act did not mediate write-only input: ${actionText}`);
}
console.log(JSON.stringify({
  nixStoreScreenAct: {
    storePath,
    readOnlySource: true,
    result: action.result,
    transport: action.mediation.transport,
    leaseMatched: action.mediation.leaseMatched,
    inputChars: action.params.inputEvidence.charCount,
    textExposed: action.params.inputEvidence.textExposed,
  },
}, null, 2));
EOF
  )

  system_sense_out="$(nix_flake build \
    --no-update-lock-file --no-link --print-out-paths .#openclaw-system-sense)"
  system_sense_working_dir="$system_sense_out/share/openclaw/services/openclaw-system-sense"
  system_sense_server="$system_sense_working_dir/src/server.mjs"
  system_sense_source_count="$(find "$system_sense_out/share/openclaw" \
    -path '*/node_modules' -prune -o -type f -print | wc -l)"
  if [[ "$system_sense_out" != /nix/store/*
    || ! -f "$system_sense_server"
    || ! -f "$system_sense_working_dir/node_modules/@homebridge/dbus-native/package.json"
    || ! -f "$system_sense_out/share/openclaw/services/openclaw-system-sense/src/kernel-process-exec-capture.mjs"
    || ! -f "$system_sense_out/share/openclaw/services/openclaw-system-sense/src/kernel-process-exec-readback.mjs"
    || ! -f "$system_sense_out/share/openclaw/services/openclaw-system-sense/src/system-kernel-event-routes.mjs"
    || ! -f "$system_sense_out/share/openclaw/services/openclaw-system-sense/src/system-health-governance.mjs"
    || ! -f "$system_sense_out/share/openclaw/services/openclaw-system-sense/src/systemd-dbus-adapter.mjs"
    || ! -f "$system_sense_out/share/openclaw/services/openclaw-system-sense/src/systemd-routes.mjs"
    || ! -f "$system_sense_out/share/openclaw/packages/shared-events/src/event-names.mjs"
    || ! -f "$system_sense_out/share/openclaw/packages/shared-utils/src/execution-grants.mjs"
    || ! -f "$system_sense_out/share/openclaw/packages/shared-utils/src/service-credentials.mjs"
    || -w "$system_sense_server"
    || -e "$system_sense_out/share/openclaw/services/openclaw-system-sense/test"
    || -e "$system_sense_working_dir/node_modules/@openclaw"
    || -e "$system_sense_working_dir/node_modules/puppeteer-core"
    || -e "$system_sense_working_dir/node_modules/typescript"
    || ! -f "$system_sense_out/share/openclaw/services/openclaw-system-sense/src/systemd-dbus-transport.mjs"
    || ! -f "$system_sense_out/share/openclaw/packages/shared-systemd/src/systemd-dbus-transport.mjs"
    || "$system_sense_source_count" -ne 28 ]]; then
    echo "system-sense Nix closure is not exact, production-only, and read-only: $system_sense_out" >&2
    exit 1
  fi

  kernel_probe_out="$(nix_flake build \
    --no-update-lock-file --no-link --print-out-paths .#openclaw-kernel-event-probe)"
  if [[ "$kernel_probe_out" != /nix/store/*
    || ! -x "$kernel_probe_out/bin/openclaw-kernel-process-exec"
    || ! -f "$kernel_probe_out/lib/openclaw-kernel-process-exec.bpf.o"
    || ! -x "$kernel_probe_out/libexec/openclaw-kernel-process-exec-loader" ]]; then
    echo "kernel process-exec probe package is incomplete: $kernel_probe_out" >&2
    exit 1
  fi

  hostd_out="$(nix_flake build \
    --no-update-lock-file --no-link --print-out-paths .#openclaw-hostd)"
  hostd_working_dir="$hostd_out/share/openclaw/services/openclaw-hostd"
  if [[ "$hostd_out" != /nix/store/*
    || ! -f "$hostd_working_dir/src/server.mjs"
    || ! -f "$hostd_working_dir/src/hostd-protocol.mjs"
    || ! -f "$hostd_working_dir/src/hostd-activation-protocol.mjs"
    || ! -f "$hostd_working_dir/src/managed-config-activation.mjs"
    || ! -f "$hostd_working_dir/src/openclaw-hostd-peer-credentials.c"
    || ! -x "$hostd_out/bin/openclaw-hostd-peer-credentials"
    || ! -f "$hostd_out/share/openclaw/packages/shared-systemd/src/systemd-dbus-transport.mjs"
    || ! -f "$hostd_out/share/openclaw/packages/shared-systemd/src/openclaw-hostd-capabilities.mjs"
    || ! -f "$hostd_out/share/openclaw/packages/shared-systemd/src/openclaw-hostd-capabilities.json"
    || ! -f "$hostd_out/share/openclaw/packages/shared-systemd/src/openclaw-hostd-activation.mjs"
    || ! -f "$hostd_working_dir/node_modules/@homebridge/dbus-native/package.json"
    || -w "$hostd_working_dir/src/server.mjs"
    || -e "$hostd_working_dir/test" ]]; then
    echo "openclaw-hostd Nix closure is not fixed, production-only, and read-only: $hostd_out" >&2
    exit 1
  fi

  (
    runtime_dir="$(mktemp -d)"
    runtime_port=5846
    upstream_port=5843
    runtime_url="http://127.0.0.1:$runtime_port"
    upstream_url="http://127.0.0.1:$upstream_port"
    cleanup_runtime() {
      for pid in "${system_sense_pid:-}" "${upstream_pid:-}"; do
        if [[ -n "$pid" ]]; then
          kill -TERM "$pid" >/dev/null 2>&1 || true
          wait "$pid" >/dev/null 2>&1 || true
        fi
      done
      rm -rf "$runtime_dir"
    }
    trap cleanup_runtime EXIT

    node "$REPO_ROOT/nix/scripts/dev-body-config-store-upstream.mjs" "$upstream_port" \
      >"$runtime_dir/upstream.log" 2>&1 &
    upstream_pid=$!
    for _ in $(seq 1 50); do
      if curl --silent --fail "$upstream_url/health" >/dev/null; then
        break
      fi
      sleep 0.1
    done
    cd "$system_sense_working_dir"
    OPENCLAW_SYSTEM_SENSE_HOST=127.0.0.1 \
    OPENCLAW_SYSTEM_SENSE_PORT="$runtime_port" \
    OPENCLAW_BODY_STATE_DIR="$runtime_dir" \
    OPENCLAW_SYSTEM_SENSE_DISK_PATH="$runtime_dir" \
    OPENCLAW_SYSTEM_ALLOWED_ROOTS="$runtime_dir" \
    OPENCLAW_CORE_URL="$upstream_url" \
    OPENCLAW_EVENT_HUB_URL="$upstream_url" \
    OPENCLAW_SESSION_MANAGER_URL="$upstream_url" \
    OPENCLAW_BROWSER_RUNTIME_URL="$upstream_url" \
    OPENCLAW_SCREEN_SENSE_URL="$upstream_url" \
    OPENCLAW_SCREEN_ACT_URL="$upstream_url" \
    OPENCLAW_SYSTEM_HEAL_URL="$upstream_url" \
    OPENCLAW_BODY_RUNTIME_SOURCE=nix-store \
      node src/server.mjs >"$runtime_dir/system-sense.log" 2>&1 &
    system_sense_pid=$!

    for _ in $(seq 1 50); do
      if curl --silent --fail "$runtime_url/system/body" >"$runtime_dir/body.json"; then
        break
      fi
      sleep 0.1
    done
    node - <<'EOF' "$runtime_dir/body.json" "$runtime_dir" "$system_sense_out"
const fs = require("node:fs");
const data = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const runtimeDir = process.argv[3];
const storePath = process.argv[4];
if (data.ok !== true
  || data.body?.platform !== "linux"
  || data.body?.stateDir !== runtimeDir
  || data.body?.diskPath !== runtimeDir
  || data.resources?.disk?.path !== runtimeDir
  || data.resources?.disk?.available !== true
  || data.network?.checkedTargets !== 7
  || data.network?.online !== true) {
  throw new Error(`store-native system-sense did not produce bounded body readback: ${JSON.stringify(data)}`);
}
console.log(JSON.stringify({
  nixStoreSystemSense: {
    storePath,
    readOnlySource: true,
    platform: data.body.platform,
    writableStatePath: data.body.stateDir,
    diskProbePath: data.resources.disk.path,
    checkedTargets: data.network.checkedTargets,
    networkOnline: data.network.online,
    commandExecuted: false,
    hostMutation: false,
  },
}, null, 2));
EOF
  )

  system_heal_out="$(nix_flake build \
    --no-update-lock-file --no-link --print-out-paths .#openclaw-system-heal)"
  system_heal_working_dir="$system_heal_out/share/openclaw/services/openclaw-system-heal"
  system_heal_server="$system_heal_working_dir/src/server.mjs"
  if [[ "$system_heal_out" != /nix/store/*
    || ! -f "$system_heal_server"
    || ! -f "$system_heal_out/share/openclaw/packages/shared-utils/src/persist.mjs"
    || ! -f "$system_heal_out/share/openclaw/packages/shared-utils/src/service-credentials.mjs"
    || ! -f "$system_heal_out/share/openclaw/packages/shared-events/src/event-names.mjs"
    || -w "$system_heal_server"
    || -e "$system_heal_out/share/openclaw/services/openclaw-system-heal/test"
    || "$(find "$system_heal_out" -type f | wc -l)" -ne 8 ]]; then
    echo "system-heal Nix closure is not exact and read-only: $system_heal_out" >&2
    exit 1
  fi

  (
    runtime_dir="$(mktemp -d)"
    runtime_port=5845
    upstream_port=5843
    runtime_url="http://127.0.0.1:$runtime_port"
    upstream_url="http://127.0.0.1:$upstream_port"
    state_file="$runtime_dir/system-heal-state.json"
    cleanup_runtime() {
      for pid in "${system_heal_pid:-}" "${upstream_pid:-}"; do
        if [[ -n "$pid" ]]; then
          kill -TERM "$pid" >/dev/null 2>&1 || true
          wait "$pid" >/dev/null 2>&1 || true
        fi
      done
      rm -rf "$runtime_dir"
    }
    trap cleanup_runtime EXIT

    node "$REPO_ROOT/nix/scripts/dev-body-config-store-upstream.mjs" "$upstream_port" \
      >"$runtime_dir/upstream.log" 2>&1 &
    upstream_pid=$!
    for _ in $(seq 1 50); do
      if curl --silent --fail "$upstream_url/health" >/dev/null; then
        break
      fi
      sleep 0.1
    done

    start_system_heal() {
      cd "$system_heal_working_dir"
      OPENCLAW_SYSTEM_HEAL_HOST=127.0.0.1 \
      OPENCLAW_SYSTEM_HEAL_PORT="$runtime_port" \
      OPENCLAW_EVENT_HUB_URL="$upstream_url" \
      OPENCLAW_SYSTEM_SENSE_URL="$upstream_url" \
      OPENCLAW_SYSTEM_HEAL_STATE_FILE="$state_file" \
      OPENCLAW_BODY_RUNTIME_SOURCE=nix-store \
        node src/server.mjs >"$runtime_dir/system-heal.log" 2>&1 &
      system_heal_pid=$!
      for _ in $(seq 1 50); do
        if curl --silent --fail "$runtime_url/health" >/dev/null; then
          return 0
        fi
        sleep 0.1
      done
      return 1
    }

    start_system_heal
    curl --silent --fail -X POST "$runtime_url/heal/diagnose" \
      -H 'content-type: application/json' \
      --data '{"mode":"simulated","system":{"timestamp":"2026-07-11T00:00:00.000Z","body":{"hostname":"nix-store-probe"},"services":{"screenSense":{"name":"openclaw-screen-sense","ok":false,"status":"unhealthy","url":"http://127.0.0.1:4104"}},"alerts":[]}}' \
      >"$runtime_dir/diagnosis.json"
    for _ in $(seq 1 50); do
      [[ -s "$state_file" ]] && break
      sleep 0.1
    done
    kill -TERM "$system_heal_pid"
    wait "$system_heal_pid" >/dev/null 2>&1 || true
    system_heal_pid=""
    start_system_heal
    curl --silent --fail "$runtime_url/heal/state" >"$runtime_dir/restored-state.json"

    node - <<'EOF' "$runtime_dir/diagnosis.json" "$runtime_dir/restored-state.json" "$state_file" "$system_heal_out"
const fs = require("node:fs");
const diagnosed = JSON.parse(fs.readFileSync(process.argv[2], "utf8")).diagnosis ?? {};
const restored = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
const persisted = JSON.parse(fs.readFileSync(process.argv[4], "utf8"));
const storePath = process.argv[5];
if (diagnosed.status !== "repairable"
  || diagnosed.source?.hostname !== "nix-store-probe"
  || diagnosed.plan?.stepCount !== 1
  || diagnosed.plan.steps?.[0]?.kind !== "restart-service"
  || diagnosed.plan.steps[0].mode !== "simulated"
  || restored.latestDiagnosis?.id !== diagnosed.id
  || persisted.latestDiagnosis?.id !== diagnosed.id
  || restored.historyCount !== 0) {
  throw new Error(`store-native system-heal did not persist conservative diagnosis: ${JSON.stringify({ diagnosed, restored, persisted })}`);
}
console.log(JSON.stringify({
  nixStoreSystemHeal: {
    storePath,
    readOnlySource: true,
    writableStatePath: process.argv[4],
    diagnosisStatus: diagnosed.status,
    plannedAction: diagnosed.plan.steps[0].kind,
    executionMode: diagnosed.plan.steps[0].mode,
    restoredAfterRestart: true,
    realRepairExecuted: false,
  },
}, null, 2));
EOF
  )

  observer_ui_out="$(nix_flake build \
    --no-update-lock-file --no-link --print-out-paths .#observer-ui)"
  observer_ui_working_dir="$observer_ui_out/share/openclaw/apps/observer-ui"
  observer_ui_server="$observer_ui_working_dir/src/server.mjs"
  if [[ "$observer_ui_out" != /nix/store/*
    || ! -f "$observer_ui_server"
    || ! -f "$observer_ui_out/share/openclaw/apps/observer-ui/src/client-script.mjs"
    || ! -f "$observer_ui_out/share/openclaw/apps/observer-ui/src/observer-html.mjs"
    || ! -f "$observer_ui_out/share/openclaw/apps/observer-ui/src/client-script-runtime-engineering-plan.mjs"
    || ! -f "$observer_ui_out/share/openclaw/apps/observer-ui/src/client-script-runtime-semantic-target-task.mjs"
    || ! -f "$observer_ui_out/share/openclaw/apps/observer-ui/src/client-script-runtime-screen-observation.mjs"
    || ! -f "$observer_ui_out/share/openclaw/apps/observer-ui/src/client-script-config-dom-declarative-evolution.mjs"
    || ! -f "$observer_ui_out/share/openclaw/apps/observer-ui/src/client-script-auth.mjs"
    || ! -f "$observer_ui_out/share/openclaw/apps/observer-ui/src/client-script-config-dom-operator-auth.mjs"
    || ! -f "$observer_ui_out/share/openclaw/apps/observer-ui/src/client-script-refreshers-declarative-evolution.mjs"
    || ! -f "$observer_ui_out/share/openclaw/apps/observer-ui/src/client-script-renderers-declarative-evolution.mjs"
    || ! -f "$observer_ui_out/share/openclaw/apps/observer-ui/src/observer-panels-declarative-evolution.mjs"
    || ! -f "$observer_ui_out/share/openclaw/apps/observer-ui/src/observer-panels-operator-auth.mjs"
    || ! -f "$observer_ui_out/share/openclaw/packages/shared-client/src/service-descriptors.mjs"
    || -w "$observer_ui_server"
    || -e "$observer_ui_out/share/openclaw/apps/observer-ui/scripts"
    || "$(find "$observer_ui_out" -type f | wc -l)" -ne 76 ]]; then
    echo "observer-ui Nix closure is not exact and read-only: $observer_ui_out" >&2
    exit 1
  fi

  (
    runtime_dir="$(mktemp -d)"
    runtime_port=5848
    runtime_url="http://127.0.0.1:$runtime_port"
    upstream_url="http://127.0.0.1:5843"
    cleanup_runtime() {
      if [[ -n "${observer_ui_pid:-}" ]]; then
        kill -TERM "$observer_ui_pid" >/dev/null 2>&1 || true
        wait "$observer_ui_pid" >/dev/null 2>&1 || true
      fi
      rm -rf "$runtime_dir"
    }
    trap cleanup_runtime EXIT

    cd "$observer_ui_working_dir"
    OBSERVER_UI_HOST=127.0.0.1 \
    OBSERVER_UI_PORT="$runtime_port" \
    OPENCLAW_CORE_URL="$upstream_url" \
    OPENCLAW_EVENT_HUB_URL="$upstream_url" \
    OPENCLAW_SESSION_MANAGER_URL="$upstream_url" \
    OPENCLAW_SCREEN_SENSE_URL="$upstream_url" \
    OPENCLAW_SCREEN_ACT_URL="$upstream_url" \
    OPENCLAW_SYSTEM_SENSE_URL="$upstream_url" \
    OPENCLAW_SYSTEM_HEAL_URL="$upstream_url" \
    OPENCLAW_BODY_RUNTIME_SOURCE=nix-store \
      node src/server.mjs >"$runtime_dir/observer-ui.log" 2>&1 &
    observer_ui_pid=$!

    for _ in $(seq 1 50); do
      if curl --silent --fail "$runtime_url/health" >"$runtime_dir/health.json"; then
        break
      fi
      sleep 0.1
    done
    curl --silent --fail "$runtime_url/" >"$runtime_dir/index.html"
    curl --silent --fail "$runtime_url/client.js" >"$runtime_dir/client.js"

    node - <<'EOF' "$runtime_dir/health.json" "$runtime_dir/index.html" "$runtime_dir/client.js" "$observer_ui_out" "$upstream_url"
const fs = require("node:fs");
const health = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const html = fs.readFileSync(process.argv[3], "utf8");
const client = fs.readFileSync(process.argv[4], "utf8");
const storePath = process.argv[5];
const upstreamUrl = process.argv[6];
if (health.ok !== true
  || health.service !== "observer-ui"
  || health.coreUrl !== upstreamUrl
  || !html.includes("<title>OpenClaw Observer UI</title>")
  || !html.includes('id="engineering-loop-state-kind"')
  || !client.includes("engineering-loop-state")
  || html.length < 250_000
  || client.length < 1_000_000) {
  throw new Error(`store-native observer-ui did not serve complete operator assets: ${JSON.stringify({ health, htmlChars: html.length, clientChars: client.length })}`);
}
console.log(JSON.stringify({
  nixStoreObserverUi: {
    storePath,
    readOnlySource: true,
    health: health.service,
    upstreamUrl: health.coreUrl,
    htmlChars: html.length,
    clientChars: client.length,
    engineeringLoopVisible: true,
  },
}, null, 2));
EOF
  )
fi
