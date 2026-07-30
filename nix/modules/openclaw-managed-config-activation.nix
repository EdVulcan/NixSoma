{ config, lib, pkgs, ... }:

let
  inherit (lib) escapeShellArg mkEnableOption mkIf;
  cfg = config.services.openclaw;
  activationCfg = cfg.managedConfigActivation;
  commandName = "nixsoma-managed-config-activation";
  targetPath = "/etc/nixos/openclaw-managed.nix";
  stagingDirectory = "${cfg.stateDir}/managed-config-staging";
  activationHelper = pkgs.writeShellApplication {
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
        printf '%s\n' '${commandName} must run through its fixed sudoers rule.' >&2
        exit 77
      fi
      if [[ "$#" -ne 2 ]]; then
        printf 'usage: %s <candidate-sha256> /nix/store/<nixos-system-closure>\n' "$0" >&2
        exit 64
      fi

      candidate_hash="$1"
      generation="$2"
      if [[ ! "$candidate_hash" =~ ^[0-9a-f]{64}$ ]]; then
        printf '%s\n' 'candidate hash must be one sha256 hex digest.' >&2
        exit 64
      fi

      staging_dir=${escapeShellArg stagingDirectory}
      staging_path="$staging_dir/openclaw-managed-$candidate_hash.nix"
      canonical_staging="$(${pkgs.coreutils}/bin/realpath -e -- "$staging_path")"
      if [[ "$canonical_staging" != "$staging_path" || ! -f "$staging_path" || -L "$staging_path" ]]; then
        printf '%s\n' 'staged candidate is not the fixed regular hash-bound file.' >&2
        exit 65
      fi
      if [[ "$(${pkgs.coreutils}/bin/stat -c '%U:%G' -- "$staging_path")" != ${escapeShellArg "${cfg.user}:${cfg.group}"} \
        || "$(${pkgs.coreutils}/bin/stat -c '%a' -- "$staging_path")" != 640 ]]; then
        printf '%s\n' 'staged candidate ownership or mode is invalid.' >&2
        exit 65
      fi
      if [[ "$(${pkgs.coreutils}/bin/sha256sum -- "$staging_path" | ${pkgs.coreutils}/bin/cut -d' ' -f1)" != "$candidate_hash" ]]; then
        printf '%s\n' 'staged candidate hash changed before privileged activation.' >&2
        exit 65
      fi
      ${pkgs.nix}/bin/nix-instantiate --parse "$staging_path" >/dev/null

      canonical_generation="$(${pkgs.coreutils}/bin/realpath -e -- "$generation")"
      generation_name="$(${pkgs.coreutils}/bin/basename -- "$generation")"
      if [[ "$canonical_generation" != "$generation" || "$generation" != /nix/store/* \
        || ! "$generation_name" =~ ^[0-9a-z]{32}-nixos-system-[A-Za-z0-9._-]+-.+ \
        || "$(${pkgs.coreutils}/bin/stat -c %u -- "$generation")" != 0 \
        || ! -x "$generation/bin/switch-to-configuration" ]]; then
        printf '%s\n' 'evaluated closure is not one canonical root-owned switchable NixOS generation.' >&2
        exit 65
      fi
      ${pkgs.nix}/bin/nix-store --query --hash "$generation" >/dev/null

      generation_before="$(${pkgs.coreutils}/bin/readlink -f /run/current-system)"
      if [[ "$generation_before" == "$generation" ]]; then
        printf '%s\n' 'evaluated closure is already the active generation.' >&2
        exit 65
      fi

      exec 9> /run/lock/nixsoma-managed-config-activation.lock
      if ! ${pkgs.util-linux}/bin/flock -n 9; then
        printf '%s\n' 'another managed-config activation is active.' >&2
        exit 75
      fi

      target=${escapeShellArg targetPath}
      target_dir="$(${pkgs.coreutils}/bin/dirname -- "$target")"
      ${pkgs.coreutils}/bin/install -d -m 0755 -o root -g root "$target_dir"
      backup="$(${pkgs.coreutils}/bin/mktemp /run/nixsoma-managed-config-backup.XXXXXX)"
      command_log="$(${pkgs.coreutils}/bin/mktemp /run/nixsoma-managed-config-switch.XXXXXX)"
      temporary_target="$target.openclaw-$$.tmp"
      had_target=false
      previous_target_hash=null

      cleanup() {
        ${pkgs.coreutils}/bin/rm -f -- "$backup" "$command_log" "$temporary_target"
      }
      restore_target() {
        if [[ "$had_target" == true ]]; then
          ${pkgs.coreutils}/bin/install -m 0640 -o root -g ${escapeShellArg cfg.group} "$backup" "$temporary_target"
          ${pkgs.coreutils}/bin/mv -f -- "$temporary_target" "$target"
        else
          ${pkgs.coreutils}/bin/rm -f -- "$target"
        fi
      }
      trap cleanup EXIT

      if [[ -e "$target" ]]; then
        if [[ ! -f "$target" || -L "$target" ]]; then
          printf '%s\n' 'managed-config target must be absent or one regular file.' >&2
          exit 65
        fi
        had_target=true
        previous_target_hash="$(${pkgs.coreutils}/bin/sha256sum -- "$target" | ${pkgs.coreutils}/bin/cut -d' ' -f1)"
        ${pkgs.coreutils}/bin/cp -- "$target" "$backup"
      fi

      ${pkgs.coreutils}/bin/install -m 0640 -o root -g ${escapeShellArg cfg.group} "$staging_path" "$temporary_target"
      ${pkgs.coreutils}/bin/mv -f -- "$temporary_target" "$target"

      if ! ${pkgs.nixos-rebuild}/bin/nixos-rebuild switch --store-path "$generation" --no-reexec >"$command_log" 2>&1; then
        restore_target
        printf '%s\n' 'fixed NixOS generation activation failed; managed source was restored without generation rollback.' >&2
        exit 1
      fi

      generation_after="$(${pkgs.coreutils}/bin/readlink -f /run/current-system)"
      profile_after="$(${pkgs.coreutils}/bin/readlink -f /nix/var/nix/profiles/system)"
      target_hash_after="$(${pkgs.coreutils}/bin/sha256sum -- "$target" | ${pkgs.coreutils}/bin/cut -d' ' -f1)"
      if [[ "$generation_after" != "$generation" || "$profile_after" != "$generation" \
        || "$target_hash_after" != "$candidate_hash" ]]; then
        printf '%s\n' 'activation result does not match the bound generation and managed source.' >&2
        exit 1
      fi

      previous_json=null
      if [[ "$previous_target_hash" != null ]]; then
        previous_json="\"$previous_target_hash\""
      fi
      printf '{"registry":"nixsoma-managed-config-activation-helper-v0","candidateHash":"%s","evaluatedClosurePath":"%s","previousTargetHash":%s,"generationBefore":"%s","generationAfter":"%s","profileAfter":"%s","targetHashAfter":"%s","targetInstalled":true,"rollbackExecuted":false}\n' \
        "$candidate_hash" "$generation" "$previous_json" "$generation_before" "$generation_after" "$profile_after" "$target_hash_after"
    '';
  };
in
{
  options.services.openclaw.managedConfigActivation.enable =
    mkEnableOption "approval-bound activation of one fixed managed NixOS candidate through hostd";

  config = mkIf activationCfg.enable {
    assertions = [
      {
        assertion = cfg.systemdRepairAuthDelegation.enable;
        message = "managed-config activation requires the existing peer-verified hostd boundary.";
      }
      {
        assertion = cfg.user != null && cfg.user != "" && cfg.hostdUser != cfg.user;
        message = "managed-config activation requires distinct Core and hostd service identities.";
      }
      {
        assertion = lib.hasPrefix "/" cfg.stateDir;
        message = "managed-config activation requires an absolute OpenClaw state directory.";
      }
    ];

    systemd.services.openclaw-hostd.environment = {
      OPENCLAW_HOSTD_ACTIVATION_HELPER = "${activationHelper}/bin/${commandName}";
      OPENCLAW_HOSTD_ACTIVATION_SUDO = "/run/wrappers/bin/sudo";
    };

    security.sudo.enable = true;
    security.sudo.extraRules = [
      {
        users = [ cfg.hostdUser ];
        runAs = "root";
        commands = [
          {
            command = "${activationHelper}/bin/${commandName}";
            options = [ "NOPASSWD" "NOSETENV" ];
          }
        ];
      }
    ];
  };
}
