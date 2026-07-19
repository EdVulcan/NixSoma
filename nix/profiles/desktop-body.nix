{
  imports = [
    ./dev-body.nix
    ./clash-verge.nix
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
    cloudProvider.enable = true;
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
