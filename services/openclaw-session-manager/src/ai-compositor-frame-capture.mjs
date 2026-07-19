import { createHash } from "node:crypto";
import {
  constants as fsConstants,
  fstatSync,
  lstatSync,
  openSync,
  closeSync,
  readSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import {
  AI_COMPOSITOR_FRAME_MEDIA_TYPE,
  AI_COMPOSITOR_FRAME_REGISTRY,
  projectAiCompositorFrame,
  unavailableAiCompositorFrame,
} from "../../../packages/shared-utils/src/ai-compositor-frame.mjs";
import { WORK_VIEW_VISUAL_FRAME_MAX_BYTES } from "../../../packages/shared-utils/src/work-view-visual-frame.mjs";

const EXPECTED_RUNTIME_DIRECTORY = "nixsoma-ai-graphical-session";
const EXPECTED_CAPTURE_DIRECTORY = "capture";
const EXPECTED_SOCKET_NAME = "nixsoma-ai-0";
const CAPTURE_REQUEST_NAME = "request";
const CAPTURE_FILE_PATTERN = /^wayland-screenshot-[0-9_:-]+\.png$/u;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function enabled(value) {
  return value === "1" || value === "true";
}

function boundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : fallback;
}

export function buildAiCompositorFrameCaptureConfig({ env = process.env } = {}) {
  const runtimeBaseDir = typeof env.XDG_RUNTIME_DIR === "string" ? env.XDG_RUNTIME_DIR.trim() : "";
  const runtimeDirectory = typeof env.OPENCLAW_AI_GRAPHICAL_SESSION_RUNTIME_DIRECTORY === "string"
    ? env.OPENCLAW_AI_GRAPHICAL_SESSION_RUNTIME_DIRECTORY.trim()
    : EXPECTED_RUNTIME_DIRECTORY;
  return {
    enabled: enabled(env.OPENCLAW_AI_COMPOSITOR_CAPTURE_ENABLED),
    runtimeBaseDir,
    runtimeDirectory,
    captureDirectory: typeof env.OPENCLAW_AI_COMPOSITOR_CAPTURE_DIRECTORY === "string"
      ? env.OPENCLAW_AI_COMPOSITOR_CAPTURE_DIRECTORY.trim()
      : EXPECTED_CAPTURE_DIRECTORY,
    socketName: typeof env.OPENCLAW_AI_GRAPHICAL_SESSION_SOCKET_NAME === "string"
      ? env.OPENCLAW_AI_GRAPHICAL_SESSION_SOCKET_NAME.trim()
      : EXPECTED_SOCKET_NAME,
    width: boundedInteger(env.OPENCLAW_AI_GRAPHICAL_SESSION_WIDTH, 1280, 640, 3840),
    height: boundedInteger(env.OPENCLAW_AI_GRAPHICAL_SESSION_HEIGHT, 720, 480, 2160),
    timeoutMs: boundedInteger(env.OPENCLAW_AI_COMPOSITOR_CAPTURE_TIMEOUT_MS, 1500, 250, 5000),
    pollMs: boundedInteger(env.OPENCLAW_AI_COMPOSITOR_CAPTURE_POLL_MS, 20, 5, 100),
  };
}

function assertTrustedDirectory(directoryPath, expectedUid, stat = lstatSync) {
  const stats = stat(directoryPath);
  if (!stats.isDirectory()
    || stats.uid !== expectedUid
    || (stats.mode & 0o077) !== 0) {
    throw new Error("AI compositor capture directory is not current-user-only.");
  }
}

function frameError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function parsePng(bytes, expectedWidth, expectedHeight) {
  if (bytes.length < 45 || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw frameError("AI compositor capture did not produce a complete PNG frame.", "incomplete_png");
  }
  let offset = 8;
  let width = null;
  let height = null;
  let complete = false;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const chunkEnd = offset + 12 + length;
    if (chunkEnd > bytes.length) {
      throw frameError("AI compositor capture did not produce a complete PNG frame.", "incomplete_png");
    }
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    if (type === "IHDR") {
      if (offset !== 8 || length !== 13) {
        throw frameError("AI compositor capture PNG header is invalid.", "invalid_png");
      }
      width = bytes.readUInt32BE(offset + 8);
      height = bytes.readUInt32BE(offset + 12);
    }
    offset = chunkEnd;
    if (type === "IEND") {
      complete = length === 0 && offset === bytes.length;
      break;
    }
  }
  if (!complete) {
    throw frameError("AI compositor capture did not produce a complete PNG frame.", "incomplete_png");
  }
  if (width !== expectedWidth || height !== expectedHeight) {
    throw frameError(
      "AI compositor capture dimensions do not match the fixed nested output.",
      "dimension_mismatch",
    );
  }
}

function readBoundedFrame(filePath, expectedUid) {
  const flags = fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0);
  const descriptor = openSync(filePath, flags);
  try {
    const pathStats = lstatSync(filePath);
    const descriptorStats = fstatSync(descriptor);
    if (!pathStats.isFile()
      || !descriptorStats.isFile()
      || pathStats.dev !== descriptorStats.dev
      || pathStats.ino !== descriptorStats.ino
      || descriptorStats.uid !== expectedUid
      || (descriptorStats.mode & 0o077) !== 0) {
      throw new Error("AI compositor capture file is not a trusted current-user file.");
    }
    if (descriptorStats.size > WORK_VIEW_VISUAL_FRAME_MAX_BYTES) {
      const error = new Error("AI compositor capture exceeds the visual-frame byte limit.");
      error.code = "frame_exceeds_byte_limit";
      throw error;
    }
    const bytes = Buffer.alloc(WORK_VIEW_VISUAL_FRAME_MAX_BYTES + 1);
    let total = 0;
    while (total < bytes.length) {
      const read = readSync(descriptor, bytes, total, bytes.length - total, null);
      if (read === 0) break;
      total += read;
    }
    if (total > WORK_VIEW_VISUAL_FRAME_MAX_BYTES) {
      const error = new Error("AI compositor capture exceeds the visual-frame byte limit.");
      error.code = "frame_exceeds_byte_limit";
      throw error;
    }
    return bytes.subarray(0, total);
  } finally {
    closeSync(descriptor);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createAiCompositorFrameCapture({
  env = process.env,
  expectedUid = typeof process.getuid === "function" ? process.getuid() : null,
  stat = lstatSync,
  list = readdirSync,
  remove = rmSync,
  writeRequest = writeFileSync,
  onCaptureRequested = null,
  now = () => Date.now(),
} = {}) {
  const config = buildAiCompositorFrameCaptureConfig({ env });
  let sequence = 0;
  let capturePromise = null;
  let lastFrame = unavailableAiCompositorFrame("not_captured", config);

  function paths() {
    if (!path.isAbsolute(config.runtimeBaseDir)
      || config.runtimeDirectory !== EXPECTED_RUNTIME_DIRECTORY
      || config.captureDirectory !== EXPECTED_CAPTURE_DIRECTORY
      || config.socketName !== EXPECTED_SOCKET_NAME) {
      throw new Error("AI compositor capture configuration is invalid.");
    }
    const runtimeDir = path.join(config.runtimeBaseDir, EXPECTED_RUNTIME_DIRECTORY);
    const captureDir = path.join(runtimeDir, EXPECTED_CAPTURE_DIRECTORY);
    return {
      captureDir,
      requestPath: path.join(captureDir, CAPTURE_REQUEST_NAME),
    };
  }

  function snapshot({ includeData = false } = {}) {
    return projectAiCompositorFrame(lastFrame, {
      includeData,
      now: now(),
      width: config.width,
      height: config.height,
    });
  }

  async function capture() {
    if (!config.enabled) {
      return unavailableAiCompositorFrame("disabled", config);
    }
    if (capturePromise) return capturePromise;

    capturePromise = (async () => {
      const { captureDir, requestPath } = paths();
      assertTrustedDirectory(captureDir, expectedUid, stat);
      for (const entry of list(captureDir)) {
        if (!CAPTURE_FILE_PATTERN.test(entry)) continue;
        const stalePath = path.join(captureDir, entry);
        const staleStats = stat(stalePath);
        if (!staleStats.isFile() || staleStats.uid !== expectedUid) {
          throw new Error("AI compositor capture directory contains an untrusted frame path.");
        }
        remove(stalePath, { force: true });
      }

      try {
        writeRequest(requestPath, "capture\n", { encoding: "ascii", flag: "wx", mode: 0o600 });
        await onCaptureRequested?.({ captureDir, requestPath });
        const deadline = now() + config.timeoutMs;
        let lastIncompleteError = null;
        while (now() <= deadline) {
          const candidates = list(captureDir).filter((entry) => CAPTURE_FILE_PATTERN.test(entry));
          if (candidates.length > 1) {
            throw new Error("AI compositor capture produced more than one output frame.");
          }
          if (candidates.length === 1) {
            const framePath = path.join(captureDir, candidates[0]);
            try {
              const bytes = readBoundedFrame(framePath, expectedUid);
              parsePng(bytes, config.width, config.height);
              sequence += 1;
              const capturedAt = new Date(now()).toISOString();
              const frame = {
                registry: AI_COMPOSITOR_FRAME_REGISTRY,
                available: true,
                sourceScope: "ai_owned_nested_output_only",
                captureApi: "weston_output_capture_v1",
                socketName: EXPECTED_SOCKET_NAME,
                mediaType: AI_COMPOSITOR_FRAME_MEDIA_TYPE,
                encoding: "base64_data_url",
                width: config.width,
                height: config.height,
                byteLength: bytes.length,
                sha256: createHash("sha256").update(bytes).digest("hex"),
                capturedAt,
                sequence,
                browserScreenshotApi: false,
                desktopWideCapture: false,
                parentDisplayConnected: false,
                inputAuthority: false,
                persisted: false,
                dataUrl: `data:${AI_COMPOSITOR_FRAME_MEDIA_TYPE};base64,${bytes.toString("base64")}`,
              };
              lastFrame = projectAiCompositorFrame(frame, {
                includeData: false,
                now: now(),
                width: config.width,
                height: config.height,
              });
              return projectAiCompositorFrame(frame, {
                includeData: true,
                now: now(),
                width: config.width,
                height: config.height,
              });
            } catch (error) {
              if (error?.code === "frame_exceeds_byte_limit") throw error;
              if (error?.code !== "incomplete_png") throw error;
              lastIncompleteError = error;
            }
          }
          await sleep(config.pollMs);
        }
        throw lastIncompleteError ?? new Error("AI compositor capture timed out.");
      } catch (error) {
        lastFrame = unavailableAiCompositorFrame(
          error?.code === "frame_exceeds_byte_limit" ? error.code : "capture_failed",
          config,
        );
        return lastFrame;
      } finally {
        remove(requestPath, { force: true });
        for (const entry of list(captureDir)) {
          if (CAPTURE_FILE_PATTERN.test(entry)) {
            remove(path.join(captureDir, entry), { force: true });
          }
        }
      }
    })();

    try {
      return await capturePromise;
    } finally {
      capturePromise = null;
    }
  }

  return {
    capture,
    snapshot,
    config: () => ({
      enabled: config.enabled,
      width: config.width,
      height: config.height,
      maxBytes: WORK_VIEW_VISUAL_FRAME_MAX_BYTES,
      timeoutMs: config.timeoutMs,
    }),
  };
}
