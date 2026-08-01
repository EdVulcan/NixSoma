{ pkgs, ... }:

{
  name = "openclaw-kernel-process-lifecycle-snapshot";

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
      kernelProcessExitCapture.enable = true;
      components = [ "eventHub" "core" "systemSense" "observerUi" ];
    };

    system.stateVersion = "25.05";
  };

  testScript = ''
    import json

    def output(command):
        return machine.succeed(command).strip()

    start_all()
    for unit in [
        "openclaw-event-hub.service", "openclaw-core.service",
        "openclaw-system-sense.service", "observer-ui.service",
    ]:
        machine.wait_for_unit(unit)
    for port in [4100, 4101, 4106, 4170]:
        machine.wait_until_succeeds(f"curl --silent --fail http://127.0.0.1:{port}/health")

    assert output("systemd-detect-virt --vm") in ["kvm", "qemu"]
    environment = output("systemctl show openclaw-system-sense.service --property=Environment --value")
    assert "OPENCLAW_KERNEL_EVENT_CAPTURE_ENABLED=1" in environment
    assert "OPENCLAW_KERNEL_PROCESS_EXIT_CAPTURE_ENABLED=1" in environment
    capabilities = output("systemctl show openclaw-system-sense.service --property=AmbientCapabilities --value").lower()
    bounding = output("systemctl show openclaw-system-sense.service --property=CapabilityBoundingSet --value").lower()
    assert "cap_bpf" in capabilities and "cap_perfmon" in capabilities
    assert "cap_bpf" in bounding and "cap_perfmon" in bounding

    machine.succeed("""
      (
        for _ in $(seq 1 24); do
          /run/current-system/sw/bin/true
          /run/current-system/sw/bin/sleep 0.01
          sleep 0.03
        done
      ) &
      curl --silent --show-error --fail \
        http://127.0.0.1:4100/proxy/system-sense/system/kernel/process-lifecycle-snapshot \
        >/run/process-lifecycle.json
      wait
    """)
    snapshot = json.loads(output("cat /run/process-lifecycle.json"))
    print(json.dumps(snapshot))
    assert snapshot["ok"] is True
    assert snapshot["registry"] == "openclaw-kernel-process-lifecycle-snapshot-v0"
    assert snapshot["mode"] == "explicit_bounded_read_only"
    assert snapshot["status"] == "complete"
    assert snapshot["laneCount"] == 2
    assert snapshot["availableLaneCount"] == 2
    assert snapshot["eventCount"] >= 2
    for lane_name, registry in {
        "processExec": "openclaw-kernel-process-exec-v0",
        "processExit": "openclaw-kernel-process-exit-v0",
    }.items():
        lane = snapshot["lanes"][lane_name]
        assert lane["registry"] == registry
        assert lane["status"] == "captured"
        assert lane["available"] is True
        assert lane["eventCount"] >= 1
        assert lane["rawEventsIncluded"] is False
        assert lane["processNamesIncluded"] is False
        assert lane["continuity"]["captureSequence"] >= 1
    boundary = snapshot["boundary"]
    assert boundary["simultaneousCapture"] is True
    assert boundary["singleFlight"] is True
    for key in [
        "rawEventsIncluded", "processNamesIncluded", "pidValuesIncluded",
        "uidValuesIncluded", "executableIdentityIncluded", "persisted",
        "automaticRepeat", "providerActivity", "browserActivity",
        "policyExecution", "hostMutation",
    ]:
        assert boundary[key] is False, key
    def assert_no_raw_metadata(value, location="$"):
        if isinstance(value, dict):
            for key, nested in value.items():
                assert key not in {"events", "comm", "pid", "uid", "executable"}, \
                    f"raw process metadata leaked at {location}.{key}"
                assert_no_raw_metadata(nested, f"{location}.{key}")
        elif isinstance(value, list):
            for index, nested in enumerate(value):
                assert_no_raw_metadata(nested, f"{location}[{index}]")

    assert_no_raw_metadata(snapshot)

    html = output("curl --silent --show-error --fail http://127.0.0.1:4170/")
    client = output("curl --silent --show-error --fail http://127.0.0.1:4170/client-v5.js")
    for token in [
        "Process Lifecycle Snapshot", "capture-kernel-process-lifecycle-button",
        "kernel-process-lifecycle-start-count", "kernel-process-lifecycle-exit-count",
    ]:
        assert token in html
    for token in [
        "/system/kernel/process-lifecycle-snapshot",
        "captureKernelProcessLifecycleSnapshot",
        "captureKernelProcessLifecycleButton.addEventListener",
    ]:
        assert token in client
    assert "setInterval(captureKernelProcessLifecycleSnapshot" not in client
    machine.succeed(
        "systemctl is-active --quiet openclaw-event-hub.service "
        "openclaw-core.service openclaw-system-sense.service observer-ui.service"
    )
    assert output("systemctl --failed --no-legend --plain") == ""
    print(json.dumps({
        "registry": "nixsoma-kernel-process-lifecycle-snapshot-vm-v0",
        "snapshotRegistry": snapshot["registry"],
        "availableLaneCount": snapshot["availableLaneCount"],
        "eventCount": snapshot["eventCount"],
        "processExecEvents": snapshot["lanes"]["processExec"]["eventCount"],
        "processExitEvents": snapshot["lanes"]["processExit"]["eventCount"],
        "explicitTrigger": True,
        "automaticRepeat": False,
        "rawEventsIncluded": False,
        "persisted": False,
        "hostMutation": False,
    }))
  '';
}
