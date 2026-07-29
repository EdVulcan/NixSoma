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

test("native input executes opcode 4 only for the current active surface", async (t) => {
  const { env } = runtimeFixture(t);
  const before = frame(24, "2026-07-29T07:00:00.000Z", "a");
  const after = frame(25, "2026-07-29T07:00:00.100Z", "b");
  const helper = helperRuntime();
  const inventory = () => ({
    registry: "nixsoma-ai-surface-inventory-v0",
    available: true,
    sequence: 41,
    surfaces: [{ surfaceId: 83, pid: 8300, width: 1280, height: 720, activated: true }],
  });
  const controller = createAiCompositorInputController({
    env,
    now: () => Date.parse("2026-07-29T07:00:00.500Z"),
    createRequestId: () => "f".repeat(32),
    frameCapture: { snapshot: () => before, capture: async () => after },
    helperRuntime: helper,
    observeGraphicalSession: () => ({
      ready: true,
      socket: { name: "nixsoma-ai-0" },
      browserAttachment: { attached: true },
    }),
    observeSurfaceInventory: inventory,
    stat: (target) => target.endsWith("control.sock")
      ? { isSocket: () => true, uid: process.getuid(), mode: 0o600 }
      : lstatSync(target),
    list: () => ["control.sock"],
    sendRequest: async ({ request, wire }) => {
      assert.equal(
        wire,
        `4 ${"f".repeat(32)} ${before.sha256} 24 41 83 200 140\n`,
      );
      return `4 ${request.requestId} ${request.frame.sha256} ${request.frame.sequence} ${request.inventorySequence} ${request.surfaceId} ${request.x} ${request.y} executed\n`;
    },
  });
  const evidence = await controller.execute({
    action: {
      x: 200,
      y: 140,
      button: "left",
      surfaceId: 83,
      inventorySequence: 41,
      compositorFrame: before,
    },
    trustedHelperLease: helper.candidate,
  });
  assert.equal(evidence.operation, "pointer_click");
  assert.equal(evidence.surfaceId, 83);
  assert.equal(evidence.inventorySequence, 41);
  assert.equal(evidence.inventoryMatched, true);
  assert.equal(evidence.surfaceMatched, true);
  assert.equal(evidence.frameChanged, true);
  assert.equal(evidence.receiptMatched, true);
});

test("surface-bound click rejects stale active-surface authority before Weston contact", async (t) => {
  const { env } = runtimeFixture(t);
  const current = frame(26, "2026-07-29T07:10:00.000Z", "c");
  const helper = helperRuntime();
  let sent = false;
  const controller = createAiCompositorInputController({
    env,
    now: () => Date.parse("2026-07-29T07:10:00.500Z"),
    frameCapture: { snapshot: () => current, capture: async () => current },
    helperRuntime: helper,
    observeGraphicalSession: () => ({
      ready: true,
      socket: { name: "nixsoma-ai-0" },
      browserAttachment: { attached: true },
    }),
    observeSurfaceInventory: () => ({
      available: true,
      sequence: 42,
      surfaces: [{ surfaceId: 84, width: 1280, height: 720, activated: false }],
    }),
    sendRequest: async () => { sent = true; },
  });
  await assert.rejects(controller.execute({
    action: {
      x: 200,
      y: 140,
      surfaceId: 84,
      inventorySequence: 42,
      compositorFrame: current,
    },
    trustedHelperLease: helper.candidate,
  }), (error) => error.code === "AI_COMPOSITOR_CLICK_TARGET_STALE");
  assert.equal(sent, false);
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

test("native input executes one fixed-step scroll bound to the current active surface", async (t) => {
  const { env } = runtimeFixture(t);
  const before = frame(14, "2026-07-28T06:00:00.000Z", "a");
  const after = frame(15, "2026-07-28T06:00:00.100Z", "b");
  const helper = helperRuntime();
  const inventory = () => ({
    registry: "nixsoma-ai-surface-inventory-v0",
    available: true,
    sequence: 31,
    surfaces: [{ surfaceId: 73, pid: 7300, width: 1280, height: 720, activated: true }],
  });
  const controller = createAiCompositorInputController({
    env,
    now: () => Date.parse("2026-07-28T06:00:00.500Z"),
    createRequestId: () => "e".repeat(32),
    frameCapture: { snapshot: () => before, capture: async () => after },
    helperRuntime: helper,
    observeGraphicalSession: () => ({
      ready: true,
      socket: { name: "nixsoma-ai-0" },
      browserAttachment: { attached: true },
    }),
    observeSurfaceInventory: inventory,
    stat: (target) => target.endsWith("control.sock")
      ? { isSocket: () => true, uid: process.getuid(), mode: 0o600 }
      : lstatSync(target),
    list: () => ["control.sock"],
    sendRequest: async ({ request, wire }) => {
      assert.equal(
        wire,
        `3 ${"e".repeat(32)} ${before.sha256} 14 31 73 640 360 -1\n`,
      );
      return `3 ${request.requestId} ${request.frame.sha256} ${request.frame.sequence} ${request.inventorySequence} ${request.surfaceId} ${request.x} ${request.y} ${request.direction} executed\n`;
    },
  });

  const evidence = await controller.execute({
    action: {
      direction: "up",
      surfaceId: 73,
      inventorySequence: 31,
      compositorFrame: before,
    },
    trustedHelperLease: helper.candidate,
  });

  assert.equal(evidence.status, "executed");
  assert.equal(evidence.operation, "pointer_scroll");
  assert.equal(evidence.direction, "up");
  assert.equal(evidence.surfaceId, 73);
  assert.equal(evidence.inventoryMatched, true);
  assert.equal(evidence.surfaceMatched, true);
  assert.equal(evidence.frameChanged, true);
  assert.equal(evidence.receiptMatched, true);
});

test("native scroll rejects stale or inactive surface binding before Weston contact", async (t) => {
  const { env } = runtimeFixture(t);
  const current = frame(21, "2026-07-28T06:10:00.000Z", "c");
  const helper = helperRuntime();
  let sent = false;
  const controller = createAiCompositorInputController({
    env,
    now: () => Date.parse("2026-07-28T06:10:00.500Z"),
    frameCapture: { snapshot: () => current, capture: async () => current },
    helperRuntime: helper,
    observeGraphicalSession: () => ({
      ready: true,
      socket: { name: "nixsoma-ai-0" },
      browserAttachment: { attached: true },
    }),
    observeSurfaceInventory: () => ({
      available: true,
      sequence: 8,
      surfaces: [{ surfaceId: 90, pid: 9000, width: 1280, height: 720, activated: false }],
    }),
    sendRequest: async () => { sent = true; },
  });

  await assert.rejects(
    controller.execute({
      action: {
        direction: "down",
        surfaceId: 90,
        inventorySequence: 8,
        compositorFrame: current,
      },
      trustedHelperLease: helper.candidate,
    }),
    (error) => error.code === "AI_COMPOSITOR_SCROLL_TARGET_STALE",
  );
  assert.equal(sent, false);
});

test("native compositor control activates one current numeric surface and binds both frames", async (t) => {
  const { env } = runtimeFixture(t);
  const before = frame(8, "2026-07-28T04:10:00.000Z", "a");
  const after = frame(9, "2026-07-28T04:10:00.100Z", "b");
  let activated = false;
  const inventory = () => ({
    registry: "nixsoma-ai-surface-inventory-v0",
    available: true,
    sequence: activated ? 12 : 11,
    surfaces: [
      { surfaceId: 41, pid: 4100, width: 1280, height: 720, activated },
      { surfaceId: 42, pid: 4200, width: 1280, height: 720, activated: !activated },
    ],
  });
  let captureCount = 0;
  const controller = createAiCompositorInputController({
    env,
    now: () => 1_000,
    createRequestId: () => "d".repeat(32),
    frameCapture: {
      snapshot: () => before,
      capture: async () => (++captureCount === 1 ? before : after),
    },
    helperRuntime: helperRuntime(),
    observeGraphicalSession: () => ({
      ready: true,
      socket: { name: "nixsoma-ai-0" },
    }),
    observeSurfaceInventory: inventory,
    stat: (target) => target.endsWith("control.sock")
      ? { isSocket: () => true, uid: process.getuid(), mode: 0o600 }
      : lstatSync(target),
    list: () => ["control.sock"],
    sendRequest: async ({ request, wire }) => {
      assert.equal(wire, `2 ${"d".repeat(32)} ${before.sha256} 8 11 41\n`);
      activated = true;
      return `2 ${request.requestId} ${request.frame.sha256} ${request.frame.sequence} ${request.inventorySequence} ${request.surfaceId} executed\n`;
    },
  });

  const evidence = await controller.activateSurface({ surfaceId: 41, inventorySequence: 11 });
  assert.equal(evidence.status, "activated");
  assert.equal(evidence.surfaceId, 41);
  assert.equal(evidence.inventorySequenceBefore, 11);
  assert.equal(evidence.inventorySequenceAfter, 12);
  assert.equal(evidence.receiptMatched, true);
  assert.equal(evidence.frameSequenceAdvanced, true);
  assert.equal(evidence.frameChanged, true);
  assert.equal(evidence.beforeFrame.sequence, 8);
  assert.equal(evidence.afterFrame.sequence, 9);
  assert.equal(JSON.stringify(evidence).includes("dataUrl"), false);
  assert.equal(controller.surfaceActivationSnapshot().surfaceId, 41);
});

test("native surface activation rejects a stale inventory before compositor contact", async (t) => {
  const { env } = runtimeFixture(t);
  let sent = false;
  const controller = createAiCompositorInputController({
    env,
    frameCapture: { snapshot: () => frame(1, "2026-07-28T04:00:00Z"), capture: async () => frame(2, "2026-07-28T04:00:01Z") },
    helperRuntime: helperRuntime(),
    observeGraphicalSession: () => ({ ready: true, socket: { name: "nixsoma-ai-0" } }),
    observeSurfaceInventory: () => ({
      available: true,
      sequence: 7,
      surfaces: [{ surfaceId: 9, pid: 900, width: 1280, height: 720, activated: false }],
    }),
    sendRequest: async () => { sent = true; },
  });

  await assert.rejects(
    controller.activateSurface({ surfaceId: 9, inventorySequence: 6 }),
    (error) => error.code === "AI_SURFACE_ACTIVATION_TARGET_STALE",
  );
  assert.equal(sent, false);
});
