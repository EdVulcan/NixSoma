export const AI_WORKSPACE_BOUNDED_RUN_REGISTRY =
  "nixsoma-ai-workspace-bounded-run-v0";

const SINGLE_STEP_REGISTRY = "nixsoma-ai-workspace-single-step-v0";
const SCROLL_ACTIONS = new Set(["scroll_up", "scroll_down"]);
const ALLOWED_ACTIONS = new Set([
  "no_op", "scroll_up", "scroll_down", "click_item", "type_item",
]);

function boundedHash(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value) ? value : null;
}

function compactInputEvidence(value) {
  if (value?.registry !== "openclaw-write-only-input-evidence-v0"
    || !Number.isInteger(value.charCount)
    || value.charCount < 1
    || !Number.isInteger(value.byteLength)
    || value.byteLength < 1
    || value.textExposed !== false
    || value.persisted !== false) return null;
  return {
    registry: value.registry,
    charCount: value.charCount,
    byteLength: value.byteLength,
    maxChars: Number.isInteger(value.maxChars) ? value.maxChars : null,
    truncated: value.truncated === true,
    textExposed: false,
    persisted: false,
  };
}

function compactStep(result, index) {
  const actionId = result?.decision?.actionId ?? result?.fallback?.actionId ?? null;
  const evidence = result?.evidence ?? {};
  const inputEvidence = compactInputEvidence(
    result?.action?.inputEvidence ?? evidence.inputEvidence ?? result?.decision?.inputEvidence,
  );
  return {
    index,
    registry: result?.registry === SINGLE_STEP_REGISTRY ? SINGLE_STEP_REGISTRY : null,
    status: typeof result?.status === "string" ? result.status.slice(0, 80) : null,
    actionId: typeof actionId === "string" ? actionId.slice(0, 40) : null,
    itemOrdinal: Number.isInteger(result?.action?.itemOrdinal)
      ? result.action.itemOrdinal
      : Number.isInteger(result?.decision?.itemOrdinal) ? result.decision.itemOrdinal : null,
    inputEvidence,
    providerCalled: result?.governance?.providerCalled === true,
    actionExecuted: result?.governance?.actionExecuted === true,
    taskId: typeof evidence.taskId === "string" ? evidence.taskId.slice(0, 200) : null,
    objectiveContentHash: boundedHash(evidence.objectiveContentHash),
    taskVersionHash: boundedHash(evidence.taskVersionHash),
    contextContentHash: boundedHash(evidence.contextContentHash),
    requestContentHash: boundedHash(evidence.requestContentHash),
    responseContentHash: boundedHash(evidence.responseContentHash),
    sceneContentHash: boundedHash(evidence.sceneContentHash),
    sceneItemCount: Number.isInteger(evidence.sceneItemCount) ? evidence.sceneItemCount : 0,
    postActionVerified: evidence.postActionVerified === true,
  };
}

function verifiedScroll(result, step) {
  const executionSequence = result?.evidence?.executionFrame?.sequence;
  const postSequence = result?.evidence?.postFrame?.sequence;
  return SCROLL_ACTIONS.has(step.actionId)
    && step.status === "executed"
    && step.actionExecuted === true
    && result?.governance?.currentFrameBound === true
    && result?.governance?.currentActiveSurfaceBound === true
    && result?.evidence?.receiptMatched === true
    && result?.evidence?.completionAudit === true
    && Number.isInteger(executionSequence)
    && Number.isInteger(postSequence)
    && postSequence > executionSequence;
}

function validStep(step) {
  const baseValid = step.registry === SINGLE_STEP_REGISTRY
    && typeof step.status === "string"
    && step.status.length > 0
    && ALLOWED_ACTIONS.has(step.actionId);
  if (!baseValid) return false;
  if (step.status === "local_fallback") {
    return step.actionId === "no_op" && step.actionExecuted === false;
  }
  return typeof step.taskId === "string"
    && step.taskId.length > 0
    && boundedHash(step.objectiveContentHash) !== null
    && boundedHash(step.taskVersionHash) !== null;
}

function taskBindingFromStep(step) {
  return {
    taskId: step.taskId,
    objectiveContentHash: step.objectiveContentHash,
    taskVersionHash: step.taskVersionHash,
  };
}

function sameTaskBinding(first, second) {
  return first.taskId === second.taskId
    && first.objectiveContentHash === second.objectiveContentHash
    && first.taskVersionHash === second.taskVersionHash;
}

function firstTerminalReason(result, step) {
  if (step.status === "local_fallback") return "first_step_fallback";
  if (step.actionId === "no_op") return "first_step_no_op";
  if (!SCROLL_ACTIONS.has(step.actionId)) return "first_step_terminal_action";
  if (!verifiedScroll(result, step)) return "first_step_unverified_scroll";
  return null;
}

function busyBoundedRun() {
  return {
    ok: true,
    registry: AI_WORKSPACE_BOUNDED_RUN_REGISTRY,
    status: "local_fallback",
    terminalReason: "workspace_run_in_flight",
    steps: [],
    evidence: {
      stepCount: 0,
      providerCallCount: 0,
      providerCallCountMinimum: 0,
      actionCount: 0,
      actionCountMinimum: 0,
      continuationAudit: false,
      runCompletionAudit: false,
      outcomeUnknown: false,
    },
    governance: {
      explicitOperatorTrigger: true,
      standingAuthorization: true,
      maximumProviderCalls: 2,
      providerCallCount: 0,
      maximumActions: 2,
      actionCount: 0,
      continuationAfterVerifiedScrollOnly: true,
      continuedAfterVerifiedScroll: false,
      terminalAfterSecondStep: true,
      automaticRepeat: false,
      createsTask: false,
      createsApproval: false,
      keyboardInput: false,
      inputTextPersisted: false,
      parentDisplayConnected: false,
      mutatesHost: false,
    },
  };
}

export function createAiWorkspaceRunCoordinator({
  singleStep,
  publishAuditEvent = async () => ({ ok: true }),
  now = () => new Date().toISOString(),
} = {}) {
  let inFlight = false;

  async function completeRun({ ok = true, status, terminalReason, steps, continuationAudit,
    outcomeUnknown = false, continuedAfterVerifiedScroll = false } = {}) {
    const providerCallCountMinimum = steps.filter((step) => step.providerCalled).length;
    const actionCountMinimum = steps.filter((step) => step.actionExecuted).length;
    const providerCallCount = outcomeUnknown ? null : providerCallCountMinimum;
    const actionCount = outcomeUnknown ? null : actionCountMinimum;
    let runCompletionAudit = false;
    try {
      const accepted = await publishAuditEvent("ai_workspace.bounded_run_completed", {
        registry: AI_WORKSPACE_BOUNDED_RUN_REGISTRY,
        at: now(),
        status,
        terminalReason,
        steps,
        stepCount: steps.length,
        providerCallCount,
        providerCallCountMinimum,
        actionCount,
        actionCountMinimum,
        continuationAudit,
        outcomeUnknown,
        maximumProviderCalls: 2,
        maximumActions: 2,
        automaticRepeat: false,
      });
      runCompletionAudit = accepted?.ok === true;
    } catch {
      runCompletionAudit = false;
    }
    return {
      ok,
      registry: AI_WORKSPACE_BOUNDED_RUN_REGISTRY,
      status,
      terminalReason,
      steps,
      evidence: {
        taskId: steps[0]?.taskId ?? null,
        objectiveContentHash: steps[0]?.objectiveContentHash ?? null,
        taskVersionHash: steps[0]?.taskVersionHash ?? null,
        stepCount: steps.length,
        providerCallCount,
        providerCallCountMinimum,
        actionCount,
        actionCountMinimum,
        continuationAudit,
        runCompletionAudit,
        outcomeUnknown,
      },
      governance: {
        explicitOperatorTrigger: true,
        standingAuthorization: true,
        maximumProviderCalls: 2,
        providerCallCount,
        maximumActions: 2,
        actionCount,
        continuationAfterVerifiedScrollOnly: true,
        continuedAfterVerifiedScroll,
        terminalAfterSecondStep: true,
        automaticRepeat: false,
        createsTask: false,
        createsApproval: false,
        keyboardInput: steps.some((step) => step.actionId === "type_item" && step.actionExecuted),
        inputTextPersisted: false,
        parentDisplayConnected: false,
        mutatesHost: false,
      },
    };
  }

  async function invokeSingle(input) {
    if (inFlight) {
      return typeof singleStep?.localFallback === "function"
        ? singleStep.localFallback("workspace_run_in_flight")
        : {
            ok: true,
            registry: SINGLE_STEP_REGISTRY,
            status: "local_fallback",
            fallback: { reason: "ai_workspace_single_step_workspace_run_in_flight", actionId: "no_op" },
            evidence: { taskId: input?.taskId ?? null, actionExecuted: false },
            governance: { providerCalled: false, actionExecuted: false, maximumActions: 1, automaticRepeat: false },
          };
    }
    inFlight = true;
    try {
      return await singleStep.invoke(input);
    } finally {
      inFlight = false;
    }
  }

  async function invokeBounded(input) {
    if (inFlight) return busyBoundedRun();
    if (!singleStep || typeof singleStep.invoke !== "function") {
      return completeRun({
        ok: false,
        status: "runtime_unavailable",
        terminalReason: "single_step_runtime_unavailable",
        steps: [],
        continuationAudit: false,
      });
    }
    inFlight = true;
    try {
      let firstResult;
      try {
        firstResult = await singleStep.invoke(input);
      } catch {
        return completeRun({
          ok: false,
          status: "first_step_outcome_unknown",
          terminalReason: "first_step_failed",
          steps: [],
          continuationAudit: false,
          outcomeUnknown: true,
        });
      }
      const firstStep = compactStep(firstResult, 1);
      if (!validStep(firstStep)) {
        return completeRun({
          ok: false,
          status: "first_step_outcome_unknown",
          terminalReason: "first_step_result_invalid",
          steps: [],
          continuationAudit: false,
          outcomeUnknown: true,
        });
      }
      const terminalReason = firstTerminalReason(firstResult, firstStep);
      if (terminalReason) {
        return completeRun({
          ok: firstResult?.ok === true,
          status: "stopped_after_first",
          terminalReason,
          steps: [firstStep],
          continuationAudit: false,
        });
      }

      let continuationAudit = false;
      try {
        const accepted = await publishAuditEvent("ai_workspace.bounded_run_continuation_authorized", {
          registry: AI_WORKSPACE_BOUNDED_RUN_REGISTRY,
          at: now(),
          taskId: firstStep.taskId,
          objectiveContentHash: firstStep.objectiveContentHash,
          taskVersionHash: firstStep.taskVersionHash,
          firstStep,
          nextStep: 2,
          continuationReason: "verified_scroll",
          maximumProviderCalls: 2,
          maximumActions: 2,
          automaticRepeat: false,
        });
        continuationAudit = accepted?.ok === true;
      } catch {
        continuationAudit = false;
      }
      if (!continuationAudit) {
        return completeRun({
          status: "stopped_after_first",
          terminalReason: "continuation_audit_unavailable",
          steps: [firstStep],
          continuationAudit: false,
        });
      }

      let secondResult;
      try {
        secondResult = await singleStep.invoke({
          ...input,
          expectedTaskBinding: taskBindingFromStep(firstStep),
        });
      } catch {
        return completeRun({
          ok: false,
          status: "second_step_outcome_unknown",
          terminalReason: "second_step_failed",
          steps: [firstStep],
          continuationAudit: true,
          outcomeUnknown: true,
          continuedAfterVerifiedScroll: true,
        });
      }
      const secondStep = compactStep(secondResult, 2);
      if (!validStep(secondStep)
        || (secondStep.status !== "local_fallback" && !sameTaskBinding(firstStep, secondStep))) {
        return completeRun({
          ok: false,
          status: "second_step_outcome_unknown",
          terminalReason: "second_step_result_invalid",
          steps: [firstStep],
          continuationAudit: true,
          outcomeUnknown: true,
          continuedAfterVerifiedScroll: true,
        });
      }
      return completeRun({
        ok: secondResult?.ok === true,
        status: secondStep.status === "local_fallback" ? "stopped_after_second_fallback" : "completed",
        terminalReason: "second_step_terminal",
        steps: [firstStep, secondStep],
        continuationAudit: true,
        continuedAfterVerifiedScroll: true,
      });
    } finally {
      inFlight = false;
    }
  }

  return {
    singleStep: { invoke: invokeSingle },
    boundedRun: { invoke: invokeBounded },
  };
}
