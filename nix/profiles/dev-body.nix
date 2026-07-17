{ lib, ... }:
{
  imports = [
    ../modules/openclaw-body.nix
  ];

  services.openclaw = {
    enable = true;
    profile = lib.mkDefault "dev-body";
    repoRoot = "/opt/openclaw";
    operatorAuthTokenFile = lib.mkDefault "/var/lib/openclaw/operator-token";
    components = [
      "eventHub"
      "core"
      "sessionManager"
      "browserRuntime"
      "observerUi"
    ];
  };
}
