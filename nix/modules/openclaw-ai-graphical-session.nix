{ config, lib, pkgs, ... }:

let
  cfg = config.services.openclaw;
  sessionCfg = cfg.aiGraphicalSession;
  inherit (lib) mkEnableOption mkIf mkOption optionalAttrs types;
  unitName = "nixsoma-ai-graphical-session";
  runtimeDirectory = unitName;
  socketName = "nixsoma-ai-0";
  cleanupScript = pkgs.writeShellScript "nixsoma-ai-graphical-session-cleanup" ''
    set -euo pipefail
    runtime_dir="''${XDG_RUNTIME_DIR:?XDG_RUNTIME_DIR is required}"
    ${pkgs.coreutils}/bin/rm -f \
      "$runtime_dir/${socketName}" \
      "$runtime_dir/${socketName}.lock"
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
        ExecStartPre = cleanupScript;
        ExecStart = lib.concatStringsSep " " [
          "${sessionCfg.package}/bin/weston"
          "--backend=headless"
          "--renderer=pixman"
          "--shell=kiosk"
          "--socket=${socketName}"
          "--width=${toString sessionCfg.width}"
          "--height=${toString sessionCfg.height}"
          "--idle-time=0"
          "--no-config"
          "--log=%t/${runtimeDirectory}/weston.log"
        ];
        ExecStopPost = cleanupScript;
        Restart = "on-failure";
        RestartSec = "2s";
        TimeoutStopSec = "5s";
        RuntimeDirectory = runtimeDirectory;
        RuntimeDirectoryMode = "0700";
        UMask = "0077";
        Slice = "openclaw-session.slice";
        NoNewPrivileges = true;
        PrivateTmp = true;
        PrivateDevices = true;
        ProtectSystem = "strict";
        ProtectHome = true;
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
        OPENCLAW_AI_GRAPHICAL_SESSION_SOCKET_NAME = socketName;
        OPENCLAW_AI_GRAPHICAL_SESSION_WIDTH = toString sessionCfg.width;
        OPENCLAW_AI_GRAPHICAL_SESSION_HEIGHT = toString sessionCfg.height;
      };
    } // optionalAttrs cfg.resourceControl.enable {
      serviceConfig.Slice = "openclaw-session.slice";
    };
  };
}
