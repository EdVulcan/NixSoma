{ pkgs, ... }:

{
  boot.kernelModules = [ "tun" ];

  # Keep Nix evaluation and compiler work from exhausting the small desktop
  # host; zram is compressed fallback capacity, not a replacement for RAM.
  zramSwap = {
    enable = true;
    algorithm = "zstd";
    memoryPercent = 50;
  };

  swapDevices = [
    {
      device = "/swapfile";
      size = 4096;
    }
  ];

  systemd.services.clash-verge-service = {
    description = "Clash Verge privileged TUN service";
    wantedBy = [ "multi-user.target" ];
    wants = [ "network-online.target" ];
    after = [ "network-online.target" ];

    serviceConfig = {
      Type = "simple";
      User = "edvulcan";
      Group = "users";
      ExecStart = "${pkgs.clash-verge-rev}/bin/clash-verge-service";
      Restart = "always";
      RestartSec = "5s";
      RuntimeDirectory = "clash-verge-rev";
      RuntimeDirectoryMode = "0750";
      StateDirectory = "clash-verge-service";
      Environment = [
        "HOME=/home/edvulcan"
        "XDG_STATE_HOME=/var/lib"
      ];
      AmbientCapabilities = [
        "CAP_NET_ADMIN"
        "CAP_NET_RAW"
        "CAP_NET_BIND_SERVICE"
      ];
      CapabilityBoundingSet = [
        "CAP_NET_ADMIN"
        "CAP_NET_RAW"
        "CAP_NET_BIND_SERVICE"
      ];
      DeviceAllow = [ "/dev/net/tun rw" ];
      NoNewPrivileges = false;
      UMask = "0007";
    };
  };
}
