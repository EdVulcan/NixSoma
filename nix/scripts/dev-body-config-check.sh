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
  "OPENCLAW_BODY_COMPONENT_SCOPE",
  "OPENCLAW_BODY_RUNTIME_SOURCE",
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
  "userService.stateDir",
  "userService.logDir",
  "EnvironmentFile = \"%t/openclaw-sidecars/%i.env\"",
  "ExecStart = \"${cfg.nodePackage}/bin/node src/trusted-work-view-sidecar.mjs\"",
  "Restart = \"no\"",
  "ReadWritePaths = [ \"%t/openclaw-sidecars\" ]",
  "systemd.tmpfiles.rules",
  "StateDirectory = \"openclaw\"",
  "LogsDirectory = \"openclaw\"",
  "ExecStart = \"${cfg.nodePackage}/bin/node src/server.mjs\"",
  "runtimePackages.eventHub",
  "runtimePackages.screenSense",
  "runtimePackages.screenAct",
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
  "componentOwnership.user",
  "browserEngine.mode = \"firefox\"",
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
  "openclaw-screen-sense = pkgs.callPackage",
  "openclaw-screen-act = pkgs.callPackage",
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
  ownership_json="$(nix --extra-experimental-features 'nix-command flakes' eval \
    --no-update-lock-file --json \
    .#nixosConfigurations.openclaw-local-dev.config \
    --apply 'config: let
      project = unit: {
        inherit (unit) wantedBy partOf after environment;
        serviceConfig = {
          User = unit.serviceConfig.User or null;
          WorkingDirectory = unit.serviceConfig.WorkingDirectory;
          ExecStart = unit.serviceConfig.ExecStart;
        };
      };
    in {
      system = builtins.attrNames config.systemd.services;
      user = builtins.attrNames config.systemd.user.services;
      session = project config.systemd.user.services.openclaw-session-manager;
      browser = project config.systemd.user.services.openclaw-browser-runtime;
      eventHub = project config.systemd.services.openclaw-event-hub;
      screenSense = project config.systemd.services.openclaw-screen-sense;
      screenAct = project config.systemd.services.openclaw-screen-act;
    }')"
  node - <<'EOF' "$ownership_json"
const ownership = JSON.parse(process.argv[2]);
const userOwned = ["openclaw-session-manager", "openclaw-browser-runtime"];
for (const name of userOwned) {
  if (!ownership.user.includes(name) || ownership.system.includes(name)) {
    throw new Error(`${name} must exist exclusively in the user manager: ${JSON.stringify(ownership)}`);
  }
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
if (!ownership.browser.after?.includes("openclaw-session-manager.service")) {
  throw new Error(`browser runtime must retain same-scope session-manager ordering: ${JSON.stringify(ownership.browser.after)}`);
}
if (ownership.eventHub.environment?.OPENCLAW_BODY_RUNTIME_SOURCE !== "nix-store"
  || !String(ownership.eventHub.serviceConfig?.WorkingDirectory ?? "").startsWith("/nix/store/")
  || !String(ownership.eventHub.serviceConfig?.WorkingDirectory ?? "").endsWith("/share/openclaw/services/openclaw-event-hub")
  || ownership.eventHub.serviceConfig?.WorkingDirectory?.includes("/opt/openclaw")) {
  throw new Error(`event hub must execute from its read-only Nix closure: ${JSON.stringify(ownership.eventHub)}`);
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
console.log(JSON.stringify({
  componentOwnership: {
    userOwned,
    duplicated: userOwned.filter((name) => ownership.system.includes(name)),
    browserEngine: ownership.browser.environment.OPENCLAW_BROWSER_ENGINE_MODE,
    browserProfile: ownership.browser.environment.OPENCLAW_BROWSER_PROFILE_DIR,
    eventHubRuntimeSource: ownership.eventHub.environment.OPENCLAW_BODY_RUNTIME_SOURCE,
    eventHubWorkingDirectory: ownership.eventHub.serviceConfig.WorkingDirectory,
    screenSenseRuntimeSource: ownership.screenSense.environment.OPENCLAW_BODY_RUNTIME_SOURCE,
    screenSenseWorkingDirectory: ownership.screenSense.serviceConfig.WorkingDirectory,
    screenActRuntimeSource: ownership.screenAct.environment.OPENCLAW_BODY_RUNTIME_SOURCE,
    screenActWorkingDirectory: ownership.screenAct.serviceConfig.WorkingDirectory,
  },
}, null, 2));
EOF

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

  event_hub_out="$(nix --extra-experimental-features 'nix-command flakes' build \
    --no-update-lock-file --no-link --print-out-paths .#openclaw-event-hub)"
  event_hub_working_dir="$event_hub_out/share/openclaw/services/openclaw-event-hub"
  event_hub_server="$event_hub_working_dir/src/server.mjs"
  if [[ "$event_hub_out" != /nix/store/*
    || ! -f "$event_hub_server"
    || ! -f "$event_hub_out/share/openclaw/packages/shared-utils/src/http.mjs"
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

  screen_sense_out="$(nix --extra-experimental-features 'nix-command flakes' build \
    --no-update-lock-file --no-link --print-out-paths .#openclaw-screen-sense)"
  screen_sense_working_dir="$screen_sense_out/share/openclaw/services/openclaw-screen-sense"
  screen_sense_server="$screen_sense_working_dir/src/server.mjs"
  if [[ "$screen_sense_out" != /nix/store/*
    || ! -f "$screen_sense_server"
    || ! -f "$screen_sense_out/share/openclaw/packages/shared-events/src/event-factory.mjs"
    || ! -f "$screen_sense_out/share/openclaw/packages/shared-utils/src/work-view-semantic-targets.mjs"
    || -w "$screen_sense_server"
    || -e "$screen_sense_out/share/openclaw/packages/shared-utils/test/work-view-trust.test.mjs"
    || "$(find "$screen_sense_out" -type f | wc -l)" -ne 10 ]]; then
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

  screen_act_out="$(nix --extra-experimental-features 'nix-command flakes' build \
    --no-update-lock-file --no-link --print-out-paths .#openclaw-screen-act)"
  screen_act_working_dir="$screen_act_out/share/openclaw/services/openclaw-screen-act"
  screen_act_server="$screen_act_working_dir/src/server.mjs"
  if [[ "$screen_act_out" != /nix/store/*
    || ! -f "$screen_act_server"
    || ! -f "$screen_act_out/share/openclaw/services/openclaw-screen-act/src/trusted-work-view-action-mediation.mjs"
    || ! -f "$screen_act_out/share/openclaw/packages/shared-utils/src/work-view-input-evidence.mjs"
    || -w "$screen_act_server"
    || -e "$screen_act_out/share/openclaw/packages/shared-utils/test/http.test.mjs"
    || "$(find "$screen_act_out" -type f | wc -l)" -ne 11 ]]; then
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
    cd "$screen_act_working_dir"
    OPENCLAW_SCREEN_ACT_HOST=127.0.0.1 \
    OPENCLAW_SCREEN_ACT_PORT="$runtime_port" \
    OPENCLAW_EVENT_HUB_URL="$upstream_url" \
    OPENCLAW_SCREEN_SENSE_URL="$upstream_url" \
    OPENCLAW_SESSION_MANAGER_URL="$upstream_url" \
    OPENCLAW_BROWSER_RUNTIME_URL="$upstream_url" \
    OPENCLAW_BODY_RUNTIME_SOURCE=nix-store \
      node src/server.mjs >"$runtime_dir/screen-act.log" 2>&1 &
    screen_act_pid=$!

    for _ in $(seq 1 50); do
      if curl --silent --fail "$runtime_url/health" >/dev/null; then
        break
      fi
      sleep 0.1
    done
    curl --silent --fail -X POST "$runtime_url/act/keyboard/type" \
      -H 'content-type: application/json' \
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
fi
