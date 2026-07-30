{
  name = "openclaw-system-heal-repair-loop";

  nodes.machine = { pkgs, ... }: {
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
      hostdUser = "openclaw-hostd";
      operatorAuthTokenFile = "/var/lib/openclaw/operator-token";
      systemdRepairAuthDelegation.enable = true;
      fixedUnitIncidentScheduler.intervalSeconds = 30;
      components = [
        "eventHub"
        "core"
        "systemSense"
        "systemHeal"
      ];
    };

    system.stateVersion = "25.05";
  };

  testScript = ''
    import json
    import shlex

    target_unit = "openclaw-system-heal.service"
    state_file = "/var/lib/openclaw/openclaw-core-state.json"
    auth_config = "/run/openclaw-vm-proof-curl.conf"
    core_url = "http://127.0.0.1:4100"
    event_hub_url = "http://127.0.0.1:4101"

    def command_output(command):
        return machine.succeed(command).strip()

    def service_pid(unit):
        return int(command_output(f"systemctl show {shlex.quote(unit)} --property=MainPID --value"))

    def request_json(base_url, path, method="GET", payload=None, authenticated=False):
        args = [
            "curl",
            "--silent",
            "--show-error",
            "--fail-with-body",
            "--request",
            method,
        ]
        if authenticated:
            args.extend(["--config", auth_config])
        if payload is not None:
            args.extend([
                "--header",
                "content-type: application/json",
                "--data",
                json.dumps(payload, separators=(",", ":")),
            ])
        args.append(f"{base_url}{path}")
        return json.loads(command_output(shlex.join(args)))

    def core_json(path, method="GET", payload=None):
        return request_json(core_url, path, method, payload, authenticated=True)

    def audit_events(event_type):
        response = request_json(
            event_hub_url,
            f"/events/audit?type={event_type}&limit=100",
        )
        return response["items"]

    def assert_single_audit(event_type):
        events = audit_events(event_type)
        assert len(events) == 1, (event_type, events)
        assert events[0]["source"] == "openclaw-core", events[0]
        return events[0]

    start_all()
    for unit in [
        "openclaw-event-hub.service",
        "openclaw-core.service",
        "openclaw-system-sense.service",
        "openclaw-system-heal.service",
        "openclaw-hostd.service",
        "polkit.service",
    ]:
        machine.wait_for_unit(unit)

    machine.wait_until_succeeds("curl --silent --fail http://127.0.0.1:4100/health")
    machine.wait_until_succeeds("curl --silent --fail http://127.0.0.1:4106/health")
    machine.wait_until_succeeds("curl --silent --fail http://127.0.0.1:4107/health")
    assert command_output("systemd-detect-virt --vm") in ["kvm", "qemu"]

    machine.succeed(f"""
      umask 077
      {{
        printf 'header = "Authorization: Bearer '
        tr -d '\\n' < /var/lib/openclaw/operator-token
        printf '"\\n'
      }} > {auth_config}
    """)
    generation_before = command_output("readlink -f /run/current-system")
    baseline_pids = {
        unit: service_pid(unit)
        for unit in [
            "openclaw-event-hub.service",
            "openclaw-core.service",
            "openclaw-system-sense.service",
            "openclaw-system-heal.service",
            "openclaw-hostd.service",
        ]
    }
    assert all(pid > 0 for pid in baseline_pids.values()), baseline_pids

    with subtest("healthy baseline is observed without creating work"):
        machine.wait_until_succeeds(
            f"jq -e '.fixedUnitIncidentSchedulerState.lastResult == \"observed\" and "
            f".fixedUnitIncidentSchedulerState.units[\"{target_unit}\"].status == \"healthy\"' "
            f"{state_file}",
            timeout=90,
        )
        baseline_tasks = core_json("/tasks?limit=50")
        baseline_approvals = core_json("/approvals?limit=100")
        assert baseline_tasks["count"] == 0, baseline_tasks
        assert baseline_approvals["count"] == 0, baseline_approvals

    with subtest("controlled interruption creates the automatic approval-gated chain"):
        machine.succeed(f"systemctl stop {target_unit}")
        machine.wait_until_fails(f"systemctl is-active --quiet {target_unit}")
        assert service_pid(target_unit) == 0

        machine.wait_until_succeeds(
            f"jq -e '.fixedUnitIncidentSchedulerState.units[\"{target_unit}\"] "
            f"| .status == \"unhealthy\" "
            f"and .triageStatus == \"completed\" "
            f"and .repairPromotionStatus == \"completed\" "
            f"and .repairApprovalStatus == \"pending\" "
            f"and (.latestRepairTaskId | type == \"string\") "
            f"and (.latestRepairApprovalId | type == \"string\")' {state_file}",
            timeout=100,
        )

        tasks_before_approval = core_json("/tasks?limit=50")
        incident_tasks = [
            item for item in tasks_before_approval["items"]
            if item["type"] == "systemd_fixed_unit_incident_task"
            and item.get("systemdIncidentObservation", {}).get("target", {}).get("unit") == target_unit
        ]
        triage_tasks = [
            item for item in tasks_before_approval["items"]
            if item["type"] == "systemd_fixed_unit_incident_triage_task"
            and item.get("systemdIncidentTriage", {}).get("target", {}).get("unit") == target_unit
        ]
        repair_tasks = [
            item for item in tasks_before_approval["items"]
            if item["type"] == "systemd_next_repair_task"
            and item.get("systemdNextRepair", {}).get("target", {}).get("unit") == target_unit
        ]
        assert len(incident_tasks) == 1, incident_tasks
        assert len(triage_tasks) == 1, triage_tasks
        assert len(repair_tasks) == 1, repair_tasks

        incident_task = incident_tasks[0]
        triage_task = triage_tasks[0]
        repair_task = repair_tasks[0]
        observation = incident_task["systemdIncidentObservation"]
        promotion = repair_task["systemdIncidentRepairPromotion"]
        assert incident_task["status"] == "completed", incident_task
        assert triage_task["status"] == "completed", triage_task
        assert repair_task["status"] == "queued", repair_task
        assert observation["health"]["healthy"] is False, observation
        assert observation["health"]["unit"]["activeState"] == "inactive", observation
        assert observation["health"]["service"]["ok"] is False, observation
        assert promotion["trigger"] == "scheduler", promotion
        assert promotion["mode"] == "automatic_approval_gated_repair_task_creation", promotion
        assert promotion["sourceTaskId"] == incident_task["id"], promotion
        assert promotion["triageTaskId"] == triage_task["id"], promotion

        approvals = core_json("/approvals?status=pending&limit=100")
        matching_approvals = [
            item for item in approvals["items"]
            if item["taskId"] == repair_task["id"]
        ]
        assert len(matching_approvals) == 1, approvals
        approval = matching_approvals[0]
        assert approval["risk"] == "high", approval
        assert repair_task["approval"]["requestId"] == approval["id"], repair_task

    with subtest("explicit approval dispatches exactly one fixed hostd restart"):
        unrelated_before_approval = {
            unit: service_pid(unit)
            for unit in [
                "openclaw-event-hub.service",
                "openclaw-core.service",
                "openclaw-system-sense.service",
                "openclaw-hostd.service",
            ]
        }
        approved = core_json(
            f"/approvals/{approval['id']}/approve",
            "POST",
            {"reason": "Approve one fixed-target repair inside the disposable NixOS VM."},
        )
        dispatch = approved["automaticDispatch"]
        assert dispatch["registry"] == "openclaw-fixed-unit-incident-approved-dispatch-v0", dispatch
        assert dispatch["dispatched"] is True, dispatch
        assert dispatch["status"] == "completed", dispatch
        assert dispatch["automaticRecovery"] is False, dispatch
        assert dispatch["completionAuditRecorded"] is True, dispatch

        completed = core_json(f"/tasks/{repair_task['id']}")["task"]
        assert dispatch["taskStatus"] == "completed", (dispatch, completed["outcome"])
        assert completed["status"] == "completed", completed
        assert completed["outcome"]["kind"] == "systemd_next_repair_execution_completed", completed
        details = completed["outcome"]["details"]
        transcripts = details["commandTranscript"]
        assert len(transcripts) == 1, transcripts
        transcript = transcripts[0]
        assert transcript["command"] == f"systemctl restart {target_unit}", transcript
        assert transcript["exitCode"] == 0, transcript
        assert transcript["transport"] == "dbus_native", transcript
        assert transcript["method"] == "org.freedesktop.systemd1.Manager.RestartUnit", transcript
        assert transcript["beforeMainPid"] == 0, transcript
        assert transcript["afterMainPid"] > 0, transcript
        assert transcript["peerIdentity"]["boundary"] == "kernel_so_peercred", transcript
        assert transcript["peerIdentity"]["matched"] is True, transcript
        assert transcript["authDelegation"]["mode"] == "polkit-dbus-fixed-unit", transcript
        assert transcript["authDelegation"]["sudo"] is None, transcript
        assert transcript["nativeCapability"]["capabilityId"] == "hostd.restart_system_heal", transcript
        assert details["hostMutationAttempted"] is True, details
        assert details["executionSucceeded"] is True, details
        assert details["repairSucceeded"] is True, details

        verification = details["postExecutionVerification"]
        receipt = details["incidentReceipt"]
        diagnosis = details["incidentDiagnosis"]
        assert verification["targetHealthServiceKey"] == "systemHeal", verification
        assert verification["summary"]["targetHealthy"] is True, verification
        assert verification["summary"]["restoredHealthy"] is True, verification
        assert verification["recoveryRecommendation"] is None, verification
        assert diagnosis["target"]["unit"] == target_unit, diagnosis
        assert diagnosis["journalEvidence"]["available"] is True, diagnosis
        assert diagnosis["journalEvidence"]["messagesPersisted"] is False, diagnosis
        assert receipt["registry"] == "openclaw-systemd-repair-incident-receipt-v0", receipt
        assert receipt["target"]["unit"] == target_unit, receipt
        assert receipt["hostdReceipt"]["jobPath"] == transcript["jobPath"], receipt
        assert receipt["postHealth"]["service"]["ok"] is True, receipt
        assert receipt["restoredHealthy"] is True, receipt
        assert receipt["governance"]["singleRestartAttempt"] is True, receipt
        assert receipt["governance"]["automaticRecovery"] is False, receipt
        assert receipt["receiptHash"].startswith("sha256:"), receipt

        healed_pid = service_pid(target_unit)
        assert healed_pid == transcript["afterMainPid"], (healed_pid, transcript)
        for unit, pid in unrelated_before_approval.items():
            assert service_pid(unit) == pid, (unit, pid, service_pid(unit))
        assert command_output("readlink -f /run/current-system") == generation_before

    with subtest("durable audit records the complete chain without provider egress"):
        required_events = [
            "systemd.fixed_unit_incident_observed",
            "systemd.fixed_unit_incident_triage_recorded",
            "systemd.fixed_unit_incident_repair_promoted",
            "systemd.fixed_unit_incident_repair_dispatch_authorized",
            "systemd.fixed_unit_incident_repair_dispatch_completed",
            "systemd.next_repair.execution_completed",
        ]
        for event_type in required_events:
            assert_single_audit(event_type)
        audit = request_json(event_hub_url, "/events/audit?limit=1000")
        assert not any(
            item["type"].startswith("cloud_provider.")
            for item in audit["items"]
        ), audit

    with subtest("completed dispatch remains closed across Core restart"):
        completed_task_count = core_json("/tasks?limit=50")["count"]
        completed_pid = service_pid(target_unit)
        machine.succeed("systemctl restart openclaw-core.service")
        machine.wait_for_unit("openclaw-core.service")
        machine.wait_until_succeeds("curl --silent --fail http://127.0.0.1:4100/health")
        machine.sleep(35)
        assert service_pid(target_unit) == completed_pid
        assert core_json("/tasks?limit=50")["count"] == completed_task_count
        assert len(audit_events("systemd.next_repair.execution_completed")) == 1
        assert len(audit_events("systemd.fixed_unit_incident_repair_dispatch_authorized")) == 1

        status_args = [
            "curl",
            "--silent",
            "--output",
            "/tmp/reapprove.json",
            "--write-out",
            "%{http_code}",
            "--request",
            "POST",
            "--config",
            auth_config,
            "--header",
            "content-type: application/json",
            "--data",
            json.dumps({"reason": "Attempt forbidden replay."}),
            f"{core_url}/approvals/{approval['id']}/approve",
        ]
        assert command_output(shlex.join(status_args)) == "409"
        assert service_pid(target_unit) == completed_pid

    with subtest("interrupted reserved snapshot fails closed without mutation replay"):
        machine.succeed("systemctl stop openclaw-core.service")
        injection = f"""
          tmp=$(mktemp)
          jq --arg task {shlex.quote(repair_task["id"])} --arg unit {shlex.quote(target_unit)} '
            (.tasks[] | select(.id == $task) | .status) = "queued"
            | (.tasks[] | select(.id == $task) | .closedAt) = null
            | (.tasks[] | select(.id == $task) | .outcome) = null
            | .fixedUnitIncidentSchedulerState.units[$unit].repairDispatchTaskId = $task
            | .fixedUnitIncidentSchedulerState.units[$unit].repairDispatchStatus = "reserved"
            | .fixedUnitIncidentSchedulerState.units[$unit].repairDispatchCompletedAt = null
            | .fixedUnitIncidentSchedulerState.units[$unit].repairDispatchOutcomeStatus = null
            | .fixedUnitIncidentSchedulerState.units[$unit].repairDispatchFailure = null
          ' {state_file} > "$tmp"
          install -m 0600 -o openclaw-service -g openclaw "$tmp" {state_file}
          rm -f "$tmp"
        """
        machine.succeed(injection)
        replay_guard_pid = service_pid(target_unit)
        machine.succeed("systemctl start openclaw-core.service")
        machine.wait_for_unit("openclaw-core.service")
        machine.wait_until_succeeds("curl --silent --fail http://127.0.0.1:4100/health")
        machine.wait_until_succeeds(
            f"jq -e '.fixedUnitIncidentSchedulerState.units[\"{target_unit}\"] "
            f"| .repairDispatchStatus == \"failed\" "
            f"and .repairDispatchFailure.code == \"automatic_repair_dispatch_interrupted\"' {state_file}",
            timeout=30,
        )
        interrupted_task = core_json(f"/tasks/{repair_task['id']}")["task"]
        assert interrupted_task["status"] == "failed", interrupted_task
        assert interrupted_task["outcome"]["details"]["code"] == "automatic_repair_dispatch_interrupted", interrupted_task
        assert interrupted_task["outcome"]["details"]["automaticReplay"] is False, interrupted_task
        assert service_pid(target_unit) == replay_guard_pid
        machine.sleep(35)
        assert service_pid(target_unit) == replay_guard_pid
        assert len(audit_events("systemd.next_repair.execution_completed")) == 1
        assert len(audit_events("systemd.fixed_unit_incident_repair_dispatch_authorized")) == 1
        assert core_json("/tasks?limit=50")["count"] == completed_task_count

    machine.succeed("systemctl is-active --quiet openclaw-event-hub.service openclaw-core.service openclaw-system-sense.service openclaw-system-heal.service openclaw-hostd.service")
    assert command_output("systemctl --failed --no-legend --plain") == ""
    assert command_output("readlink -f /run/current-system") == generation_before

    print(json.dumps({
        "registry": "nixsoma-system-heal-repair-loop-vm-v0",
        "targetUnit": target_unit,
        "incidentTaskId": incident_task["id"],
        "triageTaskId": triage_task["id"],
        "repairTaskId": repair_task["id"],
        "approvalId": approval["id"],
        "beforeMainPid": transcript["beforeMainPid"],
        "afterMainPid": transcript["afterMainPid"],
        "incidentReceiptHash": receipt["receiptHash"],
        "singleRestartAttempt": receipt["governance"]["singleRestartAttempt"],
        "completedReplayCount": len(audit_events("systemd.next_repair.execution_completed")),
        "interruptedReservationFailedClosed": True,
        "providerEgress": False,
        "generationMutation": False,
        "failedUnits": 0,
    }, indent=2))
  '';
}
