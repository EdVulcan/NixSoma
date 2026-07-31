{ config, lib, pkgs, ... }:

let
  inherit (lib) escapeShellArg mkEnableOption mkIf;
  cfg = config.services.openclaw;
  activationCfg = cfg.managedConfigActivation;
  commandName = "nixsoma-managed-config-activation";
  rollbackCommandName = "nixsoma-managed-config-rollback";
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
      if [[ "$#" -ne 3 ]]; then
        printf 'usage: %s <candidate-sha256> /nix/store/<nixos-system-closure> <activation-request-id>\n' "$0" >&2
        exit 64
      fi

      candidate_hash="$1"
      generation="$2"
      request_id="$3"
      if [[ ! "$candidate_hash" =~ ^[0-9a-f]{64}$ ]]; then
        printf '%s\n' 'candidate hash must be one sha256 hex digest.' >&2
        exit 64
      fi
      if [[ ! "$request_id" =~ ^[A-Za-z0-9._:-]{1,128}$ ]]; then
        printf '%s\n' 'activation request id is invalid.' >&2
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
      snapshot_root=/var/lib/nixsoma-managed-config-rollbacks
      snapshot="$snapshot_root/$request_id"
      ${pkgs.coreutils}/bin/install -d -m 0700 -o root -g root "$snapshot_root"
      if [[ -e "$snapshot" ]]; then
        printf '%s\n' 'activation rollback snapshot id already exists.' >&2
        exit 65
      fi
      backup="$(${pkgs.coreutils}/bin/mktemp /run/nixsoma-managed-config-backup.XXXXXX)"
      command_log="$(${pkgs.coreutils}/bin/mktemp /run/nixsoma-managed-config-switch.XXXXXX)"
      temporary_target="$target.openclaw-$$.tmp"
      had_target=false
      previous_target_hash=null
      snapshot_created=false
      activation_committed=false

      cleanup() {
        ${pkgs.coreutils}/bin/rm -f -- "$backup" "$command_log" "$temporary_target"
        if [[ "$snapshot_created" == true && "$activation_committed" != true ]]; then
          ${pkgs.coreutils}/bin/rm -rf -- "$snapshot"
        fi
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

      ${pkgs.coreutils}/bin/mkdir -m 0700 -- "$snapshot"
      snapshot_created=true
      if [[ "$had_target" == true ]]; then
        ${pkgs.coreutils}/bin/install -m 0600 -o root -g root "$backup" "$snapshot/previous-target"
      fi
      printf '%s\n' "$candidate_hash" > "$snapshot/candidate-hash"
      printf '%s\n' "$generation" > "$snapshot/activated-generation"
      printf '%s\n' "$generation_before" > "$snapshot/previous-generation"
      printf '%s\n' "$had_target" > "$snapshot/previous-target-present"
      printf '%s\n' "$previous_target_hash" > "$snapshot/previous-target-hash"
      ${pkgs.coreutils}/bin/chmod 0600 "$snapshot"/*

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
      activation_committed=true
      printf '{"registry":"nixsoma-managed-config-activation-helper-v0","candidateHash":"%s","evaluatedClosurePath":"%s","rollbackSnapshotId":"%s","previousTargetPresent":%s,"previousTargetHash":%s,"generationBefore":"%s","generationAfter":"%s","profileAfter":"%s","targetHashAfter":"%s","targetInstalled":true,"rollbackExecuted":false}\n' \
        "$candidate_hash" "$generation" "$request_id" "$had_target" "$previous_json" "$generation_before" "$generation_after" "$profile_after" "$target_hash_after"
    '';
  };
  rollbackHelper = pkgs.writeShellApplication {
    name = rollbackCommandName;
    text = ''
      set -euo pipefail
      umask 077
      export HOME=/root
      export USER=root
      export LOGNAME=root
      export PATH=/run/current-system/sw/bin:/nix/var/nix/profiles/default/bin
      unset NIX_CONFIG NIX_PATH NIX_REMOTE NIX_SSHOPTS NIX_BUILD_SHELL TMPDIR TMP TEMP

      if [[ "$EUID" -ne 0 ]]; then
        printf '%s\n' '${rollbackCommandName} must run through its fixed sudoers rule.' >&2
        exit 77
      fi
      if [[ "$#" -ne 1 ]]; then
        printf 'usage: %s <activation-request-id>\n' "$0" >&2
        exit 64
      fi

      snapshot_id="$1"
      if [[ ! "$snapshot_id" =~ ^[A-Za-z0-9._:-]{1,128}$ ]]; then
        printf '%s\n' 'rollback snapshot id is invalid.' >&2
        exit 64
      fi

      exec 9> /run/lock/nixsoma-managed-config-activation.lock
      if ! ${pkgs.util-linux}/bin/flock -n 9; then
        printf '%s\n' 'another managed-config activation or rollback is active.' >&2
        exit 75
      fi

      snapshot_root=/var/lib/nixsoma-managed-config-rollbacks
      snapshot="$snapshot_root/$snapshot_id"
      canonical_snapshot="$(${pkgs.coreutils}/bin/realpath -e -- "$snapshot")"
      if [[ "$canonical_snapshot" != "$snapshot" || ! -d "$snapshot" || -L "$snapshot" \
        || "$(${pkgs.coreutils}/bin/stat -c '%U:%G:%a' -- "$snapshot")" != root:root:700 ]]; then
        printf '%s\n' 'rollback snapshot is missing or invalid.' >&2
        exit 65
      fi

      for name in candidate-hash activated-generation previous-generation previous-target-present previous-target-hash; do
        metadata="$snapshot/$name"
        if [[ ! -f "$metadata" || -L "$metadata" \
          || "$(${pkgs.coreutils}/bin/stat -c '%U:%G:%a' -- "$metadata")" != root:root:600 ]]; then
          printf '%s\n' 'rollback snapshot metadata is invalid.' >&2
          exit 65
        fi
      done

      candidate_hash="$(<"$snapshot/candidate-hash")"
      activated_generation="$(<"$snapshot/activated-generation")"
      previous_generation="$(<"$snapshot/previous-generation")"
      previous_target_present="$(<"$snapshot/previous-target-present")"
      previous_target_hash="$(<"$snapshot/previous-target-hash")"
      if [[ ! "$candidate_hash" =~ ^[0-9a-f]{64}$ \
        || ! "$previous_target_present" =~ ^(true|false)$ ]]; then
        printf '%s\n' 'rollback snapshot bindings are invalid.' >&2
        exit 65
      fi
      if [[ "$previous_target_present" == true ]]; then
        if [[ ! "$previous_target_hash" =~ ^[0-9a-f]{64}$ \
          || ! -f "$snapshot/previous-target" || -L "$snapshot/previous-target" \
          || "$(${pkgs.coreutils}/bin/stat -c '%U:%G:%a' -- "$snapshot/previous-target")" != root:root:600 \
          || "$(${pkgs.coreutils}/bin/sha256sum -- "$snapshot/previous-target" | ${pkgs.coreutils}/bin/cut -d' ' -f1)" != "$previous_target_hash" ]]; then
          printf '%s\n' 'rollback snapshot previous target is invalid.' >&2
          exit 65
        fi
      elif [[ "$previous_target_hash" != null || -e "$snapshot/previous-target" ]]; then
        printf '%s\n' 'rollback snapshot absent-target marker is inconsistent.' >&2
        exit 65
      fi

      for generation in "$activated_generation" "$previous_generation"; do
        canonical_generation="$(${pkgs.coreutils}/bin/realpath -e -- "$generation")"
        generation_name="$(${pkgs.coreutils}/bin/basename -- "$generation")"
        if [[ "$canonical_generation" != "$generation" || "$generation" != /nix/store/* \
          || ! "$generation_name" =~ ^[0-9a-z]{32}-nixos-system-[A-Za-z0-9._-]+-.+ \
          || "$(${pkgs.coreutils}/bin/stat -c %u -- "$generation")" != 0 \
          || ! -x "$generation/bin/switch-to-configuration" ]]; then
          printf '%s\n' 'rollback snapshot generation is not canonical and switchable.' >&2
          exit 65
        fi
        ${pkgs.nix}/bin/nix-store --query --hash "$generation" >/dev/null
      done
      if [[ "$activated_generation" == "$previous_generation" ]]; then
        printf '%s\n' 'rollback snapshot generations must differ.' >&2
        exit 65
      fi

      generation_before="$(${pkgs.coreutils}/bin/readlink -f /run/current-system)"
      profile_before="$(${pkgs.coreutils}/bin/readlink -f /nix/var/nix/profiles/system)"
      target=${escapeShellArg targetPath}
      if [[ "$generation_before" != "$activated_generation" || "$profile_before" != "$activated_generation" \
        || ! -f "$target" || -L "$target" ]]; then
        printf '%s\n' 'current generation or managed source no longer matches the activated receipt.' >&2
        exit 65
      fi
      target_hash_before="$(${pkgs.coreutils}/bin/sha256sum -- "$target" | ${pkgs.coreutils}/bin/cut -d' ' -f1)"
      if [[ "$target_hash_before" != "$candidate_hash" ]]; then
        printf '%s\n' 'current managed source no longer matches the activated candidate.' >&2
        exit 65
      fi

      command_log="$(${pkgs.coreutils}/bin/mktemp /run/nixsoma-managed-config-rollback.XXXXXX)"
      candidate_backup="$(${pkgs.coreutils}/bin/mktemp /run/nixsoma-managed-config-candidate.XXXXXX)"
      temporary_target="$target.openclaw-rollback-$$.tmp"
      ${pkgs.coreutils}/bin/cp -- "$target" "$candidate_backup"
      cleanup() {
        ${pkgs.coreutils}/bin/rm -f -- "$command_log" "$candidate_backup" "$temporary_target"
      }
      restore_activated_target() {
        ${pkgs.coreutils}/bin/install -m 0640 -o root -g ${escapeShellArg cfg.group} "$candidate_backup" "$temporary_target"
        ${pkgs.coreutils}/bin/mv -f -- "$temporary_target" "$target"
      }
      trap cleanup EXIT

      if [[ "$previous_target_present" == true ]]; then
        ${pkgs.coreutils}/bin/install -m 0640 -o root -g ${escapeShellArg cfg.group} "$snapshot/previous-target" "$temporary_target"
        ${pkgs.coreutils}/bin/mv -f -- "$temporary_target" "$target"
      else
        ${pkgs.coreutils}/bin/rm -f -- "$target"
      fi

      if ! ${pkgs.nixos-rebuild}/bin/nixos-rebuild switch --store-path "$previous_generation" --no-reexec >"$command_log" 2>&1; then
        restore_activated_target
        ${pkgs.coreutils}/bin/tail -c 4096 -- "$command_log" >&2 || true
        printf '%s\n' 'fixed NixOS generation rollback failed; activated managed source was restored.' >&2
        exit 1
      fi

      generation_after="$(${pkgs.coreutils}/bin/readlink -f /run/current-system)"
      profile_after="$(${pkgs.coreutils}/bin/readlink -f /nix/var/nix/profiles/system)"
      target_present_after=false
      target_hash_after=null
      if [[ -e "$target" ]]; then
        if [[ ! -f "$target" || -L "$target" ]]; then
          printf '%s\n' 'rollback restored an invalid managed source target.' >&2
          exit 1
        fi
        target_present_after=true
        target_hash_after="$(${pkgs.coreutils}/bin/sha256sum -- "$target" | ${pkgs.coreutils}/bin/cut -d' ' -f1)"
      fi
      if [[ "$generation_after" != "$previous_generation" || "$profile_after" != "$previous_generation" \
        || "$target_present_after" != "$previous_target_present" \
        || "$target_hash_after" != "$previous_target_hash" ]]; then
        printf '%s\n' 'rollback result does not match the exact previous generation and managed source.' >&2
        exit 1
      fi

      ${pkgs.coreutils}/bin/rm -rf -- "$snapshot"
      previous_json=null
      target_after_json=null
      if [[ "$previous_target_hash" != null ]]; then
        previous_json="\"$previous_target_hash\""
        target_after_json="$previous_json"
      fi
      printf '{"registry":"nixsoma-managed-config-rollback-helper-v0","rollbackSnapshotId":"%s","candidateHash":"%s","generationBefore":"%s","profileBefore":"%s","generationAfter":"%s","profileAfter":"%s","targetHashBefore":"%s","previousTargetPresent":%s,"previousTargetHash":%s,"targetPresentAfter":%s,"targetHashAfter":%s,"rollbackExecuted":true,"snapshotConsumed":true}\n' \
        "$snapshot_id" "$candidate_hash" "$generation_before" "$profile_before" "$generation_after" "$profile_after" "$target_hash_before" "$previous_target_present" "$previous_json" "$target_present_after" "$target_after_json"
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
      OPENCLAW_HOSTD_ROLLBACK_HELPER = "${rollbackHelper}/bin/${rollbackCommandName}";
      OPENCLAW_HOSTD_ROLLBACK_SUDO = "/run/wrappers/bin/sudo";
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
          {
            command = "${rollbackHelper}/bin/${rollbackCommandName}";
            options = [ "NOPASSWD" "NOSETENV" ];
          }
        ];
      }
    ];
  };
}
