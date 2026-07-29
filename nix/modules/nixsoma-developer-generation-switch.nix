{ config, lib, pkgs, ... }:

let
  inherit (lib) mkEnableOption mkIf mkOption types;
  cfg = config.services.openclaw.developerGenerationSwitch;
  commandName = "nixsoma-dev-generation-switch";
  markerPath = "nixsoma/developer-generation-switch-target";
  markerText = ''
    registry=nixsoma-developer-generation-switch-target-v0
    systemName=${cfg.systemName}
    profile=${config.services.openclaw.profile}
    bootIsContainer=${if config.boot.isContainer then "true" else "false"}
  '';
  protectedPaths = [
    "kernel"
    "initrd"
    "etc/fstab"
    "etc/systemd/system/display-manager.service"
    "etc/systemd/system/NetworkManager.service"
    "etc/systemd/system/sshd.service"
  ];
  protectedPathArgs = builtins.concatStringsSep " " (map lib.escapeShellArg protectedPaths);
  switchHelper = pkgs.writeShellApplication {
    name = commandName;
    text = ''
      set -euo pipefail
      umask 077
      export HOME=/root
      export USER=root
      export LOGNAME=root
      export PATH=/run/current-system/sw/bin:/nix/var/nix/profiles/default/bin
      unset NIX_CONFIG NIX_PATH NIX_REMOTE NIX_SSHOPTS NIX_BUILD_SHELL TMPDIR TMP TEMP

      if [[ "$EUID" -ne 0 ]]; then
        printf '%s\n' 'nixsoma-dev-generation-switch must run through its sudoers rule.' >&2
        exit 77
      fi
      if [[ "$#" -ne 1 ]]; then
        printf 'usage: %s /nix/store/<hash>-nixos-system-%s-<version>\n' "$0" ${lib.escapeShellArg cfg.systemName} >&2
        exit 64
      fi

      generation="$1"
      canonical="$(${pkgs.coreutils}/bin/realpath -e -- "$generation")"
      if [[ "$canonical" != "$generation" || "$generation" != /nix/store/* ]]; then
        printf '%s\n' 'generation must be one canonical Nix store path.' >&2
        exit 64
      fi

      store_name="$(${pkgs.coreutils}/bin/basename -- "$generation")"
      hash_part="$(printf '%s\n' "$store_name" | ${pkgs.coreutils}/bin/cut -d- -f1)"
      prefix="$hash_part-nixos-system-${cfg.systemName}-"
      if [[ ! "$hash_part" =~ ^[0-9a-z]{32}$ || "$store_name" != "$prefix"?* ]]; then
        printf 'generation is not a nixos-system-%s closure.\n' ${lib.escapeShellArg cfg.systemName} >&2
        exit 64
      fi
      if [[ "$(${pkgs.coreutils}/bin/stat -c %u -- "$generation")" != 0 \
        || ! -x "$generation/bin/switch-to-configuration" ]]; then
        printf '%s\n' 'generation is not a root-owned switchable NixOS closure.' >&2
        exit 65
      fi

      current_marker="/run/current-system/etc/${markerPath}"
      candidate_marker="$generation/etc/${markerPath}"
      if [[ ! -f "$current_marker" || ! -f "$candidate_marker" ]] \
        || ! ${pkgs.gnugrep}/bin/grep -Fxq -- 'bootIsContainer=false' "$current_marker" \
        || ! ${pkgs.diffutils}/bin/cmp --silent -- "$current_marker" "$candidate_marker"; then
        printf '%s\n' 'generation is not bound to the current physical NixSoma deployment target.' >&2
        exit 65
      fi

      for relative_path in ${protectedPathArgs}; do
        current_path="/run/current-system/$relative_path"
        candidate_path="$generation/$relative_path"
        if [[ ! -e "$current_path" \
          || ! -e "$candidate_path" \
          || "$(${pkgs.coreutils}/bin/realpath -e -- "$current_path")" \
            != "$(${pkgs.coreutils}/bin/realpath -e -- "$candidate_path")" ]]; then
          printf 'generation changes protected physical-host path: %s\n' "$relative_path" >&2
          exit 65
        fi
      done
      ${pkgs.nix}/bin/nix-store --query --hash "$generation" >/dev/null

      exec 9> /run/lock/nixsoma-dev-generation-switch.lock
      if ! ${pkgs.util-linux}/bin/flock -n 9; then
        printf '%s\n' 'another NixSoma developer generation switch is active.' >&2
        exit 75
      fi

      exec ${pkgs.nixos-rebuild}/bin/nixos-rebuild switch --store-path "$generation" --no-reexec
    '';
  };
in
{
  options.services.openclaw.developerGenerationSwitch = {
    enable = mkEnableOption "passwordless, single-generation switching for an explicit development user";

    user = mkOption {
      type = types.nullOr types.str;
      default = null;
      description = "Development user allowed to invoke the immutable generation switch helper through sudo.";
    };

    systemName = mkOption {
      type = types.str;
      default = config.networking.hostName;
      description = "Exact NixOS system name accepted in candidate store paths.";
    };
  };

  config = mkIf cfg.enable {
    assertions = [
      {
        assertion = cfg.user != null && cfg.user != "";
        message = "services.openclaw.developerGenerationSwitch.user must name the explicitly authorized development user.";
      }
      {
        assertion = builtins.match "[A-Za-z0-9][A-Za-z0-9_-]*" cfg.systemName != null;
        message = "services.openclaw.developerGenerationSwitch.systemName must be a bounded NixOS host name.";
      }
    ];

    environment.systemPackages = [ switchHelper ];
    environment.etc.${markerPath}.text = markerText;
    security.sudo.enable = true;
    security.sudo.extraRules = [
      {
        users = [ cfg.user ];
        runAs = "root";
        commands = [
          {
            command = "/run/current-system/sw/bin/${commandName}";
            options = [ "NOPASSWD" "NOSETENV" ];
          }
        ];
      }
    ];
  };
}
