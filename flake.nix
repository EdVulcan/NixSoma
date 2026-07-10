{
  description = "OpenClaw on NixOS";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs = { self, nixpkgs }:
    let
      system = "x86_64-linux";
      pkgs = import nixpkgs { inherit system; };
    in {
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

      packages.${system}.firefox = pkgs.firefox;
    };
}
