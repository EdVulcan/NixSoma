import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { createEventName } from "../../../packages/shared-events/src/event-factory.mjs";
import {
  isNativeAcpxCodexBridgeProcessSpawnTask,
  isNativeAcpxCodexBridgeWrapperTask,
} from "./task-recovery.mjs";

export const NATIVE_ACPX_CODEX_BRIDGE_WRAPPER_EXECUTION_REGISTRY = "openclaw-native-acpx-codex-bridge-wrapper-task-execution-v0";
export const NATIVE_ACPX_CODEX_BRIDGE_PROCESS_SPAWN_PREFLIGHT_REGISTRY = "openclaw-native-acpx-codex-bridge-process-spawn-preflight-v0";

function isApproved(task, approvals) {
  const approval = task?.approval?.requestId ? approvals.get(task.approval.requestId) : null;
  return task?.policy?.decision?.approved === true
    || task?.policy?.request?.approved === true
    || task?.approval?.status === "approved"
    || approval?.status === "approved";
}

function buildWrapperExecutionRecord({ task, draft, approval }) {
  const generatedAt = new Date().toISOString();
  return {
    registry: NATIVE_ACPX_CODEX_BRIDGE_WRAPPER_EXECUTION_REGISTRY,
    mode: "approval-gated-acpx-codex-bridge-wrapper-approved-deferred",
    generatedAt,
    taskId: task.id,
    approvalId: approval?.id ?? task.approval?.requestId ?? null,
    approved: true,
    sourceDraft: {
      registry: draft?.registry ?? null,
      proposalId: draft?.proposal?.id ?? null,
      status: draft?.proposal?.status ?? null,
      readyForApprovalBridge: draft?.summary?.readyForApprovalBridge === true,
    },
    wrapper: {
      relativePath: draft?.proposal?.wrapper?.relativePath ?? null,
      wrapperWritten: false,
      contentPreviewExposed: false,
    },
    command: {
      command: draft?.proposal?.command?.command ?? null,
      args: draft?.proposal?.command?.args ?? [],
      commandExecuted: false,
      processSpawned: false,
    },
    governance: {
      mode: "acpx_codex_bridge_wrapper_action_approved_deferred",
      runtimeOwner: "openclaw_on_nixos",
      canReadCredentialValue: false,
      canCopyAuthMaterial: false,
      canWriteWrapper: false,
      canExecuteWrapper: false,
      canSpawnCodexAcp: false,
      canCallProvider: false,
      canUseNetwork: false,
      taskCreated: true,
      approvalCreated: true,
      approved: true,
      executed: false,
    },
    auditEvidence: {
      operation: "acpx_codex_bridge_wrapper_action_approved_deferred",
      capabilityId: "act.openclaw.acpx_codex_bridge.wrapper_action",
      approved: true,
      generatedAt,
      persisted: true,
      evidenceKind: "task_outcome_embedded_audit_evidence",
    },
  };
}

function sha256File(filePath) {
  return `sha256:${createHash("sha256").update(readFileSync(filePath)).digest("hex")}`;
}

function safeFilePreflight(filePath, expectedHash) {
  if (typeof filePath !== "string" || !filePath.trim()) {
    return {
      path: null,
      exists: false,
      isFile: false,
      bytes: null,
      hash: null,
      hashMatches: false,
      error: "missing_wrapper_ledger_path",
    };
  }
  try {
    const exists = existsSync(filePath);
    const stat = exists ? statSync(filePath) : null;
    const isFile = stat?.isFile() === true;
    const hash = isFile ? sha256File(filePath) : null;
    return {
      path: filePath,
      exists,
      isFile,
      bytes: stat?.size ?? null,
      hash,
      hashMatches: Boolean(expectedHash && hash === expectedHash),
      error: null,
    };
  } catch (error) {
    return {
      path: filePath,
      exists: false,
      isFile: false,
      bytes: null,
      hash: null,
      hashMatches: false,
      error: error instanceof Error ? error.message : "wrapper_preflight_failed",
    };
  }
}

function buildProcessSpawnPreflightRecord({ task, proposal, approval }) {
  const generatedAt = new Date().toISOString();
  const wrapper = proposal?.proposal?.wrapper ?? {};
  const file = safeFilePreflight(wrapper.ledgerPath, wrapper.contentHash);
  return {
    registry: NATIVE_ACPX_CODEX_BRIDGE_PROCESS_SPAWN_PREFLIGHT_REGISTRY,
    mode: "approval-gated-acpx-codex-bridge-process-spawn-preflight-only",
    generatedAt,
    taskId: task.id,
    approvalId: approval?.id ?? task.approval?.requestId ?? null,
    approved: true,
    sourceProposal: {
      registry: proposal?.registry ?? null,
      proposalId: proposal?.proposal?.id ?? null,
      status: proposal?.proposal?.status ?? null,
      readyForSpawnApprovalDesign: proposal?.summary?.readyForSpawnApprovalDesign === true,
    },
    wrapper: {
      relativePath: wrapper.relativePath ?? null,
      ledgerPath: wrapper.ledgerPath ?? null,
      contentHash: wrapper.contentHash ?? null,
      contentPreviewExposed: false,
      exists: file.exists,
      isFile: file.isFile,
      bytes: file.bytes,
      hash: file.hash,
      hashMatches: file.hashMatches,
      chmodApplied: wrapper.chmodApplied === true,
      preflightError: file.error,
    },
    command: {
      futureCapabilityId: proposal?.proposal?.commandContract?.futureCapabilityId ?? "act.system.command.execute",
      commandName: proposal?.proposal?.commandContract?.commandName ?? "node",
      argsCount: proposal?.proposal?.commandContract?.argsCount ?? 0,
      argsExposed: false,
      nodeRuntimePath: process.execPath,
      nodeRuntimeAvailable: Boolean(process.execPath),
      commandExecuted: false,
      processSpawned: false,
    },
    governance: {
      mode: "acpx_codex_bridge_process_spawn_preflight_only",
      runtimeOwner: "openclaw_on_nixos",
      canReadCredentialValue: false,
      canCopyAuthMaterial: false,
      canChmodWrapper: false,
      canExecuteWrapper: false,
      canSpawnCodexAcp: false,
      canCallProvider: false,
      canUseNetwork: false,
      taskCreated: true,
      approvalCreated: true,
      approved: true,
      executed: false,
    },
    auditEvidence: {
      operation: "acpx_codex_bridge_process_spawn_preflight",
      capabilityId: "act.openclaw.acpx_codex_bridge.process_spawn_preflight",
      approved: true,
      generatedAt,
      persisted: true,
      evidenceKind: "task_outcome_embedded_audit_evidence",
    },
  };
}

export function createNativeAcpxCodexBridgeTaskHandlers({
  state,
  taskManager,
  approvalEngine,
  policyEvaluator,
  planBuilder,
  publishEvent,
}) {
  const { approvals } = state;
  const { serialiseTask, isActiveTask, setTaskPhase, completeTask } = taskManager;
  const { serialiseApproval } = approvalEngine;
  const { ensureTaskPolicy } = policyEvaluator;

  async function executeNativeAcpxCodexBridgeWrapperTask(task) {
    if (!isActiveTask(task)) {
      throw new Error("ACPX/Codex bridge wrapper task is not active.");
    }

    const policy = ensureTaskPolicy(task, { stage: "acpx_codex_bridge.wrapper_action.execute" });
    await publishEvent(createEventName("policy.evaluated"), { task: serialiseTask(task), policy: policy.decision });
    const approval = task.approval?.requestId ? approvals.get(task.approval.requestId) : null;
    if (!isApproved(task, approvals)) {
      const waitingTask = await setTaskPhase(task, "waiting_for_approval", {
        status: "queued",
        details: {
          executor: "acpx-codex-bridge-wrapper-action-v0",
          reason: "policy_requires_approval",
          approvalId: approval?.id ?? task.approval?.requestId ?? null,
          canWriteWrapper: false,
          canSpawnCodexAcp: false,
        },
      });
      await publishEvent(createEventName("task.blocked"), {
        task: serialiseTask(waitingTask),
        reason: "policy_requires_approval",
        executor: "acpx-codex-bridge-wrapper-action-v0",
      });
      return {
        task: waitingTask,
        blocked: true,
        reason: "policy_requires_approval",
        actions: [],
        capabilityInvocations: [],
        commandTranscript: [],
        verification: null,
        policy: policy.decision,
        approval: approval ? serialiseApproval(approval) : null,
        governance: {
          mode: "acpx_codex_bridge_wrapper_waiting_for_approval",
          executed: false,
          canReadCredentialValue: false,
          canCopyAuthMaterial: false,
          canWriteWrapper: false,
          canExecuteWrapper: false,
          canSpawnCodexAcp: false,
          canCallProvider: false,
          canUseNetwork: false,
        },
      };
    }

    await setTaskPhase(task, "approved_deferred_boundary", {
      status: "running",
      details: {
        executor: "acpx-codex-bridge-wrapper-action-v0",
        approvalId: approval?.id ?? task.approval?.requestId ?? null,
        canReadCredentialValue: false,
        canWriteWrapper: false,
        canSpawnCodexAcp: false,
      },
    });
    const metadata = task.nativeAcpxCodexBridgeWrapper ?? {};
    const draft = planBuilder.buildNativeAcpxCodexBridgeWrapperDraft({
      sessionKey: metadata.sessionKey ?? null,
      command: metadata.command ?? null,
      wrapperName: metadata.wrapperName ?? null,
    });
    const execution = buildWrapperExecutionRecord({ task, draft, approval });
    task.nativeAcpxCodexBridgeWrapper = {
      ...metadata,
      registry: metadata.registry ?? "openclaw-native-acpx-codex-bridge-wrapper-task-v0",
      mode: metadata.mode ?? "approval-gated-acpx-codex-bridge-wrapper-task",
      wrapperDraft: draft,
      execution,
      governance: {
        ...(metadata.governance ?? {}),
        executed: false,
        canReadCredentialValue: false,
        canCopyAuthMaterial: false,
        canWriteWrapper: false,
        canExecuteWrapper: false,
        canSpawnCodexAcp: false,
        canCallProvider: false,
        canUseNetwork: false,
      },
    };
    const completedTask = completeTask(task, {
      executor: "acpx-codex-bridge-wrapper-action-v0",
      summary: "ACPX/Codex bridge wrapper action approved and recorded as deferred.",
      acpxCodexBridgeWrapperExecution: execution,
      verification: {
        ok: true,
        checks: [
          {
            name: "wrapper_write_deferred",
            ok: execution.governance.canWriteWrapper === false,
            expected: false,
            actual: execution.governance.canWriteWrapper,
          },
          {
            name: "process_spawn_deferred",
            ok: execution.governance.canSpawnCodexAcp === false,
            expected: false,
            actual: execution.governance.canSpawnCodexAcp,
          },
          {
            name: "credential_value_read_blocked",
            ok: execution.governance.canReadCredentialValue === false,
            expected: false,
            actual: execution.governance.canReadCredentialValue,
          },
          {
            name: "network_egress_blocked",
            ok: execution.governance.canUseNetwork === false,
            expected: false,
            actual: execution.governance.canUseNetwork,
          },
        ],
      },
    });
    await publishEvent(createEventName("task.completed"), {
      task: serialiseTask(completedTask),
      executor: "acpx-codex-bridge-wrapper-action-v0",
      acpxCodexBridgeWrapperExecution: execution,
    });

    return {
      task: completedTask,
      blocked: false,
      reason: null,
      actions: [],
      capabilityInvocations: [],
      commandTranscript: [],
      verification: completedTask.outcome?.details?.verification ?? null,
      execution,
      policy: policy.decision,
      approval: approval ? serialiseApproval(approval) : null,
      governance: execution.governance,
    };
  }

  async function executeNativeAcpxCodexBridgeProcessSpawnTask(task) {
    if (!isActiveTask(task)) {
      throw new Error("ACPX/Codex bridge process-spawn task is not active.");
    }

    const policy = ensureTaskPolicy(task, { stage: "acpx_codex_bridge.process_spawn.execute" });
    await publishEvent(createEventName("policy.evaluated"), { task: serialiseTask(task), policy: policy.decision });
    const approval = task.approval?.requestId ? approvals.get(task.approval.requestId) : null;
    if (!isApproved(task, approvals)) {
      const waitingTask = await setTaskPhase(task, "waiting_for_approval", {
        status: "queued",
        details: {
          executor: "acpx-codex-bridge-process-spawn-v0",
          reason: "policy_requires_approval",
          approvalId: approval?.id ?? task.approval?.requestId ?? null,
          canExecuteWrapper: false,
          canSpawnCodexAcp: false,
        },
      });
      await publishEvent(createEventName("task.blocked"), {
        task: serialiseTask(waitingTask),
        reason: "policy_requires_approval",
        executor: "acpx-codex-bridge-process-spawn-v0",
      });
      return {
        task: waitingTask,
        blocked: true,
        reason: "policy_requires_approval",
        actions: [],
        capabilityInvocations: [],
        commandTranscript: [],
        verification: null,
        policy: policy.decision,
        approval: approval ? serialiseApproval(approval) : null,
        governance: {
          mode: "acpx_codex_bridge_process_spawn_waiting_for_approval",
          executed: false,
          canReadCredentialValue: false,
          canCopyAuthMaterial: false,
          canChmodWrapper: false,
          canExecuteWrapper: false,
          canSpawnCodexAcp: false,
          canCallProvider: false,
          canUseNetwork: false,
        },
      };
    }

    await setTaskPhase(task, "approved_preflight_only", {
      status: "running",
      details: {
        executor: "acpx-codex-bridge-process-spawn-v0",
        approvalId: approval?.id ?? task.approval?.requestId ?? null,
        canExecuteWrapper: false,
        canSpawnCodexAcp: false,
      },
    });
    const metadata = task.nativeAcpxCodexBridgeProcessSpawn ?? {};
    const preflight = buildProcessSpawnPreflightRecord({
      task,
      proposal: metadata.processSpawnProposal,
      approval,
    });
    task.nativeAcpxCodexBridgeProcessSpawn = {
      ...metadata,
      registry: metadata.registry ?? "openclaw-native-acpx-codex-bridge-process-spawn-task-v0",
      mode: metadata.mode ?? "approval-gated-process-spawn-preflight-task",
      execution: preflight,
      governance: {
        ...(metadata.governance ?? {}),
        executed: false,
        canReadCredentialValue: false,
        canCopyAuthMaterial: false,
        canChmodWrapper: false,
        canExecuteWrapper: false,
        canSpawnCodexAcp: false,
        canCallProvider: false,
        canUseNetwork: false,
      },
    };
    const completedTask = completeTask(task, {
      executor: "acpx-codex-bridge-process-spawn-v0",
      summary: "ACPX/Codex bridge process-spawn preflight recorded without executing wrapper.",
      acpxCodexBridgeProcessSpawnPreflight: preflight,
      verification: {
        ok: preflight.wrapper.exists === true && preflight.wrapper.hashMatches === true,
        checks: [
          {
            name: "wrapper_file_exists",
            ok: preflight.wrapper.exists === true && preflight.wrapper.isFile === true,
            expected: true,
            actual: preflight.wrapper.exists === true && preflight.wrapper.isFile === true,
          },
          {
            name: "wrapper_hash_matches_proposal",
            ok: preflight.wrapper.hashMatches === true,
            expected: preflight.wrapper.contentHash,
            actual: preflight.wrapper.hash,
          },
          {
            name: "process_spawn_deferred",
            ok: preflight.governance.canSpawnCodexAcp === false,
            expected: false,
            actual: preflight.governance.canSpawnCodexAcp,
          },
          {
            name: "credential_value_read_blocked",
            ok: preflight.governance.canReadCredentialValue === false,
            expected: false,
            actual: preflight.governance.canReadCredentialValue,
          },
        ],
      },
    });
    await publishEvent(createEventName("task.completed"), {
      task: serialiseTask(completedTask),
      executor: "acpx-codex-bridge-process-spawn-v0",
      acpxCodexBridgeProcessSpawnPreflight: preflight,
    });

    return {
      task: completedTask,
      blocked: false,
      reason: null,
      actions: [],
      capabilityInvocations: [],
      commandTranscript: [],
      verification: completedTask.outcome?.details?.verification ?? null,
      execution: preflight,
      policy: policy.decision,
      approval: approval ? serialiseApproval(approval) : null,
      governance: preflight.governance,
    };
  }

  return [
    {
      name: "acpx-codex-bridge-wrapper-action",
      predicate: isNativeAcpxCodexBridgeWrapperTask,
      execute: executeNativeAcpxCodexBridgeWrapperTask,
    },
    {
      name: "acpx-codex-bridge-process-spawn",
      predicate: isNativeAcpxCodexBridgeProcessSpawnTask,
      execute: executeNativeAcpxCodexBridgeProcessSpawnTask,
    },
  ];
}
