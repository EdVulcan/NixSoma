{
  imports = [
    ./dev-body.nix
    ./clash-verge.nix
    ../modules/nixsoma-developer-generation-switch.nix
  ];

  nix.settings = {
    substituters = [
      "https://mirrors.tuna.tsinghua.edu.cn/nix-channels/store"
    ];
  };

  services.openclaw = {
    profile = "desktop-body";
    user = "openclaw-service";
    hostdUser = "openclaw-hostd";
    systemdRepairAuthDelegation.enable = true;
    kernelEventCapture.enable = true;
    resourceControl.enable = true;
    aiGraphicalSession.enable = true;
    aiGraphicalSession.attachBrowser = true;
    aiGraphicalSession.captureOutput = true;
    aiGraphicalSession.localOcr = true;
    aiGraphicalSession.nativeInput = true;
    aiGraphicalSession.applicationLifecycle = true;
    cloudProvider.enable = true;
    developerGenerationSwitch = {
      enable = true;
      user = "edvulcan";
    };
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
