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
    operatorAuthTokenReaders = [ "edvulcan" ];
    systemdRepairAuthDelegation.enable = true;
    kernelEventCapture.enable = true;
    kernelNetworkCapture.enable = true;
    kernelFileCapture.enable = true;
    resourceControl.enable = true;
    aiGraphicalSession.enable = true;
    aiGraphicalSession.attachBrowser = true;
    aiGraphicalSession.captureOutput = true;
    aiGraphicalSession.localOcr = true;
    aiGraphicalSession.nativeInput = true;
    aiGraphicalSession.applicationLifecycle = true;
    cloudProvider.enable = true;
    cloudProvider.httpProxy = "http://127.0.0.1:7897";
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
    browserEngine.proxy = "http://127.0.0.1:7897";
    browserEngine.dnsOverHttps = "https://doh.pub/dns-query";
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

  environment.sessionVariables.OPENCLAW_OPERATOR_TOKEN_FILE = "/var/lib/openclaw/operator-token";
}
