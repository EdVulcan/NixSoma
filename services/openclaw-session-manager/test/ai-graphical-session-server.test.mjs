import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, watch, writeFileSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import test from "node:test";

const serverPath = fileURLToPath(new URL("../src/server.mjs", import.meta.url));

async function reservePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : null;
  await new Promise((resolve) => server.close(resolve));
  assert.ok(Number.isInteger(port));
  return port;
}

async function waitForJson(url, attempts = 80) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw lastError ?? new Error("session-manager did not become ready");
}

function pngChunk(type, data = Buffer.alloc(0)) {
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  chunk.write(type, 4, 4, "ascii");
  data.copy(chunk, 8);
  return chunk;
}

function pngFrame(width, height) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", Buffer.from("server-route-frame")),
    pngChunk("IEND"),
  ]);
}

test("session-manager exposes ready graphical-session evidence without its runtime path", async (t) => {
  const runtimeDir = mkdtempSync(path.join(os.tmpdir(), "nixsoma-ai-server-"));
  const sessionRuntimeDir = path.join(runtimeDir, "nixsoma-ai-graphical-session");
  mkdirSync(sessionRuntimeDir, { mode: 0o700 });
  const captureDir = path.join(sessionRuntimeDir, "capture");
  mkdirSync(captureDir, { mode: 0o700 });
  let frameWritten = false;
  const captureWatcher = watch(captureDir, (_event, filename) => {
    if (filename !== "request" || frameWritten) return;
    frameWritten = true;
    writeFileSync(
      path.join(captureDir, "wayland-screenshot-2026-07-19_14-00-02.png"),
      pngFrame(1280, 720),
      { mode: 0o600 },
    );
  });
  const socketPath = path.join(sessionRuntimeDir, "nixsoma-ai-0");
  const waylandServer = net.createServer();
  await new Promise((resolve, reject) => {
    waylandServer.once("error", reject);
    waylandServer.listen(socketPath, resolve);
  });

  const port = await reservePort();
  const child = spawn(process.execPath, [serverPath], {
    env: {
      ...process.env,
      XDG_RUNTIME_DIR: runtimeDir,
      OPENCLAW_SESSION_MANAGER_HOST: "127.0.0.1",
      OPENCLAW_SESSION_MANAGER_PORT: String(port),
      OPENCLAW_EVENT_HUB_URL: "http://127.0.0.1:1",
      OPENCLAW_BROWSER_RUNTIME_URL: "http://127.0.0.1:1",
      OPENCLAW_SESSION_MANAGER_STATE_FILE: path.join(runtimeDir, "session-state.json"),
      OPENCLAW_AI_GRAPHICAL_SESSION_ENABLED: "1",
      OPENCLAW_AI_GRAPHICAL_SESSION_MODE: "nested_headless_wayland",
      OPENCLAW_AI_GRAPHICAL_SESSION_RUNTIME_DIRECTORY: "nixsoma-ai-graphical-session",
      OPENCLAW_AI_GRAPHICAL_SESSION_SOCKET_NAME: "nixsoma-ai-0",
      OPENCLAW_AI_GRAPHICAL_SESSION_WIDTH: "1280",
      OPENCLAW_AI_GRAPHICAL_SESSION_HEIGHT: "720",
      OPENCLAW_AI_COMPOSITOR_CAPTURE_ENABLED: "1",
      OPENCLAW_AI_COMPOSITOR_CAPTURE_DIRECTORY: "capture",
      OPENCLAW_AI_COMPOSITOR_CAPTURE_TIMEOUT_MS: "500",
      OPENCLAW_AI_COMPOSITOR_CAPTURE_POLL_MS: "5",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  t.after(async () => {
    child.kill("SIGTERM");
    if (child.exitCode === null) {
      await new Promise((resolve) => child.once("exit", resolve));
    }
    await new Promise((resolve) => waylandServer.close(resolve));
    captureWatcher.close();
    rmSync(runtimeDir, { recursive: true, force: true });
  });

  const data = await waitForJson(`http://127.0.0.1:${port}/work-view/state`);
  assert.equal(data.ok, true);
  assert.equal(data.workView.aiGraphicalSession.status, "ready");
  assert.equal(data.workView.aiGraphicalSession.ready, true);
  assert.equal(data.workView.aiGraphicalSession.socket.name, "nixsoma-ai-0");
  assert.equal(data.workView.aiGraphicalSession.boundary.parentDisplayConnected, false);
  assert.equal(data.workView.aiGraphicalSession.boundary.inputAuthority, false);
  assert.equal(JSON.stringify(data.workView.aiGraphicalSession).includes(runtimeDir), false);

  const captured = await waitForJson(`http://127.0.0.1:${port}/work-view/compositor-frame`);
  assert.equal(captured.ok, true);
  assert.equal(captured.frame.available, true);
  assert.equal(captured.frame.captureApi, "weston_output_capture_v1");
  assert.equal(captured.frame.width, 1280);
  assert.equal(captured.frame.height, 720);
  assert.match(captured.frame.dataUrl, /^data:image\/png;base64,/u);

  const after = await waitForJson(`http://127.0.0.1:${port}/work-view/state`);
  assert.equal(after.workView.aiGraphicalSession.compositorFrame.available, true);
  assert.equal(after.workView.aiGraphicalSession.compositorFrame.dataExposed, false);
  assert.equal(after.workView.aiGraphicalSession.boundary.compositorNativeCapture, true);
  assert.equal(after.workView.aiGraphicalSession.boundary.readsPixels, true);
  assert.equal(JSON.stringify(after).includes("data:image/"), false);
});
