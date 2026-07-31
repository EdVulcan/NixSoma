{ pkgs, ... }:

{
  name = "openclaw-kernel-file-open-capture";

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
      kernelFileCapture.enable = true;
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

    def assert_no_forbidden_fields(value, location="$"):
        forbidden = {"path", "filename", "content", "inode", "mount", "result", "returnValue"}
        if isinstance(value, list):
            for index, item in enumerate(value):
                assert_no_forbidden_fields(item, f"{location}[{index}]")
        elif isinstance(value, dict):
            for key, nested in value.items():
                assert key not in forbidden, f"forbidden file field at {location}.{key}"
                assert_no_forbidden_fields(nested, f"{location}.{key}")

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
    assert "OPENCLAW_KERNEL_FILE_CAPTURE_ENABLED=1" in environment
    assert "OPENCLAW_KERNEL_FILE_PROBE=/nix/store/" in environment
    capabilities = command_output(
        "systemctl show openclaw-system-sense.service --property=AmbientCapabilities --value"
    ).lower()
    bounding = command_output(
        "systemctl show openclaw-system-sense.service --property=CapabilityBoundingSet --value"
    ).lower()
    assert "cap_bpf" in capabilities and "cap_perfmon" in capabilities
    assert "cap_bpf" in bounding and "cap_perfmon" in bounding

    machine.succeed("""
      temporary_file=$(mktemp)
      (
        for _ in $(seq 1 20); do
          : >"$temporary_file"
          cat "$temporary_file" >/dev/null
          sleep 0.1
        done
      ) &
      curl --silent --show-error --fail \
        http://127.0.0.1:4100/proxy/system-sense/system/kernel/file-open-events \
        >/run/file-open.json
      wait
      rm -f "$temporary_file"
    """)
    capture = json.loads(command_output("cat /run/file-open.json"))
    expected_fields = ["timestampNs", "pid", "uid", "comm", "flags", "mode"]
    print(json.dumps(capture))
    assert capture["ok"] is True
    assert capture["registry"] == "openclaw-kernel-file-open-v0"
    assert capture["status"] == "captured"
    assert capture["available"] is True
    assert capture["source"]["attachment"] == "fentry"
    assert capture["source"]["tracepoint"] == "do_sys_openat2"
    assert capture["source"]["fields"] == expected_fields
    assert capture["source"]["flagsCaptured"] is True
    assert capture["source"]["modeCaptured"] is True
    for field in ["pathCaptured", "filenameCaptured", "contentCaptured", "inodeCaptured", "mountCaptured", "resultCaptured"]:
        assert capture["source"][field] is False
    assert capture["source"]["persisted"] is False
    assert capture["source"]["policyExecution"] is False
    assert capture["eventCount"] == len(capture["events"]) and capture["eventCount"] > 0
    assert any(event["comm"] in ["cat", "bash", "touch"] for event in capture["events"])
    for event in capture["events"]:
        assert sorted(event.keys()) == sorted(expected_fields)
        assert event["timestampNs"].isdigit()
        assert event["pid"] > 0
        assert event["uid"] >= 0
        assert event["flags"].isdigit()
        assert event["mode"].isdigit()
    assert capture["readback"]["registry"] == "openclaw-kernel-file-open-readback-v0"
    assert capture["readback"]["persisted"] is False
    assert capture["readback"]["uniqueCommCount"] > 0
    assert capture["readback"]["uniqueFlagCount"] > 0
    assert capture["readback"]["continuity"]["currentActivity"] == "file_open_attempts_observed"
    assert_no_forbidden_fields(capture)

    html = command_output("curl --silent --show-error --fail http://127.0.0.1:4170/")
    client = command_output("curl --silent --show-error --fail http://127.0.0.1:4170/client-v5.js")
    for token in [
        "Kernel File Open Attempts",
        "kernel-file-open-events",
        "kernel-file-open-readback-json",
    ]:
        assert token in html, token
    for token in [
        "/system/kernel/file-open-events",
        "refreshKernelFileOpenEvents",
        "kernelFileOpenUniqueFlagCount",
    ]:
        assert token in client, token

    machine.succeed(
        "systemctl is-active --quiet openclaw-event-hub.service "
        "openclaw-core.service openclaw-system-sense.service observer-ui.service"
    )
    assert command_output("systemctl --failed --no-legend --plain") == ""

    print(json.dumps({
        "registry": "nixsoma-kernel-file-open-capture-vm-v0",
        "captureRegistry": capture["registry"],
        "attachment": capture["source"]["attachment"],
        "tracepoint": capture["source"]["tracepoint"],
        "eventCount": capture["eventCount"],
        "uniqueCommCount": capture["readback"]["uniqueCommCount"],
        "uniqueFlagCount": capture["readback"]["uniqueFlagCount"],
        "continuityStatus": capture["readback"]["continuity"]["status"],
        "observerPanel": "Kernel File Open Attempts",
        "pathCaptured": False,
        "filenameCaptured": False,
        "contentCaptured": False,
        "inodeCaptured": False,
        "mountCaptured": False,
        "resultCaptured": False,
        "persisted": False,
        "policyExecution": False,
        "providerActivity": False,
        "browserActivity": False,
        "hostMutation": False,
    }))
  '';
}
