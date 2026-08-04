import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { buildWorkViewSemanticScene } from "../../../packages/shared-utils/src/work-view-semantic-scene.mjs";
import { buildWriteOnlyInputEvidence } from "../../../packages/shared-utils/src/work-view-input-evidence.mjs";
import { createAiWorkspaceSingleStep } from "../src/ai-workspace-single-step.mjs";

const NOW = "2026-07-28T08:00:00.000Z";
const TASK_ID = "task-reviewed-1";

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function frame(sequence = 4, sha256 = "a".repeat(64)) {
  return {
    registry: "nixsoma-ai-compositor-frame-v0",
    available: true,
    sourceScope: "ai_owned_nested_output_only",
    captureApi: "weston_output_capture_v1",
    socketName: "nixsoma-ai-0",
    mediaType: "image/png",
    encoding: "base64_data_url",
    width: 1280,
    height: 720,
    byteLength: 100,
    sha256,
    capturedAt: NOW,
    sequence,
    browserScreenshotApi: false,
    desktopWideCapture: false,
    parentDisplayConnected: false,
    inputAuthority: false,
    persisted: false,
  };
}

function workView(sequence = 9, pid = 999) {
  const helperRuntime = { status: "active", actionAuthority: "active", leaseMatched: true };
  return {
    workViewId: "work-view-primary",
    status: "prepared",
    helperRuntime,
    trustedSession: {
      sessionIdentity: { status: "authoritative" },
      helperRuntime,
    },
    aiGraphicalSession: {
      ready: true,
      browserAttachment: { attached: true },
      surfaceInventory: {
        available: true,
        socketName: "nixsoma-ai-0",
        sequence,
        count: 1,
        surfaces: [{ surfaceId: 7, width: 1280, height: 720, activated: true, pid }],
      },
    },
  };
}

function reviewedTask(overrides = {}) {
  return {
    id: TASK_ID,
    goal: "Open the Learn more item for NixSoma",
    status: "running",
    updatedAt: NOW,
    policy: { decision: { decision: "allow" } },
    workView: {
      workViewId: "work-view-primary",
      sessionId: "session-current",
      trustedBinding: {
        registry: "openclaw-native-engineering-work-view-bind-v0",
        mode: "operator_reviewed",
        authorityStatus: "authoritative",
        leaseMatched: true,
        boundAt: NOW,
      },
    },
    ...overrides,
  };
}

function semanticScene({
  role = "link",
  name = "Learn more",
  frameSha256 = "c".repeat(64),
  frameSequence = 7,
  browserPid = 999,
  disabled = false,
} = {}) {
  const visualFrame = {
    registry: "openclaw-browser-visual-frame-v0",
    available: true,
    sourceScope: "ai_owned_active_page_only",
    desktopWideCapture: false,
    persisted: false,
    mediaType: "image/jpeg",
    encoding: "base64_data_url",
    width: 960,
    height: 540,
    byteLength: 120,
    sha256: frameSha256,
    capturedAt: NOW,
    sequence: frameSequence,
  };
  return buildWorkViewSemanticScene({
    browser: { running: true, browserPid },
    capture: {
      activeUrl: "https://private.invalid/must-not-egress",
      visualFrame,
      semanticTargets: {
        available: true,
        pageUrl: "https://private.invalid/must-not-egress",
        frame: visualFrame,
        items: [{
          targetId: "PRIVATE_TARGET_ID",
          role,
          name,
          disabled,
          bounds: { x: 120, y: 180, width: 90, height: 24 },
          value: "PRIVATE_INPUT_VALUE",
          selector: "#private-selector",
        }],
      },
    },
    now: Date.parse(NOW),
  });
}

function harness({
  actionId = "scroll_down",
  invalidContext = false,
  changedContext = false,
  changedScene = false,
  changedSemanticFrame = false,
  nonBrowserSurface = false,
  rejectedAuditName = null,
  providerFailureReason = null,
  itemOrdinal = ["click_item", "type_item"].includes(actionId) ? 1 : null,
  inputText = actionId === "type_item" ? "NixSoma" : null,
  sceneName = actionId === "type_item" ? "Search" : "Learn more",
  sceneRole = actionId === "type_item" ? "textbox" : "link",
  disabledTarget = false,
  changedTask = false,
  changedTaskAfterActionAudit = false,
  taskGoal = "Open the Learn more item for NixSoma",
} = {}) {
  const calls = { fetch: [], post: [], audit: [], decision: [], prompt: [], provider: 0 };
  let captureSequence = 4;
  let stateReads = 0;
  let sceneReads = 0;
  let taskReads = 0;
  const standingAdvisory = {
    config: { maxCallsPerDay: 3, maxTokensPerDay: 4096 },
    state: { day: "2026-07-28", callsUsed: 1, tokensUsed: 1024 },
    async requestDecision(options) {
      calls.decision.push(options);
      let context;
      try {
        context = await options.buildContext(NOW);
      } catch {
        return { ok: false, reason: "context_unavailable" };
      }
      const prompt = options.buildPrompt(context);
      calls.prompt.push(prompt);
      calls.provider += 1;
      assert.equal(prompt.includes(sceneName), true);
      assert.equal(prompt.includes(taskGoal), true);
      assert.equal(prompt.includes(TASK_ID), false);
      assert.equal(prompt.includes("session-current"), false);
      assert.equal(prompt.includes("pid"), false);
      assert.equal(prompt.includes("sha256"), false);
      assert.equal(prompt.includes("data:image"), false);
      assert.equal(prompt.includes("https://private.invalid"), false);
      assert.equal(prompt.includes("PRIVATE_TARGET_ID"), false);
      assert.equal(prompt.includes("PRIVATE_INPUT_VALUE"), false);
      assert.equal(prompt.includes("#private-selector"), false);
      const contextContentHash = hash(JSON.stringify(context));
      if (providerFailureReason) {
        return {
          ok: false,
          reason: providerFailureReason,
          evidence: {
            contextContentHash,
            requestContentHash: "b".repeat(64),
            responseContentHash: "d".repeat(64),
            budget: { callsUsed: 2, callsLimit: 3, tokensUsed: 1104, tokensLimit: 4096 },
          },
        };
      }
      const assistantContent = JSON.stringify({
        actionId,
        itemOrdinal,
        inputText,
        reason: "Bounded test decision.",
        confidence: 0.8,
      });
      const parsed = options.parseResponse({
        contract: options.responseContract,
        assistantContent,
        responseContentHash: hash(assistantContent),
      });
      return {
        ok: true,
        parsed,
        evidence: {
          contextContentHash,
          requestContentHash: "b".repeat(64),
          responseContentHash: hash(assistantContent),
          actionId,
          model: "deepseek-chat",
          usage: { total_tokens: 80 },
          budget: { callsUsed: 1, callsLimit: 3, tokensUsed: 1024, tokensLimit: 4096 },
        },
      };
    },
  };
  const owner = createAiWorkspaceSingleStep({
    standingAdvisory,
    sessionManagerUrl: "http://127.0.0.1:4102",
    screenSenseUrl: "http://127.0.0.1:4104",
    screenActUrl: "http://127.0.0.1:4105",
    now: () => NOW,
    getTaskById: (taskId) => {
      taskReads += 1;
      if (taskId !== TASK_ID) return null;
      return reviewedTask({
        goal: (changedTask && taskReads > 1) || (changedTaskAfterActionAudit && taskReads > 2)
          ? "Open the Documentation item for NixSoma"
          : taskGoal,
        updatedAt: (changedTask && taskReads > 1) || (changedTaskAfterActionAudit && taskReads > 2)
          ? "2026-07-28T08:00:01.000Z"
          : NOW,
      });
    },
    fetchJson: async (url) => {
      calls.fetch.push(url);
      if (url.endsWith("/work-view/compositor-frame")) {
        captureSequence += 1;
        return { ok: true, frame: frame(captureSequence, String(captureSequence).padStart(64, "a")) };
      }
      if (url.endsWith("/work-view/state")) {
        stateReads += 1;
        const value = workView(
          changedContext && stateReads > 1 ? 10 : 9,
          nonBrowserSurface ? 1000 : 999,
        );
        if (invalidContext) value.helperRuntime.actionAuthority = "suspended";
        return {
          ok: true,
          session: { sessionId: "session-current", status: "running", role: "ai-work-view" },
          workView: value,
        };
      }
      if (url.endsWith("/screen/semantic-scene")) {
        sceneReads += 1;
        return {
          ok: true,
          scene: semanticScene({
            role: sceneRole,
            name: changedScene && sceneReads > 1 ? "Changed scene" : sceneName,
            frameSha256: changedSemanticFrame && sceneReads > 1
              ? "d".repeat(64)
              : "c".repeat(64),
            frameSequence: changedSemanticFrame && sceneReads > 1 ? 8 : 7,
            disabled: disabledTarget,
          }),
        };
      }
      throw new Error(`unexpected fetch: ${url}`);
    },
    postJson: async (url, body, options) => {
      calls.post.push({ url, body, options });
      if (url.endsWith("/act/keyboard/semantic-type")) {
        const inputEvidence = buildWriteOnlyInputEvidence(body.text).evidence;
        return {
          ok: true,
          action: {
            kind: "keyboard.type",
            params: {
              sceneContentSha256: body.sceneContentSha256,
              itemOrdinal: body.itemOrdinal,
              browserPid: body.browserPid,
              semanticFrame: body.semanticFrame,
              inputEvidence,
            },
            result: "executed-browser-runtime",
            mediation: {
              accepted: true,
              semanticType: {
                registry: "nixsoma-ai-browser-semantic-scene-type-resolution-v0",
                sceneContentHash: body.sceneContentSha256,
                itemOrdinal: body.itemOrdinal,
                itemCount: 1,
                browserMatched: true,
                frameMatched: true,
                sceneMatched: true,
                actionExecuted: true,
                postActionVerified: true,
                postFrameSequenceAdvanced: true,
                postFrameChanged: true,
                inputEvidence,
              },
            },
          },
        };
      }
      if (url.endsWith("/act/mouse/semantic-click")) {
        return {
          ok: true,
          action: {
            kind: "mouse.semantic_click",
            result: "executed-browser-runtime",
            mediation: {
              accepted: true,
              semanticClick: {
                registry: "nixsoma-ai-browser-semantic-scene-click-resolution-v0",
                sceneContentHash: body.sceneContentSha256,
                itemOrdinal: body.itemOrdinal,
                itemCount: 1,
                browserMatched: true,
                frameMatched: true,
                sceneMatched: true,
                actionExecuted: true,
                postActionVerified: true,
                postFrameSequenceAdvanced: true,
                postFrameChanged: true,
              },
            },
          },
        };
      }
      return {
        ok: true,
        action: {
          result: "executed-ai-compositor",
          mediation: {
            accepted: true,
            nativeInput: {
              operation: "pointer_scroll",
              direction: body.direction,
              surfaceId: body.surfaceId,
              inventorySequence: body.inventorySequence,
              frame: { sha256: body.compositorFrame.sha256, sequence: body.compositorFrame.sequence },
              postFrame: { sha256: "f".repeat(64), sequence: body.compositorFrame.sequence + 1 },
              receiptMatched: true,
              inventoryMatched: true,
              surfaceMatched: true,
              frameChanged: true,
            },
          },
        },
      };
    },
    publishAuditEvent: async (name, payload) => {
      calls.audit.push({ name, payload });
      return { ok: name !== rejectedAuditName };
    },
  });
  return { owner, calls };
}

test("AI workspace single-step executes one provider-selected governed scroll", async () => {
  const { owner, calls } = harness();

  const result = await owner.invoke({ taskId: TASK_ID });

  assert.equal(result.status, "executed");
  assert.equal(result.action.actionId, "scroll_down");
  assert.equal(result.action.executed, true);
  assert.equal(result.governance.maximumActions, 1);
  assert.equal(result.governance.automaticRepeat, false);
  assert.equal(result.governance.currentActiveSurfaceBound, true);
  assert.equal(result.governance.semanticSceneBound, true);
  assert.equal(result.governance.currentBrowserSurfaceBound, true);
  assert.equal(result.governance.taskObjectiveBound, true);
  assert.equal(result.governance.taskObjectiveProviderEgress, true);
  assert.equal(result.governance.rawTaskGoalProviderEgress, false);
  assert.equal(result.governance.pixelsProviderEgress, false);
  assert.equal(result.governance.urlsProviderEgress, false);
  assert.equal(result.governance.inputValuesProviderEgress, false);
  assert.match(result.evidence.sceneContentHash, /^[a-f0-9]{64}$/u);
  assert.equal(result.evidence.sceneItemCount, 1);
  assert.equal(result.evidence.taskId, TASK_ID);
  assert.equal(result.evidence.taskStatus, "running");
  assert.match(result.evidence.objectiveContentHash, /^[a-f0-9]{64}$/u);
  assert.match(result.evidence.taskVersionHash, /^[a-f0-9]{64}$/u);
  assert.equal(calls.decision[0].auditPayload.taskId, TASK_ID);
  assert.equal(calls.decision[0].auditPayload.objectiveContentHash, result.evidence.objectiveContentHash);
  assert.equal(calls.post.length, 1);
  assert.equal(calls.post[0].url, "http://127.0.0.1:4105/act/mouse/scroll");
  assert.equal(calls.post[0].body.direction, "down");
  assert.deepEqual(calls.post[0].options.grantContext, {
    taskId: TASK_ID,
    stepId: null,
    capabilityId: "act.screen.pointer_keyboard",
    intent: "mouse.scroll",
  });
  assert.deepEqual(calls.audit.map((item) => item.name), [
    "ai_workspace.single_step_action_authorized",
    "ai_workspace.single_step_completed",
  ]);
  assert.equal(JSON.stringify(result).includes("pid"), false);
  const auditJson = JSON.stringify(calls.audit);
  assert.equal(auditJson.includes("Learn more"), false);
  assert.equal(auditJson.includes("Bounded test decision"), false);
  assert.equal(auditJson.includes("999"), false);
});

test("AI workspace single-step honors provider no-op without actuator contact", async () => {
  const { owner, calls } = harness({ actionId: "no_op" });

  const result = await owner.invoke({ taskId: TASK_ID });

  assert.equal(result.status, "no_op");
  assert.equal(result.evidence.actionExecuted, false);
  assert.equal(result.evidence.sceneItemCount, 1);
  assert.equal(result.governance.sceneContentProviderEgress, true);
  assert.equal(calls.post.length, 0);
  assert.deepEqual(calls.audit.map((item) => item.name), ["ai_workspace.single_step_completed"]);
});

test("AI workspace single-step executes one provider-selected semantic item without target authority", async () => {
  const { owner, calls } = harness({ actionId: "click_item", itemOrdinal: 1 });

  const result = await owner.invoke({ taskId: TASK_ID });

  assert.equal(result.status, "executed");
  assert.equal(result.action.actionId, "click_item");
  assert.equal(result.action.itemOrdinal, 1);
  assert.equal(result.action.executed, true);
  assert.equal(result.evidence.postActionVerified, true);
  assert.equal(result.governance.semanticItemOrdinalBound, true);
  assert.equal(calls.post.length, 1);
  assert.equal(calls.post[0].url, "http://127.0.0.1:4105/act/mouse/semantic-click");
  assert.equal(calls.post[0].body.itemOrdinal, 1);
  assert.equal("semanticTarget" in calls.post[0].body, false);
  assert.deepEqual(calls.post[0].options.grantContext, {
    taskId: TASK_ID,
    stepId: null,
    capabilityId: "act.ai.workspace.single_step",
    intent: "ai.workspace.semantic_click",
  });
  const durableJson = JSON.stringify({ result, audit: calls.audit });
  assert.equal(durableJson.includes("PRIVATE_TARGET_ID"), false);
  assert.equal(durableJson.includes("#private-selector"), false);
  assert.equal(durableJson.includes('"semanticTarget"'), false);
});

test("AI workspace single-step executes one provider-selected write-only semantic type", async () => {
  const privateInput = "NixSoma";
  const { owner, calls } = harness({
    actionId: "type_item",
    itemOrdinal: 1,
    inputText: privateInput,
    sceneName: "Search",
    sceneRole: "textbox",
    taskGoal: "Enter NixSoma in the Search textbox",
  });

  const result = await owner.invoke({ taskId: TASK_ID });

  assert.equal(result.status, "executed");
  assert.equal(result.action.actionId, "type_item");
  assert.equal(result.action.itemOrdinal, 1);
  assert.equal(result.action.inputEvidence.charCount, privateInput.length);
  assert.equal(result.action.executed, true);
  assert.equal(result.governance.keyboardInput, true);
  assert.equal(result.governance.providerGeneratedInput, true);
  assert.equal(result.governance.inputTextPersisted, false);
  assert.equal(calls.post.length, 1);
  assert.equal(calls.post[0].url, "http://127.0.0.1:4105/act/keyboard/semantic-type");
  assert.equal(calls.post[0].body.text, privateInput);
  assert.equal(calls.post[0].body.itemOrdinal, 1);
  assert.deepEqual(calls.post[0].options.grantContext, {
    taskId: TASK_ID,
    stepId: null,
    capabilityId: "act.ai.workspace.single_step",
    intent: "ai.workspace.semantic_type",
  });
  const durableJson = JSON.stringify({ result, audit: calls.audit });
  assert.equal(durableJson.includes(privateInput), false);
  assert.equal(durableJson.includes('"inputText"'), false);
  assert.equal(durableJson.includes("PRIVATE_INPUT_VALUE"), false);
  assert.equal(durableJson.includes("PRIVATE_TARGET_ID"), false);
});

test("AI workspace single-step rejects a disabled provider selection before actuator contact", async () => {
  const { owner, calls } = harness({
    actionId: "click_item",
    itemOrdinal: 1,
    disabledTarget: true,
  });

  const result = await owner.invoke({ taskId: TASK_ID });

  assert.equal(result.status, "local_fallback");
  assert.equal(result.fallback.reason, "ai_workspace_single_step_semantic_click_not_actionable");
  assert.equal(result.evidence.completionAudit, true);
  assert.equal(calls.post.length, 0);
  assert.deepEqual(calls.audit.map((item) => item.name), ["ai_workspace.single_step_completed"]);
  assert.equal(calls.audit[0].payload.fallbackReason, result.fallback.reason);
  assert.equal(calls.audit[0].payload.actionExecuted, false);
});

test("AI workspace single-step revalidates changed semantic content before no-op completion", async () => {
  const { owner, calls } = harness({ actionId: "no_op", changedScene: true });

  const result = await owner.invoke({ taskId: TASK_ID });

  assert.equal(result.status, "local_fallback");
  assert.equal(result.fallback.reason, "ai_workspace_single_step_execution_context_changed");
  assert.equal(result.governance.providerCalled, true);
  assert.equal(result.evidence.completionAudit, true);
  assert.equal(calls.post.length, 0);
  assert.deepEqual(calls.audit.map((item) => item.name), ["ai_workspace.single_step_completed"]);
});

test("AI workspace single-step revalidates the task objective before actuator contact", async () => {
  const { owner, calls } = harness({ changedTask: true });

  const result = await owner.invoke({ taskId: TASK_ID });

  assert.equal(result.status, "local_fallback");
  assert.equal(result.fallback.reason, "ai_workspace_single_step_task_objective_changed");
  assert.equal(result.governance.providerCalled, true);
  assert.equal(result.evidence.taskId, TASK_ID);
  assert.equal(calls.provider, 1);
  assert.equal(calls.post.length, 0);
  assert.deepEqual(calls.audit.map((item) => item.name), ["ai_workspace.single_step_completed"]);
});

test("AI workspace single-step rejects an expected task binding before provider egress", async () => {
  const { owner, calls } = harness();

  const result = await owner.invoke({
    taskId: TASK_ID,
    expectedTaskBinding: {
      taskId: TASK_ID,
      objectiveContentHash: "0".repeat(64),
      taskVersionHash: "1".repeat(64),
    },
  });

  assert.equal(result.status, "local_fallback");
  assert.equal(result.fallback.reason, "ai_workspace_single_step_context_unavailable");
  assert.equal(result.governance.providerCalled, false);
  assert.equal(calls.provider, 0);
  assert.equal(calls.post.length, 0);
});

test("AI workspace single-step rejects unsafe task text before provider egress", async () => {
  const { owner, calls } = harness({
    taskGoal: "Open https://private.invalid and use api_key=secret-value",
  });

  const result = await owner.invoke({ taskId: TASK_ID });

  assert.equal(result.status, "local_fallback");
  assert.equal(result.fallback.reason, "ai_workspace_single_step_context_unavailable");
  assert.equal(result.governance.providerCalled, false);
  assert.equal(calls.provider, 0);
  assert.equal(calls.post.length, 0);
  assert.equal(calls.audit.length, 0);
});

test("AI workspace single-step rechecks task binding after action audit", async () => {
  for (const actionId of ["scroll_down", "click_item", "type_item"]) {
    const { owner, calls } = harness({
      actionId,
      itemOrdinal: ["click_item", "type_item"].includes(actionId) ? 1 : null,
      changedTaskAfterActionAudit: true,
      sceneRole: actionId === "type_item" ? "textbox" : "link",
      sceneName: actionId === "type_item" ? "Search" : "Learn more",
      taskGoal: actionId === "type_item"
        ? "Enter NixSoma in the Search textbox"
        : "Open the Learn more item for NixSoma",
    });

    const result = await owner.invoke({ taskId: TASK_ID });

    assert.equal(result.status, "local_fallback");
    assert.equal(result.fallback.reason, "ai_workspace_single_step_task_objective_changed");
    assert.equal(result.governance.providerCalled, true);
    assert.equal(calls.post.length, 0);
    assert.deepEqual(calls.audit.map((item) => item.name), [
      "ai_workspace.single_step_action_authorized",
      "ai_workspace.single_step_completed",
    ]);
  }
});

test("AI workspace single-step fails local before provider when authority is not ready", async () => {
  const { owner, calls } = harness({ invalidContext: true });

  const result = await owner.invoke({ taskId: TASK_ID });

  assert.equal(result.status, "local_fallback");
  assert.equal(result.fallback.reason, "ai_workspace_single_step_context_unavailable");
  assert.equal(result.governance.providerCalled, false);
  assert.equal(calls.provider, 0);
  assert.equal(calls.post.length, 0);
  assert.equal(calls.audit.length, 0);
});

test("AI workspace single-step rejects a non-browser active surface before provider egress", async () => {
  const { owner, calls } = harness({ nonBrowserSurface: true });

  const result = await owner.invoke({ taskId: TASK_ID });

  assert.equal(result.status, "local_fallback");
  assert.equal(result.fallback.reason, "ai_workspace_single_step_context_unavailable");
  assert.equal(result.governance.providerCalled, false);
  assert.equal(calls.provider, 0);
  assert.equal(calls.post.length, 0);
});

test("AI workspace single-step rejects changed inventory before actuator contact", async () => {
  const { owner, calls } = harness({ changedContext: true });

  const result = await owner.invoke({ taskId: TASK_ID });

  assert.equal(result.status, "local_fallback");
  assert.equal(result.fallback.reason, "ai_workspace_single_step_execution_context_changed");
  assert.equal(result.governance.providerCalled, true);
  assert.equal(result.governance.networkEgress, true);
  assert.equal(result.governance.sceneContentProviderEgress, true);
  assert.match(result.evidence.sceneContentHash, /^[a-f0-9]{64}$/u);
  assert.equal(calls.post.length, 0);
});

test("AI workspace single-step rejects changed semantic content before actuator contact", async () => {
  const { owner, calls } = harness({ changedScene: true });

  const result = await owner.invoke({ taskId: TASK_ID });

  assert.equal(result.status, "local_fallback");
  assert.equal(result.fallback.reason, "ai_workspace_single_step_execution_context_changed");
  assert.equal(result.governance.providerCalled, true);
  assert.equal(calls.post.length, 0);
});

test("AI workspace single-step rebinds unchanged semantic content to the refreshed frame", async () => {
  const { owner, calls } = harness({
    actionId: "click_item",
    itemOrdinal: 1,
    changedSemanticFrame: true,
  });

  const result = await owner.invoke({ taskId: TASK_ID });

  assert.equal(result.status, "executed");
  assert.equal(result.governance.providerCalled, true);
  assert.equal(result.governance.semanticSceneBound, true);
  assert.equal(calls.post.length, 1);
  assert.equal(calls.post[0].body.semanticFrame.sha256, "d".repeat(64));
  assert.equal(calls.post[0].body.semanticFrame.sequence, 8);
});

test("AI workspace single-step preserves provider egress evidence after response rejection", async () => {
  const { owner, calls } = harness({ providerFailureReason: "response_invalid" });

  const result = await owner.invoke({ taskId: TASK_ID });

  assert.equal(result.status, "local_fallback");
  assert.equal(result.fallback.reason, "ai_workspace_single_step_response_invalid");
  assert.equal(result.governance.providerCalled, true);
  assert.equal(result.governance.networkEgress, true);
  assert.equal(result.governance.semanticSceneBound, true);
  assert.equal(result.governance.sceneContentProviderEgress, true);
  assert.match(result.evidence.contextContentHash, /^[a-f0-9]{64}$/u);
  assert.match(result.evidence.sceneContentHash, /^[a-f0-9]{64}$/u);
  assert.equal(result.evidence.sceneItemCount, 1);
  assert.equal(result.evidence.budget.callsUsed, 2);
  assert.equal(result.evidence.completionAudit, true);
  assert.equal(calls.post.length, 0);
  assert.deepEqual(calls.audit.map((item) => item.name), ["ai_workspace.single_step_completed"]);
  assert.equal(JSON.stringify(calls.audit).includes('"inputText"'), false);
});

test("AI workspace single-step reports a known provider fallback when terminal audit is unavailable", async () => {
  const { owner, calls } = harness({
    providerFailureReason: "response_invalid",
    rejectedAuditName: "ai_workspace.single_step_completed",
  });

  const result = await owner.invoke({ taskId: TASK_ID });

  assert.equal(result.status, "local_fallback");
  assert.equal(result.fallback.reason, "ai_workspace_single_step_response_invalid");
  assert.equal(result.governance.providerCalled, true);
  assert.equal(result.evidence.completionAudit, false);
  assert.equal(calls.audit.length, 1);
  assert.equal(calls.post.length, 0);
});

test("AI workspace single-step requires action audit before actuator contact", async () => {
  const { owner, calls } = harness({
    rejectedAuditName: "ai_workspace.single_step_action_authorized",
  });

  await assert.rejects(owner.invoke({ taskId: TASK_ID }), /required AI workspace single-step audit/u);
  assert.equal(calls.post.length, 0);
});

test("AI workspace single-step does not retry an executed action when completion audit fails", async () => {
  const { owner, calls } = harness({
    rejectedAuditName: "ai_workspace.single_step_completed",
  });

  const result = await owner.invoke({ taskId: TASK_ID });

  assert.equal(result.status, "executed_completion_audit_unavailable");
  assert.equal(result.evidence.actionExecuted, true);
  assert.equal(result.evidence.completionAudit, false);
  assert.equal(calls.post.length, 1);
});

test("AI workspace semantic click does not retry when completion audit fails", async () => {
  const { owner, calls } = harness({
    actionId: "click_item",
    itemOrdinal: 1,
    rejectedAuditName: "ai_workspace.single_step_completed",
  });

  const result = await owner.invoke({ taskId: TASK_ID });

  assert.equal(result.status, "executed_completion_audit_unavailable");
  assert.equal(result.evidence.actionExecuted, true);
  assert.equal(result.evidence.completionAudit, false);
  assert.equal(calls.post.length, 1);
});

test("AI workspace semantic type does not retry or expose input when completion audit fails", async () => {
  const { owner, calls } = harness({
    actionId: "type_item",
    itemOrdinal: 1,
    sceneRole: "textbox",
    sceneName: "Search",
    taskGoal: "Enter NixSoma in the Search textbox",
    rejectedAuditName: "ai_workspace.single_step_completed",
  });

  const result = await owner.invoke({ taskId: TASK_ID });

  assert.equal(result.status, "executed_completion_audit_unavailable");
  assert.equal(result.evidence.actionExecuted, true);
  assert.equal(result.evidence.completionAudit, false);
  assert.equal(calls.post.length, 1);
  assert.equal(JSON.stringify({ result, audit: calls.audit }).includes("NixSoma"), false);
});

test("AI workspace semantic-submit mode reuses one eligible semantic click", async () => {
  const { owner, calls } = harness({
    actionId: "click_item",
    itemOrdinal: 1,
    sceneRole: "button",
    sceneName: "Submit form",
    taskGoal: "Submit the completed form",
  });

  const result = await owner.invoke({
    taskId: TASK_ID,
    decisionMode: "semantic_submit",
  });

  assert.equal(result.status, "executed");
  assert.equal(result.action.actionId, "click_item");
  assert.equal(result.governance.semanticSubmitMode, true);
  assert.equal(result.governance.semanticSubmitTargetBound, true);
  assert.deepEqual(calls.decision[0].auditEventName,
    "cloud_provider.ai_workspace_semantic_submit_egress_authorized");
  assert.deepEqual(calls.post[0].options.grantContext, {
    taskId: TASK_ID,
    stepId: null,
    capabilityId: "act.ai.workspace.semantic_submit",
    intent: "ai.workspace.semantic_click",
  });
});

test("AI workspace semantic-submit mode rejects non-submit targets before actuator contact", async () => {
  const { owner, calls } = harness({
    actionId: "click_item",
    itemOrdinal: 1,
    sceneRole: "button",
    sceneName: "Cancel",
    taskGoal: "Submit the completed form",
  });

  const result = await owner.invoke({
    taskId: TASK_ID,
    decisionMode: "semantic_submit",
  });

  assert.equal(result.status, "local_fallback");
  assert.equal(result.fallback.reason,
    "ai_workspace_single_step_semantic_submit_target_not_eligible");
  assert.equal(calls.post.length, 0);
});

test("AI workspace semantic-form type mode permits only one write-only type", async () => {
  const taskGoal = "Type NixSoma into Search, then submit the form";
  const typed = harness({
    actionId: "type_item",
    sceneRole: "textbox",
    sceneName: "Search",
    inputText: "NixSoma",
    taskGoal,
  });

  const result = await typed.owner.invoke({
    taskId: TASK_ID,
    decisionMode: "semantic_form_type",
  });

  assert.equal(result.status, "executed");
  assert.equal(result.action.actionId, "type_item");
  assert.equal(result.governance.semanticFormTypeMode, true);
  assert.equal(result.governance.keyboardInput, true);
  assert.equal(result.governance.inputTextPersisted, false);
  assert.equal(typed.calls.decision[0].auditEventName,
    "cloud_provider.ai_workspace_semantic_form_type_egress_authorized");
  assert.deepEqual(typed.calls.post[0].options.grantContext, {
      taskId: TASK_ID,
      stepId: null,
      capabilityId: "act.ai.workspace.single_step",
      intent: "ai.workspace.semantic_type",
  });
  assert.equal(JSON.stringify(result).includes("NixSoma"), false);

  const clicked = harness({
    actionId: "click_item",
    sceneRole: "button",
    sceneName: "Submit form",
    taskGoal,
  });
  const rejected = await clicked.owner.invoke({
    taskId: TASK_ID,
    decisionMode: "semantic_form_type",
  });
  assert.equal(rejected.status, "local_fallback");
  assert.equal(rejected.fallback.reason,
    "ai_workspace_single_step_semantic_form_type_action_not_allowed");
  assert.equal(clicked.calls.post.length, 0);
});

test("AI workspace semantic-form type mode enforces one internal exact input", async () => {
  const typed = harness({
    actionId: "type_item",
    sceneRole: "textbox",
    sceneName: "Search",
    inputText: "different",
    taskGoal: "Enter the reviewed mission value",
  });

  const result = await typed.owner.invoke({
    taskId: TASK_ID,
    decisionMode: "semantic_form_type",
    expectedInputText: "MISSION_7",
  });

  assert.equal(result.status, "local_fallback");
  assert.equal(result.fallback.reason,
    "ai_workspace_single_step_semantic_form_input_not_objective_bound");
  assert.equal(typed.calls.post.length, 0);
  assert.equal(JSON.stringify(result).includes("MISSION_7"), false);
  assert.equal(JSON.stringify(result).includes("expectedInputText"), false);
});
