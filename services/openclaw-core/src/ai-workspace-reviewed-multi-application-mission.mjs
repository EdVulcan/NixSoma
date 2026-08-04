import {
  AI_COMPOSITOR_TYPE_MAX_CHARS,
  AI_COMPOSITOR_TYPE_PATTERN,
} from "../../../packages/shared-utils/src/ai-compositor-input.mjs";
import {
  aiWorkspaceNativeIntakeLifecycleStopped,
} from "./ai-workspace-native-intake-workflow.mjs";
import {
  readAiWorkspaceReviewedMultiApplicationObjectiveInput,
} from "./ai-workspace-ocr-type-contract.mjs";
import {
  buildAiWorkspaceTaskObjectiveBinding,
  projectAiWorkspaceTaskEvidence,
} from "./ai-workspace-task-objective.mjs";

export const AI_WORKSPACE_REVIEWED_MULTI_APPLICATION_MISSION_REGISTRY =
  "nixsoma-ai-workspace-reviewed-multi-application-mission-v0";

const BROWSER_WORKFLOW_REGISTRY = "nixsoma-ai-workspace-semantic-form-workflow-v0";
const NATIVE_WORKFLOW_REGISTRY = "nixsoma-ai-workspace-native-intake-workflow-v0";
const SHA256 = /^[a-f0-9]{64}$/u;

function boundedHash(value) {
  return typeof value === "string" && SHA256.test(value) ? value : null;
}

function inputEvidence(value) {
  if (typeof value !== "string"
    || value.length < 1
    || value.length > AI_COMPOSITOR_TYPE_MAX_CHARS
    || !AI_COMPOSITOR_TYPE_PATTERN.test(value)) return null;
  return {
    registry: "openclaw-write-only-input-evidence-v0",
    charCount: value.length,
    byteLength: Buffer.byteLength(value, "utf8"),
    maxChars: AI_COMPOSITOR_TYPE_MAX_CHARS,
    truncated: false,
    textExposed: false,
    persisted: false,
  };
}

function inputEvidenceMatches(value, expected) {
  return value?.registry === expected?.registry
    && value.charCount === expected.charCount
    && value.byteLength === expected.byteLength
    && Number.isInteger(value.maxChars)
    && value.maxChars >= value.charCount
    && value.truncated === false
    && value.textExposed === false
    && value.persisted === false;
}

function sameTaskBinding(left, right) {
  return left?.taskId === right?.taskId
    && boundedHash(left?.objectiveContentHash) !== null
    && left.objectiveContentHash === right?.objectiveContentHash
    && boundedHash(left?.taskVersionHash) !== null
    && left.taskVersionHash === right?.taskVersionHash;
}

function compactCount(value, maximum) {
  return Number.isInteger(value) && value >= 0 && value <= maximum ? value : null;
}

function compactBrowserWorkflow(result, expectedInputEvidence) {
  const evidence = result?.evidence ?? {};
  const governance = result?.governance ?? {};
  const steps = Array.isArray(result?.steps) ? result.steps.slice(0, 2) : [];
  return {
    applicationId: "fixed_browser_form",
    registry: result?.registry === BROWSER_WORKFLOW_REGISTRY
      ? BROWSER_WORKFLOW_REGISTRY
      : null,
    status: typeof result?.status === "string" ? result.status.slice(0, 80) : null,
    taskId: typeof evidence.taskId === "string" ? evidence.taskId.slice(0, 200) : null,
    objectiveContentHash: boundedHash(evidence.objectiveContentHash),
    taskVersionHash: boundedHash(evidence.taskVersionHash),
    stepCount: compactCount(evidence.stepCount, 2),
    actionSequence: steps.map((step) => step?.actionId).filter((value) => typeof value === "string"),
    providerCallCount: compactCount(evidence.providerCallCount, 2),
    providerCallCountMinimum: compactCount(evidence.providerCallCountMinimum, 2) ?? 0,
    actionCount: compactCount(evidence.actionCount, 2),
    actionCountMinimum: compactCount(evidence.actionCountMinimum, 2) ?? 0,
    lifecycleActionCount: 0,
    lifecycleActionCountMinimum: 0,
    continuationAudit: evidence.continuationAudit === true,
    completionAudit: evidence.workflowCompletionAudit === true,
    outcomeUnknown: evidence.outcomeUnknown === true,
    exactInputMatched: inputEvidenceMatches(steps[0]?.inputEvidence, expectedInputEvidence)
      && evidence.taskObjectiveInputBound === true
      && governance.taskObjectiveInputBound === true,
    verified: result?.ok === true,
  };
}

function compactNativeWorkflow(result, expectedInputEvidence) {
  const evidence = result?.evidence ?? {};
  const governance = result?.governance ?? {};
  return {
    applicationId: "fixed_native_intake",
    registry: result?.registry === NATIVE_WORKFLOW_REGISTRY
      ? NATIVE_WORKFLOW_REGISTRY
      : null,
    status: typeof result?.status === "string" ? result.status.slice(0, 80) : null,
    taskId: typeof evidence.taskId === "string" ? evidence.taskId.slice(0, 200) : null,
    objectiveContentHash: boundedHash(evidence.objectiveContentHash),
    taskVersionHash: boundedHash(evidence.taskVersionHash),
    stepCount: result?.typeStep ? 1 : 0,
    actionSequence: result?.typeStep?.actionId ? [result.typeStep.actionId] : [],
    providerCallCount: compactCount(evidence.providerCallCount, 1),
    providerCallCountMinimum: compactCount(evidence.providerCallCountMinimum, 1) ?? 0,
    actionCount: compactCount(evidence.actionCount, 1),
    actionCountMinimum: compactCount(evidence.actionCountMinimum, 1) ?? 0,
    lifecycleActionCount: compactCount(evidence.lifecycleActionCount, 2),
    lifecycleActionCountMinimum:
      compactCount(evidence.lifecycleActionCountMinimum, 2) ?? 0,
    continuationAudit: false,
    completionAudit: evidence.workflowCompletionAudit === true,
    outcomeUnknown: evidence.outcomeUnknown === true,
    exactInputMatched: inputEvidenceMatches(
      result?.typeStep?.inputEvidence,
      expectedInputEvidence,
    ) && result?.typeStep?.expectedSurfaceBound === true
      && governance.taskObjectiveBound === true,
    lifecycleStartVerified: evidence.lifecycleStartVerified === true,
    lifecycleStopVerified: evidence.lifecycleStopVerified === true,
    verified: result?.ok === true,
  };
}

function verifiedBrowserWorkflow(receipt, expectedTaskBinding) {
  return receipt.registry === BROWSER_WORKFLOW_REGISTRY
    && receipt.status === "completed"
    && receipt.verified
    && sameTaskBinding(receipt, expectedTaskBinding)
    && receipt.stepCount === 2
    && JSON.stringify(receipt.actionSequence) === JSON.stringify(["type_item", "click_item"])
    && receipt.providerCallCount === 2
    && receipt.providerCallCountMinimum === 2
    && receipt.actionCount === 2
    && receipt.actionCountMinimum === 2
    && receipt.continuationAudit
    && receipt.completionAudit
    && !receipt.outcomeUnknown
    && receipt.exactInputMatched;
}

function verifiedNativeWorkflow(receipt, expectedTaskBinding) {
  return receipt.registry === NATIVE_WORKFLOW_REGISTRY
    && receipt.status === "completed"
    && receipt.verified
    && sameTaskBinding(receipt, expectedTaskBinding)
    && receipt.stepCount === 1
    && JSON.stringify(receipt.actionSequence) === JSON.stringify(["type_text"])
    && receipt.providerCallCount === 1
    && receipt.providerCallCountMinimum === 1
    && receipt.actionCount === 1
    && receipt.actionCountMinimum === 1
    && receipt.lifecycleActionCount === 2
    && receipt.lifecycleActionCountMinimum === 2
    && receipt.completionAudit
    && !receipt.outcomeUnknown
    && receipt.exactInputMatched
    && receipt.lifecycleStartVerified
    && receipt.lifecycleStopVerified;
}

function knownTerminalReceipt(receipt, expectedTaskBinding) {
  if (!receipt.registry || receipt.outcomeUnknown) return false;
  if (receipt.providerCallCount === null
    || receipt.actionCount === null
    || receipt.lifecycleActionCount === null) return false;
  const sideEffectMinimum = receipt.actionCountMinimum
    + receipt.lifecycleActionCountMinimum;
  return sideEffectMinimum === 0
    ? receipt.taskId === null || sameTaskBinding(receipt, expectedTaskBinding)
    : sameTaskBinding(receipt, expectedTaskBinding);
}

function aggregateCounts(applications, forceUnknown = false) {
  const providerCallCountMinimum = applications.reduce(
    (sum, item) => sum + item.providerCallCountMinimum,
    0,
  );
  const actionCountMinimum = applications.reduce(
    (sum, item) => sum + item.actionCountMinimum,
    0,
  );
  const lifecycleActionCountMinimum = applications.reduce(
    (sum, item) => sum + item.lifecycleActionCountMinimum,
    0,
  );
  const outcomeUnknown = forceUnknown || applications.some((item) =>
    item.outcomeUnknown
    || item.providerCallCount === null
    || item.actionCount === null
    || item.lifecycleActionCount === null);
  const providerCallCount = outcomeUnknown ? null : applications.reduce(
    (sum, item) => sum + item.providerCallCount,
    0,
  );
  const actionCount = outcomeUnknown ? null : applications.reduce(
    (sum, item) => sum + item.actionCount,
    0,
  );
  const lifecycleActionCount = outcomeUnknown ? null : applications.reduce(
    (sum, item) => sum + item.lifecycleActionCount,
    0,
  );
  return {
    providerCallCount,
    providerCallCountMinimum,
    actionCount,
    actionCountMinimum,
    lifecycleActionCount,
    lifecycleActionCountMinimum,
    fixedActionCount: actionCount === null || lifecycleActionCount === null
      ? null
      : actionCount + lifecycleActionCount,
    fixedActionCountMinimum: actionCountMinimum + lifecycleActionCountMinimum,
    outcomeUnknown,
  };
}

function normalisePreparedMission(value) {
  const expectedInputEvidence = inputEvidence(value?.transientInputText);
  const taskBinding = value?.taskBinding ?? {};
  if (value?.ok !== true
    || !expectedInputEvidence
    || !inputEvidenceMatches(value.inputEvidence, expectedInputEvidence)
    || typeof taskBinding.taskId !== "string"
    || !taskBinding.taskId
    || boundedHash(taskBinding.objectiveContentHash) === null
    || boundedHash(taskBinding.taskVersionHash) === null) return null;
  return {
    taskBinding: {
      taskId: taskBinding.taskId,
      objectiveContentHash: taskBinding.objectiveContentHash,
      taskVersionHash: taskBinding.taskVersionHash,
    },
    transientInputText: value.transientInputText,
    inputEvidence: expectedInputEvidence,
  };
}

export function createAiWorkspaceReviewedMultiApplicationMissionPreflight({
  fetchJson,
  sessionManagerUrl,
  getTaskById,
} = {}) {
  return async function prepare({ taskId } = {}) {
    if (typeof fetchJson !== "function"
      || typeof sessionManagerUrl !== "string"
      || typeof getTaskById !== "function") {
      return { ok: false, reason: "mission_preflight_runtime_unavailable" };
    }
    let workViewState;
    try {
      workViewState = await fetchJson(`${sessionManagerUrl}/work-view/state`);
    } catch {
      return { ok: false, reason: "mission_work_view_unavailable" };
    }
    let task;
    try {
      task = getTaskById(taskId);
    } catch {
      return { ok: false, reason: "mission_task_unavailable" };
    }
    const binding = buildAiWorkspaceTaskObjectiveBinding({
      task,
      taskId,
      workViewState,
    });
    if (!binding.ok) return { ok: false, reason: binding.reason };
    if (!aiWorkspaceNativeIntakeLifecycleStopped(workViewState)) {
      return { ok: false, reason: "mission_native_intake_not_stopped" };
    }
    const transientInputText = readAiWorkspaceReviewedMultiApplicationObjectiveInput(
      binding.providerProjection?.statement,
    );
    const evidence = inputEvidence(transientInputText);
    if (!evidence) {
      return { ok: false, reason: "mission_exact_input_objective_required" };
    }
    return {
      ok: true,
      taskBinding: projectAiWorkspaceTaskEvidence(binding),
      transientInputText,
      inputEvidence: evidence,
    };
  };
}

export function createAiWorkspaceReviewedMultiApplicationMission({
  prepare,
  invokeBrowserWorkflow,
  invokeNativeWorkflow,
  publishAuditEvent = async () => ({ ok: true }),
  now = () => new Date().toISOString(),
} = {}) {
  async function complete({
    status,
    terminalReason,
    taskBinding = null,
    expectedInputEvidence = null,
    applications = [],
    continuationAudit = false,
    continuedToNativeApplication = false,
    browserAttempted = false,
    nativeAttempted = false,
    forceOutcomeUnknown = false,
  }) {
    const counts = aggregateCounts(applications, forceOutcomeUnknown);
    let missionCompletionAudit = false;
    try {
      const accepted = await publishAuditEvent(
        "ai_workspace.reviewed_multi_application_mission_completed",
        {
          registry: AI_WORKSPACE_REVIEWED_MULTI_APPLICATION_MISSION_REGISTRY,
          at: now(),
          status,
          terminalReason,
          taskBinding,
          inputEvidence: expectedInputEvidence,
          applications,
          applicationCount: applications.length,
          continuationAudit,
          continuedToNativeApplication,
          browserAttempted,
          nativeAttempted,
          ...counts,
          maximumApplications: 2,
          maximumProviderCalls: 3,
          maximumActions: 3,
          maximumLifecycleActions: 2,
          automaticRepeat: false,
          taskMutated: false,
          automaticTaskCompletion: false,
        },
      );
      missionCompletionAudit = accepted?.ok === true;
    } catch {
      missionCompletionAudit = false;
    }
    const finalStatus = status === "completed" && !missionCompletionAudit
      ? "completed_audit_unavailable"
      : status;
    const finalReason = status === "completed" && !missionCompletionAudit
      ? "mission_completion_audit_unavailable"
      : terminalReason;
    const bothVerified = applications.length === 2
      && verifiedBrowserWorkflow(applications[0], taskBinding)
      && verifiedNativeWorkflow(applications[1], taskBinding);
    return {
      ok: finalStatus === "completed",
      registry: AI_WORKSPACE_REVIEWED_MULTI_APPLICATION_MISSION_REGISTRY,
      status: finalStatus,
      terminalReason: finalReason,
      applications,
      evidence: {
        taskId: taskBinding?.taskId ?? null,
        objectiveContentHash: taskBinding?.objectiveContentHash ?? null,
        taskVersionHash: taskBinding?.taskVersionHash ?? null,
        inputEvidence: expectedInputEvidence,
        applicationCount: applications.length,
        continuationAudit,
        missionCompletionAudit,
        ...counts,
      },
      governance: {
        explicitOperatorTrigger: true,
        standingAuthorization: true,
        maximumApplications: 2,
        fixedApplicationOrder: ["fixed_browser_form", "fixed_native_intake"],
        browserAttempted,
        nativeAttempted,
        continuationAfterVerifiedBrowserOnly: true,
        continuedToNativeApplication,
        sameReviewedTaskAcrossApplications: bothVerified,
        sameExactObjectiveInputAcrossApplications: bothVerified,
        maximumProviderCalls: 3,
        providerCallCount: counts.providerCallCount,
        maximumActions: 3,
        actionCount: counts.actionCount,
        maximumLifecycleActions: 2,
        lifecycleActionCount: counts.lifecycleActionCount,
        maximumFixedActions: 5,
        fixedActionCount: counts.fixedActionCount,
        automaticRepeat: false,
        retry: false,
        arbitraryApplicationSelection: false,
        arbitraryProcessLaunch: false,
        arbitraryWindowControl: false,
        arbitraryKeyboardInput: false,
        enterKeyInput: false,
        hotkeyInput: false,
        inputTextExposed: false,
        inputTextPersisted: false,
        taskMutated: false,
        automaticTaskCompletion: false,
        createsTask: false,
        createsApproval: false,
        parentDisplayConnected: false,
        mutatesHost: false,
      },
    };
  }

  async function invoke({ taskId } = {}) {
    if (typeof prepare !== "function"
      || typeof invokeBrowserWorkflow !== "function"
      || typeof invokeNativeWorkflow !== "function") {
      return complete({
        status: "runtime_unavailable",
        terminalReason: "multi_application_mission_runtime_unavailable",
      });
    }

    let prepared;
    try {
      prepared = normalisePreparedMission(await prepare({ taskId }));
    } catch {
      prepared = null;
    }
    if (!prepared) {
      return complete({
        status: "precondition_failed",
        terminalReason: "multi_application_mission_precondition_failed",
      });
    }

    const { taskBinding, inputEvidence: expectedInputEvidence } = prepared;
    let transientInputText = prepared.transientInputText;
    let browserResult;
    try {
      browserResult = await invokeBrowserWorkflow({
        taskId,
        expectedTaskBinding: taskBinding,
        expectedInputText: transientInputText,
      });
    } catch {
      transientInputText = null;
      return complete({
        status: "browser_outcome_unknown",
        terminalReason: "browser_workflow_failed",
        taskBinding,
        expectedInputEvidence,
        browserAttempted: true,
        forceOutcomeUnknown: true,
      });
    }
    const browserReceipt = compactBrowserWorkflow(browserResult, expectedInputEvidence);
    if (!verifiedBrowserWorkflow(browserReceipt, taskBinding)) {
      transientInputText = null;
      const known = knownTerminalReceipt(browserReceipt, taskBinding)
        && browserResult?.ok !== true;
      return complete({
        status: known ? "stopped_after_browser" : "browser_outcome_unknown",
        terminalReason: known
          ? "browser_workflow_not_completed"
          : "browser_workflow_result_invalid",
        taskBinding,
        expectedInputEvidence,
        applications: [browserReceipt],
        browserAttempted: true,
        forceOutcomeUnknown: !known,
      });
    }

    let revalidated;
    try {
      revalidated = normalisePreparedMission(await prepare({ taskId }));
    } catch {
      revalidated = null;
    }
    const missionStillCurrent = revalidated
      && sameTaskBinding(taskBinding, revalidated.taskBinding)
      && revalidated.transientInputText === transientInputText
      && inputEvidenceMatches(revalidated.inputEvidence, expectedInputEvidence);
    if (!missionStillCurrent) {
      transientInputText = null;
      return complete({
        status: "stopped_after_browser",
        terminalReason: "multi_application_mission_precondition_changed",
        taskBinding,
        expectedInputEvidence,
        applications: [browserReceipt],
        browserAttempted: true,
      });
    }

    let continuationAudit = false;
    try {
      const accepted = await publishAuditEvent(
        "ai_workspace.reviewed_multi_application_continuation_authorized",
        {
          registry: AI_WORKSPACE_REVIEWED_MULTI_APPLICATION_MISSION_REGISTRY,
          at: now(),
          taskBinding,
          inputEvidence: expectedInputEvidence,
          browserApplication: browserReceipt,
          nextApplication: "fixed_native_intake",
          maximumApplications: 2,
          maximumProviderCalls: 3,
          maximumActions: 3,
          maximumLifecycleActions: 2,
          automaticRepeat: false,
        },
      );
      continuationAudit = accepted?.ok === true;
    } catch {
      continuationAudit = false;
    }
    if (!continuationAudit) {
      transientInputText = null;
      return complete({
        status: "stopped_after_browser",
        terminalReason: "multi_application_continuation_audit_unavailable",
        taskBinding,
        expectedInputEvidence,
        applications: [browserReceipt],
        browserAttempted: true,
      });
    }

    let nativeResult;
    try {
      nativeResult = await invokeNativeWorkflow({
        taskId,
        expectedTaskBinding: taskBinding,
        expectedInputText: transientInputText,
      });
      transientInputText = null;
    } catch {
      transientInputText = null;
      return complete({
        status: "native_outcome_unknown",
        terminalReason: "native_workflow_failed",
        taskBinding,
        expectedInputEvidence,
        applications: [browserReceipt],
        continuationAudit: true,
        continuedToNativeApplication: true,
        browserAttempted: true,
        nativeAttempted: true,
        forceOutcomeUnknown: true,
      });
    }
    const nativeReceipt = compactNativeWorkflow(nativeResult, expectedInputEvidence);
    if (!verifiedNativeWorkflow(nativeReceipt, taskBinding)) {
      const known = knownTerminalReceipt(nativeReceipt, taskBinding)
        && nativeResult?.ok !== true;
      return complete({
        status: known ? "stopped_after_native" : "native_outcome_unknown",
        terminalReason: known
          ? "native_workflow_not_completed"
          : "native_workflow_result_invalid",
        taskBinding,
        expectedInputEvidence,
        applications: [browserReceipt, nativeReceipt],
        continuationAudit: true,
        continuedToNativeApplication: true,
        browserAttempted: true,
        nativeAttempted: true,
        forceOutcomeUnknown: !known,
      });
    }
    return complete({
      status: "completed",
      terminalReason: "verified_browser_then_native_intake",
      taskBinding,
      expectedInputEvidence,
      applications: [browserReceipt, nativeReceipt],
      continuationAudit: true,
      continuedToNativeApplication: true,
      browserAttempted: true,
      nativeAttempted: true,
    });
  }

  return {
    invoke,
    busy: () => complete({
      status: "local_fallback",
      terminalReason: "workspace_run_in_flight",
    }),
  };
}
