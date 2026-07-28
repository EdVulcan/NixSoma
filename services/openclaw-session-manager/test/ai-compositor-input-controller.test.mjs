import assert from "node:assert/strict";
import { chmodSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createAiCompositorInputController } from "../src/ai-compositor-input-controller.mjs";

function frame(sequence, capturedAt, sha = "a") {
  return {
    registry: "nixsoma-ai-compositor-frame-v0",
    available: true,
    socketName: "nixsoma-ai-0",
    width: 1280,
    height: 720,
    sha256: sha.repeat(64),
    sequence,
    capturedAt,
    fresh: true,
  };
}

function runtimeFixture(t) {
  const runtimeBaseDir = mkdtempSync(path.join(os.tmpdir(), "nixsoma-native-input-"));
  const inputDir = path.join(runtimeBaseDir, "nixsoma-ai-graphical-session", "input");
  mkdirSync(inputDir, { recursive: true, mode: 0o700 });
  chmodSync(inputDir, 0o700);
  t.after(() => rmSync(runtimeBaseDir, { recursive: true, force: true }));
  return {
    inputDir,
    env: {
      XDG_RUNTIME_DIR: runtimeBaseDir,
      OPENCLAW_AI_COMPOSITOR_INPUT_ENABLED: "1",
      OPENCLAW_AI_GRAPHICAL_SESSION_RUNTIME_DIRECTORY: "nixsoma-ai-graphical-session",
      OPENCLAW_AI_COMPOSITOR_INPUT_DIRECTORY: "input",
      OPENCLAW_AI_GRAPHICAL_SESSION_SOCKET_NAME: "nixsoma-ai-0",
      OPENCLAW_AI_COMPOSITOR_INPUT_TIMEOUT_MS: "200",
      OPENCLAW_AI_COMPOSITOR_INPUT_POLL_MS: "5",
    },
  };
}

function helperRuntime() {
  const lease = {
    registry: "openclaw-trusted-work-view-helper-lease-v0",
    owner: "openclaw-session-manager",
    mode: "in_process_session_helper",
    scope: "ai_owned_work_view_only",
    leaseId: "lease-1",
    sessionId: "session-1",
    workViewId: "work-view-1",
    actionAuthority: "active",
  };
  return {
    snapshot: () => ({
      status: "active",
      actionAuthority: "active",
      leaseMatched: true,
      sessionId: "session-1",
    }),
    leaseEnvelope: () => lease,
    candidate: lease,
  };
}

test("native input executes one frame-bound click and advances compositor evidence", async (t) => {
  const { inputDir, env } = runtimeFixture(t);
  const now = Date.parse("2026-07-19T06:00:00.500Z");
  const before = frame(4, "2026-07-19T06:00:00.000Z", "a");
  const after = frame(5, "2026-07-19T06:00:00.550Z", "b");
  const helper = helperRuntime();
  const controller = createAiCompositorInputController({
    env,
    now: () => now,
    createRequestId: () => "c".repeat(32),
    frameCapture: {
      snapshot: () => before,
      capture: async () => after,
    },
    helperRuntime: helper,
    observeGraphicalSession: () => ({
      ready: true,
      socket: { name: "nixsoma-ai-0" },
      browserAttachment: { attached: true },
    }),
    stat: (target) => target.endsWith("control.sock")
      ? { isSocket: () => true, uid: process.getuid(), mode: 0o600 }
      : lstatSync(target),
    list: () => ["control.sock"],
    sendRequest: async ({ request }) =>
      `1 ${request.requestId} ${request.frame.sha256} ${request.frame.sequence} ${request.x} ${request.y} executed\n`,
  });

  const evidence = await controller.execute({
    action: { x: 740, y: 22, button: "left", compositorFrame: before },
    trustedHelperLease: helper.candidate,
  });

  assert.equal(evidence.status, "executed");
  assert.equal(evidence.frameMatched, true);
  assert.equal(evidence.leaseMatched, true);
  assert.equal(evidence.receiptMatched, true);
  assert.equal(evidence.sequenceAdvanced, true);
  assert.equal(evidence.postFrame.sequence, 5);
  assert.deepEqual(readdirSync(inputDir), []);
});

test("native input rejects stale or replaced frames before creating a request", async (t) => {
  const { inputDir, env } = runtimeFixture(t);
  const before = frame(4, "2026-07-19T06:00:00.000Z", "a");
  const current = frame(5, "2026-07-19T06:00:00.100Z", "b");
  const helper = helperRuntime();
  const controller = createAiCompositorInputController({
    env,
    now: () => Date.parse("2026-07-19T06:00:00.500Z"),
    frameCapture: { snapshot: () => current, capture: async () => current },
    helperRuntime: helper,
    observeGraphicalSession: () => ({
      ready: true,
      socket: { name: "nixsoma-ai-0" },
      browserAttachment: { attached: true },
    }),
  });

  await assert.rejects(
    controller.execute({
      action: { x: 1, y: 1, button: "left", compositorFrame: before },
      trustedHelperLease: helper.candidate,
    }),
    /stale or no longer current/u,
  );
  assert.deepEqual(readdirSync(inputDir), []);
});
