import {
  CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_REAL_LAUNCH_EXECUTION_PREFLIGHT_REGISTRY,
} from "./cloud-live-provider-runtime-real-launch-builders.mjs";
import {
  buildLiveProviderRequestBinding,
  validateLiveProviderRequestBinding,
} from "./cloud-live-provider-network-sender.mjs";
import * as liveProviderPhaseGovernance from "./cloud-live-provider-runtime-governance.mjs";

const CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_CREDENTIAL_VALUE_ACCESS_GATE_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-credential-value-access-gate-v0";
const CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_ENDPOINT_NETWORK_EGRESS_GATE_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-endpoint-network-egress-gate-v0";
const CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_EGRESS_EXECUTION_ROUTE_TASK_PREFLIGHT_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-egress-execution-route-task-preflight-v0";
const CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_EGRESS_EXECUTION_TASK_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-egress-execution-task-v0";
export const CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_EGRESS_EXECUTION_APPROVED_DEFERRED_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-egress-execution-approved-deferred-v0";

function runtimeAdapterEvidenceRef(result) {
  return {
    registry: result?.registry ?? null,
    ready: result?.summary?.ready ?? result?.summary?.complete ?? null,
    complete: result?.summary?.complete ?? result?.summary?.ready ?? null,
    completionPercent: result?.summary?.completionPercent ?? null,
    phase: result?.summary?.phase ?? null,
  };
}

export function createCloudLiveProviderRuntimeCredentialEgressGateBuilders(deps) {
  const {
    buildCloudConsciousnessLiveProviderRealLaunchExecutionPreflight,
    isCloudConsciousnessLiveProviderRealLaunchTask,
    createTask,
    createApprovalRequestForTask,
    evaluatePolicyIntent,
    publishEvent,
    publishTaskApprovalIfPending,
    supersedeOtherActiveTasks,
    reconcileRuntimeState,
    persistState,
    serialiseTask,
    appendTaskPhase,
    completeTask,
    failTask,
    approvals,
    getTaskById,
    listTasks,
    executeGovernedLiveProviderRequest,
    providerEnv = process.env,
  } = deps;

  function findLatestRealLaunchExecutionPreflightTask() {
    const candidates = (typeof listTasks === "function" ? listTasks() : [])
      .filter((task) => {
        const shell = task?.cloudConsciousnessLiveProviderRealLaunch ?? {};
        return isCloudConsciousnessLiveProviderRealLaunchTask(task)
          && task.status === "completed"
          && shell.operatorApprovalCaptured === true
          && shell.launchExecutionDeferred === true
          && shell.executionPreflightRecorded === true
          && shell.executionPreflightRegistry === CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_REAL_LAUNCH_EXECUTION_PREFLIGHT_REGISTRY
          && shell.launchAuthorized === false
          && shell.launchExecuted === false
          && shell.credentialValueRead === false
          && shell.endpointContacted === false
          && shell.networkEgress === false
          && shell.providerResponseCreated === false
          && shell.rollbackExecuted === false
          && shell.hostMutation === false
          && shell.liveProviderCallEnabled === false
          && [
            "cloud_consciousness_live_provider_real_launch_execution_preflight",
            "cloud_consciousness_live_provider_credential_value_access_gate",
            "cloud_consciousness_live_provider_endpoint_network_egress_gate",
            "cloud_consciousness_live_provider_egress_execution_route_task_preflight",
            "cloud_consciousness_live_provider_egress_execution_task_shell_deferred",
          ].includes(task.outcome?.details?.phase);
      })
      .sort((a, b) => String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")));
    return candidates[0]?.id ? getTaskById(candidates[0].id) ?? candidates[0] : null;
  }

  function findLatestCredentialValueAccessGateTask() {
    const candidates = (typeof listTasks === "function" ? listTasks() : [])
      .filter((task) => {
        const shell = task?.cloudConsciousnessLiveProviderRealLaunch ?? {};
        return isCloudConsciousnessLiveProviderRealLaunchTask(task)
          && task.status === "completed"
          && shell.operatorApprovalCaptured === true
          && shell.launchExecutionDeferred === true
          && shell.executionPreflightRecorded === true
          && shell.executionPreflightRegistry === CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_REAL_LAUNCH_EXECUTION_PREFLIGHT_REGISTRY
          && shell.credentialValueAccessGateRecorded === true
          && shell.credentialValueAccessGateRegistry === CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_CREDENTIAL_VALUE_ACCESS_GATE_REGISTRY
          && shell.credentialValueAccessAuthorized === false
          && shell.credentialValueAccessDenied === true
          && shell.launchAuthorized === false
          && shell.launchExecuted === false
          && shell.credentialValueIncluded === false
          && shell.credentialValueRead === false
          && shell.credentialValueExposed === false
          && shell.providerCredentialRead === false
          && shell.endpointContacted === false
          && shell.networkEgress === false
          && shell.providerResponseCreated === false
          && shell.rollbackExecuted === false
          && shell.hostMutation === false
          && shell.liveProviderCallEnabled === false
          && [
            "cloud_consciousness_live_provider_credential_value_access_gate",
            "cloud_consciousness_live_provider_endpoint_network_egress_gate",
            "cloud_consciousness_live_provider_egress_execution_route_task_preflight",
            "cloud_consciousness_live_provider_egress_execution_task_shell_deferred",
          ].includes(task.outcome?.details?.phase);
      })
      .sort((a, b) => String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")));
    return candidates[0]?.id ? getTaskById(candidates[0].id) ?? candidates[0] : null;
  }

  function findLatestEndpointNetworkEgressGateTask() {
    const candidates = (typeof listTasks === "function" ? listTasks() : [])
      .filter((task) => {
        const shell = task?.cloudConsciousnessLiveProviderRealLaunch ?? {};
        return isCloudConsciousnessLiveProviderRealLaunchTask(task)
          && task.status === "completed"
          && shell.operatorApprovalCaptured === true
          && shell.launchExecutionDeferred === true
          && shell.executionPreflightRecorded === true
          && shell.executionPreflightRegistry === CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_REAL_LAUNCH_EXECUTION_PREFLIGHT_REGISTRY
          && shell.credentialValueAccessGateRecorded === true
          && shell.credentialValueAccessGateRegistry === CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_CREDENTIAL_VALUE_ACCESS_GATE_REGISTRY
          && shell.credentialValueAccessAuthorized === false
          && shell.credentialValueAccessDenied === true
          && shell.endpointNetworkEgressGateRecorded === true
          && shell.endpointNetworkEgressGateRegistry === CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_ENDPOINT_NETWORK_EGRESS_GATE_REGISTRY
          && shell.endpointNetworkEgressAuthorized === false
          && shell.endpointNetworkEgressDenied === true
          && shell.launchAuthorized === false
          && shell.launchExecuted === false
          && shell.credentialValueIncluded === false
          && shell.credentialValueRead === false
          && shell.credentialValueExposed === false
          && shell.providerCredentialRead === false
          && shell.endpointContacted === false
          && shell.networkEgress === false
          && shell.providerResponseCreated === false
          && shell.rollbackExecuted === false
          && shell.hostMutation === false
          && shell.liveProviderCallEnabled === false
          && [
            "cloud_consciousness_live_provider_endpoint_network_egress_gate",
            "cloud_consciousness_live_provider_egress_execution_route_task_preflight",
            "cloud_consciousness_live_provider_egress_execution_task_shell_deferred",
          ].includes(task.outcome?.details?.phase);
      })
      .sort((a, b) => String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")));
    return candidates[0]?.id ? getTaskById(candidates[0].id) ?? candidates[0] : null;
  }

  function findLatestEgressExecutionRouteTaskPreflightTask() {
    const candidates = (typeof listTasks === "function" ? listTasks() : [])
      .filter((task) => {
        const shell = task?.cloudConsciousnessLiveProviderRealLaunch ?? {};
        return isCloudConsciousnessLiveProviderRealLaunchTask(task)
          && task.status === "completed"
          && shell.operatorApprovalCaptured === true
          && shell.launchExecutionDeferred === true
          && shell.executionPreflightRecorded === true
          && shell.executionPreflightRegistry === CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_REAL_LAUNCH_EXECUTION_PREFLIGHT_REGISTRY
          && shell.credentialValueAccessGateRecorded === true
          && shell.credentialValueAccessGateRegistry === CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_CREDENTIAL_VALUE_ACCESS_GATE_REGISTRY
          && shell.endpointNetworkEgressGateRecorded === true
          && shell.endpointNetworkEgressGateRegistry === CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_ENDPOINT_NETWORK_EGRESS_GATE_REGISTRY
          && shell.egressExecutionRouteTaskPreflightRecorded === true
          && shell.egressExecutionRouteTaskPreflightRegistry === CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_EGRESS_EXECUTION_ROUTE_TASK_PREFLIGHT_REGISTRY
          && shell.credentialValueAccessAuthorized === false
          && shell.credentialValueAccessDenied === true
          && shell.endpointNetworkEgressAuthorized === false
          && shell.endpointNetworkEgressDenied === true
          && shell.launchAuthorized === false
          && shell.launchExecuted === false
          && shell.credentialValueRead === false
          && shell.endpointContacted === false
          && shell.networkEgress === false
          && shell.providerResponseCreated === false
          && shell.rollbackExecuted === false
          && shell.hostMutation === false
          && shell.liveProviderCallEnabled === false
          && [
            "cloud_consciousness_live_provider_egress_execution_route_task_preflight",
            "cloud_consciousness_live_provider_egress_execution_task_shell_deferred",
          ].includes(task.outcome?.details?.phase);
      })
      .sort((a, b) => String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")));
    return candidates[0]?.id ? getTaskById(candidates[0].id) ?? candidates[0] : null;
  }

  async function buildCloudConsciousnessLiveProviderCredentialValueAccessGate() {
    const preflight = await buildCloudConsciousnessLiveProviderRealLaunchExecutionPreflight();
    const preflightTask = findLatestRealLaunchExecutionPreflightTask();
    const shell = preflightTask?.cloudConsciousnessLiveProviderRealLaunch ?? {};
    const gate = {
      decision: "credential_value_access_not_authorized",
      accessGateState: shell.credentialValueAccessGateRecorded === true ? "recorded_denied" : "ready_to_record_denial",
      requiredBeforeValueRead: [
        "separate explicit credential-value access task",
        "operator authorization that names the credential reference",
        "redaction-safe transcript of the access decision",
        "endpoint egress gate after credential value access is separately authorized",
      ],
      credentialReference: "openclaw://credential/provider/live-provider-fixture",
      credentialValueAccessAuthorized: false,
      credentialValueAccessDenied: true,
      credentialValueIncluded: false,
      credentialValueRead: false,
      credentialValueExposed: false,
      providerCredentialRead: false,
    };
    const checks = [
      {
        id: "phase-59-execution-preflight-recorded",
        label: "Phase 59 execution preflight evidence is recorded",
        passed: Boolean(preflightTask)
          && shell.executionPreflightRecorded === true
          && preflight.summary?.approvedDeferredEvidenceFound === true,
        evidence: preflightTask?.id ?? null,
      },
      {
        id: "credential-reference-known-value-not-read",
        label: "Credential reference is known but credential value is not read, included, or exposed",
        passed: typeof gate.credentialReference === "string"
          && gate.credentialValueIncluded === false
          && gate.credentialValueRead === false
          && gate.credentialValueExposed === false
          && gate.providerCredentialRead === false,
        evidence: gate.credentialReference,
      },
      {
        id: "credential-access-not-authorized",
        label: "Credential value access remains explicitly unauthorized",
        passed: gate.credentialValueAccessAuthorized === false
          && gate.credentialValueAccessDenied === true,
        evidence: gate.decision,
      },
      {
        id: "no-endpoint-egress-or-live-call",
        label: "Credential gate does not contact endpoints, transmit externally, or enable live calls",
        passed: shell.endpointContacted === false
          && shell.networkEgress === false
          && shell.transmitsExternally === false
          && shell.liveProviderCallEnabled === false,
        evidence: "endpoint_egress_gate_pending",
      },
      {
        id: "no-provider-response-rollback-or-host-mutation",
        label: "Credential gate does not create provider responses, execute rollback, or mutate host state",
        passed: shell.providerResponseCreated === false
          && shell.rollbackExecuted === false
          && shell.rollbackCommandCreated === false
          && shell.hostMutation === false,
        evidence: "post_call_activity_deferred",
      },
    ];
    const passed = checks.filter((check) => check.passed).length;
    const ready = passed === checks.length;
    return {
      ok: true,
      registry: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_CREDENTIAL_VALUE_ACCESS_GATE_REGISTRY,
      mode: "phase_60_live_provider_credential_value_access_gate",
      generatedAt: new Date().toISOString(),
      status: ready ? "credential_value_access_gate_ready_denied" : "waiting_for_phase_59_execution_preflight",
      governance: liveProviderPhaseGovernance.phase60Governance(),
      gate,
      checks,
      summary: {
        ready,
        complete: ready,
        passed,
        total: checks.length,
        completionPercent: ready ? 100 : Math.round((passed / checks.length) * 100),
        phase: "phase-60",
        credentialValueAccessGateRecorded: shell.credentialValueAccessGateRecorded === true,
        executionPreflightRequired: true,
        executionPreflightFound: Boolean(preflightTask),
        sourceTaskId: preflightTask?.id ?? null,
        sourceRegistry: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_REAL_LAUNCH_EXECUTION_PREFLIGHT_REGISTRY,
        credentialValueAccessAuthorized: false,
        credentialValueAccessDenied: true,
        credentialValueIncluded: false,
        credentialValueRead: false,
        credentialValueExposed: false,
        providerSdkLoaded: false,
        providerCredentialRead: false,
        endpointContacted: false,
        networkEgress: false,
        providerResponseCreated: false,
        rollbackExecuted: false,
        rollbackCommandCreated: false,
        hostMutation: false,
        transmitsExternally: false,
        liveProviderCallEnabled: false,
        launchAuthorized: false,
        launchExecuted: false,
      },
      evidence: {
        executionPreflight: runtimeAdapterEvidenceRef(preflight),
        preflightTask: preflightTask ? serialiseTask(preflightTask) : null,
      },
      next: {
        recommendedSlice: "openclaw-cloud-consciousness-live-provider-endpoint-network-egress-gate",
        boundary: "credential values, endpoint contact, network egress, provider response creation, rollback execution, host mutation, and live provider calls remain separate future gates",
      },
    };
  }

  async function recordCloudConsciousnessLiveProviderCredentialValueAccessGate({ confirm = false } = {}) {
    if (confirm !== true) {
      throw new Error("Cloud consciousness live provider credential value access gate requires confirm=true.");
    }

    const gate = await buildCloudConsciousnessLiveProviderCredentialValueAccessGate();
    if (gate.summary?.executionPreflightFound !== true) {
      throw new Error("Cloud consciousness live provider credential value access gate requires Phase 59 execution preflight evidence.");
    }

    const task = findLatestRealLaunchExecutionPreflightTask();
    if (!task) {
      throw new Error("Unable to locate execution-preflight real launch task for credential value access gate.");
    }

    const recordedAt = new Date().toISOString();
    task.cloudConsciousnessLiveProviderRealLaunch = {
      ...(task.cloudConsciousnessLiveProviderRealLaunch ?? {}),
      implementationStatus: "credential_value_access_gate_recorded",
      credentialValueAccessGateRecorded: true,
      credentialValueAccessGateRegistry: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_CREDENTIAL_VALUE_ACCESS_GATE_REGISTRY,
      credentialValueAccessGateRecordedAt: recordedAt,
      credentialValueAccessGateDecision: gate.gate,
      credentialValueAccessAuthorized: false,
      credentialValueAccessDenied: true,
      launchAuthorized: false,
      launchExecuted: false,
      credentialValueIncluded: false,
      credentialValueRead: false,
      credentialValueExposed: false,
      providerSdkLoaded: false,
      providerCredentialRead: false,
      endpointContacted: false,
      networkEgress: false,
      providerResponseCreated: false,
      rollbackExecuted: false,
      rollbackCommandCreated: false,
      hostMutation: false,
      transmitsExternally: false,
      liveProviderCallEnabled: false,
    };
    appendTaskPhase(task, "cloud_consciousness_live_provider_credential_value_access_gate", {
      gateRegistry: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_CREDENTIAL_VALUE_ACCESS_GATE_REGISTRY,
      recordedAt,
      sourcePhase: "cloud_consciousness_live_provider_real_launch_execution_preflight",
      gate: gate.gate,
      nextSlice: "openclaw-cloud-consciousness-live-provider-endpoint-network-egress-gate",
      credentialValueAccessAuthorized: false,
      credentialValueAccessDenied: true,
      launchAuthorized: false,
      launchExecuted: false,
      credentialValueRead: false,
      endpointContacted: false,
      networkEgress: false,
      providerResponseCreated: false,
      rollbackExecuted: false,
      hostMutation: false,
      liveProviderCallEnabled: false,
    });
    completeTask(task, {
      summary: "Credential value access gate recorded; credential values remain unread and unauthorized.",
      gateRegistry: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_CREDENTIAL_VALUE_ACCESS_GATE_REGISTRY,
      phase: "cloud_consciousness_live_provider_credential_value_access_gate",
      credentialValueAccessGateRecorded: true,
      credentialValueAccessAuthorized: false,
      credentialValueAccessDenied: true,
      launchAuthorized: false,
      launchExecuted: false,
      credentialValueRead: false,
      endpointContacted: false,
      networkEgress: false,
      providerResponseCreated: false,
      rollbackExecuted: false,
      hostMutation: false,
      liveProviderCallEnabled: false,
    });
    reconcileRuntimeState();
    persistState();
    await publishEvent("task.phase_changed", { task: serialiseTask(task) });

    return {
      ok: true,
      registry: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_CREDENTIAL_VALUE_ACCESS_GATE_REGISTRY,
      mode: "phase_60_live_provider_credential_value_access_gate",
      generatedAt: recordedAt,
      status: "credential_value_access_gate_recorded_denied",
      task,
      gate: await buildCloudConsciousnessLiveProviderCredentialValueAccessGate(),
      governance: liveProviderPhaseGovernance.phase60Governance(),
    };
  }

  async function buildCloudConsciousnessLiveProviderEndpointNetworkEgressGate() {
    const credentialGate = await buildCloudConsciousnessLiveProviderCredentialValueAccessGate();
    const credentialGateTask = findLatestCredentialValueAccessGateTask();
    const shell = credentialGateTask?.cloudConsciousnessLiveProviderRealLaunch ?? {};
    const gate = {
      decision: "endpoint_network_egress_not_authorized",
      egressGateState: shell.endpointNetworkEgressGateRecorded === true ? "recorded_denied" : "ready_to_record_denial",
      requiredBeforeEndpointContact: [
        "separate explicit endpoint-network egress task",
        "operator authorization that names the provider endpoint and method",
        "credential-value access authorization evidence from a separate future gate",
        "redaction-safe transcript of the egress decision",
      ],
      providerEndpointReference: "openclaw://provider-endpoint/live-provider-fixture",
      endpointNetworkEgressAuthorized: false,
      endpointNetworkEgressDenied: true,
      endpointContacted: false,
      networkEgress: false,
      transmitsExternally: false,
      liveProviderCallEnabled: false,
    };
    const checks = [
      {
        id: "phase-60-credential-value-access-gate-recorded",
        label: "Phase 60 credential value access gate evidence is recorded",
        passed: Boolean(credentialGateTask)
          && shell.credentialValueAccessGateRecorded === true
          && shell.credentialValueAccessGateRegistry === CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_CREDENTIAL_VALUE_ACCESS_GATE_REGISTRY
          && credentialGate.summary?.executionPreflightFound === true,
        evidence: credentialGateTask?.id ?? null,
      },
      {
        id: "credential-value-still-denied-and-unread",
        label: "Credential value access remains denied and credential values remain unread",
        passed: shell.credentialValueAccessAuthorized === false
          && shell.credentialValueAccessDenied === true
          && shell.credentialValueIncluded === false
          && shell.credentialValueRead === false
          && shell.credentialValueExposed === false
          && shell.providerCredentialRead === false,
        evidence: "credential_value_access_denied",
      },
      {
        id: "endpoint-network-egress-not-authorized",
        label: "Endpoint contact and network egress remain explicitly unauthorized",
        passed: gate.endpointNetworkEgressAuthorized === false
          && gate.endpointNetworkEgressDenied === true
          && gate.endpointContacted === false
          && gate.networkEgress === false
          && gate.transmitsExternally === false,
        evidence: gate.decision,
      },
      {
        id: "no-live-provider-call-or-provider-response",
        label: "Endpoint egress gate does not enable live calls or create provider responses",
        passed: shell.liveProviderCallEnabled === false
          && shell.providerResponseCreated === false
          && shell.launchAuthorized === false
          && shell.launchExecuted === false,
        evidence: "live_provider_call_deferred",
      },
      {
        id: "no-rollback-or-host-mutation",
        label: "Endpoint egress gate does not execute rollback or mutate host state",
        passed: shell.rollbackExecuted === false
          && shell.rollbackCommandCreated === false
          && shell.hostMutation === false,
        evidence: "post_call_activity_deferred",
      },
    ];
    const passed = checks.filter((check) => check.passed).length;
    const ready = passed === checks.length;
    return {
      ok: true,
      registry: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_ENDPOINT_NETWORK_EGRESS_GATE_REGISTRY,
      mode: "phase_61_live_provider_endpoint_network_egress_gate",
      generatedAt: new Date().toISOString(),
      status: ready ? "endpoint_network_egress_gate_ready_denied" : "waiting_for_phase_60_credential_value_access_gate",
      governance: liveProviderPhaseGovernance.phase61Governance(),
      gate,
      checks,
      summary: {
        ready,
        complete: ready,
        passed,
        total: checks.length,
        completionPercent: ready ? 100 : Math.round((passed / checks.length) * 100),
        phase: "phase-61",
        endpointNetworkEgressGateRecorded: shell.endpointNetworkEgressGateRecorded === true,
        credentialValueAccessGateRequired: true,
        credentialValueAccessGateFound: Boolean(credentialGateTask),
        sourceTaskId: credentialGateTask?.id ?? null,
        sourceRegistry: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_CREDENTIAL_VALUE_ACCESS_GATE_REGISTRY,
        credentialValueAccessAuthorized: false,
        credentialValueAccessDenied: true,
        endpointNetworkEgressAuthorized: false,
        endpointNetworkEgressDenied: true,
        credentialValueIncluded: false,
        credentialValueRead: false,
        credentialValueExposed: false,
        providerSdkLoaded: false,
        providerCredentialRead: false,
        endpointContacted: false,
        networkEgress: false,
        providerResponseCreated: false,
        rollbackExecuted: false,
        rollbackCommandCreated: false,
        hostMutation: false,
        transmitsExternally: false,
        liveProviderCallEnabled: false,
        launchAuthorized: false,
        launchExecuted: false,
      },
      evidence: {
        credentialValueAccessGate: runtimeAdapterEvidenceRef(credentialGate),
        credentialGateTask: credentialGateTask ? serialiseTask(credentialGateTask) : null,
      },
      next: {
        recommendedSlice: "openclaw-cloud-consciousness-live-provider-egress-execution-route-task-preflight",
        boundary: "credential values, endpoint contact, network egress, provider response creation, rollback execution, host mutation, and live provider calls remain separate future gates",
      },
    };
  }

  async function recordCloudConsciousnessLiveProviderEndpointNetworkEgressGate({ confirm = false } = {}) {
    if (confirm !== true) {
      throw new Error("Cloud consciousness live provider endpoint network egress gate requires confirm=true.");
    }

    const gate = await buildCloudConsciousnessLiveProviderEndpointNetworkEgressGate();
    if (gate.summary?.credentialValueAccessGateFound !== true) {
      throw new Error("Cloud consciousness live provider endpoint network egress gate requires Phase 60 credential value access gate evidence.");
    }

    const task = findLatestCredentialValueAccessGateTask();
    if (!task) {
      throw new Error("Unable to locate credential-value-gated real launch task for endpoint network egress gate.");
    }

    const recordedAt = new Date().toISOString();
    task.cloudConsciousnessLiveProviderRealLaunch = {
      ...(task.cloudConsciousnessLiveProviderRealLaunch ?? {}),
      implementationStatus: "endpoint_network_egress_gate_recorded",
      endpointNetworkEgressGateRecorded: true,
      endpointNetworkEgressGateRegistry: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_ENDPOINT_NETWORK_EGRESS_GATE_REGISTRY,
      endpointNetworkEgressGateRecordedAt: recordedAt,
      endpointNetworkEgressGateDecision: gate.gate,
      endpointNetworkEgressAuthorized: false,
      endpointNetworkEgressDenied: true,
      credentialValueAccessAuthorized: false,
      credentialValueAccessDenied: true,
      launchAuthorized: false,
      launchExecuted: false,
      credentialValueIncluded: false,
      credentialValueRead: false,
      credentialValueExposed: false,
      providerSdkLoaded: false,
      providerCredentialRead: false,
      endpointContacted: false,
      networkEgress: false,
      providerResponseCreated: false,
      rollbackExecuted: false,
      rollbackCommandCreated: false,
      hostMutation: false,
      transmitsExternally: false,
      liveProviderCallEnabled: false,
    };
    appendTaskPhase(task, "cloud_consciousness_live_provider_endpoint_network_egress_gate", {
      gateRegistry: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_ENDPOINT_NETWORK_EGRESS_GATE_REGISTRY,
      recordedAt,
      sourcePhase: "cloud_consciousness_live_provider_credential_value_access_gate",
      gate: gate.gate,
      nextSlice: "openclaw-cloud-consciousness-live-provider-egress-execution-route-task-preflight",
      endpointNetworkEgressAuthorized: false,
      endpointNetworkEgressDenied: true,
      credentialValueAccessAuthorized: false,
      credentialValueAccessDenied: true,
      launchAuthorized: false,
      launchExecuted: false,
      credentialValueRead: false,
      endpointContacted: false,
      networkEgress: false,
      providerResponseCreated: false,
      rollbackExecuted: false,
      hostMutation: false,
      liveProviderCallEnabled: false,
    });
    completeTask(task, {
      summary: "Endpoint network egress gate recorded; endpoint contact and network egress remain unauthorized.",
      gateRegistry: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_ENDPOINT_NETWORK_EGRESS_GATE_REGISTRY,
      phase: "cloud_consciousness_live_provider_endpoint_network_egress_gate",
      endpointNetworkEgressGateRecorded: true,
      endpointNetworkEgressAuthorized: false,
      endpointNetworkEgressDenied: true,
      credentialValueAccessAuthorized: false,
      credentialValueAccessDenied: true,
      launchAuthorized: false,
      launchExecuted: false,
      credentialValueRead: false,
      endpointContacted: false,
      networkEgress: false,
      providerResponseCreated: false,
      rollbackExecuted: false,
      hostMutation: false,
      liveProviderCallEnabled: false,
    });
    reconcileRuntimeState();
    persistState();
    await publishEvent("task.phase_changed", { task: serialiseTask(task) });

    return {
      ok: true,
      registry: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_ENDPOINT_NETWORK_EGRESS_GATE_REGISTRY,
      mode: "phase_61_live_provider_endpoint_network_egress_gate",
      generatedAt: recordedAt,
      status: "endpoint_network_egress_gate_recorded_denied",
      task,
      gate: await buildCloudConsciousnessLiveProviderEndpointNetworkEgressGate(),
      governance: liveProviderPhaseGovernance.phase61Governance(),
    };
  }

  async function buildCloudConsciousnessLiveProviderEgressExecutionRouteTaskPreflight() {
    const endpointGate = await buildCloudConsciousnessLiveProviderEndpointNetworkEgressGate();
    const endpointGateTask = findLatestEndpointNetworkEgressGateTask();
    const shell = endpointGateTask?.cloudConsciousnessLiveProviderRealLaunch ?? {};
    const preflight = {
      decision: "egress_execution_route_task_not_created",
      preflightState: shell.egressExecutionRouteTaskPreflightRecorded === true ? "recorded_deferred" : "ready_to_record_deferred",
      routeRequirements: [
        "separate approval-gated egress execution task shell",
        "operator authorization naming provider endpoint, method, credential reference, and transcript target",
        "credential value access authorization evidence from a separate future gate",
        "endpoint network egress authorization evidence from a separate future gate",
        "rollback and response handling gates before live provider call enablement",
      ],
      futureTaskType: "cloud_consciousness_live_provider_egress_execution_task",
      egressExecutionTaskCreated: false,
      egressExecutionTaskApproved: false,
      endpointContacted: false,
      networkEgress: false,
      transmitsExternally: false,
      liveProviderCallEnabled: false,
    };
    const checks = [
      {
        id: "phase-61-endpoint-network-egress-gate-recorded",
        label: "Phase 61 endpoint network egress gate evidence is recorded",
        passed: Boolean(endpointGateTask)
          && shell.endpointNetworkEgressGateRecorded === true
          && shell.endpointNetworkEgressGateRegistry === CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_ENDPOINT_NETWORK_EGRESS_GATE_REGISTRY
          && endpointGate.summary?.credentialValueAccessGateFound === true,
        evidence: endpointGateTask?.id ?? null,
      },
      {
        id: "credential-and-egress-still-denied",
        label: "Credential value access and endpoint/network egress remain denied",
        passed: shell.credentialValueAccessAuthorized === false
          && shell.credentialValueAccessDenied === true
          && shell.endpointNetworkEgressAuthorized === false
          && shell.endpointNetworkEgressDenied === true,
        evidence: "credential_and_egress_denied",
      },
      {
        id: "egress-execution-task-not-created",
        label: "Preflight does not create or approve an egress execution task",
        passed: preflight.egressExecutionTaskCreated === false
          && preflight.egressExecutionTaskApproved === false,
        evidence: preflight.decision,
      },
      {
        id: "no-credential-endpoint-or-network-activity",
        label: "Preflight does not read credentials, contact endpoints, transmit externally, or call providers",
        passed: shell.credentialValueRead === false
          && shell.credentialValueIncluded === false
          && shell.credentialValueExposed === false
          && shell.providerCredentialRead === false
          && shell.endpointContacted === false
          && shell.networkEgress === false
          && shell.transmitsExternally === false
          && shell.liveProviderCallEnabled === false,
        evidence: "execution_activity_deferred",
      },
      {
        id: "no-response-rollback-or-host-mutation",
        label: "Preflight does not create provider responses, execute rollback, or mutate host state",
        passed: shell.providerResponseCreated === false
          && shell.rollbackExecuted === false
          && shell.rollbackCommandCreated === false
          && shell.hostMutation === false,
        evidence: "post_call_activity_deferred",
      },
    ];
    const passed = checks.filter((check) => check.passed).length;
    const ready = passed === checks.length;
    return {
      ok: true,
      registry: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_EGRESS_EXECUTION_ROUTE_TASK_PREFLIGHT_REGISTRY,
      mode: "phase_62_live_provider_egress_execution_route_task_preflight",
      generatedAt: new Date().toISOString(),
      status: ready ? "egress_execution_route_task_preflight_ready_deferred" : "waiting_for_phase_61_endpoint_network_egress_gate",
      governance: liveProviderPhaseGovernance.phase62Governance(),
      preflight,
      checks,
      summary: {
        ready,
        complete: ready,
        passed,
        total: checks.length,
        completionPercent: ready ? 100 : Math.round((passed / checks.length) * 100),
        phase: "phase-62",
        egressExecutionRouteTaskPreflightRecorded: shell.egressExecutionRouteTaskPreflightRecorded === true,
        endpointNetworkEgressGateRequired: true,
        endpointNetworkEgressGateFound: Boolean(endpointGateTask),
        sourceTaskId: endpointGateTask?.id ?? null,
        sourceRegistry: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_ENDPOINT_NETWORK_EGRESS_GATE_REGISTRY,
        egressExecutionTaskCreated: false,
        egressExecutionTaskApproved: false,
        credentialValueAccessAuthorized: false,
        credentialValueAccessDenied: true,
        endpointNetworkEgressAuthorized: false,
        endpointNetworkEgressDenied: true,
        credentialValueIncluded: false,
        credentialValueRead: false,
        credentialValueExposed: false,
        providerSdkLoaded: false,
        providerCredentialRead: false,
        endpointContacted: false,
        networkEgress: false,
        providerResponseCreated: false,
        rollbackExecuted: false,
        rollbackCommandCreated: false,
        hostMutation: false,
        transmitsExternally: false,
        liveProviderCallEnabled: false,
        launchAuthorized: false,
        launchExecuted: false,
      },
      evidence: {
        endpointNetworkEgressGate: runtimeAdapterEvidenceRef(endpointGate),
        endpointGateTask: endpointGateTask ? serialiseTask(endpointGateTask) : null,
      },
      next: {
        recommendedSlice: "openclaw-cloud-consciousness-live-provider-egress-execution-task-shell",
        boundary: "credential values, endpoint contact, network egress, provider response creation, rollback execution, host mutation, and live provider calls remain separate future gates",
      },
    };
  }

  async function recordCloudConsciousnessLiveProviderEgressExecutionRouteTaskPreflight({ confirm = false } = {}) {
    if (confirm !== true) {
      throw new Error("Cloud consciousness live provider egress execution route task preflight requires confirm=true.");
    }

    const preflight = await buildCloudConsciousnessLiveProviderEgressExecutionRouteTaskPreflight();
    if (preflight.summary?.endpointNetworkEgressGateFound !== true) {
      throw new Error("Cloud consciousness live provider egress execution route task preflight requires Phase 61 endpoint network egress gate evidence.");
    }

    const task = findLatestEndpointNetworkEgressGateTask();
    if (!task) {
      throw new Error("Unable to locate endpoint-network-egress-gated real launch task for egress execution route task preflight.");
    }

    const recordedAt = new Date().toISOString();
    task.cloudConsciousnessLiveProviderRealLaunch = {
      ...(task.cloudConsciousnessLiveProviderRealLaunch ?? {}),
      implementationStatus: "egress_execution_route_task_preflight_recorded",
      egressExecutionRouteTaskPreflightRecorded: true,
      egressExecutionRouteTaskPreflightRegistry: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_EGRESS_EXECUTION_ROUTE_TASK_PREFLIGHT_REGISTRY,
      egressExecutionRouteTaskPreflightRecordedAt: recordedAt,
      egressExecutionRouteTaskPreflight: preflight.preflight,
      egressExecutionTaskCreated: false,
      egressExecutionTaskApproved: false,
      endpointNetworkEgressAuthorized: false,
      endpointNetworkEgressDenied: true,
      credentialValueAccessAuthorized: false,
      credentialValueAccessDenied: true,
      launchAuthorized: false,
      launchExecuted: false,
      credentialValueIncluded: false,
      credentialValueRead: false,
      credentialValueExposed: false,
      providerSdkLoaded: false,
      providerCredentialRead: false,
      endpointContacted: false,
      networkEgress: false,
      providerResponseCreated: false,
      rollbackExecuted: false,
      rollbackCommandCreated: false,
      hostMutation: false,
      transmitsExternally: false,
      liveProviderCallEnabled: false,
    };
    appendTaskPhase(task, "cloud_consciousness_live_provider_egress_execution_route_task_preflight", {
      preflightRegistry: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_EGRESS_EXECUTION_ROUTE_TASK_PREFLIGHT_REGISTRY,
      recordedAt,
      sourcePhase: "cloud_consciousness_live_provider_endpoint_network_egress_gate",
      preflight: preflight.preflight,
      nextSlice: "openclaw-cloud-consciousness-live-provider-egress-execution-task-shell",
      egressExecutionTaskCreated: false,
      egressExecutionTaskApproved: false,
      endpointNetworkEgressAuthorized: false,
      endpointNetworkEgressDenied: true,
      credentialValueAccessAuthorized: false,
      credentialValueAccessDenied: true,
      launchAuthorized: false,
      launchExecuted: false,
      credentialValueRead: false,
      endpointContacted: false,
      networkEgress: false,
      providerResponseCreated: false,
      rollbackExecuted: false,
      hostMutation: false,
      liveProviderCallEnabled: false,
    });
    completeTask(task, {
      summary: "Egress execution route/task preflight recorded; no egress execution task was created or approved.",
      preflightRegistry: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_EGRESS_EXECUTION_ROUTE_TASK_PREFLIGHT_REGISTRY,
      phase: "cloud_consciousness_live_provider_egress_execution_route_task_preflight",
      egressExecutionRouteTaskPreflightRecorded: true,
      egressExecutionTaskCreated: false,
      egressExecutionTaskApproved: false,
      endpointNetworkEgressAuthorized: false,
      endpointNetworkEgressDenied: true,
      credentialValueAccessAuthorized: false,
      credentialValueAccessDenied: true,
      launchAuthorized: false,
      launchExecuted: false,
      credentialValueRead: false,
      endpointContacted: false,
      networkEgress: false,
      providerResponseCreated: false,
      rollbackExecuted: false,
      hostMutation: false,
      liveProviderCallEnabled: false,
    });
    reconcileRuntimeState();
    persistState();
    await publishEvent("task.phase_changed", { task: serialiseTask(task) });

    return {
      ok: true,
      registry: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_EGRESS_EXECUTION_ROUTE_TASK_PREFLIGHT_REGISTRY,
      mode: "phase_62_live_provider_egress_execution_route_task_preflight",
      generatedAt: recordedAt,
      status: "egress_execution_route_task_preflight_recorded_deferred",
      task,
      preflight: await buildCloudConsciousnessLiveProviderEgressExecutionRouteTaskPreflight(),
      governance: liveProviderPhaseGovernance.phase62Governance(),
    };
  }

  async function createCloudConsciousnessLiveProviderEgressExecutionTask({
    confirm = false,
    liveProviderExecution = null,
  } = {}) {
    if (confirm !== true) {
      throw new Error("Cloud consciousness live provider egress execution task creation requires confirm=true.");
    }

    const preflight = await buildCloudConsciousnessLiveProviderEgressExecutionRouteTaskPreflight();
    if (preflight.summary?.ready !== true
      || preflight.summary?.endpointNetworkEgressGateFound !== true
      || preflight.next?.recommendedSlice !== "openclaw-cloud-consciousness-live-provider-egress-execution-task-shell") {
      throw new Error("Cloud consciousness live provider egress execution task requires a ready Phase 62 route/task preflight.");
    }

    const sourceTask = findLatestEgressExecutionRouteTaskPreflightTask();
    if (!sourceTask) {
      throw new Error("Unable to locate Phase 62 egress execution route/task preflight evidence.");
    }

    let requestBinding = null;
    if (liveProviderExecution?.requested === true) {
      if (liveProviderExecution.requestEnvelope && typeof liveProviderExecution.requestEnvelope === "object") {
        const builtBinding = buildLiveProviderRequestBinding({
          requestEnvelope: liveProviderExecution.requestEnvelope,
          credentialReference: liveProviderExecution.credentialReference,
          responseContract: liveProviderExecution.responseContract ?? null,
          contextContentHash: liveProviderExecution.contextContentHash ?? null,
          sourceTaskId: liveProviderExecution.contextPacket?.requested === true
            ? liveProviderExecution.contextPacket.sourceTaskId ?? null
            : null,
          env: providerEnv,
        });
        if (!builtBinding.ok) {
          throw new Error(`Live provider egress task request binding rejected: ${builtBinding.reason}.`);
        }
        requestBinding = builtBinding.binding;
      } else if (liveProviderExecution.requestBinding) {
        const validatedBinding = validateLiveProviderRequestBinding(liveProviderExecution.requestBinding);
        if (!validatedBinding.ok) {
          throw new Error(`Live provider egress task request binding rejected: ${validatedBinding.reason}.`);
        }
        requestBinding = validatedBinding.binding;
      } else {
        throw new Error("Live provider egress task creation requires a redacted request binding summary.");
      }
    }

    const policyRequest = {
      intent: "cloud_consciousness.live_provider_call.egress_execution_task",
      domain: "cross_boundary",
      risk: "high",
      requiresApproval: true,
      audit: true,
      tags: ["cloud_consciousness", "live_provider_call", "egress_execution", "operator_reviewed"],
    };
    const goal = "Prepare approval-gated live provider egress execution task shell without endpoint contact";
    const policyDecision = evaluatePolicyIntent({
      type: "cloud_consciousness_live_provider_egress_execution_task",
      goal,
      policy: policyRequest,
    }, {
      stage: "cloud_consciousness.live_provider_egress_execution_task.draft",
      type: "cloud_consciousness_live_provider_egress_execution_task",
      goal,
    });

    const task = createTask({
      goal,
      type: "cloud_consciousness_live_provider_egress_execution_task",
      workViewStrategy: "cloud-consciousness-live-provider-egress-execution",
      policy: policyRequest,
      plan: {
        planner: "cloud-consciousness-live-provider-egress-execution-task-v0",
        strategy: "approval-gated-cloud-consciousness-live-provider-egress-execution-shell",
        summary: "Create an approval-gated egress execution task shell while keeping credential values, endpoint contact, network egress, provider responses, rollback execution, host mutation, and live provider calls disabled.",
        approvalBinding: requestBinding,
        governance: liveProviderPhaseGovernance.phase63Governance({ createsTask: true, createsApproval: true, egressExecutionTaskCreated: true }),
        steps: [
          {
            id: "review-egress-route-task-preflight",
            phase: "review_live_provider_egress_execution_route_task_preflight",
            title: "Review Phase 62 route/task preflight evidence",
            status: "pending",
            requiresApproval: false,
          },
          {
            id: "operator-approval",
            phase: "waiting_for_approval",
            title: "Wait for operator approval before any egress execution can be considered",
            status: "pending",
            capabilityId: "act.system.command.dry_run",
            requiresApproval: true,
            risk: "high",
          },
          {
            id: "defer-egress-execution",
            phase: "cloud_consciousness_live_provider_egress_execution_task_shell_deferred",
            title: "Record task shell and defer credential value access, endpoint contact, network egress, response creation, and rollback execution",
            status: "pending",
            requiresApproval: true,
            executesNow: false,
          },
        ],
      },
    }, { skipInitialPolicy: true });

    task.policy = {
      request: policyRequest,
      decision: policyDecision,
    };
    task.cloudConsciousnessLiveProviderEgressExecution = {
      registry: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_EGRESS_EXECUTION_TASK_REGISTRY,
      sourceTaskId: sourceTask.id,
      sourceRegistry: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_EGRESS_EXECUTION_ROUTE_TASK_PREFLIGHT_REGISTRY,
      implementationStatus: "task_shell_only",
      requestBinding,
      requestBindingRequired: liveProviderExecution?.requested === true,
      egressExecutionTaskCreated: true,
      egressExecutionTaskApproved: false,
      egressExecutionDeferred: true,
      credentialValueAccessAuthorized: false,
      credentialValueAccessDenied: true,
      endpointNetworkEgressAuthorized: false,
      endpointNetworkEgressDenied: true,
      launchAuthorized: false,
      launchExecuted: false,
      credentialValueIncluded: false,
      credentialValueRead: false,
      credentialValueExposed: false,
      providerSdkLoaded: false,
      providerCredentialRead: false,
      endpointContacted: false,
      networkEgress: false,
      providerResponseCreated: false,
      rollbackExecuted: false,
      rollbackCommandCreated: false,
      hostMutation: false,
      transmitsExternally: false,
      liveProviderCallEnabled: false,
    };

    const approval = createApprovalRequestForTask(task, policyDecision);
    const reclaimedTasks = supersedeOtherActiveTasks(task.id);
    reconcileRuntimeState();
    persistState();

    await publishEvent("task.created", {
      task: serialiseTask(task),
      planner: "cloud-consciousness-live-provider-egress-execution-task-v0",
    });
    await publishTaskApprovalIfPending(task);
    await publishEvent("task.planned", {
      task: serialiseTask(task),
      plan: task.plan,
    });
    await Promise.all(reclaimedTasks.map((reclaimedTask) => publishEvent("task.phase_changed", {
      task: serialiseTask(reclaimedTask),
    })));

    return {
      ok: true,
      registry: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_EGRESS_EXECUTION_TASK_REGISTRY,
      mode: "approval-gated-cloud-consciousness-live-provider-egress-execution-task",
      generatedAt: new Date().toISOString(),
      sourceRegistry: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_EGRESS_EXECUTION_ROUTE_TASK_PREFLIGHT_REGISTRY,
      sourceTaskId: sourceTask.id,
      preflight,
      task,
      approval,
      governance: liveProviderPhaseGovernance.phase63Governance({ createsTask: true, createsApproval: true, egressExecutionTaskCreated: true }),
    };
  }

  function isCloudConsciousnessLiveProviderEgressExecutionTask(task) {
    return task?.type === "cloud_consciousness_live_provider_egress_execution_task"
      && task?.cloudConsciousnessLiveProviderEgressExecution?.registry
        === CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_EGRESS_EXECUTION_TASK_REGISTRY;
  }

  function findLatestApprovedDeferredEgressExecutionTask() {
    const candidates = (typeof listTasks === "function" ? listTasks() : [])
      .filter((task) => {
        const shell = task?.cloudConsciousnessLiveProviderEgressExecution ?? {};
        return isCloudConsciousnessLiveProviderEgressExecutionTask(task)
          && task.status === "completed"
          && (shell.implementationStatus === "deferred_after_approval"
            || shell.implementationStatus === "credential_value_local_read_final_readiness_preflight_recorded")
          && shell.egressExecutionTaskCreated === true
          && shell.egressExecutionTaskApproved === true
          && shell.egressExecutionDeferred === true
          && shell.credentialValueAccessAuthorized === false
          && shell.credentialValueAccessDenied === true
          && shell.endpointNetworkEgressAuthorized === false
          && shell.endpointNetworkEgressDenied === true
          && shell.launchAuthorized === false
          && shell.launchExecuted === false
          && shell.credentialValueRead === false
          && shell.endpointContacted === false
          && shell.networkEgress === false
          && shell.providerResponseCreated === false
          && shell.rollbackExecuted === false
          && shell.hostMutation === false
          && shell.liveProviderCallEnabled === false
          && task.outcome?.details?.phase === "cloud_consciousness_live_provider_egress_execution_task_shell_deferred";
      })
      .sort((a, b) => String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")));
    return candidates[0]?.id ? getTaskById(candidates[0].id) ?? candidates[0] : null;
  }

  async function buildCloudConsciousnessLiveProviderEgressExecutionApprovedDeferred() {
    const task = findLatestApprovedDeferredEgressExecutionTask();
    const shell = task?.cloudConsciousnessLiveProviderEgressExecution ?? {};
    const checks = [
      {
        id: "egress-execution-task-shell-approved",
        label: "Egress execution task shell was approved by operator governance",
        passed: Boolean(task)
          && shell.egressExecutionTaskCreated === true
          && shell.egressExecutionTaskApproved === true
          && task.approval?.status === "approved",
        evidence: task?.approval?.requestId ?? null,
      },
      {
        id: "egress-execution-remains-deferred",
        label: "Approved egress execution shell remains deferred",
        passed: shell.implementationStatus === "deferred_after_approval"
          && shell.egressExecutionDeferred === true
          && task?.outcome?.details?.phase === "cloud_consciousness_live_provider_egress_execution_task_shell_deferred",
        evidence: task?.outcome?.details?.phase ?? null,
      },
      {
        id: "credential-and-egress-still-denied",
        label: "Credential value access and endpoint/network egress remain denied",
        passed: shell.credentialValueAccessAuthorized === false
          && shell.credentialValueAccessDenied === true
          && shell.endpointNetworkEgressAuthorized === false
          && shell.endpointNetworkEgressDenied === true,
        evidence: "approved_deferred_without_authorization",
      },
      {
        id: "no-endpoint-network-or-live-call",
        label: "Approved deferred evidence has no endpoint contact, network egress, or live provider call",
        passed: shell.endpointContacted === false
          && shell.networkEgress === false
          && shell.transmitsExternally === false
          && shell.liveProviderCallEnabled === false,
        evidence: "no_network_activity",
      },
      {
        id: "no-response-rollback-or-host-mutation",
        label: "Approved deferred evidence has no provider response, rollback execution, or host mutation",
        passed: shell.providerResponseCreated === false
          && shell.rollbackExecuted === false
          && shell.rollbackCommandCreated === false
          && shell.hostMutation === false,
        evidence: "post_call_activity_deferred",
      },
    ];
    const passed = checks.filter((check) => check.passed).length;
    const ready = passed === checks.length;
    return {
      ok: true,
      registry: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_EGRESS_EXECUTION_APPROVED_DEFERRED_REGISTRY,
      mode: "phase_64_live_provider_egress_execution_approved_deferred",
      generatedAt: new Date().toISOString(),
      status: ready ? "egress_execution_approved_deferred_ready" : "waiting_for_phase_63_approved_deferred_task_shell",
      governance: liveProviderPhaseGovernance.phase64Governance(),
      checks,
      summary: {
        ready,
        complete: ready,
        passed,
        total: checks.length,
        completionPercent: ready ? 100 : Math.round((passed / checks.length) * 100),
        phase: "phase-64",
        approvedDeferredEvidenceFound: Boolean(task),
        sourceTaskId: task?.id ?? null,
        sourceRegistry: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_EGRESS_EXECUTION_TASK_REGISTRY,
        egressExecutionTaskCreated: shell.egressExecutionTaskCreated === true,
        egressExecutionTaskApproved: shell.egressExecutionTaskApproved === true,
        egressExecutionDeferred: shell.egressExecutionDeferred === true,
        credentialValueAccessAuthorized: false,
        credentialValueAccessDenied: true,
        endpointNetworkEgressAuthorized: false,
        endpointNetworkEgressDenied: true,
        credentialValueIncluded: false,
        credentialValueRead: false,
        credentialValueExposed: false,
        providerSdkLoaded: false,
        providerCredentialRead: false,
        endpointContacted: false,
        networkEgress: false,
        providerResponseCreated: false,
        rollbackExecuted: false,
        rollbackCommandCreated: false,
        hostMutation: false,
        transmitsExternally: false,
        liveProviderCallEnabled: false,
        launchAuthorized: false,
        launchExecuted: false,
      },
      evidence: {
        approvedDeferredTask: task ? serialiseTask(task) : null,
      },
      next: {
        recommendedSlice: "openclaw-cloud-consciousness-live-provider-credential-value-authorization-route",
        boundary: "credential values, endpoint contact, network egress, provider response creation, rollback execution, host mutation, and live provider calls remain separate future gates",
      },
    };
  }


  async function executeCloudConsciousnessLiveProviderEgressExecutionTask(task, options = {}) {
    const approval = task.approval?.requestId ? approvals.get(task.approval.requestId) : null;
    if (approval?.status !== "approved") {
      return {
        blocked: true,
        reason: "approval_required",
        task,
        approval: approval ? { ...approval } : null,
      };
    }

    if (options.liveProviderExecution?.requested === true) {
      if (typeof executeGovernedLiveProviderRequest !== "function") {
        return {
          blocked: true,
          reason: "live_provider_execution_not_wired",
          task,
          approval: { ...approval },
        };
      }
      return executeGovernedLiveProviderRequest({
        task,
        options,
        approvals,
        appendTaskPhase,
        completeTask,
        failTask,
        reconcileRuntimeState,
        persistState,
        publishEvent,
        serialiseTask,
      });
    }

    const recordedAt = new Date().toISOString();
    task.cloudConsciousnessLiveProviderEgressExecution = {
      ...(task.cloudConsciousnessLiveProviderEgressExecution ?? {}),
      implementationStatus: "deferred_after_approval",
      approvedAt: approval.updatedAt,
      egressExecutionTaskCreated: true,
      egressExecutionTaskApproved: true,
      egressExecutionDeferred: true,
      credentialValueAccessAuthorized: false,
      credentialValueAccessDenied: true,
      endpointNetworkEgressAuthorized: false,
      endpointNetworkEgressDenied: true,
      launchAuthorized: false,
      launchExecuted: false,
      credentialValueIncluded: false,
      credentialValueRead: false,
      credentialValueExposed: false,
      providerSdkLoaded: false,
      providerCredentialRead: false,
      endpointContacted: false,
      networkEgress: false,
      providerResponseCreated: false,
      rollbackExecuted: false,
      rollbackCommandCreated: false,
      hostMutation: false,
      transmitsExternally: false,
      liveProviderCallEnabled: false,
    };
    appendTaskPhase(task, "cloud_consciousness_live_provider_egress_execution_task_shell_deferred", {
      taskRegistry: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_EGRESS_EXECUTION_TASK_REGISTRY,
      recordedAt,
      sourcePhase: "cloud_consciousness_live_provider_egress_execution_route_task_preflight",
      deferredSlice: "openclaw-cloud-consciousness-live-provider-egress-execution-approved-deferred",
      reason: "egress execution task shell approved; credential value access, endpoint contact, network egress, provider response creation, rollback execution, and live provider call remain deferred",
      egressExecutionTaskCreated: true,
      egressExecutionTaskApproved: true,
      egressExecutionDeferred: true,
      credentialValueAccessAuthorized: false,
      credentialValueAccessDenied: true,
      endpointNetworkEgressAuthorized: false,
      endpointNetworkEgressDenied: true,
      launchAuthorized: false,
      launchExecuted: false,
      credentialValueRead: false,
      endpointContacted: false,
      networkEgress: false,
      providerResponseCreated: false,
      rollbackExecuted: false,
      hostMutation: false,
      liveProviderCallEnabled: false,
    });
    completeTask(task, {
      summary: "Approved egress execution task shell recorded; endpoint contact and network egress remain deferred.",
      taskRegistry: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_EGRESS_EXECUTION_TASK_REGISTRY,
      phase: "cloud_consciousness_live_provider_egress_execution_task_shell_deferred",
      egressExecutionTaskCreated: true,
      egressExecutionTaskApproved: true,
      egressExecutionDeferred: true,
      credentialValueAccessAuthorized: false,
      credentialValueAccessDenied: true,
      endpointNetworkEgressAuthorized: false,
      endpointNetworkEgressDenied: true,
      launchAuthorized: false,
      launchExecuted: false,
      credentialValueRead: false,
      endpointContacted: false,
      networkEgress: false,
      providerResponseCreated: false,
      rollbackExecuted: false,
      hostMutation: false,
      liveProviderCallEnabled: false,
    });
    reconcileRuntimeState();
    persistState();
    await publishEvent("task.phase_changed", { task: serialiseTask(task) });

    return {
      ok: true,
      executor: "cloud-consciousness-live-provider-egress-execution-task-v0",
      status: "egress_execution_task_shell_deferred_after_approval",
      task,
      governance: liveProviderPhaseGovernance.phase63Governance({
        createsTask: true,
        createsApproval: true,
        egressExecutionTaskCreated: true,
        egressExecutionTaskApproved: true,
      }),
      summary: {
        ready: true,
        implementationStatus: "deferred_after_approval",
        egressExecutionTaskCreated: true,
        egressExecutionTaskApproved: true,
        egressExecutionDeferred: true,
        credentialValueAccessAuthorized: false,
        credentialValueAccessDenied: true,
        endpointNetworkEgressAuthorized: false,
        endpointNetworkEgressDenied: true,
        launchAuthorized: false,
        launchExecuted: false,
        credentialValueIncluded: false,
        credentialValueRead: false,
        credentialValueExposed: false,
        endpointContacted: false,
        networkEgress: false,
        providerResponseCreated: false,
        rollbackExecuted: false,
        hostMutation: false,
        liveProviderCallEnabled: false,
      },
    };
  }






  return {
    buildCloudConsciousnessLiveProviderCredentialValueAccessGate,
    recordCloudConsciousnessLiveProviderCredentialValueAccessGate,
    buildCloudConsciousnessLiveProviderEndpointNetworkEgressGate,
    recordCloudConsciousnessLiveProviderEndpointNetworkEgressGate,
    buildCloudConsciousnessLiveProviderEgressExecutionRouteTaskPreflight,
    recordCloudConsciousnessLiveProviderEgressExecutionRouteTaskPreflight,
    createCloudConsciousnessLiveProviderEgressExecutionTask,
    isCloudConsciousnessLiveProviderEgressExecutionTask,
    executeCloudConsciousnessLiveProviderEgressExecutionTask,
    buildCloudConsciousnessLiveProviderEgressExecutionApprovedDeferred,
  };
}
