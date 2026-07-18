import { randomUUID } from "node:crypto";
import path from "node:path";
import { buildCapabilityRequestBindingHash } from "./capability-runtime-approval-binding.mjs";
import {
  assessWorkspaceCommandAutonomy,
  buildWorkspaceCommandAutonomousGrant,
  normaliseWorkspaceMutationVerificationTrigger,
} from "./workspace-command-autonomy.mjs";

export function createWorkspaceCommandPlanBuilders({
  buildWorkspaceCommandProposals,
  buildOpenClawSourceCommandProposals,
  buildRulePlan,
  autonomyMode,
}) {
  function findWorkspaceCommandProposal({ proposalId = null, workspaceId = null, workspacePath = null, targetPath = null, scriptName = null } = {}) {
    const proposals = buildWorkspaceCommandProposals();
    const resolvedWorkspacePath = workspacePath ? path.resolve(workspacePath) : null;
    const resolvedTargetPath = targetPath ? path.resolve(targetPath) : null;
    const match = proposals.items.find((item) => {
      if (proposalId && item.id === proposalId) {
        return true;
      }
      if (workspaceId && scriptName && item.workspaceId === workspaceId && item.scriptName === scriptName) {
        return true;
      }
      if (resolvedWorkspacePath && scriptName && path.resolve(item.workspacePath) === resolvedWorkspacePath && item.scriptName === scriptName) {
        return true;
      }
      if (resolvedTargetPath && scriptName && item.scriptName === scriptName) {
        const candidateWorkspacePath = path.resolve(item.workspacePath);
        return resolvedTargetPath === candidateWorkspacePath
          || resolvedTargetPath.startsWith(`${candidateWorkspacePath}${path.sep}`);
      }
      return false;
    }) ?? null;

    return {
      proposals,
      proposal: match,
    };
  }

  function buildWorkspaceCommandPlanDraft({ proposalId = null, workspaceId = null, workspacePath = null, scriptName = null, verificationTrigger = null } = {}) {
    const { proposals, proposal } = findWorkspaceCommandProposal({ proposalId, workspaceId, workspacePath, scriptName });
    if (!proposal) {
      throw new Error("Workspace command proposal was not found.");
    }

    const now = new Date().toISOString();
    const goal = `Review execution plan for ${proposal.workspaceName}:${proposal.scriptName}`;
    const action = {
      kind: "system.command.execute",
      intent: "system.command.execute",
      params: {
        command: proposal.command,
        args: proposal.args,
        cwd: proposal.cwd,
        timeoutMs: proposal.risk === "medium" ? 300000 : 120000,
      },
    };
    const requestHash = buildCapabilityRequestBindingHash({
      capabilityId: "act.system.command.execute",
      intent: action.intent,
      params: action.params,
    });
    const autonomyAuthorization = assessWorkspaceCommandAutonomy({ proposal, autonomyMode });
    const autonomousGrant = autonomyAuthorization.authorized
      ? buildWorkspaceCommandAutonomousGrant({
          proposal,
          requestHash,
          verificationTrigger: normaliseWorkspaceMutationVerificationTrigger(verificationTrigger),
        })
      : null;
    const autonomous = autonomousGrant !== null;
    const policyRequest = {
      intent: "system.command.execute",
      domain: "body_internal",
      risk: proposal.risk,
      requiresApproval: !autonomous,
      tags: ["workspace_command", ...(autonomous ? ["sovereign_body_audit_only"] : ["explicit_approval_required"])],
    };
    const plan = buildRulePlan({
      goal,
      type: "system_task",
      intent: "system.command.execute",
      policy: policyRequest,
      targetUrl: null,
      actions: [action],
    });
    const policyDecision = {
      id: randomUUID(),
      at: now,
      engine: "workspace-command-plan-v0",
      stage: "workspace.command.plan",
      subject: {
        taskId: null,
        type: "system_task",
        goal,
        targetUrl: null,
        intent: "system.command.execute",
      },
      domain: "body_internal",
      risk: proposal.risk,
      decision: autonomous ? "audit_only" : "require_approval",
      reason: autonomyAuthorization.reason,
      approved: false,
      autonomyMode,
      autonomous,
      requiresApproval: !autonomous,
    };
    const planWithAutonomy = autonomous
      ? {
          ...plan,
          steps: plan.steps.map((step) => step.capabilityId === "act.system.command.execute"
            && step.phase === "acting_on_target"
            ? {
                ...step,
                requiresApproval: false,
                governance: "audit_only",
                baseRequiresApproval: true,
                autonomousExecution: autonomousGrant,
              }
            : step),
        }
      : plan;

    return {
      registry: "workspace-command-plan-draft-v0",
      mode: "plan-only",
      generatedAt: now,
      sourceRegistry: proposals.registry,
      proposal,
      draft: {
        goal,
        type: "system_task",
        action,
        plan: planWithAutonomy,
        policy: {
          request: policyRequest,
          decision: policyDecision,
        },
        governance: {
          createsTask: false,
          createsApproval: false,
          canExecute: false,
          canExecuteWithoutApproval: autonomous,
          autoAuthorized: autonomous,
          autonomous,
          verificationTrigger: normaliseWorkspaceMutationVerificationTrigger(verificationTrigger),
          autonomyAuthorization,
          requiresExplicitApproval: !autonomous,
          exposesScriptBody: false,
        },
      },
    };
  }

  function findSourceCommandProposal({
    proposalId = null,
    workspaceId = null,
    scriptName = null,
    workspacePath = null,
    query = "command",
  } = {}) {
    const proposals = buildOpenClawSourceCommandProposals({ workspacePath, query });
    const match = proposals.items.find((item) => {
      if (proposalId && item.id === proposalId) {
        return true;
      }
      return workspaceId && scriptName && item.workspaceId === workspaceId && item.scriptName === scriptName;
    }) ?? null;

    return {
      proposals,
      proposal: match,
    };
  }

  function buildOpenClawSourceCommandPlanDraft({
    proposalId = null,
    workspaceId = null,
    scriptName = null,
    workspacePath = null,
    query = "command",
    verificationTrigger = null,
  } = {}) {
    const { proposals, proposal } = findSourceCommandProposal({
      proposalId,
      workspaceId,
      scriptName,
      workspacePath,
      query,
    });
    if (!proposal) {
      throw new Error("OpenClaw source command proposal was not found.");
    }
    const draft = buildWorkspaceCommandPlanDraft({
      proposalId: proposal.id,
      verificationTrigger,
    });
    const sourceCommandPlan = {
      registry: "openclaw-source-command-plan-draft-v0",
      mode: "plan-only-source-command",
      sourceProposalRegistry: proposals.registry,
      sourceSignalsRegistry: proposals.sourceCommandSignals?.registry ?? "openclaw-source-command-proposals-v0",
      workspacePlanRegistry: draft.registry,
      proposalId: proposal.id,
      commandShape: {
        command: proposal.command,
        args: proposal.args,
        cwd: proposal.cwd,
        usesShell: proposal.usesShell === true,
      },
      contentExposed: false,
    };

    return {
      ...draft,
      registry: "openclaw-source-command-plan-draft-v0",
      mode: "plan-only-source-command",
      sourceRegistry: proposals.registry,
      sourceCommandProposal: proposal,
      sourceCommandSignals: proposals.sourceCommandSignals,
      sourceCommandPlan,
      autonomyAuthorization: draft.autonomyAuthorization,
      draft: {
        ...draft.draft,
        governance: {
          ...(draft.draft?.governance ?? {}),
          mode: "source_command_plan_only",
          sourceAbsorptionMode: "plan_only",
          createsTask: false,
          createsApproval: false,
          canExecute: false,
          canMutate: false,
          requiresExplicitApproval: draft.draft?.governance?.requiresExplicitApproval === true,
          canExecuteWithoutApproval: draft.draft?.governance?.canExecuteWithoutApproval === true,
          autoAuthorized: draft.draft?.governance?.autoAuthorized === true,
          autonomous: draft.draft?.governance?.autonomous === true,
          autonomyAuthorization: draft.autonomyAuthorization,
          exposesScriptBody: false,
          exposesPromptContent: false,
          exposesSourceFileContent: false,
        },
      },
      governance: {
        mode: "source_command_plan_only",
        runtimeOwner: "openclaw_on_nixos",
        sourceProposalRegistry: proposals.registry,
        canExecute: false,
        canMutate: false,
        createsTask: false,
        createsApproval: false,
        exposesScriptBodies: false,
        exposesPromptContent: false,
        exposesSourceFileContent: false,
        requiresExplicitApprovalBeforeExecution: draft.draft?.governance?.requiresExplicitApproval === true,
        canExecuteWithoutApproval: draft.draft?.governance?.canExecuteWithoutApproval === true,
        autoAuthorized: draft.draft?.governance?.autoAuthorized === true,
        autonomous: draft.draft?.governance?.autonomous === true,
        autonomyAuthorization: draft.autonomyAuthorization,
      },
    };
  }

  return {
    findWorkspaceCommandProposal,
    buildWorkspaceCommandPlanDraft,
    findSourceCommandProposal,
    buildOpenClawSourceCommandPlanDraft,
  };
}
