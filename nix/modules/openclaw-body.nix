{ config, lib, pkgs, ... }:

let
  cfg = config.services.openclaw;
  inherit (lib) mkEnableOption mkIf mkOption optionalAttrs types;

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
      extraEnvironment = profileDir: {
        OPENCLAW_BROWSER_ENGINE_MODE = cfg.browserEngine.mode;
        OPENCLAW_BROWSER_PROFILE_DIR = profileDir;
      } // optionalAttrs (cfg.browserEngine.mode == "firefox") {
        OPENCLAW_BROWSER_EXECUTABLE = "${cfg.browserEngine.package}/bin/firefox";
      };
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
    }
  ];

  enabledSpecs = builtins.filter (spec: builtins.elem spec.key cfg.components) serviceSpecs;
  userOwnedSpecs = builtins.filter (spec: builtins.elem spec.key cfg.componentOwnership.user) enabledSpecs;
  systemOwnedSpecs = builtins.filter (spec: !builtins.elem spec.key cfg.componentOwnership.user) enabledSpecs;
  userOwnedServiceNames = map (spec: spec.name) userOwnedSpecs;

  urlFor = port: "http://${cfg.connectHost}:${toString port}";

  systemdRepairRestartHelper = pkgs.writeShellScriptBin "openclaw-systemd-repair-restart-browser-runtime" ''
    set -euo pipefail

    if [ "$#" -ne 0 ]; then
      echo "openclaw-systemd-repair-restart-browser-runtime accepts no arguments" >&2
      exit 64
    fi

    exec ${pkgs.systemd}/bin/systemctl restart openclaw-browser-runtime.service
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
    OPENCLAW_SYSTEM_HEAL_STATE_FILE = "${stateDir}/openclaw-system-heal-state.json";
    OPENCLAW_BROWSER_RUNTIME_STATE_FILE = "${stateDir}/openclaw-browser-runtime-state.json";
    OPENCLAW_EVENT_LOG_FILE = "${stateDir}/openclaw-events.jsonl";
  } // optionalAttrs cfg.systemdRepairAuthDelegation.enable {
    OPENCLAW_SYSTEMD_REPAIR_RESTART_HELPER = "${systemdRepairRestartHelper}/bin/openclaw-systemd-repair-restart-browser-runtime";
    OPENCLAW_SYSTEMD_REPAIR_RESTART_HELPER_SUDO = "/run/wrappers/bin/sudo";
    OPENCLAW_SYSTEMD_REPAIR_AUTH_DELEGATION = "sudo-nopasswd-fixed-helper";
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
      };
    };

  trustedSidecarUserService = {
    description = "OpenClaw trusted work-view sidecar instance %i";
    environment = {
      NODE_NO_WARNINGS = "1";
    };
    serviceConfig = {
      Type = "simple";
      WorkingDirectory = "${cfg.repoRoot}/services/openclaw-session-manager";
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
  delegationUser = if cfg.user == null then "openclaw" else cfg.user;
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

    runtimePackages.screenSense = mkOption {
      type = types.nullOr types.package;
      default = pkgs.callPackage ../packages/openclaw-screen-sense.nix { };
      description = "Read-only Nix package used by screen-sense; null keeps the mutable repository fallback.";
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

    logDir = mkOption {
      type = types.str;
      default = "/var/log/openclaw";
      description = "OpenClaw body log directory.";
    };

    systemdRepairAuthDelegation = {
      enable = mkEnableOption "passwordless OpenClaw-owned systemd repair delegation";
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
        assertion = !cfg.systemdRepairAuthDelegation.enable || cfg.user != null;
        message = "services.openclaw.systemdRepairAuthDelegation.enable requires services.openclaw.user so delegation is scoped to one OpenClaw service account.";
      }
      {
        assertion = !cfg.systemdRepairAuthDelegation.enable || !builtins.elem "browserRuntime" cfg.componentOwnership.user;
        message = "systemd repair delegation targets the system browser unit and cannot be combined with user-owned browserRuntime.";
      }
    ];

    users.groups = optionalAttrs (cfg.user != null) {
      ${cfg.group} = { };
    };

    users.users = optionalAttrs (cfg.user != null) {
      ${cfg.user} = {
        isSystemUser = true;
        group = cfg.group;
        home = cfg.stateDir;
        createHome = true;
      };
    };

    systemd.tmpfiles.rules = [
      "d ${cfg.stateDir} 0750 ${owner} ${group} - -"
      "d ${cfg.logDir} 0750 ${owner} ${group} - -"
    ];

    systemd.services = builtins.listToAttrs (map
      (spec: {
        name = spec.name;
        value = mkService "system" spec;
      })
      systemOwnedSpecs);

    systemd.user.services = builtins.listToAttrs
      (map
        (spec: {
          name = spec.name;
          value = mkService "user" spec;
        })
        userOwnedSpecs) // optionalAttrs cfg.trustedSidecarUserUnit.enable {
      "openclaw-trusted-sidecar@" = trustedSidecarUserService;
    };

    security.sudo.extraRules = mkIf cfg.systemdRepairAuthDelegation.enable [
      {
        users = [ delegationUser ];
        commands = [
          {
            command = "${systemdRepairRestartHelper}/bin/openclaw-systemd-repair-restart-browser-runtime";
            options = [ "NOPASSWD" ];
          }
        ];
      }
    ];
  };
}
