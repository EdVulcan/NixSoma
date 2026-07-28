import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { Readable } from "node:stream";
import test from "node:test";

import {
  createExecutionGrantSigner,
  createExecutionGrantVerifier,
  executionGrantContextHeaders,
} from "../../../packages/shared-utils/src/execution-grants.mjs";
import { createAiSurfaceActivationRoute } from "../src/ai-surface-activation-route.mjs";

const routePath = "/work-view/surface/activate";
const context = {
  taskId: null,
  stepId: null,
  capabilityId: "act.work_view.control",
  intent: "work_view.surface.activate",
};
const body = {
  operatorActionSource: "capability_runtime_work_view_control",
  recommendedAction: "activate_ai_surface",
  surfaceId: 17,
  inventorySequence: 8,
};

function request(candidate, token) {
  const req = Readable.from([Buffer.from(JSON.stringify(candidate), "utf8")]);
  req.method = "POST";
  req.headers = {
    "x-openclaw-execution-grant": token,
    ...executionGrantContextHeaders(context),
  };
  return req;
}

function harness({ auditOk = true } = {}) {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const signer = createExecutionGrantSigner({
    privateKey: privateKey.export({ type: "pkcs8", format: "pem" }),
    now: () => 1_000,
    createId: () => "surface-activation-grant",
  });
  const verifier = createExecutionGrantVerifier({
    publicKey: publicKey.export({ type: "spki", format: "pem" }),
    audience: "openclaw-session-manager",
    now: () => 1_000,
  });
  const calls = { activations: [], events: [], response: null };
  const controller = {
    async activateSurface(candidate) {
      calls.activations.push(candidate);
      return {
        registry: "nixsoma-ai-surface-activation-v0",
        status: "activated",
        surfaceId: candidate.surfaceId,
        inventorySequenceBefore: candidate.inventorySequence,
        inventorySequenceAfter: candidate.inventorySequence + 1,
        activated: true,
      };
    },
    surfaceActivationSnapshot: () => ({
      registry: "nixsoma-ai-surface-activation-v0",
      status: "not_executed",
    }),
  };
  const route = createAiSurfaceActivationRoute({
    controller,
    executionGrantVerifier: verifier,
    publishEvent: async (name, payload) => {
      calls.events.push({ name, payload });
      return { ok: auditOk };
    },
    createEventName: (name) => name,
    sendJson: (_res, status, responseBody) => { calls.response = { status, body: responseBody }; },
  });
  const token = (candidate = body, path = routePath) => signer.issue({
    audience: "openclaw-session-manager",
    method: "POST",
    path,
    body: candidate,
    context,
  });
  return { route, calls, token };
}

test("surface activation route requires an exact single-use grant and durable audit", async () => {
  const { route, calls, token } = harness();
  const grant = token();
  await route(request(body, grant), {}, new URL(`http://local${routePath}`));
  assert.equal(calls.response.status, 200);
  assert.deepEqual(calls.activations, [{ surfaceId: 17, inventorySequence: 8 }]);
  assert.deepEqual(calls.events.map(({ payload }) => payload.action), [
    "ai-surface-activation-requested",
    "ai-surface-activation-completed",
  ]);
  assert.equal(calls.events[0].payload.surface.titleExposed, false);

  await route(request(body, grant), {}, new URL(`http://local${routePath}`));
  assert.equal(calls.response.status, 403);
  assert.equal(calls.response.body.code, "EXECUTION_GRANT_REPLAYED");
  assert.equal(calls.activations.length, 1);
});

test("surface activation route rejects changed targets and malformed numeric input", async () => {
  const changed = harness();
  await changed.route(
    request({ ...body, surfaceId: 18 }, changed.token()),
    {},
    new URL(`http://local${routePath}`),
  );
  assert.equal(changed.calls.response.status, 403);
  assert.equal(changed.calls.response.body.code, "EXECUTION_GRANT_TARGET_MISMATCH");
  assert.equal(changed.calls.activations.length, 0);

  const malformed = harness();
  const badBody = { ...body, inventorySequence: 0 };
  await malformed.route(
    request(badBody, malformed.token(badBody)),
    {},
    new URL(`http://local${routePath}`),
  );
  assert.equal(malformed.calls.response.status, 400);
  assert.equal(malformed.calls.response.body.code, "AI_SURFACE_ACTIVATION_REQUEST_INVALID");
  assert.equal(malformed.calls.activations.length, 0);
});

test("surface activation route blocks before Weston when audit persistence fails", async () => {
  const { route, calls, token } = harness({ auditOk: false });
  await route(request(body, token()), {}, new URL(`http://local${routePath}`));
  assert.equal(calls.response.status, 503);
  assert.equal(calls.response.body.code, "AI_SURFACE_ACTIVATION_AUDIT_REQUIRED");
  assert.equal(calls.activations.length, 0);
});
