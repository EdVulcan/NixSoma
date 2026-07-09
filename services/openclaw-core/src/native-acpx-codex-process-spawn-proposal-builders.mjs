import { createHash } from "node:crypto";

export const NATIVE_ACPX_CODEX_BRIDGE_PROCESS_SPAWN_PROPOSAL_REGISTRY = "openclaw-native-acpx-codex-bridge-process-spawn-proposal-v0";

function nowIso() {
  return new Date().toISOString();
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function selectWrapperWriteEvidence(wrapperWriteExecutionEvidence, taskId = null) {
  const evidence = Array.isArray(wrapperWriteExecutionEvidence?.evidence)
    ? wrapperWriteExecutionEvidence.evidence
    : [];
  return evidence.find((item) => {
    if (taskId && item?.taskId !== taskId) {
      return false;
    }
    return item?.validation?.ok === true
      && item?.wrapper?.registry === "openclaw-native-acpx-codex-bridge-wrapper-write-task-v0";
  }) ?? null;
}

export function buildNativeAcpxCodexBridgeProcessSpawnProposal({
  wrapperWriteExecutionEvidence = null,
  taskId = null,
} = {}) {
  const generatedAt = nowIso();
  const selectedEvidence = selectWrapperWriteEvidence(wrapperWriteExecutionEvidence, taskId);
  const readyForSpawnApprovalDesign = selectedEvidence !== null
    && wrapperWriteExecutionEvidence?.recoveryRecommendation?.needed !== true;
  const wrapperRelativePath = selectedEvidence?.wrapper?.target?.relativePath ?? null;
  const proposalId = `acpx-codex-process-spawn-${sha256(`${selectedEvidence?.taskId ?? "none"}:${wrapperRelativePath ?? "missing"}`).slice(0, 12)}`;
  const recoveryRecommendation = selectedEvidence
    ? wrapperWriteExecutionEvidence?.recoveryRecommendation ?? {
        needed: false,
        status: "not_needed",
        recommendedNextAction: "continue_to_process_spawn_approval_design",
        createsTask: false,
      }
    : {
        needed: true,
        status: "missing_wrapper_write_evidence",
        recommendedNextAction: "create_and_approve_wrapper_write_task_before_process_spawn_design",
        createsTask: false,
      };

  return {
    ok: true,
    registry: NATIVE_ACPX_CODEX_BRIDGE_PROCESS_SPAWN_PROPOSAL_REGISTRY,
    mode: "proposal-only-acpx-codex-bridge-process-spawn-contract",
    generatedAt,
    identityLevel: "Level 1: stable user-space control plane",
    sourceCapability: {
      sourceFiles: [
        "extensions/acpx/src/codex-auth-bridge.ts",
        "extensions/acpx/src/codex-auth-bridge.test.ts",
      ],
      migrationMode: "native_process_spawn_contract_without_execution_or_auth_copy",
    },
    capability: {
      id: "plan.openclaw.acpx_codex_bridge.process_spawn",
      risk: "high",
      approvalRequired: false,
      futureExecutionCapabilityId: "act.system.command.execute",
      runtimeOwner: "openclaw_on_nixos",
    },
    proposal: {
      id: proposalId,
      capabilityId: "plan.openclaw.acpx_codex_bridge.process_spawn",
      status: readyForSpawnApprovalDesign ? "ready_for_spawn_approval_design" : "blocked_missing_approved_wrapper_write_evidence",
      selectedWrapperWriteTaskId: selectedEvidence?.taskId ?? taskId,
      selectedInvocationId: selectedEvidence?.invocationId ?? null,
      wrapper: {
        relativePath: wrapperRelativePath,
        ledgerPath: selectedEvidence?.path ?? null,
        contentHash: selectedEvidence?.wrapper?.target?.contentHash ?? null,
        contentPreviewBytes: selectedEvidence?.wrapper?.target?.contentPreviewBytes ?? null,
        contentPreviewExposed: false,
        chmodApplied: selectedEvidence?.wrapper?.target?.chmodApplied === true,
      },
      commandContract: {
        futureCapabilityId: "act.system.command.execute",
        futureApprovalRequired: true,
        launchesWrapperWithNode: true,
        commandName: "node",
        argsCount: wrapperRelativePath ? 1 : 0,
        argsExposed: false,
        stdio: "inherit",
        shell: false,
        commandExecuted: false,
        processSpawned: false,
      },
      preconditions: {
        wrapperWriteEvidenceRequired: true,
        wrapperWriteEvidenceRegistry: wrapperWriteExecutionEvidence?.registry ?? null,
        wrapperWriteEvidenceOk: selectedEvidence?.validation?.ok === true,
        filesystemLedgerRequired: true,
        filesystemLedgerObserved: Boolean(selectedEvidence?.invocationId),
        recoveryRecommendationStatus: wrapperWriteExecutionEvidence?.recoveryRecommendation?.status ?? null,
        credentialValueRead: false,
        authMaterialCopied: false,
      },
    },
    readinessGates: [
      {
        id: "approved-wrapper-write-evidence",
        status: selectedEvidence ? "passed" : "blocked",
        evidence: selectedEvidence?.taskId ?? "missing",
      },
      {
        id: "filesystem-ledger",
        status: selectedEvidence?.invocationId ? "passed" : "blocked",
        evidence: selectedEvidence?.invocationId ?? "missing",
      },
      {
        id: "process-spawn-boundary",
        status: "deferred",
        futureCapabilityId: "act.system.command.execute",
        commandExecuted: false,
        processSpawned: false,
      },
      {
        id: "auth-copy-boundary",
        status: "deferred",
        credentialValueRead: false,
        authMaterialCopied: false,
      },
    ],
    summary: {
      readyForSpawnApprovalDesign,
      selectedWrapperWriteTaskId: selectedEvidence?.taskId ?? null,
      selectedInvocationId: selectedEvidence?.invocationId ?? null,
      wrapperEvidencePassed: selectedEvidence?.validation?.ok === true,
      commandExecuted: false,
      processSpawned: false,
      credentialValueRead: false,
      authMaterialCopied: false,
      providerCalled: false,
      networkUsed: false,
    },
    governance: {
      canBuildProcessSpawnProposal: true,
      createsTask: false,
      createsApproval: false,
      canApproveTask: false,
      canExecuteOperatorStep: false,
      canReadCredentialValue: false,
      canCopyAuthMaterial: false,
      canChmodWrapper: false,
      canExecuteWrapper: false,
      canSpawnCodexAcp: false,
      canCallProvider: false,
      canUseNetwork: false,
      futureProcessSpawnRequiresApproval: true,
      observerVisible: true,
    },
    auditEvidence: {
      operation: "acpx_codex_bridge_process_spawn_proposal",
      capabilityId: "plan.openclaw.acpx_codex_bridge.process_spawn",
      generatedAt,
      persisted: false,
      evidenceKind: "proposal_embedded_audit_evidence",
    },
    recoveryRecommendation,
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
      "no task or approval creation in this proposal route",
    ],
  };
}
