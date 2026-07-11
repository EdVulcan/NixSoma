{
  imports = [
    ./dev-body.nix
  ];

  services.openclaw = {
    profile = "desktop-body";
    user = "openclaw-service";
    systemdRepairAuthDelegation.enable = true;
    trustedSidecarUserUnit.enable = true;
    componentOwnership.user = [
      "sessionManager"
      "browserRuntime"
    ];
    browserEngine.mode = "firefox";
    components = [
      "eventHub"
      "core"
      "sessionManager"
      "browserRuntime"
      "screenSense"
      "screenAct"
      "systemSense"
      "systemHeal"
      "observerUi"
    ];
  };
}
