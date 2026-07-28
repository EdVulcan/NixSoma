import {
  buildWriteOnlyInputEvidence,
} from "../../../packages/shared-utils/src/work-view-input-evidence.mjs";

export const AI_WORKSPACE_SEMANTIC_TYPE_REGISTRY =
  "nixsoma-ai-workspace-semantic-type-v0";

const SEMANTIC_TYPE_KEYS = new Set([
  "registry", "sceneContentHash", "itemOrdinal", "itemCount", "browserMatched",
  "frameMatched", "sceneMatched", "actionExecuted", "postActionVerified",
  "postFrameSequenceAdvanced", "postFrameChanged", "inputEvidence",
]);
const INPUT_EVIDENCE_KEYS = new Set([
  "registry", "charCount", "byteLength", "maxChars", "truncated", "textExposed", "persisted",
]);

function exactKeys(value, allowed) {
  return value && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).length === allowed.size
    && Object.keys(value).every((key) => allowed.has(key));
}

function inputEvidenceMatches(actual, expected) {
  return exactKeys(actual, INPUT_EVIDENCE_KEYS)
    && [...INPUT_EVIDENCE_KEYS].every((key) => actual[key] === expected[key]);
}

function prepareSemanticType(decision, executionContext) {
  const itemOrdinal = decision?.itemOrdinal;
  const scene = executionContext?.scene;
  const selectedItem = Number.isInteger(itemOrdinal) ? scene?.items?.[itemOrdinal - 1] : null;
  const input = buildWriteOnlyInputEvidence(decision?.inputText);
  if (decision?.actionId !== "type_item"
    || !Number.isInteger(itemOrdinal)
    || itemOrdinal < 1
    || itemOrdinal > (scene?.itemCount ?? 0)
    || !selectedItem
    || selectedItem.disabled === true
    || selectedItem.role !== "textbox"
    || input.text.length < 1
    || input.evidence.truncated) {
    return null;
  }
  return {
    itemOrdinal,
    inputEvidence: input.evidence,
    body: {
      sceneContentSha256: scene.sceneContentSha256,
      itemOrdinal,
      browserPid: scene.browserPid,
      semanticFrame: {
        sha256: scene.frame.sha256,
        sequence: scene.frame.sequence,
      },
      text: input.text,
    },
  };
}

export async function executeAiWorkspaceSemanticType({
  decision,
  executionContext,
  decisionContext,
  taskObjectiveBinding,
  taskObjectiveStillCurrent = () => false,
  providerEvidence,
  screenActUrl,
  postJson,
  publishRequiredAudit,
  now,
} = {}) {
  const prepared = prepareSemanticType(decision, executionContext);
  const taskEvidence = taskObjectiveBinding?.evidence ?? {};
  if (!prepared) {
    return {
      ok: false,
      reason: "semantic_type_not_actionable",
      actionExecuted: false,
    };
  }

  await publishRequiredAudit("ai_workspace.single_step_action_authorized", {
    registry: AI_WORKSPACE_SEMANTIC_TYPE_REGISTRY,
    at: now(),
    contextContentHash: providerEvidence.contextContentHash,
    responseContentHash: providerEvidence.responseContentHash,
    sceneContentHash: decisionContext.scene.sceneContentSha256,
    sceneItemCount: decisionContext.scene.itemCount,
    taskId: taskEvidence.taskId ?? null,
    taskStatus: taskEvidence.taskStatus ?? null,
    objectiveContentHash: taskEvidence.objectiveContentHash ?? null,
    taskVersionHash: taskEvidence.taskVersionHash ?? null,
    actionId: "type_item",
    itemOrdinal: prepared.itemOrdinal,
    inputEvidence: prepared.inputEvidence,
    semanticFrameSha256: prepared.body.semanticFrame.sha256,
    semanticFrameSequence: prepared.body.semanticFrame.sequence,
    maximumActions: 1,
    automaticRepeat: false,
  });
  if (!taskObjectiveStillCurrent()) {
    return {
      ok: false,
      reason: "task_objective_changed",
      actionExecuted: false,
    };
  }

  const response = await postJson(
    `${screenActUrl}/act/keyboard/semantic-type`,
    prepared.body,
    {
      grantContext: {
        taskId: taskEvidence.taskId ?? null,
        stepId: null,
        capabilityId: "act.ai.workspace.single_step",
        intent: "ai.workspace.semantic_type",
      },
    },
  );
  const action = response?.action;
  const semanticType = action?.mediation?.semanticType;
  const executed = action?.kind === "keyboard.type"
    && action.result === "executed-browser-runtime"
    && action.mediation?.accepted === true
    && semanticType?.sceneContentHash === prepared.body.sceneContentSha256
    && semanticType?.itemOrdinal === prepared.itemOrdinal
    && semanticType?.browserMatched === true
    && semanticType?.frameMatched === true
    && semanticType?.sceneMatched === true
    && semanticType?.actionExecuted === true
    && inputEvidenceMatches(semanticType?.inputEvidence, prepared.inputEvidence)
    && inputEvidenceMatches(action.params?.inputEvidence, prepared.inputEvidence)
    && exactKeys(semanticType, SEMANTIC_TYPE_KEYS);
  if (!executed) throw new Error("AI workspace semantic type was not accepted by its owner.");

  let completionAudit = true;
  try {
    await publishRequiredAudit("ai_workspace.single_step_completed", {
      registry: AI_WORKSPACE_SEMANTIC_TYPE_REGISTRY,
      at: now(),
      contextContentHash: providerEvidence.contextContentHash,
      responseContentHash: providerEvidence.responseContentHash,
      sceneContentHash: decisionContext.scene.sceneContentSha256,
      sceneItemCount: decisionContext.scene.itemCount,
      taskId: taskEvidence.taskId ?? null,
      taskStatus: taskEvidence.taskStatus ?? null,
      objectiveContentHash: taskEvidence.objectiveContentHash ?? null,
      taskVersionHash: taskEvidence.taskVersionHash ?? null,
      actionId: "type_item",
      itemOrdinal: prepared.itemOrdinal,
      inputEvidence: prepared.inputEvidence,
      actionExecuted: true,
      postActionVerified: semanticType.postActionVerified === true,
      postFrameSequenceAdvanced: semanticType.postFrameSequenceAdvanced === true,
      postFrameChanged: semanticType.postFrameChanged === true,
      maximumActions: 1,
      automaticRepeat: false,
    });
  } catch {
    completionAudit = false;
  }

  return {
    ok: true,
    status: completionAudit
      ? semanticType.postActionVerified === true
        ? "executed"
        : "executed_post_verification_unavailable"
      : "executed_completion_audit_unavailable",
    action: {
      actionId: "type_item",
      itemOrdinal: prepared.itemOrdinal,
      inputEvidence: prepared.inputEvidence,
      executed: true,
      postActionVerified: semanticType.postActionVerified === true,
    },
    evidence: {
      sceneContentHash: prepared.body.sceneContentSha256,
      sceneItemCount: decisionContext.scene.itemCount,
      itemOrdinal: prepared.itemOrdinal,
      inputEvidence: prepared.inputEvidence,
      actionExecuted: true,
      semanticFrame: { ...prepared.body.semanticFrame },
      postActionVerified: semanticType.postActionVerified === true,
      postFrameSequenceAdvanced: semanticType.postFrameSequenceAdvanced === true,
      postFrameChanged: semanticType.postFrameChanged === true,
      completionAudit,
    },
  };
}
