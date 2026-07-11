{
  description = "OpenClaw on NixOS";

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

      packages.${system} = {
        firefox = pkgs.firefox;
        openclaw-browser-runtime = pkgs.callPackage ./nix/packages/openclaw-browser-runtime.nix { };
        openclaw-core = pkgs.callPackage ./nix/packages/openclaw-core.nix { };
        openclaw-event-hub = pkgs.callPackage ./nix/packages/openclaw-event-hub.nix { };
        openclaw-session-manager = pkgs.callPackage ./nix/packages/openclaw-session-manager.nix { };
        openclaw-screen-sense = pkgs.callPackage ./nix/packages/openclaw-screen-sense.nix { };
        openclaw-screen-act = pkgs.callPackage ./nix/packages/openclaw-screen-act.nix { };
        openclaw-system-sense = pkgs.callPackage ./nix/packages/openclaw-system-sense.nix { };
        openclaw-system-heal = pkgs.callPackage ./nix/packages/openclaw-system-heal.nix { };
        observer-ui = pkgs.callPackage ./nix/packages/observer-ui.nix { };
      };
    };
}
