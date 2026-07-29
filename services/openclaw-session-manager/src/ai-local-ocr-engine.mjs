import { createHash } from "node:crypto";
import { spawn } from "node:child_process";

import {
  AI_LOCAL_OCR_MAX_ITEM_CHARS,
  AI_LOCAL_OCR_MAX_ITEMS,
  AI_LOCAL_OCR_MAX_TOTAL_CHARS,
} from "../../../packages/shared-utils/src/ai-local-ocr.mjs";

const FRAME_DATA_PREFIX = "data:image/png;base64,";
const FRAME_MAX_BYTES = 262_144;
const TSV_MAX_BYTES = 1_048_576;
const STDERR_MAX_BYTES = 8_192;
const MIN_CONFIDENCE = 40;

function enabled(value) {
  return value === true || value === "1" || value === "true";
}

function boundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : fallback;
}

export function buildAiLocalOcrConfig({ env = process.env } = {}) {
  return {
    enabled: enabled(env.OPENCLAW_AI_LOCAL_OCR_ENABLED),
    executable: typeof env.OPENCLAW_AI_LOCAL_OCR_TESSERACT_PATH === "string"
      ? env.OPENCLAW_AI_LOCAL_OCR_TESSERACT_PATH.trim()
      : "",
    timeoutMs: boundedInteger(env.OPENCLAW_AI_LOCAL_OCR_TIMEOUT_MS, 5000, 500, 15_000),
  };
}

function executableIsFixed(path) {
  return /^\/nix\/store\/[a-z0-9]{8,}-[^/]+\/bin\/tesseract$/u.test(path);
}

function runTesseractProcess({ executable, input, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, [
      "stdin",
      "stdout",
      "-l",
      "eng",
      "--psm",
      "11",
      "tsv",
    ], {
      cwd: "/",
      env: {
        LANG: "C.UTF-8",
        LC_ALL: "C.UTF-8",
      },
      stdio: ["pipe", "pipe", "pipe"],
    });
    const stdout = [];
    const stderr = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let settled = false;

    function finish(error, value = null) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve(value);
    }

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish(new Error("AI local OCR process timed out."));
    }, timeoutMs);

    child.once("error", () => finish(new Error("AI local OCR process could not start.")));
    child.stdout.on("data", (chunk) => {
      stdoutBytes += chunk.length;
      if (stdoutBytes > TSV_MAX_BYTES) {
        child.kill("SIGKILL");
        finish(new Error("AI local OCR output exceeded its byte limit."));
        return;
      }
      stdout.push(chunk);
    });
    child.stderr.on("data", (chunk) => {
      if (stderrBytes >= STDERR_MAX_BYTES) return;
      const remaining = STDERR_MAX_BYTES - stderrBytes;
      stderr.push(chunk.subarray(0, remaining));
      stderrBytes += Math.min(chunk.length, remaining);
    });
    child.once("close", (code, signal) => {
      if (code !== 0 || signal) {
        finish(new Error("AI local OCR process failed."));
        return;
      }
      finish(null, Buffer.concat(stdout, stdoutBytes).toString("utf8"));
    });
    child.stdin.once("error", () => {
      child.kill("SIGKILL");
      finish(new Error("AI local OCR input transport failed."));
    });
    child.stdin.end(input);
  });
}

function cleanWord(value) {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u001f\u007f]/gu, " ").replace(/\s+/gu, " ").trim().slice(0, 80)
    : "";
}

function validBounds({ x, y, width, height }, frameWidth, frameHeight) {
  return Number.isInteger(x)
    && Number.isInteger(y)
    && Number.isInteger(width)
    && Number.isInteger(height)
    && x >= 0
    && y >= 0
    && width > 0
    && height > 0
    && x + width <= frameWidth
    && y + height <= frameHeight;
}

export function parseTesseractTsv(tsv, { width = 1280, height = 720 } = {}) {
  if (typeof tsv !== "string" || Buffer.byteLength(tsv, "utf8") > TSV_MAX_BYTES) {
    throw new Error("AI local OCR output is invalid.");
  }
  const lines = new Map();
  for (const row of tsv.split(/\r?\n/u).slice(1, 10_001)) {
    if (!row) continue;
    const columns = row.split("\t");
    if (columns.length !== 12 || columns[0] !== "5") continue;
    const confidence = Number.parseFloat(columns[10]);
    const text = cleanWord(columns[11]);
    const bounds = {
      x: Number.parseInt(columns[6], 10),
      y: Number.parseInt(columns[7], 10),
      width: Number.parseInt(columns[8], 10),
      height: Number.parseInt(columns[9], 10),
    };
    if (!text
      || !Number.isFinite(confidence)
      || confidence < MIN_CONFIDENCE
      || confidence > 100
      || !validBounds(bounds, width, height)) continue;
    const key = columns.slice(1, 5).join(":");
    const existing = lines.get(key) ?? {
      words: [],
      confidenceTotal: 0,
      confidenceWeight: 0,
      left: bounds.x,
      top: bounds.y,
      right: bounds.x + bounds.width,
      bottom: bounds.y + bounds.height,
    };
    existing.words.push(text);
    existing.confidenceTotal += confidence * text.length;
    existing.confidenceWeight += text.length;
    existing.left = Math.min(existing.left, bounds.x);
    existing.top = Math.min(existing.top, bounds.y);
    existing.right = Math.max(existing.right, bounds.x + bounds.width);
    existing.bottom = Math.max(existing.bottom, bounds.y + bounds.height);
    lines.set(key, existing);
  }

  const sourceItemCount = lines.size;
  const items = [];
  let characterCount = 0;
  let truncated = sourceItemCount > AI_LOCAL_OCR_MAX_ITEMS;
  for (const line of lines.values()) {
    if (items.length >= AI_LOCAL_OCR_MAX_ITEMS
      || characterCount >= AI_LOCAL_OCR_MAX_TOTAL_CHARS) {
      truncated = true;
      break;
    }
    const fullText = line.words.join(" ");
    const itemBudget = Math.min(
      AI_LOCAL_OCR_MAX_ITEM_CHARS,
      AI_LOCAL_OCR_MAX_TOTAL_CHARS - characterCount,
    );
    const text = fullText.slice(0, itemBudget).trim();
    if (!text) continue;
    if (text.length < fullText.length) truncated = true;
    items.push({
      ordinal: items.length + 1,
      text,
      confidence: line.confidenceWeight > 0
        ? line.confidenceTotal / line.confidenceWeight / 100
        : 0,
      bounds: {
        x: line.left,
        y: line.top,
        width: line.right - line.left,
        height: line.bottom - line.top,
      },
    });
    characterCount += text.length;
  }
  return { items, sourceItemCount, characterCount, truncated };
}

function frameBytes(frame) {
  if (frame?.dataExposed !== true
    || typeof frame.dataUrl !== "string"
    || !frame.dataUrl.startsWith(FRAME_DATA_PREFIX)
    || !Number.isInteger(frame.byteLength)
    || frame.byteLength < 1
    || frame.byteLength > FRAME_MAX_BYTES
    || typeof frame.sha256 !== "string") {
    throw new Error("AI local OCR requires one bounded transient compositor frame.");
  }
  const bytes = Buffer.from(frame.dataUrl.slice(FRAME_DATA_PREFIX.length), "base64");
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (bytes.length !== frame.byteLength || hash !== frame.sha256) {
    throw new Error("AI local OCR frame bytes do not match their binding.");
  }
  return bytes;
}

export function createAiLocalOcrEngine({
  env = process.env,
  runProcess = runTesseractProcess,
} = {}) {
  const config = buildAiLocalOcrConfig({ env });

  async function recognize(frame) {
    if (!config.enabled) throw new Error("AI local OCR is disabled.");
    if (!executableIsFixed(config.executable)) {
      throw new Error("AI local OCR executable is not a fixed Nix-store path.");
    }
    const bytes = frameBytes(frame);
    const tsv = await runProcess({
      executable: config.executable,
      input: bytes,
      timeoutMs: config.timeoutMs,
    });
    return parseTesseractTsv(tsv, { width: frame.width, height: frame.height });
  }

  return {
    recognize,
    config: () => ({
      enabled: config.enabled,
      executableFixed: executableIsFixed(config.executable),
      language: "eng",
      segmentationMode: 11,
      timeoutMs: config.timeoutMs,
      inputTransport: "stdin",
      outputTransport: "stdout",
      maximumOutputBytes: TSV_MAX_BYTES,
    }),
  };
}
