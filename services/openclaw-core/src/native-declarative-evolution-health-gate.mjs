import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  createNativeDeclarativeEvolutionClosureIntegrityReceipt,
  createNativeDeclarativeEvolutionClosureQuery,
  hashNativeDeclarativeEvolutionApprovalRecord,
  isNixStorePath,
  validateNativeDeclarativeEvolutionClosureIntegrityReceipt,
} from "./native-declarative-evolution-closure-integrity.mjs";
import { buildCapabilityRequestBindingHash } from "./capability-runtime-approval-binding.mjs";
import { NATIVE_DECLARATIVE_EVOLUTION_STAGING_TASK_TYPE } from "./native-declarative-evolution-task-builders.mjs";
import {
  isNativeDeclarativeEvolutionPathWithinDirectory,
  resolveNativeDeclarativeEvolutionStagingDirectory,
} from "./native-declarative-evolution-paths.mjs";

export const NATIVE_DECLARATIVE_EVOLUTION_HEALTH_GATE_REGISTRY = "openclaw-native-declarative-evolution-health-gate-v0";
export const NATIVE_DECLARATIVE_EVOLUTION_HEALTH_GATE_CAPABILITY_ID = "sense.openclaw.declarative_evolution.health_gate";

const MAX_TASK_ID_CHARS = 160;

function normaliseTaskId(value) {
  const taskId = typeof value === "string" ? value.trim() : "";
  if (!taskId || taskId.length > MAX_TASK_ID_CHARS) return null;
  return taskId;
}

function findTask(tasks, taskId) {
  if (tasks instanceof Map) return tasks.get(taskId) ?? null;
  if (Array.isArray(tasks)) return tasks.find((task) => task?.id === taskId) ?? null;
  return null;
}

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function isCandidateHash(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function blockedResult(taskId, reason) {
  return {
    ok: false,
    blocked: true,
    registry: NATIVE_DECLARATIVE_EVOLUTION_HEALTH_GATE_REGISTRY,
    mode: "read-only-declarative-evolution-health-gate",
    taskId,
    reason,
    governance: {
      readsStagingFile: false,
      writesManagedConfig: false,
      switchesGeneration: false,
      executesRollback: false,
      assessesHostHealth: false,
      automaticActivation: false,
      automaticRollback: false,
      candidateTextExposed: false,
      readsCurrentApprovalRecord: false,
      requeriesStoreOutput: false,
      emitsImmutableClosureReceipt: false,
      providerEgress: false,
      networkEgress: false,
    },
  };
}

export function createNativeDeclarativeEvolutionHealthGateBuilders({
  tasks = new Map(),
  approvals = new Map(),
  stagingDirectory,
  readFileImpl = readFile,
  queryClosureIntegrity = createNativeDeclarativeEvolutionClosureQuery(),
  now = () => new Date().toISOString(),
} = {}) {
  const resolvedStagingDirectory = resolveNativeDeclarativeEvolutionStagingDirectory({ stagingDir: stagingDirectory });

  async function buildNativeDeclarativeEvolutionHealthGate({ taskId } = {}) {
    const normalisedTaskId = normaliseTaskId(taskId);
    if (!normalisedTaskId) {
      return blockedResult(null, "staging_task_id_required");
    }

    const task = findTask(tasks, normalisedTaskId);
    if (!task) return blockedResult(normalisedTaskId, "staging_task_not_found");
    if (task.type !== NATIVE_DECLARATIVE_EVOLUTION_STAGING_TASK_TYPE) {
      return blockedResult(normalisedTaskId, "task_is_not_declarative_evolution_staging");
    }

    const nativeState = task.nativeDeclarativeEvolution ?? {};
    const candidate = nativeState.candidate ?? {};
    const execution = nativeState.execution ?? {};
    const staging = execution.staging ?? {};
    const candidateHash = candidate.candidateHash;
    if (!isCandidateHash(candidateHash)) {
      return blockedResult(normalisedTaskId, "candidate_hash_missing_or_invalid");
    }

    const approvalHash = nativeState.approvalBinding?.candidateHash ?? null;
    const executionHash = execution.candidateHash ?? null;
    const approvalId = task.approval?.requestId ?? null;
    const approval = approvals instanceof Map ? approvals.get(approvalId) ?? null : null;
    const expectedPath = path.join(resolvedStagingDirectory, `openclaw-managed-${candidateHash}.nix`);
    const observedPath = typeof staging.path === "string" ? path.resolve(staging.path) : null;
    const pathBound = observedPath === expectedPath
      && isNativeDeclarativeEvolutionPathWithinDirectory(resolvedStagingDirectory, observedPath);

    let fileHash = null;
    let fileBytes = null;
    let fileReadable = false;
    if (pathBound) {
      try {
        const stagedText = await readFileImpl(observedPath, { encoding: "utf8" });
        fileHash = sha256(stagedText);
        fileBytes = Buffer.byteLength(stagedText, "utf8");
        fileReadable = true;
      } catch {
        fileReadable = false;
      }
    }

    const evaluatedClosurePath = execution.evaluation?.toplevelPath ?? null;
    let closure = { status: "blocked", reason: "evaluated_closure_path_invalid" };
    if (isNixStorePath(evaluatedClosurePath) && typeof queryClosureIntegrity === "function") {
      try {
        closure = await queryClosureIntegrity({ storePath: evaluatedClosurePath });
      } catch {
        closure = { status: "failed", reason: "closure_integrity_query_failed" };
      }
    }
    const stagingStep = task.plan?.steps?.find((step) => step.capabilityId === "act.openclaw.declarative_evolution.staging_task"
      && (step.requiresApproval === true || step.governance === "require_approval"));
    const stagingStepHash = stagingStep
      ? buildCapabilityRequestBindingHash({
          capabilityId: stagingStep.capabilityId,
          intent: stagingStep.intent ?? stagingStep.kind ?? null,
          params: stagingStep.params ?? {},
        })
      : null;
    const approvalCandidateBound = approval?.binding?.candidateHash === candidateHash
      || (approval?.binding?.registry === "openclaw-capability-execution-approval-binding-v1"
        && approval.binding.planId === task.plan?.planId
        && approval.binding.steps?.some((step) => step.stepId === stagingStep?.id
          && step.capabilityId === stagingStep?.capabilityId
          && step.requestHash === stagingStepHash
          && stagingStep.params?.candidateHash === candidateHash) === true);
    const checks = {
      taskCompleted: task.status === "completed",
      executionPassed: execution.status === "passed",
      candidateHashBound: executionHash === candidateHash,
      approvalHashBound: approvalHash === candidateHash,
      stagingPathBound: pathBound,
      stagingFileReadable: fileReadable,
      stagingFileHashMatches: fileHash === candidateHash,
      stagingFileBytesMatch: fileBytes === candidate.candidateBytes,
      nixValidationPassed: execution.validation?.status === "passed",
      nixEvaluationPassed: execution.evaluation?.status === "passed",
      currentApprovalRecordFound: approval !== null,
      currentApprovalApproved: approval?.status === "approved",
      currentApprovalTaskBound: approval?.taskId === task.id,
      currentApprovalCandidateBound: approvalCandidateBound,
      evaluatedClosureBound: isNixStorePath(evaluatedClosurePath),
      closureQueryPassed: closure?.status === "passed",
      closureOutputPathBound: closure?.outputPath === evaluatedClosurePath,
      closureDerivationBound: typeof closure?.derivationPath === "string"
        && closure.derivationPath.endsWith(".drv"),
      closureNarHashBound: typeof closure?.narHash === "string" && closure.narHash.startsWith("sha256-"),
      nixBuildPassed: execution.build?.status === "passed",
      nixBuildOutputBound: isNixStorePath(execution.build?.outputPath),
      nixBuildOutputMatchesEvaluation: execution.build?.outputPath === evaluatedClosurePath,
      noManagedConfigWrite: execution.governance?.writesManagedConfig === false,
      noGenerationSwitch: execution.governance?.switchesGeneration === false,
      noRollback: execution.governance?.executesRollback === false,
    };
    const closureReceipt = Object.values(checks).every((passed) => passed === true)
      ? createNativeDeclarativeEvolutionClosureIntegrityReceipt({
          issuedAt: now(),
          sourceStagingTaskId: task.id,
          approval,
          candidateHash,
          candidateBytes: candidate.candidateBytes,
          stagedFileHash: fileHash,
          stagedFileBytes: fileBytes,
          evaluatedClosurePath,
          closure,
        })
      : null;
    checks.closureIntegrityReceiptValid = validateNativeDeclarativeEvolutionClosureIntegrityReceipt(closureReceipt);
    const failedChecks = Object.entries(checks)
      .filter(([, passed]) => passed !== true)
      .map(([name]) => name);
    const eligibleForActivationReview = failedChecks.length === 0;

    return {
      ok: true,
      blocked: false,
      registry: NATIVE_DECLARATIVE_EVOLUTION_HEALTH_GATE_REGISTRY,
      mode: "read-only-declarative-evolution-health-gate",
      generatedAt: now(),
      taskId: normalisedTaskId,
      candidate: {
        candidateHash,
        candidateBytes: candidate.candidateBytes ?? null,
        targetPath: candidate.target?.path ?? null,
      },
      staging: {
        path: observedPath,
        directory: resolvedStagingDirectory,
        fileHash,
        fileBytes,
      },
      evaluatedClosure: {
        path: evaluatedClosurePath,
        status: checks.closureOutputPathBound ? "bound" : "unavailable",
        derivationPath: closure?.derivationPath ?? null,
        narHash: closure?.narHash ?? null,
        narSize: closure?.narSize ?? null,
      },
      approval: {
        id: approval?.id ?? approvalId,
        status: approval?.status ?? null,
        recordHash: approval ? hashNativeDeclarativeEvolutionApprovalRecord(approval) : null,
      },
      closureIntegrity: {
        status: closureReceipt ? "verified" : "blocked",
        receipt: closureReceipt,
        query: {
          status: closure?.status ?? "unavailable",
          mode: closure?.mode ?? "nix-path-info",
          outputPath: closure?.outputPath ?? null,
          derivationPath: closure?.derivationPath ?? null,
          narHash: closure?.narHash ?? null,
          narSize: closure?.narSize ?? null,
          reason: closure?.reason ?? null,
        },
      },
      checks,
      failedChecks,
      assessment: {
        status: eligibleForActivationReview ? "eligible_for_activation_review" : "blocked",
        eligibleForActivationReview,
        hostHealth: "not_assessed",
        activation: "manual_only",
        rollback: "manual_only",
      },
      governance: {
        readsStagingFile: true,
        writesManagedConfig: false,
        switchesGeneration: false,
        executesRollback: false,
        assessesHostHealth: false,
        readsCurrentApprovalRecord: true,
        requeriesStoreOutput: true,
        emitsImmutableClosureReceipt: closureReceipt !== null,
        automaticActivation: false,
        automaticRollback: false,
        candidateTextExposed: false,
        providerEgress: false,
        networkEgress: false,
      },
      next: {
        recommendedAction: eligibleForActivationReview
          ? "operator_review_then_explicit_activation_decision"
          : "repair_or_restage_candidate_before_activation_review",
        automaticActivation: false,
        automaticRollback: false,
        hostHealthRequired: true,
      },
    };
  }

  return { buildNativeDeclarativeEvolutionHealthGate };
}
