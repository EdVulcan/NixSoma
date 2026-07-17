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
