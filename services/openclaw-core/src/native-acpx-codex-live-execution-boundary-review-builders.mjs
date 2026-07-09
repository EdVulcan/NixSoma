export const NATIVE_ACPX_CODEX_LIVE_EXECUTION_BOUNDARY_REVIEW_REGISTRY = "openclaw-native-acpx-codex-live-execution-boundary-review-v0";

function findTask(tasks, taskId) {
  if (!taskId) {
    return null;
  }
  if (tasks instanceof Map) {
    return tasks.get(taskId) ?? null;
  }
  if (Array.isArray(tasks)) {
    return tasks.find((task) => task?.id === taskId) ?? null;
  }
  return null;
}

function latestProcessSpawnTask(tasks) {
  const values = tasks instanceof Map ? [...tasks.values()] : Array.isArray(tasks) ? tasks : [];
  return values
    .filter((task) => task?.nativeAcpxCodexBridgeProcessSpawn)
    .sort((left, right) => String(right.updatedAt ?? right.closedAt ?? "").localeCompare(String(left.updatedAt ?? left.closedAt ?? "")))[0] ?? null;
}

export function buildNativeAcpxCodexLiveExecutionBoundaryReview({
  tasks = new Map(),
  taskId = null,
} = {}) {
  const task = taskId ? findTask(tasks, taskId) : latestProcessSpawnTask(tasks);
  const processSpawn = task?.nativeAcpxCodexBridgeProcessSpawn ?? null;
  const preflight = processSpawn?.execution ?? null;
  const generatedAt = new Date().toISOString();
  const preflightReady = task?.status === "completed"
    && preflight?.wrapper?.exists === true
    && preflight?.wrapper?.hashMatches === true
    && preflight?.command?.nodeRuntimeAvailable === true;
  const blockers = [
    !preflightReady ? "missing_completed_process_spawn_preflight" : null,
    "live_process_spawn_not_authorized",
    "codex_auth_copy_not_authorized",
    "provider_or_network_egress_not_authorized",
  ].filter(Boolean);

  return {
    ok: true,
    registry: NATIVE_ACPX_CODEX_LIVE_EXECUTION_BOUNDARY_REVIEW_REGISTRY,
    mode: "blocked-live-acpx-codex-process-execution-boundary-review",
    generatedAt,
    identityLevel: "Level 1: stable user-space control plane",
    capability: {
      id: "govern.openclaw.acpx_codex_bridge.live_execution_boundary_review",
      risk: "high",
      approvalRequired: false,
      runtimeOwner: "openclaw_on_nixos",
    },
    query: {
      taskId,
      selectedTaskId: task?.id ?? null,
    },
    decision: {
      status: "blocked",
      reason: blockers[0] ?? "live_execution_boundary_not_selected",
      blockers,
      canProceedToLiveSpawn: false,
    },
    preflight: preflight ? {
      taskId: task.id,
      taskStatus: task.status,
      registry: preflight.registry ?? null,
      wrapper: {
        relativePath: preflight.wrapper?.relativePath ?? null,
        exists: preflight.wrapper?.exists === true,
        hashMatches: preflight.wrapper?.hashMatches === true,
        contentPreviewExposed: preflight.wrapper?.contentPreviewExposed === true,
      },
      command: {
        commandName: preflight.command?.commandName ?? null,
        argsExposed: preflight.command?.argsExposed === true,
        nodeRuntimeAvailable: preflight.command?.nodeRuntimeAvailable === true,
        commandExecuted: preflight.command?.commandExecuted === true,
        processSpawned: preflight.command?.processSpawned === true,
      },
    } : null,
    requiredAuthorizations: {
      liveProcessSpawn: false,
      codexAuthCopy: false,
      chmodWrapper: false,
      providerEgress: false,
      networkEgress: false,
    },
    governance: {
      canReadTaskMetadata: true,
      canCreateTask: false,
      canCreateApproval: false,
      canApproveTask: false,
      canExecuteOperatorStep: false,
      canReadCredentialValue: false,
      canCopyAuthMaterial: false,
      canChmodWrapper: false,
      canExecuteWrapper: false,
      canSpawnCodexAcp: false,
      canCallProvider: false,
      canUseNetwork: false,
      canMutate: false,
      observerVisible: true,
    },
    auditEvidence: {
      operation: "acpx_codex_live_execution_boundary_review",
      capabilityId: "govern.openclaw.acpx_codex_bridge.live_execution_boundary_review",
      generatedAt,
      persisted: false,
      evidenceKind: "response_embedded_audit_evidence",
    },
    deferredExecutionBoundaries: [
      "no CODEX_HOME read",
      "no auth.json or config.toml read",
      "no auth material copy",
      "no chmod",
      "no wrapper execution",
      "no npx or npx.cmd execution",
      "no ACP/Codex process spawn",
      "no provider call",
      "no network egress",
      "no task or approval creation in this boundary review",
    ],
  };
}
