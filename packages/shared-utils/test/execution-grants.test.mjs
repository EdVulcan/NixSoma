import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";

import {
  createExecutionGrantSigner,
  createExecutionGrantVerifier,
  hashExecutionGrantRequest,
} from "../src/execution-grants.mjs";

function keyPairPem() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  return {
    privateKey: privateKey.export({ type: "pkcs8", format: "pem" }),
    publicKey: publicKey.export({ type: "spki", format: "pem" }),
  };
}

test("execution grants bind audience, route, body, context and single use", () => {
  const keys = keyPairPem();
  let currentTime = 1_000;
  let grantCounter = 0;
  const signer = createExecutionGrantSigner({
    privateKey: keys.privateKey,
    now: () => currentTime,
    createId: () => `grant-${++grantCounter}`,
  });
  const verifier = createExecutionGrantVerifier({
    publicKey: keys.publicKey,
    audience: "openclaw-system-sense",
    now: () => currentTime,
  });
  const body = { command: "echo", args: ["ok"], cwd: "/workspace" };
  const context = {
    taskId: "task-1",
    stepId: "step-1",
    capabilityId: "act.system.command.execute",
    intent: "system.command.execute",
  };
  const token = signer.issue({
    audience: "openclaw-system-sense",
    path: "/system/command/execute",
    body,
    context,
  });

  const accepted = verifier.verifyRequest({
    token,
    method: "POST",
    path: "/system/command/execute",
    body,
    context,
  });
  assert.equal(accepted.ok, true);
  assert.equal(accepted.grant.taskId, "task-1");
  assert.equal(accepted.grant.stepId, "step-1");

  const replay = verifier.verifyRequest({
    token,
    method: "POST",
    path: "/system/command/execute",
    body,
    context,
  });
  assert.equal(replay.ok, false);
  assert.equal(replay.code, "EXECUTION_GRANT_REPLAYED");

  const otherToken = signer.issue({
    audience: "openclaw-system-sense",
    path: "/system/command/execute",
    body,
    context,
  });
  const mismatch = verifier.verifyRequest({
    token: otherToken,
    method: "POST",
    path: "/system/command/execute",
    body: { ...body, args: ["changed"] },
    context,
  });
  assert.equal(mismatch.ok, false);
  assert.equal(mismatch.code, "EXECUTION_GRANT_TARGET_MISMATCH");

  currentTime = 1_000;
  const expiredToken = signer.issue({
    audience: "openclaw-system-sense",
    path: "/system/command/execute",
    body,
    context,
  });
  currentTime = 20_000;
  const expired = verifier.verifyRequest({
    token: expiredToken,
    method: "POST",
    path: "/system/command/execute",
    body,
    context,
  });
  assert.equal(expired.ok, false);
  assert.equal(expired.code, "EXECUTION_GRANT_EXPIRED");
});

test("execution grant request hashes are stable for object key ordering", () => {
  const left = hashExecutionGrantRequest({
    method: "post",
    path: "/system/files/write-text",
    body: { path: "/workspace/a", content: "x" },
    context: { taskId: "task-1" },
  });
  const right = hashExecutionGrantRequest({
    method: "POST",
    path: "/system/files/write-text",
    body: { content: "x", path: "/workspace/a" },
    context: { taskId: "task-1", stepId: null, capabilityId: null, intent: null },
  });
  assert.equal(left, right);
});

test("missing actuator verification key is fail-closed", () => {
  const verifier = createExecutionGrantVerifier({
    publicKey: null,
    publicKeyFilePath: null,
    audience: "openclaw-screen-act",
  });
  const result = verifier.verifyRequest({
    token: null,
    path: "/act/mouse/click",
    body: { x: 1, y: 2 },
  });
  assert.equal(result.ok, false);
  assert.equal(result.statusCode, 503);
  assert.equal(result.code, "EXECUTION_GRANT_VERIFIER_UNAVAILABLE");
});
