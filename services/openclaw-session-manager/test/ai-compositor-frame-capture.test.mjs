import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { chmodSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createAiCompositorFrameCapture } from "../src/ai-compositor-frame-capture.mjs";

function pngChunk(type, data = Buffer.alloc(0)) {
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  chunk.write(type, 4, 4, "ascii");
  data.copy(chunk, 8);
  return chunk;
}

function pngFrame(width, height, payloadBytes = 8) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", Buffer.alloc(payloadBytes, 0x41)),
    pngChunk("IEND"),
  ]);
}

function fixture(t, overrides = {}) {
  const runtimeBaseDir = mkdtempSync(path.join(os.tmpdir(), "nixsoma-compositor-frame-"));
  const captureDir = path.join(runtimeBaseDir, "nixsoma-ai-graphical-session", "capture");
  mkdirSync(captureDir, { recursive: true, mode: 0o700 });
  chmodSync(captureDir, 0o700);
  t.after(() => rmSync(runtimeBaseDir, { recursive: true, force: true }));
  const env = {
    XDG_RUNTIME_DIR: runtimeBaseDir,
    OPENCLAW_AI_COMPOSITOR_CAPTURE_ENABLED: "1",
    OPENCLAW_AI_GRAPHICAL_SESSION_RUNTIME_DIRECTORY: "nixsoma-ai-graphical-session",
    OPENCLAW_AI_COMPOSITOR_CAPTURE_DIRECTORY: "capture",
    OPENCLAW_AI_GRAPHICAL_SESSION_SOCKET_NAME: "nixsoma-ai-0",
    OPENCLAW_AI_GRAPHICAL_SESSION_WIDTH: "1280",
    OPENCLAW_AI_GRAPHICAL_SESSION_HEIGHT: "720",
    OPENCLAW_AI_COMPOSITOR_CAPTURE_TIMEOUT_MS: "500",
    OPENCLAW_AI_COMPOSITOR_CAPTURE_POLL_MS: "5",
  };
  return { runtimeBaseDir, captureDir, env: { ...env, ...overrides } };
}

test("compositor capture returns one bounded native frame and retains metadata only", async (t) => {
  const { captureDir, env } = fixture(t);
  const bytes = pngFrame(1280, 720);
  const capture = createAiCompositorFrameCapture({
    env,
    onCaptureRequested: async () => {
      writeFileSync(path.join(captureDir, "wayland-screenshot-2026-07-19_14-00-00.png"), bytes, {
        mode: 0o600,
      });
    },
  });

  const frame = await capture.capture();
  assert.equal(frame.available, true);
  assert.equal(frame.sourceScope, "ai_owned_nested_output_only");
  assert.equal(frame.captureApi, "weston_output_capture_v1");
  assert.equal(frame.socketName, "nixsoma-ai-0");
  assert.equal(frame.width, 1280);
  assert.equal(frame.height, 720);
  assert.equal(frame.sha256, createHash("sha256").update(bytes).digest("hex"));
  assert.equal(frame.browserScreenshotApi, false);
  assert.equal(frame.desktopWideCapture, false);
  assert.equal(frame.parentDisplayConnected, false);
  assert.equal(frame.inputAuthority, false);
  assert.equal(frame.persisted, false);
  assert.match(frame.dataUrl, /^data:image\/png;base64,/u);

  const metadata = capture.snapshot();
  assert.equal(metadata.available, true);
  assert.equal(metadata.dataExposed, false);
  assert.equal("dataUrl" in metadata, false);
  assert.deepEqual(readdirSync(captureDir), []);
});

test("compositor capture is single-flight and rejects output dimension changes", async (t) => {
  const { captureDir, env } = fixture(t);
  let requests = 0;
  const capture = createAiCompositorFrameCapture({
    env,
    onCaptureRequested: async () => {
      requests += 1;
      await new Promise((resolve) => setTimeout(resolve, 20));
      writeFileSync(path.join(captureDir, "wayland-screenshot-2026-07-19_14-00-01.png"), pngFrame(640, 480), {
        mode: 0o600,
      });
    },
  });

  const [first, second] = await Promise.all([capture.capture(), capture.capture()]);
  assert.equal(requests, 1);
  assert.equal(first.available, false);
  assert.equal(first.reason, "capture_failed");
  assert.deepEqual(first, second);
  assert.equal(capture.snapshot().available, false);
});

test("compositor capture fails closed for an untrusted directory", async (t) => {
  const { captureDir, env } = fixture(t);
  chmodSync(captureDir, 0o755);
  const capture = createAiCompositorFrameCapture({ env });
  await assert.rejects(capture.capture(), /current-user-only/u);
});
