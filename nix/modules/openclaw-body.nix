{ config, lib, pkgs, ... }:

let
  cfg = config.services.openclaw;
  inherit (lib) mkEnableOption mkIf mkOption optionalAttrs types;
  hostdRestartCapabilities = (builtins.fromJSON (builtins.readFile ../../packages/shared-systemd/src/openclaw-hostd-capabilities.json)).capabilities;
  hostdRestartUnitPolicy = lib.concatStringsSep " || " (map
    (capability: "action.lookup(\"unit\") == \"${capability.targetUnit}\"")
    hostdRestartCapabilities);
  browserRuntimeAuthEnvironment = optionalAttrs (cfg.browserRuntimeAuthToken != null && cfg.browserRuntimeAuthToken != "") {
    OPENCLAW_BROWSER_RUNTIME_AUTH_TOKEN = cfg.browserRuntimeAuthToken;
  };

  serviceSpecs = [
    {
      key = "eventHub";
      name = "openclaw-event-hub";
      description = "OpenClaw Event Hub";
      path = "services/openclaw-event-hub";
      hostEnv = "OPENCLAW_EVENT_HUB_HOST";
      portEnv = "OPENCLAW_EVENT_HUB_PORT";
      port = cfg.ports.eventHub;
      after = [ ];
      runtimePackage = cfg.runtimePackages.eventHub;
    }
    {
      key = "core";
      name = "openclaw-core";
      description = "OpenClaw Core Control Plane";
      path = "services/openclaw-core";
      hostEnv = "OPENCLAW_CORE_HOST";
      portEnv = "OPENCLAW_CORE_PORT";
      port = cfg.ports.core;
      after = [ "openclaw-event-hub" ];
      runtimePackage = cfg.runtimePackages.core;
    }
    {
      key = "sessionManager";
      name = "openclaw-session-manager";
      description = "OpenClaw AI Work View Session Manager";
      path = "services/openclaw-session-manager";
      hostEnv = "OPENCLAW_SESSION_MANAGER_HOST";
      portEnv = "OPENCLAW_SESSION_MANAGER_PORT";
      port = cfg.ports.sessionManager;
      after = [ "openclaw-event-hub" ];
      runtimePackage = cfg.runtimePackages.sessionManager;
      extraEnvironment = _: browserRuntimeAuthEnvironment;
    }
    {
      key = "browserRuntime";
      name = "openclaw-browser-runtime";
      description = "OpenClaw Browser Runtime";
      path = "services/openclaw-browser-runtime";
      hostEnv = "OPENCLAW_BROWSER_RUNTIME_HOST";
      portEnv = "OPENCLAW_BROWSER_RUNTIME_PORT";
      port = cfg.ports.browserRuntime;
      after = [ "openclaw-event-hub" "openclaw-session-manager" ];
      runtimePackage = cfg.runtimePackages.browserRuntime;
      extraEnvironment = profileDir: {
        OPENCLAW_BROWSER_ENGINE_MODE = cfg.browserEngine.mode;
        OPENCLAW_BROWSER_PROFILE_DIR = profileDir;
      } // optionalAttrs (cfg.browserEngine.mode == "firefox") {
        OPENCLAW_BROWSER_EXECUTABLE = "${cfg.browserEngine.package}/bin/firefox";
      } // browserRuntimeAuthEnvironment;
    }
    {
      key = "screenSense";
      name = "openclaw-screen-sense";
      description = "OpenClaw Screen Sense";
      path = "services/openclaw-screen-sense";
      hostEnv = "OPENCLAW_SCREEN_SENSE_HOST";
      portEnv = "OPENCLAW_SCREEN_SENSE_PORT";
      port = cfg.ports.screenSense;
      after = [ "openclaw-event-hub" "openclaw-session-manager" "openclaw-browser-runtime" ];
      runtimePackage = cfg.runtimePackages.screenSense;
    }
    {
      key = "screenAct";
      name = "openclaw-screen-act";
      description = "OpenClaw Screen Act";
      path = "services/openclaw-screen-act";
      hostEnv = "OPENCLAW_SCREEN_ACT_HOST";
      portEnv = "OPENCLAW_SCREEN_ACT_PORT";
      port = cfg.ports.screenAct;
      after = [ "openclaw-event-hub" "openclaw-screen-sense" "openclaw-browser-runtime" ];
      runtimePackage = cfg.runtimePackages.screenAct;
      extraEnvironment = _: browserRuntimeAuthEnvironment;
    }
    {
      key = "systemSense";
      name = "openclaw-system-sense";
      description = "OpenClaw System Sense";
      path = "services/openclaw-system-sense";
      hostEnv = "OPENCLAW_SYSTEM_SENSE_HOST";
      portEnv = "OPENCLAW_SYSTEM_SENSE_PORT";
      port = cfg.ports.systemSense;
      after = [ "openclaw-event-hub" "openclaw-core" ];
      runtimePackage = cfg.runtimePackages.systemSense;
      extraEnvironment = _: optionalAttrs cfg.kernelEventCapture.enable {
        OPENCLAW_KERNEL_EVENT_CAPTURE_ENABLED = "1";
        OPENCLAW_KERNEL_EVENT_PROBE = "${cfg.kernelEventCapture.probePackage}/bin/openclaw-kernel-process-exec";
        OPENCLAW_KERNEL_EVENT_CAPTURE_DURATION_MS = toString cfg.kernelEventCapture.durationMs;
        OPENCLAW_KERNEL_EVENT_CAPTURE_MAX_EVENTS = toString cfg.kernelEventCapture.maxEvents;
      };
    }
    {
      key = "systemHeal";
      name = "openclaw-system-heal";
      description = "OpenClaw System Heal";
      path = "services/openclaw-system-heal";
      hostEnv = "OPENCLAW_SYSTEM_HEAL_HOST";
      portEnv = "OPENCLAW_SYSTEM_HEAL_PORT";
      port = cfg.ports.systemHeal;
      after = [ "openclaw-event-hub" "openclaw-system-sense" ];
      runtimePackage = cfg.runtimePackages.systemHeal;
    }
    {
      key = "observerUi";
      name = "observer-ui";
      description = "OpenClaw Observer UI";
      path = "apps/observer-ui";
      hostEnv = "OBSERVER_UI_HOST";
      portEnv = "OBSERVER_UI_PORT";
      port = cfg.ports.observerUi;
      after = [ "openclaw-core" "openclaw-event-hub" "openclaw-session-manager" ];
      runtimePackage = cfg.runtimePackages.observerUi;
    }
  ];

  enabledSpecs = builtins.filter (spec: builtins.elem spec.key cfg.components) serviceSpecs;
  userOwnedSpecs = builtins.filter (spec: builtins.elem spec.key cfg.componentOwnership.user) enabledSpecs;
  systemOwnedSpecs = builtins.filter (spec: !builtins.elem spec.key cfg.componentOwnership.user) enabledSpecs;
  userOwnedServiceNames = map (spec: spec.name) userOwnedSpecs;

  trustedSidecarRuntimeRoot =
    if cfg.runtimePackages.sessionManager != null
    then "${cfg.runtimePackages.sessionManager}/share/openclaw"
    else cfg.repoRoot;

  urlFor = port: "http://${cfg.connectHost}:${toString port}";
  hostdSocketPath = "/run/openclaw/hostd.sock";
  hostdRuntimeRoot =
    if cfg.runtimePackages.hostd != null
    then "${cfg.runtimePackages.hostd}/share/openclaw"
    else "${cfg.repoRoot}";

  hostdService = {
    description = "OpenClaw Fixed Host Control Boundary";
    wantedBy = [ "multi-user.target" ];
    wants = [ "network-online.target" ];
    after = [ "network-online.target" ];
    environment = {
      OPENCLAW_HOSTD_SOCKET_PATH = hostdSocketPath;
      OPENCLAW_HOSTD_PEER_CREDENTIAL_HELPER =
        if cfg.runtimePackages.hostd != null
        then "${cfg.runtimePackages.hostd}/bin/openclaw-hostd-peer-credentials"
        else "";
      OPENCLAW_HOSTD_PEER_EXPECTED_USER = if cfg.user != null then cfg.user else "openclaw-service";
      OPENCLAW_HOSTD_PEER_EXPECTED_GROUP = cfg.group;
      OPENCLAW_BODY_RUNTIME_SOURCE = if cfg.runtimePackages.hostd != null then "nix-store" else "mutable-repo";
    };
    serviceConfig = {
      Type = "simple";
      WorkingDirectory = "${hostdRuntimeRoot}/services/openclaw-hostd";
      ExecStart = "${cfg.nodePackage}/bin/node src/server.mjs";
      Restart = "on-failure";
      RestartSec = "2s";
      RuntimeDirectory = "openclaw";
      RuntimeDirectoryMode = "0750";
      UMask = "0007";
      NoNewPrivileges = true;
      PrivateTmp = true;
      ProtectSystem = "strict";
      ProtectHome = true;
      RestrictAddressFamilies = [ "AF_UNIX" ];
    } // optionalAttrs (cfg.user != null) {
      User = cfg.hostdUser;
      Group = cfg.group;
    };
  };

  eventLogOwnershipMigration = pkgs.writeShellScript "openclaw-event-log-ownership-migration" ''
    set -euo pipefail
    event_log=${lib.escapeShellArg "${cfg.stateDir}/openclaw-events.jsonl"}
    if [ -e "$event_log" ]; then
      ${pkgs.coreutils}/bin/chown ${lib.escapeShellArg "${owner}:${group}"} "$event_log"
      ${pkgs.coreutils}/bin/chmod 0640 "$event_log"
    fi
  '';

  commonEnvironment = stateDir: {
    OPENCLAW_CORE_URL = urlFor cfg.ports.core;
    OPENCLAW_EVENT_HUB_URL = urlFor cfg.ports.eventHub;
    OPENCLAW_SESSION_MANAGER_URL = urlFor cfg.ports.sessionManager;
    OPENCLAW_BROWSER_RUNTIME_URL = urlFor cfg.ports.browserRuntime;
    OPENCLAW_SCREEN_SENSE_URL = urlFor cfg.ports.screenSense;
    OPENCLAW_SCREEN_ACT_URL = urlFor cfg.ports.screenAct;
    OPENCLAW_SYSTEM_SENSE_URL = urlFor cfg.ports.systemSense;
    OPENCLAW_SYSTEM_HEAL_URL = urlFor cfg.ports.systemHeal;
    OPENCLAW_CORE_STATE_FILE = "${stateDir}/openclaw-core-state.json";
    OPENCLAW_SESSION_MANAGER_STATE_FILE = "${stateDir}/openclaw-session-manager-state.json";
    OPENCLAW_SYSTEM_HEAL_STATE_FILE = "${stateDir}/openclaw-system-heal-state.json";
    OPENCLAW_BROWSER_RUNTIME_STATE_FILE = "${stateDir}/openclaw-browser-runtime-state.json";
    OPENCLAW_EVENT_LOG_FILE = "${stateDir}/openclaw-events.jsonl";
    OPENCLAW_BODY_EVIDENCE_LEDGER_DIR = "${stateDir}/body-evidence-ledger";
    OPENCLAW_MANAGED_CONFIG_STAGING_DIR = "${stateDir}/managed-config-staging";
    OPENCLAW_NIXOS_FLAKE = cfg.repoRoot;
    OPENCLAW_NIXOS_BASE_MODULE = "${cfg.repoRoot}/nix/hosts/local-dev.nix";
    OPENCLAW_NIX_SYSTEM = pkgs.stdenv.hostPlatform.system;
    OPENCLAW_BODY_USER_OWNED_UNITS = lib.concatStringsSep "," userOwnedServiceNames;
  } // optionalAttrs (cfg.eventHubToken != null) {
    OPENCLAW_EVENT_HUB_TOKEN = cfg.eventHubToken;
  } // optionalAttrs cfg.systemdRepairAuthDelegation.enable {
    OPENCLAW_HOSTD_SOCKET_PATH = hostdSocketPath;
    OPENCLAW_SYSTEMD_REPAIR_AUTH_DELEGATION = "polkit-dbus-fixed-unit";
  };

  mkService = scope: spec:
    let
      userScope = scope == "user";
      stateDir = if userScope then cfg.userService.stateDir else cfg.stateDir;
      logDir = if userScope then cfg.userService.logDir else cfg.logDir;
      browserProfileDir = if userScope then "${stateDir}/browser-profile" else cfg.browserEngine.profileDir;
      runtimeRoot =
        if spec ? runtimePackage && spec.runtimePackage != null
        then "${spec.runtimePackage}/share/openclaw"
        else cfg.repoRoot;
      sameScopeAfter = builtins.filter
        (name:
          if userScope
          then builtins.elem name userOwnedServiceNames
          else !builtins.elem name userOwnedServiceNames
        )
        spec.after;
      dependencyUnits = map (name: "${name}.service") sameScopeAfter;
    in
    {
      inherit (spec) description;
      wantedBy = [ (if userScope then "graphical-session.target" else "multi-user.target") ];
      partOf = if userScope then [ "graphical-session.target" ] else [ ];
      wants = (if userScope then [ ] else [ "network-online.target" ]) ++ dependencyUnits;
      after = (if userScope then [ "graphical-session.target" ] else [ "network-online.target" ]) ++ dependencyUnits;
      environment = commonEnvironment stateDir // {
        ${spec.hostEnv} = cfg.host;
        ${spec.portEnv} = toString spec.port;
        OPENCLAW_BODY_PROFILE = cfg.profile;
        OPENCLAW_BODY_COMPONENT_SCOPE = scope;
        OPENCLAW_BODY_STATE_DIR = stateDir;
        OPENCLAW_BODY_LOG_DIR = logDir;
        OPENCLAW_BODY_RUNTIME_SOURCE =
          if spec ? runtimePackage && spec.runtimePackage != null
          then "nix-store"
          else "mutable-repo";
      } // (if spec ? extraEnvironment then spec.extraEnvironment browserProfileDir else { });
      serviceConfig = {
        Type = "simple";
        WorkingDirectory = "${runtimeRoot}/${spec.path}";
        ExecStart = "${cfg.nodePackage}/bin/node src/server.mjs";
        Restart = "on-failure";
        RestartSec = "2s";
        StateDirectory = "openclaw";
        LogsDirectory = "openclaw";
      } // optionalAttrs (!userScope && cfg.user != null) {
        User = cfg.user;
        Group = cfg.group;
      } // optionalAttrs (!userScope && cfg.user != null && spec.key == "eventHub") {
        ExecStartPre = [ "+${eventLogOwnershipMigration}" ];
      } // optionalAttrs (!userScope && spec.key == "systemSense" && cfg.kernelEventCapture.enable) {
        AmbientCapabilities = [ "CAP_BPF" "CAP_PERFMON" ];
        CapabilityBoundingSet = [ "CAP_BPF" "CAP_PERFMON" ];
        LimitMEMLOCK = "infinity";
      };
    };

  trustedSidecarUserService = {
    description = "OpenClaw trusted work-view sidecar instance %i";
    environment = {
      NODE_NO_WARNINGS = "1";
      OPENCLAW_BODY_RUNTIME_SOURCE =
        if cfg.runtimePackages.sessionManager != null
        then "nix-store"
        else "mutable-repo";
    };
    serviceConfig = {
      Type = "simple";
      WorkingDirectory = "${trustedSidecarRuntimeRoot}/services/openclaw-session-manager";
      EnvironmentFile = "%t/openclaw-sidecars/%i.env";
      ExecStart = "${cfg.nodePackage}/bin/node src/trusted-work-view-sidecar.mjs";
      Restart = "no";
      KillMode = "process";
      TimeoutStopSec = "5s";
      UMask = "0077";
      NoNewPrivileges = true;
      PrivateTmp = true;
      ProtectSystem = "strict";
      ProtectHome = true;
      ReadWritePaths = [ "%t/openclaw-sidecars" ];
      RestrictAddressFamilies = [ "AF_UNIX" "AF_INET" "AF_INET6" ];
    };
  };

  owner = if cfg.user == null then "root" else cfg.user;
  group = if cfg.user == null then "root" else cfg.group;
  delegationUser = cfg.hostdUser;
in
{
  options.services.openclaw = {
    enable = mkEnableOption "OpenClaw NixOS body services";

    profile = mkOption {
      type = types.enum [ "dev-body" "desktop-body" ];
      default = "dev-body";
      description = "OpenClaw body profile name exported to services.";
    };

    components = mkOption {
      type = types.listOf (types.enum [
        "eventHub"
        "core"
        "sessionManager"
        "browserRuntime"
        "screenSense"
        "screenAct"
        "systemSense"
        "systemHeal"
        "observerUi"
      ]);
      default = [ ];
      description = "OpenClaw body components to materialize as systemd services.";
    };

    componentOwnership.user = mkOption {
      type = types.listOf (types.enum [
        "eventHub"
        "core"
        "sessionManager"
        "browserRuntime"
        "screenSense"
        "screenAct"
        "systemSense"
        "systemHeal"
        "observerUi"
      ]);
      default = [ ];
      description = "Enabled components owned exclusively by the current login user's systemd manager.";
    };

    userService = {
      stateDir = mkOption {
        type = types.str;
        default = "%S/openclaw";
        description = "Per-user state directory for login-session-owned OpenClaw components.";
      };
      logDir = mkOption {
        type = types.str;
        default = "%L/openclaw";
        description = "Per-user log directory for login-session-owned OpenClaw components.";
      };
    };

    repoRoot = mkOption {
      type = types.str;
      default = "/opt/openclaw";
      description = "Repository root containing OpenClaw apps and services.";
    };

    runtimePackages.eventHub = mkOption {
      type = types.nullOr types.package;
      default = pkgs.callPackage ../packages/openclaw-event-hub.nix { };
      description = "Read-only Nix package used by event-hub; null keeps the mutable repository fallback.";
    };

    runtimePackages.core = mkOption {
      type = types.nullOr types.package;
      default = pkgs.callPackage ../packages/openclaw-core.nix { };
      description = "Read-only Nix package used by core; null keeps the mutable repository fallback.";
    };

    runtimePackages.sessionManager = mkOption {
      type = types.nullOr types.package;
      default = pkgs.callPackage ../packages/openclaw-session-manager.nix { };
      description = "Read-only Nix package used by session-manager; null keeps the mutable repository fallback.";
    };

    runtimePackages.browserRuntime = mkOption {
      type = types.nullOr types.package;
      default = pkgs.callPackage ../packages/openclaw-browser-runtime.nix { };
      description = "Read-only Nix package with production dependencies used by browser-runtime; null keeps the mutable repository fallback.";
    };

    runtimePackages.screenSense = mkOption {
      type = types.nullOr types.package;
      default = pkgs.callPackage ../packages/openclaw-screen-sense.nix { };
      description = "Read-only Nix package used by screen-sense; null keeps the mutable repository fallback.";
    };

    runtimePackages.screenAct = mkOption {
      type = types.nullOr types.package;
      default = pkgs.callPackage ../packages/openclaw-screen-act.nix { };
      description = "Read-only Nix package used by screen-act; null keeps the mutable repository fallback.";
    };

    runtimePackages.systemSense = mkOption {
      type = types.nullOr types.package;
      default = pkgs.callPackage ../packages/openclaw-system-sense.nix { };
      description = "Read-only Nix package used by system-sense; null keeps the mutable repository fallback.";
    };

    runtimePackages.hostd = mkOption {
      type = types.nullOr types.package;
      default = pkgs.callPackage ../packages/openclaw-hostd.nix { };
      description = "Read-only Nix package used by the fixed host control boundary; null keeps the mutable repository fallback.";
    };

    runtimePackages.systemHeal = mkOption {
      type = types.nullOr types.package;
      default = pkgs.callPackage ../packages/openclaw-system-heal.nix { };
      description = "Read-only Nix package used by system-heal; null keeps the mutable repository fallback.";
    };

    runtimePackages.observerUi = mkOption {
      type = types.nullOr types.package;
      default = pkgs.callPackage ../packages/observer-ui.nix { };
      description = "Read-only Nix package used by observer-ui; null keeps the mutable repository fallback.";
    };

    nodePackage = mkOption {
      type = types.package;
      default = pkgs.nodejs;
      description = "Node.js package used to run OpenClaw services.";
    };

    browserEngine = {
      mode = mkOption {
        type = types.enum [ "simulated" "firefox" ];
        default = "simulated";
        description = "Browser engine mode; firefox uses the fixed Nix browser package behind the governed runtime API.";
      };
      package = mkOption {
        type = types.package;
        default = pkgs.firefox;
        description = "Nix browser package used by the real browser engine adapter.";
      };
      profileDir = mkOption {
        type = types.str;
        default = "${cfg.stateDir}/browser-profile";
        description = "Ephemeral AI-owned browser profile directory cleared by the adapter lifecycle.";
      };
    };

    host = mkOption {
      type = types.str;
      default = "127.0.0.1";
      description = "Bind host for OpenClaw services.";
    };

    connectHost = mkOption {
      type = types.str;
      default = "127.0.0.1";
      description = "Host used when services call each other.";
    };

    user = mkOption {
      type = types.nullOr types.str;
      default = null;
      description = "Optional user for OpenClaw services. Null keeps systemd's default user.";
    };

    hostdUser = mkOption {
      type = types.str;
      default = "openclaw-hostd";
      description = "Dedicated system user for the fixed host control boundary and its Polkit subject.";
    };

    group = mkOption {
      type = types.str;
      default = "openclaw";
      description = "Group used when services.openclaw.user is set.";
    };

    stateDir = mkOption {
      type = types.str;
      default = "/var/lib/openclaw";
      description = "OpenClaw body state directory.";
    };

    eventHubToken = mkOption {
      type = types.nullOr types.str;
      default = null;
      description = "Optional shared internal token for authenticated event-hub ingress; keep it out of public configuration when possible.";
    };

    browserRuntimeAuthToken = mkOption {
      type = types.nullOr types.str;
      default = null;
      description = "Optional shared internal bearer token for browser-runtime callers; required when the browser runtime binds beyond loopback.";
    };

    logDir = mkOption {
      type = types.str;
      default = "/var/log/openclaw";
      description = "OpenClaw body log directory.";
    };

    systemdRepairAuthDelegation = {
      enable = mkEnableOption "Polkit-authorized native D-Bus repair of fixed OpenClaw-owned systemd units";
    };

    kernelEventCapture = {
      enable = mkEnableOption "read-only eBPF process-exec event capture for system-sense";
      probePackage = mkOption {
        type = types.nullOr types.package;
        default = pkgs.callPackage ../packages/openclaw-kernel-event-probe.nix { };
        description = "Nix package containing the bounded libbpf process-exec probe.";
      };
      durationMs = mkOption {
        type = types.ints.between 1 5000;
        default = 1000;
        description = "Maximum duration of one process-exec capture request.";
      };
      maxEvents = mkOption {
        type = types.ints.between 1 4096;
        default = 128;
        description = "Maximum process-exec events returned by one capture request.";
      };
    };

    trustedSidecarUserUnit = {
      enable = mkEnableOption "non-auto-started trusted work-view sidecar user unit";
    };

    ports = {
      core = mkOption { type = types.port; default = 4100; };
      eventHub = mkOption { type = types.port; default = 4101; };
      sessionManager = mkOption { type = types.port; default = 4102; };
      browserRuntime = mkOption { type = types.port; default = 4103; };
      screenSense = mkOption { type = types.port; default = 4104; };
      screenAct = mkOption { type = types.port; default = 4105; };
      systemSense = mkOption { type = types.port; default = 4106; };
      systemHeal = mkOption { type = types.port; default = 4107; };
      observerUi = mkOption { type = types.port; default = 4170; };
    };
  };

  config = mkIf cfg.enable {
    assertions = [
      {
        assertion = cfg.repoRoot != "";
        message = "services.openclaw.repoRoot must point at the OpenClaw repository.";
      }
      {
        assertion = cfg.components != [ ];
        message = "services.openclaw.components must enable at least one body component.";
      }
      {
        assertion = builtins.all (component: builtins.elem component cfg.components) cfg.componentOwnership.user;
        message = "services.openclaw.componentOwnership.user may contain only enabled components.";
      }
      {
        assertion = cfg.browserEngine.mode != "firefox"
          || !builtins.elem "browserRuntime" cfg.components
          || builtins.elem "browserRuntime" cfg.componentOwnership.user
          || cfg.user != null;
        message = "Firefox browser runtime requires login-user ownership or a non-root system service user; root browser launch is not supported.";
      }
      {
        assertion = !builtins.elem "browserRuntime" cfg.components
          || builtins.elem cfg.host [ "127.0.0.1" "::1" "localhost" ]
          || (cfg.browserRuntimeAuthToken != null && cfg.browserRuntimeAuthToken != "");
        message = "A non-loopback browser runtime requires services.openclaw.browserRuntimeAuthToken.";
      }
      {
        assertion = !cfg.systemdRepairAuthDelegation.enable || cfg.user != null;
        message = "services.openclaw.systemdRepairAuthDelegation.enable requires services.openclaw.user so delegation is scoped to one OpenClaw service account.";
      }
      {
        assertion = !cfg.systemdRepairAuthDelegation.enable || cfg.hostdUser != cfg.user;
        message = "services.openclaw.hostdUser must be distinct from services.openclaw.user so the host control boundary has an independent Polkit subject.";
      }
      {
        assertion = !cfg.systemdRepairAuthDelegation.enable
          || (builtins.elem "systemSense" cfg.components
            && !builtins.elem "systemSense" cfg.componentOwnership.user
            && builtins.elem "eventHub" cfg.components
            && !builtins.elem "eventHub" cfg.componentOwnership.user
            && cfg.runtimePackages.systemSense != null
            && cfg.runtimePackages.hostd != null);
        message = "systemd repair delegation requires store-native system-sense, event-hub, and hostd components.";
      }
      {
        assertion = !cfg.kernelEventCapture.enable
          || (builtins.elem "systemSense" cfg.components
            && !builtins.elem "systemSense" cfg.componentOwnership.user
            && cfg.user != null
            && cfg.kernelEventCapture.probePackage != null);
        message = "kernel event capture requires a non-root system-owned system-sense service and a probe package.";
      }
    ];

    users.groups = optionalAttrs (cfg.user != null) {
      ${cfg.group} = { };
    };

    users.users = optionalAttrs (cfg.user != null) (
      {
        ${cfg.user} = {
          isSystemUser = true;
          group = cfg.group;
          home = cfg.stateDir;
          createHome = true;
        };
      } // optionalAttrs cfg.systemdRepairAuthDelegation.enable {
        ${cfg.hostdUser} = {
          isSystemUser = true;
          group = cfg.group;
          home = "/var/empty";
          createHome = false;
        };
      }
    );

    systemd.tmpfiles.rules = [
      "d ${cfg.stateDir} 0750 ${owner} ${group} - -"
      "d ${cfg.logDir} 0750 ${owner} ${group} - -"
    ];

    systemd.services = builtins.listToAttrs (map
      (spec: {
        name = spec.name;
        value = mkService "system" spec;
      })
      systemOwnedSpecs) // optionalAttrs cfg.systemdRepairAuthDelegation.enable {
      openclaw-hostd = hostdService;
    };

    systemd.user.services = builtins.listToAttrs
      (map
        (spec: {
          name = spec.name;
          value = mkService "user" spec;
        })
        userOwnedSpecs) // optionalAttrs cfg.trustedSidecarUserUnit.enable {
      "openclaw-trusted-sidecar@" = trustedSidecarUserService;
    };

    security.polkit.enable = mkIf cfg.systemdRepairAuthDelegation.enable true;
    security.polkit.extraConfig = mkIf cfg.systemdRepairAuthDelegation.enable ''
      polkit.addRule(function(action, subject) {
        if (action.id == "org.freedesktop.systemd1.manage-units"
            && (${hostdRestartUnitPolicy})
            && action.lookup("verb") == "restart"
            && subject.user == "${delegationUser}") {
          return polkit.Result.YES;
        }
      });
    '';
  };
}
