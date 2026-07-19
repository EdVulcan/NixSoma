{
  description = "NixSoma - an OpenClaw AI-native control plane on NixOS";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs = { self, nixpkgs }:
    let
      system = "x86_64-linux";
      pkgs = import nixpkgs { inherit system; };
    in
    {
      nixosModules.openclaw-body = ./nix/modules/openclaw-body.nix;
      nixosModules.default = self.nixosModules.openclaw-body;

      nixosConfigurations.openclaw-local-dev = nixpkgs.lib.nixosSystem {
        inherit system;
        modules = [
          ./nix/hosts/local-dev.nix
        ];
      };

      devShells.${system}.default = pkgs.mkShell {
        packages = with pkgs; [
          nodejs
          git
          nixpkgs-fmt
          typescript
        ];
      };

      checks.${system}.openclaw-cloud-provider-config =
        let
          providerCheckConfig = (nixpkgs.lib.nixosSystem {
            inherit system;
            modules = [
              ./nix/modules/openclaw-body.nix
              {
                system.stateVersion = "25.05";
                services.openclaw = {
                  enable = true;
                  repoRoot = "/tmp/openclaw-provider-check";
                  components = [ "core" ];
                  operatorAuthTokenFile = "/run/secrets/openclaw-operator-token";
                  cloudProvider = {
                    enable = true;
                    apiKeyFile = "/run/secrets/deepseek-api-key";
                    liveEgress = true;
                  };
                };
              }
            ];
          }).config;
          providerCheckUnit = providerCheckConfig.systemd.services.openclaw-core;
        in
        assert providerCheckUnit.environment.OPENCLAW_CLOUD_PROVIDER_ENDPOINT == "https://api.deepseek.com";
        assert providerCheckUnit.environment.OPENCLAW_CLOUD_PROVIDER_MODEL == "deepseek-chat";
        assert providerCheckUnit.environment.OPENCLAW_CLOUD_PROVIDER_LIVE_EGRESS == "1";
        assert providerCheckUnit.environment.OPENCLAW_CLOUD_PROVIDER_API_KEY_FILE == "%d/deepseek-api-key";
        assert !(providerCheckUnit.environment ? OPENCLAW_CLOUD_PROVIDER_API_KEY);
        assert builtins.elem
          "deepseek-api-key:/run/secrets/deepseek-api-key"
          providerCheckUnit.serviceConfig.LoadCredential;
        pkgs.runCommand "openclaw-cloud-provider-config-check" { } ''
          touch "$out"
        '';

      packages.${system} = {
        firefox = pkgs.firefox;
        openclaw-browser-runtime = pkgs.callPackage ./nix/packages/openclaw-browser-runtime.nix { };
        openclaw-core = pkgs.callPackage ./nix/packages/openclaw-core.nix { };
        openclaw-event-hub = pkgs.callPackage ./nix/packages/openclaw-event-hub.nix { };
        openclaw-session-manager = pkgs.callPackage ./nix/packages/openclaw-session-manager.nix { };
        openclaw-screen-sense = pkgs.callPackage ./nix/packages/openclaw-screen-sense.nix { };
        openclaw-screen-act = pkgs.callPackage ./nix/packages/openclaw-screen-act.nix { };
        openclaw-system-sense = pkgs.callPackage ./nix/packages/openclaw-system-sense.nix { };
        openclaw-kernel-event-probe = pkgs.callPackage ./nix/packages/openclaw-kernel-event-probe.nix { };
        openclaw-hostd = pkgs.callPackage ./nix/packages/openclaw-hostd.nix { };
        openclaw-system-heal = pkgs.callPackage ./nix/packages/openclaw-system-heal.nix { };
        observer-ui = pkgs.callPackage ./nix/packages/observer-ui.nix { };
      };
    };
}
