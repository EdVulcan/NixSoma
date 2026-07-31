{ pkgs, ... }:

{
  name = "openclaw-kernel-network-connect-capture";

  nodes.machine = { ... }: {
    imports = [ ../modules/openclaw-body.nix ];

    virtualisation = {
      cores = 2;
      memorySize = 3072;
    };

    environment.systemPackages = [
      pkgs.coreutils
      pkgs.curl
      pkgs.jq
    ];

    services.openclaw = {
      enable = true;
      profile = "desktop-body";
      repoRoot = "/opt/openclaw-vm-proof";
      user = "openclaw-service";
      group = "openclaw";
      operatorAuthTokenFile = "/var/lib/openclaw/operator-token";
      kernelNetworkCapture.enable = true;
      components = [
        "eventHub"
        "core"
        "systemSense"
        "observerUi"
      ];
    };

    system.stateVersion = "25.05";
  };

  testScript = ''
    import json

    def command_output(command):
        return machine.succeed(command).strip()

    start_all()
    for unit in [
        "openclaw-event-hub.service",
        "openclaw-core.service",
        "openclaw-system-sense.service",
        "observer-ui.service",
    ]:
        machine.wait_for_unit(unit)

    for port in [4100, 4101, 4106, 4170]:
        machine.wait_until_succeeds(f"curl --silent --fail http://127.0.0.1:{port}/health")

    assert command_output("systemd-detect-virt --vm") in ["kvm", "qemu"]
    environment = command_output(
        "systemctl show openclaw-system-sense.service --property=Environment --value"
    )
    assert "OPENCLAW_KERNEL_NETWORK_CAPTURE_ENABLED=1" in environment
    assert "OPENCLAW_KERNEL_NETWORK_PROBE=/nix/store/" in environment
    capabilities = command_output(
        "systemctl show openclaw-system-sense.service --property=AmbientCapabilities --value"
    ).lower()
    bounding = command_output(
        "systemctl show openclaw-system-sense.service --property=CapabilityBoundingSet --value"
    ).lower()
    assert "cap_bpf" in capabilities and "cap_perfmon" in capabilities
    assert "cap_bpf" in bounding and "cap_perfmon" in bounding
    machine.succeed("""
      (
        for _ in $(seq 1 20); do
          curl --silent --fail http://127.0.0.1:4100/health >/dev/null
          sleep 0.1
        done
      ) &
      curl --silent --show-error --fail \
        http://127.0.0.1:4100/proxy/system-sense/system/kernel/network-connect-events \
        >/run/network-connect.json
      wait
    """)
    capture = json.loads(command_output("cat /run/network-connect.json"))
    expected_fields = ["timestampNs", "pid", "uid", "comm", "family", "addressLength"]
    print(json.dumps(capture))
    assert capture["ok"] is True
    assert capture["registry"] == "openclaw-kernel-network-connect-v0"
    assert capture["status"] == "captured"
    assert capture["available"] is True
    assert capture["source"]["attachment"] == "fentry"
    assert capture["source"]["tracepoint"] == "__sys_connect"
    assert capture["source"]["fields"] == expected_fields
    assert capture["source"]["familyCaptured"] is True
    assert capture["source"]["destinationCaptured"] is False
    assert capture["source"]["portCaptured"] is False
    assert capture["source"]["addressBytesCaptured"] is False
    assert capture["source"]["networkPayloadCaptured"] is False
    assert capture["source"]["persisted"] is False
    assert capture["eventCount"] == len(capture["events"]) and capture["eventCount"] > 0
    assert any(event["comm"] == "curl" for event in capture["events"])
    assert any(event["family"] > 0 for event in capture["events"])
    for event in capture["events"]:
        assert sorted(event.keys()) == sorted(expected_fields)
        assert event["pid"] > 0
        assert event["uid"] >= 0
        assert 0 <= event["family"] <= 65535
        assert 0 <= event["addressLength"] <= 65535
    assert capture["readback"]["registry"] == "openclaw-kernel-network-connect-readback-v0"
    assert capture["readback"]["persisted"] is False
    assert capture["readback"]["destinationCaptured"] is False
    assert capture["readback"]["portCaptured"] is False
    assert capture["readback"]["networkPayloadCaptured"] is False
    assert capture["readback"]["continuity"]["currentActivity"] == "connect_attempts_observed"
    assert json.dumps(capture).find("127.0.0.1") == -1
    assert json.dumps(capture).find("4100") == -1

    html = command_output("curl --silent --show-error --fail http://127.0.0.1:4170/")
    client = command_output("curl --silent --show-error --fail http://127.0.0.1:4170/client-v5.js")
    for token in [
        "Kernel Network Connect Attempts",
        "kernel-network-connect-events",
        "kernel-network-connect-readback-json",
    ]:
        assert token in html, token
    for token in [
        "/system/kernel/network-connect-events",
        "refreshKernelNetworkConnectEvents",
        "kernelNetworkConnectUniqueFamilyCount",
    ]:
        assert token in client, token

    machine.succeed(
        "systemctl is-active --quiet openclaw-event-hub.service "
        "openclaw-core.service openclaw-system-sense.service observer-ui.service"
    )
    assert command_output("systemctl --failed --no-legend --plain") == ""

    print(json.dumps({
        "registry": "nixsoma-kernel-network-connect-capture-vm-v0",
        "captureRegistry": capture["registry"],
        "attachment": capture["source"]["attachment"],
        "tracepoint": capture["source"]["tracepoint"],
        "eventCount": capture["eventCount"],
        "uniqueCommCount": capture["readback"]["uniqueCommCount"],
        "uniqueFamilyCount": capture["readback"]["uniqueFamilyCount"],
        "continuityStatus": capture["readback"]["continuity"]["status"],
        "observerPanel": "Kernel Network Connect Attempts",
        "destinationCaptured": False,
        "portCaptured": False,
        "networkPayloadCaptured": False,
        "persisted": False,
        "providerActivity": False,
        "browserActivity": False,
        "hostMutation": False,
    }))
  '';
}
