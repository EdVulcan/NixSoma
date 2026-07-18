import { createHash } from "node:crypto";

const VERIFICATION_FOLLOWUP_REGISTRY = "openclaw-native-engineering-verification-followup-v0";
const MUTATION_REGISTRY = "openclaw-native-workspace-mutation-v0";
const MUTATION_CAPABILITIES = new Set([
  "act.openclaw.workspace_text_write",
  "act.openclaw.workspace_patch_apply",
]);
const VALIDATION_SCRIPTS = ["typecheck", "test", "lint"];

function canonicalise(value) {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(canonicalise);
  }
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalise(value[key])]),
  );
}

function compactTask(task) {
  return task ? {
    id: task.id ?? null,
    status: task.status ?? null,
    approvalId: task.approval?.requestId ?? null,
    executionPhase: task.executionPhase ?? null,
  } : null;
}

function compactExecution(execution) {
  const task = execution?.task ?? null;
  return {
    task: compactTask(task),
    ok: task?.status === "completed",
    commandCount: Array.isArray(execution?.commandTranscript) ? execution.commandTranscript.length : 0,
    verification: execution?.verification?.ok === true,
  };
}

function eligibleMutationTask(task) {
  if (task?.status !== "completed"
    || !["openclaw-native-workspace-text-write", "openclaw-native-workspace-patch-apply"].includes(task.workViewStrategy)
    || task.workspaceMutation?.registry !== MUTATION_REGISTRY
    || !MUTATION_CAPABILITIES.has(task.workspaceMutation.capabilityId)
    || !task.workspaceMutation.workspace?.path
    || !task.workspaceMutation.target?.relativePath
    || !task.plan?.steps?.some((step) => step.capabilityId === "act.filesystem.write_text")) {
    return false;
  }
  return true;
}

export function buildWorkspaceMutationVerificationTrigger(task) {
  if (!eligibleMutationTask(task)) {
    return null;
  }
  const mutationFingerprint = createHash("sha256")
    .update(JSON.stringify(canonicalise({
      taskId: task.id,
      workspaceMutation: task.workspaceMutation,
    })))
    .digest("hex");
  return {
    registry: "openclaw-workspace-mutation-verification-trigger-v0",
    sourceTaskId: task.id,
    mutationHash: mutationFingerprint,
  };
}

export function createWorkspaceMutationVerificationFollowupCoordinator({
  autonomyMode,
  workspaceOps = {},
  executeCapabilityPlanTask,
} = {}) {
  async function createAndRun(task) {
    if (autonomyMode !== "sovereign_body" || !eligibleMutationTask(task)) {
      return null;
    }

    const workspace = task.workspaceMutation.workspace;
    const findProposal = workspaceOps.findWorkspaceCommandProposal;
    const createSourceCommandTask = workspaceOps.createOpenClawSourceCommandTask;
    if (typeof findProposal !== "function" || typeof createSourceCommandTask !== "function") {
      return {
        registry: VERIFICATION_FOLLOWUP_REGISTRY,
        triggered: false,
        reason: "verification_followup_owner_unavailable",
      };
    }

    let proposal = null;
    try {
      for (const scriptName of VALIDATION_SCRIPTS) {
        proposal = findProposal({ workspacePath: workspace.path, scriptName }).proposal ?? null;
        if (proposal) {
          break;
        }
      }
    } catch {
      return {
        registry: VERIFICATION_FOLLOWUP_REGISTRY,
        triggered: false,
        reason: "verification_followup_proposal_lookup_failed",
        workspacePath: workspace.path,
      };
    }
    if (!proposal) {
      return {
        registry: VERIFICATION_FOLLOWUP_REGISTRY,
        triggered: false,
        reason: "verification_followup_proposal_missing",
        workspacePath: workspace.path,
      };
    }

    const verificationTrigger = buildWorkspaceMutationVerificationTrigger(task);
    if (!verificationTrigger) {
      return {
        registry: VERIFICATION_FOLLOWUP_REGISTRY,
        triggered: false,
        reason: "verification_followup_mutation_binding_missing",
      };
    }

    let created;
    try {
      created = await createSourceCommandTask({
        proposalId: proposal.id,
        workspacePath: workspace.path,
        query: "automatic mutation verification",
        verificationTrigger,
        confirm: true,
      });
    } catch {
      return {
        registry: VERIFICATION_FOLLOWUP_REGISTRY,
        triggered: false,
        reason: "verification_followup_task_creation_failed",
        sourceTaskId: task.id,
        proposalId: proposal.id,
      };
    }

    const result = {
      registry: VERIFICATION_FOLLOWUP_REGISTRY,
      triggered: true,
      executed: false,
      ok: null,
      sourceTaskId: task.id,
      mutationHash: verificationTrigger.mutationHash,
      verificationTask: compactTask(created.task),
      proposalId: proposal.id,
      scriptName: proposal.scriptName,
      command: proposal.command,
      autonomyMode,
      approvalId: created.approval?.id ?? null,
    };

    if (created.governance?.autoAuthorized !== true || typeof executeCapabilityPlanTask !== "function") {
      return result;
    }

    try {
      const execution = await executeCapabilityPlanTask(created.task, {
        automaticVerification: true,
        sourceTaskId: task.id,
      });
      result.executed = true;
      result.ok = execution?.task?.status === "completed";
      result.verificationTask = compactTask(execution?.task ?? created.task);
      result.execution = compactExecution(execution);
    } catch {
      result.executed = true;
      result.ok = false;
      result.execution = {
        task: compactTask(created.task),
        ok: false,
        commandCount: 0,
        verification: false,
      };
    }
    return result;
  }

  return { createAndRun };
}
