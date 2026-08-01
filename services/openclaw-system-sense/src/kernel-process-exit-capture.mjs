import { createKernelProcessExitReadback } from "./kernel-process-exit-readback.mjs";

const REGISTRY = "openclaw-kernel-process-exit-v0";
const TRACEPOINT = "sched_process_exit";
const MAX_DURATION_MS = 5000;
const MAX_EVENTS = 4096;
const EVENT_KEYS = ["timestampNs", "pid", "uid", "comm"];
const MAX_PROBE_OUTPUT_BYTES = 2 * 1024 * 1024;

function invalidOutput(message) {
  const error = new Error(message);
  error.code = "invalid_output";
  return error;
}

function boundedInteger(value, fallback, maximum) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

function classifyProbeError(error) {
  const code = typeof error?.code === "string" ? error.code : "";
  const message = typeof error?.message === "string" ? error.message.toLowerCase() : "";
  if (code === "EACCES" || code === "EPERM" || message.includes("permission denied") || message.includes("operation not permitted")) {
    return { code: "permission_denied", message: "Kernel process-exit probe permission was denied." };
  }
  if (code === "ETIMEDOUT" || error?.signal === "SIGTERM" || message.includes("timed out")) {
    return { code: "timeout", message: "Kernel process-exit probe exceeded its bounded capture window." };
  }
  return { code: "unavailable", message: "Kernel process-exit probe could not be executed." };
}

function parseEvents(stdout, maxEvents) {
  const lines = String(stdout ?? "").split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
  if (lines.length > maxEvents) throw invalidOutput("probe output exceeded the event limit");
  return lines.map((line) => {
    let value;
    try { value = JSON.parse(line); } catch { throw invalidOutput("probe output was not valid JSON"); }
    if (!value || typeof value !== "object" || Array.isArray(value)) throw invalidOutput("probe output event was not an object");
    const keys = Object.keys(value);
    if (keys.length !== EVENT_KEYS.length || EVENT_KEYS.some((key) => !keys.includes(key))) {
      throw invalidOutput("probe output event fields were outside the allowlist");
    }
    if (typeof value.timestampNs !== "string" || !/^\d+$/u.test(value.timestampNs)) throw invalidOutput("probe output timestamp was invalid");
    if (!Number.isInteger(value.pid) || value.pid < 1 || !Number.isInteger(value.uid) || value.uid < 0) throw invalidOutput("probe output process identity was invalid");
    if (typeof value.comm !== "string" || value.comm.length === 0 || value.comm.length > 15 || /[\r\n]/u.test(value.comm)) throw invalidOutput("probe output command name was invalid");
    return { timestampNs: value.timestampNs, pid: value.pid, uid: value.uid, comm: value.comm };
  });
}

function baseReadModel({ enabled, status, available, captureOk, events = [], error = null, readback }) {
  return {
    ok: true,
    registry: REGISTRY,
    mode: "read_only",
    enabled,
    available,
    captureOk,
    status,
    eventCount: events.length,
    events,
    readback,
    source: {
      transport: "libbpf_ring_buffer",
      attachment: "raw_tracepoint",
      tracepoint: TRACEPOINT,
      fields: EVENT_KEYS,
      commCaptured: true,
      pidCaptured: true,
      uidCaptured: true,
      executableCaptured: false,
      persisted: false,
      policyExecution: false,
      hostMutation: false,
    },
    error,
  };
}

export function createKernelProcessExitCapture({
  enabled = false,
  probeCommand = "",
  durationMs = 1000,
  maxEvents = 128,
  execFile: runProbe,
} = {}) {
  const boundedDurationMs = boundedInteger(durationMs, 1000, MAX_DURATION_MS);
  const boundedMaxEvents = boundedInteger(maxEvents, 128, MAX_EVENTS);
  const buildReadback = createKernelProcessExitReadback();
  const buildReadModel = (params) => baseReadModel({
    ...params,
    readback: buildReadback({
      events: params.events ?? [],
      captureWindowMs: boundedDurationMs,
      eventLimit: boundedMaxEvents,
      captureStatus: params.status,
    }),
  });
  let activeCapture = null;

  async function captureNow() {
    if (!enabled) return buildReadModel({ enabled: false, status: "disabled", available: false, captureOk: false });
    if (typeof probeCommand !== "string" || !probeCommand.trim() || typeof runProbe !== "function") {
      return buildReadModel({
        enabled: true,
        status: "unavailable",
        available: false,
        captureOk: false,
        error: { code: "probe_not_configured", message: "Kernel process-exit probe is not configured." },
      });
    }
    try {
      const result = await runProbe(probeCommand, [
        "--duration-ms", String(boundedDurationMs),
        "--max-events", String(boundedMaxEvents),
      ], {
        timeout: boundedDurationMs + 1000,
        maxBuffer: Math.min(MAX_PROBE_OUTPUT_BYTES, 8192 + (boundedMaxEvents * 256)),
        killSignal: "SIGTERM",
      });
      return buildReadModel({
        enabled: true,
        status: "captured",
        available: true,
        captureOk: true,
        events: parseEvents(result?.stdout, boundedMaxEvents),
      });
    } catch (error) {
      const classified = error?.code === "invalid_output"
        ? { code: "invalid_output", message: "Kernel process-exit probe returned invalid event data." }
        : classifyProbeError(error);
      return buildReadModel({ enabled: true, status: classified.code, available: false, captureOk: false, error: classified });
    }
  }

  async function capture() {
    if (activeCapture) return buildReadModel({ enabled, status: "busy", available: false, captureOk: false, error: { code: "busy", message: "Kernel process-exit probe capture is already in progress." } });
    activeCapture = captureNow();
    try { return await activeCapture; } finally { activeCapture = null; }
  }

  return { capture, config: { enabled, durationMs: boundedDurationMs, maxEvents: boundedMaxEvents } };
}

export const KERNEL_PROCESS_EXIT_REGISTRY = REGISTRY;
