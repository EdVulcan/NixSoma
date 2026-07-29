export const AI_WORKSPACE_REVIEWED_CYCLE_REGISTRY =
  "nixsoma-ai-workspace-reviewed-cycle-v0";

const BOUNDED_RUN_REGISTRY = "nixsoma-ai-workspace-bounded-run-v0";
const SINGLE_STEP_REGISTRY = "nixsoma-ai-workspace-single-step-v0";
const ASSESSMENT_REGISTRY = "nixsoma-ai-workspace-task-assessment-v0";
const ALLOWED_ACTIONS = new Set([
  "no_op", "scroll_up", "scroll_down", "click_item", "type_item",
]);

function boundedHash(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value) ? value : null;
}

function runCanContinueToAssessment(run) {
  const firstStep = run?.steps?.[0];
  return run?.registry === BOUNDED_RUN_REGISTRY
    && run?.evidence?.outcomeUnknown === false
    && run.evidence.runCompletionAudit === true
    && Number.isInteger(run.evidence.providerCallCount)
    && run.evidence.providerCallCount >= 1
    && run.evidence.providerCallCount <= 2
    && Number.isInteger(run.evidence.actionCount)
    && run.evidence.actionCount >= 0
    && run.evidence.actionCount <= 2
    && firstStep?.registry === SINGLE_STEP_REGISTRY
    && typeof firstStep.status === "string"
    && firstStep.status !== "local_fallback"
    && ALLOWED_ACTIONS.has(firstStep.actionId)
    && firstStep.providerCalled === true
    && firstStep.completionAudit === true
    && firstStep.taskId === run.evidence.taskId
    && firstStep.objectiveContentHash === run.evidence.objectiveContentHash
    && firstStep.taskVersionHash === run.evidence.taskVersionHash
    && boundedHash(run.evidence.objectiveContentHash) !== null
    && boundedHash(run.evidence.taskVersionHash) !== null
    && typeof run.evidence.taskId === "string"
    && run.evidence.taskId.length > 0
    && run?.governance?.taskMutated === false
    && run.governance.mutatesHost === false;
}

function busyResult() {
  return {
    ok: true,
    registry: AI_WORKSPACE_REVIEWED_CYCLE_REGISTRY,
    status: "stopped_after_run",
    terminalReason: "workspace_run_in_flight",
    run: null,
    assessment: null,
    evidence: {
      taskId: null,
      objectiveContentHash: null,
      taskVersionHash: null,
      providerCallCount: 0,
      providerCallCountMinimum: 0,
      actionCount: 0,
      actionCountMinimum: 0,
      runCompletionAudit: false,
      assessmentContinuationAudit: false,
      assessmentCompletionAudit: false,
      cycleCompletionAudit: false,
      assessmentReceiptEligible: false,
      outcomeUnknown: false,
    },
    governance: governance(),
  };
}

function governance() {
  return {
    explicitOperatorTrigger: true,
    standingAuthorization: true,
    maximumProviderCalls: 3,
    maximumActions: 2,
    taskMutated: false,
    automaticTaskCompletion: false,
    requiresOperatorAcceptance: true,
    providerTriggeredCompletion: false,
    createsTask: false,
    createsApproval: false,
    mutatesHost: false,
  };
}

export function createAiWorkspaceReviewedCycle({
  runBounded,
  assessment,
  publishAuditEvent = async () => ({ ok: true }),
  now = () => new Date().toISOString(),
} = {}) {
  async function complete({
    status,
    terminalReason,
    run,
    assessmentResult = null,
    assessmentContinuationAudit = false,
    outcomeUnknown = false,
  }) {
    const runEvidence = run?.evidence ?? {};
    const assessmentEvidence = assessmentResult?.evidence ?? {};
    const assessmentProviderCalled = assessmentResult?.governance?.providerCalled === true;
    const providerCallCountMinimum = (runEvidence.providerCallCountMinimum ?? 0)
      + (assessmentProviderCalled ? 1 : 0);
    const providerCallCount = outcomeUnknown ? null : providerCallCountMinimum;
    const actionCountMinimum = runEvidence.actionCountMinimum ?? 0;
    const actionCount = outcomeUnknown ? null : actionCountMinimum;
    const sameBinding = assessmentEvidence.taskId === runEvidence.taskId
      && assessmentEvidence.objectiveContentHash === runEvidence.objectiveContentHash
      && assessmentEvidence.taskVersionHash === runEvidence.taskVersionHash;
    const assessmentCompletionAudit = assessmentEvidence.completionAudit === true;
    const assessmentReceiptEligible = assessmentResult?.status === "assessed"
      && assessmentResult?.assessment?.outcome === "complete"
      && typeof assessmentResult?.assessment?.confidence === "number"
      && assessmentResult.assessment.confidence >= 0
      && assessmentResult.assessment.confidence <= 1
      && assessmentProviderCalled
      && assessmentCompletionAudit
      && sameBinding
      && assessmentResult?.governance?.semanticSceneBound === true
      && assessmentResult.governance.currentBrowserSurfaceBound === true
      && assessmentResult.governance.taskObjectiveBound === true
      && assessmentResult.governance.taskObjectiveProviderEgress === true
      && assessmentResult.governance.rawTaskGoalProviderEgress === false
      && assessmentResult.governance.pixelsProviderEgress === false
      && assessmentResult.governance.urlsProviderEgress === false
      && assessmentResult.governance.inputValuesProviderEgress === false
      && assessmentResult.governance.maximumActions === 0
      && assessmentResult.governance.actionExecuted === false
      && assessmentResult.governance.taskMutated === false
      && assessmentResult.governance.automaticContinuation === false
      && assessmentResult.governance.createsTask === false
      && assessmentResult.governance.createsApproval === false
      && assessmentResult.governance.mutatesHost === false;
    let cycleCompletionAudit = false;
    try {
      const accepted = await publishAuditEvent("ai_workspace.reviewed_cycle_completed", {
        registry: AI_WORKSPACE_REVIEWED_CYCLE_REGISTRY,
        at: now(),
        status,
        terminalReason,
        taskId: runEvidence.taskId ?? null,
        objectiveContentHash: runEvidence.objectiveContentHash ?? null,
        taskVersionHash: runEvidence.taskVersionHash ?? null,
        runStatus: run?.status ?? null,
        runTerminalReason: run?.terminalReason ?? null,
        runCompletionAudit: runEvidence.runCompletionAudit === true,
        assessmentStatus: assessmentResult?.status ?? null,
        assessmentOutcome: assessmentResult?.assessment?.outcome ?? "unknown",
        assessmentCompletionAudit,
        assessmentContinuationAudit,
        assessmentReceiptEligible,
        providerCallCount,
        providerCallCountMinimum,
        actionCount,
        actionCountMinimum,
        outcomeUnknown,
        maximumProviderCalls: 3,
        maximumActions: 2,
        automaticTaskCompletion: false,
      });
      cycleCompletionAudit = accepted?.ok === true;
    } catch {
      cycleCompletionAudit = false;
    }
    return {
      ok: run?.ok === true
        && assessmentResult?.ok === true
        && outcomeUnknown === false
        && cycleCompletionAudit,
      registry: AI_WORKSPACE_REVIEWED_CYCLE_REGISTRY,
      status,
      terminalReason,
      run,
      assessment: assessmentResult,
      evidence: {
        taskId: runEvidence.taskId ?? null,
        objectiveContentHash: runEvidence.objectiveContentHash ?? null,
        taskVersionHash: runEvidence.taskVersionHash ?? null,
        providerCallCount,
        providerCallCountMinimum,
        actionCount,
        actionCountMinimum,
        runCompletionAudit: runEvidence.runCompletionAudit === true,
        assessmentContinuationAudit,
        assessmentCompletionAudit,
        cycleCompletionAudit,
        assessmentReceiptEligible: assessmentReceiptEligible && cycleCompletionAudit,
        outcomeUnknown,
      },
      governance: governance(),
    };
  }

  async function invoke(input) {
    const run = await runBounded(input);
    if (!runCanContinueToAssessment(run)) {
      return complete({
        status: "stopped_after_run",
        terminalReason: "run_not_assessable",
        run,
      });
    }
    if (!assessment || typeof assessment.invoke !== "function") {
      return complete({
        status: "stopped_after_run",
        terminalReason: "assessment_runtime_unavailable",
        run,
      });
    }
    const expectedTaskBinding = {
      taskId: run.evidence.taskId,
      objectiveContentHash: run.evidence.objectiveContentHash,
      taskVersionHash: run.evidence.taskVersionHash,
    };
    let assessmentContinuationAudit = false;
    try {
      const accepted = await publishAuditEvent(
        "ai_workspace.reviewed_cycle_assessment_authorized",
        {
          registry: AI_WORKSPACE_REVIEWED_CYCLE_REGISTRY,
          at: now(),
          ...expectedTaskBinding,
          runStatus: run.status,
          runTerminalReason: run.terminalReason,
          runProviderCallCount: run.evidence.providerCallCount,
          runActionCount: run.evidence.actionCount,
          maximumProviderCalls: 3,
          maximumActions: 2,
          automaticTaskCompletion: false,
        },
      );
      assessmentContinuationAudit = accepted?.ok === true;
    } catch {
      assessmentContinuationAudit = false;
    }
    if (!assessmentContinuationAudit) {
      return complete({
        status: "stopped_after_run",
        terminalReason: "assessment_continuation_audit_unavailable",
        run,
      });
    }
    let assessmentResult;
    try {
      assessmentResult = await assessment.invoke({
        taskId: input?.taskId,
        expectedTaskBinding,
      });
    } catch {
      return complete({
        status: "assessment_fallback",
        terminalReason: "assessment_outcome_unknown",
        run,
        assessmentContinuationAudit: true,
        outcomeUnknown: true,
      });
    }
    const assessmentValid = assessmentResult?.registry === ASSESSMENT_REGISTRY
      && ["assessed", "local_fallback"].includes(assessmentResult?.status)
      && assessmentResult?.governance?.taskMutated === false
      && assessmentResult.governance.maximumActions === 0
      && assessmentResult.governance.actionExecuted === false;
    if (!assessmentValid) {
      return complete({
        status: "assessment_fallback",
        terminalReason: "assessment_result_invalid",
        run,
        assessmentContinuationAudit: true,
        outcomeUnknown: true,
      });
    }
    const assessed = assessmentResult.status === "assessed"
      && assessmentResult.evidence?.taskId === expectedTaskBinding.taskId
      && assessmentResult.evidence?.objectiveContentHash === expectedTaskBinding.objectiveContentHash
      && assessmentResult.evidence?.taskVersionHash === expectedTaskBinding.taskVersionHash;
    return complete({
      status: assessed ? "assessed" : "assessment_fallback",
      terminalReason: assessed ? "assessment_terminal" : "assessment_local_fallback",
      run,
      assessmentResult,
      assessmentContinuationAudit: true,
    });
  }

  return { invoke, busy: busyResult };
}
