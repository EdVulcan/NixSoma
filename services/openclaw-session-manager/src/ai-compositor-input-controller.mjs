import { randomBytes } from "node:crypto";
import { lstatSync, readdirSync } from "node:fs";
import net from "node:net";
import path from "node:path";

import {
  AI_COMPOSITOR_INPUT_SOCKET,
  AI_COMPOSITOR_KEYBOARD_TYPE_OPERATION,
  AI_COMPOSITOR_POINTER_SCROLL_OPERATION,
  aiCompositorFrameMatches,
  normaliseAiCompositorInputAction,
  projectAiCompositorInputEvidence,
} from "../../../packages/shared-utils/src/ai-compositor-input.mjs";
import { validateTrustedWorkViewActionLease } from "../../../packages/shared-utils/src/work-view-trust.mjs";

const EXPECTED_RUNTIME_DIRECTORY = "nixsoma-ai-graphical-session";
const EXPECTED_INPUT_DIRECTORY = "input";
const CONTROL_SOCKET_NAME = "control.sock";
const RECEIPT_PATTERN = /^1 ([a-f0-9]{32}) ([a-f0-9]{64}) ([1-9][0-9]*) ([0-9]+) ([0-9]+) executed\n$/u;
const SURFACE_ACTIVATION_RECEIPT_PATTERN = /^2 ([a-f0-9]{32}) ([a-f0-9]{64}) ([1-9][0-9]*) ([1-9][0-9]*) ([1-9][0-9]*) executed\n$/u;
const SCROLL_RECEIPT_PATTERN = /^3 ([a-f0-9]{32}) ([a-f0-9]{64}) ([1-9][0-9]*) ([1-9][0-9]*) ([1-9][0-9]*) ([0-9]+) ([0-9]+) (-?1) executed\n$/u;
const SURFACE_CLICK_RECEIPT_PATTERN = /^4 ([a-f0-9]{32}) ([a-f0-9]{64}) ([1-9][0-9]*) ([1-9][0-9]*) ([1-9][0-9]*) ([0-9]+) ([0-9]+) executed\n$/u;
const SURFACE_TYPE_RECEIPT_PATTERN = /^5 ([a-f0-9]{32}) ([a-f0-9]{64}) ([1-9][0-9]*) ([1-9][0-9]*) ([1-9][0-9]*) ([1-9][0-9]*) executed\n$/u;
const SURFACE_ACTIVATION_REGISTRY = "nixsoma-ai-surface-activation-v0";

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

function assertSurfaceActivationReceipt(text, expected) {
  const match = SURFACE_ACTIVATION_RECEIPT_PATTERN.exec(text);
  if (!match) throw new Error("AI surface activation receipt is malformed.");
  const [, requestId, sha256, frameSequence, inventorySequence, surfaceId] = match;
  if (requestId !== expected.requestId
    || sha256 !== expected.frame.sha256
    || Number(frameSequence) !== expected.frame.sequence
    || Number(inventorySequence) !== expected.inventorySequence
    || Number(surfaceId) !== expected.surfaceId) {
    throw new Error("AI surface activation receipt does not match the request.");
  }
}

function assertScrollReceipt(text, expected) {
  const match = SCROLL_RECEIPT_PATTERN.exec(text);
  if (!match) throw new Error("AI compositor scroll receipt is malformed.");
  const [
    , requestId, sha256, frameSequence, inventorySequence,
    surfaceId, x, y, direction,
  ] = match;
  if (requestId !== expected.requestId
    || sha256 !== expected.frame.sha256
    || Number(frameSequence) !== expected.frame.sequence
    || Number(inventorySequence) !== expected.inventorySequence
    || Number(surfaceId) !== expected.surfaceId
    || Number(x) !== expected.x
    || Number(y) !== expected.y
    || Number(direction) !== expected.direction) {
    throw new Error("AI compositor scroll receipt does not match the request.");
  }
}

function assertSurfaceClickReceipt(text, expected) {
  const match = SURFACE_CLICK_RECEIPT_PATTERN.exec(text);
  if (!match) throw new Error("AI compositor surface-bound click receipt is malformed.");
  const [
    , requestId, sha256, frameSequence, inventorySequence,
    surfaceId, x, y,
  ] = match;
  if (requestId !== expected.requestId
    || sha256 !== expected.frame.sha256
    || Number(frameSequence) !== expected.frame.sequence
    || Number(inventorySequence) !== expected.inventorySequence
    || Number(surfaceId) !== expected.surfaceId
    || Number(x) !== expected.x
    || Number(y) !== expected.y) {
    throw new Error("AI compositor surface-bound click receipt does not match the request.");
  }
}

function assertSurfaceTypeReceipt(text, expected) {
  const match = SURFACE_TYPE_RECEIPT_PATTERN.exec(text);
  if (!match) throw new Error("AI compositor surface-bound type receipt is malformed.");
  const [
    , requestId, sha256, frameSequence, inventorySequence,
    surfaceId, inputCharCount,
  ] = match;
  if (requestId !== expected.requestId
    || sha256 !== expected.frame.sha256
    || Number(frameSequence) !== expected.frame.sequence
    || Number(inventorySequence) !== expected.inventorySequence
    || Number(surfaceId) !== expected.surfaceId
    || Number(inputCharCount) !== expected.inputCharCount) {
    throw new Error("AI compositor surface-bound type receipt does not match the request.");
  }
}

function frameReference(frame) {
  return frame?.available === true ? {
    sha256: frame.sha256,
    sequence: frame.sequence,
    width: frame.width,
    height: frame.height,
    socketName: frame.socketName,
    dataExposed: false,
  } : null;
}

function baseSurfaceActivationEvidence(status = "not_executed") {
  return {
    registry: SURFACE_ACTIVATION_REGISTRY,
    status,
    surfaceId: null,
    inventorySequenceBefore: null,
    inventorySequenceAfter: null,
    activated: false,
    receiptMatched: false,
    frameSequenceAdvanced: false,
    frameChanged: false,
    beforeFrame: null,
    afterFrame: null,
    boundary: {
      sourceScope: "ai_owned_nested_output_only",
      numericSurfaceOnly: true,
      arbitraryWindowControl: false,
      parentDisplayConnected: false,
      inputAuthorityExpanded: false,
      pixelsPersisted: false,
      rootRequired: false,
      hostMutation: false,
    },
  };
}

function positiveInteger(value, label) {
  if (!Number.isInteger(value) || value <= 0 || value > 0xffff_ffff) {
    const error = new Error(`${label} must be a positive 32-bit integer.`);
    error.code = "AI_SURFACE_ACTIVATION_REQUEST_INVALID";
    error.statusCode = 400;
    throw error;
  }
  return value;
}

export function createAiCompositorInputController({
  env = process.env,
  frameCapture,
  helperRuntime,
  observeGraphicalSession,
  observeSurfaceInventory = () => null,
  expectedUid = typeof process.getuid === "function" ? process.getuid() : null,
  stat = lstatSync,
  list = readdirSync,
  sendRequest = sendSocketRequest,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now = () => Date.now(),
  createRequestId = () => randomBytes(16).toString("hex"),
} = {}) {
  const config = buildAiCompositorInputConfig({ env });
  let controlPromise = null;
  let lastEvidence = projectAiCompositorInputEvidence({ status: "not_executed" });
  let lastSurfaceActivation = baseSurfaceActivationEvidence();

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
    if (controlPromise) throw new Error("AI compositor control is already in flight.");

    controlPromise = (async () => {
      const graphicalSession = observeGraphicalSession();
      if (graphicalSession?.ready !== true
        || graphicalSession?.socket?.name !== AI_COMPOSITOR_INPUT_SOCKET
        || graphicalSession?.browserAttachment?.attached !== true) {
        throw new Error("AI compositor input requires the attached isolated work view.");
      }
      const action = normaliseAiCompositorInputAction(candidateAction, { now: now() });
      const keyboardAction = action.operation === AI_COMPOSITOR_KEYBOARD_TYPE_OPERATION;
      const scrollAction = action.operation === AI_COMPOSITOR_POINTER_SCROLL_OPERATION;
      const surfaceBoundClick = !keyboardAction && !scrollAction
        && Number.isInteger(action.surfaceId);
      const targetBoundAction = keyboardAction || scrollAction || surfaceBoundClick;
      const currentFrame = frameCapture.snapshot();
      if (!action.frame.fresh || currentFrame?.fresh !== true
        || !aiCompositorFrameMatches(action.frame, currentFrame)) {
        throw new Error("AI compositor input frame is stale or no longer current.");
      }
      if (targetBoundAction) {
        const inventory = observeSurfaceInventory();
        const target = inventory?.available === true
          && inventory.sequence === action.inventorySequence
          ? inventory.surfaces?.find((surface) => surface.surfaceId === action.surfaceId)
          : null;
        if (target?.activated !== true) {
          const error = new Error("AI compositor input target is stale or not active.");
          error.code = scrollAction
            ? "AI_COMPOSITOR_SCROLL_TARGET_STALE"
            : keyboardAction
              ? "AI_COMPOSITOR_TYPE_TARGET_STALE"
              : "AI_COMPOSITOR_CLICK_TARGET_STALE";
          error.statusCode = 409;
          throw error;
        }
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
        direction: scrollAction ? (action.direction === "up" ? -1 : 1) : null,
        text: keyboardAction ? action.text : null,
        inputCharCount: keyboardAction ? action.inputCharCount : null,
        surfaceId: targetBoundAction ? action.surfaceId : null,
        inventorySequence: targetBoundAction ? action.inventorySequence : null,
      };
      const wire = keyboardAction
        ? `5 ${request.requestId} ${action.frame.sha256} ${action.frame.sequence} ${action.inventorySequence} ${action.surfaceId} ${Buffer.from(action.text, "ascii").toString("hex")}\n`
        : scrollAction
          ? `3 ${request.requestId} ${action.frame.sha256} ${action.frame.sequence} ${action.inventorySequence} ${action.surfaceId} ${action.x} ${action.y} ${request.direction}\n`
          : surfaceBoundClick
            ? `4 ${request.requestId} ${action.frame.sha256} ${action.frame.sequence} ${action.inventorySequence} ${action.surfaceId} ${action.x} ${action.y}\n`
            : `1 ${request.requestId} ${action.frame.sha256} ${action.frame.sequence} ${action.x} ${action.y}\n`;
      const receipt = await sendRequest({ socketPath, wire, timeoutMs: config.timeoutMs, request });
      if (keyboardAction) assertSurfaceTypeReceipt(receipt, request);
      else if (scrollAction) assertScrollReceipt(receipt, request);
      else if (surfaceBoundClick) assertSurfaceClickReceipt(receipt, request);
      else assertReceipt(receipt, request);
      const settledInventory = targetBoundAction ? observeSurfaceInventory() : null;
      const inventoryMatched = !targetBoundAction || (
        settledInventory?.available === true
        && settledInventory.sequence >= action.inventorySequence
      );
      const surfaceMatched = !targetBoundAction || (
        inventoryMatched
        && settledInventory.surfaces?.find(
          (surface) => surface.surfaceId === action.surfaceId,
        )?.activated === true
      );
      const postFrameDeadline = now() + config.timeoutMs;
      let postFrame;
      do {
        postFrame = await frameCapture.capture();
        if (!targetBoundAction
          || (postFrame?.available === true
            && postFrame.sha256 !== action.frame.sha256)) break;
        await sleep(20);
      } while (now() < postFrameDeadline);
      const sequenceAdvanced = postFrame?.available === true
        && postFrame.sequence > action.frame.sequence;
      lastEvidence = projectAiCompositorInputEvidence({
        status: targetBoundAction && (!inventoryMatched || !surfaceMatched)
          ? "executed_surface_diverged"
          : sequenceAdvanced ? "executed" : "executed_post_frame_unavailable",
        operation: action.operation,
        requestId: request.requestId,
        socketName: AI_COMPOSITOR_INPUT_SOCKET,
        x: action.x,
        y: action.y,
        direction: scrollAction ? action.direction : null,
        inputCharCount: keyboardAction ? action.inputCharCount : null,
        surfaceId: targetBoundAction ? action.surfaceId : null,
        inventorySequence: targetBoundAction ? action.inventorySequence : null,
        frame: action.frame,
        postFrame: postFrame?.available === true ? postFrame : null,
        frameMatched: true,
        frameFresh: true,
        leaseMatched: mediation.leaseMatched,
        receiptMatched: true,
        sequenceAdvanced,
        frameChanged: postFrame?.available === true
          && postFrame.sha256 !== action.frame.sha256,
        inventoryMatched,
        surfaceMatched,
      });
      return lastEvidence;
    })();

    try {
      return await controlPromise;
    } finally {
      controlPromise = null;
    }
  }

  async function activateSurface({ surfaceId: candidateSurfaceId, inventorySequence: candidateSequence } = {}) {
    if (!config.enabled) throw new Error("AI surface activation is disabled.");
    if (controlPromise) throw new Error("AI compositor control is already in flight.");

    controlPromise = (async () => {
      const surfaceId = positiveInteger(candidateSurfaceId, "AI surface activation surfaceId");
      const inventorySequence = positiveInteger(
        candidateSequence,
        "AI surface activation inventorySequence",
      );
      const graphicalSession = observeGraphicalSession();
      if (graphicalSession?.ready !== true
        || graphicalSession?.socket?.name !== AI_COMPOSITOR_INPUT_SOCKET) {
        throw new Error("AI surface activation requires the isolated graphical session.");
      }
      const inventory = observeSurfaceInventory();
      const target = inventory?.available === true
        && inventory.sequence === inventorySequence
        ? inventory.surfaces?.find((surface) => surface.surfaceId === surfaceId)
        : null;
      if (!target) {
        const error = new Error("AI surface activation target is stale or unavailable.");
        error.code = "AI_SURFACE_ACTIVATION_TARGET_STALE";
        error.statusCode = 409;
        throw error;
      }
      if (target.activated === true) {
        const error = new Error("AI surface activation target is already active.");
        error.code = "AI_SURFACE_ALREADY_ACTIVE";
        error.statusCode = 409;
        throw error;
      }

      const beforeFrame = await frameCapture.capture();
      if (beforeFrame?.available !== true || beforeFrame.fresh !== true) {
        throw new Error("AI surface activation requires a fresh compositor frame.");
      }
      const { inputDir, socketPath } = paths();
      assertTrustedDirectory(inputDir, expectedUid, stat);
      if (list(inputDir).some((entry) => entry !== CONTROL_SOCKET_NAME)) {
        throw new Error("AI compositor input directory contains an unexpected entry.");
      }
      assertTrustedSocket(socketPath, expectedUid, stat);

      const request = {
        requestId: createRequestId(),
        surfaceId,
        inventorySequence,
        frame: beforeFrame,
      };
      const wire = `2 ${request.requestId} ${beforeFrame.sha256} ${beforeFrame.sequence} ${inventorySequence} ${surfaceId}\n`;
      const receipt = await sendRequest({ socketPath, wire, timeoutMs: config.timeoutMs, request });
      assertSurfaceActivationReceipt(receipt, request);

      const deadline = now() + config.timeoutMs;
      let settledInventory = null;
      do {
        const candidate = observeSurfaceInventory();
        const settledTarget = candidate?.surfaces?.find((surface) => surface.surfaceId === surfaceId);
        if (candidate?.available === true
          && candidate.sequence > inventorySequence
          && settledTarget?.activated === true) {
          settledInventory = candidate;
          break;
        }
        await sleep(20);
      } while (now() < deadline);
      if (!settledInventory) {
        const error = new Error("AI surface activation did not reach the compositor inventory.");
        error.code = "AI_SURFACE_ACTIVATION_SETTLE_TIMEOUT";
        error.statusCode = 409;
        throw error;
      }

      const afterFrame = await frameCapture.capture();
      const frameSequenceAdvanced = afterFrame?.available === true
        && afterFrame.sequence > beforeFrame.sequence;
      lastSurfaceActivation = {
        ...baseSurfaceActivationEvidence("activated"),
        requestId: request.requestId,
        surfaceId,
        inventorySequenceBefore: inventorySequence,
        inventorySequenceAfter: settledInventory.sequence,
        activated: true,
        receiptMatched: true,
        frameSequenceAdvanced,
        frameChanged: afterFrame?.available === true
          && afterFrame.sha256 !== beforeFrame.sha256,
        beforeFrame: frameReference(beforeFrame),
        afterFrame: frameReference(afterFrame),
      };
      return structuredClone(lastSurfaceActivation);
    })();

    try {
      return await controlPromise;
    } finally {
      controlPromise = null;
    }
  }

  return {
    execute,
    activateSurface,
    snapshot: () => lastEvidence,
    surfaceActivationSnapshot: () => structuredClone(lastSurfaceActivation),
    config: () => ({
      enabled: config.enabled,
      socketName: AI_COMPOSITOR_INPUT_SOCKET,
      timeoutMs: config.timeoutMs,
    }),
  };
}
