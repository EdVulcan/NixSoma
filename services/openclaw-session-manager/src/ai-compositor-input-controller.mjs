import { randomBytes } from "node:crypto";
import { lstatSync, readdirSync } from "node:fs";
import net from "node:net";
import path from "node:path";

import {
  AI_COMPOSITOR_INPUT_SOCKET,
  aiCompositorFrameMatches,
  normaliseAiCompositorPointerAction,
  projectAiCompositorInputEvidence,
} from "../../../packages/shared-utils/src/ai-compositor-input.mjs";
import { validateTrustedWorkViewActionLease } from "../../../packages/shared-utils/src/work-view-trust.mjs";

const EXPECTED_RUNTIME_DIRECTORY = "nixsoma-ai-graphical-session";
const EXPECTED_INPUT_DIRECTORY = "input";
const CONTROL_SOCKET_NAME = "control.sock";
const RECEIPT_PATTERN = /^1 ([a-f0-9]{32}) ([a-f0-9]{64}) ([1-9][0-9]*) ([0-9]+) ([0-9]+) executed\n$/u;

function enabled(value) {
  return value === true || value === "1" || value === "true";
}

function boundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : fallback;
}

export function buildAiCompositorInputConfig({ env = process.env } = {}) {
  return {
    enabled: enabled(env.OPENCLAW_AI_COMPOSITOR_INPUT_ENABLED),
    runtimeBaseDir: typeof env.XDG_RUNTIME_DIR === "string" ? env.XDG_RUNTIME_DIR.trim() : "",
    runtimeDirectory: typeof env.OPENCLAW_AI_GRAPHICAL_SESSION_RUNTIME_DIRECTORY === "string"
      ? env.OPENCLAW_AI_GRAPHICAL_SESSION_RUNTIME_DIRECTORY.trim()
      : EXPECTED_RUNTIME_DIRECTORY,
    inputDirectory: typeof env.OPENCLAW_AI_COMPOSITOR_INPUT_DIRECTORY === "string"
      ? env.OPENCLAW_AI_COMPOSITOR_INPUT_DIRECTORY.trim()
      : EXPECTED_INPUT_DIRECTORY,
    socketName: typeof env.OPENCLAW_AI_GRAPHICAL_SESSION_SOCKET_NAME === "string"
      ? env.OPENCLAW_AI_GRAPHICAL_SESSION_SOCKET_NAME.trim()
      : AI_COMPOSITOR_INPUT_SOCKET,
    timeoutMs: boundedInteger(env.OPENCLAW_AI_COMPOSITOR_INPUT_TIMEOUT_MS, 1000, 100, 3000),
  };
}

function assertTrustedDirectory(directoryPath, expectedUid, stat) {
  const stats = stat(directoryPath);
  if (!stats.isDirectory() || stats.uid !== expectedUid || (stats.mode & 0o077) !== 0) {
    throw new Error("AI compositor input directory is not current-user-only.");
  }
}

function assertTrustedSocket(socketPath, expectedUid, stat) {
  const stats = stat(socketPath);
  if (!stats.isSocket() || stats.uid !== expectedUid || (stats.mode & 0o777) !== 0o600) {
    throw new Error("AI compositor input control socket is not trusted.");
  }
}

function sendSocketRequest({ socketPath, wire, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let received = 0;
    const socket = net.createConnection({ path: socketPath });
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => socket.end(wire, "ascii"));
    socket.on("data", (chunk) => {
      received += chunk.length;
      if (received > 256) {
        socket.destroy(new Error("AI compositor input receipt exceeds its byte limit."));
        return;
      }
      chunks.push(chunk);
    });
    socket.once("end", () => resolve(Buffer.concat(chunks).toString("ascii")));
    socket.once("timeout", () => socket.destroy(
      new Error("AI compositor input timed out waiting for the Weston receipt."),
    ));
    socket.once("error", reject);
  });
}

function assertReceipt(text, expected) {
  const match = RECEIPT_PATTERN.exec(text);
  if (!match) throw new Error("AI compositor input receipt is malformed.");
  const [, requestId, sha256, sequence, x, y] = match;
  if (requestId !== expected.requestId
    || sha256 !== expected.frame.sha256
    || Number(sequence) !== expected.frame.sequence
    || Number(x) !== expected.x
    || Number(y) !== expected.y) {
    throw new Error("AI compositor input receipt does not match the request.");
  }
}

export function createAiCompositorInputController({
  env = process.env,
  frameCapture,
  helperRuntime,
  observeGraphicalSession,
  expectedUid = typeof process.getuid === "function" ? process.getuid() : null,
  stat = lstatSync,
  list = readdirSync,
  sendRequest = sendSocketRequest,
  now = () => Date.now(),
  createRequestId = () => randomBytes(16).toString("hex"),
} = {}) {
  const config = buildAiCompositorInputConfig({ env });
  let inputPromise = null;
  let lastEvidence = projectAiCompositorInputEvidence({ status: "not_executed" });

  function paths() {
    if (!path.isAbsolute(config.runtimeBaseDir)
      || config.runtimeDirectory !== EXPECTED_RUNTIME_DIRECTORY
      || config.inputDirectory !== EXPECTED_INPUT_DIRECTORY
      || config.socketName !== AI_COMPOSITOR_INPUT_SOCKET) {
      throw new Error("AI compositor input configuration is invalid.");
    }
    const inputDir = path.join(config.runtimeBaseDir, EXPECTED_RUNTIME_DIRECTORY, EXPECTED_INPUT_DIRECTORY);
    return {
      inputDir,
      socketPath: path.join(inputDir, CONTROL_SOCKET_NAME),
    };
  }

  function assertAuthority(candidateLease) {
    const runtime = helperRuntime.snapshot();
    if (runtime.status !== "active"
      || runtime.actionAuthority !== "active"
      || runtime.leaseMatched !== true) {
      throw new Error("AI compositor input requires active work-view action authority.");
    }
    const mediation = validateTrustedWorkViewActionLease({
      candidate: candidateLease,
      browserSessionId: runtime.sessionId,
      browserSessionAuthority: "openclaw-session-manager",
      browserLease: helperRuntime.leaseEnvelope(),
    });
    if (!mediation.accepted || !mediation.leaseMatched) {
      throw new Error(mediation.reason ?? "trusted_helper_lease_mismatch");
    }
    return mediation;
  }

  async function execute({ action: candidateAction, trustedHelperLease } = {}) {
    if (!config.enabled) throw new Error("AI compositor input is disabled.");
    if (inputPromise) throw new Error("AI compositor input is already in flight.");

    inputPromise = (async () => {
      const graphicalSession = observeGraphicalSession();
      if (graphicalSession?.ready !== true
        || graphicalSession?.socket?.name !== AI_COMPOSITOR_INPUT_SOCKET
        || graphicalSession?.browserAttachment?.attached !== true) {
        throw new Error("AI compositor input requires the attached isolated work view.");
      }
      const action = normaliseAiCompositorPointerAction(candidateAction, { now: now() });
      const currentFrame = frameCapture.snapshot();
      if (!action.frame.fresh || currentFrame?.fresh !== true
        || !aiCompositorFrameMatches(action.frame, currentFrame)) {
        throw new Error("AI compositor input frame is stale or no longer current.");
      }
      const mediation = assertAuthority(trustedHelperLease);
      const { inputDir, socketPath } = paths();
      assertTrustedDirectory(inputDir, expectedUid, stat);
      if (list(inputDir).some((entry) => entry !== CONTROL_SOCKET_NAME)) {
        throw new Error("AI compositor input directory contains an unexpected entry.");
      }
      assertTrustedSocket(socketPath, expectedUid, stat);

      const request = {
        requestId: createRequestId(),
        x: action.x,
        y: action.y,
        frame: action.frame,
      };
      const wire = `1 ${request.requestId} ${action.frame.sha256} ${action.frame.sequence} ${action.x} ${action.y}\n`;
      const receipt = await sendRequest({ socketPath, wire, timeoutMs: config.timeoutMs, request });
      assertReceipt(receipt, request);
      const postFrame = await frameCapture.capture();
      const sequenceAdvanced = postFrame?.available === true
        && postFrame.sequence > action.frame.sequence;
      lastEvidence = projectAiCompositorInputEvidence({
        status: sequenceAdvanced ? "executed" : "executed_post_frame_unavailable",
        operation: action.operation,
        requestId: request.requestId,
        socketName: AI_COMPOSITOR_INPUT_SOCKET,
        x: action.x,
        y: action.y,
        frame: action.frame,
        postFrame: postFrame?.available === true ? postFrame : null,
        frameMatched: true,
        frameFresh: true,
        leaseMatched: mediation.leaseMatched,
        receiptMatched: true,
        sequenceAdvanced,
      });
      return lastEvidence;
    })();

    try {
      return await inputPromise;
    } finally {
      inputPromise = null;
    }
  }

  return {
    execute,
    snapshot: () => lastEvidence,
    config: () => ({
      enabled: config.enabled,
      socketName: AI_COMPOSITOR_INPUT_SOCKET,
      timeoutMs: config.timeoutMs,
    }),
  };
}
