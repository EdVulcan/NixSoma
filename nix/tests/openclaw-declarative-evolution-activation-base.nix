{ lib, modulesPath, pkgs, ... }:

let
  nixpkgsPath = toString pkgs.path;
  nixpkgsSource = builtins.appendContext nixpkgsPath {
    "${nixpkgsPath}" = { path = true; };
  };
  repoPath = toString ../..;
  repoSource = builtins.appendContext repoPath {
    "${repoPath}" = { path = true; };
  };
in
{
  imports = [
    (modulesPath + "/testing/test-instrumentation.nix")
    (modulesPath + "/virtualisation/qemu-vm.nix")
    ../modules/openclaw-body.nix
  ];

  networking.hostName = "nixos";
  system.switch.enable = true;
  system.systemBuilderArgs.allowSubstitutes = true;

  environment.systemPackages = lib.mkBefore [
    pkgs.coreutils
    pkgs.curl
    pkgs.jq
    pkgs.nix
  ];

  nix.settings = {
    experimental-features = [ "nix-command" "flakes" ];
    substituters = lib.mkForce [ "file:///run/openclaw-candidate-cache" ];
    require-sigs = false;
    fallback = false;
  };
  system.extraDependencies = [ nixpkgsSource repoSource ];

  services.openclaw = {
    enable = true;
    profile = "dev-body";
    repoRoot = repoSource;
    user = "openclaw-service";
    group = "openclaw";
    hostdUser = "openclaw-hostd";
    operatorAuthTokenFile = "/var/lib/openclaw/operator-token";
    systemdRepairAuthDelegation.enable = true;
    managedConfigActivation.enable = true;
    fixedUnitIncidentScheduler.enable = false;
    components = [
      "eventHub"
      "core"
      "sessionManager"
      "browserRuntime"
      "screenSense"
      "screenAct"
      "systemSense"
      "systemHeal"
    ];
  };

  systemd.services.openclaw-core.environment = {
    OPENCLAW_NIXOS_FLAKE = lib.mkForce "";
    OPENCLAW_NIXOS_NIXPKGS_OVERRIDE = nixpkgsSource;
    OPENCLAW_NIXOS_BASE_MODULE = lib.mkForce "${repoSource}/nix/tests/openclaw-declarative-evolution-activation-base.nix";
    OPENCLAW_NIXOS_BUILD_MODE = "build";
    OPENCLAW_NIXOS_BUILD_TIMEOUT_MS = "600000";
    OPENCLAW_NIX_COMMAND = "${pkgs.nix}/bin/nix";
    OPENCLAW_NIX_INSTANTIATE = "${pkgs.nix}/bin/nix-instantiate";
  };

  system.stateVersion = "25.05";
}
