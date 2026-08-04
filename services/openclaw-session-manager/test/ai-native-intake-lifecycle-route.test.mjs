import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";

import { createAiNativeIntakeLifecycleRoute } from "../src/ai-native-intake-lifecycle-route.mjs";

function request(body) {
  const req = Readable.from([Buffer.from(JSON.stringify(body), "utf8")]);
  req.method = "POST";
  req.headers = {};
  return req;
}

function harness() {
  const calls = { start: 0, stop: 0, events: [], response: null };
  const route = createAiNativeIntakeLifecycleRoute({
    lifecycle: {
      start: async () => {
        calls.start += 1;
        return { registry: "nixsoma-ai-native-intake-lifecycle-v0", status: "running" };
      },
      stop: async () => {
        calls.stop += 1;
        return { registry: "nixsoma-ai-native-intake-lifecycle-v0", status: "stopped" };
      },
      snapshot: () => ({ registry: "nixsoma-ai-native-intake-lifecycle-v0", status: "stopped" }),
    },
    executionGrantVerifier: {
      verifyRequest: () => ({
        ok: true,
        grant: {
          issuer: "openclaw-core",
          audience: "openclaw-session-manager",
          grantId: "native-intake-grant",
          taskId: "task-intake-1",
          stepId: null,
          capabilityId: "act.ai.workspace.native_intake_workflow",
          intent: "ai.workspace.native_intake_workflow",
        },
      }),
    },
    publishEvent: async (name, payload) => {
      calls.events.push({ name, payload });
      return { ok: true };
    },
    createEventName: (name) => name,
    sendJson: (_res, status, body) => { calls.response = { status, body }; },
  });
  return { route, calls };
}

test("native intake routes accept only manual control or the fixed workflow source", async () => {
  for (const operatorActionSource of [
    "capability_runtime_work_view_control",
    "ai_workspace_native_intake_workflow",
  ]) {
    const { route, calls } = harness();
    const body = {
      operatorActionSource,
      recommendedAction: "start_ai_native_intake",
    };
    await route(
      request(body),
      {},
      new URL("http://local/work-view/application/native-intake/start"),
    );
    assert.equal(calls.response.status, 200);
    assert.equal(calls.start, 1);
    assert.equal(calls.events[0].payload.action, "ai-native-intake-start-requested");
    assert.equal(
      calls.events[0].payload.application.unitName,
      "nixsoma-ai-native-intake.service",
    );
  }

  const { route, calls } = harness();
  await route(
    request({
      operatorActionSource: "caller_selected_process",
      recommendedAction: "start_ai_native_intake",
    }),
    {},
    new URL("http://local/work-view/application/native-intake/start"),
  );
  assert.equal(calls.response.status, 400);
  assert.equal(calls.response.body.code, "AI_NATIVE_INTAKE_REQUEST_INVALID");
  assert.equal(calls.start, 0);
});
