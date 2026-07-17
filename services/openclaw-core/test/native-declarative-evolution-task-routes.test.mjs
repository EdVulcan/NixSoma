import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";

import { handleNativeDeclarativeEvolutionTaskRoute } from "../src/native-declarative-evolution-task-routes.mjs";

async function invoke(method, pathname, body, planBuilder) {
  const req = Readable.from([Buffer.from(JSON.stringify(body))]);
  req.method = method;
  req.headers = {};
  let statusCode = null;
  let payload = "";
  const res = {
    writeHead(code) {
      statusCode = code;
    },
    end(chunk = "") {
      payload = String(chunk);
    },
  };
  const handled = await handleNativeDeclarativeEvolutionTaskRoute({
    req,
    res,
    requestUrl: new URL(pathname, "http://127.0.0.1:4100"),
    planBuilder,
    serialiseTask: (task) => ({ id: task.id, status: task.status }),
    serialiseApproval: (approval) => ({ id: approval.id, status: approval.status }),
    buildTaskSummary: () => ({ total: 1 }),
  });
  return { handled, statusCode, body: payload ? JSON.parse(payload) : null };
}

test("declarative evolution staging task route forwards only structured changes and confirmation", async () => {
  let observed = null;
  const response = await invoke(
    "POST",
    "/plugins/native-adapter/declarative-evolution/staging-tasks",
    { changes: [{ operation: "enable_component", component: "core" }], confirm: "yes" },
    {
      createNativeDeclarativeEvolutionStagingTask: async (input) => {
        observed = input;
        return {
          registry: "openclaw-native-declarative-evolution-staging-task-v0",
          mode: "approval-gated",
          generatedAt: "2026-07-17T00:00:00.000Z",
          candidate: { candidateHash: "a".repeat(64) },
          stagingDirectory: "/var/lib/openclaw/managed-config-staging",
          approvalBinding: { candidateHash: "a".repeat(64) },
          task: { id: "task-1", status: "queued" },
          approval: { id: "approval-1", status: "pending" },
          governance: { createsTask: true, createsApproval: true },
        };
      },
    },
  );

  assert.equal(response.handled, true);
  assert.equal(response.statusCode, 201);
  assert.deepEqual(observed, {
    changes: [{ operation: "enable_component", component: "core" }],
    confirm: false,
  });
  assert.deepEqual(response.body.task, { id: "task-1", status: "queued" });
  assert.deepEqual(response.body.approval, { id: "approval-1", status: "pending" });
  assert.equal(response.body.approvalBinding.candidateHash, "a".repeat(64));
});

test("declarative evolution staging task route reports builder errors as bad requests", async () => {
  const response = await invoke(
    "POST",
    "/plugins/native-adapter/declarative-evolution/staging-tasks",
    { changes: [], confirm: true },
    { createNativeDeclarativeEvolutionStagingTask: async () => { throw new Error("candidate invalid"); } },
  );
  assert.equal(response.handled, true);
  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.body, { ok: false, error: "candidate invalid" });
});

test("declarative evolution activation decision routes preserve source task and decision", async () => {
  let observed = null;
  const review = await invoke(
    "GET",
    "/plugins/native-adapter/declarative-evolution/activation-decision?taskId=task-staging",
    {},
    {
      buildNativeDeclarativeEvolutionActivationDecisionReview: async (input) => {
        observed = { kind: "review", input };
        return { ok: true, blocked: false, sourceTaskId: input.taskId, activationReady: true };
      },
    },
  );
  assert.equal(review.handled, true);
  assert.equal(review.statusCode, 200);
  assert.deepEqual(observed, { kind: "review", input: { taskId: "task-staging" } });
  assert.equal(review.body.activationReady, true);

  const decision = await invoke(
    "POST",
    "/plugins/native-adapter/declarative-evolution/activation-decisions",
    { taskId: "task-staging", decision: "approve_activation_review", confirm: true },
    {
      createNativeDeclarativeEvolutionActivationDecisionTask: async (input) => {
        observed = { kind: "decision", input };
        return {
          registry: "openclaw-native-declarative-evolution-activation-decision-v0",
          mode: "approval-gated",
          generatedAt: "2026-07-17T00:00:00.000Z",
          review: { sourceTaskId: input.taskId, activationReady: true },
          approvalBinding: { decision: input.decision, candidateHash: "a".repeat(64) },
          task: { id: "task-activation", status: "queued" },
          approval: { id: "approval-activation", status: "pending" },
          governance: { createsTask: true, createsApproval: true, executesActivation: false },
        };
      },
    },
  );
  assert.equal(decision.handled, true);
  assert.equal(decision.statusCode, 201);
  assert.deepEqual(observed, {
    kind: "decision",
    input: { taskId: "task-staging", decision: "approve_activation_review", confirm: true },
  });
  assert.equal(decision.body.approvalBinding.decision, "approve_activation_review");
  assert.equal(decision.body.governance.executesActivation, false);
});
