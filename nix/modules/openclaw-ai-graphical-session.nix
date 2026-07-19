{ config, lib, pkgs, ... }:

let
  cfg = config.services.openclaw;
  sessionCfg = cfg.aiGraphicalSession;
  inherit (lib) mkEnableOption mkIf mkOption optional optionalAttrs types;
  unitName = "nixsoma-ai-graphical-session";
  runtimeDirectory = unitName;
  socketName = "nixsoma-ai-0";
  captureDirectory = "capture";
  captureAuthorityPackage = pkgs.callPackage ../packages/nixsoma-weston-frame-auth.nix {
    weston = sessionCfg.package;
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
    ${pkgs.coreutils}/bin/rm -f \
      "$runtime_dir/${socketName}" \
      "$runtime_dir/${socketName}.lock" \
      "$capture_dir/request" \
      "$capture_dir"/wayland-screenshot-*.png
    ${pkgs.coreutils}/bin/install -d -m 0700 "$capture_dir"
  '';
  cleanupScript = pkgs.writeShellScript "nixsoma-ai-graphical-session-cleanup" ''
    set -euo pipefail
    runtime_base="''${XDG_RUNTIME_DIR:?XDG_RUNTIME_DIR is required}"
    runtime_dir="$runtime_base/${runtimeDirectory}"
    capture_dir="$runtime_dir/${captureDirectory}"
    ${pkgs.coreutils}/bin/rm -f \
      "$runtime_dir/${socketName}" \
      "$runtime_dir/${socketName}.lock" \
      "$capture_dir/request" \
      "$capture_dir"/wayland-screenshot-*.png
  '';
  launchScript = pkgs.writeShellScript "nixsoma-ai-graphical-session-launch" ''
    set -euo pipefail
    runtime_base="''${XDG_RUNTIME_DIR:?XDG_RUNTIME_DIR is required}"
    runtime_dir="$runtime_base/${runtimeDirectory}"
    cd "$runtime_dir/${captureDirectory}"
    exec ${pkgs.coreutils}/bin/env \
      XDG_RUNTIME_DIR="$runtime_dir" \
      ${sessionCfg.package}/bin/weston \
      --log="$runtime_dir/weston.log" \
      ${lib.concatStringsSep " \\\n      " westonArguments}
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
      };
    } // optionalAttrs cfg.resourceControl.enable {
      serviceConfig.Slice = "openclaw-session.slice";
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
        "-%t/${runtimeDirectory}/${captureDirectory}";
    };
  };
}
