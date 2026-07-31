{ pkgs, ... }:

{
  name = "openclaw-kernel-activity-snapshot";

  nodes.machine = { ... }: {
    imports = [ ../modules/openclaw-body.nix ];
    virtualisation = { cores = 2; memorySize = 3072; };
    environment.systemPackages = [ pkgs.coreutils pkgs.curl pkgs.jq ];

    services.openclaw = {
      enable = true;
      profile = "desktop-body";
      repoRoot = "/opt/openclaw-vm-proof";
      user = "openclaw-service";
      group = "openclaw";
      operatorAuthTokenFile = "/var/lib/openclaw/operator-token";
      kernelEventCapture.enable = true;
      kernelNetworkCapture.enable = true;
      kernelFileCapture.enable = true;
      components = [ "eventHub" "core" "systemSense" "observerUi" ];
    };

    system.stateVersion = "25.05";
  };

  testScript = ''
    import json

    def command_output(command):
        return machine.succeed(command).strip()

    def reject_raw_metadata(value, location="$"):
        forbidden = {
            "events", "comm", "commCounts", "newCommNames", "entries", "executableIdentity",
            "destination", "address", "port", "payload", "family", "familyCounts",
            "path", "filename", "content", "inode", "mount", "result", "returnValue",
            "flags", "flagCounts",
        }
        if isinstance(value, list):
            for index, item in enumerate(value):
                reject_raw_metadata(item, f"{location}[{index}]")
        elif isinstance(value, dict):
            for key, nested in value.items():
                assert key not in forbidden, f"raw kernel metadata at {location}.{key}"
                reject_raw_metadata(nested, f"{location}.{key}")

    start_all()
    for unit in [
        "openclaw-event-hub.service", "openclaw-core.service",
        "openclaw-system-sense.service", "observer-ui.service",
    ]:
        machine.wait_for_unit(unit)
    for port in [4100, 4101, 4106, 4170]:
        machine.wait_until_succeeds(f"curl --silent --fail http://127.0.0.1:{port}/health")

    assert command_output("systemd-detect-virt --vm") in ["kvm", "qemu"]
    environment = command_output("systemctl show openclaw-system-sense.service --property=Environment --value")
    for token in [
        "OPENCLAW_KERNEL_EVENT_CAPTURE_ENABLED=1",
        "OPENCLAW_KERNEL_NETWORK_CAPTURE_ENABLED=1",
        "OPENCLAW_KERNEL_FILE_CAPTURE_ENABLED=1",
    ]:
        assert token in environment
    capabilities = command_output("systemctl show openclaw-system-sense.service --property=AmbientCapabilities --value").lower()
    bounding = command_output("systemctl show openclaw-system-sense.service --property=CapabilityBoundingSet --value").lower()
    assert "cap_bpf" in capabilities and "cap_perfmon" in capabilities
    assert "cap_bpf" in bounding and "cap_perfmon" in bounding

    machine.succeed("""
      temporary_file=$(mktemp)
      (
        for _ in $(seq 1 24); do
          true
          curl --silent --fail http://127.0.0.1:4100/health >/dev/null
          : >"$temporary_file"
          cat "$temporary_file" >/dev/null
          sleep 0.05
        done
      ) &
      curl --silent --show-error --fail \
        http://127.0.0.1:4100/proxy/system-sense/system/kernel/activity-snapshot \
        >/run/kernel-activity.json
      wait
      rm -f "$temporary_file"
    """)
    snapshot = json.loads(command_output("cat /run/kernel-activity.json"))
    print(json.dumps(snapshot))
    assert snapshot["ok"] is True
    assert snapshot["registry"] == "openclaw-kernel-activity-snapshot-v0"
    assert snapshot["mode"] == "explicit_bounded_read_only"
    assert snapshot["status"] == "complete"
    assert snapshot["laneCount"] == 3
    assert snapshot["availableLaneCount"] == 3
    assert snapshot["eventCount"] >= 3
    expected = {
        "processExec": "openclaw-kernel-process-exec-v0",
        "networkConnect": "openclaw-kernel-network-connect-v0",
        "fileOpen": "openclaw-kernel-file-open-v0",
    }
    for lane_name, registry in expected.items():
        lane = snapshot["lanes"][lane_name]
        assert lane["registry"] == registry
        assert lane["status"] == "captured"
        assert lane["available"] is True
        assert lane["eventCount"] > 0
        assert lane["rawEventsIncluded"] is False
        assert lane["continuity"]["captureSequence"] >= 1
    assert "mode" not in snapshot["lanes"]["fileOpen"]
    boundary = snapshot["boundary"]
    assert boundary["simultaneousCapture"] is True
    assert boundary["singleFlight"] is True
    for key in [
        "rawEventsIncluded", "commNamesIncluded", "executableIdentityIncluded",
        "networkDestinationIncluded", "networkPortIncluded", "networkPayloadIncluded",
        "filePathIncluded", "fileNameIncluded", "fileContentIncluded", "fileResultIncluded",
        "persisted", "automaticRepeat", "providerActivity", "browserActivity",
        "policyExecution", "hostMutation",
    ]:
        assert boundary[key] is False, key
    reject_raw_metadata(snapshot)

    html = command_output("curl --silent --show-error --fail http://127.0.0.1:4170/")
    client = command_output("curl --silent --show-error --fail http://127.0.0.1:4170/client-v5.js")
    for token in ["Kernel Activity Snapshot", "capture-kernel-activity-button", "kernel-activity-available-lanes"]:
        assert token in html, token
    for token in ["/system/kernel/activity-snapshot", "captureKernelActivitySnapshot", "captureKernelActivityButton.addEventListener"]:
        assert token in client, token
    assert "setInterval(captureKernelActivitySnapshot" not in client

    machine.succeed(
        "systemctl is-active --quiet openclaw-event-hub.service "
        "openclaw-core.service openclaw-system-sense.service observer-ui.service"
    )
    assert command_output("systemctl --failed --no-legend --plain") == ""
    print(json.dumps({
        "registry": "nixsoma-kernel-activity-snapshot-vm-v0",
        "snapshotRegistry": snapshot["registry"],
        "availableLaneCount": snapshot["availableLaneCount"],
        "eventCount": snapshot["eventCount"],
        "processExecEvents": snapshot["lanes"]["processExec"]["eventCount"],
        "networkConnectEvents": snapshot["lanes"]["networkConnect"]["eventCount"],
        "fileOpenEvents": snapshot["lanes"]["fileOpen"]["eventCount"],
        "explicitTrigger": True,
        "automaticRepeat": False,
        "rawEventsIncluded": False,
        "persisted": False,
        "providerActivity": False,
        "browserActivity": False,
        "hostMutation": False,
    }))
  '';
}
