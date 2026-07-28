{ config, lib, pkgs, ... }:

let
  cfg = config.services.openclaw;
  sessionCfg = cfg.aiGraphicalSession;
  inherit (lib) mkEnableOption mkIf mkOption optional optionalAttrs optionalString types;
  unitName = "nixsoma-ai-graphical-session";
  runtimeDirectory = unitName;
  socketName = "nixsoma-ai-0";
  captureDirectory = "capture";
  inputDirectory = "input";
  surfaceDirectory = "surfaces";
  workbenchHomeDirectory = "workbench-home";
  workbenchUnitName = "nixsoma-ai-workbench";
  westonPackage = if sessionCfg.applicationLifecycle then
    pkgs.callPackage ../packages/nixsoma-weston.nix {
      weston = sessionCfg.package;
    }
  else
    sessionCfg.package;
  captureAuthorityPackage = pkgs.callPackage ../packages/nixsoma-weston-frame-auth.nix {
    weston = westonPackage;
    nativeInput = sessionCfg.nativeInput;
    surfaceInventory = sessionCfg.applicationLifecycle;
    outputWidth = sessionCfg.width;
    outputHeight = sessionCfg.height;
  };
  westonArguments = [
    "--backend=headless"
    "--renderer=pixman"
    "--shell=kiosk"
    "--socket=${socketName}"
    "--width=${toString sessionCfg.width}"
    "--height=${toString sessionCfg.height}"
    "--idle-time=0"
    "--no-config"
  ] ++ optional sessionCfg.captureOutput
    "--modules=${captureAuthorityPackage}/lib/weston/nixsoma-weston-frame-auth.so";
  prepareScript = pkgs.writeShellScript "nixsoma-ai-graphical-session-prepare" ''
    set -euo pipefail
    runtime_base="''${XDG_RUNTIME_DIR:?XDG_RUNTIME_DIR is required}"
    runtime_dir="$runtime_base/${runtimeDirectory}"
    capture_dir="$runtime_dir/${captureDirectory}"
    input_dir="$runtime_dir/${inputDirectory}"
    surface_dir="$runtime_dir/${surfaceDirectory}"
    workbench_home="$runtime_dir/${workbenchHomeDirectory}"
    ${pkgs.coreutils}/bin/rm -f \
      "$runtime_dir/${socketName}" \
      "$runtime_dir/${socketName}.lock" \
      "$capture_dir/request" \
      "$capture_dir"/wayland-screenshot-*.png
    ${pkgs.coreutils}/bin/install -d -m 0700 "$capture_dir"
    ${optionalString sessionCfg.applicationLifecycle ''
      ${pkgs.coreutils}/bin/rm -f "$surface_dir/current.json" "$surface_dir/current.json.tmp"
      ${pkgs.coreutils}/bin/install -d -m 0700 "$surface_dir"
      ${pkgs.coreutils}/bin/install -d -m 0700 "$workbench_home"
    ''}
    ${optionalString sessionCfg.nativeInput ''
      ${pkgs.coreutils}/bin/rm -f "$input_dir/control.sock"
      ${pkgs.coreutils}/bin/install -d -m 0700 "$input_dir"
    ''}
  '';
  cleanupScript = pkgs.writeShellScript "nixsoma-ai-graphical-session-cleanup" ''
    set -euo pipefail
    runtime_base="''${XDG_RUNTIME_DIR:?XDG_RUNTIME_DIR is required}"
    runtime_dir="$runtime_base/${runtimeDirectory}"
    capture_dir="$runtime_dir/${captureDirectory}"
    input_dir="$runtime_dir/${inputDirectory}"
    surface_dir="$runtime_dir/${surfaceDirectory}"
    ${pkgs.coreutils}/bin/rm -f \
      "$runtime_dir/${socketName}" \
      "$runtime_dir/${socketName}.lock" \
      "$capture_dir/request" \
      "$capture_dir"/wayland-screenshot-*.png
    ${optionalString sessionCfg.applicationLifecycle ''
      ${pkgs.coreutils}/bin/rm -f "$surface_dir/current.json" "$surface_dir/current.json.tmp"
    ''}
    ${optionalString sessionCfg.nativeInput ''
      ${pkgs.coreutils}/bin/rm -f "$input_dir/control.sock"
    ''}
  '';
  launchScript = pkgs.writeShellScript "nixsoma-ai-graphical-session-launch" ''
    set -euo pipefail
    runtime_base="''${XDG_RUNTIME_DIR:?XDG_RUNTIME_DIR is required}"
    runtime_dir="$runtime_base/${runtimeDirectory}"
    cd "$runtime_dir/${captureDirectory}"
    exec ${pkgs.coreutils}/bin/env \
      XDG_RUNTIME_DIR="$runtime_dir" \
      ${westonPackage}/bin/weston \
      --log="$runtime_dir/weston.log" \
      ${lib.concatStringsSep " \\\n      " westonArguments}
  '';
  workbenchShell = pkgs.writeShellScript "nixsoma-ai-workbench-shell" ''
    set -eu
    trap 'exit 0' HUP INT TERM
    ${pkgs.coreutils}/bin/printf '\033[2J\033[H'
    ${pkgs.coreutils}/bin/printf '%s\n' \
      'NixSoma AI Workbench' \
      "" \
      'Application lifecycle: active' \
      'Compositor: nixsoma-ai-0' \
      'Authority: fixed display-only process' \
      "" \
      'This surface is owned by the bounded NixSoma AI session.'
    while :; do
      ${pkgs.coreutils}/bin/sleep 3600
    done
  '';
  workbenchLaunchScript = pkgs.writeShellScript "nixsoma-ai-workbench-launch" ''
    set -euo pipefail
    runtime_base="''${XDG_RUNTIME_DIR:?XDG_RUNTIME_DIR is required}"
    runtime_dir="$runtime_base/${runtimeDirectory}"
    workbench_home="$runtime_dir/${workbenchHomeDirectory}"
    cache_home="''${TMPDIR:-/tmp}/nixsoma-ai-workbench-cache"
    ${pkgs.coreutils}/bin/install -d -m 0700 "$cache_home"
    test -d "$workbench_home"
    exec ${pkgs.coreutils}/bin/env -i \
      HOME="$workbench_home" \
      XDG_RUNTIME_DIR="$runtime_dir" \
      XDG_CACHE_HOME="$cache_home" \
      WAYLAND_DISPLAY="${socketName}" \
      XCURSOR_THEME="Adwaita" \
      ${westonPackage}/bin/weston-terminal \
      --fullscreen \
      --font="monospace" \
      --font-size=20 \
      --shell=${workbenchShell}
  '';
in
{
  options.services.openclaw.aiGraphicalSession = {
    enable = mkEnableOption "isolated headless nested Wayland session owned by the login user";
    package = mkOption {
      type = types.package;
      default = pkgs.weston;
      description = "Weston package used for the isolated headless AI graphical session.";
    };
    width = mkOption {
      type = types.ints.between 640 3840;
      default = 1280;
      description = "Fixed virtual output width for the AI graphical session.";
    };
    height = mkOption {
      type = types.ints.between 480 2160;
      default = 720;
      description = "Fixed virtual output height for the AI graphical session.";
    };
    attachBrowser = mkOption {
      type = types.bool;
      default = false;
      description = "Launch the existing AI-owned Firefox inside the isolated Wayland session.";
    };
    captureOutput = mkOption {
      type = types.bool;
      default = false;
      description = "Allow bounded read-only capture of the isolated Weston output.";
    };
    nativeInput = mkOption {
      type = types.bool;
      default = false;
      description = "Allow current-frame-bound pointer clicks inside the isolated Weston output.";
    };
    applicationLifecycle = mkOption {
      type = types.bool;
      default = false;
      description = "Allow explicit start and stop of the fixed NixSoma AI workbench inside the isolated output.";
    };
  };

  config = mkIf (cfg.enable && sessionCfg.enable) {
    assertions = [
      {
        assertion = builtins.elem "sessionManager" cfg.components
          && builtins.elem "sessionManager" cfg.componentOwnership.user;
        message = "services.openclaw.aiGraphicalSession.enable requires a user-owned sessionManager component.";
      }
      {
        assertion = cfg.resourceControl.enable;
        message = "services.openclaw.aiGraphicalSession.enable requires the existing user-session resource envelope.";
      }
      {
        assertion = !sessionCfg.attachBrowser
          || (builtins.elem "browserRuntime" cfg.components
            && builtins.elem "browserRuntime" cfg.componentOwnership.user
            && cfg.browserEngine.mode == "firefox");
        message = "services.openclaw.aiGraphicalSession.attachBrowser requires a user-owned Firefox browserRuntime.";
      }
      {
        assertion = !sessionCfg.nativeInput || (sessionCfg.captureOutput && sessionCfg.attachBrowser);
        message = "services.openclaw.aiGraphicalSession.nativeInput requires captureOutput and attachBrowser.";
      }
      {
        assertion = !sessionCfg.applicationLifecycle
          || (sessionCfg.captureOutput && sessionCfg.attachBrowser);
        message = "services.openclaw.aiGraphicalSession.applicationLifecycle requires the existing capture and browser attachment boundary.";
      }
    ];

    systemd.user.services.${unitName} = {
      description = "NixSoma Isolated AI Graphical Session";
      wantedBy = [ "graphical-session.target" ];
      partOf = [ "graphical-session.target" ];
      before = [ "openclaw-session-manager.service" ];
      environment = {
        XCURSOR_THEME = "Adwaita";
      };
      serviceConfig = {
        Type = "simple";
        ExecStartPre = prepareScript;
        ExecStart = launchScript;
        ExecStopPost = cleanupScript;
        Restart = "on-failure";
        RestartSec = "2s";
        TimeoutStopSec = "5s";
        RuntimeDirectory = runtimeDirectory;
        RuntimeDirectoryMode = "0700";
        UMask = "0077";
        UnsetEnvironment = [
          "DISPLAY"
          "WAYLAND_DISPLAY"
          "WAYLAND_SOCKET"
          "DBUS_SESSION_BUS_ADDRESS"
          "XDG_PICTURES_DIR"
        ];
        Slice = "openclaw-session.slice";
        NoNewPrivileges = true;
        PrivateTmp = true;
        PrivateDevices = true;
        ProtectSystem = "strict";
        ProtectHome = "read-only";
        DevicePolicy = "closed";
        RestrictAddressFamilies = [ "AF_UNIX" ];
        RestrictRealtime = true;
        RestrictSUIDSGID = true;
      };
    };

    systemd.user.services.openclaw-session-manager = {
      wants = [ "${unitName}.service" ];
      after = [ "${unitName}.service" ];
      environment = {
        OPENCLAW_AI_GRAPHICAL_SESSION_ENABLED = "1";
        OPENCLAW_AI_GRAPHICAL_SESSION_MODE = "nested_headless_wayland";
        OPENCLAW_AI_GRAPHICAL_SESSION_RUNTIME_DIRECTORY = runtimeDirectory;
        OPENCLAW_AI_GRAPHICAL_SESSION_SOCKET_NAME = socketName;
        OPENCLAW_AI_GRAPHICAL_SESSION_WIDTH = toString sessionCfg.width;
        OPENCLAW_AI_GRAPHICAL_SESSION_HEIGHT = toString sessionCfg.height;
        OPENCLAW_AI_COMPOSITOR_CAPTURE_ENABLED = if sessionCfg.captureOutput then "1" else "0";
        OPENCLAW_AI_COMPOSITOR_CAPTURE_DIRECTORY = captureDirectory;
        OPENCLAW_AI_COMPOSITOR_CAPTURE_TIMEOUT_MS = "1500";
        OPENCLAW_AI_COMPOSITOR_CAPTURE_POLL_MS = "20";
        OPENCLAW_AI_COMPOSITOR_INPUT_ENABLED = if sessionCfg.nativeInput then "1" else "0";
        OPENCLAW_AI_COMPOSITOR_INPUT_DIRECTORY = inputDirectory;
        OPENCLAW_AI_COMPOSITOR_INPUT_TIMEOUT_MS = "1000";
        OPENCLAW_AI_COMPOSITOR_INPUT_POLL_MS = "10";
        OPENCLAW_AI_SURFACE_INVENTORY_ENABLED = if sessionCfg.applicationLifecycle then "1" else "0";
        OPENCLAW_AI_SURFACE_INVENTORY_DIRECTORY = surfaceDirectory;
        OPENCLAW_AI_APPLICATION_LIFECYCLE_ENABLED = if sessionCfg.applicationLifecycle then "1" else "0";
        OPENCLAW_AI_WORKBENCH_UNIT = "${workbenchUnitName}.service";
        OPENCLAW_AI_WORKBENCH_SYSTEMCTL = "${pkgs.systemd}/bin/systemctl";
        OPENCLAW_AI_WORKBENCH_COMMAND_TIMEOUT_MS = "3000";
        OPENCLAW_AI_WORKBENCH_SETTLE_TIMEOUT_MS = "2000";
        OPENCLAW_AI_WORKBENCH_POLL_MS = "25";
        OPENCLAW_EXECUTION_GRANT_PUBLIC_KEY_FILE = cfg.executionGrantPublicKeyFile;
      };
    } // optionalAttrs cfg.resourceControl.enable {
      serviceConfig.Slice = "openclaw-session.slice";
    };

    systemd.user.services.${workbenchUnitName} = mkIf sessionCfg.applicationLifecycle {
      description = "NixSoma Fixed AI Workbench";
      requires = [ "${unitName}.service" ];
      after = [ "${unitName}.service" ];
      partOf = [ "${unitName}.service" ];
      serviceConfig = {
        Type = "simple";
        ExecStart = workbenchLaunchScript;
        Restart = "no";
        TimeoutStartSec = "5s";
        TimeoutStopSec = "3s";
        UMask = "0077";
        Slice = "openclaw-session.slice";
        NoNewPrivileges = true;
        PrivateTmp = true;
        PrivateDevices = false;
        ProtectSystem = "strict";
        ProtectHome = "read-only";
        DevicePolicy = "closed";
        RestrictAddressFamilies = [ "AF_UNIX" ];
        RestrictRealtime = true;
        RestrictSUIDSGID = true;
        TasksMax = 16;
        MemoryMax = "128M";
        UnsetEnvironment = [
          "DISPLAY"
          "WAYLAND_DISPLAY"
          "WAYLAND_SOCKET"
          "DBUS_SESSION_BUS_ADDRESS"
        ];
        InaccessiblePaths = [
          "-%t/${runtimeDirectory}/${captureDirectory}"
          "-%t/${runtimeDirectory}/${inputDirectory}"
          "-%t/${runtimeDirectory}/${surfaceDirectory}"
        ];
      };
    };

    systemd.user.services.openclaw-browser-runtime = mkIf sessionCfg.attachBrowser {
      wants = [ "${unitName}.service" ];
      after = [ "${unitName}.service" ];
      environment = {
        OPENCLAW_BROWSER_GRAPHICAL_SESSION_ENABLED = "1";
        OPENCLAW_BROWSER_GRAPHICAL_SESSION_MODE = "nested_headed_wayland";
        OPENCLAW_BROWSER_GRAPHICAL_SESSION_RUNTIME_DIRECTORY = runtimeDirectory;
        OPENCLAW_BROWSER_GRAPHICAL_SESSION_SOCKET_NAME = socketName;
      };
      serviceConfig.UnsetEnvironment = [
        "DISPLAY"
        "WAYLAND_DISPLAY"
        "WAYLAND_SOCKET"
        "DBUS_SESSION_BUS_ADDRESS"
      ];
      serviceConfig.InaccessiblePaths = optional sessionCfg.captureOutput
        "-%t/${runtimeDirectory}/${captureDirectory}"
        ++ optional sessionCfg.nativeInput
        "-%t/${runtimeDirectory}/${inputDirectory}";
    };
  };
}
