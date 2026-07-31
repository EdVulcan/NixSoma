export const AI_WORKSPACE_SEMANTIC_CLICK_REGISTRY =
  "nixsoma-ai-workspace-semantic-click-v0";

const SEMANTIC_CLICK_KEYS = new Set([
  "registry", "sceneContentHash", "itemOrdinal", "itemCount", "browserMatched",
  "frameMatched", "sceneMatched", "actionExecuted", "postActionVerified",
  "postFrameSequenceAdvanced", "postFrameChanged",
]);

function exactKeys(value, allowed) {
  return value && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).length === allowed.size
    && Object.keys(value).every((key) => allowed.has(key));
}

function prepareSemanticClick(decision, executionContext) {
  const itemOrdinal = decision?.itemOrdinal;
  const scene = executionContext?.scene;
  const selectedItem = Number.isInteger(itemOrdinal) ? scene?.items?.[itemOrdinal - 1] : null;
  if (decision?.actionId !== "click_item"
    || !Number.isInteger(itemOrdinal)
    || itemOrdinal < 1
    || itemOrdinal > (scene?.itemCount ?? 0)
    || !selectedItem
    || selectedItem.disabled === true) {
    return null;
  }
  return {
    itemOrdinal,
    body: {
      sceneContentSha256: scene.sceneContentSha256,
      itemOrdinal,
      browserPid: scene.browserPid,
      semanticFrame: {
        sha256: scene.frame.sha256,
        sequence: scene.frame.sequence,
      },
    },
  };
}

export async function executeAiWorkspaceSemanticClick({
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
  grantCapabilityId = "act.ai.workspace.single_step",
} = {}) {
  const prepared = prepareSemanticClick(decision, executionContext);
  const taskEvidence = taskObjectiveBinding?.evidence ?? {};
  if (!prepared) {
    return {
      ok: false,
      reason: "semantic_click_not_actionable",
      actionExecuted: false,
    };
  }

  await publishRequiredAudit("ai_workspace.single_step_action_authorized", {
    registry: AI_WORKSPACE_SEMANTIC_CLICK_REGISTRY,
    at: now(),
    contextContentHash: providerEvidence.contextContentHash,
    responseContentHash: providerEvidence.responseContentHash,
    sceneContentHash: decisionContext.scene.sceneContentSha256,
    sceneItemCount: decisionContext.scene.itemCount,
    taskId: taskEvidence.taskId ?? null,
    taskStatus: taskEvidence.taskStatus ?? null,
    objectiveContentHash: taskEvidence.objectiveContentHash ?? null,
    taskVersionHash: taskEvidence.taskVersionHash ?? null,
    actionId: "click_item",
    itemOrdinal: prepared.itemOrdinal,
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
    `${screenActUrl}/act/mouse/semantic-click`,
    prepared.body,
    {
      grantContext: {
        taskId: taskEvidence.taskId ?? null,
        stepId: null,
        capabilityId: grantCapabilityId,
        intent: "ai.workspace.semantic_click",
      },
    },
  );
  const action = response?.action;
  const semanticClick = action?.mediation?.semanticClick;
  const executed = action?.kind === "mouse.semantic_click"
    && action.result === "executed-browser-runtime"
    && action.mediation?.accepted === true
    && semanticClick?.sceneContentHash === prepared.body.sceneContentSha256
    && semanticClick?.itemOrdinal === prepared.itemOrdinal
    && semanticClick?.browserMatched === true
    && semanticClick?.frameMatched === true
    && semanticClick?.sceneMatched === true
    && semanticClick?.actionExecuted === true
    && exactKeys(semanticClick, SEMANTIC_CLICK_KEYS);
  if (!executed) throw new Error("AI workspace semantic click was not accepted by its owner.");

  let completionAudit = true;
  try {
    await publishRequiredAudit("ai_workspace.single_step_completed", {
      registry: AI_WORKSPACE_SEMANTIC_CLICK_REGISTRY,
      at: now(),
      contextContentHash: providerEvidence.contextContentHash,
      responseContentHash: providerEvidence.responseContentHash,
      sceneContentHash: decisionContext.scene.sceneContentSha256,
      sceneItemCount: decisionContext.scene.itemCount,
      taskId: taskEvidence.taskId ?? null,
      taskStatus: taskEvidence.taskStatus ?? null,
      objectiveContentHash: taskEvidence.objectiveContentHash ?? null,
      taskVersionHash: taskEvidence.taskVersionHash ?? null,
      actionId: "click_item",
      itemOrdinal: prepared.itemOrdinal,
      actionExecuted: true,
      postActionVerified: semanticClick.postActionVerified === true,
      postFrameSequenceAdvanced: semanticClick.postFrameSequenceAdvanced === true,
      postFrameChanged: semanticClick.postFrameChanged === true,
      maximumActions: 1,
      automaticRepeat: false,
    });
  } catch {
    completionAudit = false;
  }

  return {
    ok: true,
    status: completionAudit
      ? semanticClick.postActionVerified === true
        ? "executed"
        : "executed_post_verification_unavailable"
      : "executed_completion_audit_unavailable",
    action: {
      actionId: "click_item",
      itemOrdinal: prepared.itemOrdinal,
      executed: true,
      postActionVerified: semanticClick.postActionVerified === true,
    },
    evidence: {
      sceneContentHash: prepared.body.sceneContentSha256,
      sceneItemCount: decisionContext.scene.itemCount,
      itemOrdinal: prepared.itemOrdinal,
      actionExecuted: true,
      semanticFrame: { ...prepared.body.semanticFrame },
      postActionVerified: semanticClick.postActionVerified === true,
      postFrameSequenceAdvanced: semanticClick.postFrameSequenceAdvanced === true,
      postFrameChanged: semanticClick.postFrameChanged === true,
      completionAudit,
    },
  };
}
