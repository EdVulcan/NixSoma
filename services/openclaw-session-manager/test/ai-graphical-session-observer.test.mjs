import assert from "node:assert/strict";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  createAiGraphicalSessionObserver,
  projectAiGraphicalSessionBrowserAttachment,
  projectAiGraphicalSessionCompositorFrame,
} from "../src/ai-graphical-session-observer.mjs";

function enabledEnv(runtimeDir, overrides = {}) {
  return {
    OPENCLAW_AI_GRAPHICAL_SESSION_ENABLED: "1",
    OPENCLAW_AI_GRAPHICAL_SESSION_MODE: "nested_headless_wayland",
    OPENCLAW_AI_GRAPHICAL_SESSION_RUNTIME_DIRECTORY: "nixsoma-ai-graphical-session",
    OPENCLAW_AI_GRAPHICAL_SESSION_SOCKET_NAME: "nixsoma-ai-0",
    OPENCLAW_AI_GRAPHICAL_SESSION_WIDTH: "1280",
    OPENCLAW_AI_GRAPHICAL_SESSION_HEIGHT: "720",
    XDG_RUNTIME_DIR: runtimeDir,
    ...overrides,
  };
}

test("AI graphical session observer remains inert when disabled", () => {
  const observe = createAiGraphicalSessionObserver({ env: {} });

  const result = observe();

  assert.equal(result.status, "disabled");
  assert.equal(result.ready, false);
  assert.equal(result.boundary.parentDisplayConnected, false);
  assert.equal(result.boundary.desktopWideCapture, false);
  assert.equal(result.boundary.inputAuthority, false);
  assert.equal(result.boundary.hostMutation, false);
});

test("AI graphical session observer verifies one owner-only Wayland socket", async (t) => {
  const runtimeDir = mkdtempSync(path.join(tmpdir(), "nixsoma-ai-runtime-"));
  chmodSync(runtimeDir, 0o700);
  const sessionRuntimeDir = path.join(runtimeDir, "nixsoma-ai-graphical-session");
  mkdirSync(sessionRuntimeDir, { mode: 0o700 });
  const socketPath = path.join(sessionRuntimeDir, "nixsoma-ai-0");
  const server = net.createServer();
  t.after(() => {
    server.close();
    rmSync(runtimeDir, { recursive: true, force: true });
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(socketPath, resolve);
  });

  const result = createAiGraphicalSessionObserver({ env: enabledEnv(runtimeDir) })();

  assert.equal(result.status, "ready");
  assert.equal(result.ready, true);
  assert.equal(result.identityLevel, "level_4_graphics_stack_native");
  assert.equal(result.socket.name, "nixsoma-ai-0");
  assert.equal(result.socket.type, "unix_socket");
  assert.equal(result.socket.ownerMatched, true);
  assert.equal(result.socket.groupOrOtherWritable, false);
  assert.deepEqual(result.output, { width: 1280, height: 720, virtual: true, headless: true });
  assert.equal(JSON.stringify(result).includes(runtimeDir), false);
});

test("AI graphical session observer rejects changed socket identity and regular files", (t) => {
  const runtimeDir = mkdtempSync(path.join(tmpdir(), "nixsoma-ai-runtime-"));
  chmodSync(runtimeDir, 0o700);
  const sessionRuntimeDir = path.join(runtimeDir, "nixsoma-ai-graphical-session");
  mkdirSync(sessionRuntimeDir, { mode: 0o700 });
  writeFileSync(path.join(sessionRuntimeDir, "nixsoma-ai-0"), "not a socket", "utf8");
  t.after(() => rmSync(runtimeDir, { recursive: true, force: true }));

  const changedName = createAiGraphicalSessionObserver({
    env: enabledEnv(runtimeDir, { OPENCLAW_AI_GRAPHICAL_SESSION_SOCKET_NAME: "wayland-0" }),
  })();
  const regularFile = createAiGraphicalSessionObserver({ env: enabledEnv(runtimeDir) })();

  assert.equal(changedName.status, "configuration_invalid");
  assert.equal(regularFile.status, "socket_untrusted");
  assert.equal(regularFile.socket.type, "unexpected");
  assert.equal(regularFile.ready, false);
});

test("AI graphical session observer fails closed for an untrusted runtime directory", (t) => {
  const runtimeDir = mkdtempSync(path.join(tmpdir(), "nixsoma-ai-runtime-"));
  const sessionRuntimeDir = path.join(runtimeDir, "nixsoma-ai-graphical-session");
  mkdirSync(sessionRuntimeDir, { mode: 0o755 });
  t.after(() => rmSync(runtimeDir, { recursive: true, force: true }));

  const result = createAiGraphicalSessionObserver({ env: enabledEnv(runtimeDir) })();

  assert.equal(result.status, "runtime_directory_untrusted");
  assert.equal(result.ready, false);
});

test("AI graphical session projects only an exact headed browser attachment", () => {
  const evidence = {
    ready: true,
    boundary: { browserAttached: false },
  };
  const candidate = {
    registry: "nixsoma-browser-graphical-session-binding-v0",
    enabled: true,
    mode: "nested_headed_wayland",
    status: "attached",
    attached: true,
    headed: true,
    socket: {
      name: "nixsoma-ai-0",
      type: "unix_socket",
      ownerMatched: true,
    },
    boundary: {
      parentDisplayEnvironment: false,
      desktopWideCapture: false,
      inputAuthorityExpanded: false,
      networkScope: "existing_browser_runtime",
      networkAuthorityExpanded: false,
      rootRequired: false,
    },
  };

  const attached = projectAiGraphicalSessionBrowserAttachment(evidence, candidate);
  const rejected = projectAiGraphicalSessionBrowserAttachment(evidence, {
    ...candidate,
    socket: { ...candidate.socket, name: "wayland-0" },
  });

  assert.equal(attached.boundary.browserAttached, true);
  assert.deepEqual(attached.browserAttachment, {
    registry: "nixsoma-browser-graphical-session-binding-v0",
    status: "attached",
    attached: true,
    headed: true,
    socketName: "nixsoma-ai-0",
    networkScope: "existing_browser_runtime",
  });
  assert.equal(rejected.boundary.browserAttached, false);
  assert.equal(attached.boundary.browserNetworkAccess, true);
  assert.equal(attached.boundary.networkAuthorityExpanded, false);
  assert.equal(rejected.browserAttachment, null);
});

test("AI graphical session projects compositor-native frame metadata without pixel data", () => {
  const evidence = projectAiGraphicalSessionCompositorFrame({
    status: "ready",
    boundary: {
      readsPixels: false,
      inputAuthority: false,
      desktopWideCapture: false,
    },
  }, {
    registry: "nixsoma-ai-compositor-frame-v0",
    available: true,
    sourceScope: "ai_owned_nested_output_only",
    captureApi: "weston_output_capture_v1",
    browserScreenshotApi: false,
    desktopWideCapture: false,
    parentDisplayConnected: false,
    inputAuthority: false,
    persisted: false,
    dataExposed: false,
    sha256: "a".repeat(64),
  });

  assert.equal(evidence.compositorFrame.available, true);
  assert.equal(evidence.boundary.readsPixels, true);
  assert.equal(evidence.boundary.compositorNativeCapture, true);
  assert.equal(evidence.boundary.browserScreenshotApi, false);
  assert.equal(evidence.boundary.inputAuthority, false);
  assert.equal(JSON.stringify(evidence).includes("data:image/"), false);
});
